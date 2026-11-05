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
};
export function Insignia(texto) {
  return `<span class="insignia insignia-${TONOS_ESTADO[texto] || 'gris'}">${esc(texto)}</span>`;
}

export function BarraProgreso(pct, etiqueta = 'Ocupación') {
  const v = Math.min(Math.max(pct, 0), 100);
  const tono = v >= 100 ? 'rojo' : v >= 80 ? 'amarillo' : 'verde';
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
