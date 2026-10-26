/* Utilidades compartidas por todas las vistas. */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* Los clientes escriben "12,5": se acepta coma o punto. */
export function num(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

/* 12.5 → "12,5"; 60 → "60" */
export function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function fmtFecha(iso, opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', opts);
}

export function haceDias(iso) {
  if (!iso) return null;
  const a = new Date(iso + 'T00:00:00'), b = new Date(hoy() + 'T00:00:00');
  return Math.round((b - a) / 864e5);
}

export function textoHace(iso) {
  const d = haceDias(iso);
  if (d == null) return 'nunca';
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

/* Lunes de la semana de una fecha ISO. */
export function lunesDe(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

export const clonar = o => JSON.parse(JSON.stringify(o));

export function fmtDescanso(seg) {
  if (!seg) return '';
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* Código de acceso del cliente: 10 caracteres sin ambigüedades (sin 0/O, 1/l). */
export function nuevoCodigo() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(r, b => abc[b % abc.length]).join('');
}

/* ---------- avisos y modales ---------- */
export function toast(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 2400);
}

export function modal(html, { onClose } = {}) {
  $('#modal').innerHTML = html;
  $('#ov').classList.add('on');
  $('#ov')._onClose = onClose || null;
  const foco = $('#modal [autofocus]');
  if (foco) setTimeout(() => foco.focus(), 50);
}

export function cerrarModal() {
  const ov = $('#ov');
  if (!ov.classList.contains('on')) return;
  ov.classList.remove('on');
  const cb = ov._onClose; ov._onClose = null;
  if (cb) cb();
}

export function confirmar(texto, { ok = 'Aceptar', peligro = false } = {}) {
  return new Promise(res => {
    let resuelto = false;
    const fin = v => { if (resuelto) return; resuelto = true; res(v); };
    modal(`<p class="mb">${esc(texto)}</p>
      <div class="fila-btn">
        <button class="btn ghost" data-r="0">Cancelar</button>
        <button class="btn ${peligro ? 'peligro' : ''}" data-r="1">${esc(ok)}</button>
      </div>`, { onClose: () => fin(false) });
    $$('#modal [data-r]').forEach(b => b.onclick = () => { fin(b.dataset.r === '1'); cerrarModal(); });
  });
}
