// Microflujos de la Actividad 4: tareas, seguimiento de progreso, comunicación y portal del asistente.
// Cada microflujo sigue el mismo esquema que en Mendix:
//   1) SUB_ValidarPermiso  2) validaciones  3) cambio de datos en una transacción
//   4) SUB_RegistrarBitacora  5) SUB_Notificar a los asistentes que corresponda
// Los sub-microflujos reutilizables están en subflujos.js.

import { fechaLocal } from './db.js';
import { randomSalt } from './security.js';
import {
  ReglaError, puede, exigir, registrarBitacora, notificar, destinatariosPorSegmento, validarTexto, SEGMENTOS,
} from './subflujos.js';
import { inscribirSinPermiso, emailValido, metricasEvento } from './rules.js';

export { SEGMENTOS };
export const PRIORIDADES = ['Alta', 'Media', 'Baja'];
export const ESTADOS_TAREA = ['Pendiente', 'En progreso', 'Completada'];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ================================================================ Tareas

// Sub-microflujo: el evento admite cambios en sus tareas y comunicación
function eventoActivo(db, eventoId, hoy) {
  const ev = db.get('SELECT * FROM v_eventos_resumen WHERE id = ?', [Number(eventoId)]);
  if (!ev) throw new ReglaError('El evento no existe');
  if (ev.estado === 'Cancelado') throw new ReglaError('El evento está cancelado');
  if (ev.fecha < hoy) throw new ReglaError('El evento ya terminó');
  return ev;
}

function exigirGestionTareas(usuario, ev) {
  exigir(usuario, 'tarea.gestionar');
  if (!puede(usuario, 'evento.editar', ev)) throw new ReglaError('Solo el organizador del evento puede gestionar sus tareas');
}

// Avance y estado siempre coherentes: 0 % = Pendiente, 1–99 % = En progreso, 100 % = Completada
export function normalizarProgreso({ estado, avance }) {
  let a = avance === '' || avance == null ? null : Math.round(Number(avance));
  if (a != null && (Number.isNaN(a) || a < 0 || a > 100)) {
    throw new ReglaError('El avance debe estar entre 0 y 100', { avance: 'Entre 0 y 100' });
  }
  if (estado && !ESTADOS_TAREA.includes(estado)) throw new ReglaError('Estado de tarea no válido');
  if (estado === 'Completada') a = 100;
  else if (estado === 'Pendiente') a = 0;
  else if (estado === 'En progreso') a = a == null || a === 0 ? 10 : Math.min(a, 99);
  a ??= 0;
  return { estado: a === 100 ? 'Completada' : a === 0 ? 'Pendiente' : 'En progreso', avance: a };
}

export function validarTarea(db, d, { id = null, hoy = fechaLocal() } = {}) {
  const e = {};
  validarTexto(e, 'titulo', d.titulo, { min: 3, max: 120, nombre: 'El título' });
  if (!PRIORIDADES.includes(d.prioridad)) e.prioridad = 'Selecciona la prioridad';
  const ev = db.get('SELECT * FROM eventos WHERE id = ?', [Number(d.evento_id)]);
  if (!ev) e.evento_id = 'Selecciona el evento';
  const anterior = id ? db.get('SELECT * FROM tareas WHERE id = ?', [id]) : null;
  if (!FECHA.test(d.fecha_limite || '')) e.fecha_limite = 'Indica la fecha límite';
  else if (d.fecha_limite < hoy && (!anterior || anterior.fecha_limite !== d.fecha_limite)) e.fecha_limite = 'La fecha límite no puede ser anterior a hoy';
  else if (ev && d.fecha_limite > ev.fecha) e.fecha_limite = `Debe quedar lista antes del evento (${ev.fecha})`;
  if (d.responsable_id) {
    const ok = db.get(`SELECT 1 AS ok FROM inscripciones WHERE evento_id = ? AND participante_id = ? AND estado = 'Confirmado'`,
      [Number(d.evento_id), Number(d.responsable_id)]);
    if (!ok) e.responsable_id = 'El responsable debe ser un asistente confirmado del evento';
  }
  return e;
}

