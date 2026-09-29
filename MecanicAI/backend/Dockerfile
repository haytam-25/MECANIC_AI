# Compila con Maven y ejecuta con Java 25
FROM docker.io/library/eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B package -DskipTests

FROM docker.io/library/eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --uid 1001 --no-create-home --shell /usr/sbin/nologin mecanicai
COPY --from=build /app/target/mecanicai-backend-*.jar app.jar
USER mecanicai
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
