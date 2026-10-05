# Actualizaciones automáticas de la web y la app instalada

Cada publicación de `main` en GitHub Pages inserta el commit publicado en `index.html` y `sw.js` mediante `site.github.build_revision`. No hay que incrementar una versión manualmente. Se mantiene el despliegue Jekyll que ya utiliza este repositorio; no añadas `.nojekyll`.

- Una caché de archivos de la app por commit, conservada entre visitas normales.
- Solo se activa una nueva versión cuando todos los archivos locales están descargados y el HTML corresponde a esa versión. Un fallo conserva la versión anterior.
- Se comprueba al abrir/volver a la app y cada cinco minutos mientras está visible. Sin cambios no se borra nada ni se recarga.
- Una versión distinta recarga una sola vez, después de cinco segundos sin interacción y fuera de formularios, modo edición o guardados pendientes/fallidos. Conserva la pestaña seleccionada.
- No se borran cookies, localStorage, IndexedDB, sesiones ni datos del usuario. Se renuevan únicamente las cachés propias del service worker.
- En móvil se aplica al abrir o volver a la app con conexión. No se puede actualizar mientras el sistema mantiene la app cerrada/suspendida. No hace falta reinstalarla.

La primera migración desde la versión antigua puede requerir cerrar y volver a abrir la app para cargar el nuevo mecanismo, sin borrar datos. Las siguientes publicaciones ya se detectan automáticamente.

Pruebas locales: `node tests/app-update.cjs`. Para servir localmente el sitio completo, hay que renderizar las cabeceras Jekyll de `index.html` y `sw.js`; abrirlos como archivos estáticos sin procesar no simula el despliegue de Pages.

Referencias: https://jekyll.github.io/github-metadata/configuration/ y https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache.
