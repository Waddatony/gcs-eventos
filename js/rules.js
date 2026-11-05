// Reglas de negocio de GCS Eventos.
// Aquí vive toda la lógica que en Mendix serían los microflows: validaciones,
// cálculos automáticos, permisos por rol y operaciones sobre los datos.

import { fechaLocal } from './db.js';
import { hashPassword, randomSalt, validarPassword } from './security.js';

export class ReglaError extends Error {
  constructor(mensaje, errores = {}) {
    super(mensaje);
    this.name = 'ReglaError';
    this.errores = errores; // { campo: 'mensaje' } para pintarlos junto a cada campo
  }
}

export const TIPOS_EVENTO = ['Capacitación', 'Conferencia', 'Reunión con cliente', 'Taller', 'Evento interno'];
export const ESTADOS_EVENTO = ['Planeado', 'Confirmado', 'Cancelado'];
export const ROLES = ['Administrador', 'Organizador', 'Colaborador'];

// ---------------------------------------------------------------- Permisos
const PERMISOS = {
  'evento.crear':           ['Administrador', 'Organizador'],
  'evento.editar':          ['Administrador', 'Organizador'], // organizador: solo los suyos
  'evento.eliminar':        ['Administrador', 'Organizador'], // organizador: solo los suyos
  'inscripcion.gestionar':  ['Administrador', 'Organizador', 'Colaborador'],
  'asistencia.registrar':   ['Administrador', 'Organizador', 'Colaborador'],
  'participante.gestionar': ['Administrador', 'Organizador', 'Colaborador'],
  'participante.eliminar':  ['Administrador'],
  'sede.gestionar':         ['Administrador'],
  'usuario.gestionar':      ['Administrador'],
  'bitacora.ver':           ['Administrador'],
};

export function puede(usuario, accion, evento = null) {
  if (!usuario || !PERMISOS[accion]?.includes(usuario.rol)) return false;
  if (evento && usuario.rol === 'Organizador' && (accion === 'evento.editar' || accion === 'evento.eliminar')) {
    return evento.organizador_id === usuario.id;
  }
  return true;
}

function exigir(usuario, accion, evento = null) {
  if (!puede(usuario, accion, evento)) throw new ReglaError('No tienes permiso para realizar esta acción');
}

export function registrarBitacora(db, usuario, accion, entidad, entidadId = null, detalle = '') {
  db.run('INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?)',
    [usuario?.id ?? null, accion, entidad, entidadId, detalle]);
}

// ---------------------------------------------------------------- Autenticación
const intentosFallidos = new Map();
const MAX_INTENTOS = 5;

export async function autenticar(db, email, password) {
  const clave = String(email || '').trim().toLowerCase();
  if (!clave || !password) throw new ReglaError('Escribe tu correo y contraseña');
  if ((intentosFallidos.get(clave) || 0) >= MAX_INTENTOS) {
    throw new ReglaError('Cuenta bloqueada temporalmente por demasiados intentos. Recarga la página para reintentar.');
  }
  const u = db.get('SELECT * FROM usuarios WHERE email = ?', [clave]);
  const hash = u ? await hashPassword(password, u.salt) : null;
  if (!u || hash !== u.password_hash) {
    intentosFallidos.set(clave, (intentosFallidos.get(clave) || 0) + 1);
    throw new ReglaError('Correo o contraseña incorrectos'); // mensaje genérico: no revela si el correo existe
  }
  if (!u.activo) throw new ReglaError('Tu usuario está desactivado. Contacta al administrador.');
  intentosFallidos.delete(clave);
  registrarBitacora(db, u, 'Inicio de sesión', 'usuario', u.id);
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
}

// ---------------------------------------------------------------- Validaciones comunes
export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

const texto = v => String(v ?? '').trim();

