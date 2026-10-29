# Pedidos360 – Despliegue en AWS EC2 con Docker Compose

Tres instancias EC2, un `compose.yml` por instancia. El frontend corre en el equipo local.

| Instancia | Carpeta | Qué levanta | Tamaño sugerido |
|---|---|---|---|
| `ec2-apps` | `infra/apps` | Oracle Free + orders, catalog, notify | t3.large (Oracle + 3 JVM) |
| `ec2-mq` | `infra/mq` | Cluster RabbitMQ de 2 nodos con management UI | t3.medium |
| `ec2-bff` | `infra/bff` | BFF (valida el JWT de Entra ID y enruta a los micros) | t3.medium |
| (local) | `frontend` | React + MSAL con `npm run dev` en `http://localhost:5173` | – |

Flujo: `frontend local (MSAL / Entra ID) -> BFF :8080 en ec2-bff (valida JWT + rol) -> orders/catalog/notify en ec2-apps (IP privada) -> RabbitMQ en ec2-mq -> notify`.

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
La topología (4 colas + 4 DLQ, exchanges y bindings) se carga sola desde `definitions.json`.

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
| `p360-apps` | 8081-8083, 8085 (orders, catalog, notify, mqadmin) | `p360-bff` |
| `p360-apps` | 8081-8086 (Swagger/pruebas) | solo tu IP |
| `p360-apps` | 1521 (Oracle, SQL Developer) | solo tu IP |
| `p360-mq` | 5672-5673 (AMQP) | `p360-apps` |
| `p360-mq` | 15672-15673 (UI) | solo tu IP |
| `p360-mq` | 15672-15673 (API de Management) | `p360-apps` (mqadmin lista colas, exchanges y bindings) |
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
| notify | 8083 | `GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` (campana; el BFF agrega `X-User-Email` y `X-User-Roles` desde el JWT). Además consume RabbitMQ; `/actuator/health`, `/actuator/metrics/pedidos360.dlq.messages` | autenticado (cada usuario ve las suyas) |
| mqadmin | 8085 | `GET/POST /api/mq/queues`, `GET/DELETE /api/mq/queues/{name}?ifEmpty=true`, `GET/POST /api/mq/exchanges`, `GET/DELETE /api/mq/exchanges/{name}`, `GET/POST /api/mq/bindings`, `DELETE /api/mq/bindings?exchange=&queue=&routingKey=` | Admin |
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
| cmd.direct | direct | q.cmd.email / q.cmd.kitchen / q.cmd.invoice / q.notify.inapp | email.send / kitchen.ticket / invoice.gen / notify.inapp |
| cmd.topic | topic | q.cmd.email / q.cmd.kitchen / q.cmd.invoice / q.notify.inapp | email.# / kitchen.# / invoice.# / notify.# |
| cmd.dead.dlx | direct | q.cmd.email.dlq / q.cmd.kitchen.dlq / q.cmd.invoice.dlq / q.notify.inapp.dlq | email.send / kitchen.ticket / invoice.gen / notify.inapp |

Dead-lettering con políticas (*Admin → Policies*), como en la guía de la Parte 1. Cada patrón calza solo con la cola principal, no con su `.dlq`:

| Política | Patrón | dead-letter-exchange | dead-letter-routing-key |
|---|---|---|---|
| policy.email.dlx | `^q\.cmd\.email$` | cmd.dead.dlx | email.send |
| policy.kitchen.dlx | `^q\.cmd\.kitchen$` | cmd.dead.dlx | kitchen.ticket |
| policy.invoice.dlx | `^q\.cmd\.invoice$` | cmd.dead.dlx | invoice.gen |
| policy.notify.dlx | `^q\.notify\.inapp$` | cmd.dead.dlx | notify.inapp |

Las colas también declaran esos mismos argumentos `x-dead-letter-*` (ms-notify las crea si el broker está vacío); como coinciden con la política, el resultado es el mismo. Para cargar las políticas en un broker que ya está corriendo:

```bash
docker cp definitions.json rabbitmq1:/tmp/definitions.json
docker exec rabbitmq1 rabbitmqctl import_definitions /tmp/definitions.json
```

- En AMQP `*` es exactamente una palabra, así que `email.*` no recibe `email.send.high` (el ejemplo del enunciado); por eso se usa `#`.
- Envelope común: `type, eventId, timestamp, traceId, correlationId, payload`.
- Nombres centralizados: en orders, en la clase `@Configuration` `MessagingConfig`; en notify, en `RabbitTopology` (`@Configuration`), que además declara los beans `Queue`, `Exchange` y `Binding` de cada flujo.
- Consumidores por dominio en notify (un `@RabbitListener` por clase): `email.EmailConsumer`, `kitchen.KitchenConsumer`, `invoice.InvoiceConsumer`, `inapp.InAppConsumer`. Todos delegan la confirmación en `messaging.CommandProcessor`.
- Confirmación manual (ACK/NACK) en `CommandProcessor`, con tres rutas:

| Resultado | Qué hace | Ejemplo para la demo |
|---|---|---|
| OK (o `eventId` repetido) | `basicAck` | cualquier pedido |
| Error recuperable (`TransientProcessingException`, error transitorio de BD) | Reintenta en el consumidor con espera exponencial (500 ms, 1 s) hasta `app.messaging.retry.max-attempts` (3). Si un intento funciona, `basicAck` | `customerEmail` que termine en `@retry.test`: falla 2 veces y funciona a la 3.ª |
| Reintentos agotados | `basicNack(requeue=false)` → `cmd.dead.dlx` → DLQ | `@down.test` |
| Error no recuperable (JSON inválido, `PermanentProcessingException`) | `basicNack(requeue=false)` sin reintentar → DLQ | mensaje mal formado; `@fail.test` publicado a mano en `q.cmd.email` |

  Nunca se usa `requeue=true`, para que un mensaje defectuoso no quede dando vueltas. Cada envío a la DLQ se registra en el log de notify (`[DLQ] cola=… -> ….dlq motivo=… eventId=… cuerpo=…`) y en la métrica `pedidos360.dlq.messages{queue}`.
