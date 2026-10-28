# Pedidos360 – Plataforma cloud-native de pedidos para PyMEs

| Carpeta | Qué es | Puerto |
|---|---|---|
| `frontend` | React + MSAL (login Entra ID) | 5173 |
| `ms-pedidos360-bff` | Valida el JWT, autoriza por rol y enruta a los micros | 8080 |
| `ms-pedidos360-orders` | Pedidos y estados; coordina stock, publica en RabbitMQ (y en Kafka si `KAFKA_ENABLED=true`) | 8081 |
| `ms-pedidos360-catalog` | Productos, precios y stock | 8082 |
| `ms-pedidos360-notify` | Consumidor RabbitMQ: email/webpush, ticket de cocina, boleta, campana de notificaciones (`/api/notifications`) + DLQ | 8083 |
| `ms-pedidos360-mqadmin` | Administrador de RabbitMQ: API REST para crear y eliminar colas, exchanges y bindings (solo Admin) | 8085 |
| `ms-pedidos360-audit` | Consumidor Kafka: timeline de auditoría (solo lectura; no desplegado sin Kafka) | 8084 |
| `ms-pedidos360-report` | Consumidor Kafka: KPIs (solo lectura; no desplegado sin Kafka) | 8086 |
| `infra/apps`, `infra/mq`, `infra/bff` | Un `compose.yml` por instancia EC2: micros + Oracle, RabbitMQ, BFF | |
| `infra/kafka` | Cluster Kafka (opcional, hoy no desplegado) | |
| `infra/docs` | Guía de despliegue, security groups, Entra ID, topologías | |

Cada micro corre solo en local con H2 (`./mvnw spring-boot:run`) y tiene Swagger en `/swagger-ui.html`.
Despliegue en AWS: ver [infra/docs/README.md](infra/docs/README.md).
