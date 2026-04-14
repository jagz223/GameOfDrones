# Juego de Drones

Solución técnica: **Angular 19** (front) + **ASP.NET Core 8** (API) + **Entity Framework Core** + **SQLite**. Incluye partida local (dos jugadores en la misma PC), modo online opcional, reglas configurables en tiempo de ejecución (cada movimiento puede vencer a varios rivales), **empates entre movimientos distintos** además del empate por mismo nombre, y persistencia de victorias por jugador.

Al **añadir un movimiento nuevo** desde la pantalla de reglas, para cada movimiento ya definido se elige si el nuevo **le gana**, **pierde contra él** o **empata**: hay que cubrir todos para que no queden enfrentamientos sin definir. Los pares de empate también se listan y guardan con el resto de reglas.

---

## Enlace al repositorio y despliegue

- **Repositorio (GitHub):** `https://github.com/jagz223/GameOfDrones`
- **Juego en producción (opcional):** *aún no disponible; se publicará más adelante.*

---

## Docker (imagen local)

En la raíz del repositorio (donde está `Dockerfile`):

```bash
docker build -t game-of-drones .
docker run --rm -p 8080:8080 -e PORT=8080 game-of-drones
```

La API escucha en `http://localhost:8080`. Render (y otros hosts) inyectan `PORT` automáticamente; la aplicación ya lo lee en `Program.cs`.

---

## Despliegue en Render

1. Conectá el repositorio en [Render](https://render.com) y creá un **Web Service** con **Docker**.
2. Dejá **Root Directory** vacío si el repo es solo este proyecto; si el código vive en un subdirectorio de un monorepo, configurá ese path y asegurate de que `Dockerfile` y `render.yaml` sean accesibles (o mové el blueprint a la raíz del repo y usá `dockerfilePath`).
3. Opcional: **Blueprint** — el archivo `render.yaml` define un servicio web Docker con comprobación de salud en `/` y `ASPNETCORE_ENVIRONMENT=Production`.
4. **SQLite:** el archivo `gameofdrones.db` queda en el sistema de archivos del contenedor. En el plan gratuito de Render ese almacenamiento es **efímero**: al redeploy o reinicio puede perderse. Para datos persistentes habría que montar un [disco](https://render.com/docs/disks) (planes de pago) y apuntar `ConnectionStrings__DefaultConnection` a una ruta bajo el punto de montaje, o usar una base gestionada (por ejemplo PostgreSQL).

Swagger no está habilitado en producción (`ASPNETCORE_ENVIRONMENT=Production`), así que la salud del servicio usa la ruta `/` (SPA).

---

## Requisitos previos

| Herramienta | Uso |
|-------------|-----|
| [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) | Obligatorio (API y migraciones). |
| [Node.js](https://nodejs.org/) 18+ (recomendado 20 LTS) | Solo para **compilar** el front la primera vez (o tras cambios en Angular). |
| Visual Studio 2022 | Recomendado; carga de trabajo *ASP.NET y desarrollo web*. |

Las carpetas `node_modules`, `bin`, `obj` y el contenido generado de `wwwroot` no se versionan (`.gitignore`). Tras clonar hace falta al menos una compilación del front con Node para que la API tenga archivos en `wwwroot`.

---

## Cómo ejecutarlo desde Visual Studio (recomendado para el corrector)

### Primera vez (clon recién hecho o sin `wwwroot`)

1. Abrí `GameOfDrones.sln`.
2. Establecé **GameOfDrones.Api** como proyecto de inicio.
3. En una terminal, **desde la carpeta del repositorio** (donde está `GameOfDrones.sln`):

   ```bash
   cd ClientApp
   npm install
   npm run build:api
   ```

   Eso genera el front en `Server/GameOfDrones.Api/wwwroot/browser`, que es lo que sirve la API.

4. **F5** en Visual Studio.

5. Abrí el navegador en la URL que indique la consola (según `launchSettings.json`), por ejemplo:

   - `https://localhost:7185/` — perfil HTTPS local.
   - `http://0.0.0.0:5185/` o `http://localhost:5185/` — HTTP (útil para probar en red local).

La base **SQLite** `gameofdrones.db` se crea o actualiza automáticamente con las migraciones de EF al arrancar la API.

### Siguientes veces (sin tocar el front-end)

Si no cambiaste archivos en `ClientApp`, alcanza con abrir la solución y pulsar **F5**.

### Si cambiaste solo el Angular

Volvé a ejecutar en `ClientApp`:

```bash
npm run build:api
```

y reiniciá la API. `npm run build` deja el bundle solo en `ClientApp/dist`; para servir la app desde la API hace falta **`build:api`**, que escribe en `Server/GameOfDrones.Api/wwwroot`.

---

## Problemas frecuentes

| Síntoma | Qué hacer |
|---------|-----------|
| La web carga vacía o sin estilos | Ejecutá `npm run build:api` en `ClientApp` (falta el front en `wwwroot`). |
| Error al migrar la base | Si tenés un `gameofdrones.db` muy viejo, borrálo una vez y volvé a ejecutar la API. |
| Modo online en otra máquina | Usá la IP del servidor y el puerto **5185**; abrí el firewall TCP para ese puerto. |

---

## Desarrollo con recarga en caliente (opcional)

1. Terminal — API: `cd Server/GameOfDrones.Api` → `dotnet run`
2. Terminal — Angular: `cd ClientApp` → `npm install` → `npm start`
3. Navegador: `http://localhost:4200` (el proxy reenvía `/api` según `proxy.conf.json`).

---

## API (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/rules` | Reglas de victoria y lista de empates. Cuerpo JSON: `rules` (array de `{ moveName, kills }` por cada arista ganador→vencido) y `ties` (array de `{ moveA, moveB }` por par que empata). |
| PUT | `/api/rules` | Reemplazo total. Cuerpo: `rules` (obligatorio) y `ties` (opcional; si se omite, no quedan empates entre distintos movimientos). |
| POST | `/api/rules/reset` | Reglas clásicas (piedra/papel/tijeras) sin empates extra. |
| GET | `/api/stats` | Victorias acumuladas |
| POST | `/api/stats/game-won` | Registrar victoria |
| POST | `/api/rooms` | Crear sala online |
| POST | `/api/rooms/join` | Unirse |
| GET | `/api/rooms/{id}` con query `player=1` o `player=2` | Estado de sala |
| POST | `/api/rooms/{id}/move` | Movimiento |
| POST | `/api/rooms/{id}/rematch` | Revancha |

En desarrollo, **Swagger** está en `/swagger`.

La cadena de conexión y CORS se configuran en `appsettings.json` o variables de entorno (`ConnectionStrings__DefaultConnection`, etc.).
