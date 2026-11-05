// Pruebas automáticas de las reglas de negocio. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { crearBaseDeDatos, sembrarDatos, sumarDias } from '../js/db.js';
import * as R from '../js/rules.js';

const HOY = '2026-11-05';
const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');
const SQL = await initSqlJs();

async function nuevaBD() {
  const db = crearBaseDeDatos(SQL, schema);
  await sembrarDatos(db, HOY);
  return db;
}
const admin = { id: 1, rol: 'Administrador' };
const org = { id: 2, rol: 'Organizador' };
const colab = { id: 3, rol: 'Colaborador' };

const eventoBase = (extra = {}) => ({
  titulo: 'Junta de planeación', descripcion: '', tipo: 'Taller', sede_id: 2,
  fecha: sumarDias(HOY, 20), hora_inicio: '10:00', hora_fin: '11:00', capacidad: 10, presupuesto: 500, ...extra,
});

test('login correcto, incorrecto y usuario inactivo', async () => {
  const db = await nuevaBD();
  const u = await R.autenticar(db, 'ADMIN@gcs.com', 'Admin2026');
  assert.equal(u.rol, 'Administrador');
  await assert.rejects(R.autenticar(db, 'admin@gcs.com', 'mala'), /incorrectos/);
  R.cambiarEstadoUsuario(db, admin, 3, false);
  await assert.rejects(R.autenticar(db, 'colaborador@gcs.com', 'Staff2026'), /desactivado/);
});

test('las contraseñas se guardan con hash, nunca en texto plano', async () => {
  const db = await nuevaBD();
  const u = db.get("SELECT password_hash FROM usuarios WHERE email='admin@gcs.com'");
  assert.notEqual(u.password_hash, 'Admin2026');
  assert.match(u.password_hash, /^[0-9a-f]{64}$/);
});

test('validaciones de evento: campos, fecha pasada, horas, capacidad de sede', async () => {
  const db = await nuevaBD();
  const e = R.validarEvento(db, eventoBase({ titulo: 'abc', fecha: sumarDias(HOY, -1), hora_fin: '09:00', capacidad: 50 }), { hoy: HOY });
  assert.ok(e.titulo && e.fecha && e.hora_fin && e.capacidad);
  assert.match(e.capacidad, /solo admite 20/);
  assert.deepEqual(R.validarEvento(db, eventoBase(), { hoy: HOY }), {});
});

test('no permite traslapar eventos en la misma sede', async () => {
  const db = await nuevaBD();
  R.guardarEvento(db, org, eventoBase(), { hoy: HOY });
  assert.throws(() => R.guardarEvento(db, org, eventoBase({ hora_inicio: '10:30', hora_fin: '12:00' }), { hoy: HOY }),
    err => err.errores.sede_id?.includes('ocupada'));
  // Contiguo sí se permite
  assert.ok(R.guardarEvento(db, org, eventoBase({ hora_inicio: '11:00', hora_fin: '12:00' }), { hoy: HOY }));
});

test('permisos: colaborador no crea eventos; organizador solo edita los suyos', async () => {
  const db = await nuevaBD();
  assert.throws(() => R.guardarEvento(db, colab, eventoBase(), { hoy: HOY }), /permiso/);
  const ev3 = db.get('SELECT * FROM eventos WHERE id = 3'); // organizado por admin
  assert.throws(() => R.guardarEvento(db, org, { ...ev3 }, { id: 3, hoy: HOY }), /permiso/);
  assert.equal(R.puede(admin, 'evento.editar', ev3), true);
});

test('inscripción: duplicados, cupo lleno → lista de espera y promoción automática', async () => {
  const db = await nuevaBD();
  const id = R.guardarEvento(db, org, eventoBase({ capacidad: 2 }), { hoy: HOY });
  assert.equal(R.inscribir(db, colab, id, 1, HOY), 'Confirmado');
  assert.throws(() => R.inscribir(db, colab, id, 1, HOY), /ya está inscrito/);
  assert.equal(R.inscribir(db, colab, id, 2, HOY), 'Confirmado');
  assert.equal(R.inscribir(db, colab, id, 3, HOY), 'Lista de espera');

  const insc = db.get('SELECT id FROM inscripciones WHERE evento_id = ? AND participante_id = 1', [id]);
  const promovidos = R.cancelarInscripcion(db, colab, insc.id, HOY);
  assert.deepEqual(promovidos, ['María Garza']);
  assert.equal(db.get('SELECT estado FROM inscripciones WHERE evento_id = ? AND participante_id = 3', [id]).estado, 'Confirmado');
});

