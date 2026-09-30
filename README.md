# Pedidos360 – Plataforma cloud-native de pedidos para PyMEs

| Carpeta | Qué es | Puerto |
|---|---|---|
| `frontend` | React + MSAL (login Entra ID) | 5173 |
| `ms-pedidos360-bff` | Valida el JWT, autoriza por rol y enruta a los micros | 8080 |
| `ms-pedidos360-orders` | Pedidos y estados; coordina stock, publica en Kafka y RabbitMQ | 8081 |
| `ms-pedidos360-catalog` | Productos, precios y stock | 8082 |
| `ms-pedidos360-notify` | Consumidor RabbitMQ: email/webpush, ticket de cocina, boleta + DLQ | 8083 (solo health) |
| `ms-pedidos360-audit` | Consumidor Kafka: timeline de auditoría (solo lectura) | 8084 |
| `ms-pedidos360-report` | Consumidor Kafka: KPIs (solo lectura) | 8086 |
| `infra/apps`, `infra/mq`, `infra/kafka` | Un `compose.yml` por instancia EC2 | |
| `infra/docs` | Guía de despliegue, security groups, API Gateway, topologías | |

Cada micro corre solo en local con H2 (`./mvnw spring-boot:run`) y tiene Swagger en `/swagger-ui.html`.
Despliegue en AWS: ver [infra/docs/README.md](infra/docs/README.md).
