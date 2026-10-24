# Track MRP

Copia independiente de Track CMG, con logo MRP y las mismas funciones,
incluidos JPY y videojuegos. Arranca vacía: no incluye datos, cuentas ni
conexiones del propietario de la página original.

## Biblioteca visual

Películas, libros, series y videojuegos comparten las tarjetas con portada,
fichas completas y diseño móvil de CMG. Las fuentes públicas son Wikipedia,
Open Library y TVmaze; no requieren claves en el frontend. Se conservan las
notas, opiniones y títulos ES/EN existentes. Las películas muestran Vista o
Pendiente; los libros, Leído o Pendiente. No hay rótulos de colección ni
contadores decorativos.

Las portadas automáticas se guardan, tras cargar correctamente, en el JSON
privado de MRP y en el almacenamiento local. La sincronización se agrupa y
espera a que haya terminado la carga autenticada; respeta las ediciones y las
portadas elegidas manualmente. Hay una caché separada de hasta 240 imágenes
que sobrevive a los despliegues. No incluye datos ni conexiones de CMG, ni
las funciones de brokers.

Comprobaciones locales sin conexión a cuentas: `node tests/artwork.cjs`,
`node tests/artwork-cache.cjs`, `node tests/artwork-store.cjs` y
`node tests/artwork-image-cache.cjs`. `node tests/library-preview.cjs`
sirve una prueba visual con datos ficticios y sin escrituras a Drive.

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
