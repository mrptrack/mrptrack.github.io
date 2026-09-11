# Track MRP

Copia independiente de Track CMG, con logo MRP y las mismas funciones,
incluidos JPY y videojuegos. Arranca vacía: no incluye datos, cuentas ni
conexiones del propietario de la página original.

## Qué falta para conectarla

En `js/config.js` quedan dos valores vacíos:

- `GOOGLE_CLIENT_ID`: identificador OAuth de una aplicación web de Google.
- `PROXY_URL`: URL del despliegue de Google Apps Script, terminada en `/exec`.

El enlace de una carpeta o fichero de Drive NO sustituye la URL de Apps Script.
El backend debe guardar un JSON independiente en el Drive de MRP y autorizar
su correo. El código del backend activo de CMG no estaba en la carpeta del
frontend, por lo que no se incluye una copia ficticia ni una conexión al suyo.

Cuando tengáis la dirección definitiva de GitHub Pages, la URL `/exec` y el
Client ID, se completa la configuración y se prueba el acceso y guardado.
No hacen falta contraseñas ni compartir el client secret.

## GitHub

Subir el contenido de esta carpeta a un repositorio nuevo y activar Pages.
Las rutas son relativas: también se puede alojar como subcarpeta `/trackmrp/`.
El origen autorizado de Google debe coincidir con el dominio final de Pages
(sin la ruta del repositorio).

Cada instalación usa su propio almacenamiento local y sus propias cachés.
Si se alojan CMG y MRP bajo el mismo dominio, esto evita mezclar sus datos.
Los ficheros públicos del sitio no deben contener exports personales.

## Contrato del backend

- POST `{action:"login", id_token}`: verificar el token Google, su audiencia
  y el correo autorizado; devolver `{session_token}` con expiración `exp`
  en su payload JWT. La firma debe validarse en el servidor al usarlo.
- GET `?action=getData&session_token=...`: devolver el JSON completo del usuario.
- POST `{session_token,data}`: guardar el JSON completo, preservando todas
  las secciones, incluido `games`. Responder según `js/cloud.js`.
- GET `?url=...`: proxy de las consultas de cotizaciones usadas por la app.
- Errores de autorización: `{error:"unauthorized"}`.

Hasta configurar Google, la pantalla indica que el acceso está pendiente.
El aspecto y los módulos ya están preparados; el login real y la persistencia
en Drive se comprueban cuando esté disponible el backend.

## Pruebas locales

`node tests/games-jpy.cjs` requiere Playwright y Edge. Usa datos de prueba,
bloquea las peticiones externas y no guarda nada en Drive.
