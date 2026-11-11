# Microflujos (lógica de negocio)

El profesor autorizó usar GitHub en lugar de Mendix. Por eso la lógica que en Mendix serían **microflows** está escrita como funciones de JavaScript con la misma estructura. Cada microflujo:

1. valida permisos;
2. valida los datos;
3. cambia la base de datos dentro de una **transacción**: se guarda todo o no se guarda nada;
4. registra en la bitácora;
5. avisa a los asistentes que corresponda.

Los pasos 1, 4 y 5 no se repiten en cada microflujo: son **sub-microflujos reutilizables**.

| Archivo | Contenido |
|---|---|
| [`js/subflujos.js`](../js/subflujos.js) | Sub-microflujos reutilizables |
| [`js/rules.js`](../js/rules.js) | Microflujos de eventos, inscripciones y participantes (Actividad 3, ahora con avisos) |
| [`js/microflujos.js`](../js/microflujos.js) | Microflujos de tareas, progreso, comunicación, portal y auto-registro (Actividad 4) |

## Sub-microflujos y dónde se reutilizan

| Sub-microflujo | Función | Lo usan |
|---|---|---|
| SUB_ValidarPermiso | `exigir()` / `puede()` | Todos los microflujos y todas las pantallas (para ocultar botones) |
| SUB_RegistrarBitacora | `registrarBitacora()` | Todos los microflujos que cambian datos |
| SUB_Notificar | `notificar()` | Inscribir, Promover lista de espera, Asignar tarea, Editar evento, Cancelar evento, Enviar comunicado (6 microflujos) |
| SUB_DestinatariosSegmento | `destinatariosPorSegmento()` | Enviar comunicado, Editar evento (aviso de cambio), Cancelar evento, botón "Abrir en mi correo" |
| SUB_ValidarTexto | `validarTexto()` | Asignar tarea, Enviar comunicado, Mensaje del asistente, Auto-registro |
| SUB_PromoverListaEspera | `promoverListaEspera()` | Cancelar inscripción, Editar evento (si sube la capacidad) |
| Núcleo de inscripción | `inscribirSinPermiso()` | Inscribir (personal de GCS) y Auto-registro (el propio asistente) |
| Consulta de tareas | `listarTareas()` + `resumenTareas()` | Pestaña Tareas del evento, pantalla Tareas, Inicio y Portal del asistente |
| Normalizar progreso | `normalizarProgreso()` | Actualizar progreso desde el sistema y desde el portal |

## Microflujos principales

Versiones en imagen para documentos: [`docs/diagramas/`](diagramas).

### MF_AsignarTarea — `guardarTarea()`

```mermaid
flowchart TD
  A([Organizador guarda la tarea]) --> B{¿Evento activo?<br/>no cancelado ni finalizado}
  B -- No --> X1[/Error: el evento está cancelado o ya terminó/]
  B -- Sí --> C[SUB_ValidarPermiso<br/>tarea.gestionar + dueño del evento]
  C -- Sin permiso --> X2[/Error de permiso/]
  C --> D[Validar: título 3–120, prioridad,<br/>hoy ≤ fecha límite ≤ fecha del evento,<br/>responsable = asistente confirmado]
  D -- Errores --> X3[/Marcar campos con error/]
  D --> E[(Transacción: INSERT o UPDATE en tareas)]
  E --> F[SUB_RegistrarBitacora]
  F --> G{¿Cambió el responsable?}
  G -- Sí --> H[SUB_Notificar: Tarea asignada / reasignada]
  G -- No --> I([Fin])
  H --> I
```

### MF_ActualizarProgresoTarea — `actualizarProgreso()`

```mermaid
flowchart TD
  A([Cambio de avance]) --> B{¿Quién lo hace?}
  B -- Personal de GCS --> C[SUB_ValidarPermiso: tarea.actualizar]
  B -- Asistente desde su portal --> D{¿Es el responsable?}
  D -- No --> X1[/Error: solo el responsable/]
  C --> E{¿Evento cancelado?}
  D -- Sí --> E
  E -- Sí --> X2[/Error/]
  E -- No --> F[normalizarProgreso<br/>0 % = Pendiente · 1–99 % = En progreso · 100 % = Completada]
  F --> G[(Transacción: UPDATE tareas + fecha de completado)]
  G --> H[SUB_RegistrarBitacora]
  H --> I([Fin: el avance del evento se recalcula en v_avance_tareas])
```

### MF_EnviarComunicado — `enviarComunicado()`

```mermaid
flowchart TD
  A([Organizador envía comunicado]) --> B[SUB_ValidarPermiso<br/>comunicado.enviar + dueño del evento]
  B --> C[SUB_ValidarTexto: asunto y mensaje]
  C --> D[SUB_DestinatariosSegmento<br/>Todos · Confirmados · Lista de espera · Con tareas pendientes]
  D --> E{¿Hay destinatarios?}
  E -- No --> X[/Error: el grupo está vacío/]
  E -- Sí --> F[(Transacción: INSERT mensajes)]
  F --> G[SUB_Notificar: un aviso por destinatario]
  G --> H[SUB_RegistrarBitacora]
  H --> I([Fin: los asistentes lo ven en su portal])
```

### MF_InscribirAsistente — `inscribir()` / `autoRegistro()`

```mermaid
flowchart TD
  A1([Personal inscribe]) --> P[SUB_ValidarPermiso]
  A2([Asistente se registra solo]) --> V[Validar formulario de asistente<br/>+ aviso de privacidad]
  V --> Q[(Buscar por correo o crear participante)]
  P --> N
  Q --> N[Núcleo de inscripción<br/>inscribirSinPermiso]
  N --> R{¿Hay cupo?}
  R -- Sí --> S[Confirmado] --> T[SUB_Notificar: Inscripción]
  R -- No --> U[Lista de espera] --> W[SUB_Notificar: Lista de espera]
  T --> Z([Fin])
  W --> Z
```

### MF_CancelarInscripcion — `cancelarInscripcion()`

Cancela la inscripción. Las tareas pendientes de esa persona en el evento quedan **sin asignar**. Luego llama a **SUB_PromoverListaEspera**, que confirma al siguiente de la lista y le manda un aviso de *Promoción*.

### MF_EditarEvento y MF_CancelarEvento

- Si cambia la fecha, la hora o la sede, **SUB_Notificar** avisa a todos los inscritos (*Evento modificado*).
- Si se cancela el evento, avisa a todos (*Evento cancelado*).
- Si sube la capacidad, se llama a **SUB_PromoverListaEspera**.

## Transacciones anidadas

Un microflujo puede llamar a otro: por ejemplo, Auto-registro llama al núcleo de inscripción. Por eso `Database.transaction()` ([`js/db.js`](../js/db.js)) admite anidarse. Solo la transacción exterior confirma o revierte, así que si falla un paso intermedio no queda nada guardado a medias. La prueba R-03 lo comprueba.
