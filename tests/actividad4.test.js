// Pruebas de los microflujos de la Actividad 4 (tareas, progreso, comunicación, portal, auto-registro).
// Cada prueba lleva el ID que aparece en docs/reporte-pruebas.md. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { crearBaseDeDatos, sembrarDatos, sembrarActividad4, sumarDias } from '../js/db.js';
import * as R from '../js/rules.js';
import * as M from '../js/microflujos.js';

const HOY = '2026-11-11';
const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');
const SQL = await initSqlJs();
async function nuevaBD() {
  const db = crearBaseDeDatos(SQL, schema);
  await sembrarDatos(db, HOY);
  await sembrarActividad4(db, HOY);
  return db;
}
const admin = { id: 1, rol: 'Administrador' };
const org = { id: 2, rol: 'Organizador' };
const colab = { id: 3, rol: 'Colaborador' };
const tarea = (extra = {}) => ({ evento_id: 1, titulo: 'Reservar transporte', descripcion: '', responsable_id: 2,
  prioridad: 'Alta', fecha_limite: sumarDias(HOY, 3), ...extra });
const avisos = (db, pid, tipo) => db.all('SELECT * FROM notificaciones WHERE participante_id = ? AND tipo = ?', [pid, tipo]);

// ------------------------------------------------------------- Tareas
test('T-01 asignar tarea a un asistente confirmado y notificarle', async () => {
  const db = await nuevaBD();
  const id = M.guardarTarea(db, org, tarea(), { hoy: HOY });
  const t = db.get('SELECT * FROM tareas WHERE id = ?', [id]);
  assert.equal(t.estado, 'Pendiente');
  assert.equal(t.avance, 0);
  assert.ok(avisos(db, 2, 'Tarea asignada').some(n => n.tarea_id === id));
});

test('T-02 tarea sin responsable queda "sin asignar" y no notifica a nadie', async () => {
  const db = await nuevaBD();
  const antes = db.get('SELECT COUNT(*) AS n FROM notificaciones').n;
  M.guardarTarea(db, org, tarea({ responsable_id: '' }), { hoy: HOY });
  assert.equal(db.get('SELECT COUNT(*) AS n FROM notificaciones').n, antes);
});

test('T-03 excepción: el responsable debe ser asistente confirmado del evento', async () => {
  const db = await nuevaBD();
  // Roberto (4) no está inscrito al Kickoff (evento 1)
  assert.throws(() => M.guardarTarea(db, org, tarea({ responsable_id: 4 }), { hoy: HOY }), e => !!e.errores.responsable_id);
});

test('T-04 excepción: fecha límite pasada o posterior al evento', async () => {
  const db = await nuevaBD();
  assert.throws(() => M.guardarTarea(db, org, tarea({ fecha_limite: sumarDias(HOY, -1) }), { hoy: HOY }), e => /anterior a hoy/.test(e.errores.fecha_limite));
  assert.throws(() => M.guardarTarea(db, org, tarea({ fecha_limite: sumarDias(HOY, 30) }), { hoy: HOY }), e => /antes del evento/.test(e.errores.fecha_limite));
});

test('T-05 excepción: título corto y prioridad faltante', async () => {
  const db = await nuevaBD();
  assert.throws(() => M.guardarTarea(db, org, tarea({ titulo: 'ab', prioridad: '' }), { hoy: HOY }), e => !!(e.errores.titulo && e.errores.prioridad));
});

test('T-06 excepción: colaborador no asigna tareas; organizador solo en sus eventos', async () => {
  const db = await nuevaBD();
  assert.throws(() => M.guardarTarea(db, colab, tarea(), { hoy: HOY }), /permiso/);
  // El evento 3 lo organiza el administrador
  assert.throws(() => M.guardarTarea(db, org, tarea({ evento_id: 3, responsable_id: 4, fecha_limite: sumarDias(HOY, 1) }), { hoy: HOY }), /organizador del evento/);
  assert.ok(M.guardarTarea(db, admin, tarea({ evento_id: 3, responsable_id: 4, fecha_limite: sumarDias(HOY, 1) }), { hoy: HOY }));
});

test('T-07 excepción: no se crean tareas en eventos cancelados o finalizados', async () => {
  const db = await nuevaBD();
  assert.throws(() => M.guardarTarea(db, admin, tarea({ evento_id: 5, responsable_id: 6 }), { hoy: HOY }), /ya terminó/);
  R.cancelarEvento(db, admin, 4);
  assert.throws(() => M.guardarTarea(db, admin, tarea({ evento_id: 4, responsable_id: 2 }), { hoy: HOY }), /cancelado/);
});

