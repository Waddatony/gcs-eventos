// Sub-microflujos reutilizables (equivalente a los sub-microflows de Mendix).
// Cada uno hace UNA cosa y lo llaman varios microflujos de rules.js y microflujos.js:
//
//   SUB_ValidarPermiso        → exigir()                  usado por todos los microflujos
//   SUB_RegistrarBitacora     → registrarBitacora()       usado por todos los microflujos
//   SUB_Notificar             → notificar()               inscripción, lista de espera, tareas, cancelación, comunicados
//   SUB_DestinatariosSegmento → destinatariosPorSegmento() comunicados, evento modificado, evento cancelado
//   SUB_ValidarTexto          → validarTexto()            tareas, comunicados, mensajes del portal

export class ReglaError extends Error {
  constructor(mensaje, errores = {}) {
    super(mensaje);
    this.name = 'ReglaError';
    this.errores = errores; // { campo: 'mensaje' } para pintarlos junto a cada campo
  }
}

// ---------------------------------------------------------------- SUB_ValidarPermiso
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
  'tarea.gestionar':        ['Administrador', 'Organizador'],
  'tarea.actualizar':       ['Administrador', 'Organizador', 'Colaborador'],
  'comunicado.enviar':      ['Administrador', 'Organizador'],
  'mensajes.ver':           ['Administrador', 'Organizador', 'Colaborador'],
};

export function puede(usuario, accion, evento = null) {
  if (!usuario || !PERMISOS[accion]?.includes(usuario.rol)) return false;
  if (evento && usuario.rol === 'Organizador' && (accion === 'evento.editar' || accion === 'evento.eliminar')) {
    return evento.organizador_id === usuario.id;
  }
  return true;
}

export function exigir(usuario, accion, evento = null) {
  if (!puede(usuario, accion, evento)) throw new ReglaError('No tienes permiso para realizar esta acción');
}

// ---------------------------------------------------------------- SUB_RegistrarBitacora
export function registrarBitacora(db, usuario, accion, entidad, entidadId = null, detalle = '') {
  db.run('INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?)',
    [usuario?.id ?? null, accion, entidad, entidadId, detalle]);
}

// ---------------------------------------------------------------- SUB_ValidarTexto
export function validarTexto(errores, campo, valor, { min = 1, max = 10000, nombre = 'El campo' } = {}) {
  const t = String(valor ?? '').trim();
  if (t.length < min) errores[campo] = `${nombre} debe tener al menos ${min} caracteres`;
  else if (t.length > max) errores[campo] = `${nombre} no puede pasar de ${max} caracteres`;
  return t;
}

// ---------------------------------------------------------------- SUB_Notificar
// Crea una notificación por destinatario. Devuelve cuántas se crearon.
export function notificar(db, participanteIds, { tipo, titulo, texto = '', eventoId = null, tareaId = null, mensajeId = null }) {
  const ids = [...new Set(participanteIds.filter(Boolean).map(Number))];
  for (const pid of ids) {
    db.run(`INSERT INTO notificaciones (participante_id, evento_id, tarea_id, mensaje_id, tipo, titulo, texto)
            VALUES (?,?,?,?,?,?,?)`, [pid, eventoId, tareaId, mensajeId, tipo, titulo, texto]);
  }
  return ids.length;
}

// ---------------------------------------------------------------- SUB_DestinatariosSegmento
export const SEGMENTOS = ['Todos', 'Confirmados', 'Lista de espera', 'Con tareas pendientes'];

export function destinatariosPorSegmento(db, eventoId, segmento = 'Todos') {
  const consultas = {
    'Todos': `SELECT participante_id AS id FROM inscripciones WHERE evento_id = ? AND estado <> 'Cancelado'`,
    'Confirmados': `SELECT participante_id AS id FROM inscripciones WHERE evento_id = ? AND estado = 'Confirmado'`,
    'Lista de espera': `SELECT participante_id AS id FROM inscripciones WHERE evento_id = ? AND estado = 'Lista de espera'`,
    'Con tareas pendientes': `SELECT DISTINCT responsable_id AS id FROM tareas
                               WHERE evento_id = ? AND responsable_id IS NOT NULL AND estado <> 'Completada'`,
  };
  const sql = consultas[segmento];
  if (!sql) throw new ReglaError('Segmento de destinatarios no válido');
  return db.all(sql, [eventoId]).map(r => r.id);
}
