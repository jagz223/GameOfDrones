# Juego de Drones

Aplicación de evaluación técnica: front-end en **Angular 19** y API en **ASP.NET Core 8** con **Entity Framework Core** y **SQLite**. Incluye reglas de movimientos configurables en tiempo de ejecución y persistencia de victorias por jugador.

## Requisitos

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js](https://nodejs.org/) 18 o superior (recomendado 20 LTS)
- Visual Studio 2022 con la carga de trabajo *ASP.NET y desarrollo web* (opcional pero recomendado)

## Ejecutar solo con Visual Studio (un solo puerto)

1. Abre `GameOfDrones.sln`.
2. Establece **GameOfDrones.Api** como proyecto de inicio.
3. Una vez clonado el repositorio, en una terminal (solo la primera vez o tras cambiar el front-end):

   ```bash
   cd ClientApp
   npm install
   npm run build:api
   ```

   Esto compila Angular dentro de `Server/GameOfDrones.Api/wwwroot/browser`, que es lo que sirve la API como sitio estático.
4. Pulsa **F5**. Navega a `https://localhost:7185/` (ajusta el puerto si tu `launchSettings.json` es distinto). La base de datos SQLite `gameofdrones.db` se crea automáticamente junto al directorio de trabajo de la API.

Swagger está disponible en desarrollo en `/swagger`.

## Desarrollo en caliente (Angular + API)

Útil mientras editas el front-end:

1. Terminal 1 — API:

   ```bash
   cd Server/GameOfDrones.Api
   dotnet run
   ```

2. Terminal 2 — Angular con proxy hacia la API (`proxy.conf.json` reenvía `/api` a `https://localhost:7185`):

   ```bash
   cd ClientApp
   npm install
   npm start
   ```

3. Abre `http://localhost:4200`. Las peticiones a `/api` se proxifican al back-end; los orígenes permitidos están en `appsettings.json` → `Cors:ClientOrigins`.

## Reglas dinámicas y datos

- **GET** `/api/rules` — reglas actuales (movimiento → qué derrota).
- **PUT** `/api/rules` — reemplaza todas las reglas; el cuerpo usa `{ "rules": [ { "killer": "...", "defeated": "..." } ] }`.
- **GET** `/api/stats` — victorias acumuladas por jugador.
- **POST** `/api/stats/game-won` — incrementa victorias del ganador: `{ "winnerName": "..." }`.

La cadena de conexión y los orígenes CORS no están hardcodeados en código: se leen de `appsettings.json` / variables de entorno (`ConnectionStrings__DefaultConnection`, etc.).

## Despliegue

Publica la API (`dotnet publish`) y sirve los archivos estáticos generados en `wwwroot/browser`. Asegúrate de ejecutar `npm run build:api` antes de publicar para incluir el front-end.