test('T-08 reasignar una tarea notifica al nuevo responsable', async () => {
  const db = await nuevaBD();
  const id = M.guardarTarea(db, org, tarea(), { hoy: HOY });
  M.guardarTarea(db, org, tarea({ responsable_id: 3 }), { id, hoy: HOY });
  assert.ok(avisos(db, 3, 'Tarea reasignada').some(n => n.tarea_id === id));
});

test('T-09 excepción: una tarea completada no se elimina', async () => {
  const db = await nuevaBD();
  const hecha = db.get("SELECT id FROM tareas WHERE estado = 'Completada' AND evento_id = 1");
  assert.throws(() => M.eliminarTarea(db, org, hecha.id), /historial/);
  const id = M.guardarTarea(db, org, tarea(), { hoy: HOY });
  M.eliminarTarea(db, org, id);
  assert.equal(db.get('SELECT id FROM tareas WHERE id = ?', [id]), null);
});

// ------------------------------------------------------------- Seguimiento de progreso
test('P-01 el avance define el estado automáticamente (0 / 1–99 / 100)', () => {
  assert.deepEqual(M.normalizarProgreso({ avance: 0 }), { estado: 'Pendiente', avance: 0 });
  assert.deepEqual(M.normalizarProgreso({ avance: 45 }), { estado: 'En progreso', avance: 45 });
  assert.deepEqual(M.normalizarProgreso({ avance: 100 }), { estado: 'Completada', avance: 100 });
  assert.deepEqual(M.normalizarProgreso({ estado: 'Completada' }), { estado: 'Completada', avance: 100 });
  assert.deepEqual(M.normalizarProgreso({ estado: 'En progreso', avance: 0 }), { estado: 'En progreso', avance: 10 });
});

test('P-02 excepción: avance fuera de 0–100 o estado inválido', () => {
  assert.throws(() => M.normalizarProgreso({ avance: 120 }), /entre 0 y 100/);
  assert.throws(() => M.normalizarProgreso({ avance: -5 }), /entre 0 y 100/);
  assert.throws(() => M.normalizarProgreso({ estado: 'Lista' }), /no válido/);
});

test('P-03 completar una tarea guarda la fecha; reabrirla la borra', async () => {
  const db = await nuevaBD();
  const id = M.guardarTarea(db, org, tarea(), { hoy: HOY });
  M.actualizarProgreso(db, { usuario: colab }, id, { estado: 'Completada' }, HOY);
  assert.ok(db.get('SELECT completada_en FROM tareas WHERE id = ?', [id]).completada_en);
  M.actualizarProgreso(db, { usuario: colab }, id, { avance: 50 }, HOY);
  const t = db.get('SELECT * FROM tareas WHERE id = ?', [id]);
  assert.equal(t.estado, 'En progreso');
  assert.equal(t.completada_en, null);
});

test('P-04 la base de datos rechaza estado y avance incoherentes (CHECK)', async () => {
  const db = await nuevaBD();
  assert.throws(() => db.run("UPDATE tareas SET estado = 'Completada', avance = 50 WHERE id = 1"), /CHECK/);
});

test('P-05 resumen de progreso: total, completadas, vencidas y avance promedio', async () => {
  const db = await nuevaBD();
  const r = M.resumenTareas(M.listarTareas(db, {}, HOY));
  assert.equal(r.total, 9);
  assert.equal(r.completadas, 2);
  assert.equal(r.vencidas, 1);          // "Enviar lectura previa" venció ayer
  assert.equal(r.sinAsignar, 1);
  assert.equal(r.avance, Math.round((60 + 0 + 100 + 0 + 40 + 0 + 80 + 100 + 0) / 9));
  const vencidas = M.listarTareas(db, { soloVencidas: true }, HOY);
  assert.deepEqual(vencidas.map(t => t.titulo), ['Enviar lectura previa a los participantes']);
});

test('P-06 excepción: en el portal solo el responsable actualiza su tarea', async () => {
  const db = await nuevaBD();
  const t = db.get("SELECT * FROM tareas WHERE responsable_id = 1 AND evento_id = 3");
  assert.throws(() => M.actualizarProgreso(db, { participanteId: 2 }, t.id, { avance: 90 }, HOY), /Solo el responsable/);
  assert.deepEqual(M.actualizarProgreso(db, { participanteId: 1 }, t.id, { avance: 90 }, HOY), { estado: 'En progreso', avance: 90 });
});

