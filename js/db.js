// Capa de acceso a datos: envuelve SQLite (sql.js) con consultas parametrizadas.
// Todas las consultas usan parámetros (?) para evitar inyección SQL.

import { hashPassword, randomSalt } from './security.js';

export class Database {
  constructor(sqlDb) {
    this.sql = sqlDb;
    this.sql.run('PRAGMA foreign_keys = ON;');
  }

  all(query, params = []) {
    const stmt = this.sql.prepare(query);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  get(query, params = []) {
    return this.all(query, params)[0] ?? null;
  }

  run(query, params = []) {
    this.sql.run(query, params);
    const id = this.sql.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
    return { lastId: id, changes: this.sql.getRowsModified() };
  }

  // Ejecuta varias operaciones como una sola unidad: o se guardan todas o ninguna.
  transaction(fn) {
    this.sql.run('BEGIN');
    try {
      const result = fn();
      this.sql.run('COMMIT');
      return result;
    } catch (err) {
      this.sql.run('ROLLBACK');
      throw err;
    }
  }

  export() {
    return this.sql.export();
  }
}

export function fechaLocal(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  return fechaLocal(new Date(y, m - 1, d + dias));
}

export function crearBaseDeDatos(SQL, schemaSql, bytesGuardados = null) {
  const sqlDb = bytesGuardados ? new SQL.Database(bytesGuardados) : new SQL.Database();
  const db = new Database(sqlDb);
  db.sql.exec(schemaSql); // idempotente (IF NOT EXISTS)
  return db;
}

export const USUARIOS_DEMO = [
  { nombre: 'Laura Méndez',    email: 'admin@gcs.com',        rol: 'Administrador', password: 'Admin2026' },
  { nombre: 'Carlos Ruiz',     email: 'organizador@gcs.com',  rol: 'Organizador',   password: 'Eventos2026' },
  { nombre: 'Sofía Hernández', email: 'colaborador@gcs.com',  rol: 'Colaborador',   password: 'Staff2026' },
];

// Carga datos de ejemplo la primera vez (fechas relativas a hoy para que la demo siempre tenga eventos próximos).
export async function sembrarDatos(db, hoy = fechaLocal()) {
  if (db.get('SELECT COUNT(*) AS n FROM usuarios').n > 0) return false;

  const usuarios = [];
  for (const u of USUARIOS_DEMO) {
    const salt = randomSalt();
    const hash = await hashPassword(u.password, salt);
    usuarios.push({ ...u, salt, hash });
  }

  db.transaction(() => {
    for (const u of usuarios) {
      db.run('INSERT INTO usuarios (nombre, email, rol, password_hash, salt) VALUES (?,?,?,?,?)',
        [u.nombre, u.email, u.rol, u.hash, u.salt]);
    }

    const sedes = [
      ['Auditorio Torre GCS', 'Av. Constitución 1500, Monterrey', 120],
      ['Sala de Juntas Norte', 'Av. Constitución 1500, piso 8', 20],
      ['Centro de Capacitación', 'Blvd. Díaz Ordaz 210, San Pedro', 45],
      ['Sala Virtual (Teams)', 'En línea', 300],
    ];
    for (const s of sedes) db.run('INSERT INTO sedes (nombre, direccion, capacidad) VALUES (?,?,?)', s);

    const eventos = [
      ['Kickoff anual de consultoría 2027', 'Presentación de objetivos y metas por práctica.', 'Evento interno', 1, sumarDias(hoy, 7), '09:00', '13:00', 100, 45000, 2, 'Confirmado'],
      ['Taller de Scrum para líderes', 'Taller práctico de roles, eventos y artefactos Scrum.', 'Taller', 3, sumarDias(hoy, 3), '10:00', '14:00', 30, 12000, 2, 'Confirmado'],
      ['Revisión trimestral con Grupo Alfa', 'Presentación de resultados del proyecto ERP.', 'Reunión con cliente', 2, sumarDias(hoy, 1), '16:00', '17:30', 12, 2500, 1, 'Planeado'],
      ['Webinar: Tendencias de IA en consultoría', 'Conferencia abierta a clientes.', 'Conferencia', 4, sumarDias(hoy, 14), '18:00', '19:30', 250, 8000, 2, 'Planeado'],
      ['Capacitación en análisis de datos', 'Power BI desde cero para consultores junior.', 'Capacitación', 3, sumarDias(hoy, -5), '09:00', '15:00', 25, 15000, 1, 'Confirmado'],
    ];
    for (const e of eventos) {
      db.run(`INSERT INTO eventos (titulo, descripcion, tipo, sede_id, fecha, hora_inicio, hora_fin, capacidad, presupuesto, organizador_id, estado)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`, e);
    }

    const participantes = [
      ['Ana Torres', 'ana.torres@gcs.com', 'Global Consulting Services', 'Consultoría TI', '8112345678'],
      ['Jorge Salinas', 'jorge.salinas@gcs.com', 'Global Consulting Services', 'Finanzas', '8187654321'],
      ['María Garza', 'maria.garza@gcs.com', 'Global Consulting Services', 'Recursos Humanos', ''],
      ['Roberto Lozano', 'rlozano@grupoalfa.com', 'Grupo Alfa', 'Dirección de TI', '8199988877'],
      ['Daniela Cantú', 'dcantu@grupoalfa.com', 'Grupo Alfa', 'Operaciones', ''],
      ['Luis Treviño', 'luis.trevino@gcs.com', 'Global Consulting Services', 'Consultoría TI', ''],
      ['Fernanda Ríos', 'fernanda.rios@gcs.com', 'Global Consulting Services', 'Analítica', ''],
      ['Héctor Villarreal', 'hector.v@gcs.com', 'Global Consulting Services', 'Ventas', ''],
    ];
    for (const p of participantes) db.run('INSERT INTO participantes (nombre, email, empresa, area, telefono) VALUES (?,?,?,?,?)', p);

    const inscripciones = [
      [1, 1], [1, 2], [1, 3], [1, 6], [1, 7], [1, 8],
      [2, 1], [2, 6], [2, 7],
      [3, 4], [3, 5], [3, 1],
      [4, 4], [4, 2],
      [5, 6], [5, 7], [5, 8], [5, 3],
    ];
    for (const [ev, p] of inscripciones) db.run('INSERT INTO inscripciones (evento_id, participante_id) VALUES (?,?)', [ev, p]);
    // Asistencia registrada del evento pasado
    db.run('UPDATE inscripciones SET asistio = 1 WHERE evento_id = 5 AND participante_id IN (6,7,8)');

    db.run("INSERT INTO bitacora (usuario_id, accion, entidad, detalle) VALUES (1, 'Inicializar', 'sistema', 'Carga de datos de ejemplo')");
  });
  return true;
}