// MF_AsignarTarea (crear o editar)
export function guardarTarea(db, usuario, d, { id = null, hoy = fechaLocal() } = {}) {
  const anterior = id ? db.get('SELECT * FROM tareas WHERE id = ?', [id]) : null;
  if (id && !anterior) throw new ReglaError('La tarea no existe');
  const eventoId = Number(anterior?.evento_id ?? d.evento_id);
  const ev = eventoActivo(db, eventoId, hoy);
  exigirGestionTareas(usuario, ev);

  const datos = { ...d, evento_id: eventoId };
  const errores = validarTarea(db, datos, { id, hoy });
  if (Object.keys(errores).length) throw new ReglaError('Revisa los campos marcados', errores);

  const responsable = d.responsable_id ? Number(d.responsable_id) : null;
  const titulo = String(d.titulo).trim();
  return db.transaction(() => {
    let tareaId = id;
    if (id) {
      db.run(`UPDATE tareas SET titulo=?, descripcion=?, responsable_id=?, prioridad=?, fecha_limite=?,
              actualizado_en=datetime('now','localtime') WHERE id=?`,
        [titulo, String(d.descripcion ?? '').trim(), responsable, d.prioridad, d.fecha_limite, id]);
      registrarBitacora(db, usuario, 'Editar', 'tarea', id, titulo);
    } else {
      tareaId = db.run(`INSERT INTO tareas (evento_id, titulo, descripcion, responsable_id, prioridad, fecha_limite, creado_por)
              VALUES (?,?,?,?,?,?,?)`,
        [eventoId, titulo, String(d.descripcion ?? '').trim(), responsable, d.prioridad, d.fecha_limite, usuario.id]).lastId;
      registrarBitacora(db, usuario, 'Asignar', 'tarea', tareaId, titulo);
    }
    if (responsable && responsable !== anterior?.responsable_id) {
      notificar(db, [responsable], {
        tipo: anterior ? 'Tarea reasignada' : 'Tarea asignada', eventoId, tareaId,
        titulo: `Nueva tarea: ${titulo}`,
        texto: `Evento "${ev.titulo}" · prioridad ${d.prioridad} · fecha límite ${d.fecha_limite}.`,
      });
    }
    return tareaId;
  });
}

export function eliminarTarea(db, usuario, id) {
  const t = db.get('SELECT * FROM tareas WHERE id = ?', [id]);
  if (!t) throw new ReglaError('La tarea no existe');
  const ev = db.get('SELECT * FROM eventos WHERE id = ?', [t.evento_id]);
  exigirGestionTareas(usuario, ev);
  if (t.estado === 'Completada') throw new ReglaError('Una tarea completada no se elimina: forma parte del historial');
  db.transaction(() => {
    db.run('DELETE FROM tareas WHERE id = ?', [id]);
    registrarBitacora(db, usuario, 'Eliminar', 'tarea', id, t.titulo);
  });
}

// MF_ActualizarProgresoTarea — lo usan el personal de GCS y el asistente desde su portal.
// actor = { usuario } o { participanteId }
export function actualizarProgreso(db, actor, tareaId, cambio, hoy = fechaLocal()) {
  const t = db.get('SELECT t.*, e.estado AS estado_evento, e.titulo AS evento FROM tareas t JOIN eventos e ON e.id = t.evento_id WHERE t.id = ?', [tareaId]);
  if (!t) throw new ReglaError('La tarea no existe');
  if (actor.usuario) exigir(actor.usuario, 'tarea.actualizar');
  else if (!actor.participanteId || actor.participanteId !== t.responsable_id) {
    throw new ReglaError('Solo el responsable puede actualizar esta tarea');
  }
  if (t.estado_evento === 'Cancelado') throw new ReglaError('El evento está cancelado');
  const { estado, avance } = normalizarProgreso(cambio);
  if (estado === t.estado && avance === t.avance) return { estado, avance };
  db.transaction(() => {
    db.run(`UPDATE tareas SET estado = ?, avance = ?, actualizado_en = datetime('now','localtime'),
            completada_en = CASE WHEN ? = 'Completada' THEN datetime('now','localtime') ELSE NULL END WHERE id = ?`,
      [estado, avance, estado, tareaId]);
    const quien = actor.usuario ?? null;
    const detalle = `${t.titulo}: ${avance}% (${estado})${actor.participanteId ? ' · desde el portal del asistente' : ''}`;
    registrarBitacora(db, quien, 'Avance', 'tarea', tareaId, detalle);
  });
  return { estado, avance };
}

