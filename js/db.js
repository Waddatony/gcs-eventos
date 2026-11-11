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
    // Un microflujo puede llamar a otro (p. ej. autoRegistro → inscribir): la transacción
    // exterior es la única que confirma o revierte.
    if (this.enTransaccion) return fn();
    this.enTransaccion = true;
    try {
      return this._transaccion(fn);
    } finally {
      this.enTransaccion = false;
    }
  }

  _transaccion(fn) {
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

// Datos de ejemplo de la Actividad 4 (tareas, comunicados, mensajes y avisos).
// Se cargan si la tabla de tareas está vacía y existen los eventos de ejemplo.
export async function sembrarActividad4(db, hoy = fechaLocal()) {
  if (db.get('SELECT COUNT(*) AS n FROM tareas').n > 0) return false;
  if (!db.get("SELECT id FROM eventos WHERE id = 1 AND titulo LIKE 'Kickoff%'")) return false;
  const d = n => sumarDias(hoy, n);
  db.transaction(() => {
    const tareas = [
      // evento, título, descripción, responsable, prioridad, límite, estado, avance
      [1, 'Preparar presentación de objetivos 2027', 'Diapositivas con metas por práctica.', 2, 'Alta', d(5), 'En progreso', 60],
      [1, 'Confirmar catering para 100 personas', 'Cotizar con dos proveedores y confirmar menú.', 3, 'Alta', d(4), 'Pendiente', 0],
      [1, 'Diseñar gafetes y señalética', '', 7, 'Media', d(6), 'Completada', 100],
      [1, 'Probar audio y proyector del auditorio', '', null, 'Media', d(6), 'Pendiente', 0],
      [2, 'Imprimir material del taller', '30 juegos de la guía práctica.', 6, 'Media', d(2), 'En progreso', 40],
      [2, 'Enviar lectura previa a los participantes', 'Guía Scrum, capítulos 1 a 3.', 1, 'Alta', d(-1), 'Pendiente', 0],
      [3, 'Preparar reporte de avance del ERP', 'Incluir indicadores del trimestre.', 1, 'Alta', d(1), 'En progreso', 80],
      [3, 'Confirmar asistentes de Grupo Alfa', '', 4, 'Media', d(0), 'Completada', 100],
      [4, 'Probar la plataforma de transmisión', 'Ensayo técnico con el ponente.', 2, 'Media', d(10), 'Pendiente', 0],
    ];
    for (const t of tareas) {
      const { lastId } = db.run(`INSERT INTO tareas (evento_id, titulo, descripcion, responsable_id, prioridad, fecha_limite, estado, avance, creado_por, completada_en)
        VALUES (?,?,?,?,?,?,?,?,2, CASE WHEN ? = 'Completada' THEN datetime('now','localtime') END)`, [...t, t[6]]);
      if (t[3]) {
        const ev = db.get('SELECT titulo FROM eventos WHERE id = ?', [t[0]]).titulo;
        db.run(`INSERT INTO notificaciones (participante_id, evento_id, tarea_id, tipo, titulo, texto, leida) VALUES (?,?,?,?,?,?,?)`,
          [t[3], t[0], lastId, 'Tarea asignada', `Nueva tarea: ${t[1]}`, `Evento "${ev}" · prioridad ${t[4]} · fecha límite ${t[5]}.`, t[6] === 'Completada' ? 1 : 0]);
      }
    }
    // Confirmaciones de inscripción
    for (const r of db.all(`SELECT i.participante_id, e.id, e.titulo, e.fecha, e.hora_inicio, e.hora_fin, s.nombre AS sede
        FROM inscripciones i JOIN eventos e ON e.id = i.evento_id JOIN sedes s ON s.id = e.sede_id WHERE i.estado = 'Confirmado' AND e.fecha >= ?`, [hoy])) {
      db.run(`INSERT INTO notificaciones (participante_id, evento_id, tipo, titulo, texto, leida) VALUES (?,?,?,?,?,1)`,
        [r.participante_id, r.id, 'Inscripción', `Tu lugar en "${r.titulo}" está confirmado`, `Te esperamos el ${r.fecha} de ${r.hora_inicio} a ${r.hora_fin} en ${r.sede}.`]);
    }
    // Un comunicado del organizador y un mensaje de una asistente
    const cuerpo = 'Les compartimos la agenda: 9:00 bienvenida, 9:30 resultados 2026, 11:00 metas 2027 por práctica, 12:30 preguntas. Lleguen 15 minutos antes para registrarse.';
    const { lastId: m } = db.run(`INSERT INTO mensajes (evento_id, direccion, autor_usuario_id, segmento, asunto, cuerpo, destinatarios, leido)
        VALUES (1, 'Organizador a asistentes', 2, 'Todos', 'Agenda del Kickoff anual', ?, 6, 1)`, [cuerpo]);
    for (const pid of [1, 2, 3, 6, 7, 8]) {
      db.run(`INSERT INTO notificaciones (participante_id, evento_id, mensaje_id, tipo, titulo, texto) VALUES (?,?,?,?,?,?)`,
        [pid, 1, m, 'Comunicado', 'Agenda del Kickoff anual', cuerpo]);
    }
    db.run(`INSERT INTO mensajes (evento_id, direccion, autor_participante_id, segmento, asunto, cuerpo, destinatarios, leido)
        VALUES (2, 'Asistente a organizador', 1, 'Organizador', '¿Hay que llevar laptop?', 'Hola, para el taller de Scrum ¿necesitamos llevar laptop o habrá equipos en la sala? Gracias.', 1, 0)`);
    db.run(`INSERT INTO accesos_portal (participante_id, token) VALUES (1, ?)`, [randomSalt(12)]);
    db.run("INSERT INTO bitacora (usuario_id, accion, entidad, detalle) VALUES (1, 'Inicializar', 'sistema', 'Datos de ejemplo de tareas y comunicación')");
  });
  return true;
}
