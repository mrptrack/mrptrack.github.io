# Diseños del dashboard

La aplicación conserva su interfaz original como **Clásica**, seleccionada por defecto. Ajustes → Diseño permite activar **Nueva** y volver a la clásica. La elección se guarda por navegador y por web; no modifica las preferencias del otro usuario ni exige borrar cookies.

La nueva interfaz usa la sesión, el estado y el guardado de la aplicación existente. No contiene datos de demostración, archivos personales ni otro backend. Sus textos son descriptivos, sin lemas.

Los benchmarks, la edición financiera y las herramientas completas de Salud se abren en un panel con los componentes originales. Volver devuelve al diseño nuevo sin cambiar la preferencia. TrackMRP conserva sus diferencias funcionales: no se añade la gestión de brokers ni la conexión de Salud de TrackCMG.

Las ediciones de biblioteca, gimnasio y seguimiento se validan y guardan por el canal existente de Drive. La comunicación entre vistas solo permite editar esos campos y `dashboardExtras` (favoritos, progreso, notas y rutinas); rechaza sustituciones de cartera, efectivo, aportaciones, brokers, operaciones o histórico. Si el estado ha cambiado desde que se abrió un formulario, se rechaza la edición en lugar de pisarlo. La sesión debe estar autenticada y la carga de la nube debe haber terminado.

Salud sigue fuera del JSON financiero. Al cerrar sesión se elimina la vista nueva. El actualizador conserva sesiones y datos; espera mientras hay un formulario, un panel nativo o un guardado pendiente. Ambas vistas se incluyen en la caché de cada publicación.

Verificación: `node tests/layouts.cjs`, `node tests/training-sets.cjs`, `node tests/artwork.cjs` y `node tests/app-update.cjs`; en TrackCMG también `node tests/health.cjs`. Se han probado en una copia aislada con la nube sustituida por un guardado local: selector, recarga, lectura compartida, series de gimnasio, estado sin histórico, idiomas y navegación móvil. Las pruebas no escriben en el Drive real.

Punto de recuperación anterior a este cambio: etiqueta Git local `before-dual-ui-2026-10-25`. La publicación se puede revertir mediante un commit de reversión; las cifras financieras no se han migrado ni recalculado para este cambio.
