# Actividad 4 — Definición del producto

**Caso:** Global Consulting Services (GCS) organiza eventos corporativos para clientes de alto perfil. GCS Eventos cubre todo el ciclo: crear el evento, registrar a los asistentes, repartir y seguir las tareas de la organización, y comunicarse con los asistentes.

## Funcionalidades clave

| # | Funcionalidad | Qué permite | Por qué importa para la gestión de eventos | Historias |
|---|---|---|---|---|
| 1 | **Creación de eventos** | Crear y configurar un evento: tipo, sede, fecha y horario, capacidad y presupuesto. Calendario de disponibilidad de la sede. | Sin una agenda confiable no hay evento. Las validaciones evitan dos eventos en la misma sala y salas con más gente de la que cabe. | HU-02, HU-03, HU-21 |
| 2 | **Registro de asistentes** | Registrar asistentes desde el sistema o con una página pública de auto-registro. El cupo se controla solo y hay lista de espera automática. | Los clientes de alto perfil esperan un registro ágil. El control de cupo evita sobreventa y aprovecha cada lugar liberado. | HU-05, HU-06, HU-07, HU-22 |
| 3 | **Asignación de tareas** | Asignar tareas (con prioridad y fecha límite) a los asistentes confirmados de un evento. Reasignar o dejar sin asignar. | Un evento corporativo implica muchas tareas: catering, materiales, transporte, logística. Asignarlas con responsable y fecha evita olvidos. | HU-16 |
| 4 | **Seguimiento de progreso** | Avance de 0 a 100 % por tarea, que fija solo el estado (Pendiente, En progreso, Completada). Alertas de vencidas, avance por evento y vista global con filtros. | El organizador ve de un vistazo qué va atrasado y puede actuar antes del día del evento. | HU-17 |
| 5 | **Comunicación con los participantes** | Avisos automáticos (inscripción, lista de espera, promoción, tarea asignada, cambios y cancelación), comunicados por grupo, mensajes del asistente al organizador y opción de abrir el comunicado en el correo. | Cada asistente sabe a tiempo lo que le corresponde, y el organizador recibe dudas y avisos en un solo lugar. | HU-18, HU-19 |
| 6 | **Portal del asistente** | Enlace personal donde el asistente ve sus eventos (con calendario), sus tareas, sus avisos y su bandeja para escribir al organizador. | Es el canal de comunicación de ida y vuelta, sin necesidad de crear cuentas ni contraseñas. | HU-20 |
| 7 | **Seguridad y trazabilidad** | Roles (Administrador, Organizador, Colaborador), contraseñas con hash y bitácora de cada operación. | La información de clientes de alto perfil exige control de acceso y auditoría. | HU-01, HU-14, HU-15 |

## Entregables en este repositorio

| Punto de la actividad | Dónde está |
|---|---|
| Modelo de datos y diagrama entidad-relación | [`database/diagrama-er.md`](../database/diagrama-er.md) · [`database/schema.sql`](../database/schema.sql) |
| Lógica de negocio (microflujos modulares y reutilizables) | [`docs/microflujos.md`](microflujos.md) · [`js/subflujos.js`](../js/subflujos.js) · [`js/microflujos.js`](../js/microflujos.js) |
| Diseño de interfaces | App publicada · capturas en [`docs/capturas-a4/`](capturas-a4) |
| Componentes reutilizables | [`docs/componentes-reutilizables.md`](componentes-reutilizables.md) |
| Validación y pruebas | [`docs/reporte-pruebas.md`](reporte-pruebas.md) · [`tests/`](../tests) |
| Gestión ágil (Sprint 4) | Issues #19 a #30 · milestone "Sprint 4 — Tareas y comunicación" · Pull Request de la rama `feature/actividad-4` |

## Decisiones clave y retos

- **GitHub en lugar de Mendix (autorizado por el profesor).** Los conceptos se respetaron: microflujos con sub-microflujos, building blocks, domain model y roles de seguridad. Cada uno tiene su equivalente documentado.
- **El "Asistente" no es una tabla nueva**, sino un participante inscrito a un evento. Así una misma persona puede asistir a muchos eventos sin duplicar sus datos, y la inscripción guarda el estado y la asistencia.
- **Las tareas se asignan solo a asistentes confirmados**, para que nadie en lista de espera quede responsable de algo. Si alguien cancela, sus tareas quedan "sin asignar" en lugar de perderse.
- **Portal con enlace personal en lugar de cuentas.** Los asistentes externos no deben crear usuario y contraseña. El enlace usa un token aleatorio de 96 bits.
- **Reto: microflujos que se llaman entre sí.** La inscripción se reutiliza en el auto-registro. Esto obligó a soportar transacciones anidadas (ver reporte de pruebas, problema 1).
- **Reto: notificaciones sin servidor de correo.** Se guardan como avisos en la base de datos y el asistente las lee en su portal. Para correos reales se agregó "Abrir también en mi correo", que arma el mensaje con todos los destinatarios en copia oculta.
