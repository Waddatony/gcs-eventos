#!/usr/bin/env bash
# Crea en GitHub las etiquetas y los 15 Issues del Product Backlog.
# Requisitos: GitHub CLI (gh) con sesión iniciada:  gh auth login
# Uso (desde la carpeta del repo ya subido a GitHub):  bash scripts/crear-backlog-github.sh
set -euo pipefail

etiqueta() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null; }
etiqueta "historia de usuario" "1d76db" "Historia del Product Backlog"
etiqueta "prioridad: alta"  "b60205" "Imprescindible para resolver el caso"
etiqueta "prioridad: media" "fbca04" "Importante, segunda iteración"
etiqueta "prioridad: baja"  "0e8a16" "Deseable"
etiqueta "sprint 1" "5319e7" "Sprint 1 — Agenda y cupos"
etiqueta "sprint 2" "5319e7" "Sprint 2 — Experiencia y métricas"
etiqueta "sprint 3" "5319e7" "Sprint 3 — Administración y seguridad"

issue() { # titulo prioridad sprint puntos cuerpo
  gh issue create --title "$1" --label "historia de usuario,prioridad: $2,sprint $3" \
    --body "$5

**Estimación:** $4 puntos · **Prioridad:** $2 · **Sprint:** $3
Criterios de aceptación: ver docs/product-backlog.md" >/dev/null
  echo "✔ $1"
}

issue "HU-01 Iniciar sesión por rol" alta 1 3 "Como **usuario de GCS**, quiero iniciar sesión con mi correo y contraseña, para acceder solo a las funciones de mi rol."
issue "HU-02 Crear evento" alta 1 5 "Como **organizador**, quiero crear un evento con título, tipo, sede, fecha, horario, capacidad y presupuesto, para planearlo en el sistema."
issue "HU-03 Validar disponibilidad y capacidad de la sede" alta 1 3 "Como **organizador**, quiero que el sistema me impida reservar una sede ocupada en ese horario o con más personas de las que caben, para evitar choques de agenda."
issue "HU-04 Consultar y filtrar eventos" alta 1 3 "Como **colaborador**, quiero consultar y filtrar los eventos por texto, tipo, sede y estado, para encontrar rápido la información."
issue "HU-05 Registrar participantes" alta 1 2 "Como **colaborador**, quiero registrar participantes (empleados o clientes) con correo validado, para tener un directorio confiable."
issue "HU-06 Inscribir con control de cupo" alta 1 5 "Como **colaborador**, quiero inscribir participantes a un evento sin duplicados ni sobrecupo, para controlar la capacidad."
issue "HU-07 Lista de espera automática" media 2 3 "Como **organizador**, quiero que al llenarse un evento las nuevas inscripciones pasen a lista de espera y se confirmen solas si alguien cancela, para aprovechar todos los lugares."
issue "HU-08 Editar y cancelar eventos" media 2 3 "Como **organizador**, quiero editar o cancelar mis eventos, para mantener la agenda actualizada."
issue "HU-09 Check-in de asistencia" media 2 3 "Como **colaborador**, quiero registrar el check-in de asistencia el día del evento, para saber quién asistió realmente."
issue "HU-10 Tablero de indicadores" media 2 5 "Como **administrador**, quiero un tablero con eventos próximos, inscritos, presupuesto comprometido y tasa de asistencia, para tomar decisiones."
issue "HU-11 Cálculos automáticos del evento" media 2 2 "Como **organizador**, quiero ver la ocupación, lugares disponibles y costo por asistente calculados automáticamente, para evaluar la rentabilidad del evento."
issue "HU-12 Exportar a CSV" baja 3 2 "Como **organizador**, quiero exportar eventos e inscritos a CSV/Excel, para compartir listas y reportes."
issue "HU-13 Gestionar sedes" baja 3 2 "Como **administrador**, quiero dar de alta y editar sedes con su capacidad, para que los eventos se validen contra datos reales."
issue "HU-14 Gestionar usuarios y roles" baja 3 3 "Como **administrador**, quiero crear usuarios con rol y activarlos o desactivarlos, para controlar quién accede."
issue "HU-15 Bitácora de auditoría" baja 3 2 "Como **administrador**, quiero una bitácora de auditoría de todas las operaciones, para tener trazabilidad y seguridad."

echo "Listo. Ahora crea el tablero en la pestaña Projects y agrega estos Issues (columnas Backlog / To do / In progress / Done)."
