# Estructura de la base de datos

Motor: **SQLite** (ejecutado en el navegador con sql.js/WebAssembly). Esquema completo en [`schema.sql`](schema.sql).

```mermaid
erDiagram
    USUARIOS ||--o{ EVENTOS : organiza
    SEDES ||--o{ EVENTOS : aloja
    EVENTOS ||--o{ INSCRIPCIONES : tiene
    PARTICIPANTES ||--o{ INSCRIPCIONES : realiza
    USUARIOS ||--o{ BITACORA : registra

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

**Almacenamiento:** el archivo SQLite completo se guarda en **IndexedDB** del navegador después de cada operación, así que los datos persisten al recargar o cerrar la app (base de datos local, según permite la actividad).