// Consulta reutilizable: tareas con su responsable, evento y bandera de vencida
export function listarTareas(db, { eventoId = null, responsableId = null, estado = '', soloVencidas = false, organizadorId = null } = {}, hoy = fechaLocal()) {
  const c = []; const p = [hoy];
  if (eventoId) { c.push('t.evento_id = ?'); p.push(Number(eventoId)); }
  if (responsableId === 'sin') c.push('t.responsable_id IS NULL');
  else if (responsableId) { c.push('t.responsable_id = ?'); p.push(Number(responsableId)); }
  if (estado) { c.push('t.estado = ?'); p.push(estado); }
  if (organizadorId) { c.push('e.organizador_id = ?'); p.push(organizadorId); }
  if (soloVencidas) c.push("t.estado <> 'Completada' AND t.fecha_limite < ?"), p.push(hoy);
  return db.all(`SELECT t.*, e.titulo AS evento, e.fecha AS fecha_evento, e.estado AS estado_evento, pa.nombre AS responsable,
      (t.estado <> 'Completada' AND t.fecha_limite < ?) AS vencida
    FROM tareas t JOIN eventos e ON e.id = t.evento_id LEFT JOIN participantes pa ON pa.id = t.responsable_id
    ${c.length ? 'WHERE ' + c.join(' AND ') : ''}
    ORDER BY (t.estado = 'Completada'), t.fecha_limite, CASE t.prioridad WHEN 'Alta' THEN 0 WHEN 'Media' THEN 1 ELSE 2 END, t.id`, p);
}

// Seguimiento de progreso (cálculos automáticos)
export function resumenTareas(tareas) {
  const total = tareas.length;
  const completadas = tareas.filter(t => t.estado === 'Completada').length;
  const enProgreso = tareas.filter(t => t.estado === 'En progreso').length;
  const pendientes = tareas.filter(t => t.estado === 'Pendiente').length;
  const vencidas = tareas.filter(t => t.vencida).length;
  const sinAsignar = tareas.filter(t => !t.responsable_id && t.estado !== 'Completada').length;
  const avance = total ? Math.round(tareas.reduce((s, t) => s + t.avance, 0) / total) : 0;
  return { total, completadas, enProgreso, pendientes, vencidas, sinAsignar, avance };
}

// ================================================================ Comunicación

// MF_EnviarComunicado
export function enviarComunicado(db, usuario, eventoId, d, hoy = fechaLocal()) {
  const ev = db.get('SELECT * FROM eventos WHERE id = ?', [Number(eventoId)]);
  if (!ev) throw new ReglaError('El evento no existe');
  exigir(usuario, 'comunicado.enviar');
  if (!puede(usuario, 'evento.editar', ev)) throw new ReglaError('Solo el organizador del evento puede enviar comunicados');
  if (ev.fecha < hoy) throw new ReglaError('El evento ya terminó');
  const e = {};
  const asunto = validarTexto(e, 'asunto', d.asunto, { min: 3, max: 120, nombre: 'El asunto' });
  const cuerpo = validarTexto(e, 'cuerpo', d.cuerpo, { min: 5, max: 2000, nombre: 'El mensaje' });
  if (!SEGMENTOS.includes(d.segmento)) e.segmento = 'Selecciona a quién va dirigido';
  if (Object.keys(e).length) throw new ReglaError('Revisa los campos marcados', e);
  const ids = destinatariosPorSegmento(db, ev.id, d.segmento);
  if (!ids.length) throw new ReglaError(`No hay asistentes en el grupo "${d.segmento}"`, { segmento: 'Este grupo está vacío' });
  return db.transaction(() => {
    const { lastId } = db.run(`INSERT INTO mensajes (evento_id, direccion, autor_usuario_id, segmento, asunto, cuerpo, destinatarios, leido)
        VALUES (?, 'Organizador a asistentes', ?, ?, ?, ?, ?, 1)`, [ev.id, usuario.id, d.segmento, asunto, cuerpo, ids.length]);
    const n = notificar(db, ids, { tipo: 'Comunicado', eventoId: ev.id, mensajeId: lastId, titulo: asunto, texto: cuerpo });
    registrarBitacora(db, usuario, 'Comunicado', 'evento', ev.id, `"${asunto}" a ${n} asistente(s) (${d.segmento})`);
    return n;
  });
}

