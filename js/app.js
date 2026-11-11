// GCS Eventos — aplicación principal: arranque, sesión, enrutador y pantallas.

import { crearBaseDeDatos, sembrarDatos, sembrarActividad4, fechaLocal, USUARIOS_DEMO } from './db.js';
import { cargarBytes, guardarBytes, borrarBytes } from './storage.js';
import * as R from './rules.js';
import * as M from './microflujos.js';
import {
  esc, Icono, Boton, Campo, Formulario, leerFormulario, mostrarErrores, Tabla, TarjetaKPI, Insignia,
  BarraProgreso, EncabezadoPagina, Menu, toast, abrirModal, cerrarModal, confirmar, dinero, fechaLarga, EstadoVacio,
  Pestanas, FormularioAsistente, montarCalendario, rangoMes, ListaTareas, ResumenProgreso, ListaAvisos, ListaMensajes, TablaAvisos,
} from './components.js';

let db = null;
let usuario = null;
let parametros = new URLSearchParams();
const app = document.getElementById('app');
const hoy = () => fechaLocal();

// ================================================================ Arranque
async function iniciar() {
  try {
    const SQL = await window.initSqlJs({ locateFile: f => `vendor/${f}` });
    const schema = await fetch('database/schema.sql').then(r => { if (!r.ok) throw new Error('No se pudo cargar el esquema'); return r.text(); });
    const guardado = await cargarBytes().catch(() => null);
    db = crearBaseDeDatos(SQL, schema, guardado);
    const nuevos = await sembrarDatos(db);
    if (await sembrarActividad4(db) || nuevos) await persistir();
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
// Rutas públicas: no requieren iniciar sesión (las usa el asistente)
const RUTAS_PUBLICAS = [
  { patron: /^#\/portal\/([0-9a-f]+)$/, pantalla: m => pantallaPortal(m[1]) },
  { patron: /^#\/registro\/(\d+)$/, pantalla: m => pantallaRegistro(Number(m[1])) },
];

const RUTAS = [
  { patron: /^#\/inicio$/, pantalla: pantallaInicio, menu: 'inicio' },
  { patron: /^#\/tareas$/, pantalla: pantallaTareas, menu: 'tareas' },
  { patron: /^#\/comunicacion$/, pantalla: pantallaComunicacion, menu: 'comunicacion', permiso: 'mensajes.ver' },
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
  const [hash, query] = (location.hash || '#/inicio').split('?');
  parametros = new URLSearchParams(query || '');
  const publica = RUTAS_PUBLICAS.find(r => r.patron.test(hash));
  if (publica) { publica.pantalla(hash.match(publica.patron)); window.scrollTo(0, 0); return; }
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
    { clave: 'tareas', texto: 'Tareas', icono: 'tarea', href: '#/tareas' },
    { clave: 'participantes', texto: 'Participantes', icono: 'personas', href: '#/participantes' },
  ];
  if (R.puede(usuario, 'mensajes.ver')) {
    const sinLeer = db.get("SELECT COUNT(*) AS n FROM mensajes WHERE direccion = 'Asistente a organizador' AND leido = 0").n;
    items.push({ clave: 'comunicacion', texto: sinLeer ? `Comunicación (${sinLeer})` : 'Comunicación', icono: 'mensaje', href: '#/comunicacion' });
  }
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
        ${(() => {
          const ana = db.get('SELECT a.token, p.nombre FROM accesos_portal a JOIN participantes p ON p.id = a.participante_id ORDER BY a.participante_id LIMIT 1');
          const ev = db.get(`SELECT id, titulo FROM eventos WHERE estado <> 'Cancelado' AND fecha >= ? ORDER BY fecha DESC LIMIT 1`, [hoy()]);
          return `<p class="chico">Sin iniciar sesión (vista del asistente):</p><ul>
            ${ana ? `<li><a href="#/portal/${esc(ana.token)}">Portal del asistente de ${esc(ana.nombre)}</a></li>` : ''}
            ${ev ? `<li><a href="#/registro/${ev.id}">Auto-registro a "${esc(ev.titulo)}"</a></li>` : ''}</ul>`;
        })()}
      </details>
    </section>
    <section class="login-arte" aria-hidden="true">
      <div><p class="login-frase">Planea, inscribe y mide cada evento en un solo lugar.</p>
      <ul class="login-puntos"><li>${Icono('eventos')} Agenda sin choques de sede</li><li>${Icono('personas')} Cupos y lista de espera automáticos</li><li>${Icono('tarea')} Tareas asignadas y su avance</li><li>${Icono('mensaje')} Avisos y comunicados a los asistentes</li></ul></div>
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
  const rt = M.resumenTareas(M.listarTareas(db, {}, hoy()));

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
    ${rt.vencidas ? `<div class="aviso aviso-rojo" role="status">${Icono('tarea')} <span><b>${rt.vencidas}</b> tarea(s) vencida(s) sin completar. <a href="#/tareas?vencidas=1">Ver tareas vencidas</a></span></div>` : ''}
    <div class="dos-columnas">
      <section class="panel"><h2>Próximos eventos</h2>
        ${proximos.length ? `<ul class="lista-eventos">${proximos.map(TarjetaEvento).join('')}</ul>` : EstadoVacio('No hay eventos próximos')}
        <p>${Boton({ texto: 'Ver todos los eventos', variante: 'secundario', href: '#/eventos' })}</p>
      </section>
      <div>
        <section class="panel"><h2>Calendario</h2><div id="cal-inicio"></div>
          <p class="tenue chico">Elige un día para ver sus eventos en la agenda.</p></section>
        <section class="panel"><div class="panel-encabezado"><h2>Avance de tareas</h2>${Boton({ texto: 'Ver tareas', variante: 'secundario', href: '#/tareas' })}</div>
          ${ResumenProgreso(rt)}</section>
        <section class="panel"><h2>Actividad reciente</h2>
          <ul class="actividad">${actividad.map(a => `<li><span class="punto"></span><div><p><b>${esc(a.usuario || 'Sistema')}</b> · ${esc(a.accion)} ${esc(a.entidad)}</p>
            <p class="tenue">${esc(a.detalle)} · ${esc(a.fecha)}</p></div></li>`).join('') || '<li>Sin actividad</li>'}</ul>
        </section>
      </div>
    </div>`;
  montarCalendario(document.getElementById('cal-inicio'), {
    hoy: hoy(), compacto: true, cargarEventos: eventosDelMes(),
    alElegirDia: f => { location.hash = `#/eventos?vista=calendario&fecha=${f}`; },
  });
}

// Consulta reutilizable para alimentar el componente Calendario
function eventosDelMes({ sedeId = null, participanteId = null } = {}) {
  return (anio, mes) => {
    const [ini, fin] = rangoMes(anio, mes);
    if (participanteId) {
      return db.all(`SELECT e.id, e.titulo, e.fecha, e.hora_inicio, e.estado FROM eventos e JOIN inscripciones i ON i.evento_id = e.id
          WHERE i.participante_id = ? AND i.estado <> 'Cancelado' AND e.fecha BETWEEN ? AND ? ORDER BY e.hora_inicio`, [participanteId, ini, fin]);
    }
    return db.all(`SELECT id, titulo, fecha, hora_inicio, estado FROM eventos WHERE fecha BETWEEN ? AND ? ${sedeId ? 'AND sede_id = ?' : ''}
        ORDER BY hora_inicio`, sedeId ? [ini, fin, sedeId] : [ini, fin]);
  };
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
  const vista = parametros.get('vista') || sessionStorage.getItem('gcs.vista') || 'lista';
  sessionStorage.setItem('gcs.vista', vista);
  const fechaInicial = parametros.get('fecha') || hoy();

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Eventos', subtitulo: 'Agenda de eventos corporativos y con clientes',
      acciones: `<div class="segmentado" role="group" aria-label="Vista">
                   <a class="btn ${vista === 'lista' ? 'btn-primario' : 'btn-secundario'}" href="#/eventos?vista=lista" ${vista === 'lista' ? 'aria-current="page"' : ''}>${Icono('lista')}<span>Lista</span></a>
                   <a class="btn ${vista === 'calendario' ? 'btn-primario' : 'btn-secundario'}" href="#/eventos?vista=calendario" ${vista === 'calendario' ? 'aria-current="page"' : ''}>${Icono('calendario')}<span>Calendario</span></a>
                 </div>
                 ${Boton({ texto: 'Exportar CSV', variante: 'secundario', icono: 'descargar', accion: 'exportar' })}
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
    if (vista === 'calendario') {
      // En el calendario se ignora el filtro de estado: se ve todo el mes
      const c2 = cond.filter(c => !/estado|fecha/.test(c));
      const p2 = p.slice(0, p.length - (f.cuando === 'Próximos' || f.cuando === 'Finalizados' ? 1 : 0));
      document.getElementById('resultado').innerHTML = `<div class="dos-columnas cal-layout"><div id="cal-eventos"></div>
        <div><h2 id="dia-titulo">Eventos del día</h2><div id="dia-eventos"></div></div></div>`;
      const verDia = fecha => {
        filas = db.all(`SELECT * FROM v_eventos_resumen WHERE fecha = ? ${c2.length ? 'AND ' + c2.join(' AND ') : ''} ORDER BY hora_inicio`, [fecha, ...p2]);
        document.getElementById('dia-titulo').textContent = `Eventos del ${fechaLarga(fecha)}`;
        document.getElementById('dia-eventos').innerHTML = (filas.length ? `<ul class="lista-eventos">${filas.map(TarjetaEvento).join('')}</ul>` : EstadoVacio('Sin eventos este día'))
          + (R.puede(usuario, 'evento.crear') && fecha >= hoy() ? `<p>${Boton({ texto: 'Crear evento este día', icono: 'mas', href: `#/eventos/nuevo?fecha=${fecha}` })}</p>` : '');
      };
      montarCalendario(document.getElementById('cal-eventos'), {
        hoy: hoy(), fechaInicial, seleccionado: fechaInicial, alElegirDia: verDia,
        cargarEventos: (anio, mes) => {
          const [ini, fin] = rangoMes(anio, mes);
          return db.all(`SELECT id, titulo, fecha, hora_inicio, estado FROM v_eventos_resumen WHERE fecha BETWEEN ? AND ?
            ${c2.length ? 'AND ' + c2.join(' AND ') : ''} ORDER BY hora_inicio`, [ini, fin, ...p2]);
        },
      });
      verDia(fechaInicial);
      return;
    }
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
  const fechaParam = parametros.get('fecha');
  const v = ev || { fecha: fechaParam && fechaParam >= hoy() ? fechaParam : hoy(), hora_inicio: '09:00', hora_fin: '10:00', presupuesto: 0, estado: 'Planeado' };
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
      <aside>
      <section class="panel"><h2>Disponibilidad de la sede</h2>
        <p class="tenue chico" id="cal-sede-ayuda">Elige una sede para ver qué días ya está ocupada. Haz clic en un día para usarlo como fecha.</p>
        <div id="cal-form"></div></section>
      <section class="panel resumen-vivo" aria-live="polite">
        <h2>Cálculo automático</h2>
        <div id="calculo"></div>
        <h3>Reglas que se validan</h3>
        <ul class="reglas">
          <li>La fecha no puede ser pasada.</li><li>La hora de fin debe ser posterior al inicio.</li>
          <li>La capacidad no puede superar la de la sede.</li><li>La sede no puede tener otro evento en el mismo horario.</li>
          ${id ? '<li>La capacidad no puede ser menor a los confirmados.</li>' : ''}
        </ul>
      </section>
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
  // Componente Calendario reutilizado: muestra solo los eventos de la sede elegida
  let sedeCal = Number(form.sede_id.value) || null;
  const cal = montarCalendario(document.getElementById('cal-form'), {
    hoy: hoy(), fechaInicial: form.fecha.value || hoy(), seleccionado: form.fecha.value, compacto: true,
    cargarEventos: (a, m) => sedeCal ? eventosDelMes({ sedeId: sedeCal })(a, m).filter(e => e.id !== id && e.estado !== 'Cancelado') : [],
    alElegirDia: f => {
      if (f < hoy() && !id) { toast('No puedes programar un evento en una fecha pasada', 'error'); return; }
      form.fecha.value = f; form.fecha.dataset.tocado = '1'; calc();
    },
  });
  form.addEventListener('input', e => { e.target.dataset.tocado = '1'; calc(); });
  form.addEventListener('change', e => {
    e.target.dataset.tocado = '1';
    if (e.target.name === 'sede_id') { sedeCal = Number(e.target.value) || null; cal.refrescar(); }
    if (e.target.name === 'fecha' && e.target.value) cal.irA(e.target.value);
    calc();
  });
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
  const abierto = e.estado !== 'Cancelado' && e.fecha >= hoy();
  const puedeEditar = R.puede(usuario, 'evento.editar', e);
  const tareas = M.listarTareas(db, { eventoId: id }, hoy());
  const rt = M.resumenTareas(tareas);
  const sinLeer = db.get("SELECT COUNT(*) AS n FROM mensajes WHERE evento_id = ? AND direccion = 'Asistente a organizador' AND leido = 0", [id]).n;
  const activos = db.get("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id = ? AND estado <> 'Cancelado'", [id]).n;
  let pestana = parametros.get('tab') || 'asistentes';

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: e.titulo, subtitulo: `${e.tipo} · Organiza ${e.organizador}`, acciones: `
      ${Boton({ texto: 'Volver', variante: 'secundario', icono: 'volver', href: '#/eventos' })}
      ${abierto ? Boton({ texto: 'Enlace de registro', variante: 'secundario', icono: 'enlace', accion: 'enlace-registro' }) : ''}
      ${puedeEditar && e.estado !== 'Cancelado' ? Boton({ texto: 'Cancelar evento', variante: 'secundario', icono: 'cancelar', accion: 'cancelar-evento' }) : ''}
      ${puedeEditar ? Boton({ texto: 'Editar', icono: 'editar', href: `#/eventos/${id}/editar` }) : ''}` })}
    <p class="insignias">${Insignia(m.temporal)} ${e.estado !== 'Cancelado' ? Insignia(e.estado) : ''} ${m.lleno && e.estado !== 'Cancelado' ? Insignia('Lleno') : ''}
      <span class="tenue">${esc(fechaLarga(e.fecha))} · ${esc(e.hora_inicio)}–${esc(e.hora_fin)} · ${esc(e.sede)}</span></p>
    <section class="kpis" aria-label="Métricas del evento">
      ${TarjetaKPI({ titulo: 'Lugares disponibles', valor: m.disponibles, detalle: `de ${e.capacidad} · ${e.en_espera} en espera`, icono: 'personas', tono: m.lleno ? 'rojo' : 'verde' })}
      ${TarjetaKPI({ titulo: 'Costo por asistente', valor: dinero(m.costoPorPersona), detalle: `Presupuesto ${dinero(e.presupuesto)}`, icono: 'dinero', tono: 'amarillo' })}
      ${TarjetaKPI({ titulo: 'Avance de tareas', valor: `${rt.avance}%`, detalle: `${rt.completadas} de ${rt.total} completadas`, icono: 'tarea', tono: rt.vencidas ? 'rojo' : 'morado' })}
      ${TarjetaKPI({ titulo: 'Asistencia', valor: `${m.tasaAsistencia}%`, detalle: `${e.asistentes} con check-in`, icono: 'check', tono: 'azul' })}
    </section>
    <div id="zona-pestanas"></div>`;

  const pintarPestanas = () => {
    document.getElementById('zona-pestanas').innerHTML = Pestanas('evento', [
      { clave: 'asistentes', texto: 'Asistentes', icono: 'personas', contador: activos },
      { clave: 'tareas', texto: 'Tareas', icono: 'tarea', contador: rt.vencidas ? `${rt.total} · ${rt.vencidas} vencida(s)` : rt.total },
      { clave: 'comunicacion', texto: 'Comunicación', icono: 'mensaje', contador: sinLeer ? `${sinLeer} nuevo(s)` : '' },
    ], pestana);
    const panel = document.getElementById('panel-evento');
    ({ asistentes: pestanaAsistentes, tareas: pestanaTareas, comunicacion: pestanaComunicacion })[pestana](panel, e, { abierto, puedeEditar, recargar });
  };
  const recargar = () => { parametros.set('tab', pestana); pantallaDetalleEvento(id); };

  pintarPestanas();
  alClic({
    tab: ({ tab }) => {
      pestana = tab;
      history.replaceState(null, '', `#/eventos/${id}?tab=${tab}`);
      pintarPestanas();
      document.getElementById(`tab-evento-${tab}`)?.focus();
    },
    'cancelar-evento': async () => {
      if (!(await confirmar(`¿Cancelar "${e.titulo}"? Se liberará la sede y se avisará a sus ${activos} inscrito(s).`, { textoAceptar: 'Cancelar evento' }))) return;
      const r = await ejecutar(() => R.cancelarEvento(db, usuario, id), n => `Evento cancelado. Se avisó a ${n} asistente(s).`);
      if (r.ok) recargar();
    },
    'enlace-registro': () => modalEnlace('Enlace de auto-registro', `Comparte este enlace para que los asistentes se registren solos a "${e.titulo}". Se usa el mismo formulario de registro de asistentes del sistema.`, `#/registro/${id}`),
  });
}

// ---------------------------------------------------------------- Pestaña: Asistentes
function pestanaAsistentes(panel, e, { abierto, recargar }) {
  const id = e.id;
  const m = R.metricasEvento(e, hoy());
  const inscripciones = db.all(`SELECT i.*, p.nombre, p.email, p.empresa FROM inscripciones i
      JOIN participantes p ON p.id = i.participante_id WHERE i.evento_id = ?
      ORDER BY CASE i.estado WHEN 'Confirmado' THEN 0 WHEN 'Lista de espera' THEN 1 ELSE 2 END, i.fecha_registro, i.id`, [id]);
  const disponibles = db.all(`SELECT id, nombre, empresa FROM participantes WHERE id NOT IN
      (SELECT participante_id FROM inscripciones WHERE evento_id = ? AND estado <> 'Cancelado') ORDER BY nombre`, [id]);
  const puedeAsistencia = e.estado !== 'Cancelado' && e.fecha <= hoy();
  let posEspera = 0;

  panel.innerHTML = `
    <div class="dos-columnas detalle">
      <section class="panel">
        <h2>Detalles</h2>
        <dl class="datos">
          <div><dt>Descripción</dt><dd>${esc(e.descripcion) || '—'}</dd></div>
          <div><dt>Ocupación</dt><dd>${m.confirmados} de ${e.capacidad} (${m.ocupacion}%)</dd></div>
        </dl>
        ${BarraProgreso(m.ocupacion)}
      </section>
      <section class="panel">
        <h2>Inscribir asistente</h2>
        ${abierto ? `<form id="form-inscribir" class="inscribir">
            <div class="campo"><label for="sel-part">Participante</label>
              <select id="sel-part" name="participante" required><option value="">Selecciona…</option>
              ${disponibles.map(p => `<option value="${p.id}">${esc(p.nombre)} — ${esc(p.empresa)}</option>`).join('')}</select></div>
            ${Boton({ texto: m.lleno ? 'Agregar a lista de espera' : 'Inscribir', tipo: 'submit', icono: 'mas' })}
          </form>
          <p>${Boton({ texto: 'Registrar asistente nuevo', variante: 'enlace', accion: 'nuevo-participante' })}</p>
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
          { titulo: 'Asistente', render: i => `<b>${esc(i.nombre)}</b><br><span class="tenue">${esc(i.email)}</span>` },
          { titulo: 'Empresa', campo: 'empresa' },
          { titulo: 'Estado', render: i => Insignia(i.estado) + (i.estado === 'Lista de espera' ? ` <span class="tenue chico">#${++posEspera}</span>` : '') },
          { titulo: 'Asistencia', render: i => i.estado !== 'Confirmado' ? '—' : puedeAsistencia
              ? `<label class="interruptor"><input type="checkbox" data-asistencia="${i.id}" ${i.asistio ? 'checked' : ''}><span>${i.asistio ? 'Asistió' : 'Pendiente'}</span></label>`
              : '<span class="tenue">Pendiente</span>' },
          { titulo: 'Acciones', clase: 'acciones', render: i => `
              ${i.estado !== 'Cancelado' ? Boton({ texto: 'Enlace del portal', variante: 'fantasma', icono: 'enlace', soloIcono: true, accion: 'portal', datos: { pid: i.participante_id } }) : ''}
              ${abierto && i.estado !== 'Cancelado' ? Boton({ texto: 'Cancelar inscripción', variante: 'fantasma-peligro', icono: 'cancelar', soloIcono: true, accion: 'cancelar-insc', datos: { id: i.id } }) : ''}` },
        ] })}
    </section>`;

  panel.querySelector('#form-inscribir')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const pid = Number(ev.target.participante.value);
    if (!pid) { toast('Selecciona un participante', 'error'); return; }
    const r = await ejecutar(() => R.inscribir(db, usuario, id, pid, hoy()),
      estado => estado === 'Confirmado' ? 'Inscripción confirmada. Se le envió un aviso.' : 'Evento lleno: se agregó a la lista de espera');
    if (r.ok) recargar();
  });
  panel.onchange = async ev => {
    const chk = ev.target.closest('[data-asistencia]');
    if (!chk) return;
    const r = await ejecutar(() => R.registrarAsistencia(db, usuario, Number(chk.dataset.asistencia), chk.checked, hoy()),
      chk.checked ? 'Check-in registrado' : 'Check-in retirado');
    if (r.ok) recargar(); else chk.checked = !chk.checked;
  };
  panel.onclick = async ev => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const d = b.dataset;
    if (d.accion === 'cancelar-insc') {
      if (!(await confirmar('¿Cancelar esta inscripción? Si hay lista de espera, el siguiente se confirmará automáticamente y sus tareas pendientes quedarán sin asignar.', { textoAceptar: 'Cancelar inscripción' }))) return;
      const r = await ejecutar(() => R.cancelarInscripcion(db, usuario, Number(d.id), hoy()),
        prom => prom.length ? `Inscripción cancelada. ${prom.join(', ')} pasó a confirmado.` : 'Inscripción cancelada');
      if (r.ok) recargar();
    } else if (d.accion === 'nuevo-participante') {
      modalParticipante(null, async nuevoId => {
        const r = await ejecutar(() => R.inscribir(db, usuario, id, nuevoId, hoy()), estado => `Asistente registrado e inscrito (${estado})`);
        recargar();
        return r;
      });
    } else if (d.accion === 'portal') {
      modalPortal(Number(d.pid));
    } else if (d.accion === 'exportar') {
      descargarCSV(`inscritos-evento-${id}.csv`, inscripciones.map(i => ({ ...i, asistio: i.asistio ? 'Sí' : 'No' })), [
        { campo: 'nombre', titulo: 'Nombre' }, { campo: 'email', titulo: 'Correo' }, { campo: 'empresa', titulo: 'Empresa' },
        { campo: 'estado', titulo: 'Estado' }, { campo: 'asistio', titulo: 'Asistió' }, { campo: 'fecha_registro', titulo: 'Registro' },
      ]);
    }
  };
}

// ---------------------------------------------------------------- Pestaña: Tareas
function pestanaTareas(panel, e, { abierto, puedeEditar, recargar }) {
  const tareas = M.listarTareas(db, { eventoId: e.id }, hoy());
  const gestiona = abierto && puedeEditar && R.puede(usuario, 'tarea.gestionar');
  panel.innerHTML = `
    <section class="panel">
      <div class="panel-encabezado"><h2>Seguimiento de tareas</h2>
        ${gestiona ? Boton({ texto: 'Nueva tarea', icono: 'mas', accion: 'nueva-tarea' }) : ''}</div>
      ${ResumenProgreso(M.resumenTareas(tareas))}
      ${!abierto ? '<p class="tenue chico">El evento ya no está activo: las tareas quedan como historial.</p>' : ''}
    </section>
    <section class="panel">${ListaTareas({
      tareas, mostrarEvento: false, vacio: 'Este evento aún no tiene tareas',
      puedeAvance: t => e.estado !== 'Cancelado' && R.puede(usuario, 'tarea.actualizar'),
      acciones: t => gestiona ? `
        ${Boton({ texto: 'Editar tarea', variante: 'fantasma', icono: 'editar', soloIcono: true, accion: 'editar-tarea', datos: { id: t.id } })}
        ${t.estado !== 'Completada' ? Boton({ texto: 'Eliminar tarea', variante: 'fantasma-peligro', icono: 'borrar', soloIcono: true, accion: 'eliminar-tarea', datos: { id: t.id } }) : ''}` : '',
    })}</section>`;
  conAccionesTareas(panel, recargar, { eventoId: e.id });
}

// Manejadores reutilizados por la pestaña Tareas y la pantalla Tareas
function conAccionesTareas(panel, recargar, { eventoId = null } = {}) {
  panel.onchange = async ev => {
    const sel = ev.target.closest('[data-avance]');
    if (!sel) return;
    const r = await ejecutar(() => M.actualizarProgreso(db, { usuario }, Number(sel.dataset.avance), { avance: sel.value }, hoy()),
      x => `Avance actualizado: ${x.avance}% (${x.estado})`);
    recargar(r.ok);
  };
  panel.onclick = async ev => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.accion === 'nueva-tarea') modalTarea(eventoId, null, recargar);
    if (b.dataset.accion === 'editar-tarea') modalTarea(null, db.get('SELECT * FROM tareas WHERE id = ?', [id]), recargar);
    if (b.dataset.accion === 'eliminar-tarea') {
      const t = db.get('SELECT titulo FROM tareas WHERE id = ?', [id]);
      if (!(await confirmar(`¿Eliminar la tarea "${t.titulo}"?`, { textoAceptar: 'Eliminar' }))) return;
      const r = await ejecutar(() => M.eliminarTarea(db, usuario, id), 'Tarea eliminada');
      if (r.ok) recargar();
    }
  };
}

// Modal reutilizable para crear / editar una tarea
function modalTarea(eventoId, t, despues) {
  const evId = t?.evento_id ?? eventoId;
  const ev = db.get('SELECT * FROM eventos WHERE id = ?', [evId]);
  const confirmados = db.all(`SELECT p.id, p.nombre FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
      WHERE i.evento_id = ? AND i.estado = 'Confirmado' ORDER BY p.nombre`, [evId]);
  abrirModal({
    titulo: t ? 'Editar tarea' : `Nueva tarea · ${ev.titulo}`,
    contenido: Formulario({ id: 'form-tarea', cancelarAccion: 'cerrar-modal', textoEnviar: t ? 'Guardar' : 'Asignar tarea', campos: [
      Campo({ nombre: 'titulo', etiqueta: 'Tarea', valor: t?.titulo, requerido: true, placeholder: 'Ej. Confirmar catering' }),
      Campo({ nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', valor: t?.descripcion }),
      Campo({ nombre: 'responsable_id', etiqueta: 'Responsable (asistente confirmado)', valor: t?.responsable_id,
        opciones: confirmados.map(p => ({ valor: p.id, texto: p.nombre })), ayuda: confirmados.length ? 'Recibirá un aviso en su portal' : 'Aún no hay asistentes confirmados: la tarea quedará sin asignar' }),
      Campo({ nombre: 'prioridad', etiqueta: 'Prioridad', valor: t?.prioridad ?? 'Media', opciones: M.PRIORIDADES, requerido: true, ancho: 'medio' }),
      Campo({ nombre: 'fecha_limite', etiqueta: 'Fecha límite', tipo: 'date', valor: t?.fecha_limite ?? ev.fecha, requerido: true, min: hoy(), max: ev.fecha, ancho: 'medio' }),
    ] }),
    onMount: caja => {
      const form = caja.querySelector('form');
      form.onsubmit = async x => {
        x.preventDefault();
        const r = await ejecutar(() => M.guardarTarea(db, usuario, { ...leerFormulario(form), evento_id: evId }, { id: t?.id ?? null, hoy: hoy() }),
          t ? 'Tarea actualizada' : 'Tarea asignada. El responsable recibió un aviso.', form);
        if (r.ok) { cerrarModal(); despues(); }
      };
    },
  });
}

// ---------------------------------------------------------------- Pestaña: Comunicación
function pestanaComunicacion(panel, e, { recargar }) {
  const puedeEnviar = R.puede(usuario, 'comunicado.enviar') && R.puede(usuario, 'evento.editar', e) && e.fecha >= hoy();
  const mensajes = db.all(`SELECT m.*, u.nombre AS usuario, p.nombre AS participante FROM mensajes m
      LEFT JOIN usuarios u ON u.id = m.autor_usuario_id LEFT JOIN participantes p ON p.id = m.autor_participante_id
      WHERE m.evento_id = ? ORDER BY m.id DESC`, [e.id]);
  const avisos = db.all(`SELECT n.*, p.nombre AS participante FROM notificaciones n JOIN participantes p ON p.id = n.participante_id
      WHERE n.evento_id = ? ORDER BY n.id DESC LIMIT 30`, [e.id]);
  const conteo = s => M.correosDeSegmento(db, e.id, s).length;
  panel.innerHTML = `
    <div class="dos-columnas">
      <section class="panel">
        <h2>Enviar comunicado</h2>
        ${puedeEnviar ? Formulario({ id: 'form-comunicado', textoEnviar: 'Enviar comunicado', campos: [
          Campo({ nombre: 'segmento', etiqueta: 'Para', requerido: true, valor: 'Todos',
            opciones: M.SEGMENTOS.map(s => ({ valor: s, texto: `${s} (${conteo(s)})` })) }),
          Campo({ nombre: 'asunto', etiqueta: 'Asunto', requerido: true, placeholder: 'Ej. Cambio de sala' }),
          Campo({ nombre: 'cuerpo', etiqueta: 'Mensaje', tipo: 'textarea', requerido: true }),
        ] }) + `<p class="tenue chico">Cada destinatario lo recibe como aviso en su portal. ${Boton({ texto: 'Abrir también en mi correo', variante: 'enlace', icono: 'enviar', accion: 'mailto' })}</p>`
        : '<p class="tenue">Solo el organizador del evento puede enviar comunicados, y solo antes de que el evento ocurra.</p>'}
      </section>
      <section class="panel"><h2>Mensajes</h2>${ListaMensajes(mensajes, { conAccion: R.puede(usuario, 'mensajes.ver'), vacio: 'Aún no hay mensajes en este evento' })}</section>
    </div>
    <section class="panel"><h2>Avisos enviados automáticamente</h2>
      <p class="tenue chico">Inscripciones, lista de espera, tareas, cambios y comunicados de este evento.</p>
      ${TablaAvisos(avisos)}</section>`;

  const form = panel.querySelector('#form-comunicado');
  if (form) form.onsubmit = async x => {
    x.preventDefault();
    const r = await ejecutar(() => M.enviarComunicado(db, usuario, e.id, leerFormulario(form), hoy()), n => `Comunicado enviado a ${n} asistente(s)`, form);
    if (r.ok) recargar();
  };
  panel.onclick = async x => {
    const b = x.target.closest('[data-accion]');
    if (!b) return;
    if (b.dataset.accion === 'mensaje-leido') {
      const r = await ejecutar(() => M.marcarMensajeLeido(db, usuario, Number(b.dataset.id)), 'Mensaje marcado como leído');
      if (r.ok) recargar();
    }
    if (b.dataset.accion === 'mailto' && form) {
      const d = leerFormulario(form);
      const correos = M.correosDeSegmento(db, e.id, d.segmento);
      if (!correos.length) { toast('Ese grupo no tiene asistentes', 'error'); return; }
      location.href = `mailto:?bcc=${encodeURIComponent(correos.join(','))}&subject=${encodeURIComponent(d.asunto || e.titulo)}&body=${encodeURIComponent(d.cuerpo || '')}`;
    }
  };
}

// ---------------------------------------------------------------- Modales de enlaces
function modalEnlace(titulo, explicacion, ruta) {
  const url = `${location.origin}${location.pathname}${ruta}`;
  abrirModal({
    titulo,
    contenido: `<p>${esc(explicacion)}</p>
      <div class="campo"><label for="enlace-url">Enlace</label><input id="enlace-url" readonly value="${esc(url)}"></div>
      <div class="form-acciones">${Boton({ texto: 'Abrir', variante: 'secundario', href: ruta })}${Boton({ texto: 'Copiar enlace', icono: 'enlace', accion: 'copiar' })}</div>`,
    onMount: caja => caja.addEventListener('click', async x => {
      if (!x.target.closest('[data-accion="copiar"]')) return;
      try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { caja.querySelector('#enlace-url').select(); toast('Selecciona y copia el enlace', 'error'); }
    }),
  });
}

async function modalPortal(participanteId) {
  const r = await ejecutar(() => M.obtenerAccesoPortal(db, usuario, participanteId));
  if (!r.ok) return;
  const p = db.get('SELECT nombre FROM participantes WHERE id = ?', [participanteId]);
  modalEnlace(`Portal de ${p.nombre}`, 'Enlace personal: con él, el asistente ve sus eventos, sus tareas y sus avisos, actualiza el avance de sus tareas y escribe al organizador. No lo compartas con otras personas.', `#/portal/${r.r}`);
}

