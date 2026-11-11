// Componentes reutilizables de interfaz (equivalente a los "building blocks" / snippets de Mendix).
// Cada función devuelve HTML listo para insertar y se usa en varias pantallas.

import { escapeHtml as esc } from './security.js';

export { esc };

// ------------------------------------------------------------------ Íconos
const ICONOS = {
  inicio: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  eventos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  personas: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>',
  sede: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  bitacora: '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h8M9 17h8"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  borrar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  descargar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dinero: '<path d="M12 3v18M16 7c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.6 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  volver: '<path d="M15 5l-7 7 7 7"/>',
  cancelar: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  tarea: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
  mensaje: '<path d="M4 5h16v11H9l-5 4z"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  enviar: '<path d="M4 12l16-8-6 16-3-7z"/>',
  izquierda: '<path d="M15 5l-7 7 7 7"/>',
  derecha: '<path d="M9 5l7 7-7 7"/>',
};

export function Icono(nombre, clase = '') {
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ''}</svg>`;
}

// ------------------------------------------------------------------ Botón
export function Boton({ texto, variante = 'primario', icono = null, tipo = 'button', accion = null, datos = {}, href = null, deshabilitado = false, soloIcono = false, titulo = '' }) {
  const attrs = Object.entries(datos).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  const contenido = `${icono ? Icono(icono) : ''}${soloIcono ? `<span class="sr-only">${esc(texto)}</span>` : `<span>${esc(texto)}</span>`}`;
  const clase = `btn btn-${variante}${soloIcono ? ' btn-icono' : ''}`;
  const t = titulo || (soloIcono ? texto : '');
  if (href) return `<a class="${clase}" href="${esc(href)}" ${t ? `title="${esc(t)}"` : ''}>${contenido}</a>`;
  return `<button type="${tipo}" class="${clase}" ${accion ? `data-accion="${esc(accion)}"` : ''} ${attrs} ${deshabilitado ? 'disabled' : ''} ${t ? `title="${esc(t)}"` : ''}>${contenido}</button>`;
}

// ------------------------------------------------------------------ Campo de formulario
let contador = 0;
export function Campo({ nombre, etiqueta, tipo = 'text', valor = '', opciones = null, requerido = false, ayuda = '', placeholder = '', min = null, max = null, paso = null, ancho = 'completo', autocompletar = null }) {
  const id = `campo-${nombre}-${++contador}`;
  const ayudaId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const req = requerido ? 'required aria-required="true"' : '';
  const extra = [
    min != null ? `min="${esc(min)}"` : '', max != null ? `max="${esc(max)}"` : '', paso != null ? `step="${esc(paso)}"` : '',
    placeholder ? `placeholder="${esc(placeholder)}"` : '', autocompletar ? `autocomplete="${esc(autocompletar)}"` : '',
  ].join(' ');
  const describe = `aria-describedby="${ayuda ? ayudaId + ' ' : ''}${errorId}"`;
  let control;
  if (opciones) {
    const ops = opciones.map(o => {
      const v = typeof o === 'object' ? o.valor : o;
      const t = typeof o === 'object' ? o.texto : o;
      return `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(t)}</option>`;
    }).join('');
    control = `<select id="${id}" name="${esc(nombre)}" ${req} ${describe}><option value="">Selecciona…</option>${ops}</select>`;
  } else if (tipo === 'textarea') {
    control = `<textarea id="${id}" name="${esc(nombre)}" rows="3" ${req} ${describe} ${extra}>${esc(valor)}</textarea>`;
  } else {
    control = `<input id="${id}" name="${esc(nombre)}" type="${esc(tipo)}" value="${esc(valor)}" ${req} ${describe} ${extra}>`;
  }
  return `<div class="campo campo-${ancho}" data-campo="${esc(nombre)}">
    <label for="${id}">${esc(etiqueta)}${requerido ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
    ${control}
    ${ayuda ? `<small id="${ayudaId}" class="ayuda">${esc(ayuda)}</small>` : ''}
    <small id="${errorId}" class="error-campo" role="alert"></small>
  </div>`;
}

// ------------------------------------------------------------------ Formulario
export function Formulario({ id, campos, textoEnviar = 'Guardar', cancelarHref = null, cancelarAccion = null }) {
  return `<form id="${esc(id)}" class="formulario" novalidate>
    <div class="form-grid">${campos.join('')}</div>
    <div class="form-error" role="alert" hidden></div>
    <div class="form-acciones">
      ${cancelarHref ? Boton({ texto: 'Cancelar', variante: 'secundario', href: cancelarHref }) : ''}
      ${cancelarAccion ? Boton({ texto: 'Cancelar', variante: 'secundario', accion: cancelarAccion }) : ''}
      ${Boton({ texto: textoEnviar, tipo: 'submit', icono: 'check' })}
    </div>
  </form>`;
}

export function leerFormulario(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function mostrarErrores(form, err) {
  form.querySelectorAll('.campo').forEach(c => {
    c.classList.remove('con-error');
    c.querySelector('.error-campo').textContent = '';
    c.querySelector('input,select,textarea')?.removeAttribute('aria-invalid');
  });
  const general = form.querySelector('.form-error');
  general.hidden = true;
  if (!err) return;
  const errores = err.errores || {};
  let primero = null;
  for (const [campo, msg] of Object.entries(errores)) {
    const c = form.querySelector(`[data-campo="${campo}"]`);
    if (!c) continue;
    c.classList.add('con-error');
    c.querySelector('.error-campo').textContent = msg;
    const ctrl = c.querySelector('input,select,textarea');
    ctrl?.setAttribute('aria-invalid', 'true');
    primero ??= ctrl;
  }
  general.textContent = err.message || 'Ocurrió un error';
  general.hidden = false;
  primero?.focus();
}

// ------------------------------------------------------------------ Tabla / lista
export function Tabla({ columnas, filas, vacio = 'No hay registros', claseFila = null }) {
  if (!filas.length) return EstadoVacio(vacio);
  return `<div class="tabla-contenedor"><table class="tabla">
    <thead><tr>${columnas.map(c => `<th scope="col" class="${c.clase || ''}">${esc(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr class="${claseFila ? claseFila(f) : ''}">${columnas.map(c => `<td data-etiqueta="${esc(c.titulo)}" class="${c.clase || ''}">${c.render ? c.render(f) : esc(f[c.campo])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function EstadoVacio(texto) {
  return `<div class="vacio">${Icono('eventos', 'icono-grande')}<p>${esc(texto)}</p></div>`;
}

// ------------------------------------------------------------------ Tarjetas, insignias, progreso
export function TarjetaKPI({ titulo, valor, detalle = '', icono = 'eventos', tono = 'azul' }) {
  return `<article class="kpi kpi-${tono}">
    <div class="kpi-icono">${Icono(icono)}</div>
    <div><p class="kpi-titulo">${esc(titulo)}</p><p class="kpi-valor">${esc(valor)}</p>${detalle ? `<p class="kpi-detalle">${esc(detalle)}</p>` : ''}</div>
  </article>`;
}

const TONOS_ESTADO = {
  'Próximo': 'azul', 'Hoy': 'verde', 'Finalizado': 'gris', 'Cancelado': 'rojo',
  'Confirmado': 'verde', 'Planeado': 'amarillo', 'Lista de espera': 'amarillo',
  'Activo': 'verde', 'Inactivo': 'gris', 'Lleno': 'rojo',
  'Pendiente': 'gris', 'En progreso': 'azul', 'Completada': 'verde', 'Vencida': 'rojo',
  'Alta': 'rojo', 'Media': 'amarillo', 'Baja': 'gris', 'Sin asignar': 'amarillo', 'Nuevo': 'azul', 'Leído': 'gris',
};
export function Insignia(texto) {
  return `<span class="insignia insignia-${TONOS_ESTADO[texto] || 'gris'}">${esc(texto)}</span>`;
}

// modo 'ocupacion': lleno = alerta (rojo). modo 'avance': completo = bien (verde).
export function BarraProgreso(pct, etiqueta = 'Ocupación', modo = /avance/i.test(etiqueta) ? 'avance' : 'ocupacion') {
  const v = Math.min(Math.max(pct, 0), 100);
  const tono = modo === 'avance' ? (v >= 100 ? 'verde' : 'azul') : v >= 100 ? 'rojo' : v >= 80 ? 'amarillo' : 'verde';
  return `<div class="progreso" role="progressbar" aria-label="${esc(etiqueta)}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100">
    <div class="progreso-barra progreso-${tono}" style="width:${v}%"></div></div>`;
}

export function EncabezadoPagina({ titulo, subtitulo = '', acciones = '' }) {
  return `<header class="pagina-encabezado">
    <div><h1 tabindex="-1">${esc(titulo)}</h1>${subtitulo ? `<p class="subtitulo">${esc(subtitulo)}</p>` : ''}</div>
    <div class="pagina-acciones">${acciones}</div>
  </header>`;
}

// ------------------------------------------------------------------ Menú lateral
export function Menu(items, activo) {
  return `<nav aria-label="Menú principal"><ul class="menu">${items.map(i => `
    <li><a href="${esc(i.href)}" class="${i.clave === activo ? 'activo' : ''}" ${i.clave === activo ? 'aria-current="page"' : ''}>${Icono(i.icono)}<span>${esc(i.texto)}</span></a></li>`).join('')}
  </ul></nav>`;
}

// ------------------------------------------------------------------ Notificaciones (toast)
export function toast(mensaje, tipo = 'exito') {
  const zona = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensaje;
  zona.appendChild(el);
  setTimeout(() => el.classList.add('saliendo'), 3500);
  setTimeout(() => el.remove(), 4000);
}

// ------------------------------------------------------------------ Modal accesible
let alCerrar = null;
let focoPrevio = null;
export function abrirModal({ titulo, contenido, onMount = null }) {
  const raiz = document.getElementById('modal');
  focoPrevio = document.activeElement;
  raiz.innerHTML = `<div class="modal-fondo" data-cerrar-modal></div>
    <div class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <header class="modal-encabezado"><h2 id="modal-titulo">${esc(titulo)}</h2>
        ${Boton({ texto: 'Cerrar', variante: 'fantasma', icono: 'cerrar', soloIcono: true, accion: 'cerrar-modal' })}</header>
      <div class="modal-cuerpo">${contenido}</div>
    </div>`;
  raiz.hidden = false;
  document.body.classList.add('sin-scroll');
  const cerrarFn = e => {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'click' && !e.target.closest('[data-cerrar-modal],[data-accion="cerrar-modal"]')) return;
    cerrarModal();
  };
  raiz.addEventListener('click', cerrarFn);
  document.addEventListener('keydown', cerrarFn);
  alCerrar = () => { raiz.removeEventListener('click', cerrarFn); document.removeEventListener('keydown', cerrarFn); };
  onMount?.(raiz.querySelector('.modal-caja'));
  (raiz.querySelector('.modal-cuerpo input, .modal-cuerpo select, .modal-cuerpo button') || raiz.querySelector('button'))?.focus();
}

export function cerrarModal() {
  const raiz = document.getElementById('modal');
  alCerrar?.();
  alCerrar = null;
  raiz.hidden = true;
  raiz.innerHTML = '';
  document.body.classList.remove('sin-scroll');
  focoPrevio?.focus?.();
}

export function confirmar(mensaje, { textoAceptar = 'Sí, continuar', peligro = true } = {}) {
  return new Promise(resolve => {
    let respondido = false;
    abrirModal({
      titulo: 'Confirmar acción',
      contenido: `<p>${esc(mensaje)}</p><div class="form-acciones">
        ${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'conf-no' })}
        ${Boton({ texto: textoAceptar, variante: peligro ? 'peligro' : 'primario', accion: 'conf-si' })}</div>`,
      onMount: caja => {
        caja.addEventListener('click', e => {
          const a = e.target.closest('[data-accion]')?.dataset.accion;
          if (a === 'conf-si' || a === 'conf-no') { respondido = true; cerrarModal(); resolve(a === 'conf-si'); }
        });
        const obs = new MutationObserver(() => { if (!caja.isConnected) { obs.disconnect(); if (!respondido) resolve(false); } });
        obs.observe(document.getElementById('modal'), { childList: true });
      },
    });
  });
}

// ------------------------------------------------------------------ Formatos
export const dinero = n => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
export function fechaLarga(f) {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}


// ------------------------------------------------------------------ Pestañas (tabs accesibles)
export function Pestanas(id, pestanas, activa) {
  return `<div class="pestanas" role="tablist" aria-label="Secciones">${pestanas.map(p => `
    <button type="button" role="tab" id="tab-${esc(id)}-${esc(p.clave)}" aria-selected="${p.clave === activa}"
      aria-controls="panel-${esc(id)}" class="pestana ${p.clave === activa ? 'activa' : ''}" data-accion="tab" data-tab="${esc(p.clave)}">
      ${p.icono ? Icono(p.icono) : ''}<span>${esc(p.texto)}</span>${p.contador ? `<span class="contador">${esc(p.contador)}</span>` : ''}
    </button>`).join('')}</div>
    <div id="panel-${esc(id)}" role="tabpanel" aria-labelledby="tab-${esc(id)}-${esc(activa)}" class="panel-pestana"></div>`;
}

// ------------------------------------------------------------------ Formulario de registro de asistentes (reutilizable)
// Se usa en: directorio de participantes, detalle del evento, página pública de auto-registro y portal del asistente.
export function camposAsistente(p = {}, { conPrivacidad = false } = {}) {
  const campos = [
    Campo({ nombre: 'nombre', etiqueta: 'Nombre completo', valor: p.nombre, requerido: true, autocompletar: 'name' }),
    Campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', valor: p.email, requerido: true, autocompletar: 'email', placeholder: 'nombre@empresa.com' }),
    Campo({ nombre: 'empresa', etiqueta: 'Empresa', valor: p.empresa ?? 'Global Consulting Services', ancho: 'medio', autocompletar: 'organization' }),
    Campo({ nombre: 'area', etiqueta: 'Área o puesto', valor: p.area, ancho: 'medio' }),
    Campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: p.telefono, ayuda: '10 dígitos (opcional)', autocompletar: 'tel' }),
  ];
  if (conPrivacidad) {
    campos.push(`<div class="campo" data-campo="acepta"><label class="check"><input type="checkbox" name="acepta" required>
      <span>Acepto que GCS use mis datos solo para gestionar este evento (aviso de privacidad).</span></label>
      <small class="error-campo" role="alert"></small></div>`);
  }
  return campos;
}

export function FormularioAsistente({ id = 'form-asistente', p = {}, textoEnviar = 'Guardar', cancelarAccion = null, conPrivacidad = false }) {
  return Formulario({ id, campos: camposAsistente(p, { conPrivacidad }), textoEnviar, cancelarAccion });
}

// ------------------------------------------------------------------ Calendario mensual (reutilizable)
// Se usa en: inicio (compacto), agenda de eventos (completo), formulario de evento (ocupación de la sede) y portal del asistente.
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const p2 = n => String(n).padStart(2, '0');

export function Calendario({ anio, mes, eventos = [], hoy, seleccionado = null, compacto = false, titulo = '' }) {
  const primero = new Date(anio, mes, 1);
  const inicio = (primero.getDay() + 6) % 7;               // semana inicia en lunes
  const dias = new Date(anio, mes + 1, 0).getDate();
  const porDia = {};
  for (const e of eventos) (porDia[e.fecha] ??= []).push(e);
  const celdas = [];
  for (let i = 0; i < inicio; i++) celdas.push('<div class="cal-dia vacio" aria-hidden="true"></div>');
  for (let d = 1; d <= dias; d++) {
    const f = `${anio}-${p2(mes + 1)}-${p2(d)}`;
    const evs = porDia[f] || [];
    const clases = ['cal-dia', f === hoy ? 'hoy' : '', f === seleccionado ? 'seleccionado' : '', f < hoy ? 'pasado' : '', evs.length ? 'con-eventos' : ''].join(' ');
    const etiqueta = `${d} de ${MESES[mes]}${evs.length ? `, ${evs.length} evento(s): ${evs.map(e => e.titulo).join(', ')}` : ''}`;
    const contenido = compacto
      ? `<span class="cal-puntos">${evs.slice(0, 3).map(e => `<i class="${e.estado === 'Cancelado' ? 'cancelado' : ''}"></i>`).join('')}</span>`
      : `${evs.slice(0, 2).map(e => `<a class="cal-evento ${e.estado === 'Cancelado' ? 'cancelado' : ''}" href="#/eventos/${e.id}" title="${esc(e.titulo)}">${esc(e.hora_inicio || '')} ${esc(e.titulo)}</a>`).join('')}
         ${evs.length > 2 ? `<span class="cal-mas">+${evs.length - 2} más</span>` : ''}`;
    celdas.push(`<div class="${clases}"><button type="button" class="cal-num" data-accion="cal-dia" data-fecha="${f}" aria-label="${esc(etiqueta)}">${d}</button>${contenido}</div>`);
  }
  return `<div class="calendario ${compacto ? 'compacto' : ''}">
    <div class="cal-encabezado">
      ${Boton({ texto: 'Mes anterior', variante: 'fantasma', icono: 'izquierda', soloIcono: true, accion: 'cal-prev' })}
      <p class="cal-titulo" aria-live="polite">${esc(titulo || `${MESES[mes]} ${anio}`)}</p>
      ${Boton({ texto: 'Mes siguiente', variante: 'fantasma', icono: 'derecha', soloIcono: true, accion: 'cal-next' })}
    </div>
    <div class="cal-semana" aria-hidden="true">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${celdas.join('')}</div>
  </div>`;
}

// Controla la navegación entre meses y la selección de días; devuelve una función para refrescar.
export function montarCalendario(contenedor, { fechaInicial, hoy, cargarEventos, alElegirDia = null, compacto = false, seleccionado = null }) {
  const [y, m] = (fechaInicial || hoy).split('-').map(Number);
  const estado = { anio: y, mes: m - 1, seleccionado };
  const pintar = () => {
    contenedor.innerHTML = Calendario({ ...estado, hoy, compacto, eventos: cargarEventos(estado.anio, estado.mes) });
  };
  contenedor.onclick = e => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    if (a === 'cal-prev' || a === 'cal-next') {
      const d = new Date(estado.anio, estado.mes + (a === 'cal-next' ? 1 : -1), 1);
      estado.anio = d.getFullYear(); estado.mes = d.getMonth(); pintar();
    } else if (a === 'cal-dia' && alElegirDia) {
      estado.seleccionado = b.dataset.fecha; pintar(); alElegirDia(b.dataset.fecha);
    }
  };
  pintar();
  return {
    refrescar: pintar,
    irA: (fecha, marcar = true) => {
      const [a, mm] = fecha.split('-').map(Number);
      estado.anio = a; estado.mes = mm - 1; if (marcar) estado.seleccionado = fecha; pintar();
    },
  };
}

