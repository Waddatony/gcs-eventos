// GCS Eventos — aplicación principal: arranque, sesión, enrutador y pantallas.

import { crearBaseDeDatos, sembrarDatos, fechaLocal, USUARIOS_DEMO } from './db.js';
import { cargarBytes, guardarBytes, borrarBytes } from './storage.js';
import * as R from './rules.js';
import {
  esc, Icono, Boton, Campo, Formulario, leerFormulario, mostrarErrores, Tabla, TarjetaKPI, Insignia,
  BarraProgreso, EncabezadoPagina, Menu, toast, abrirModal, cerrarModal, confirmar, dinero, fechaLarga, EstadoVacio,
} from './components.js';

let db = null;
let usuario = null;
const app = document.getElementById('app');
const hoy = () => fechaLocal();

// ================================================================ Arranque
async function iniciar() {
  try {
    const SQL = await window.initSqlJs({ locateFile: f => `vendor/${f}` });
    const schema = await fetch('database/schema.sql').then(r => { if (!r.ok) throw new Error('No se pudo cargar el esquema'); return r.text(); });
    const guardado = await cargarBytes().catch(() => null);
    db = crearBaseDeDatos(SQL, schema, guardado);
    if (await sembrarDatos(db)) await persistir();
    restaurarSesion();
    window.addEventListener('hashchange', render);
    render();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="error-arranque"><h1>No se pudo iniciar la aplicación</h1>
      <p>${esc(err.message)}</p><p>Abre la app desde un servidor (GitHub Pages o <code>npm start</code>), no con doble clic al archivo.</p></div>`;
  }
}

async function persistir() {
  await guardarBytes(db.export());
}

// Ejecuta una operación de negocio, guarda la BD y muestra el resultado.
async function ejecutar(fn, mensajeExito, form = null) {
  try {
    const r = await fn();
    await persistir();
    if (form) mostrarErrores(form, null);
    if (mensajeExito) toast(typeof mensajeExito === 'function' ? mensajeExito(r) : mensajeExito);
    return { ok: true, r };
  } catch (err) {
    if (err instanceof R.ReglaError) {
      if (form) mostrarErrores(form, err); else toast(err.message, 'error');
    } else {
      console.error(err);
      toast('Error inesperado: ' + err.message, 'error');
    }
    return { ok: false };
  }
}

// ================================================================ Sesión
function restaurarSesion() {
  const id = Number(sessionStorage.getItem('gcs.usuario'));
  if (!id) return;
  const u = db.get('SELECT id, nombre, email, rol, activo FROM usuarios WHERE id = ?', [id]);
  usuario = u && u.activo ? { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } : null;
}

function cerrarSesion() {
  R.registrarBitacora(db, usuario, 'Cierre de sesión', 'usuario', usuario.id);
  persistir();
  usuario = null;
  sessionStorage.removeItem('gcs.usuario');
  location.hash = '#/login';
}

// ================================================================ Enrutador
const RUTAS = [
  { patron: /^#\/inicio$/, pantalla: pantallaInicio, menu: 'inicio' },
  { patron: /^#\/eventos$/, pantalla: pantallaEventos, menu: 'eventos' },
  { patron: /^#\/eventos\/nuevo$/, pantalla: () => pantallaFormEvento(null), menu: 'eventos', permiso: 'evento.crear' },
  { patron: /^#\/eventos\/(\d+)$/, pantalla: m => pantallaDetalleEvento(Number(m[1])), menu: 'eventos' },
  { patron: /^#\/eventos\/(\d+)\/editar$/, pantalla: m => pantallaFormEvento(Number(m[1])), menu: 'eventos', permiso: 'evento.editar' },
  { patron: /^#\/participantes$/, pantalla: pantallaParticipantes, menu: 'participantes' },
  { patron: /^#\/sedes$/, pantalla: pantallaSedes, menu: 'sedes', permiso: 'sede.gestionar' },
  { patron: /^#\/usuarios$/, pantalla: pantallaUsuarios, menu: 'usuarios', permiso: 'usuario.gestionar' },
  { patron: /^#\/bitacora$/, pantalla: pantallaBitacora, menu: 'bitacora', permiso: 'bitacora.ver' },
];

function render() {
  cerrarModal();
  const hash = location.hash || '#/inicio';
  if (!usuario) { if (hash !== '#/login') location.hash = '#/login'; pantallaLogin(); return; }
  if (hash === '#/login') { location.hash = '#/inicio'; return; }
  const ruta = RUTAS.find(r => r.patron.test(hash));
  if (!ruta) { location.hash = '#/inicio'; return; }
  if (ruta.permiso && !R.puede(usuario, ruta.permiso)) { toast('No tienes acceso a esa sección', 'error'); location.hash = '#/inicio'; return; }
  pintarLayout(ruta.menu);
  const contenido = document.getElementById('contenido');
  contenido.onclick = null;
  contenido.onchange = null;
  ruta.pantalla(hash.match(ruta.patron));
  document.querySelector('#contenido h1')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function pintarLayout(activo) {
  const items = [
    { clave: 'inicio', texto: 'Inicio', icono: 'inicio', href: '#/inicio' },
    { clave: 'eventos', texto: 'Eventos', icono: 'eventos', href: '#/eventos' },
    { clave: 'participantes', texto: 'Participantes', icono: 'personas', href: '#/participantes' },
  ];
  if (R.puede(usuario, 'sede.gestionar')) items.push({ clave: 'sedes', texto: 'Sedes', icono: 'sede', href: '#/sedes' });
  if (R.puede(usuario, 'usuario.gestionar')) items.push({ clave: 'usuarios', texto: 'Usuarios', icono: 'usuario', href: '#/usuarios' });
  if (R.puede(usuario, 'bitacora.ver')) items.push({ clave: 'bitacora', texto: 'Bitácora', icono: 'bitacora', href: '#/bitacora' });

  const iniciales = usuario.nombre.split(' ').map(p => p[0]).slice(0, 2).join('');
  app.innerHTML = `
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <header class="barra-movil">
      ${Boton({ texto: 'Abrir menú', variante: 'fantasma', icono: 'menu', soloIcono: true, accion: 'menu-movil' })}
      <span class="logo-texto">GCS <b>Eventos</b></span>
    </header>
    <aside class="lateral" id="lateral">
      <div class="logo"><span class="logo-marca" aria-hidden="true">G</span><span class="logo-texto">GCS <b>Eventos</b></span></div>
      ${Menu(items, activo)}
      <div class="lateral-pie">
        <div class="perfil"><span class="avatar" aria-hidden="true">${esc(iniciales)}</span>
          <div><p class="perfil-nombre">${esc(usuario.nombre)}</p><p class="perfil-rol">${esc(usuario.rol)}</p></div></div>
        ${Boton({ texto: 'Cerrar sesión', variante: 'fantasma', icono: 'salir', accion: 'salir' })}
      </div>
    </aside>
    <div class="velo" data-accion="menu-movil" hidden></div>
    <main id="contenido" class="contenido" tabindex="-1"></main>`;

  app.querySelector('[data-accion="salir"]').onclick = cerrarSesion;
  app.querySelectorAll('[data-accion="menu-movil"]').forEach(b => b.onclick = () => {
    const abierto = document.getElementById('lateral').classList.toggle('abierto');
    app.querySelector('.velo').hidden = !abierto;
  });
}

const contenido = () => document.getElementById('contenido');

function alClic(manejadores) {
  contenido().onclick = e => {
    const b = e.target.closest('[data-accion]');
    if (b && manejadores[b.dataset.accion]) manejadores[b.dataset.accion](b.dataset, b);
  };
}

// ================================================================ Pantalla: Login
function pantallaLogin() {
  app.innerHTML = `<main class="login">
    <section class="login-panel">
      <div class="logo"><span class="logo-marca" aria-hidden="true">G</span><span class="logo-texto">GCS <b>Eventos</b></span></div>
      <h1>Inicia sesión</h1>
      <p class="subtitulo">Sistema de gestión de eventos de Global Consulting Services</p>
      ${Formulario({ id: 'form-login', textoEnviar: 'Entrar', campos: [
        Campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', requerido: true, autocompletar: 'username', placeholder: 'nombre@gcs.com' }),
        Campo({ nombre: 'password', etiqueta: 'Contraseña', tipo: 'password', requerido: true, autocompletar: 'current-password' }),
      ] })}
      <details class="demo">
        <summary>Usuarios de prueba</summary>
        <ul>${USUARIOS_DEMO.map(u => `<li><button type="button" class="enlace" data-email="${esc(u.email)}" data-pw="${esc(u.password)}">
          <b>${esc(u.rol)}</b> · ${esc(u.email)} · <code>${esc(u.password)}</code></button></li>`).join('')}</ul>
      </details>
    </section>
    <section class="login-arte" aria-hidden="true">
      <div><p class="login-frase">Planea, inscribe y mide cada evento en un solo lugar.</p>
      <ul class="login-puntos"><li>${Icono('eventos')} Agenda sin choques de sede</li><li>${Icono('personas')} Cupos y lista de espera automáticos</li><li>${Icono('check')} Check-in y tasa de asistencia</li></ul></div>
    </section>
  </main>`;

  const form = document.getElementById('form-login');
  app.querySelectorAll('[data-email]').forEach(b => b.onclick = () => {
    form.email.value = b.dataset.email; form.password.value = b.dataset.pw; form.querySelector('[type=submit]').focus();
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const d = leerFormulario(form);
    const res = await ejecutar(() => R.autenticar(db, d.email, d.password), u => `Bienvenido, ${u.nombre}`, form);
    if (res.ok) {
      usuario = res.r;
      sessionStorage.setItem('gcs.usuario', usuario.id);
      location.hash = '#/inicio';
    }
  };
  form.email.focus();
}

// ================================================================ Pantalla: Inicio (dashboard)
function pantallaInicio() {
  const k = R.indicadores(db, hoy());
  const proximos = db.all(`SELECT * FROM v_eventos_resumen WHERE fecha >= ? AND estado <> 'Cancelado' ORDER BY fecha, hora_inicio LIMIT 5`, [hoy()]);
  const actividad = db.all(`SELECT b.*, u.nombre AS usuario FROM bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id
      WHERE b.accion NOT IN ('Inicio de sesión','Cierre de sesión') ORDER BY b.id DESC LIMIT 6`);
  const llenos = proximos.filter(e => R.metricasEvento(e, hoy()).ocupacion >= 80);

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: `Hola, ${usuario.nombre.split(' ')[0]}`, subtitulo: fechaLarga(hoy()),
      acciones: R.puede(usuario, 'evento.crear') ? Boton({ texto: 'Nuevo evento', icono: 'mas', href: '#/eventos/nuevo' }) : '' })}
    <section class="kpis" aria-label="Indicadores">
      ${TarjetaKPI({ titulo: 'Eventos próximos', valor: k.proximos, icono: 'eventos', tono: 'azul' })}
      ${TarjetaKPI({ titulo: 'Inscritos confirmados', valor: k.inscritos, detalle: 'en eventos próximos', icono: 'personas', tono: 'verde' })}
      ${TarjetaKPI({ titulo: 'Presupuesto comprometido', valor: dinero(k.presupuesto), icono: 'dinero', tono: 'amarillo' })}
      ${TarjetaKPI({ titulo: 'Tasa de asistencia', valor: `${k.asistencia}%`, detalle: 'eventos ya realizados', icono: 'check', tono: 'morado' })}
    </section>
    ${llenos.length ? `<div class="aviso" role="status">${Icono('personas')} <span><b>${llenos.length}</b> evento(s) próximos están al 80% o más de su capacidad.</span></div>` : ''}
    <div class="dos-columnas">
      <section class="panel"><h2>Próximos eventos</h2>
        ${proximos.length ? `<ul class="lista-eventos">${proximos.map(TarjetaEvento).join('')}</ul>` : EstadoVacio('No hay eventos próximos')}
        <p>${Boton({ texto: 'Ver todos los eventos', variante: 'secundario', href: '#/eventos' })}</p>
      </section>
      <section class="panel"><h2>Actividad reciente</h2>
        <ul class="actividad">${actividad.map(a => `<li><span class="punto"></span><div><p><b>${esc(a.usuario || 'Sistema')}</b> · ${esc(a.accion)} ${esc(a.entidad)}</p>
          <p class="tenue">${esc(a.detalle)} · ${esc(a.fecha)}</p></div></li>`).join('') || '<li>Sin actividad</li>'}</ul>
      </section>
    </div>`;
}

function TarjetaEvento(e) {
  const m = R.metricasEvento(e, hoy());
  const [, mes, dia] = e.fecha.split('-');
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  return `<li><a class="tarjeta-evento" href="#/eventos/${e.id}">
    <div class="fecha-chip"><span>${meses[Number(mes) - 1]}</span><b>${Number(dia)}</b></div>
    <div class="tarjeta-cuerpo"><p class="tarjeta-titulo">${esc(e.titulo)}</p>
      <p class="tenue">${esc(e.hora_inicio)}–${esc(e.hora_fin)} · ${esc(e.sede)}</p>
      ${BarraProgreso(m.ocupacion)}<p class="tenue chico">${m.confirmados}/${e.capacidad} lugares · ${m.ocupacion}%</p></div>
    <div>${Insignia(m.lleno ? 'Lleno' : m.temporal)}</div></a></li>`;
}

// ================================================================ Pantalla: Lista de eventos
function pantallaEventos() {
  const filtros = JSON.parse(sessionStorage.getItem('gcs.filtros') || '{}');
  const sedes = db.all('SELECT id, nombre FROM sedes ORDER BY nombre');

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Eventos', subtitulo: 'Agenda de eventos corporativos y con clientes',
      acciones: `${Boton({ texto: 'Exportar CSV', variante: 'secundario', icono: 'descargar', accion: 'exportar' })}
                 ${R.puede(usuario, 'evento.crear') ? Boton({ texto: 'Nuevo evento', icono: 'mas', href: '#/eventos/nuevo' }) : ''}` })}
    <form class="filtros panel" id="filtros" role="search">
      <div class="campo campo-buscar"><label for="f-q">Buscar</label>
        <div class="con-icono">${Icono('buscar')}<input id="f-q" name="q" type="search" placeholder="Título u organizador" value="${esc(filtros.q || '')}"></div></div>
      <div class="campo"><label for="f-tipo">Tipo</label><select id="f-tipo" name="tipo"><option value="">Todos</option>
        ${R.TIPOS_EVENTO.map(t => `<option ${filtros.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="campo"><label for="f-sede">Sede</label><select id="f-sede" name="sede"><option value="">Todas</option>
        ${sedes.map(s => `<option value="${s.id}" ${String(filtros.sede) === String(s.id) ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label for="f-cuando">Estado</label><select id="f-cuando" name="cuando">
        ${['Próximos', 'Finalizados', 'Cancelados', 'Todos'].map(o => `<option ${ (filtros.cuando || 'Próximos') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
    </form>
    <section class="panel" id="resultado" aria-live="polite"></section>`;

  const form = document.getElementById('filtros');
  let filas = [];
  const pintar = () => {
    const f = leerFormulario(form);
    sessionStorage.setItem('gcs.filtros', JSON.stringify(f));
    const cond = []; const p = [];
    if (f.q) { cond.push('(titulo LIKE ? OR organizador LIKE ?)'); p.push(`%${f.q}%`, `%${f.q}%`); }
    if (f.tipo) { cond.push('tipo = ?'); p.push(f.tipo); }
    if (f.sede) { cond.push('sede_id = ?'); p.push(Number(f.sede)); }
    if (f.cuando === 'Próximos') { cond.push("fecha >= ? AND estado <> 'Cancelado'"); p.push(hoy()); }
    if (f.cuando === 'Finalizados') { cond.push("fecha < ? AND estado <> 'Cancelado'"); p.push(hoy()); }
    if (f.cuando === 'Cancelados') cond.push("estado = 'Cancelado'");
    const orden = f.cuando === 'Finalizados' ? 'fecha DESC' : 'fecha, hora_inicio';
    filas = db.all(`SELECT * FROM v_eventos_resumen ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY ${orden}`, p);

    document.getElementById('resultado').innerHTML = `<p class="tenue">${filas.length} evento(s)</p>` + Tabla({
      vacio: 'No hay eventos con esos filtros',
      filas,
      columnas: [
        { titulo: 'Evento', render: e => `<a class="enlace-fuerte" href="#/eventos/${e.id}">${esc(e.titulo)}</a><br><span class="tenue">${esc(e.tipo)} · ${esc(e.organizador)}</span>` },
        { titulo: 'Fecha', render: e => `${esc(fechaLarga(e.fecha))}<br><span class="tenue">${esc(e.hora_inicio)}–${esc(e.hora_fin)}</span>` },
        { titulo: 'Sede', campo: 'sede' },
        { titulo: 'Ocupación', render: e => { const m = R.metricasEvento(e, hoy()); return `${BarraProgreso(m.ocupacion)}<span class="tenue chico">${m.confirmados}/${e.capacidad}${e.en_espera ? ` · ${e.en_espera} en espera` : ''}</span>`; } },
        { titulo: 'Estado', render: e => { const m = R.metricasEvento(e, hoy()); return `${Insignia(m.temporal)} ${e.estado !== 'Cancelado' ? Insignia(e.estado) : ''}`; } },
        { titulo: 'Acciones', clase: 'acciones', render: e => `
          ${Boton({ texto: 'Ver', variante: 'fantasma', href: `#/eventos/${e.id}` })}
          ${R.puede(usuario, 'evento.editar', e) ? Boton({ texto: 'Editar', variante: 'fantasma', icono: 'editar', soloIcono: true, href: `#/eventos/${e.id}/editar` }) : ''}
          ${R.puede(usuario, 'evento.eliminar', e) ? Boton({ texto: 'Eliminar', variante: 'fantasma-peligro', icono: 'borrar', soloIcono: true, accion: 'eliminar', datos: { id: e.id } }) : ''}` },
      ],
    });
  };
  form.oninput = pintar;
  form.onsubmit = e => e.preventDefault();
  pintar();

  alClic({
    eliminar: async ({ id }) => {
      const ev = db.get('SELECT titulo FROM eventos WHERE id = ?', [Number(id)]);
      if (!(await confirmar(`¿Eliminar el evento "${ev.titulo}"? Esta acción no se puede deshacer.`, { textoAceptar: 'Eliminar' }))) return;
      const r = await ejecutar(() => R.eliminarEvento(db, usuario, Number(id)), 'Evento eliminado');
      if (r.ok) pintar();
    },
    exportar: () => descargarCSV('eventos.csv', filas.map(e => ({ ...e, ...R.metricasEvento(e, hoy()) })), [
      { campo: 'titulo', titulo: 'Evento' }, { campo: 'tipo', titulo: 'Tipo' }, { campo: 'fecha', titulo: 'Fecha' },
      { campo: 'hora_inicio', titulo: 'Inicio' }, { campo: 'hora_fin', titulo: 'Fin' }, { campo: 'sede', titulo: 'Sede' },
      { campo: 'organizador', titulo: 'Organizador' }, { campo: 'capacidad', titulo: 'Capacidad' }, { campo: 'confirmados', titulo: 'Confirmados' },
      { campo: 'ocupacion', titulo: 'Ocupación %' }, { campo: 'presupuesto', titulo: 'Presupuesto' }, { campo: 'estado', titulo: 'Estado' },
    ]),
  });
}

function descargarCSV(nombre, filas, columnas) {
  const blob = new Blob([R.aCSV(filas, columnas)], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nombre });
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Se descargó ${nombre}`);
}

// ================================================================ Pantalla: Formulario de evento
function pantallaFormEvento(id) {
  const ev = id ? db.get('SELECT * FROM eventos WHERE id = ?', [id]) : null;
  if (id && !ev) { toast('El evento no existe', 'error'); location.hash = '#/eventos'; return; }
  if (ev && !R.puede(usuario, 'evento.editar', ev)) { toast('Solo puedes editar tus propios eventos', 'error'); location.hash = `#/eventos/${id}`; return; }
  const sedes = db.all('SELECT * FROM sedes ORDER BY nombre');
  const v = ev || { fecha: hoy(), hora_inicio: '09:00', hora_fin: '10:00', presupuesto: 0, estado: 'Planeado' };
  const volver = id ? `#/eventos/${id}` : '#/eventos';

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: id ? 'Editar evento' : 'Nuevo evento', subtitulo: id ? ev.titulo : 'Los campos con * son obligatorios',
      acciones: Boton({ texto: 'Volver', variante: 'secundario', icono: 'volver', href: volver }) })}
    <div class="dos-columnas form-layout">
      <section class="panel">
        ${Formulario({ id: 'form-evento', textoEnviar: id ? 'Guardar cambios' : 'Crear evento', cancelarHref: volver, campos: [
          Campo({ nombre: 'titulo', etiqueta: 'Título', valor: v.titulo, requerido: true, ayuda: 'Entre 5 y 100 caracteres' }),
          Campo({ nombre: 'tipo', etiqueta: 'Tipo de evento', valor: v.tipo, opciones: R.TIPOS_EVENTO, requerido: true, ancho: 'medio' }),
          Campo({ nombre: 'estado', etiqueta: 'Estado', valor: v.estado, opciones: R.ESTADOS_EVENTO.filter(s => id || s !== 'Cancelado'), requerido: true, ancho: 'medio' }),
          Campo({ nombre: 'sede_id', etiqueta: 'Sede', valor: v.sede_id, requerido: true, opciones: sedes.map(s => ({ valor: s.id, texto: `${s.nombre} (máx. ${s.capacidad})` })) }),
          Campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: v.fecha, requerido: true, min: id ? null : hoy(), ancho: 'tercio' }),
          Campo({ nombre: 'hora_inicio', etiqueta: 'Hora de inicio', tipo: 'time', valor: v.hora_inicio, requerido: true, ancho: 'tercio' }),
          Campo({ nombre: 'hora_fin', etiqueta: 'Hora de fin', tipo: 'time', valor: v.hora_fin, requerido: true, ancho: 'tercio' }),
          Campo({ nombre: 'capacidad', etiqueta: 'Capacidad (personas)', tipo: 'number', valor: v.capacidad, requerido: true, min: 1, paso: 1, ancho: 'medio' }),
          Campo({ nombre: 'presupuesto', etiqueta: 'Presupuesto (MXN)', tipo: 'number', valor: v.presupuesto, requerido: true, min: 0, paso: 100, ancho: 'medio' }),
          Campo({ nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', valor: v.descripcion }),
        ] })}
      </section>
      <aside class="panel resumen-vivo" aria-live="polite">
        <h2>Cálculo automático</h2>
        <div id="calculo"></div>
        <h3>Reglas que se validan</h3>
        <ul class="reglas">
          <li>La fecha no puede ser pasada.</li><li>La hora de fin debe ser posterior al inicio.</li>
          <li>La capacidad no puede superar la de la sede.</li><li>La sede no puede tener otro evento en el mismo horario.</li>
          ${id ? '<li>La capacidad no puede ser menor a los confirmados.</li>' : ''}
        </ul>
      </aside>
    </div>`;

  const form = document.getElementById('form-evento');
  const calc = () => {
    const d = leerFormulario(form);
    const sede = sedes.find(s => String(s.id) === d.sede_id);
    if (sede) form.capacidad.max = sede.capacidad;
    const cap = Number(d.capacidad) || 0;
    const pres = Number(d.presupuesto) || 0;
    const dur = d.hora_inicio && d.hora_fin ? (toMin(d.hora_fin) - toMin(d.hora_inicio)) / 60 : 0;
    const conf = id ? db.get("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id = ? AND estado = 'Confirmado'", [id]).n : 0;
    document.getElementById('calculo').innerHTML = `<dl class="datos">
      <div><dt>Duración</dt><dd>${dur > 0 ? `${dur.toFixed(1)} h` : '—'}</dd></div>
      <div><dt>Costo por persona (a cupo lleno)</dt><dd>${cap ? dinero(pres / cap) : '—'}</dd></div>
      <div><dt>Capacidad de la sede</dt><dd>${sede ? sede.capacidad : '—'}</dd></div>
      <div><dt>Uso de la sede</dt><dd>${sede && cap ? `${Math.round(cap / sede.capacidad * 100)}%` : '—'}</dd></div>
      ${id ? `<div><dt>Confirmados actuales</dt><dd>${conf}</dd></div>` : ''}</dl>`;
    // Validación en vivo (sin bloquear la captura)
    const errores = R.validarEvento(db, d, { id, hoy: hoy() });
    form.querySelectorAll('.campo').forEach(c => {
      const ctrl = c.querySelector('input,select,textarea');
      if (!ctrl.dataset.tocado) return;
      const msg = errores[c.dataset.campo] || '';
      c.classList.toggle('con-error', !!msg);
      c.querySelector('.error-campo').textContent = msg;
    });
  };
  form.addEventListener('input', e => { e.target.dataset.tocado = '1'; calc(); });
  form.addEventListener('change', e => { e.target.dataset.tocado = '1'; calc(); });
  calc();

  form.onsubmit = async e => {
    e.preventDefault();
    const r = await ejecutar(() => R.guardarEvento(db, usuario, leerFormulario(form), { id, hoy: hoy() }),
      id ? 'Cambios guardados' : 'Evento creado', form);
    if (r.ok) location.hash = `#/eventos/${r.r}`;
  };
}

const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };

// ================================================================ Pantalla: Detalle del evento
function pantallaDetalleEvento(id) {
  const e = db.get('SELECT * FROM v_eventos_resumen WHERE id = ?', [id]);
  if (!e) { toast('El evento no existe', 'error'); location.hash = '#/eventos'; return; }
  const m = R.metricasEvento(e, hoy());
  const inscripciones = db.all(`SELECT i.*, p.nombre, p.email, p.empresa FROM inscripciones i
      JOIN participantes p ON p.id = i.participante_id WHERE i.evento_id = ?
      ORDER BY CASE i.estado WHEN 'Confirmado' THEN 0 WHEN 'Lista de espera' THEN 1 ELSE 2 END, i.fecha_registro, i.id`, [id]);
  const disponibles = db.all(`SELECT id, nombre, empresa FROM participantes WHERE id NOT IN
      (SELECT participante_id FROM inscripciones WHERE evento_id = ? AND estado <> 'Cancelado') ORDER BY nombre`, [id]);
  const abierto = e.estado !== 'Cancelado' && e.fecha >= hoy();
  const puedeAsistencia = e.estado !== 'Cancelado' && e.fecha <= hoy();
  const puedeEditar = R.puede(usuario, 'evento.editar', e);
  let posEspera = 0;

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: e.titulo, subtitulo: `${e.tipo} · Organiza ${e.organizador}`, acciones: `
      ${Boton({ texto: 'Volver', variante: 'secundario', icono: 'volver', href: '#/eventos' })}
      ${puedeEditar && e.estado !== 'Cancelado' ? Boton({ texto: 'Cancelar evento', variante: 'secundario', icono: 'cancelar', accion: 'cancelar-evento' }) : ''}
      ${puedeEditar ? Boton({ texto: 'Editar', icono: 'editar', href: `#/eventos/${id}/editar` }) : ''}` })}
    <p class="insignias">${Insignia(m.temporal)} ${e.estado !== 'Cancelado' ? Insignia(e.estado) : ''} ${m.lleno && e.estado !== 'Cancelado' ? Insignia('Lleno') : ''}</p>
    <section class="kpis" aria-label="Métricas del evento">
      ${TarjetaKPI({ titulo: 'Lugares disponibles', valor: m.disponibles, detalle: `de ${e.capacidad}`, icono: 'personas', tono: m.lleno ? 'rojo' : 'verde' })}
      ${TarjetaKPI({ titulo: 'Ocupación', valor: `${m.ocupacion}%`, detalle: `${e.en_espera} en lista de espera`, icono: 'eventos', tono: 'azul' })}
      ${TarjetaKPI({ titulo: 'Costo por asistente', valor: dinero(m.costoPorPersona), detalle: `Presupuesto ${dinero(e.presupuesto)}`, icono: 'dinero', tono: 'amarillo' })}
      ${TarjetaKPI({ titulo: 'Asistencia', valor: `${m.tasaAsistencia}%`, detalle: `${e.asistentes} con check-in`, icono: 'check', tono: 'morado' })}
    </section>
    <div class="dos-columnas detalle">
      <section class="panel">
        <h2>Detalles</h2>
        <dl class="datos">
          <div><dt>Fecha</dt><dd>${esc(fechaLarga(e.fecha))}</dd></div>
          <div><dt>Horario</dt><dd>${esc(e.hora_inicio)} – ${esc(e.hora_fin)}</dd></div>
          <div><dt>Sede</dt><dd>${esc(e.sede)}</dd></div>
          <div><dt>Descripción</dt><dd>${esc(e.descripcion) || '—'}</dd></div>
        </dl>
        ${BarraProgreso(m.ocupacion)}
      </section>
      <section class="panel">
        <h2>Inscribir participante</h2>
        ${abierto ? `<form id="form-inscribir" class="inscribir">
            <div class="campo"><label for="sel-part">Participante</label>
              <select id="sel-part" name="participante" required><option value="">Selecciona…</option>
              ${disponibles.map(p => `<option value="${p.id}">${esc(p.nombre)} — ${esc(p.empresa)}</option>`).join('')}</select></div>
            ${Boton({ texto: m.lleno ? 'Agregar a lista de espera' : 'Inscribir', tipo: 'submit', icono: 'mas' })}
          </form>
          <p>${Boton({ texto: 'Registrar participante nuevo', variante: 'enlace', accion: 'nuevo-participante' })}</p>
          ${m.lleno ? '<p class="aviso chico">El evento está lleno: las nuevas inscripciones pasan a lista de espera y se confirman automáticamente si alguien cancela.</p>' : ''}`
        : `<p class="tenue">${e.estado === 'Cancelado' ? 'El evento está cancelado.' : 'El evento ya se realizó; no admite inscripciones.'}</p>`}
      </section>
    </div>
    <section class="panel">
      <div class="panel-encabezado"><h2>Inscripciones (${inscripciones.filter(i => i.estado !== 'Cancelado').length})</h2>
        ${Boton({ texto: 'Exportar lista', variante: 'secundario', icono: 'descargar', accion: 'exportar' })}</div>
      ${!puedeAsistencia && e.estado !== 'Cancelado' ? '<p class="tenue chico">El check-in de asistencia se habilita el día del evento.</p>' : ''}
      ${Tabla({ vacio: 'Aún no hay inscritos', filas: inscripciones, claseFila: i => i.estado === 'Cancelado' ? 'fila-tenue' : '',
        columnas: [
          { titulo: 'Participante', render: i => `<b>${esc(i.nombre)}</b><br><span class="tenue">${esc(i.email)}</span>` },
          { titulo: 'Empresa', campo: 'empresa' },
          { titulo: 'Estado', render: i => Insignia(i.estado) + (i.estado === 'Lista de espera' ? ` <span class="tenue chico">#${++posEspera}</span>` : '') },
          { titulo: 'Asistencia', render: i => i.estado !== 'Confirmado' ? '—' : puedeAsistencia
              ? `<label class="interruptor"><input type="checkbox" data-asistencia="${i.id}" ${i.asistio ? 'checked' : ''}><span>${i.asistio ? 'Asistió' : 'Pendiente'}</span></label>`
              : '<span class="tenue">Pendiente</span>' },
          { titulo: 'Acciones', clase: 'acciones', render: i => abierto && i.estado !== 'Cancelado'
              ? Boton({ texto: 'Cancelar inscripción', variante: 'fantasma-peligro', icono: 'cancelar', soloIcono: true, accion: 'cancelar-insc', datos: { id: i.id } }) : '' },
        ] })}
    </section>`;

  const recargar = () => pantallaDetalleEvento(id);

  document.getElementById('form-inscribir')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const pid = Number(ev.target.participante.value);
    if (!pid) { toast('Selecciona un participante', 'error'); return; }
    const r = await ejecutar(() => R.inscribir(db, usuario, id, pid, hoy()),
      estado => estado === 'Confirmado' ? 'Inscripción confirmada' : 'Evento lleno: se agregó a la lista de espera');
    if (r.ok) recargar();
  });

  contenido().onchange = async ev => {
    const chk = ev.target.closest('[data-asistencia]');
    if (!chk) return;
    const r = await ejecutar(() => R.registrarAsistencia(db, usuario, Number(chk.dataset.asistencia), chk.checked, hoy()),
      chk.checked ? 'Check-in registrado' : 'Check-in retirado');
    if (r.ok) recargar(); else chk.checked = !chk.checked;
  };

  alClic({
    'cancelar-insc': async ({ id: iid }) => {
      if (!(await confirmar('¿Cancelar esta inscripción? Si hay lista de espera, el siguiente se confirmará automáticamente.', { textoAceptar: 'Cancelar inscripción' }))) return;
      const r = await ejecutar(() => R.cancelarInscripcion(db, usuario, Number(iid), hoy()),
        prom => prom.length ? `Inscripción cancelada. ${prom.join(', ')} pasó a confirmado.` : 'Inscripción cancelada');
      if (r.ok) recargar();
    },
    'cancelar-evento': async () => {
      if (!(await confirmar(`¿Cancelar "${e.titulo}"? Se liberará la sede y ya no aceptará inscripciones.`, { textoAceptar: 'Cancelar evento' }))) return;
      const r = await ejecutar(() => R.cancelarEvento(db, usuario, id), 'Evento cancelado');
      if (r.ok) recargar();
    },
    'nuevo-participante': () => modalParticipante(null, async nuevoId => {
      const r = await ejecutar(() => R.inscribir(db, usuario, id, nuevoId, hoy()), estado => `Participante registrado e inscrito (${estado})`);
      recargar();
      return r;
    }),
    exportar: () => descargarCSV(`inscritos-evento-${id}.csv`, inscripciones.map(i => ({ ...i, asistio: i.asistio ? 'Sí' : 'No' })), [
      { campo: 'nombre', titulo: 'Nombre' }, { campo: 'email', titulo: 'Correo' }, { campo: 'empresa', titulo: 'Empresa' },
      { campo: 'estado', titulo: 'Estado' }, { campo: 'asistio', titulo: 'Asistió' }, { campo: 'fecha_registro', titulo: 'Registro' },
    ]),
  });
}

// ================================================================ Modal reutilizable: participante
function modalParticipante(p, despues = null) {
  abrirModal({
    titulo: p ? 'Editar participante' : 'Nuevo participante',
    contenido: Formulario({ id: 'form-participante', cancelarAccion: 'cerrar-modal', textoEnviar: p ? 'Guardar' : 'Registrar', campos: [
      Campo({ nombre: 'nombre', etiqueta: 'Nombre completo', valor: p?.nombre, requerido: true, autocompletar: 'name' }),
      Campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', valor: p?.email, requerido: true, autocompletar: 'email' }),
      Campo({ nombre: 'empresa', etiqueta: 'Empresa', valor: p?.empresa ?? 'Global Consulting Services', ancho: 'medio' }),
      Campo({ nombre: 'area', etiqueta: 'Área', valor: p?.area, ancho: 'medio' }),
      Campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: p?.telefono, ayuda: '10 dígitos (opcional)', autocompletar: 'tel' }),
    ] }),
    onMount: caja => {
      const form = caja.querySelector('form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        const r = await ejecutar(() => R.guardarParticipante(db, usuario, leerFormulario(form), p?.id ?? null), despues ? null : 'Participante guardado', form);
        if (!r.ok) return;
        cerrarModal();
        if (despues) await despues(r.r); else render();
      };
    },
  });
}

// ================================================================ Pantalla: Participantes
function pantallaParticipantes() {
  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Participantes', subtitulo: 'Empleados de GCS y clientes invitados',
      acciones: Boton({ texto: 'Nuevo participante', icono: 'mas', accion: 'nuevo' }) })}
    <div class="panel filtros"><div class="campo campo-buscar"><label for="p-q">Buscar</label>
      <div class="con-icono">${Icono('buscar')}<input id="p-q" type="search" placeholder="Nombre, correo o empresa"></div></div></div>
    <section class="panel" id="lista-part" aria-live="polite"></section>`;

  const pintar = () => {
    const q = document.getElementById('p-q').value.trim();
    const filas = db.all(`SELECT p.*, (SELECT COUNT(*) FROM inscripciones i WHERE i.participante_id = p.id AND i.estado <> 'Cancelado') AS eventos,
        (SELECT COUNT(*) FROM inscripciones i WHERE i.participante_id = p.id AND i.asistio = 1) AS asistencias
      FROM participantes p WHERE (? = '' OR p.nombre LIKE ? OR p.email LIKE ? OR p.empresa LIKE ?) ORDER BY p.nombre`,
      [q, `%${q}%`, `%${q}%`, `%${q}%`]);
    document.getElementById('lista-part').innerHTML = Tabla({ filas, vacio: 'No se encontraron participantes', columnas: [
      { titulo: 'Nombre', render: p => `<b>${esc(p.nombre)}</b><br><span class="tenue">${esc(p.email)}</span>` },
      { titulo: 'Empresa', render: p => `${esc(p.empresa)}<br><span class="tenue">${esc(p.area)}</span>` },
      { titulo: 'Teléfono', render: p => esc(p.telefono) || '—' },
      { titulo: 'Eventos', render: p => `${p.eventos} inscrito(s) · ${p.asistencias} asistencia(s)` },
      { titulo: 'Acciones', clase: 'acciones', render: p => `
        ${Boton({ texto: 'Editar', variante: 'fantasma', icono: 'editar', soloIcono: true, accion: 'editar', datos: { id: p.id } })}
        ${R.puede(usuario, 'participante.eliminar') ? Boton({ texto: 'Eliminar', variante: 'fantasma-peligro', icono: 'borrar', soloIcono: true, accion: 'eliminar', datos: { id: p.id } }) : ''}` },
    ] });
  };
  document.getElementById('p-q').oninput = pintar;
  pintar();

  alClic({
    nuevo: () => modalParticipante(null),
    editar: ({ id }) => modalParticipante(db.get('SELECT * FROM participantes WHERE id = ?', [Number(id)])),
    eliminar: async ({ id }) => {
      const p = db.get('SELECT nombre FROM participantes WHERE id = ?', [Number(id)]);
      if (!(await confirmar(`¿Eliminar a ${p.nombre}? También se borrará su historial de inscripciones.`, { textoAceptar: 'Eliminar' }))) return;
      const r = await ejecutar(() => R.eliminarParticipante(db, usuario, Number(id), hoy()), 'Participante eliminado');
      if (r.ok) pintar();
    },
  });
}

// ================================================================ Pantalla: Sedes (solo Administrador)
function pantallaSedes() {
  const filas = db.all(`SELECT s.*, (SELECT COUNT(*) FROM eventos e WHERE e.sede_id = s.id AND e.fecha >= ? AND e.estado <> 'Cancelado') AS proximos
      FROM sedes s ORDER BY s.nombre`, [hoy()]);
  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Sedes', subtitulo: 'Salas y espacios disponibles para eventos', acciones: Boton({ texto: 'Nueva sede', icono: 'mas', accion: 'nueva' }) })}
    <section class="panel">${Tabla({ filas, columnas: [
      { titulo: 'Sede', render: s => `<b>${esc(s.nombre)}</b>` },
      { titulo: 'Dirección', campo: 'direccion' },
      { titulo: 'Capacidad', render: s => `${s.capacidad} personas` },
      { titulo: 'Eventos próximos', campo: 'proximos' },
      { titulo: 'Acciones', clase: 'acciones', render: s => Boton({ texto: 'Editar', variante: 'fantasma', icono: 'editar', soloIcono: true, accion: 'editar', datos: { id: s.id } }) },
    ] })}</section>`;

  const modal = s => abrirModal({
    titulo: s ? 'Editar sede' : 'Nueva sede',
    contenido: Formulario({ id: 'form-sede', cancelarAccion: 'cerrar-modal', campos: [
      Campo({ nombre: 'nombre', etiqueta: 'Nombre', valor: s?.nombre, requerido: true }),
      Campo({ nombre: 'direccion', etiqueta: 'Dirección', valor: s?.direccion, requerido: true }),
      Campo({ nombre: 'capacidad', etiqueta: 'Capacidad', tipo: 'number', valor: s?.capacidad, requerido: true, min: 1 }),
    ] }),
    onMount: caja => {
      const form = caja.querySelector('form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        const r = await ejecutar(() => R.guardarSede(db, usuario, leerFormulario(form), s?.id ?? null), 'Sede guardada', form);
        if (r.ok) render();
      };
    },
  });
  alClic({ nueva: () => modal(null), editar: ({ id }) => modal(db.get('SELECT * FROM sedes WHERE id = ?', [Number(id)])) });
}

// ================================================================ Pantalla: Usuarios (solo Administrador)
function pantallaUsuarios() {
  const filas = db.all('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre');
  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Usuarios', subtitulo: 'Cuentas y roles con acceso al sistema', acciones: Boton({ texto: 'Nuevo usuario', icono: 'mas', accion: 'nuevo' }) })}
    <section class="panel">${Tabla({ filas, columnas: [
      { titulo: 'Nombre', render: u => `<b>${esc(u.nombre)}</b><br><span class="tenue">${esc(u.email)}</span>` },
      { titulo: 'Rol', campo: 'rol' },
      { titulo: 'Estado', render: u => Insignia(u.activo ? 'Activo' : 'Inactivo') },
      { titulo: 'Alta', campo: 'creado_en' },
      { titulo: 'Acciones', clase: 'acciones', render: u => u.id === usuario.id ? '<span class="tenue">Tú</span>'
          : Boton({ texto: u.activo ? 'Desactivar' : 'Activar', variante: 'secundario', accion: 'estado', datos: { id: u.id, activo: u.activo ? 0 : 1 } }) },
    ] })}</section>
    <section class="panel"><h2>Permisos por rol</h2>
      ${Tabla({ filas: [
        ['Ver eventos y participantes', '✔', '✔', '✔'], ['Inscribir y registrar asistencia', '✔', '✔', '✔'],
        ['Crear eventos', '✔', '✔', '—'], ['Editar / cancelar eventos', 'Todos', 'Solo los suyos', '—'],
        ['Eliminar participantes', '✔', '—', '—'], ['Sedes, usuarios y bitácora', '✔', '—', '—'],
      ].map(([a, b, c, d]) => ({ a, b, c, d })), columnas: [
        { titulo: 'Permiso', campo: 'a' }, { titulo: 'Administrador', campo: 'b' }, { titulo: 'Organizador', campo: 'c' }, { titulo: 'Colaborador', campo: 'd' },
      ] })}</section>`;

  alClic({
    nuevo: () => abrirModal({
      titulo: 'Nuevo usuario',
      contenido: Formulario({ id: 'form-usuario', cancelarAccion: 'cerrar-modal', textoEnviar: 'Crear usuario', campos: [
        Campo({ nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true }),
        Campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', requerido: true, autocompletar: 'off' }),
        Campo({ nombre: 'rol', etiqueta: 'Rol', opciones: R.ROLES, requerido: true }),
        Campo({ nombre: 'password', etiqueta: 'Contraseña inicial', tipo: 'password', requerido: true, ayuda: 'Mínimo 8 caracteres, una mayúscula y un número', autocompletar: 'new-password' }),
      ] }),
      onMount: caja => {
        const form = caja.querySelector('form');
        form.onsubmit = async ev => {
          ev.preventDefault();
          const r = await ejecutar(() => R.crearUsuario(db, usuario, leerFormulario(form)), 'Usuario creado', form);
          if (r.ok) render();
        };
      },
    }),
    estado: async ({ id, activo }) => {
      const r = await ejecutar(() => R.cambiarEstadoUsuario(db, usuario, Number(id), activo === '1'), activo === '1' ? 'Usuario activado' : 'Usuario desactivado');
      if (r.ok) render();
    },
  });
}

// ================================================================ Pantalla: Bitácora (solo Administrador)
function pantallaBitacora() {
  const filas = db.all(`SELECT b.*, u.nombre AS usuario FROM bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id ORDER BY b.id DESC LIMIT 300`);
  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Bitácora', subtitulo: 'Registro de auditoría de todas las operaciones',
      acciones: `${Boton({ texto: 'Exportar CSV', variante: 'secundario', icono: 'descargar', accion: 'exportar' })}
                 ${Boton({ texto: 'Restablecer datos de demo', variante: 'peligro', accion: 'reset' })}` })}
    <section class="panel">${Tabla({ filas, columnas: [
      { titulo: 'Fecha', campo: 'fecha' }, { titulo: 'Usuario', render: b => esc(b.usuario || 'Sistema') },
      { titulo: 'Acción', render: b => `<b>${esc(b.accion)}</b>` }, { titulo: 'Entidad', render: b => `${esc(b.entidad)}${b.entidad_id ? ` #${b.entidad_id}` : ''}` },
      { titulo: 'Detalle', campo: 'detalle' },
    ] })}</section>`;
  alClic({
    exportar: () => descargarCSV('bitacora.csv', filas, [
      { campo: 'fecha', titulo: 'Fecha' }, { campo: 'usuario', titulo: 'Usuario' }, { campo: 'accion', titulo: 'Acción' },
      { campo: 'entidad', titulo: 'Entidad' }, { campo: 'entidad_id', titulo: 'ID' }, { campo: 'detalle', titulo: 'Detalle' },
    ]),
    reset: async () => {
      if (!(await confirmar('Se borrarán todos los datos y se cargarán los de ejemplo. ¿Continuar?', { textoAceptar: 'Restablecer' }))) return;
      await borrarBytes();
      sessionStorage.clear();
      location.hash = '#/login';
      location.reload();
    },
  });
}

iniciar();
