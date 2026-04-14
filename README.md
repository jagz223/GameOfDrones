# Juego de Drones

Solución técnica: **Angular 19** (front) + **ASP.NET Core 8** (API) + **Entity Framework Core** + **SQLite**. Incluye partida local (2 jugadores en la misma PC), modo online opcional, reglas de movimientos configurables en tiempo de ejecución y persistencia de victorias por jugador.

---

## Enlace al repositorio y despliegue

- **Repositorio (GitHub):** `https://github.com/jagz223/GameOfDrones`
- **Juego en producción (opcional):** *aún no disponible; se publicará más adelante.*

---

## Requisitos previos

| Herramienta | Uso |
|-------------|-----|
| [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) | Obligatorio (API y migraciones). |
| [Node.js](https://nodejs.org/) 18+ (recomendado 20 LTS) | Solo para **compilar** el front la primera vez (o tras cambios en Angular). |
| Visual Studio 2022 | Recomendado; carga de trabajo *ASP.NET y desarrollo web*. |

> **Nota:** Las carpetas `node_modules`, `bin`, `obj` y el contenido generado de `wwwroot` **no** se suben al repositorio (`.gitignore`). Por eso hace falta **un paso con Node** la primera vez tras clonar.

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

y reiniciá la API.

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
| GET | `/api/rules` | Reglas actuales |
| PUT | `/api/rules` | Reemplazar reglas |
| POST | `/api/rules/reset` | Reglas clásicas |
| GET | `/api/stats` | Victorias acumuladas |
| POST | `/api/stats/game-won` | Registrar victoria |
| POST | `/api/rooms` | Crear sala online |
| POST | `/api/rooms/join` | Unirse |
| GET | `/api/rooms/{id}` con query `player=1` o `player=2` | Estado de sala |
| POST | `/api/rooms/{id}/move` | Movimiento |
| POST | `/api/rooms/{id}/rematch` | Revancha |

En desarrollo, **Swagger** está en `/swagger`.

La cadena de conexión y CORS se configuran en `appsettings.json` o variables de entorno (`ConnectionStrings__DefaultConnection`, etc.).
