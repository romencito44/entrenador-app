/* Arranque, rutas y elementos comunes (menú, temporizador, chip de estado). */

import * as datos from './datos.js';
import { $, $$, esc, modal, cerrarModal, toast } from './util.js';
import { vistasCliente, menuCliente } from './vistas/cliente.js';
import { vistasEntrenador, menuEntrenador } from './vistas/entrenador.js';

/* ---------- rutas ----------
   Entrenador: #/clientes · #/cliente/{id}/{pestaña} · #/plantillas · #/plantilla/{id} · #/sesion/{clienteId}/{sesionId}
   Cliente:    #/hoy · #/entrenar · #/historial · #/progreso · #/sesion/{id} · #/alta
   Enlace del cliente: #acceso/{clienteId}/{codigo} */

const TABS_ENTRENADOR = [['clientes', 'Clientes'], ['plantillas', 'Plantillas']];
const TABS_CLIENTE = [['hoy', 'Hoy'], ['historial', 'Historial'], ['progreso', 'Progreso']];

export function ir(ruta) {
  if (location.hash === '#/' + ruta) render();
  else location.hash = '/' + ruta;
}

function rutaActual() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

let renderando = 0;
export async function render() {
  const yo = ++renderando;
  const partes = rutaActual();
  const app = $('#app');
  pintarChip();

  if (!datos.estado.rol) return pantallaEntrada(app);

  const esCliente = datos.estado.rol === 'cliente';
  const vistas = esCliente ? vistasCliente : vistasEntrenador;
  const defecto = esCliente ? 'hoy' : 'clientes';
  const nombre = vistas[partes[0]] ? partes[0] : defecto;
  const tabs = esCliente ? TABS_CLIENTE : TABS_ENTRENADOR;
  const activa = { cliente: 'clientes', plantilla: 'plantillas', entrenar: 'hoy', alta: 'hoy', sesion: esCliente ? 'historial' : 'clientes' }[nombre] || nombre;
  $('#tabs').innerHTML = tabs.map(([k, l]) => `<a href="#/${k}" class="${k === activa ? 'on' : ''}">${l}</a>`).join('');

  try {
    await vistas[nombre](app, partes.slice(1), () => yo === renderando);
  } catch (e) {
    console.error(e);
    if (yo === renderando) app.innerHTML = `<div class="vacio">Algo ha fallado: ${esc(e.message)}</div>`;
  }
}

/* En iPhone la app añadida a la pantalla de inicio no comparte datos con Safari,
   así que una clienta que llega aquí desde el icono puede no tener su acceso:
   se le pide pegar el enlace. El acceso de entrenador queda en segundo plano. */
