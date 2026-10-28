# Pedidos360 – Despliegue en AWS EC2 con Docker Compose

Tres instancias EC2, un `compose.yml` por instancia. El frontend corre en el equipo local.

| Instancia | Carpeta | Qué levanta | Tamaño sugerido |
|---|---|---|---|
| `ec2-apps` | `infra/apps` | Oracle Free + orders, catalog, notify | t3.large (Oracle + 3 JVM) |
| `ec2-mq` | `infra/mq` | Cluster RabbitMQ de 2 nodos con management UI | t3.medium |
| `ec2-bff` | `infra/bff` | BFF (valida el JWT de Entra ID y enruta a los micros) | t3.medium |
| (local) | `frontend` | React + MSAL con `npm run dev` en `http://localhost:5173` | – |

Flujo: `frontend local (MSAL / Entra ID) -> BFF :8080 en ec2-bff (valida JWT + rol) -> orders/catalog en ec2-apps (IP privada) -> RabbitMQ en ec2-mq -> notify`.

**Kafka no está desplegado.** `orders` corre con `KAFKA_ENABLED=false`: los comandos a RabbitMQ salen igual y solo se omite el evento en `orders.events`. `audit` y `report` (consumidores de Kafka) quedan fuera; se levantan con el perfil `kafka` de `infra/apps` cuando exista una instancia con `infra/kafka` (ver sección 7).

## 1. Preparar cada EC2 (Amazon Linux 2023)

```bash
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user && newgrp docker
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
# docker compose --build necesita buildx >= 0.17 (Amazon Linux no lo trae)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/*
git clone https://github.com/Christian-Ibanez/Caso_Pedido360_V2.git && cd Caso_Pedido360_V2
```

Disco: 20–30 GB por instancia (las imágenes de Maven/Java y Oracle no caben en los 8 GB por defecto).

Levantar en este orden: **mq**, **apps**, **bff**.

### ec2-mq
```bash
cd infra/mq && cp .env.example .env   # cambiar el cookie
docker compose up -d
docker exec rabbitmq1 rabbitmqctl cluster_status   # Running Nodes: rabbit@rabbitmq1, rabbit@rabbitmq2
```
UI: `http://<IP_PUBLICA_MQ>:15672` y `:15673` (usuario `pedidos360` / `pedidos360`, cambiarlo con `rabbitmqctl change_password`).
La topología (3 colas + 3 DLQ, exchanges y bindings) se carga sola desde `definitions.json`.

### ec2-apps
```bash
cd infra/apps && cp .env.example .env    # RABBITMQ_ADDRESSES = IP privada de ec2-mq
docker compose up -d --build
docker ps                                # oracle (healthy), orders-svc, catalog-svc, notify-svc
```
Oracle tarda ~1 min en quedar `healthy`; los micros esperan a que lo esté. Swagger: `http://<IP_PUBLICA_APPS>:8081/swagger-ui.html` (orders) y `:8082` (catalog).

### ec2-bff
```bash
cd infra/bff && cp .env.example .env     # APPS_HOST = IP privada de ec2-apps
docker compose up -d --build
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/api/orders   # 401 sin token = OK
```

### Frontend (local)
```bash
cd frontend
echo "VITE_API_BASE_URL=http://<IP_PUBLICA_EC2_BFF>:8080" > .env.local
npm install && npm run dev               # http://localhost:5173
```
La IP pública cambia cada vez que la instancia se detiene; las privadas (las de los `.env` de `infra/`) se mantienen.

## 2. Security Groups

| SG | Entrada | Origen |
|---|---|---|
| `p360-bff` | 8080 (BFF) | 0.0.0.0/0 (el navegador del usuario llama directo al BFF) |
| `p360-apps` | 8081-8082 (orders, catalog) | `p360-bff` |
| `p360-apps` | 8081-8086 (Swagger/pruebas) | solo tu IP |
| `p360-apps` | 1521 (Oracle, SQL Developer) | solo tu IP |
| `p360-mq` | 5672-5673 (AMQP) | `p360-apps` |
| `p360-mq` | 15672-15673 (UI) | solo tu IP |
| todos | 22 (SSH) | solo tu IP |

(Los nombres de security group no pueden empezar con `sg-`, por eso el prefijo `p360-`.)

## 3. Microsoft Entra ID

El login del frontend se hace con Microsoft Entra ID (tenant `85ffb3f2-fe8a-4eef-9c3d-f1f4983a31b6`).

- App del frontend `spa-fullstack` (`0f1c9d10-…`): plataforma SPA con redirect URIs `http://localhost:5173` y `http://localhost:5173/redirect.html`.
- App de la API `api-fullstack` (`c11a2330-…`): expone el scope `access_as_user`, `requestedAccessTokenVersion: 2` en el manifiesto (el BFF valida el issuer `…/v2.0` y la audiencia = client id) y define el app role `Admin`.
- Los usuarios deben existir en el tenant; el rol `Admin` se asigna en Aplicaciones empresariales → `api-fullstack` → Usuarios y grupos.

### API Gateway (opcional)

