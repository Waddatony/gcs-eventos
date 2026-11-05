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
