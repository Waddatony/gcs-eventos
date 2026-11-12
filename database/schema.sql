-- =============================================================
--  GCS Eventos · Esquema de base de datos (SQLite)
--  Global Consulting Services — Sistema de gestión de eventos
--  La app carga este mismo esquema en el navegador con sql.js
--  (SQLite compilado a WebAssembly) y lo guarda en IndexedDB.
-- =============================================================

PRAGMA foreign_keys = ON;

-- Usuarios del sistema (quién inicia sesión)
CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT    NOT NULL CHECK (length(trim(nombre)) >= 3),
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  rol            TEXT    NOT NULL CHECK (rol IN ('Administrador','Organizador','Colaborador')),
  password_hash  TEXT    NOT NULL,          -- SHA-256(salt + contraseña), nunca texto plano
  salt           TEXT    NOT NULL,
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Sedes / salas donde se realizan los eventos
CREATE TABLE IF NOT EXISTS sedes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  direccion  TEXT    NOT NULL,
  capacidad  INTEGER NOT NULL CHECK (capacidad > 0)
);

-- Eventos corporativos
CREATE TABLE IF NOT EXISTS eventos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo          TEXT    NOT NULL CHECK (length(trim(titulo)) BETWEEN 5 AND 100),
  descripcion     TEXT    NOT NULL DEFAULT '',
  tipo            TEXT    NOT NULL CHECK (tipo IN ('Capacitación','Conferencia','Reunión con cliente','Taller','Evento interno')),
  sede_id         INTEGER NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
  fecha           TEXT    NOT NULL,          -- AAAA-MM-DD
  hora_inicio     TEXT    NOT NULL,          -- HH:MM
  hora_fin        TEXT    NOT NULL,          -- HH:MM
  capacidad       INTEGER NOT NULL CHECK (capacidad > 0),
  presupuesto     REAL    NOT NULL DEFAULT 0 CHECK (presupuesto >= 0),
  organizador_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado          TEXT    NOT NULL DEFAULT 'Planeado' CHECK (estado IN ('Planeado','Confirmado','Cancelado')),
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (hora_fin > hora_inicio)
);

-- Participantes (empleados de GCS o clientes invitados)
CREATE TABLE IF NOT EXISTS participantes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL CHECK (length(trim(nombre)) >= 3),
  email     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  empresa   TEXT NOT NULL DEFAULT 'Global Consulting Services',
  area      TEXT NOT NULL DEFAULT '',
  telefono  TEXT NOT NULL DEFAULT ''
);

-- Inscripciones: relación muchos-a-muchos entre eventos y participantes
CREATE TABLE IF NOT EXISTS inscripciones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id        INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  participante_id  INTEGER NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  estado           TEXT    NOT NULL DEFAULT 'Confirmado' CHECK (estado IN ('Confirmado','Lista de espera','Cancelado')),
  asistio          INTEGER NOT NULL DEFAULT 0 CHECK (asistio IN (0,1)),
  fecha_registro   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (evento_id, participante_id)        -- nadie se inscribe dos veces al mismo evento
);

-- Bitácora de auditoría: quién hizo qué y cuándo
CREATE TABLE IF NOT EXISTS bitacora (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  accion      TEXT NOT NULL,
  entidad     TEXT NOT NULL,
  entidad_id  INTEGER,
  detalle     TEXT NOT NULL DEFAULT '',
  fecha       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_eventos_fecha       ON eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_sede_fecha  ON eventos(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_insc_evento         ON inscripciones(evento_id, estado);

-- Red de seguridad a nivel BD: nunca más confirmados que la capacidad
CREATE TRIGGER IF NOT EXISTS trg_no_sobrecupo
BEFORE INSERT ON inscripciones
WHEN NEW.estado = 'Confirmado'
 AND (SELECT COUNT(*) FROM inscripciones WHERE evento_id = NEW.evento_id AND estado = 'Confirmado')
     >= (SELECT capacidad FROM eventos WHERE id = NEW.evento_id)
BEGIN
  SELECT RAISE(ABORT, 'El evento ya alcanzó su capacidad máxima');
END;

-- Vista con los cálculos automáticos de cada evento
CREATE VIEW IF NOT EXISTS v_eventos_resumen AS
SELECT e.*,
       s.nombre AS sede,
       u.nombre AS organizador,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.evento_id = e.id AND i.estado = 'Confirmado')      AS confirmados,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.evento_id = e.id AND i.estado = 'Lista de espera') AS en_espera,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.evento_id = e.id AND i.asistio = 1)                AS asistentes
FROM eventos e
JOIN sedes s    ON s.id = e.sede_id
JOIN usuarios u ON u.id = e.organizador_id;