Si se quiere un HTTP API delante del BFF: authorizer JWT con issuer `https://login.microsoftonline.com/<TENANT_ID>/v2.0` y audience `<API_CLIENT_ID>`, rutas `ANY /api/orders`, `ANY /api/orders/{proxy+}` y `ANY /api/catalog/{proxy+}` con integración HTTP proxy a `http://<IP_PUBLICA_BFF>:8080/...`, y CORS para el origen del frontend. En ese caso `VITE_API_BASE_URL` apunta a la URL del API Gateway.

## 4. Endpoints y roles (el BFF valida el rol del claim `roles`)

| Servicio | Puerto | Endpoints | Roles |
|---|---|---|---|
| orders | 8081 | `POST /api/orders`, `GET /api/orders/{id}`, `GET /api/orders?status=&from=&to=`, `PUT /api/orders/{id}`, `PUT /api/orders/{id}/status`, `DELETE /api/orders/{id}` | autenticado |
| catalog | 8082 | `GET /api/catalog/products?q=&category=&onlyActive=`, `GET /api/catalog/products/{id}` | autenticado |
| catalog | 8082 | `POST /api/catalog/products`, `PUT /api/catalog/products/{id}` (precio/stock, parcial), `DELETE /api/catalog/products/{id}` | Admin |
| catalog | 8082 | `POST /api/catalog/products/stock/decrease` y `/increase` | solo interno (orders); el BFF los bloquea |
| notify | 8083 | sin API pública (consumidor RabbitMQ; `/actuator/health`, `/actuator/metrics/pedidos360.dlq.messages`) | – |
| audit (requiere Kafka) | 8084 | `GET /api/audit/events?user=&type=&orderId=&from=&to=&limit=`, `GET /api/audit/events/{id}`, `GET /api/audit/orders/{orderId}/timeline`, `GET /api/audit/event-types`, `GET /api/audit/actors` | Admin, Auditor |
| report (requiere Kafka) | 8086 | `GET /api/report/kpis?range=last24h`, `GET /api/report/top-products?range=last7d&limit=5`, `GET /api/report/sales-by-hour?range=`, `GET /api/report/lead-time?range=` | Admin |

`range` acepta `lastNh` o `lastNd` (p. ej. `last24h`, `last7d`, `last30d`).

## 5. Flujo de negocio

1. `POST /api/orders` → pedido `CREADO`, evento `OrderCreated` en Kafka (si `KAFKA_ENABLED=true`) y comando `email.send` en RabbitMQ.
2. `PUT .../status ACEPTADO` → orders llama a catalog `stock/decrease` (si falta stock responde **409** y el pedido sigue `CREADO`), evento `OrderAccepted`, `email.send` + `kitchen.ticket`.
3. `EN_PREPARACION`, `DESPACHADO` (no se puede sin aceptar: 409), `ENTREGADO` → eventos `OrderPreparing/Dispatched/Delivered`; al entregar además `invoice.gen.pdf` (boleta).
4. `CANCELADO` → `OrderCancelled`, correo prioritario `email.send.high` por `cmd.topic`; si ya había descontado stock, se repone.
5. (Con Kafka) audit y report consumen `orders.events` con grupos distintos: auditoría guarda quién/qué/cuándo/desde dónde y publica en `audit.timeline`; reportería arma los KPIs sin llamar a orders (no bloquea el core).

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

## 7. Kafka (no desplegado por ahora)

Para activarlo: levantar `infra/kafka` en una instancia propia, en `infra/apps/.env` poner `KAFKA_ENABLED=true` y `KAFKA_BOOTSTRAP_SERVERS`, y ejecutar `docker compose --profile kafka up -d --build` (agrega audit y report). En el BFF, `AUDIT_URL`/`REPORT_URL` ya apuntan a `ec2-apps`.

| Tópico | Particiones | Réplicas | Política | Retención |
|---|---|---|---|---|
| orders.events | 3 | 3 | delete | 7 días |
| audit.timeline | 3 | 3 | compact,delete | 30 días |
| orders.events.audit.DLT | 3 | 3 | delete | 14 días |
| orders.events.report.DLT | 3 | 3 | delete | 14 días |

- Key = id del pedido, así todos los eventos de un pedido van a la misma partición en orden.
- Consumidores: 3 reintentos (1 s) y luego el mensaje original va a su DLT con headers de error (excepción, stacktrace, tópico/partición/offset original, timestamp).
- **Demo de DLT**: desde Kafka UI producir en `orders.events` un mensaje que no sea JSON; aparece en ambos DLT.

## 8. Oracle

Por defecto Oracle Free corre como contenedor en `ec2-apps` (volumen `oradata`, servicio `FREEPDB1`, usuario `pedidos360`). Todas las tablas tienen prefijo `P360_` (`P360_ORDERS`, `P360_PRODUCTS`, `P360_AUDIT_EVENTS`, `P360_RPT_*`), por lo que los micros pueden usar el mismo usuario. `ddl-auto: update` crea las tablas al partir. Para Autonomous DB sin wallet usar la cadena TLS completa en `DB_URL` (ejemplo en `infra/apps/.env.example`).