test('ampliar capacidad promueve la lista de espera; reducir por debajo de confirmados no se permite', async () => {
  const db = await nuevaBD();
  const id = R.guardarEvento(db, org, eventoBase({ capacidad: 1 }), { hoy: HOY });
  R.inscribir(db, org, id, 1, HOY);
  R.inscribir(db, org, id, 2, HOY);
  R.guardarEvento(db, org, eventoBase({ capacidad: 2 }), { id, hoy: HOY });
  assert.equal(db.get("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id = ? AND estado='Confirmado'", [id]).n, 2);
  assert.throws(() => R.guardarEvento(db, org, eventoBase({ capacidad: 1 }), { id, hoy: HOY }), err => !!err.errores.capacidad);
});

test('la BD rechaza sobrecupo aunque se salte la lógica (trigger)', async () => {
  const db = await nuevaBD();
  const id = R.guardarEvento(db, org, eventoBase({ capacidad: 1 }), { hoy: HOY });
  db.run('INSERT INTO inscripciones (evento_id, participante_id) VALUES (?, 1)', [id]);
  assert.throws(() => db.run('INSERT INTO inscripciones (evento_id, participante_id) VALUES (?, 2)', [id]), /capacidad máxima/);
});

test('no se inscribe a eventos cancelados ni pasados; asistencia solo el día del evento', async () => {
  const db = await nuevaBD();
  assert.throws(() => R.inscribir(db, admin, 5, 1, HOY), /ya terminó/);
  R.cancelarEvento(db, admin, 4);
  assert.throws(() => R.inscribir(db, admin, 4, 1, HOY), /cancelado/);
  const futura = db.get('SELECT id FROM inscripciones WHERE evento_id = 1 LIMIT 1');
  assert.throws(() => R.registrarAsistencia(db, colab, futura.id, true, HOY), /día del evento/);
  const pasada = db.get('SELECT id FROM inscripciones WHERE evento_id = 5 AND asistio = 0 LIMIT 1');
  R.registrarAsistencia(db, colab, pasada.id, true, HOY);
  assert.equal(db.get('SELECT asistio FROM inscripciones WHERE id = ?', [pasada.id]).asistio, 1);
});

test('no se elimina un evento con confirmados (se debe cancelar)', async () => {
  const db = await nuevaBD();
  assert.throws(() => R.eliminarEvento(db, admin, 1), /Cancélalo/);
  const id = R.guardarEvento(db, admin, eventoBase(), { hoy: HOY });
  R.eliminarEvento(db, admin, id);
  assert.equal(db.get('SELECT * FROM eventos WHERE id = ?', [id]), null);
});

test('cálculos automáticos de métricas e indicadores', async () => {
  const db = await nuevaBD();
  const ev = db.get('SELECT * FROM v_eventos_resumen WHERE id = 5');
  const m = R.metricasEvento(ev, HOY);
  assert.equal(m.confirmados, 4);
  assert.equal(m.tasaAsistencia, 75);
  assert.equal(m.costoPorPersona, 3750);
  assert.equal(m.temporal, 'Finalizado');
  const k = R.indicadores(db, HOY);
  assert.equal(k.proximos, 4);
  assert.equal(k.asistencia, 75);
});

test('participantes: correo válido y único, teléfono de 10 dígitos', async () => {
  const db = await nuevaBD();
  assert.throws(() => R.guardarParticipante(db, colab, { nombre: 'Pedro', email: 'ana.torres@gcs.com' }), e => /Ya existe/.test(e.errores.email));
  assert.throws(() => R.guardarParticipante(db, colab, { nombre: 'Pedro', email: 'pedro@', telefono: '123' }), e => !!(e.errores.email && e.errores.telefono));
  assert.ok(R.guardarParticipante(db, colab, { nombre: 'Pedro Páramo', email: 'pedro@gcs.com', telefono: '81 1234 5678' }));
  assert.throws(() => R.eliminarParticipante(db, colab, 1, HOY), /permiso/);
  assert.throws(() => R.eliminarParticipante(db, admin, 1, HOY), /próximos/);
});

test('crear usuario aplica política de contraseñas', async () => {
  const db = await nuevaBD();
  await assert.rejects(R.crearUsuario(db, admin, { nombre: 'Nuevo', email: 'n@gcs.com', rol: 'Colaborador', password: 'corta' }), e => !!e.errores.password);
  await R.crearUsuario(db, admin, { nombre: 'Nuevo Usuario', email: 'n@gcs.com', rol: 'Colaborador', password: 'Segura2026' });
  assert.ok(await R.autenticar(db, 'n@gcs.com', 'Segura2026'));
});

test('exportación CSV escapa comillas', () => {
  const csv = R.aCSV([{ a: 'x "y"' }], [{ campo: 'a', titulo: 'A' }]);
  assert.ok(csv.includes('"x ""y"""'));
});
