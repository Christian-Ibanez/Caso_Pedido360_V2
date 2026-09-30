# Pedidos360 – Despliegue en AWS EC2 con Docker Compose

Tres instancias EC2, un `compose.yml` por instancia (según el enunciado):

| Instancia | Carpeta | Qué levanta | Tamaño sugerido |
|---|---|---|---|
| `ec2-apps` | `infra/apps` | BFF + orders, catalog, notify, audit, report (+ Oracle local opcional) | t3.large (6 JVM) |
| `ec2-mq` | `infra/mq` | Cluster RabbitMQ de 2 nodos con management UI | t3.medium |
| `ec2-kafka` | `infra/kafka` | 3 Zookeeper + 3 brokers Kafka + Kafka UI + creación de tópicos | t3.large (8 GB) |

Flujo: `frontend (MSAL) -> API Gateway (JWT authorizer Entra ID) -> BFF :8080 (valida JWT + rol) -> microservicios`.

## 1. Preparar cada EC2 (Amazon Linux 2023)

```bash
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user && newgrp docker
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose && sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
git clone https://github.com/Christian-Ibanez/Caso_Pedido360_V2.git && cd Caso_Pedido360_V2
```

Levantar en este orden: **mq**, **kafka**, **apps**.

### ec2-mq
```bash
cd infra/mq && cp .env.example .env   # cambiar el cookie
docker compose up -d
docker exec rabbitmq1 rabbitmqctl cluster_status   # Running Nodes: rabbit@rabbitmq1, rabbit@rabbitmq2
```
UI: `http://<IP_MQ>:15672` y `:15673` (usuario `pedidos360` / `pedidos360`, cambiarlo con `rabbitmqctl change_password`).
La topología se carga sola desde `definitions.json`.

### ec2-kafka
```bash
cd infra/kafka && cp .env.example .env   # KAFKA_PUBLIC_HOST = IP privada de ec2-kafka
docker compose up -d
docker logs kafka-init                    # debe listar los 4 tópicos con 3 particiones y 3 réplicas
```
Kafka UI: `http://<IP_KAFKA>:8090` (usuario/clave de `.env`). Desde ahí se administran brokers, tópicos y configuraciones.

### ec2-apps
```bash
cd infra/apps && cp .env.example .env    # IPs privadas de mq/kafka, base Oracle cloud, tenant de Entra ID
docker compose up -d --build
# Sin base cloud todavía: DB_URL=jdbc:oracle:thin:@//oracle:1521/FREEPDB1 y
docker compose --profile oracle-local up -d --build
```
Swagger de cada micro: `http://<IP_APPS>:<puerto>/swagger-ui.html`.

## 2. Security Groups

| SG | Entrada | Origen |
|---|---|---|
| `sg-apps` | 8080 (BFF) | API Gateway (o 0.0.0.0/0 si el HTTP API llega por internet) |
| `sg-apps` | 8081-8086 (Swagger/pruebas) | solo tu IP |
| `sg-mq` | 5672-5673 (AMQP) | `sg-apps` |
| `sg-mq` | 15672-15673 (UI) | solo tu IP |
| `sg-kafka` | 9092-9094 (brokers) | `sg-apps` |
| `sg-kafka` | 8090 (Kafka UI) | solo tu IP |
| todos | 22 (SSH) | solo tu IP |

## 3. API Gateway (HTTP API)

- Authorizer JWT: issuer `https://login.microsoftonline.com/<TENANT_ID>/v2.0`, audience `api://<API_CLIENT_ID>` (o el client id, según cómo emita el token el tenant).
- Rutas (todas con el authorizer, integración HTTP proxy al BFF):

| Ruta | Integración |
|---|---|
| `ANY /api/orders` y `ANY /api/orders/{proxy+}` | `http://<IP_APPS>:8080/api/orders/{proxy}` |
| `ANY /api/catalog/{proxy+}` | `http://<IP_APPS>:8080/api/catalog/{proxy}` |
| `GET /api/report/{proxy+}` | `http://<IP_APPS>:8080/api/report/{proxy}` |
| `GET /api/audit/{proxy+}` | `http://<IP_APPS>:8080/api/audit/{proxy}` |

- CORS en el HTTP API: origen del front, métodos GET/POST/PUT/DELETE/OPTIONS, header `Authorization, Content-Type`.

## 4. Endpoints y roles (el BFF valida el rol del claim `roles`)

