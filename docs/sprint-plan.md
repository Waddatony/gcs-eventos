# Planificación de sprints — GCS Eventos

**Equipo 1:** Antonio Anaya (Product Owner y documentación) · Isaac Calixto (desarrollador) · Integrante 3 (Scrum Master y QA)

> El tercer integrante y las fechas exactas se ajustan en el documento final.

**Capacidad del equipo:** 3 integrantes × ~8 h por semana × 2 semanas ≈ 48 h por sprint. Con base en eso, la velocidad objetivo es de **~20 puntos por sprint**.

## Sprint 1 — "Agenda y cupos" (2 semanas: 5 al 18 de noviembre de 2026)

**Objetivo del sprint:** que un organizador pueda iniciar sesión, crear eventos sin choques de sede e inscribir participantes respetando el cupo. Es la funcionalidad más crítica: sin ella la app no resuelve el problema de GCS.

| Historia | Pts | Tareas | Responsable | Horas |
|---|---|---|---|---|
| HU-01 Iniciar sesión | 3 | Tabla `usuarios` con hash y sal · pantalla de login · control de acceso por rol | Isaac | 5 |
| | | Pruebas de login, usuario inactivo y bloqueo | Integrante 3 | 2 |
| HU-02 Crear evento | 5 | Tablas `eventos` y `sedes` · formulario con validaciones · cálculo en vivo de duración y costo | Isaac | 8 |
| | | Redactar criterios de aceptación y datos de ejemplo | Antonio | 2 |
| HU-03 Validar sede | 3 | Regla de traslape de horario y capacidad de la sede | Isaac | 4 |
| | | Casos de prueba de choque de horarios | Integrante 3 | 2 |
| HU-04 Consultar eventos | 3 | Lista con filtros, insignias de estado y barra de ocupación | Isaac | 4 |
| | | Revisión de diseño responsivo y accesibilidad | Integrante 3 | 2 |
| HU-05 Participantes | 2 | Directorio con alta y edición (modal reutilizable) | Isaac | 3 |
| HU-06 Inscribir | 5 | Tabla `inscripciones` (UNIQUE + trigger anti sobrecupo) · pantalla de detalle con inscripción | Isaac | 6 |
| | | Pruebas automáticas de reglas de negocio (`npm test`) | Integrante 3 | 3 |
| Transversal | — | Backlog en GitHub Issues/Projects · registro de dailies · documento Word | Antonio | 7 |
| **Total** | **21** | | | **48** |

**Definición de terminado (DoD):** código en la rama `main` de GitHub, criterios de aceptación cumplidos, pruebas automáticas en verde, funciona en escritorio y celular, y el Issue se cierra en el tablero.

## Sprint 2 — "Experiencia y métricas" (2 semanas)

HU-07 Lista de espera · HU-08 Editar y cancelar · HU-09 Check-in · HU-10 Tablero de indicadores · HU-11 Cálculos automáticos (16 pts)

## Sprint 3 — "Administración y seguridad" (1 semana)

HU-12 Exportar CSV · HU-13 Sedes · HU-14 Usuarios y roles · HU-15 Bitácora (9 pts)

## Registro de reuniones diarias (plantilla)

| Fecha | Integrante | ¿Qué hice ayer? | ¿Qué haré hoy? | Obstáculos | Decisiones / ajustes |
|---|---|---|---|---|---|
| | Antonio | | | | |
| | Isaac | | | | |
| | Integrante 3 | | | | |

Ajustes al plan ya documentados:
- **Cambio de herramienta:** el profesor autorizó usar GitHub en lugar de Mendix. El prototipo se desarrolla como app web (HTML, CSS y JavaScript con SQLite) y el backlog se gestiona en GitHub Issues/Projects.
- **Nueva regla de negocio:** no se elimina un evento con confirmados; se cancela, para conservar el historial.