export function marcarMensajeLeido(db, usuario, mensajeId) {
  exigir(usuario, 'mensajes.ver');
  db.run('UPDATE mensajes SET leido = 1 WHERE id = ?', [mensajeId]);
}

export function correosDeSegmento(db, eventoId, segmento) {
  const ids = destinatariosPorSegmento(db, eventoId, segmento);
  if (!ids.length) return [];
  return db.all(`SELECT email FROM participantes WHERE id IN (${ids.map(() => '?').join(',')})`, ids).map(r => r.email);
}

// ================================================================ Portal del asistente

// MF_ObtenerEnlacePortal: crea (una sola vez) el token personal del asistente
export function obtenerAccesoPortal(db, usuario, participanteId) {
  exigir(usuario, 'participante.gestionar');
  const p = db.get('SELECT id, nombre FROM participantes WHERE id = ?', [participanteId]);
  if (!p) throw new ReglaError('El participante no existe');
  const actual = db.get('SELECT token FROM accesos_portal WHERE participante_id = ?', [participanteId]);
  if (actual) return actual.token;
  const token = randomSalt(12);
  db.run('INSERT INTO accesos_portal (participante_id, token) VALUES (?,?)', [participanteId, token]);
  registrarBitacora(db, usuario, 'Generar enlace de portal', 'participante', participanteId, p.nombre);
  return token;
}

export function participantePorToken(db, token) {
  if (!/^[0-9a-f]{24}$/.test(String(token || ''))) throw new ReglaError('El enlace no es válido');
  const p = db.get(`SELECT p.* FROM accesos_portal a JOIN participantes p ON p.id = a.participante_id WHERE a.token = ?`, [token]);
  if (!p) throw new ReglaError('El enlace no es válido o ya no existe');
  return p;
}

export function datosPortal(db, token, hoy = fechaLocal()) {
  const p = participantePorToken(db, token);
  const eventos = db.all(`SELECT v.*, i.estado AS mi_estado, i.asistio FROM inscripciones i JOIN v_eventos_resumen v ON v.id = i.evento_id
      WHERE i.participante_id = ? AND i.estado <> 'Cancelado' ORDER BY v.fecha`, [p.id]);
  const tareas = listarTareas(db, { responsableId: p.id }, hoy);
  const avisos = db.all('SELECT n.*, e.titulo AS evento FROM notificaciones n LEFT JOIN eventos e ON e.id = n.evento_id WHERE n.participante_id = ? ORDER BY n.id DESC', [p.id]);
  const mensajes = db.all(`SELECT m.*, e.titulo AS evento FROM mensajes m JOIN eventos e ON e.id = m.evento_id
      WHERE m.direccion = 'Asistente a organizador' AND m.autor_participante_id = ? ORDER BY m.id DESC`, [p.id]);
  return { participante: p, eventos, tareas, avisos, mensajes, noLeidos: avisos.filter(a => !a.leida).length };
}

