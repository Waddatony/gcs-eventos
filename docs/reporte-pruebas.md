# Reporte de pruebas — Actividad 4

**Fecha de ejecución:** 11 de noviembre de 2026 · **Rama:** `feature/actividad-4`

**Resultado global:** **60 de 60 casos aprobados**. Son 41 pruebas automáticas de lógica (27 nuevas de la Actividad 4 y 14 de regresión de la Actividad 3) y 19 pruebas de interfaz en un navegador real, que terminaron sin errores de JavaScript.

| Tipo de prueba | Herramienta | Cómo se ejecuta | Casos | Aprobados |
|---|---|---|---|---|
| Unitarias y de integración de los microflujos (con la base de datos SQLite real) | `node:test` + sql.js | `npm test` | 41 | 41 |
| Interfaz de punta a punta (flujos completos) | Playwright + Chromium | `python tests/e2e/interfaz_a4.py` | 19 | 19 |

Se probaron los **casos comunes** (el flujo que se espera) y las **excepciones** (datos inválidos, permisos, estados que no lo permiten, enlaces falsos y fallas a mitad de una operación).

## 1. Pruebas de los microflujos (`tests/actividad4.test.js`)

| ID | Caso | Tipo | Resultado |
|---|---|---|---|
| T-01 | Asignar una tarea a un asistente confirmado: queda Pendiente al 0 % y el responsable recibe aviso | Común | ✅ Aprobado |
| T-02 | Una tarea sin responsable queda "sin asignar" y no notifica a nadie | Común | ✅ Aprobado |
| T-03 | El responsable debe ser un asistente confirmado del evento | Excepción | ✅ Aprobado |
| T-04 | Fecha límite pasada o posterior a la fecha del evento | Excepción | ✅ Aprobado |
| T-05 | Título de menos de 3 caracteres y prioridad vacía | Excepción | ✅ Aprobado |
| T-06 | El colaborador no asigna tareas; el organizador solo en sus propios eventos | Excepción | ✅ Aprobado |
| T-07 | No se crean tareas en eventos cancelados o finalizados | Excepción | ✅ Aprobado |
| T-08 | Reasignar una tarea notifica al nuevo responsable | Común | ✅ Aprobado |
| T-09 | Una tarea completada no se puede eliminar (historial) | Excepción | ✅ Aprobado |
| P-01 | El avance define el estado: 0 % Pendiente, 1–99 % En progreso, 100 % Completada | Común | ✅ Aprobado |
| P-02 | Avance fuera de 0–100 o estado inválido | Excepción | ✅ Aprobado |
| P-03 | Completar guarda la fecha de completado; reabrir la tarea la borra | Común | ✅ Aprobado |
| P-04 | La base de datos rechaza estado y avance incoherentes (restricción CHECK) | Excepción | ✅ Aprobado |
| P-05 | Resumen de progreso: total, completadas, vencidas, sin asignar y avance promedio | Común | ✅ Aprobado |
| P-06 | En el portal solo el responsable puede actualizar su tarea | Excepción | ✅ Aprobado |
| P-07 | Si el asistente cancela su inscripción, sus tareas pendientes quedan sin asignar | Común | ✅ Aprobado |
| N-01 | Inscripción confirmada → aviso "Inscripción"; evento lleno → aviso "Lista de espera" | Común | ✅ Aprobado |
| N-02 | Al cancelar un confirmado, el de lista de espera es promovido y recibe aviso (dentro de N-01) | Común | ✅ Aprobado |
| N-03 | Cancelar un evento avisa a sus 3 inscritos; cancelarlo otra vez da error | Común / Excepción | ✅ Aprobado |
| N-04 | Cambiar la hora avisa a los 6 inscritos; cambiar solo la descripción no avisa | Común | ✅ Aprobado |
| C-01 | Comunicado al grupo "Con tareas pendientes" crea exactamente 2 avisos | Común | ✅ Aprobado |
| C-02 | Comunicado a un grupo vacío, con campos inválidos, sin permiso o en un evento terminado | Excepción | ✅ Aprobado |
| A-01 | El portal muestra los eventos, tareas y avisos del asistente; marcar como leídos | Común | ✅ Aprobado |
| A-02 | Enlace de portal con formato inválido o que no existe | Excepción | ✅ Aprobado |
| A-03 | El asistente escribe al organizador; error si no está inscrito a ese evento | Común / Excepción | ✅ Aprobado |
| R-01 | Auto-registro: crea al asistente, lo inscribe y le da su enlace de portal | Común | ✅ Aprobado |
| R-02 | Auto-registro duplicado, sin aceptar privacidad, con datos inválidos o en un evento terminado | Excepción | ✅ Aprobado |
| R-03 | Si falla un paso después de un sub-microflujo, se revierte todo (atomicidad) | Excepción | ✅ Aprobado |

**Regresión de la Actividad 3 (`tests/reglas.test.js`):** las 14 pruebas siguen aprobadas: login, contraseñas con hash, validaciones de evento, choque de sede, permisos, lista de espera, trigger contra sobrecupo, asistencia, cálculos, participantes, usuarios y exportación CSV.