test('P-07 al cancelar su inscripción, las tareas pendientes del asistente quedan sin asignar', async () => {
  const db = await nuevaBD();
  const insc = db.get('SELECT id FROM inscripciones WHERE evento_id = 1 AND participante_id = 3');
  R.cancelarInscripcion(db, org, insc.id, HOY);
  assert.equal(db.get("SELECT responsable_id FROM tareas WHERE titulo LIKE 'Confirmar catering%'").responsable_id, null);
});

// ------------------------------------------------------------- Notificaciones automáticas
test('N-01 inscripción confirmada y lista de espera generan aviso', async () => {
  const db = await nuevaBD();
  const id = R.guardarEvento(db, org, { titulo: 'Desayuno con clientes', descripcion: '', tipo: 'Evento interno', sede_id: 2,
    fecha: sumarDias(HOY, 9), hora_inicio: '08:00', hora_fin: '09:00', capacidad: 1, presupuesto: 0 }, { hoy: HOY });
  R.inscribir(db, colab, id, 4, HOY);
  R.inscribir(db, colab, id, 5, HOY);
  assert.equal(avisos(db, 4, 'Inscripción').filter(n => n.evento_id === id).length, 1);
  assert.equal(avisos(db, 5, 'Lista de espera').filter(n => n.evento_id === id).length, 1);
  // N-02: al cancelar el primero, el segundo es promovido y recibe aviso
  const insc = db.get('SELECT id FROM inscripciones WHERE evento_id = ? AND participante_id = 4', [id]);
  R.cancelarInscripcion(db, colab, insc.id, HOY);
  assert.equal(avisos(db, 5, 'Promoción').filter(n => n.evento_id === id).length, 1);
});

test('N-03 cancelar un evento avisa a todos sus inscritos', async () => {
  const db = await nuevaBD();
  const n = R.cancelarEvento(db, admin, 2);
  assert.equal(n, 3);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM notificaciones WHERE evento_id = 2 AND tipo = 'Evento cancelado'").n, 3);
  assert.throws(() => R.cancelarEvento(db, admin, 2), /ya estaba cancelado/);
});

test('N-04 cambiar fecha u hora avisa a los inscritos; cambiar solo la descripción no', async () => {
  const db = await nuevaBD();
  const ev = db.get('SELECT * FROM eventos WHERE id = 1');
  R.guardarEvento(db, org, { ...ev, descripcion: 'Nueva descripción' }, { id: 1, hoy: HOY });
  assert.equal(db.get("SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'Evento modificado'").n, 0);
  R.guardarEvento(db, org, { ...ev, hora_inicio: '10:00' }, { id: 1, hoy: HOY });
  assert.equal(db.get("SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'Evento modificado'").n, 6);
});

// ------------------------------------------------------------- Comunicados
test('C-01 enviar comunicado a un grupo crea un aviso por destinatario', async () => {
  const db = await nuevaBD();
  const n = M.enviarComunicado(db, org, 1, { segmento: 'Con tareas pendientes', asunto: 'Recordatorio de tareas', cuerpo: 'Por favor actualicen su avance.' }, HOY);
  assert.equal(n, 2);          // Jorge (60 %) y María (pendiente); la de Fernanda está completada
  assert.equal(db.get("SELECT destinatarios FROM mensajes WHERE asunto = 'Recordatorio de tareas'").destinatarios, 2);
});

test('C-02 excepción: grupo vacío, campos inválidos o sin permiso', async () => {
  const db = await nuevaBD();
  assert.throws(() => M.enviarComunicado(db, org, 1, { segmento: 'Lista de espera', asunto: 'Aviso', cuerpo: 'Texto de prueba' }, HOY), /No hay asistentes/);
  assert.throws(() => M.enviarComunicado(db, org, 1, { segmento: 'Todos', asunto: 'A', cuerpo: '' }, HOY), e => !!(e.errores.asunto && e.errores.cuerpo));
  assert.throws(() => M.enviarComunicado(db, colab, 1, { segmento: 'Todos', asunto: 'Aviso', cuerpo: 'Texto de prueba' }, HOY), /permiso/);
  assert.throws(() => M.enviarComunicado(db, admin, 5, { segmento: 'Todos', asunto: 'Aviso', cuerpo: 'Texto de prueba' }, HOY), /ya terminó/);
});