// MF_EnviarMensajeAlOrganizador (desde el portal)
export function mensajeDeAsistente(db, token, eventoId, d, hoy = fechaLocal()) {
  const p = participantePorToken(db, token);
  const insc = db.get(`SELECT e.* FROM inscripciones i JOIN eventos e ON e.id = i.evento_id
      WHERE i.evento_id = ? AND i.participante_id = ? AND i.estado <> 'Cancelado'`, [Number(eventoId), p.id]);
  const e = {};
  if (!insc) e.evento_id = 'Elige uno de tus eventos';
  const asunto = validarTexto(e, 'asunto', d.asunto, { min: 3, max: 120, nombre: 'El asunto' });
  const cuerpo = validarTexto(e, 'cuerpo', d.cuerpo, { min: 5, max: 2000, nombre: 'El mensaje' });
  if (Object.keys(e).length) throw new ReglaError('Revisa los campos marcados', e);
  if (insc.estado === 'Cancelado' || insc.fecha < hoy) throw new ReglaError('Ese evento ya no recibe mensajes');
  return db.transaction(() => {
    const { lastId } = db.run(`INSERT INTO mensajes (evento_id, direccion, autor_participante_id, segmento, asunto, cuerpo, destinatarios)
        VALUES (?, 'Asistente a organizador', ?, 'Organizador', ?, ?, 1)`, [insc.id, p.id, asunto, cuerpo]);
    registrarBitacora(db, null, 'Mensaje de asistente', 'evento', insc.id, `${p.nombre}: ${asunto}`);
    return lastId;
  });
}

export function marcarAvisosLeidos(db, token, avisoId = null) {
  const p = participantePorToken(db, token);
  if (avisoId) db.run('UPDATE notificaciones SET leida = 1 WHERE id = ? AND participante_id = ?', [avisoId, p.id]);
  else db.run('UPDATE notificaciones SET leida = 1 WHERE participante_id = ?', [p.id]);
}

// ================================================================ Auto-registro (página pública del evento)

export function validarDatosAsistente(db, d, id = null) {
  const e = {};
  const nombre = validarTexto(e, 'nombre', d.nombre, { min: 3, max: 100, nombre: 'El nombre' });
  const email = String(d.email ?? '').trim().toLowerCase();
  const telefono = String(d.telefono ?? '').replace(/[\s-]/g, '');
  if (!emailValido(email)) e.email = 'Escribe un correo válido (ej. nombre@empresa.com)';
  else if (id !== 'auto' && db.get('SELECT id FROM participantes WHERE email = ? AND id <> ?', [email, id ?? -1])) e.email = 'Ya existe un participante con ese correo';
  if (telefono && !/^\d{10}$/.test(telefono)) e.telefono = 'El teléfono debe tener 10 dígitos';
  return { errores: e, datos: { nombre, email, telefono, empresa: String(d.empresa ?? '').trim() || 'Global Consulting Services', area: String(d.area ?? '').trim() } };
}

// MF_AutoRegistro: el asistente se registra solo; reutiliza la validación del formulario
// de asistentes y el núcleo del microflujo de inscripción (inscribirSinPermiso).
export function autoRegistro(db, eventoId, d, hoy = fechaLocal()) {
  const ev = eventoActivo(db, eventoId, hoy);
  const { errores, datos } = validarDatosAsistente(db, d, 'auto');
  if (!d.acepta) errores.acepta = 'Debes aceptar el aviso de privacidad';
  if (Object.keys(errores).length) {
    // Se reportan todos los errores a la vez para que la persona los corrija en un solo paso
    throw new ReglaError(Object.keys(errores).length === 1 && errores.acepta ? 'Debes aceptar el aviso de privacidad' : 'Revisa los campos marcados', errores);
  }
  return db.transaction(() => {
    let p = db.get('SELECT * FROM participantes WHERE email = ?', [datos.email]);
    if (!p) {
      const { lastId } = db.run('INSERT INTO participantes (nombre, email, empresa, area, telefono) VALUES (?,?,?,?,?)',
        [datos.nombre, datos.email, datos.empresa, datos.area, datos.telefono]);
      p = { id: lastId, nombre: datos.nombre };
      registrarBitacora(db, null, 'Auto-registro', 'participante', lastId, datos.nombre);
    }
    const estado = inscribirSinPermiso(db, null, ev.id, p.id, hoy);
    let acceso = db.get('SELECT token FROM accesos_portal WHERE participante_id = ?', [p.id]);
    if (!acceso) {
      acceso = { token: randomSalt(12) };
      db.run('INSERT INTO accesos_portal (participante_id, token) VALUES (?,?)', [p.id, acceso.token]);
    }
    return { estado, token: acceso.token, nombre: p.nombre, evento: ev.titulo, lugares: metricasEvento(ev, hoy).disponibles };
  });
}
