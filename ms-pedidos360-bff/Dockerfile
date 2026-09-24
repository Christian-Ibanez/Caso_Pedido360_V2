# ---------- Build ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Dependencias primero para aprovechar la cache de capas
COPY pom.xml ./
RUN mvn -q -B dependency:go-offline

COPY src src
RUN mvn -q -B -DskipTests package

# ---------- Runtime ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system spring && useradd --system --gid spring spring
USER spring

COPY --from=build /app/target/*.jar app.jar

ENV SERVER_PORT=8080 \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