## 2. Pruebas de interfaz (`tests/e2e/interfaz_a4.py`)

| ID | Caso | Tipo | Resultado |
|---|---|---|---|
| E-01 | Inicio muestra el calendario, el avance de tareas y la alerta de tareas vencidas | Común | ✅ Aprobado |
| E-02 | Vista Calendario de eventos y selección de un día | Común | ✅ Aprobado |
| E-03 | El calendario de la sede marca los días ocupados y llena la fecha al hacer clic | Común | ✅ Aprobado |
| E-04a | La tarea no se guarda con título corto y sin prioridad; los campos se marcan | Excepción | ✅ Aprobado |
| E-04b | Asignar una tarea desde el evento; mensaje "El responsable recibió un aviso" | Común | ✅ Aprobado |
| E-05 | Cambiar el avance a 100 % marca la tarea como Completada | Común | ✅ Aprobado |
| E-06a | Un comunicado vacío marca el asunto y el mensaje | Excepción | ✅ Aprobado |
| E-06b | Enviar comunicado a los confirmados: "Comunicado enviado a 6 asistentes" | Común | ✅ Aprobado |
| E-07 | La pantalla Tareas filtra solo las vencidas | Común | ✅ Aprobado |
| E-08 | Marcar como leído un mensaje de un asistente | Común | ✅ Aprobado |
| E-09 | Generar el enlace personal del portal | Común | ✅ Aprobado |
| E-10a | El asistente ve en su portal el comunicado recién enviado | Común | ✅ Aprobado |
| E-10b | El asistente actualiza el avance de su tarea desde el portal | Común | ✅ Aprobado |
| E-10c | El asistente escribe al organizador | Común | ✅ Aprobado (tras corregir el problema 2) |
| E-11a | Auto-registro con datos inválidos y sin aceptar privacidad: se marcan los 4 errores a la vez | Excepción | ✅ Aprobado (tras corregir el problema 8) |
| E-11b | Auto-registro exitoso con botón al portal | Común | ✅ Aprobado |
| E-12 | Enlace de portal inválido muestra un mensaje claro | Excepción | ✅ Aprobado |
| E-13 | El portal no se desborda en un celular de 390 px | Común | ✅ Aprobado |
| E-14 | Sin errores de JavaScript en la consola durante todo el recorrido | Común | ✅ Aprobado |

## 3. Problemas encontrados y soluciones aplicadas

| # | Problema | Cómo se detectó | Solución |
|---|---|---|---|
| 1 | Al reutilizar el microflujo de inscripción dentro del auto-registro, SQLite marcaba **"cannot start a transaction within a transaction"** porque los dos abrían su propia transacción. | Revisión del diseño de microflujos anidados; se reprodujo el error con SQLite antes de corregirlo. | `Database.transaction()` ahora detecta si ya hay una transacción abierta: la interior se une a la exterior y solo la exterior confirma o revierte. La prueba R-03 verifica que un fallo revierte todo. |
| 2 | En el portal, el formulario "Escribir al organizador" no traía un evento preseleccionado. Si el asistente no elegía uno, el mensaje no se enviaba. | Prueba de interfaz E-10c (falló en la primera ejecución). | El primer evento activo del asistente queda seleccionado por defecto. |
| 3 | La barra de avance de las tareas al 100 % salía **roja**, porque el componente reutilizado `BarraProgreso` venía de la ocupación, donde "lleno" es una alerta. | Revisión visual de las capturas. | Se agregó al componente el modo `avance` (100 % en verde) sin cambiar el modo `ocupación`. |
| 4 | En el calendario los títulos de los eventos se cortaban a pocas letras ("09:00 Ca…"). | Revisión visual de las capturas. | Los títulos ahora ocupan hasta 2 líneas. |
| 5 | La lista de avisos automáticos del personal era muy larga: una tarjeta por cada destinatario. | Revisión visual de las capturas. | Para el personal se creó la variante compacta `TablaAvisos`, con columna Leído y límite de 15 en la pantalla Comunicación. El asistente conserva las tarjetas. |
| 6 | La prueba E-06b leía el mensaje de la acción anterior y marcaba un falso error. | Primera ejecución de las pruebas de interfaz. | Se corrigió la prueba: limpia los mensajes antes de cada acción. |
| 7 | En el portal del asistente, la etiqueta del mes en "Mis eventos" decía "DE" en lugar de "NOV": se tomaba la tercera palabra de la fecha larga, que en español de México es "de". | Revisión visual de las capturas. | El mes se toma de la fecha (AAAA-MM-DD) con una tabla de abreviaturas, como en el resto de la app. |
| 8 | En el auto-registro, si no se aceptaba el aviso de privacidad solo aparecía ese error y se ocultaban los de nombre, correo y teléfono. La persona tenía que corregir en dos intentos. | Revisión visual de las capturas (collage de componentes). | El microflujo junta todos los errores y los marca a la vez. Se reforzaron la prueba R-02 y el caso E-11a (ahora exige 4 campos marcados). |

**Estado final:** los 8 problemas están corregidos, y las 60 pruebas pasaron en la última ejecución.
