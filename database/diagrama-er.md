# Estructura de la base de datos

**Entidades principales que pide la Actividad 4:**

| Entidad de la actividad | Tabla(s) | Relación clave |
|---|---|---|
| **Evento** | `eventos` (+ `sedes`) | Un evento tiene muchos asistentes, muchas tareas y muchos mensajes |
| **Asistente** | `participantes` + `inscripciones` | Un asistente es un participante inscrito a un evento (relación muchos a muchos con estado: Confirmado, Lista de espera, Cancelado) |
| **Tarea** | `tareas` | Una tarea pertenece a un evento y tiene un asistente responsable; un asistente puede tener muchas tareas |
| Comunicación | `mensajes`, `notificaciones` | Un comunicado genera una notificación por destinatario; el asistente también escribe al organizador |
| Portal | `accesos_portal` | Cada asistente tiene un enlace personal (token) |

### Vista simplificada (entidades principales)

![ERD simplificado](../docs/diagramas/ERD-principal.png)

### Modelo completo

Motor: **SQLite** (ejecutado en el navegador con sql.js/WebAssembly). Esquema completo en [`schema.sql`](schema.sql).

```mermaid
erDiagram
    USUARIOS ||--o{ EVENTOS : organiza
    SEDES ||--o{ EVENTOS : aloja
    EVENTOS ||--o{ INSCRIPCIONES : tiene
    PARTICIPANTES ||--o{ INSCRIPCIONES : realiza
    USUARIOS ||--o{ BITACORA : registra
    EVENTOS ||--o{ TAREAS : contiene
    PARTICIPANTES |o--o{ TAREAS : "es responsable de"
    USUARIOS ||--o{ TAREAS : crea
    EVENTOS ||--o{ MENSAJES : "tiene"
    USUARIOS |o--o{ MENSAJES : "envía comunicado"
    PARTICIPANTES |o--o{ MENSAJES : "escribe al organizador"
    PARTICIPANTES ||--o{ NOTIFICACIONES : recibe
    EVENTOS |o--o{ NOTIFICACIONES : "origina"
    TAREAS |o--o{ NOTIFICACIONES : "origina"
    MENSAJES |o--o{ NOTIFICACIONES : "genera"
    PARTICIPANTES ||--o| ACCESOS_PORTAL : "tiene enlace"

    USUARIOS {
        int id PK
        text nombre
        text email UK
        text rol "Administrador | Organizador | Colaborador"
        text password_hash "SHA-256 + sal"
        text salt
        int activo
    }
    SEDES {
        int id PK
        text nombre UK
        text direccion
        int capacidad "mayor a 0"
    }
    EVENTOS {
        int id PK
        text titulo "5 a 100 caracteres"
        text tipo
        int sede_id FK
        int organizador_id FK
        text fecha
        text hora_inicio
        text hora_fin "posterior a hora_inicio"
        int capacidad
        real presupuesto
        text estado "Planeado | Confirmado | Cancelado"
    }
    PARTICIPANTES {
        int id PK
        text nombre
        text email UK
        text empresa
        text area
        text telefono
    }
    INSCRIPCIONES {
        int id PK
        int evento_id FK
        int participante_id FK
        text estado "Confirmado | Lista de espera | Cancelado"
        int asistio
        text fecha_registro
    }
    TAREAS {
        int id PK
        int evento_id FK
        int responsable_id FK "NULL = sin asignar"
        int creado_por FK
        text titulo "3 a 120 caracteres"
        text descripcion
        text prioridad "Alta | Media | Baja"
        text estado "Pendiente | En progreso | Completada"
        int avance "0 a 100, coherente con estado"
        text fecha_limite "hoy <= fecha <= fecha del evento"
        text completada_en
    }
    MENSAJES {
        int id PK
        int evento_id FK
        text direccion "Organizador a asistentes | Asistente a organizador"
        int autor_usuario_id FK
        int autor_participante_id FK
        text segmento "Todos | Confirmados | Lista de espera | Con tareas pendientes"
        text asunto
        text cuerpo
        int destinatarios
        int leido
    }
    NOTIFICACIONES {
        int id PK
        int participante_id FK
        int evento_id FK
        int tarea_id FK
        int mensaje_id FK
        text tipo "Inscripción, Promoción, Tarea asignada, Comunicado..."
        text titulo
        text texto
        int leida
    }
    ACCESOS_PORTAL {
        int participante_id PK
        text token UK "24 hex aleatorios"
    }
    BITACORA {
        int id PK
        int usuario_id FK
        text accion
        text entidad
        int entidad_id
        text detalle
        text fecha
    }
```

## Integridad y seguridad de los datos

| Mecanismo | Dónde | Para qué |
|---|---|---|
| `PRIMARY KEY`, `FOREIGN KEY` con `PRAGMA foreign_keys = ON` | Todas las tablas | Relaciones válidas; no hay inscripciones sin evento |
| `ON DELETE CASCADE` / `RESTRICT` | inscripciones / eventos | Borrar un evento elimina sus inscripciones; no se puede borrar una sede en uso |
| `UNIQUE` | email de usuarios y participantes; (evento, participante) | Sin correos duplicados ni dobles inscripciones |
| `CHECK` | capacidad > 0, presupuesto ≥ 0, hora_fin > hora_inicio, valores de rol y estado | Datos válidos aunque se salte la interfaz |
| Trigger `trg_no_sobrecupo` | inscripciones | La BD rechaza más confirmados que la capacidad |
| Vista `v_eventos_resumen` | eventos | Cálculo centralizado de confirmados, lista de espera y asistentes |
| Índices | fecha, (sede, fecha), (evento, estado) | Búsquedas y validación de choques eficientes |
| Consultas parametrizadas (`?`) | `js/db.js` | Evitan inyección SQL |
| Transacciones (`BEGIN/COMMIT/ROLLBACK`) | `js/rules.js` | Cada operación se guarda completa o no se guarda |
| Hash SHA-256 + sal por usuario | usuarios | Contraseñas nunca en texto plano |
| Escape de HTML | `js/components.js` | Evita XSS al mostrar datos capturados |
| Bitácora | bitacora | Trazabilidad de quién hizo qué y cuándo |
| `CHECK (estado <> 'Completada' OR avance = 100)` y `CHECK (estado <> 'Pendiente' OR avance = 0)` | tareas | Estado y avance siempre coherentes |
| `ON DELETE SET NULL` en `responsable_id` | tareas | Si se borra un asistente, su tarea queda "sin asignar" en vez de perderse |
| `CHECK` de dirección y autor | mensajes | Un comunicado siempre tiene usuario autor; un mensaje de asistente, participante autor |
| Vista `v_avance_tareas` | tareas | Seguimiento de progreso por evento (total, completadas, sin asignar, avance promedio) |
| Token aleatorio de 96 bits | accesos_portal | Enlaces del portal imposibles de adivinar |

**Almacenamiento:** el archivo SQLite completo se guarda en **IndexedDB** del navegador después de cada operación, así que los datos persisten al recargar o cerrar la app (base de datos local, según permite la actividad).
