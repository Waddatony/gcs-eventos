# Componentes reutilizables

Todos están en [`js/components.js`](../js/components.js). En Mendix serían los *building blocks* y *snippets*. Cada uno se define una sola vez y se usa en varias pantallas: si se corrige o se mejora, el cambio aparece en todas.

## Componentes nuevos de la Actividad 4

| Componente | Qué hace | Dónde se usa |
|---|---|---|
| **Calendario** (`Calendario` + `montarCalendario`) | Calendario mensual con navegación entre meses. Marca hoy, los días con eventos y los cancelados. Tiene una versión compacta y una completa. | 1) **Inicio**: calendario compacto; al elegir un día abre la agenda en esa fecha. 2) **Eventos → vista Calendario**: agenda mensual con los títulos y la lista de eventos del día. 3) **Nuevo / editar evento**: disponibilidad de la sede elegida; al hacer clic en un día se llena la fecha. 4) **Portal del asistente → Mis eventos**: solo los eventos de esa persona. |
| **Formulario de registro de asistentes** (`FormularioAsistente` / `camposAsistente`) | Mismos campos, etiquetas y validaciones (nombre, correo, empresa, área, teléfono) en todos lados. Opción para agregar el aviso de privacidad. | 1) **Participantes → Registrar asistente**. 2) **Detalle del evento → Registrar asistente nuevo**, que además lo inscribe. 3) **Página pública de auto-registro** (`#/registro/:id`), con aviso de privacidad. 4) **Editar asistente**. |
| **Lista de tareas** (`ListaTareas`) | Tabla de tareas con prioridad, vencimiento, responsable, barra de avance y selector de avance. Las columnas y los permisos se configuran. | 1) **Detalle del evento → pestaña Tareas**. 2) **Pantalla Tareas** (todas, con filtros). 3) **Portal del asistente → Mis tareas** (sin columna de responsable; solo el responsable cambia el avance). |
| **Resumen de progreso** (`ResumenProgreso`) | Avance general y conteos (completadas, en progreso, pendientes, vencidas, sin asignar). | Inicio, detalle del evento (pestaña Tareas). |
| **Pestañas** (`Pestanas`) | Pestañas accesibles (role="tab") con contador. | Detalle del evento (Asistentes / Tareas / Comunicación) y Portal del asistente (Mis tareas / Mis eventos / Avisos / Escribir). |
| **Avisos** (`ListaAvisos` / `TablaAvisos`) | Notificaciones con ícono por tipo y estado leído / no leído. Hay una versión en tarjetas para el asistente y otra en tabla compacta para el personal. | Portal del asistente (tarjetas); pestaña Comunicación del evento y pantalla Comunicación (tabla). |
| **Mensajes** (`ListaMensajes`) | Hilo de mensajes que distingue los comunicados del organizador de los mensajes de los asistentes; botón "Marcar como leído". | Pestaña Comunicación del evento, pantalla Comunicación (bandeja y enviados), portal del asistente (mensajes enviados). |
| **Modal de enlace** (`modalEnlace`) | Muestra un enlace y lo copia al portapapeles. | Enlace de auto-registro del evento y enlace del portal de cada asistente (desde Participantes y desde la tabla de inscritos). |
| **Modal de tarea** (`modalTarea`) | Formulario para crear o editar una tarea, con la fecha límite topada a la fecha del evento. | Pestaña Tareas del evento y pantalla Tareas. |

## Componentes base (Actividad 3) que se siguen reutilizando

| Componente | Usos |
|---|---|
| `Boton` | Todos los botones de la aplicación, en 4 variantes |
| `Campo` y `Formulario` | Login, evento, tarea, comunicado, mensaje del asistente, sede, usuario, asistente |
| `Tabla` | Eventos, inscritos, participantes, tareas, avisos, sedes, usuarios, bitácora. En el celular se convierte en tarjetas. |
| `TarjetaKPI` | Inicio, detalle del evento, Tareas, Comunicación, Portal |
| `Insignia` y `BarraProgreso` | Estados de evento, inscripción y tarea; ocupación (en rojo cuando está lleno) y avance (en verde cuando llega al 100 %) |
| `toast`, `abrirModal` y `confirmar` | Confirmaciones y avisos en todas las pantallas |

**Beneficio para el mantenimiento:** el calendario, por ejemplo, está escrito una vez (unas 60 líneas) y se usa en 4 pantallas con datos distintos, porque cada pantalla le pasa su propia función `cargarEventos`. Cambiar su diseño o corregir un error se hace en un solo lugar.
