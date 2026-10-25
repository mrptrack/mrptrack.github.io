# Nueva: cliente completo

La vista Nueva permite trabajar sin abrir pantallas, formularios ni paneles de Clásica. La selección inicial sigue siendo Clásica para navegadores nuevos. El diseño elegido se conserva en ese navegador; `/new/` o `/?layout=new` abre Nueva a través del mismo inicio de sesión.

Ambos diseños comparten el JSON, Google Sign-In, Apps Script, almacenamiento y las reglas de cálculo. No hay otra copia de los datos que mantener o migrar. El arranque común aloja el cliente de `new/`; los formularios de Nueva son propios. Los benchmarks reciben el documento del cliente y dibujan su gráfica allí, sin mover componentes de Clásica.

## Edición

- Cartera: altas, correcciones, compras, ventas parciales/completas y reparto de acciones por broker.
- Efectivo: saldo por broker, efectivo sin asignar, aportaciones, ingresos, retiradas y traspasos.
- Operaciones cerradas e histórico: crear, editar y eliminar registros.
- Biblioteca: ficha completa, títulos ES/EN, estado, notas, metadatos, búsqueda/cambio de portada y eliminación.
- Gimnasio: sesiones, series, actividades, rutinas y medidas.
- Seguimiento: ticker, nombre, divisa, objetivo, notas y eliminación.
- Ajustes: copia JSON, importación con validación/revisión/confirmación y revisión de la copia anterior.

## Guardado y reversión

`js/data-validation.js` contiene la validación compartida por ambas interfaces. Los cambios cotidianos de Biblioteca/Gimnasio usan el parche de campos permitido; los campos financieros siguen prohibidos en ese canal.

Las finanzas usan acciones explícitas de `js/finance-editor-model.js`, una revisión del estado y los mismos cálculos de brokers. Los preparados son inmutables. No se aplica una acción si la revisión ya no coincide, no hay sesión, no terminó la carga o hay cambios pendientes de sincronizar.

Se guarda una copia previa antes de editar. La sesión de Nueva permite deshacer cambios financieros con un identificador de reversión y comprobar que otro cambio no los ha sustituido. La importación exige analizar el archivo y confirmar; descarga el estado anterior y mantiene otra copia local. Un archivo vacío no sustituye una cartera con datos.

Comprar/vender en estas pantallas actualiza el registro del dashboard. Nunca envía órdenes a los brokers. Una venta lleva el ingreso a efectivo y el resultado a operaciones cerradas; no suma de nuevo los dividendos ya cobrados. Un traspaso entre brokers no aumenta la aportación global. Las correcciones de cantidades no registran compras ni ventas.

Se conserva el comportamiento específico de TrackMRP: no se añade un panel de brokers a su navegación y se mantiene la corrección del registro del 22/09/2026 al importar.
