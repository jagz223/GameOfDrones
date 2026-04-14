FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

# Node.js 20 (para compilar Angular)
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY . .

# Build del front dentro de wwwroot del API
WORKDIR /src/ClientApp
RUN npm ci
RUN npm run build:api

# Publish de la API (incluye wwwroot ya generado)
WORKDIR /src
RUN dotnet publish Server/GameOfDrones.Api/GameOfDrones.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["dotnet", "GameOfDrones.Api.dll"]
