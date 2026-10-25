# Diseños del dashboard

Clásica y Nueva usan el mismo JSON, Google Sign-In y Apps Script. Clásica sigue siendo el valor por defecto para navegadores nuevos. Ajustes conserva la selección por navegador y por web. `/new/` o `/?layout=new` abre Nueva con el inicio de sesión común.

Nueva es un cliente completo: sus formularios de cartera, efectivo, brokers, operaciones, histórico, Biblioteca, gimnasio, medidas y seguimiento son propios. No abre paneles de Clásica. La gráfica de benchmarks se dibuja dentro del cliente usando el cálculo compartido y las mismas aportaciones en las mismas fechas. Salud no está en ninguna de las dos interfaces.

Las ediciones de Biblioteca y gimnasio usan parches validados por campo. Los campos financieros siguen prohibidos en ese canal. Las finanzas usan acciones explícitas, preparación inmutable y comprobación del estado antes de guardar. Una actualización de cotizaciones no impide corregir una posición si no cambió el estado financiero; las ediciones del histórico comprueban también su revisión.

Cada edición mantiene una copia previa. Nueva ofrece deshacer y revisar la copia anterior desde Ajustes. La importación tiene validación compartida, revisión, confirmación explícita y descarga del estado anterior; un archivo vacío no pisa una cartera existente. Las escrituras requieren sesión, carga terminada y ausencia de cambios pendientes.

La caché incluye ambos clientes y sus editores. El actualizador espera mientras un formulario o guardado está abierto y conserva la sesión. TrackMRP mantiene sus particularidades, incluida la corrección de histórico de septiembre, sin añadir el panel de brokers de TrackCMG a su navegación.

Detalles y reglas de reversión: [new-editor.md](new-editor.md). Pruebas principales: `tests/finance-editor.cjs`, `tests/native-bridge.cjs`, `tests/new-independent.cjs`, `tests/layouts.cjs`, `tests/training-sets.cjs` y `tests/app-update.cjs`. Las pruebas de interfaz usan copias locales y no escriben en Drive.