// ------------------------------------------------------------- Portal del asistente
test('A-01 el portal muestra eventos, tareas y avisos del asistente', async () => {
  const db = await nuevaBD();
  const token = M.obtenerAccesoPortal(db, colab, 1);
  assert.equal(M.obtenerAccesoPortal(db, colab, 1), token);    // el enlace no cambia
  const p = M.datosPortal(db, token, HOY);
  assert.equal(p.participante.nombre, 'Ana Torres');
  assert.equal(p.tareas.length, 2);
  assert.ok(p.noLeidos > 0);
  M.marcarAvisosLeidos(db, token);
  assert.equal(M.datosPortal(db, token, HOY).noLeidos, 0);
});

test('A-02 excepción: enlace de portal inválido', async () => {
  const db = await nuevaBD();
  assert.throws(() => M.datosPortal(db, 'abc', HOY), /no es válido/);
  assert.throws(() => M.datosPortal(db, '0'.repeat(24), HOY), /no es válido/);
});

test('A-03 el asistente escribe al organizador; excepción si no está inscrito', async () => {
  const db = await nuevaBD();
  const token = M.obtenerAccesoPortal(db, colab, 1);
  M.mensajeDeAsistente(db, token, 1, { asunto: 'Llegaré tarde', cuerpo: 'Llego a las 9:30 por una junta.' }, HOY);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM mensajes WHERE direccion = 'Asistente a organizador' AND leido = 0").n, 2);
  assert.throws(() => M.mensajeDeAsistente(db, token, 4, { asunto: 'Pregunta', cuerpo: 'Texto de prueba' }, HOY), e => !!e.errores.evento_id);
});

// ------------------------------------------------------------- Auto-registro
test('R-01 auto-registro crea al asistente, lo inscribe y le da enlace de portal', async () => {
  const db = await nuevaBD();
  const r = M.autoRegistro(db, 4, { nombre: 'Laura Pérez', email: 'laura@cliente.com', telefono: '8111111111', acepta: 'on' }, HOY);
  assert.equal(r.estado, 'Confirmado');
  assert.match(r.token, /^[0-9a-f]{24}$/);
  assert.ok(M.datosPortal(db, r.token, HOY).eventos.some(e => e.id === 4));
});

test('R-02 excepción: auto-registro duplicado, sin aviso de privacidad o con datos inválidos', async () => {
  const db = await nuevaBD();
  // Ana ya está inscrita al Kickoff: el correo existente se reutiliza y se rechaza el duplicado
  assert.throws(() => M.autoRegistro(db, 1, { nombre: 'Ana Torres', email: 'ana.torres@gcs.com', acepta: 'on' }, HOY), /ya está inscrito/);
  assert.throws(() => M.autoRegistro(db, 4, { nombre: 'Luis', email: 'luis@x.com' }, HOY), /privacidad/);
  assert.throws(() => M.autoRegistro(db, 4, { nombre: 'Lu', email: 'mal', telefono: '12', acepta: 'on' }, HOY), e => !!(e.errores.nombre && e.errores.email && e.errores.telefono));
  // Sin aceptar privacidad y con datos inválidos: se marcan todos los errores a la vez
  assert.throws(() => M.autoRegistro(db, 4, { nombre: 'Lu', email: 'mal' }, HOY), e => !!(e.errores.nombre && e.errores.email && e.errores.acepta));
  assert.throws(() => M.autoRegistro(db, 5, { nombre: 'Luis Gómez', email: 'luis@x.com', acepta: 'on' }, HOY), /ya terminó/);
});

test('R-03 transacciones anidadas: si falla un sub-microflujo se revierte TODO (atomicidad)', async () => {
  const db = await nuevaBD();
  const antes = db.get('SELECT COUNT(*) AS n FROM participantes').n;
  assert.throws(() => db.transaction(() => {
    db.transaction(() => db.run("INSERT INTO participantes (nombre, email) VALUES ('Prueba Rollback', 'rollback@x.com')"));
    throw new Error('falla después del sub-microflujo');
  }), /falla después/);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM participantes').n, antes);
  // y la base sigue usable después del rollback
  assert.ok(M.guardarTarea(db, org, tarea(), { hoy: HOY }));
});
