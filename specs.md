# Propósito

Crear una webapp llamada **editor-de-muebles** para hacer bosquejos frontales en 2D de muebles de melamina. A partir de las dimensiones exteriores, se podrán generar divisiones internas y probar distintas configuraciones.

Al crear o mover una división, se deberán visualizar y actualizar en vivo las distancias respecto de los objetos que se encuentran en el mismo sentido.

## Unidades y reglas geométricas

- Todas las medidas se expresan y muestran en centímetros (cm).
- El espesor de todas las piezas de melamina es de 1,8 cm: paneles exteriores y divisiones internas.
- El mueble es siempre rectangular, de vista frontal 2D; la profundidad queda fuera de alcance.
- Las dimensiones exteriores se solicitan al crear el mueble y no se pueden modificar posteriormente.
- Las divisiones internas se agregan dentro de un hueco y llegan de lado a lado de ese hueco:
  - una división vertical ocupa toda su altura libre;
  - una división horizontal ocupa todo su ancho libre.
- No se permiten cruces entre divisiones.
- Las nuevas divisiones se insertan centradas en el hueco de destino.
- Las divisiones se mueven y se insertan con ajuste a una grilla de 1 cm.
- Dos divisiones paralelas deben mantener como mínimo 5 cm libres entre sí.
- La separación mínima de 5 cm no aplica entre una división y los paneles exteriores del hueco.
- Las divisiones no pueden superponerse.

## Usabilidad

### Pantalla inicial
- Al iniciar, se debe mostrar una página inicial de proyectos.
- Desde la página inicial se debe poder crear un nuevo proyecto, solicitando el nombre del mueble y sus dimensiones exteriores (ancho y alto).
- Desde la página inicial se debe poder cargar un proyecto desde un archivo JSON válido.
- La página inicial debe listar los proyectos guardados en el servidor. Para cada proyecto se debe poder abrirlo, eliminarlo, renombrarlo y exportarlo como JSON.

### Layout general del editor
- Debe existir un panel lateral izquierdo, visualmente mínimo y contraíble, que contenga las herramientas y acciones del editor.
- El panel lateral debe ser lo más compacto posible para evitar scroll durante el uso de drag & drop.
- Las herramientas y acciones en formato botón deben disponerse en una sola columna, con un botón por fila y un ancho reducido.
- La interfaz debe contar con un encabezado superior completo y fijo. Debajo de ese encabezado aparece el panel de acciones, separado visualmente para evitar superposición.
- El logotipo del panel lateral debe llevar a la página inicial de proyectos.
- No debe existir un bloque lateral independiente de acciones del proyecto.
- El guardado del proyecto actual debe estar disponible como un botón con icono de disquete, ubicado junto al nombre del proyecto en el encabezado del editor.
- La interfaz debe estar íntegramente en español y utilizar componentes con estilo shadcn. La paleta es libre.

### Área de dibujo y herramientas
- El área del editor debe maximizar la visibilidad del mueble.
- El mueble debe ubicarse lo más cerca posible del borde superior del área de dibujo, respetando un pequeño margen para las cotas exteriores.
- Debe permitir zoom mediante controles `−` y `+`. El zoom debe permanecer anclado al margen superior: al alejar la vista, el mueble no debe desplazarse hacia abajo.
- Deben existir dos objetos para drag & drop:
  - división vertical;
  - división horizontal.
- Al soltar una división dentro de un espacio válido, se agrega como nueva división centrada y se indican sus distancias hacia otros objetos en la misma dirección.
- Al seleccionar una división existente, se debe poder mover hacia los costados en vivo. Las cotas se actualizan en vivo durante el movimiento.
- Debe existir un checkbox para mostrar u ocultar las cotas.
- Las cotas deben mostrar:
  - dimensiones exteriores del mueble;
  - espacios libres entre paneles;
  - valores en cm con decimales cuando corresponda.
- Las cotas internas deben mostrar la medida del ancho en la primera línea y la medida del alto en la segunda línea.
- Las cotas internas deben usar una tipografía menor que las cotas exteriores (implementación actual: `2,2 px` frente a `3 px`).
- Cada cota interna debe permanecer centrada dentro de su compartimento. No se debe reubicar, redimensionar ni ocultar automáticamente para resolver colisiones entre textos.
- Debe existir un modo **Borrar**. Al estar activo, un clic sobre una división la elimina y recalcula las distancias de los objetos restantes. El modo permanece activo hasta que la persona usuaria lo desactive manualmente.
- No se requiere edición numérica de posiciones o dimensiones de divisiones.
- No se requiere funcionalidad de deshacer/rehacer.

## Guardado y exportación

- Debe ser posible guardar en Vercel Blob múltiples diseños de muebles, identificados por nombre.
- Debe existir una acción para cargar y continuar editando cualquiera de los diseños guardados en el servidor.
- Debe existir una acción **Exportar** que descargue un archivo JSON con la definición completa del mueble y sus divisiones.
- La exportación JSON debe ser compatible con la opción de carga de proyecto desde JSON.
- No se requiere exportación PNG.

## Alcance

- El alcance inicial es únicamente el diseño visual del mueble.
- No incluye lista de cortes, materiales, costos, profundidad ni renderizado 3D.

## Detalles técnicos

- Debe estar construida con Astro.
- Debe poder desplegarse en Vercel.
- Se deben incluir instrucciones para ejecutar la app localmente, versionarla con Git y desplegarla en Vercel.