// ---------------------------------------------------------------- Eventos
export function validarEvento(db, d, { id = null, hoy = fechaLocal() } = {}) {
  const e = {};
  const titulo = texto(d.titulo);
  if (titulo.length < 5) e.titulo = 'El título debe tener al menos 5 caracteres';
  else if (titulo.length > 100) e.titulo = 'El título no puede pasar de 100 caracteres';

  if (!TIPOS_EVENTO.includes(d.tipo)) e.tipo = 'Selecciona un tipo de evento';
  if (d.estado && !ESTADOS_EVENTO.includes(d.estado)) e.estado = 'Estado no válido';

  const sede = d.sede_id ? db.get('SELECT * FROM sedes WHERE id = ?', [Number(d.sede_id)]) : null;
  if (!sede) e.sede_id = 'Selecciona una sede';

  const anterior = id ? db.get('SELECT * FROM eventos WHERE id = ?', [id]) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) e.fecha = 'Indica la fecha';
  else if (d.fecha < hoy && (!anterior || anterior.fecha !== d.fecha)) e.fecha = 'La fecha no puede ser anterior a hoy';

  if (!/^\d{2}:\d{2}$/.test(d.hora_inicio || '')) e.hora_inicio = 'Indica la hora de inicio';
  if (!/^\d{2}:\d{2}$/.test(d.hora_fin || '')) e.hora_fin = 'Indica la hora de fin';
  else if (d.hora_inicio && d.hora_fin <= d.hora_inicio) e.hora_fin = 'La hora de fin debe ser posterior a la de inicio';

  const capacidad = Number(d.capacidad);
  if (!Number.isInteger(capacidad) || capacidad <= 0) e.capacidad = 'La capacidad debe ser un número entero mayor a 0';
  else if (sede && capacidad > sede.capacidad) e.capacidad = `La sede "${sede.nombre}" solo admite ${sede.capacidad} personas`;
  else if (id) {
    const conf = db.get("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id = ? AND estado = 'Confirmado'", [id]).n;
    if (capacidad < conf) e.capacidad = `Ya hay ${conf} confirmados; la capacidad no puede ser menor`;
  }

  const presupuesto = Number(d.presupuesto);
  if (d.presupuesto === '' || d.presupuesto == null || Number.isNaN(presupuesto) || presupuesto < 0) {
    e.presupuesto = 'El presupuesto debe ser 0 o mayor';
  }

  // Regla: una sede no puede tener dos eventos activos que se traslapen en horario.
  if (sede && !e.fecha && !e.hora_inicio && !e.hora_fin && d.estado !== 'Cancelado') {
    const choque = db.get(
      `SELECT titulo, hora_inicio, hora_fin FROM eventos
        WHERE sede_id = ? AND fecha = ? AND estado <> 'Cancelado' AND id <> ?
          AND hora_inicio < ? AND hora_fin > ?`,
      [sede.id, d.fecha, id ?? -1, d.hora_fin, d.hora_inicio]);
    if (choque) e.sede_id = `La sede ya está ocupada por "${choque.titulo}" (${choque.hora_inicio}–${choque.hora_fin})`;
  }
  return e;
}