export const rangoMes = (anio, mes) => [`${anio}-${p2(mes + 1)}-01`, `${anio}-${p2(mes + 1)}-${p2(new Date(anio, mes + 1, 0).getDate())}`];

// ------------------------------------------------------------------ Lista de tareas (reutilizable)
// Se usa en: pestaña Tareas del evento, pantalla Tareas y portal del asistente.
export function ListaTareas({ tareas, mostrarEvento = true, mostrarResponsable = true, puedeAvance = () => false, acciones = () => '', vacio = 'No hay tareas' }) {
  const opciones = v => [0, 10, 25, 50, 75, 90, 100].concat(v).filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b)
    .map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${x}%${x === 0 ? ' · Pendiente' : x === 100 ? ' · Completada' : ''}</option>`).join('');
  return Tabla({
    filas: tareas, vacio,
    claseFila: t => t.estado === 'Completada' ? 'fila-tenue' : t.vencida ? 'fila-alerta' : '',
    columnas: [
      { titulo: 'Tarea', render: t => `<b>${esc(t.titulo)}</b> ${Insignia(t.prioridad)} ${t.vencida ? Insignia('Vencida') : ''}${t.descripcion ? `<br><span class="tenue">${esc(t.descripcion)}</span>` : ''}` },
      ...(mostrarEvento ? [{ titulo: 'Evento', render: t => `<a class="enlace-fuerte" href="#/eventos/${t.evento_id}">${esc(t.evento)}</a>` }] : []),
      ...(mostrarResponsable ? [{ titulo: 'Responsable', render: t => t.responsable ? esc(t.responsable) : Insignia('Sin asignar') }] : []),
      { titulo: 'Fecha límite', render: t => `<span class="${t.vencida ? 'texto-rojo' : ''}">${esc(fechaLarga(t.fecha_limite))}</span>` },
      { titulo: 'Avance', render: t => `${BarraProgreso(t.avance, `Avance de ${t.titulo}`)}
          ${puedeAvance(t)
            ? `<label class="sr-only" for="av-${t.id}">Avance de ${esc(t.titulo)}</label><select id="av-${t.id}" class="select-chico" data-avance="${t.id}">${opciones(t.avance)}</select>`
            : `<span class="tenue chico">${t.avance}% · ${esc(t.estado)}</span>`}` },
      { titulo: 'Acciones', clase: 'acciones', render: acciones },
    ],
  });
}

export function ResumenProgreso(r) {
  return `<div class="resumen-progreso">
    <div><p class="kpi-titulo">Avance general</p><p class="kpi-valor">${r.avance}%</p>${BarraProgreso(r.avance, 'Avance general de tareas')}</div>
    <ul class="conteos">
      <li>${Insignia('Completada')} <b>${r.completadas}</b></li><li>${Insignia('En progreso')} <b>${r.enProgreso}</b></li>
      <li>${Insignia('Pendiente')} <b>${r.pendientes}</b></li><li>${Insignia('Vencida')} <b>${r.vencidas}</b></li>
      <li>${Insignia('Sin asignar')} <b>${r.sinAsignar}</b></li>
    </ul></div>`;
}

// ------------------------------------------------------------------ Avisos y mensajes (reutilizables)
const ICONO_AVISO = { 'Inscripción': 'check', 'Lista de espera': 'reloj', 'Promoción': 'check', 'Tarea asignada': 'tarea',
  'Tarea reasignada': 'tarea', 'Evento modificado': 'calendario', 'Evento cancelado': 'cancelar', 'Comunicado': 'mensaje' };

export function ListaAvisos(avisos, { conAccion = false, vacio = 'No hay avisos' } = {}) {
  if (!avisos.length) return EstadoVacio(vacio);
  return `<ul class="avisos">${avisos.map(a => `<li class="${a.leida ? '' : 'no-leido'}">
    <span class="aviso-icono tono-${a.tipo === 'Evento cancelado' ? 'rojo' : a.tipo.startsWith('Tarea') ? 'morado' : a.tipo === 'Comunicado' ? 'azul' : 'verde'}">${Icono(ICONO_AVISO[a.tipo] || 'campana')}</span>
    <div><p><b>${esc(a.titulo)}</b> ${a.leida ? '' : Insignia('Nuevo')}</p>
      <p class="tenue">${esc(a.texto)}</p>
      <p class="tenue chico">${esc(a.tipo)}${a.evento ? ` · ${esc(a.evento)}` : ''}${a.participante ? ` · para ${esc(a.participante)}` : ''} · ${esc(a.fecha)}</p></div>
    ${conAccion && !a.leida ? Boton({ texto: 'Marcar como leído', variante: 'fantasma', icono: 'check', soloIcono: true, accion: 'aviso-leido', datos: { id: a.id } }) : ''}
  </li>`).join('')}</ul>`;
}

// Vista compacta de avisos para el personal (pestaña Comunicación y pantalla Comunicación)
export function TablaAvisos(avisos, { mostrarEvento = false } = {}) {
  return Tabla({ filas: avisos, vacio: 'Aún no se han enviado avisos', columnas: [
    { titulo: 'Fecha', render: a => `<span class="chico">${esc(a.fecha)}</span>` },
    { titulo: 'Para', render: a => esc(a.participante) },
    { titulo: 'Tipo', render: a => `<span class="aviso-tipo"><span class="aviso-icono chico tono-${a.tipo === 'Evento cancelado' ? 'rojo' : a.tipo.startsWith('Tarea') ? 'morado' : a.tipo === 'Comunicado' ? 'azul' : 'verde'}">${Icono(ICONO_AVISO[a.tipo] || 'campana')}</span>${esc(a.tipo)}</span>` },
    { titulo: 'Aviso', render: a => `${esc(a.titulo)}${mostrarEvento && a.evento ? `<br><span class="tenue chico">${esc(a.evento)}</span>` : ''}` },
    { titulo: 'Leído', render: a => Insignia(a.leida ? 'Leído' : 'Pendiente') },
  ] });
}

export function ListaMensajes(mensajes, { conAccion = false, vacio = 'No hay mensajes' } = {}) {
  if (!mensajes.length) return EstadoVacio(vacio);
  return `<ul class="mensajes">${mensajes.map(m => {
    const deAsistente = m.direccion === 'Asistente a organizador';
    return `<li class="${deAsistente ? 'de-asistente' : 'de-organizador'} ${deAsistente && !m.leido ? 'no-leido' : ''}">
      <div class="mensaje-cabeza"><b>${esc(deAsistente ? m.participante || 'Asistente' : m.usuario || 'Organizador')}</b>
        <span class="tenue chico">${deAsistente ? 'escribió al organizador' : `envió a: ${esc(m.segmento)} (${m.destinatarios})`} · ${esc(m.fecha)}</span>
        ${deAsistente && !m.leido ? Insignia('Nuevo') : ''}</div>
      <p class="mensaje-asunto">${esc(m.asunto)}${m.evento ? ` <span class="tenue chico">· ${esc(m.evento)}</span>` : ''}</p>
      <p>${esc(m.cuerpo)}</p>
      ${conAccion && deAsistente && !m.leido ? Boton({ texto: 'Marcar como leído', variante: 'secundario', icono: 'check', accion: 'mensaje-leido', datos: { id: m.id } }) : ''}
    </li>`;
  }).join('')}</ul>`;
}