-- =============================================================
--  Actividad 4 · Tareas, comunicación y portal del asistente
--  "Asistente" = un participante inscrito a un evento (tabla inscripciones)
-- =============================================================

-- Tareas que el organizador asigna a los asistentes de un evento
CREATE TABLE IF NOT EXISTS tareas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id       INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  titulo          TEXT    NOT NULL CHECK (length(trim(titulo)) BETWEEN 3 AND 120),
  descripcion     TEXT    NOT NULL DEFAULT '',
  responsable_id  INTEGER REFERENCES participantes(id) ON DELETE SET NULL,   -- NULL = sin asignar
  prioridad       TEXT    NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta','Media','Baja')),
  estado          TEXT    NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','En progreso','Completada')),
  avance          INTEGER NOT NULL DEFAULT 0 CHECK (avance BETWEEN 0 AND 100),
  fecha_limite    TEXT    NOT NULL,                                          -- AAAA-MM-DD
  creado_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  completada_en   TEXT,
  CHECK (estado <> 'Completada' OR avance = 100),                            -- completada = 100 %
  CHECK (estado <> 'Pendiente' OR avance = 0)                                -- pendiente = 0 %
);

-- Mensajes: comunicados del organizador y mensajes que los asistentes envían desde su portal
CREATE TABLE IF NOT EXISTS mensajes (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id              INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  direccion              TEXT    NOT NULL CHECK (direccion IN ('Organizador a asistentes','Asistente a organizador')),
  autor_usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_participante_id  INTEGER REFERENCES participantes(id) ON DELETE CASCADE,
  segmento               TEXT    NOT NULL DEFAULT 'Todos',
  asunto                 TEXT    NOT NULL CHECK (length(trim(asunto)) BETWEEN 3 AND 120),
  cuerpo                 TEXT    NOT NULL CHECK (length(trim(cuerpo)) >= 5),
  destinatarios          INTEGER NOT NULL DEFAULT 0,
  leido                  INTEGER NOT NULL DEFAULT 0 CHECK (leido IN (0,1)),
  fecha                  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK ((direccion = 'Organizador a asistentes' AND autor_usuario_id IS NOT NULL)
      OR (direccion = 'Asistente a organizador' AND autor_participante_id IS NOT NULL))
);

-- Notificaciones que recibe cada asistente (bandeja de su portal)
CREATE TABLE IF NOT EXISTS notificaciones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  participante_id  INTEGER NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  evento_id        INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
  tarea_id         INTEGER REFERENCES tareas(id) ON DELETE SET NULL,
  mensaje_id       INTEGER REFERENCES mensajes(id) ON DELETE CASCADE,
  tipo             TEXT    NOT NULL CHECK (tipo IN ('Inscripción','Lista de espera','Promoción','Tarea asignada',
                                                    'Tarea reasignada','Evento modificado','Evento cancelado','Comunicado')),
  titulo           TEXT    NOT NULL,
  texto            TEXT    NOT NULL DEFAULT '',
  leida            INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0,1)),
  fecha            TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Enlace personal (token) de cada asistente para entrar a su portal sin contraseña
CREATE TABLE IF NOT EXISTS accesos_portal (
  participante_id  INTEGER PRIMARY KEY REFERENCES participantes(id) ON DELETE CASCADE,
  token            TEXT    NOT NULL UNIQUE,
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_tareas_evento       ON tareas(evento_id, estado);
CREATE INDEX IF NOT EXISTS idx_tareas_responsable  ON tareas(responsable_id, estado);
CREATE INDEX IF NOT EXISTS idx_notif_participante  ON notificaciones(participante_id, leida);
CREATE INDEX IF NOT EXISTS idx_mensajes_evento     ON mensajes(evento_id, fecha);

-- Vista con el avance de las tareas de cada evento (seguimiento de progreso)
CREATE VIEW IF NOT EXISTS v_avance_tareas AS
SELECT e.id AS evento_id,
       e.titulo,
       e.fecha,
       COUNT(t.id)                                                    AS total,
       COALESCE(SUM(t.estado = 'Completada'), 0)                      AS completadas,
       COALESCE(SUM(t.estado = 'En progreso'), 0)                     AS en_progreso,
       COALESCE(SUM(t.estado = 'Pendiente'), 0)                       AS pendientes,
       COALESCE(SUM(t.responsable_id IS NULL AND t.estado <> 'Completada'), 0) AS sin_asignar,
       COALESCE(ROUND(AVG(t.avance)), 0)                              AS avance_promedio
FROM eventos e
LEFT JOIN tareas t ON t.evento_id = e.id
GROUP BY e.id;