- **Correo inválido directo a la DLQ**: antes de publicar, orders valida el destinatario (`EmailRecipientCheck`: vacío, sin formato de correo o dominio `@fail.test`, que simula un rechazo del servidor). Si no se puede enviar, publica el comando en `cmd.dead.dlx` con la routing key `email.send`, así llega **directo a `q.cmd.email.dlq` sin pasar por `q.cmd.email`**, con los headers `x-error-reason`, `x-original-queue` y `x-original-routing-key`, y queda en el log de orders como `[DLQ]`. Funciona aunque notify esté apagado.
- **Las DLQ no tienen consumidor**: el mensaje que falla queda guardado en la DLQ de su flujo (por ejemplo `q.cmd.email.dlq`), con el header `x-death` (cola de origen, motivo y cantidad de rechazos), hasta que alguien lo revise.
- Idempotencia: notify recuerda los `eventId` procesados y hace ACK sin reenviar los duplicados.
- **Campana de notificaciones** (comando `InAppNotify` por `notify.inapp` -> `q.notify.inapp`): cuando un cliente crea un pedido, orders avisa a los administradores ("Nuevo pedido #N"); cuando el administrador lo confirma (CREADO -> ACEPTADO, en proceso) el cliente recibe "Tu pedido #N está en proceso", y luego un aviso por cada cambio de estado. notify las guarda en `P360_NOTIFICATIONS` (eventId único) y el frontend las consulta cada 10 s a través del BFF.
- **Demo de DLQ**: crear un pedido con `customerEmail` que termine en `@fail.test` (directo a la DLQ), `@down.test` (3 intentos y DLQ) o `@retry.test` (se recupera al tercer intento).

### Microservicio administrador (ms-pedidos360-mqadmin)

API REST para crear y eliminar colas, exchanges y bindings (Swagger en `http://<IP_APPS>:8085/swagger-ui.html`). Por el BFF solo la usa el rol **Admin**, también desde la vista **RabbitMQ** del frontend.

- `RabbitAdminService` concentra toda la lógica: crea y elimina con `AmqpAdmin` (AMQP) y lista con la API de Management (`RABBITMQ_MANAGEMENT_URLS`, un nodo por URL, prueba el siguiente si uno no responde). Los controladores solo llaman a sus métodos.
- Validación con DTO (`QueueRequest`, `ExchangeRequest`, `BindingRequest`) y anotaciones: nombre obligatorio con letras, números, `.`, `-` y `_`, sin el prefijo reservado `amq.`; tipo de exchange `direct|topic|fanout|headers`; `deadLetterRoutingKey` exige `deadLetterExchange`; una cola durable no puede ser auto delete; TTL entre 0 y 7 días.
- Reglas del servicio: no crea duplicados (**409**), exige que el exchange y la cola del binding existan (**404**), en `direct` no acepta comodines y en `topic` exige que `*` y `#` sean palabras completas (**400**), no elimina una cola con mensajes si `ifEmpty=true` (**409**).
- La topología del sistema está protegida (**409** al intentar eliminarla): colas `q.cmd.*`, `q.notify.*` y exchanges `cmd.*` / `amq.*` (configurable en `app.rabbit.protected-*`).
- Errores en formato `ProblemDetail` (`title`, `detail` y `fields` por campo).

```bash
# Ejemplo (directo a ec2-apps desde tu IP; por el BFF se agrega el token de un Admin)
curl -X POST http://<IP_APPS>:8085/api/mq/queues -H 'Content-Type: application/json' \
  -d '{"name":"q.cmd.sms","deadLetterExchange":"cmd.dead.dlx","deadLetterRoutingKey":"sms.send"}'
curl -X POST http://<IP_APPS>:8085/api/mq/bindings -H 'Content-Type: application/json' \
  -d '{"exchange":"cmd.topic","queue":"q.cmd.sms","routingKey":"sms.#"}'
curl -X DELETE 'http://<IP_APPS>:8085/api/mq/queues/q.cmd.sms?ifEmpty=false'
```

### Registro de mensajes

Las colas de trabajo quedan en 0 cuando notify está activo, porque confirma (ACK) cada mensaje y RabbitMQ lo borra. Con notify apagado los mensajes esperan en su cola (columna *Ready*) hasta que vuelva.

| Dónde | Qué guarda |
|---|---|
| `q.cmd.*.dlq` / `q.notify.inapp.dlq` (RabbitMQ) | Cada mensaje **rechazado** (NACK) de esa cola. Sin consumidor: no se borra. El header `x-death` indica la cola de origen, el motivo y cuántas veces falló. |
| `P360_UNSENT_MESSAGES` (Oracle, orders) | Comandos que **no se pudieron publicar** (RabbitMQ caído o sin cola de destino). Se reintentan cada 30 s; al enviarse pasan a `ENVIADO` con `SENT_AT`, pero la fila no se borra. |

Para verlos en la consola (`:15672`): Queues → por ejemplo `q.cmd.email.dlq` → **Get messages**, con *Ack mode* en **Nack message requeue true** para que el mensaje siga en la cola después de leerlo.

```sql
SELECT id, message_type, routing_key, status, attempts, last_error, created_at, sent_at
FROM P360_UNSENT_MESSAGES ORDER BY id DESC;
```

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