export function guardarEvento(db, usuario, d, { id = null, hoy = fechaLocal() } = {}) {
  const anterior = id ? db.get('SELECT * FROM eventos WHERE id = ?', [id]) : null;
  if (id && !anterior) throw new ReglaError('El evento no existe');
  exigir(usuario, id ? 'evento.editar' : 'evento.crear', anterior);

  const errores = validarEvento(db, d, { id, hoy });
  if (Object.keys(errores).length) throw new ReglaError('Revisa los campos marcados', errores);

  const valores = [texto(d.titulo), texto(d.descripcion), d.tipo, Number(d.sede_id), d.fecha,
    d.hora_inicio, d.hora_fin, Number(d.capacidad), Number(d.presupuesto), d.estado || 'Planeado'];

  return db.transaction(() => {
    if (id) {
      db.run(`UPDATE eventos SET titulo=?, descripcion=?, tipo=?, sede_id=?, fecha=?, hora_inicio=?, hora_fin=?,
              capacidad=?, presupuesto=?, estado=? WHERE id=?`, [...valores, id]);
      registrarBitacora(db, usuario, 'Editar', 'evento', id, texto(d.titulo));
      // Si se amplió la capacidad, se promueve automáticamente a la lista de espera.
      promoverListaEspera(db, usuario, id);
      return id;
    }
    const { lastId } = db.run(`INSERT INTO eventos (titulo, descripcion, tipo, sede_id, fecha, hora_inicio, hora_fin,
              capacidad, presupuesto, estado, organizador_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [...valores, usuario.id]);
    registrarBitacora(db, usuario, 'Crear', 'evento', lastId, texto(d.titulo));
    return lastId;
  });
}

export function eliminarEvento(db, usuario, id) {
  const ev = db.get('SELECT * FROM eventos WHERE id = ?', [id]);
  if (!ev) throw new ReglaError('El evento no existe');
  exigir(usuario, 'evento.eliminar', ev);
  const conf = db.get("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id = ? AND estado = 'Confirmado'", [id]).n;
  if (conf > 0) throw new ReglaError(`El evento tiene ${conf} participantes confirmados. Cancélalo en lugar de eliminarlo.`);
  db.transaction(() => {
    db.run('DELETE FROM eventos WHERE id = ?', [id]);
    registrarBitacora(db, usuario, 'Eliminar', 'evento', id, ev.titulo);
  });
}

export function cancelarEvento(db, usuario, id) {
  const ev = db.get('SELECT * FROM eventos WHERE id = ?', [id]);
  if (!ev) throw new ReglaError('El evento no existe');
  exigir(usuario, 'evento.editar', ev);
  db.transaction(() => {
    db.run("UPDATE eventos SET estado = 'Cancelado' WHERE id = ?", [id]);
    registrarBitacora(db, usuario, 'Cancelar', 'evento', id, ev.titulo);
  });
}

// ---------------------------------------------------------------- Cálculos automáticos
export function estadoTemporal(ev, hoy = fechaLocal()) {
  if (ev.estado === 'Cancelado') return 'Cancelado';
  if (ev.fecha < hoy) return 'Finalizado';
  if (ev.fecha === hoy) return 'Hoy';
  return 'Próximo';
}

export function metricasEvento(ev, hoy = fechaLocal()) {
  const confirmados = Number(ev.confirmados || 0);
  const disponibles = Math.max(ev.capacidad - confirmados, 0);
  const ocupacion = ev.capacidad ? Math.round((confirmados / ev.capacidad) * 100) : 0;
  const costoPorPersona = confirmados ? ev.presupuesto / confirmados : ev.presupuesto;
  const tasaAsistencia = confirmados ? Math.round((Number(ev.asistentes || 0) / confirmados) * 100) : 0;
  const temporal = estadoTemporal(ev, hoy);
  return { confirmados, disponibles, ocupacion, costoPorPersona, tasaAsistencia, temporal, lleno: disponibles === 0 };
}

export function indicadores(db, hoy = fechaLocal()) {
  const proximos = db.get("SELECT COUNT(*) AS n FROM eventos WHERE fecha >= ? AND estado <> 'Cancelado'", [hoy]).n;
  const inscritos = db.get(
    "SELECT COUNT(*) AS n FROM inscripciones i JOIN eventos e ON e.id = i.evento_id WHERE i.estado = 'Confirmado' AND e.fecha >= ? AND e.estado <> 'Cancelado'", [hoy]).n;
  const presupuesto = db.get("SELECT COALESCE(SUM(presupuesto),0) AS s FROM eventos WHERE fecha >= ? AND estado <> 'Cancelado'", [hoy]).s;
  const pasados = db.get(
    `SELECT COALESCE(SUM(confirmados),0) AS c, COALESCE(SUM(asistentes),0) AS a
       FROM v_eventos_resumen WHERE fecha < ? AND estado <> 'Cancelado'`, [hoy]);
  const asistencia = pasados.c ? Math.round((pasados.a / pasados.c) * 100) : 0;
  return { proximos, inscritos, presupuesto, asistencia };
}

// ---------------------------------------------------------------- Inscripciones
function eventoAbierto(ev, hoy) {
  if (!ev) throw new ReglaError('El evento no existe');
  if (ev.estado === 'Cancelado') throw new ReglaError('No se puede inscribir a un evento cancelado');
  if (ev.fecha < hoy) throw new ReglaError('El evento ya terminó; no admite inscripciones');
}

export function inscribir(db, usuario, eventoId, participanteId, hoy = fechaLocal()) {
  exigir(usuario, 'inscripcion.gestionar');
  const ev = db.get('SELECT * FROM v_eventos_resumen WHERE id = ?', [eventoId]);
  eventoAbierto(ev, hoy);
  const p = db.get('SELECT * FROM participantes WHERE id = ?', [participanteId]);
  if (!p) throw new ReglaError('Selecciona un participante');

  const previa = db.get('SELECT * FROM inscripciones WHERE evento_id = ? AND participante_id = ?', [eventoId, participanteId]);
  if (previa && previa.estado !== 'Cancelado') throw new ReglaError(`${p.nombre} ya está inscrito en este evento`);

  // Cálculo automático: si hay cupo queda Confirmado; si no, pasa a Lista de espera.
  const estado = ev.confirmados < ev.capacidad ? 'Confirmado' : 'Lista de espera';
  db.transaction(() => {
    if (previa) {
      db.run("UPDATE inscripciones SET estado = ?, asistio = 0, fecha_registro = datetime('now','localtime') WHERE id = ?", [estado, previa.id]);
    } else {
      db.run('INSERT INTO inscripciones (evento_id, participante_id, estado) VALUES (?,?,?)', [eventoId, participanteId, estado]);
    }
    registrarBitacora(db, usuario, 'Inscribir', 'evento', eventoId, `${p.nombre} → ${estado}`);
  });
  return estado;
}

function promoverListaEspera(db, usuario, eventoId) {
  const promovidos = [];
  for (;;) {
    const ev = db.get('SELECT capacidad, confirmados FROM v_eventos_resumen WHERE id = ?', [eventoId]);
    if (!ev || ev.confirmados >= ev.capacidad) break;
    const sig = db.get(
      `SELECT i.id, p.nombre FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
        WHERE i.evento_id = ? AND i.estado = 'Lista de espera' ORDER BY i.fecha_registro, i.id LIMIT 1`, [eventoId]);
    if (!sig) break;
    db.run("UPDATE inscripciones SET estado = 'Confirmado' WHERE id = ?", [sig.id]);
    registrarBitacora(db, usuario, 'Promover', 'evento', eventoId, `${sig.nombre} pasó de lista de espera a confirmado`);
    promovidos.push(sig.nombre);
  }
  return promovidos;
}

export function cancelarInscripcion(db, usuario, inscripcionId, hoy = fechaLocal()) {
  exigir(usuario, 'inscripcion.gestionar');
  const i = db.get(`SELECT i.*, p.nombre, e.fecha FROM inscripciones i
      JOIN participantes p ON p.id = i.participante_id JOIN eventos e ON e.id = i.evento_id WHERE i.id = ?`, [inscripcionId]);
  if (!i) throw new ReglaError('La inscripción no existe');
  if (i.estado === 'Cancelado') throw new ReglaError('La inscripción ya estaba cancelada');
  if (i.fecha < hoy) throw new ReglaError('No se pueden cancelar inscripciones de eventos pasados');
  return db.transaction(() => {
    db.run("UPDATE inscripciones SET estado = 'Cancelado', asistio = 0 WHERE id = ?", [inscripcionId]);
    registrarBitacora(db, usuario, 'Cancelar inscripción', 'evento', i.evento_id, i.nombre);
    // Regla automática: el primero en lista de espera ocupa el lugar liberado.
    return promoverListaEspera(db, usuario, i.evento_id);
  });
}

export function registrarAsistencia(db, usuario, inscripcionId, asistio, hoy = fechaLocal()) {
  exigir(usuario, 'asistencia.registrar');
  const i = db.get(`SELECT i.*, e.fecha, e.estado AS estado_evento, p.nombre FROM inscripciones i
      JOIN eventos e ON e.id = i.evento_id JOIN participantes p ON p.id = i.participante_id WHERE i.id = ?`, [inscripcionId]);
  if (!i) throw new ReglaError('La inscripción no existe');
  if (i.estado !== 'Confirmado') throw new ReglaError('Solo se registra asistencia de participantes confirmados');
  if (i.estado_evento === 'Cancelado') throw new ReglaError('El evento está cancelado');
  if (i.fecha > hoy) throw new ReglaError('La asistencia se registra el día del evento o después');
  db.transaction(() => {
    db.run('UPDATE inscripciones SET asistio = ? WHERE id = ?', [asistio ? 1 : 0, inscripcionId]);
    registrarBitacora(db, usuario, asistio ? 'Check-in' : 'Quitar check-in', 'evento', i.evento_id, i.nombre);
  });
}

// ---------------------------------------------------------------- Participantes
export function guardarParticipante(db, usuario, d, id = null) {
  exigir(usuario, 'participante.gestionar');
  const e = {};
  const nombre = texto(d.nombre);
  const email = texto(d.email).toLowerCase();
  const telefono = texto(d.telefono).replace(/[\s-]/g, '');
  if (nombre.length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres';
  if (!emailValido(email)) e.email = 'Escribe un correo válido (ej. nombre@empresa.com)';
  else if (db.get('SELECT id FROM participantes WHERE email = ? AND id <> ?', [email, id ?? -1])) e.email = 'Ya existe un participante con ese correo';
  if (telefono && !/^\d{10}$/.test(telefono)) e.telefono = 'El teléfono debe tener 10 dígitos';
  if (Object.keys(e).length) throw new ReglaError('Revisa los campos marcados', e);

  const vals = [nombre, email, texto(d.empresa) || 'Global Consulting Services', texto(d.area), telefono];
  return db.transaction(() => {
    if (id) {
      db.run('UPDATE participantes SET nombre=?, email=?, empresa=?, area=?, telefono=? WHERE id=?', [...vals, id]);
      registrarBitacora(db, usuario, 'Editar', 'participante', id, nombre);
      return id;
    }
    const { lastId } = db.run('INSERT INTO participantes (nombre, email, empresa, area, telefono) VALUES (?,?,?,?,?)', vals);
    registrarBitacora(db, usuario, 'Crear', 'participante', lastId, nombre);
    return lastId;
  });
}

export function eliminarParticipante(db, usuario, id, hoy = fechaLocal()) {
  exigir(usuario, 'participante.eliminar');
  const p = db.get('SELECT * FROM participantes WHERE id = ?', [id]);
  if (!p) throw new ReglaError('El participante no existe');
  const futuras = db.get(`SELECT COUNT(*) AS n FROM inscripciones i JOIN eventos e ON e.id = i.evento_id
      WHERE i.participante_id = ? AND i.estado <> 'Cancelado' AND e.fecha >= ? AND e.estado <> 'Cancelado'`, [id, hoy]).n;
  if (futuras) throw new ReglaError(`${p.nombre} tiene ${futuras} inscripción(es) a eventos próximos; cancélalas primero`);
  db.transaction(() => {
    db.run('DELETE FROM participantes WHERE id = ?', [id]);
    registrarBitacora(db, usuario, 'Eliminar', 'participante', id, p.nombre);
  });
}

// ---------------------------------------------------------------- Sedes
export function guardarSede(db, usuario, d, id = null) {
  exigir(usuario, 'sede.gestionar');
  const e = {};
  const nombre = texto(d.nombre);
  const capacidad = Number(d.capacidad);
  if (nombre.length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres';
  else if (db.get('SELECT id FROM sedes WHERE nombre = ? AND id <> ?', [nombre, id ?? -1])) e.nombre = 'Ya existe una sede con ese nombre';
  if (texto(d.direccion).length < 3) e.direccion = 'Indica la dirección';
  if (!Number.isInteger(capacidad) || capacidad <= 0) e.capacidad = 'La capacidad debe ser un entero mayor a 0';
  else if (id) {
    const max = db.get("SELECT MAX(capacidad) AS m FROM eventos WHERE sede_id = ? AND estado <> 'Cancelado'", [id]).m;
    if (max && capacidad < max) e.capacidad = `Hay eventos con capacidad de ${max}; no puede ser menor`;
  }
  if (Object.keys(e).length) throw new ReglaError('Revisa los campos marcados', e);
  return db.transaction(() => {
    if (id) {
      db.run('UPDATE sedes SET nombre=?, direccion=?, capacidad=? WHERE id=?', [nombre, texto(d.direccion), capacidad, id]);
      registrarBitacora(db, usuario, 'Editar', 'sede', id, nombre);
      return id;
    }
    const { lastId } = db.run('INSERT INTO sedes (nombre, direccion, capacidad) VALUES (?,?,?)', [nombre, texto(d.direccion), capacidad]);
    registrarBitacora(db, usuario, 'Crear', 'sede', lastId, nombre);
    return lastId;
  });
}

// ---------------------------------------------------------------- Usuarios
export async function crearUsuario(db, usuario, d) {
  exigir(usuario, 'usuario.gestionar');
  const e = {};
  const email = texto(d.email).toLowerCase();
  if (texto(d.nombre).length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres';
  if (!emailValido(email)) e.email = 'Escribe un correo válido';
  else if (db.get('SELECT id FROM usuarios WHERE email = ?', [email])) e.email = 'Ya existe un usuario con ese correo';
  if (!ROLES.includes(d.rol)) e.rol = 'Selecciona un rol';
  const errPw = validarPassword(d.password);
  if (errPw) e.password = errPw;
  if (Object.keys(e).length) throw new ReglaError('Revisa los campos marcados', e);

  const salt = randomSalt();
  const hash = await hashPassword(d.password, salt);
  return db.transaction(() => {
    const { lastId } = db.run('INSERT INTO usuarios (nombre, email, rol, password_hash, salt) VALUES (?,?,?,?,?)',
      [texto(d.nombre), email, d.rol, hash, salt]);
    registrarBitacora(db, usuario, 'Crear', 'usuario', lastId, `${email} (${d.rol})`);
    return lastId;
  });
}

export function cambiarEstadoUsuario(db, usuario, id, activo) {
  exigir(usuario, 'usuario.gestionar');
  if (id === usuario.id) throw new ReglaError('No puedes desactivar tu propio usuario');
  db.transaction(() => {
    db.run('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
    registrarBitacora(db, usuario, activo ? 'Activar' : 'Desactivar', 'usuario', id);
  });
}

// ---------------------------------------------------------------- Exportación
export function aCSV(filas, columnas) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const encabezado = columnas.map(c => esc(c.titulo)).join(',');
  const cuerpo = filas.map(f => columnas.map(c => esc(f[c.campo])).join(','));
  return '﻿' + [encabezado, ...cuerpo].join('\r\n');
}