| Servicio | Puerto | Endpoints | Roles |
|---|---|---|---|
| orders | 8081 | `POST /api/orders`, `GET /api/orders/{id}`, `GET /api/orders?status=&from=&to=`, `PUT /api/orders/{id}`, `PUT /api/orders/{id}/status`, `DELETE /api/orders/{id}` | autenticado |
| catalog | 8082 | `GET /api/catalog/products?q=&category=&onlyActive=`, `GET /api/catalog/products/{id}` | autenticado |
| catalog | 8082 | `POST /api/catalog/products`, `PUT /api/catalog/products/{id}` (precio/stock, parcial), `DELETE /api/catalog/products/{id}` | Admin |
| catalog | 8082 | `POST /api/catalog/products/stock/decrease` y `/increase` | solo interno (orders); el BFF los bloquea |
| notify | 8083 | sin API pública (consumidor RabbitMQ; `/actuator/health`, `/actuator/metrics/pedidos360.dlq.messages`) | – |
| audit | 8084 | `GET /api/audit/events?user=&type=&orderId=&from=&to=&limit=`, `GET /api/audit/events/{id}`, `GET /api/audit/orders/{orderId}/timeline`, `GET /api/audit/event-types`, `GET /api/audit/actors` | Admin, Auditor |
| report | 8086 | `GET /api/report/kpis?range=last24h`, `GET /api/report/top-products?range=last7d&limit=5`, `GET /api/report/sales-by-hour?range=`, `GET /api/report/lead-time?range=` | Admin |

`range` acepta `lastNh` o `lastNd` (p. ej. `last24h`, `last7d`, `last30d`).

## 5. Flujo de negocio

1. `POST /api/orders` → pedido `CREADO`, evento `OrderCreated` en Kafka y comando `email.send` en RabbitMQ.
2. `PUT .../status ACEPTADO` → orders llama a catalog `stock/decrease` (si falta stock responde **409** y el pedido sigue `CREADO`), evento `OrderAccepted`, `email.send` + `kitchen.ticket`.
3. `EN_PREPARACION`, `DESPACHADO` (no se puede sin aceptar: 409), `ENTREGADO` → eventos `OrderPreparing/Dispatched/Delivered`; al entregar además `invoice.gen.pdf` (boleta).
4. `CANCELADO` → `OrderCancelled`, correo prioritario `email.send.high` por `cmd.topic`; si ya había descontado stock, se repone.
5. audit y report consumen `orders.events` con grupos distintos: auditoría guarda quién/qué/cuándo/desde dónde y publica en `audit.timeline`; reportería arma los KPIs sin llamar a orders (no bloquea el core).

La publicación ocurre después del commit y en un hilo aparte: si Kafka o RabbitMQ están caídos el pedido igual se guarda.

## 6. RabbitMQ

| Exchange | Tipo | Cola | Binding |
|---|---|---|---|
| cmd.direct | direct | q.cmd.email / q.cmd.kitchen / q.cmd.invoice | email.send / kitchen.ticket / invoice.gen |
| cmd.topic | topic | q.cmd.email / q.cmd.kitchen / q.cmd.invoice | email.# / kitchen.# / invoice.# |
| cmd.dead.dlx | direct | q.cmd.email.dlq / q.cmd.kitchen.dlq / q.cmd.invoice.dlq | email.send / kitchen.ticket / invoice.gen |

- En AMQP `*` es exactamente una palabra, así que `email.*` no recibe `email.send.high` (el ejemplo del enunciado); por eso se usa `#`.
- Envelope común: `type, eventId, timestamp, traceId, correlationId, payload`.
- notify hace ACK/NACK explícito; al fallar hace `basicNack(requeue=false)` y RabbitMQ lo manda por `cmd.dead.dlx` a la DLQ. notify escucha las 3 DLQ, registra cola de origen, motivo, cantidad y cuerpo, y suma la métrica `pedidos360.dlq.messages{queue}`.
- Idempotencia: notify recuerda los `eventId` procesados y hace ACK sin reenviar los duplicados.
- **Demo de DLQ**: crear un pedido con `customerEmail` que termine en `@fail.test`.

## 7. Kafka

| Tópico | Particiones | Réplicas | Política | Retención |
|---|---|---|---|---|
| orders.events | 3 | 3 | delete | 7 días |
| audit.timeline | 3 | 3 | compact,delete | 30 días |
| orders.events.audit.DLT | 3 | 3 | delete | 14 días |
| orders.events.report.DLT | 3 | 3 | delete | 14 días |

- Key = id del pedido, así todos los eventos de un pedido van a la misma partición en orden.
- Consumidores: 3 reintentos (1 s) y luego el mensaje original va a su DLT con headers de error (excepción, stacktrace, tópico/partición/offset original, timestamp).
- **Demo de DLT**: desde Kafka UI producir en `orders.events` un mensaje que no sea JSON; aparece en ambos DLT.

## 8. Oracle cloud

Todas las tablas tienen prefijo `P360_` (`P360_ORDERS`, `P360_PRODUCTS`, `P360_AUDIT_EVENTS`, `P360_RPT_*`), por lo que los micros pueden usar el mismo usuario. `ddl-auto: update` crea las tablas al partir. Para Autonomous DB sin wallet usar la cadena TLS completa en `DB_URL` (ejemplo en `infra/apps/.env.example`).
