# Product Backlog — GCS Eventos

Caso: **Global Consulting Services (GCS)** necesita un sistema para planear sus eventos corporativos y con clientes (capacitaciones, talleres, conferencias, reuniones), controlar cupos e inscripciones, evitar que dos eventos ocupen la misma sede al mismo tiempo y medir la asistencia y el costo de cada evento.

En GitHub, cada historia es un **Issue** con etiquetas de prioridad (`prioridad: alta/media/baja`) y de sprint, organizado en el tablero **GitHub Projects** (columnas *Backlog → To do → In progress → Done*). Esto reemplaza la plataforma de gestión de proyectos de Mendix.

**Criterio de priorización:** importancia para el negocio (¿sin esto la app no resuelve el problema?) y urgencia técnica (¿otras historias dependen de esta?). Estimación en puntos de historia (Fibonacci).

| # | Historia de usuario | Prioridad | Puntos | Sprint |
|---|---|---|---|---|
| HU-01 | Como **usuario de GCS**, quiero iniciar sesión con mi correo y contraseña, para acceder solo a las funciones de mi rol. | Alta | 3 | 1 |
| HU-02 | Como **organizador**, quiero crear un evento con título, tipo, sede, fecha, horario, capacidad y presupuesto, para planearlo en el sistema. | Alta | 5 | 1 |
| HU-03 | Como **organizador**, quiero que el sistema me impida reservar una sede ocupada en ese horario o con más personas de las que caben, para evitar choques de agenda. | Alta | 3 | 1 |
| HU-04 | Como **colaborador**, quiero consultar y filtrar los eventos por texto, tipo, sede y estado, para encontrar rápido la información. | Alta | 3 | 1 |
| HU-05 | Como **colaborador**, quiero registrar participantes (empleados o clientes) con correo validado, para tener un directorio confiable. | Alta | 2 | 1 |
| HU-06 | Como **colaborador**, quiero inscribir participantes a un evento sin duplicados ni sobrecupo, para controlar la capacidad. | Alta | 5 | 1 |
| HU-07 | Como **organizador**, quiero que al llenarse un evento las nuevas inscripciones pasen a lista de espera y se confirmen solas si alguien cancela, para aprovechar todos los lugares. | Media | 3 | 2 |
| HU-08 | Como **organizador**, quiero editar o cancelar mis eventos, para mantener la agenda actualizada. | Media | 3 | 2 |
| HU-09 | Como **colaborador**, quiero registrar el check-in de asistencia el día del evento, para saber quién asistió realmente. | Media | 3 | 2 |
| HU-10 | Como **administrador**, quiero un tablero con eventos próximos, inscritos, presupuesto comprometido y tasa de asistencia, para tomar decisiones. | Media | 5 | 2 |
| HU-11 | Como **organizador**, quiero ver la ocupación, lugares disponibles y costo por asistente calculados automáticamente, para evaluar la rentabilidad del evento. | Media | 2 | 2 |
| HU-12 | Como **organizador**, quiero exportar eventos e inscritos a CSV/Excel, para compartir listas y reportes. | Baja | 2 | 3 |
| HU-13 | Como **administrador**, quiero dar de alta y editar sedes con su capacidad, para que los eventos se validen contra datos reales. | Baja | 2 | 3 |
| HU-14 | Como **administrador**, quiero crear usuarios con rol y activarlos o desactivarlos, para controlar quién accede. | Baja | 3 | 3 |
| HU-15 | Como **administrador**, quiero una bitácora de auditoría de todas las operaciones, para tener trazabilidad y seguridad. | Baja | 2 | 3 |

**Total:** 46 puntos · Sprint 1: 21 pts · Sprint 2: 16 pts · Sprint 3: 9 pts

## Criterios de aceptación

**HU-01 Iniciar sesión**
- Con credenciales correctas entra al inicio; con incorrectas muestra "Correo o contraseña incorrectos" (sin revelar si el correo existe).
- Un usuario desactivado no puede entrar. Tras 5 intentos fallidos la cuenta se bloquea temporalmente.
- Las contraseñas se guardan con hash SHA-256 + sal, nunca en texto plano.

**HU-02 Crear evento**
- Título de 5 a 100 caracteres; tipo, sede, fecha y horas obligatorios; capacidad entera > 0; presupuesto ≥ 0.
- La fecha no puede ser anterior a hoy; la hora de fin debe ser posterior a la de inicio.
- Al guardar, el evento aparece en la lista y queda registrado en la bitácora.

**HU-03 Validar sede**
- Si la sede tiene otro evento activo que se traslapa en horario, se muestra el nombre del evento que la ocupa.
- La capacidad del evento no puede superar la capacidad de la sede.

**HU-04 Consultar eventos**
- Filtros combinables por texto, tipo, sede y estado (Próximos, Finalizados, Cancelados, Todos); los filtros se recuerdan durante la sesión.

**HU-05 Participantes**
- Correo con formato válido y único; teléfono opcional de 10 dígitos.

**HU-06 Inscribir**
- No se puede inscribir dos veces a la misma persona ni inscribir a eventos cancelados o pasados.
- Nunca hay más confirmados que la capacidad (validado en la lógica y con un trigger en la base de datos).

**HU-07 Lista de espera**
- Con el evento lleno, la inscripción queda en "Lista de espera" con su posición.
- Al cancelar una inscripción o ampliar la capacidad, el primero de la lista pasa a "Confirmado" automáticamente.

**HU-08 Editar / cancelar**
- El organizador solo edita o cancela sus propios eventos; el administrador, todos.
- No se puede bajar la capacidad por debajo de los confirmados. Un evento con confirmados no se elimina: se cancela.

**HU-09 Check-in**
- Solo para inscritos confirmados y a partir del día del evento.

**HU-10 / HU-11 Indicadores y cálculos**
- Ocupación = confirmados / capacidad; disponibles = capacidad − confirmados; costo por asistente = presupuesto / confirmados; tasa de asistencia = check-ins / confirmados.

**HU-12 a HU-15**
- Exportación CSV compatible con Excel (UTF-8 con BOM). Sedes con nombre único. Usuarios con política de contraseña (8+ caracteres, mayúscula y número). Bitácora con usuario, acción, entidad y fecha.