// ================================================================ Modal reutilizable: participante (formulario de asistente)
function modalParticipante(p, despues = null) {
  abrirModal({
    titulo: p ? 'Editar asistente' : 'Registrar asistente',
    contenido: FormularioAsistente({ id: 'form-participante', p: p ?? {}, cancelarAccion: 'cerrar-modal', textoEnviar: p ? 'Guardar' : 'Registrar' }),
    onMount: caja => {
      const form = caja.querySelector('form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        const r = await ejecutar(() => R.guardarParticipante(db, usuario, leerFormulario(form), p?.id ?? null), despues ? null : 'Asistente guardado', form);
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
        ${Boton({ texto: 'Enlace del portal', variante: 'fantasma', icono: 'enlace', soloIcono: true, accion: 'portal', datos: { id: p.id } })}
        ${Boton({ texto: 'Editar', variante: 'fantasma', icono: 'editar', soloIcono: true, accion: 'editar', datos: { id: p.id } })}
        ${R.puede(usuario, 'participante.eliminar') ? Boton({ texto: 'Eliminar', variante: 'fantasma-peligro', icono: 'borrar', soloIcono: true, accion: 'eliminar', datos: { id: p.id } }) : ''}` },
    ] });
  };
  document.getElementById('p-q').oninput = pintar;
  pintar();

  alClic({
    nuevo: () => modalParticipante(null),
    portal: ({ id }) => modalPortal(Number(id)),
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

// ================================================================ Pantalla: Tareas (seguimiento de progreso)
function pantallaTareas() {
  const esOrganizador = usuario.rol === 'Organizador';
  const eventos = db.all(`SELECT id, titulo FROM eventos WHERE estado <> 'Cancelado' ${esOrganizador ? 'AND organizador_id = ?' : ''} ORDER BY fecha`, esOrganizador ? [usuario.id] : []);
  const responsables = db.all('SELECT DISTINCT p.id, p.nombre FROM tareas t JOIN participantes p ON p.id = t.responsable_id ORDER BY p.nombre');
  const f0 = { evento: '', estado: '', responsable: '', vencidas: parametros.get('vencidas') === '1' };

  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Tareas', subtitulo: esOrganizador ? 'Tareas de los eventos que organizas' : 'Seguimiento de las tareas de todos los eventos' })}
    <section class="kpis" id="kpis-tareas" aria-label="Indicadores de tareas"></section>
    <div class="dos-columnas form-layout">
      <div>
        <form class="filtros panel filtros-tareas" id="filtros-tareas" role="search">
          <div class="campo"><label for="ft-evento">Evento</label><select id="ft-evento" name="evento"><option value="">Todos</option>
            ${eventos.map(e => `<option value="${e.id}">${esc(e.titulo)}</option>`).join('')}</select></div>
          <div class="campo"><label for="ft-estado">Estado</label><select id="ft-estado" name="estado"><option value="">Todos</option>
            ${M.ESTADOS_TAREA.map(x => `<option>${x}</option>`).join('')}</select></div>
          <div class="campo"><label for="ft-resp">Responsable</label><select id="ft-resp" name="responsable"><option value="">Todos</option><option value="sin">Sin asignar</option>
            ${responsables.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" name="vencidas" ${f0.vencidas ? 'checked' : ''}><span>Solo vencidas</span></label>
        </form>
        <section class="panel" id="lista-tareas" aria-live="polite"></section>
      </div>
      <aside class="panel"><h2>Avance por evento</h2><div id="avance-eventos"></div></aside>
    </div>`;

  const form = document.getElementById('filtros-tareas');
  const pintar = () => {
    const f = leerFormulario(form);
    const filtro = { eventoId: f.evento || null, estado: f.estado, responsableId: f.responsable || null, soloVencidas: !!f.vencidas, organizadorId: esOrganizador ? usuario.id : null };
    const tareas = M.listarTareas(db, filtro, hoy());
    const todas = M.resumenTareas(M.listarTareas(db, { organizadorId: filtro.organizadorId }, hoy()));
    document.getElementById('kpis-tareas').innerHTML = `
      ${TarjetaKPI({ titulo: 'Avance general', valor: `${todas.avance}%`, detalle: `${todas.total} tareas`, icono: 'tarea', tono: 'morado' })}
      ${TarjetaKPI({ titulo: 'Completadas', valor: todas.completadas, icono: 'check', tono: 'verde' })}
      ${TarjetaKPI({ titulo: 'En progreso', valor: todas.enProgreso, detalle: `${todas.pendientes} pendientes`, icono: 'reloj', tono: 'azul' })}
      ${TarjetaKPI({ titulo: 'Vencidas', valor: todas.vencidas, detalle: `${todas.sinAsignar} sin asignar`, icono: 'cancelar', tono: todas.vencidas ? 'rojo' : 'verde' })}`;
    document.getElementById('lista-tareas').innerHTML = `<p class="tenue">${tareas.length} tarea(s)</p>` + ListaTareas({
      tareas, vacio: 'No hay tareas con esos filtros',
      puedeAvance: t => t.estado_evento !== 'Cancelado' && R.puede(usuario, 'tarea.actualizar'),
      acciones: t => {
        const ev = db.get('SELECT * FROM eventos WHERE id = ?', [t.evento_id]);
        return R.puede(usuario, 'tarea.gestionar') && R.puede(usuario, 'evento.editar', ev) && ev.estado !== 'Cancelado' && ev.fecha >= hoy()
          ? Boton({ texto: 'Editar tarea', variante: 'fantasma', icono: 'editar', soloIcono: true, accion: 'editar-tarea', datos: { id: t.id } }) : '';
      },
    });
    const avance = db.all(`SELECT v.* FROM v_avance_tareas v JOIN eventos e ON e.id = v.evento_id
        WHERE v.total > 0 AND e.estado <> 'Cancelado' ${esOrganizador ? 'AND e.organizador_id = ?' : ''} ORDER BY v.fecha`, esOrganizador ? [usuario.id] : []);
    document.getElementById('avance-eventos').innerHTML = avance.length ? `<ul class="avance-eventos">${avance.map(a => `<li>
        <a class="enlace-fuerte" href="#/eventos/${a.evento_id}?tab=tareas">${esc(a.titulo)}</a>
        <span class="tenue chico">${esc(fechaLarga(a.fecha))} · ${a.completadas}/${a.total} completadas${a.sin_asignar ? ` · ${a.sin_asignar} sin asignar` : ''}</span>
        ${BarraProgreso(a.avance_promedio, `Avance de ${a.titulo}`)}<span class="chico">${a.avance_promedio}%</span></li>`).join('')}</ul>` : EstadoVacio('Sin tareas');
  };
  form.oninput = pintar;
  form.onsubmit = x => x.preventDefault();
  pintar();
  conAccionesTareas(contenido(), () => pintar());
}

// ================================================================ Pantalla: Comunicación
function pantallaComunicacion() {
  const recibidos = db.all(`SELECT m.*, p.nombre AS participante, e.titulo AS evento FROM mensajes m
      JOIN participantes p ON p.id = m.autor_participante_id JOIN eventos e ON e.id = m.evento_id
      WHERE m.direccion = 'Asistente a organizador' ORDER BY m.leido, m.id DESC`);
  const enviados = db.all(`SELECT m.*, u.nombre AS usuario, e.titulo AS evento FROM mensajes m
      JOIN usuarios u ON u.id = m.autor_usuario_id JOIN eventos e ON e.id = m.evento_id
      WHERE m.direccion = 'Organizador a asistentes' ORDER BY m.id DESC`);
  const avisos = db.all(`SELECT n.*, p.nombre AS participante, e.titulo AS evento FROM notificaciones n
      JOIN participantes p ON p.id = n.participante_id LEFT JOIN eventos e ON e.id = n.evento_id ORDER BY n.id DESC LIMIT 15`);
  const porTipo = db.all('SELECT tipo, COUNT(*) AS n FROM notificaciones GROUP BY tipo ORDER BY n DESC');
  const sinLeer = recibidos.filter(m => !m.leido).length;
  contenido().innerHTML = `
    ${EncabezadoPagina({ titulo: 'Comunicación', subtitulo: 'Mensajes de los asistentes, comunicados enviados y avisos automáticos' })}
    <section class="kpis" aria-label="Indicadores de comunicación">
      ${TarjetaKPI({ titulo: 'Mensajes sin leer', valor: sinLeer, detalle: `${recibidos.length} recibidos`, icono: 'mensaje', tono: sinLeer ? 'rojo' : 'verde' })}
      ${TarjetaKPI({ titulo: 'Comunicados enviados', valor: enviados.length, detalle: `${enviados.reduce((s, m) => s + m.destinatarios, 0)} destinatarios`, icono: 'enviar', tono: 'azul' })}
      ${TarjetaKPI({ titulo: 'Avisos automáticos', valor: db.get('SELECT COUNT(*) AS n FROM notificaciones').n, detalle: porTipo.slice(0, 2).map(t => `${t.n} ${t.tipo.toLowerCase()}`).join(' · '), icono: 'campana', tono: 'morado' })}
      ${TarjetaKPI({ titulo: 'Avisos leídos', valor: `${Math.round(100 * (db.get('SELECT AVG(leida) AS a FROM notificaciones').a || 0))}%`, detalle: 'por los asistentes', icono: 'check', tono: 'amarillo' })}
    </section>
    <div class="dos-columnas">
      <section class="panel"><h2>Bandeja de entrada (asistentes)</h2>${ListaMensajes(recibidos, { conAccion: true, vacio: 'No hay mensajes de asistentes' })}</section>
      <section class="panel"><h2>Comunicados enviados</h2>${ListaMensajes(enviados, { vacio: 'Aún no se han enviado comunicados' })}</section>
    </div>
    <section class="panel"><h2>Últimos avisos automáticos</h2>${TablaAvisos(avisos, { mostrarEvento: true })}</section>`;
  alClic({
    'mensaje-leido': async ({ id }) => {
      const r = await ejecutar(() => M.marcarMensajeLeido(db, usuario, Number(id)), 'Mensaje marcado como leído');
      if (r.ok) render();
    },
  });
}

// ================================================================ Pantallas públicas del asistente
function marcoPublico(contenidoHtml) {
  app.innerHTML = `<div class="publico">
    <header class="publico-barra"><div class="logo"><span class="logo-marca" aria-hidden="true">G</span><span class="logo-texto">GCS <b>Eventos</b></span></div>
      ${usuario ? Boton({ texto: 'Volver al sistema', variante: 'fantasma', icono: 'volver', href: '#/inicio' }) : ''}</header>
    <main id="contenido" class="publico-contenido" tabindex="-1">${contenidoHtml}</main></div>`;
}

function pantallaPortal(token) {
  let datos;
  try { datos = M.datosPortal(db, token, hoy()); } catch (err) {
    marcoPublico(`<section class="panel"><h1>Enlace no válido</h1><p>${esc(err.message)}. Pide al organizador que te envíe tu enlace personal.</p></section>`);
    return;
  }
  const { participante: p, eventos, tareas, avisos, mensajes, noLeidos } = datos;
  const pendientes = tareas.filter(t => t.estado !== 'Completada');
  const proximos = eventos.filter(e => e.fecha >= hoy() && e.estado !== 'Cancelado');
  let pestana = parametros.get('tab') || (noLeidos ? 'avisos' : 'tareas');

  marcoPublico(`
    ${EncabezadoPagina({ titulo: `Hola, ${p.nombre.split(' ')[0]}`, subtitulo: `Portal del asistente · ${p.email}` })}
    <section class="kpis" aria-label="Resumen">
      ${TarjetaKPI({ titulo: 'Mis próximos eventos', valor: proximos.length, icono: 'eventos', tono: 'azul' })}
      ${TarjetaKPI({ titulo: 'Tareas por hacer', valor: pendientes.length, detalle: `${tareas.filter(t => t.vencida).length} vencida(s)`, icono: 'tarea', tono: tareas.some(t => t.vencida) ? 'rojo' : 'morado' })}
      ${TarjetaKPI({ titulo: 'Avisos sin leer', valor: noLeidos, icono: 'campana', tono: noLeidos ? 'amarillo' : 'verde' })}
      ${TarjetaKPI({ titulo: 'Avance de mis tareas', valor: `${M.resumenTareas(tareas).avance}%`, icono: 'check', tono: 'verde' })}
    </section>
    <div id="zona-portal"></div>`);

  const pintar = () => {
    const z = document.getElementById('zona-portal');
    z.innerHTML = Pestanas('portal', [
      { clave: 'tareas', texto: 'Mis tareas', icono: 'tarea', contador: pendientes.length },
      { clave: 'eventos', texto: 'Mis eventos', icono: 'calendario', contador: proximos.length },
      { clave: 'avisos', texto: 'Avisos', icono: 'campana', contador: noLeidos || '' },
      { clave: 'mensajes', texto: 'Escribir al organizador', icono: 'mensaje' },
    ], pestana);
    const panel = document.getElementById('panel-portal');
    if (pestana === 'tareas') {
      panel.innerHTML = `<section class="panel"><h2>Mis tareas</h2><p class="tenue chico">Actualiza tu avance: el organizador lo ve al momento.</p>
        ${ListaTareas({ tareas, mostrarResponsable: false, vacio: 'No tienes tareas asignadas', puedeAvance: t => t.estado_evento !== 'Cancelado' })}</section>`;
    } else if (pestana === 'eventos') {
      panel.innerHTML = `<div class="dos-columnas"><section class="panel"><h2>Mis eventos</h2>
          ${eventos.length ? `<ul class="lista-eventos">${eventos.map(e => `<li><div class="tarjeta-evento">
            <div class="fecha-chip"><span>${esc(fechaLarga(e.fecha).split(' ').slice(2, 3).join(' ').toUpperCase())}</span><b>${Number(e.fecha.slice(8))}</b></div>
            <div class="tarjeta-cuerpo"><p class="tarjeta-titulo">${esc(e.titulo)}</p><p class="tenue">${esc(e.hora_inicio)}–${esc(e.hora_fin)} · ${esc(e.sede)}</p></div>
            <div>${Insignia(e.estado === 'Cancelado' ? 'Cancelado' : e.mi_estado)}</div></div></li>`).join('')}</ul>` : EstadoVacio('No estás inscrito a ningún evento')}
        </section><section class="panel"><h2>Calendario</h2><div id="cal-portal"></div></section></div>`;
      montarCalendario(document.getElementById('cal-portal'), { hoy: hoy(), fechaInicial: proximos[0]?.fecha || hoy(), cargarEventos: eventosDelMes({ participanteId: p.id }), compacto: true });
    } else if (pestana === 'avisos') {
      panel.innerHTML = `<section class="panel"><div class="panel-encabezado"><h2>Avisos</h2>
          ${noLeidos ? Boton({ texto: 'Marcar todo como leído', variante: 'secundario', icono: 'check', accion: 'todos-leidos' }) : ''}</div>
        ${ListaAvisos(avisos, { conAccion: true })}</section>`;
    } else {
      const activos = eventos.filter(e => e.fecha >= hoy() && e.estado !== 'Cancelado');
      panel.innerHTML = `<div class="dos-columnas"><section class="panel"><h2>Escribir al organizador</h2>
          ${activos.length ? Formulario({ id: 'form-mensaje', textoEnviar: 'Enviar mensaje', campos: [
            Campo({ nombre: 'evento_id', etiqueta: 'Evento', requerido: true, valor: activos[0].id, opciones: activos.map(e => ({ valor: e.id, texto: e.titulo })) }),
            Campo({ nombre: 'asunto', etiqueta: 'Asunto', requerido: true }),
            Campo({ nombre: 'cuerpo', etiqueta: 'Mensaje', tipo: 'textarea', requerido: true }),
          ] }) : '<p class="tenue">No tienes eventos próximos.</p>'}</section>
        <section class="panel"><h2>Mensajes que enviaste</h2>${ListaMensajes(mensajes.map(m => ({ ...m, participante: 'Tú', leido: 1 })), { vacio: 'Aún no has enviado mensajes' })}</section></div>`;
      const form = document.getElementById('form-mensaje');
      if (form) form.onsubmit = async x => {
        x.preventDefault();
        const r = await ejecutar(() => M.mensajeDeAsistente(db, token, leerFormulario(form).evento_id, leerFormulario(form), hoy()), 'Mensaje enviado al organizador', form);
        if (r.ok) { parametros.set('tab', 'mensajes'); pantallaPortal(token); }
      };
    }
  };
  pintar();
  const z = document.getElementById('contenido');
  z.onclick = async x => {
    const b = x.target.closest('[data-accion]');
    if (!b) return;
    if (b.dataset.accion === 'tab') { pestana = b.dataset.tab; history.replaceState(null, '', `#/portal/${token}?tab=${pestana}`); pintar(); document.getElementById(`tab-portal-${pestana}`)?.focus(); }
    if (b.dataset.accion === 'todos-leidos' || b.dataset.accion === 'aviso-leido') {
      const r = await ejecutar(() => M.marcarAvisosLeidos(db, token, b.dataset.id ? Number(b.dataset.id) : null));
      if (r.ok) { parametros.set('tab', 'avisos'); pantallaPortal(token); }
    }
  };
  z.onchange = async x => {
    const sel = x.target.closest('[data-avance]');
    if (!sel) return;
    const r = await ejecutar(() => M.actualizarProgreso(db, { participanteId: p.id }, Number(sel.dataset.avance), { avance: sel.value }, hoy()),
      a => `Avance guardado: ${a.avance}% (${a.estado})`);
    parametros.set('tab', 'tareas'); pantallaPortal(token);
    return r;
  };
}

function pantallaRegistro(eventoId) {
  const e = db.get('SELECT * FROM v_eventos_resumen WHERE id = ?', [eventoId]);
  if (!e || e.estado === 'Cancelado' || e.fecha < hoy()) {
    marcoPublico(`<section class="panel"><h1>Registro no disponible</h1><p>${!e ? 'El evento no existe.' : e.estado === 'Cancelado' ? 'El evento fue cancelado.' : 'El evento ya se realizó.'}</p></section>`);
    return;
  }
  const m = R.metricasEvento(e, hoy());
  marcoPublico(`
    <div class="dos-columnas form-layout">
      <section class="panel">
        <p class="tenue">Registro al evento</p><h1 tabindex="-1">${esc(e.titulo)}</h1>
        <p class="insignias">${Insignia(e.tipo)} ${m.lleno ? Insignia('Lista de espera') : `<span class="tenue">${m.disponibles} lugar(es) disponible(s)</span>`}</p>
        ${FormularioAsistente({ id: 'form-registro', textoEnviar: m.lleno ? 'Anotarme en lista de espera' : 'Registrarme', conPrivacidad: true })}
      </section>
      <aside class="panel"><h2>Detalles</h2><dl class="datos">
        <div><dt>Fecha</dt><dd>${esc(fechaLarga(e.fecha))}</dd></div><div><dt>Horario</dt><dd>${esc(e.hora_inicio)} – ${esc(e.hora_fin)}</dd></div>
        <div><dt>Sede</dt><dd>${esc(e.sede)}</dd></div><div><dt>Descripción</dt><dd>${esc(e.descripcion) || '—'}</dd></div></dl>
        ${BarraProgreso(m.ocupacion)}<p class="tenue chico">${m.confirmados} de ${e.capacidad} lugares ocupados</p></aside>
    </div>`);
  const form = document.getElementById('form-registro');
  form.onsubmit = async x => {
    x.preventDefault();
    const d = leerFormulario(form);
    const r = await ejecutar(() => M.autoRegistro(db, eventoId, d, hoy()), null, form);
    if (!r.ok) return;
    const { estado, token, nombre } = r.r;
    document.getElementById('contenido').innerHTML = `<section class="panel resultado-registro">
      <span class="kpi-icono ${estado === 'Confirmado' ? 'tono-verde' : 'tono-amarillo'}">${Icono(estado === 'Confirmado' ? 'check' : 'reloj')}</span>
      <h1 tabindex="-1">${estado === 'Confirmado' ? '¡Listo, tu lugar está confirmado!' : 'Quedaste en lista de espera'}</h1>
      <p>${esc(nombre)}, ${estado === 'Confirmado' ? `te esperamos en "${esc(e.titulo)}" el ${esc(fechaLarga(e.fecha))}.` : 'el evento está lleno; si se libera un lugar te confirmaremos automáticamente.'}</p>
      <p>Guarda tu enlace personal: ahí verás tus avisos y tareas, y podrás escribir al organizador.</p>
      <p>${Boton({ texto: 'Ir a mi portal', icono: 'enlace', href: `#/portal/${token}` })}</p></section>`;
    document.querySelector('#contenido h1').focus();
  };
}

iniciar();