function pantallaEntrada(app) {
  $('#tabs').innerHTML = '';
  $('#titulo').textContent = 'Entrenador';
  app.innerHTML = `<div class="card" style="margin-top:40px;text-align:center">
    <h2 class="mb">Hola</h2>
    <p class="sub mb">Abre o pega aquí el enlace que te ha enviado tu entrenador.</p>
    <input id="inEnlace" type="url" inputmode="url" autocomplete="off" placeholder="Pega tu enlace" class="mb" style="width:100%">
    <button class="btn full" id="btnEnlace">Entrar</button>
    <button class="enlace-discreto" id="btnGoogle">Soy el entrenador · entrar con Google</button>
  </div>`;
  $('#btnEnlace').onclick = async () => {
    const m = $('#inEnlace').value.trim().match(/#acceso\/([^/\s]+)\/([^/\s]+)/);
    if (!m) return toast('Ese enlace no es el de acceso. Cópialo entero del mensaje de tu entrenador.');
    try { await entrarConEnlace(decodeURIComponent(m[1]), decodeURIComponent(m[2])); render(); }
    catch (e) { toast(e.message); }
  };
  $('#btnGoogle').onclick = async () => {
    try { await datos.entrarEntrenador(); ir('clientes'); }
    catch (e) { toast('No se pudo entrar: ' + e.message); }
  };
}

async function entrarConEnlace(clienteId, codigo) {
  await datos.entrarComoCliente(clienteId, codigo);
  history.replaceState(null, '', location.pathname + location.search + '#/hoy');
  manifiestoCliente();
}

/* iPhone: el icono de la pantalla de inicio abre la start_url del manifiesto en
   un almacenamiento aparte. Para que abra ya como cliente, el manifiesto lleva
   su enlace de acceso. En Android no hace falta (comparte datos con Chrome) y
   se deja el manifiesto normal. */
const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function manifiestoCliente() {
  const acceso = datos.leerAcceso();
  if (!esIOS || !acceso) return;
  const base = new URL('./', location.href).href;
  const abs = r => new URL(r, base).href;
  const m = {
    name: 'Entreno', short_name: 'Entreno', display: 'standalone', orientation: 'portrait',
    background_color: '#131214', theme_color: '#131214', lang: 'es', scope: base,
    start_url: `${base}#acceso/${encodeURIComponent(acceso.clienteId)}/${encodeURIComponent(acceso.codigo)}`,
    icons: [{ src: abs('icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
            { src: abs('icons/icon-512.png'), sizes: '512x512', type: 'image/png' }],
  };
  $('link[rel="manifest"]').href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(m));
}

/* ---------- chip de estado: local / sincronizado / sin conexión ---------- */
function pintarChip() {
  const c = $('#chipModo');
  c.hidden = false;
  c.className = 'chip-modo';
  if (datos.estado.modo === 'local') { c.textContent = 'Modo local'; c.title = 'Sin Firebase: los datos solo están en este navegador'; }
  else if (!navigator.onLine) { c.textContent = 'Sin conexión'; c.classList.add('offline'); c.title = 'Se guarda en el móvil y se sincroniza al volver la red'; }
  else { c.textContent = 'Sincronizado'; c.classList.add('sync'); c.title = ''; }
}
addEventListener('online', pintarChip);
addEventListener('offline', pintarChip);

/* ---------- menú ---------- */
$('#btnMenu').onclick = () => {
  if (datos.estado.rol === 'cliente') return menuCliente();
  if (datos.estado.rol === 'entrenador') return menuEntrenador();
  modal(`<p class="sub">Entra para ver las opciones.</p>`);
};

/* ---------- modal: cerrar al tocar fuera o con Escape ---------- */
$('#ov').addEventListener('click', e => { if (e.target.id === 'ov') cerrarModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

/* ---------- temporizador de descanso ---------- */
let restante = 0, intervalo = null;
export function arrancarDescanso(seg) {
  if (!seg) return;
  restante = seg;
  $('#timer').classList.add('on');
  $('#timer').classList.remove('fin');
  pintarTimer();
  clearInterval(intervalo);
  intervalo = setInterval(() => {
    restante--;
    pintarTimer();
    if (restante <= 0) { clearInterval(intervalo); avisarFin(); }
  }, 1000);
}
function pintarTimer() {
  const s = Math.max(0, restante);
  $('#timerVal').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function avisarFin() {
  $('#timer').classList.add('fin');
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .6);
    o.start(); o.stop(ctx.currentTime + .6);
  } catch {}
  setTimeout(() => $('#timer').classList.remove('on'), 4000);
}
export function pararDescanso() { clearInterval(intervalo); $('#timer').classList.remove('on'); }
$$('#timer [data-t]').forEach(b => b.onclick = () => {
  const d = +b.dataset.t;
  if (!d) return pararDescanso();
  restante = Math.max(0, restante + d);
  pintarTimer();
});

/* ---------- arranque ---------- */
async function arrancar() {
  try {
    await datos.iniciar();
  } catch (e) {
    console.error(e);
    $('#app').innerHTML = `<div class="vacio">No se ha podido cargar la app: ${esc(e.message)}<br>Si no tienes conexión, ábrela una vez con conexión para que quede guardada.</div>`;
    return;
  }

  // Enlace de acceso del cliente
  const m = location.hash.match(/^#acceso\/([^/]+)\/([^/]+)$/);
  if (m) {
    const [clienteId, codigo] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])];
    const ya = datos.leerAcceso();
    try {
      // El icono de iPhone abre siempre con el enlace: si ya está dentro, no se
      // vuelve a registrar el acceso (sin cobertura se quedaría esperando al servidor).
      if (ya?.clienteId === clienteId && ya?.codigo === codigo) history.replaceState(null, '', location.pathname + location.search + '#/hoy');
      else await entrarConEnlace(clienteId, codigo);
    } catch (e) {
      $('#app').innerHTML = `<div class="vacio">${esc(e.message)}</div>`;
      return;
    }
  }
  manifiestoCliente();
  addEventListener('hashchange', render);
  render();
}

/* PWA: solo por http(s). */
if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

arrancar();
