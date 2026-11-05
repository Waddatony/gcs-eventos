// Seguridad: hash de contraseñas, sales aleatorias y escape de HTML.
// Usa Web Crypto (disponible en navegadores y en Node 18+).

const cryptoApi = globalThis.crypto;

export function randomSalt(bytes = 16) {
  const arr = new Uint8Array(bytes);
  cryptoApi.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const digest = await cryptoApi.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Política de contraseñas: mínimo 8 caracteres, una mayúscula, un número.
export function validarPassword(pw) {
  if (!pw || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(pw)) return 'La contraseña debe incluir al menos una mayúscula';
  if (!/[0-9]/.test(pw)) return 'La contraseña debe incluir al menos un número';
  return null;
}

// Evita inyección de HTML/JS (XSS) al pintar datos capturados por usuarios.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
