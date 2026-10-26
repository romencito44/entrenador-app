/* Panel del entrenador: clientes, ficha de cada cliente, plantillas. */

import * as datos from '../datos.js';
import { $, $$, esc, uid, hoy, lunesDe, textoHace, haceDias, nuevoCodigo, clonar, toast, modal, cerrarModal, confirmar } from '../util.js';
import { GRUPOS } from '../biblioteca.js';
import { avance, siguienteHueco, etiquetaSemana, renovarIds, nuevoPrograma } from '../programa.js';
import { ajusteVolumen } from '../progresion.js';
import { programaAndrea, ALTA_ANDREA, VERSION_ANDREA } from '../andrea.js';
import { nombreSesion, fechaSesion, htmlDetalleSesion, montarProgreso, htmlAlta, leerAlta, ALTA_VACIA } from './comunes.js';
import { editorPrograma } from './editor.js';
import { importarAntiguo, descargarJSON } from './cliente.js';
import { ir, render } from '../app.js';

/* ---------- resumen de un cliente (lo usan la lista y la ficha) ---------- */
function resumen(c, ss) {
  const hechas = ss.filter(s => s.estado === 'hecha');
  const reales = hechas.filter(s => !s.importada && s.fecha);
  const ultima = reales[0] || null;
  const lunes = lunesDe(hoy());
  const semana = reales.filter(s => s.fecha >= lunes).length;
  const sig = c.programa ? siguienteHueco(c.programa, ss) : null;
  const objetivoSemana = sig?.meso.dias.length || c.alta?.dias || 0;
  const alertas = [];
  if (ultima && Object.values(ultima.feedback?.grupos || {}).some(g => g.dolor)) alertas.push('Molestia articular en la última sesión');
  const dias = ultima ? haceDias(ultima.fecha) : null;
  if (c.programa && (dias == null || dias > 6)) alertas.push(dias == null ? 'Aún no ha entrenado' : `${dias} días sin entrenar`);
  if (!c.alta?.completada) alertas.push('Falta el cuestionario de alta');
  const sinComentar = reales.filter(s => !s.comentario && haceDias(s.fecha) <= 7).length;
  return { hechas, ultima, semana, objetivoSemana, sig, alertas, sinComentar,
    av: c.programa ? avance(c.programa, ss) : null, enCurso: ss.find(s => s.estado === 'en-curso') };
}

/* ================= Clientes ================= */
async function vClientes(app, _, vigente) {
  $('#titulo').textContent = 'Clientes';
  const cs = await datos.clientes.listar();
  const todas = await Promise.all(cs.map(c => datos.sesiones.listar(c.id)));
  if (!vigente()) return;
  const filas = cs.map((c, i) => ({ c, r: resumen(c, todas[i]) }))
    .sort((a, b) => b.r.alertas.length - a.r.alertas.length || a.c.nombre.localeCompare(b.c.nombre));
  const andrea = cs.find(c => c.semilla === 'andrea');
  const andreaVieja = andrea && (andrea.semillaVersion || 1) < VERSION_ANDREA;

  app.innerHTML = `
    <div class="fila mb"><div class="grow"><h2>Clientes</h2><p class="sub">${cs.length} activos</p></div>
      <button class="btn" id="btnNuevo">+ Cliente</button></div>
    ${filas.map(({ c, r }) => `
      <div class="card click" data-id="${esc(c.id)}">
        <div class="card-h"><div class="grow">
          <h3>${esc(c.nombre)}</h3>
          <p class="sub">${c.programa ? esc(r.sig ? `${r.sig.meso.nombre} · ${etiquetaSemana(r.sig.meso, r.sig.semana)}` : `${c.programa.nombre} · terminado`) : 'Sin programa'}</p>
        </div>
        ${r.enCurso ? '<span class="badge acc">Entrenando</span>' : ''}
        ${r.sinComentar ? `<span class="badge">${r.sinComentar} sin comentar</span>` : ''}</div>
        <div class="grid3 mt">
          <div class="kpi"><b>${r.semana}/${r.objetivoSemana || '—'}</b><span>esta semana</span></div>
          <div class="kpi"><b style="font-size:1rem;padding-top:4px">${r.ultima ? textoHace(r.ultima.fecha) : '—'}</b><span>último entreno</span></div>
          <div class="kpi"><b>${r.av ? Math.round(r.av.hechas / (r.av.total || 1) * 100) + '%' : '—'}</b><span>del programa</span></div>
        </div>
        ${r.alertas.length ? `<div class="fila mt">${r.alertas.map(a => `<span class="badge ${a.startsWith('Molestia') ? 'danger' : 'gold'}">${esc(a)}</span>`).join('')}</div>` : ''}
      </div>`).join('') || `<div class="vacio">Todavía no tienes clientes.</div>`}
    ${andrea ? '' : `<button class="btn ghost full mt" id="btnAndrea">Crear a Andrea con su programa nuevo</button>`}
    ${andreaVieja ? `<button class="btn full mt" id="btnAndreaAct">Actualizar el programa de Andrea (mesociclos 1 y 2)</button>` : ''}`;

  $$('[data-id]', app).forEach(el => el.onclick = () => ir('cliente/' + el.dataset.id));
  $('#btnNuevo', app).onclick = nuevoCliente;
  $('#btnAndrea', app)?.addEventListener('click', crearAndrea);
  $('#btnAndreaAct', app)?.addEventListener('click', () => actualizarAndrea(andrea));
}

/* Sustituye el programa de una Andrea creada con una versión anterior.
   Las sesiones (y su historial importado) no se tocan. */
async function actualizarAndrea(c) {
  if (!await confirmar('Se sustituye su programa por el nuevo (mesociclos 1 y 2). Las sesiones que ya tenga se conservan.', { ok: 'Actualizar' })) return;
  c.programa = programaAndrea();
  c.semillaVersion = VERSION_ANDREA;
  c.alta = { ...clonar(ALTA_ANDREA), ...(c.alta?.completada ? c.alta : {}), notas: ALTA_ANDREA.notas };
  await datos.clientes.guardar(c);
  await datos.plantillas.guardar({ ...renovarIds(c.programa), nombre: 'Hipertrofia tren inferior + espalda (4 días, 2 mesociclos)' });
  toast('Programa de Andrea actualizado');
  ir(`cliente/${c.id}/programa`);
}

function nuevoCliente() {
  modal(`<h3 class="mb">Nuevo cliente</h3>
    <div class="field"><label class="lbl">Nombre</label><input id="mNom" autofocus placeholder="Nombre y apellido"></div>
    <p class="sub mb">El cuestionario de alta lo puede rellenar él mismo al abrir su enlace.</p>
    <button class="btn full" id="mOk">Crear</button>`);
  $('#mOk').onclick = async () => {
    const nombre = $('#mNom').value.trim();
    if (!nombre) return toast('Pon un nombre');
    const c = { id: uid(), nombre, codigo: nuevoCodigo(), alta: { ...ALTA_VACIA }, programa: null, notas: '', creado: hoy() };
    await datos.clientes.guardar(c);
    cerrarModal(); ir(`cliente/${c.id}/programa`);
  };
}

async function crearAndrea() {
  const prog = programaAndrea();
  const c = { id: uid(), semilla: 'andrea', semillaVersion: VERSION_ANDREA, nombre: 'Andrea', codigo: nuevoCodigo(), alta: clonar(ALTA_ANDREA),
    programa: prog, notas: 'Tras 10 semanas: subió mucho la cadena posterior; jalón, remo T y dominadas estancados. Top sets se hacían a 8-10 reps en vez de 5-6.', creado: hoy() };
  await datos.clientes.guardar(c);
  // La misma estructura queda como plantilla para reutilizarla con otras clientas.
  await datos.plantillas.guardar({ ...renovarIds(prog), nombre: 'Hipertrofia tren inferior + espalda (4 días, 2 mesociclos)' });
  toast('Andrea creada. Importa su historial desde su ficha.');
  ir(`cliente/${c.id}/resumen`);
}

/* ================= Ficha de cliente ================= */
const PESTANAS = [['resumen', 'Resumen'], ['programa', 'Programa'], ['progreso', 'Progreso'], ['ficha', 'Ficha']];
const selProgreso = { ej: null, m: '1rm' };
let guardarProg = null;

async function vCliente(app, [id, pest = 'resumen'], vigente) {
  const [c, ss] = await Promise.all([datos.clientes.obtener(id), datos.sesiones.listar(id)]);
  if (!vigente()) return;
  if (!c) { app.innerHTML = `<div class="vacio">Cliente no encontrado.</div>`; return; }
  $('#titulo').textContent = c.nombre;
  const r = resumen(c, ss);

  app.innerHTML = `
    <a href="#/clientes" class="link">← Clientes</a>
    <div class="fila mt mb"><h2 class="grow">${esc(c.nombre)}</h2>
      <button class="btn ghost sm" id="btnEnlace">Enlace</button>
      <button class="btn ghost sm" id="btnVer">Ver como cliente</button>
      <button class="icon-btn" id="btnBorrarCli" title="Borrar cliente" aria-label="Borrar cliente" style="color:var(--danger)">🗑</button></div>
    <div class="seg mb">${PESTANAS.map(([k, n]) => `<button data-p="${k}" class="${k === pest ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div id="pest"></div>`;
  $$('.seg [data-p]', app).forEach(b => b.onclick = () => ir(`cliente/${id}/${b.dataset.p}`));
  $('#btnEnlace', app).onclick = () => enlace(c);
  $('#btnVer', app).onclick = async () => {
    try { await datos.entrarComoCliente(c.id, c.codigo); ir('hoy'); }
    catch (e) { toast(e.message); }
  };
  $('#btnBorrarCli', app).onclick = () => borrarCliente(c);
  const cont = $('#pest', app);

  if (pest === 'resumen') return pestResumen(cont, c, ss, r);
  if (pest === 'programa') return pestPrograma(cont, c);
  if (pest === 'progreso') return montarProgreso(cont, r.hechas, selProgreso);
  if (pest === 'ficha') return pestFicha(cont, c);
}

function pestResumen(cont, c, ss, r) {
  // Ajuste de volumen por grupo: el feedback más reciente de cada grupo (últimos 14 días).
  const ajustes = {};
  r.hechas.filter(s => !s.importada && haceDias(s.fecha) <= 14).forEach(s => {
    Object.entries(s.feedback?.grupos || {}).forEach(([g, fb]) => { if (!ajustes[g]) ajustes[g] = { fb, s }; });
  });
  const listaAjustes = Object.entries(ajustes).map(([g, { fb, s }]) => ({ g, s, a: ajusteVolumen(fb) }));

  cont.innerHTML = `
    <div class="grid3 mb">
      <div class="kpi"><b>${r.semana}/${r.objetivoSemana || '—'}</b><span>esta semana</span></div>
      <div class="kpi"><b style="font-size:1rem;padding-top:4px">${r.ultima ? textoHace(r.ultima.fecha) : '—'}</b><span>último entreno</span></div>
      <div class="kpi"><b>${r.av ? `${r.av.hechas}/${r.av.total}` : '—'}</b><span>sesiones del programa</span></div>
    </div>
    ${r.alertas.length ? `<div class="fila mb">${r.alertas.map(a => `<span class="badge ${a.startsWith('Molestia') ? 'danger' : 'gold'}">${esc(a)}</span>`).join('')}</div>` : ''}
    ${listaAjustes.length ? `<div class="card"><h3>Ajuste de volumen sugerido</h3>
      <p class="sub mb">Según cómo dijo que le sentó cada grupo la última vez. Tú decides si lo aplicas en el programa.</p>
      ${listaAjustes.map(({ g, a }) => `<div class="fila" style="padding:6px 0;font-size:.9rem">
        <b style="min-width:92px">${esc(GRUPOS[g] || g)}</b>
        <span class="badge ${a.cambio > 0 ? 'ok' : a.cambio < 0 ? 'danger' : ''}">${a.cambio > 0 ? '+1 serie' : a.cambio < 0 ? '−1 serie' : 'Mantener'}</span>
        <span class="sub grow" style="margin:0">${esc(a.texto)}</span></div>`).join('')}</div>` : ''}
    <h3 class="mt mb">Sesiones</h3>
    <div class="lista-ses">${ss.map(s => `
      <a class="ses-fila" href="#/sesion/${esc(c.id)}/${esc(s.id)}" style="text-decoration:none;color:inherit">
        <div class="grow"><b>${esc(nombreSesion(s))}</b><p class="sub">${s.estado === 'en-curso' ? 'En curso' : esc(fechaSesion(s))}${s.duracionMin ? ` · ${s.duracionMin} min` : ''}</p></div>
        ${Object.values(s.feedback?.grupos || {}).some(g => g.dolor) ? '<span class="badge danger">Dolor</span>' : ''}
        ${s.ejercicios.some(e => e.series.some(x => x.pr)) ? '<span class="badge gold">PR</span>' : ''}
        ${s.comentario ? '<span class="badge ok">Comentada</span>' : ''}
      </a>`).join('') || '<div class="vacio">Aún no hay sesiones.</div>'}</div>`;
}

async function pestPrograma(cont, c) {
  if (!c.programa) {
    const ps = await datos.plantillas.listar();
    cont.innerHTML = `<div class="card"><h3 class="mb">Asignar programa</h3>
      <button class="btn full mb" id="btnProgAndrea">Programa de Andrea (mesociclos 1 y 2)</button>
      ${ps.map(p => `<button class="btn ghost full mb" data-pl="${esc(p.id)}">${esc(p.nombre)}</button>`).join('')}
      <button class="btn ghost full" id="btnVacio">Empezar uno desde cero</button></div>`;
    // El programa de Andrea sin pasar por plantilla: sirve para una Andrea creada a mano,
    // que ya tiene su enlace enviado.
    $('#btnProgAndrea', cont).onclick = async () => {
      c.programa = programaAndrea();
      c.semilla = 'andrea';
      c.semillaVersion = VERSION_ANDREA;
      if (!c.alta?.completada) c.alta = clonar(ALTA_ANDREA);
      await datos.clientes.guardar(c);
      toast('Programa cargado');
      render();
    };
    $$('[data-pl]', cont).forEach(b => b.onclick = async () => {
      const p = ps.find(x => x.id === b.dataset.pl);
      c.programa = renovarIds(sinMeta(p));
      await datos.clientes.guardar(c); render();
    });
    $('#btnVacio', cont).onclick = async () => { c.programa = nuevoPrograma(`Programa de ${c.nombre}`); await datos.clientes.guardar(c); render(); };
    return;
  }
  cont.innerHTML = `<div class="fila mb">
      <button class="btn ghost sm" id="btnComoPl">Guardar como plantilla</button>
      <button class="btn ghost sm" id="btnCambiar">Cambiar por plantilla</button></div>
    <p class="sub mb">Los cambios se guardan solos y le llegan al cliente al abrir la app. Si mantienes el mismo ejercicio (mismo nombre de la biblioteca), conserva su historial y la sugerencia de carga.</p>
    <div id="ed"></div>`;
  editorPrograma($('#ed', cont), c.programa, prog => {
    c.programa = prog;
    clearTimeout(guardarProg);
    guardarProg = setTimeout(() => datos.clientes.guardar(c), 500);
  });
  $('#btnComoPl', cont).onclick = async () => {
    await datos.plantillas.guardar({ ...renovarIds(c.programa) });
    toast('Guardada en Plantillas');
  };
  $('#btnCambiar', cont).onclick = async () => {
    if (!await confirmar('El programa actual se sustituye. Las sesiones ya hechas se conservan.', { ok: 'Continuar' })) return;
    c.programa = null; await datos.clientes.guardar(c); render();
  };
}

const sinMeta = p => { const { entrenadorUid, ...resto } = p; return resto; };

function pestFicha(cont, c) {
  cont.innerHTML = `
    <div class="card"><h3 class="mb">Cuestionario de alta</h3>${htmlAlta(c.alta)}
      <div class="field"><label class="lbl">Notas privadas del entrenador</label><textarea id="cNotas">${esc(c.notas || '')}</textarea></div>
      <button class="btn full" id="btnGuardarFicha">Guardar</button></div>
    <div class="card"><h3>Historial anterior</h3>
      <p class="sub mb">Si venía de un plan en HTML (como el de Andrea), importa aquí el archivo que exporta ese plan. Reimportar no duplica.</p>
      <button class="btn ghost full" id="btnImp">Importar JSON del plan antiguo</button></div>
    <div class="card"><h3>Zona peligrosa</h3>
      <div class="field mt"><label class="lbl">Nombre</label><input id="cNom" value="${esc(c.nombre)}"></div>
      <div class="fila">
        <button class="btn ghost sm" id="btnRenombrar">Renombrar</button>
        <button class="btn ghost sm" id="btnCodigo">Nuevo enlace</button>
        <span class="grow"></span>
        <button class="btn peligro sm" id="btnBorrar">Borrar cliente</button>
      </div></div>`;
  $('#btnGuardarFicha', cont).onclick = async () => {
    c.alta = leerAlta(cont); c.notas = $('#cNotas', cont).value.trim();
    await datos.clientes.guardar(c); toast('Guardado');
  };
  $('#btnImp', cont).onclick = () => importarAntiguo(c.id, () => ir(`cliente/${c.id}/resumen`));
  $('#btnRenombrar', cont).onclick = async () => { c.nombre = $('#cNom', cont).value.trim() || c.nombre; await datos.clientes.guardar(c); render(); };
  $('#btnCodigo', cont).onclick = async () => {
    if (!await confirmar('Se genera un enlace nuevo para dispositivos nuevos. Los móviles donde ya lo abrió siguen teniendo acceso.', { ok: 'Generar' })) return;
    c.codigo = nuevoCodigo(); await datos.clientes.guardar(c); enlace(c);
  };
  $('#btnBorrar', cont).onclick = () => borrarCliente(c);
}

async function borrarCliente(c) {
  if (!await confirmar(`¿Borrar a ${c.nombre} y todas sus sesiones? Su enlace dejará de funcionar. No se puede deshacer.`, { ok: 'Borrar', peligro: true })) return;
  await datos.clientes.borrar(c.id);
  toast('Cliente borrado');
  ir('clientes');
}

function enlace(c) {
  const url = `${location.origin}${location.pathname}#acceso/${encodeURIComponent(c.id)}/${encodeURIComponent(c.codigo)}`;
  const local = datos.estado.modo === 'local', archivo = location.protocol === 'file:';
  modal(`<h3 class="mb">Enlace de ${esc(c.nombre)}</h3>
    <p class="sub mb">Envíaselo por WhatsApp. Al abrirlo verá su programa y lo que anote te llegará aquí. Que lo añada a la pantalla de inicio para usarlo como app.</p>
    <textarea readonly style="min-height:90px;font-size:.8rem" onclick="this.select()">${esc(url)}</textarea>
    ${local ? '<p class="sub mt" style="color:var(--gold)">Modo local: este enlace solo funciona en este navegador. Con Firebase activo funciona en cualquier móvil.</p>' : ''}
    ${archivo ? '<p class="sub mt" style="color:var(--gold)">Estás abriendo la app como archivo: el enlace solo vale en este ordenador. Súbela a GitHub Pages.</p>' : ''}
    <div class="fila-btn mt">
      ${navigator.share ? '<button class="btn ghost" id="mShare">Compartir</button>' : ''}
      <button class="btn" id="mCopiar">Copiar</button></div>`);
  $('#mCopiar').onclick = () => navigator.clipboard?.writeText(url).then(() => toast('Enlace copiado')).catch(() => toast('Selecciona el texto y cópialo'));
  $('#mShare')?.addEventListener('click', () => navigator.share({ title: 'Tu plan de entreno', url }).catch(() => {}));
}

/* ================= Sesión (vista del entrenador, con comentario) ================= */
async function vSesion(app, [cid, sid], vigente) {
  const [c, ss] = await Promise.all([datos.clientes.obtener(cid), datos.sesiones.listar(cid)]);
  if (!vigente()) return;
  const s = ss.find(x => x.id === sid);
  if (!c || !s) { app.innerHTML = `<div class="vacio">Sesión no encontrada.</div>`; return; }
  app.innerHTML = `<a href="#/cliente/${esc(cid)}/resumen" class="link">← ${esc(c.nombre)}</a>
    <h2 class="mt">${esc(nombreSesion(s))}</h2>
    <p class="sub mb">${s.estado === 'en-curso' ? 'En curso ahora mismo' : esc(fechaSesion(s))}${s.duracionMin ? ` · ${s.duracionMin} min` : ''}</p>
    ${s.importada ? '' : `<div class="card"><label class="lbl">Comentario para ${esc(c.nombre)}</label>
      <textarea id="txtCom" placeholder="Lo verá en su app">${esc(s.comentario || '')}</textarea>
      <button class="btn full mt" id="btnCom">Guardar comentario</button></div>`}
    ${htmlDetalleSesion(s)}
    <button class="btn ghost sm mt" id="btnBorrarSes" style="color:var(--danger)">Borrar sesión</button>`;
  $('#btnCom', app)?.addEventListener('click', async () => {
    s.comentario = $('#txtCom', app).value.trim();
    await datos.sesiones.guardar(cid, s); toast('Comentario guardado');
  });
  $('#btnBorrarSes', app).onclick = async () => {
    if (!await confirmar('¿Borrar esta sesión?', { ok: 'Borrar', peligro: true })) return;
    await datos.sesiones.borrar(cid, sid); ir(`cliente/${cid}/resumen`);
  };
}

/* ================= Plantillas ================= */
async function vPlantillas(app, _, vigente) {
  $('#titulo').textContent = 'Plantillas';
  const ps = await datos.plantillas.listar();
  if (!vigente()) return;
  app.innerHTML = `<div class="fila mb"><div class="grow"><h2>Plantillas</h2><p class="sub">Programas que asignas a varios clientes y luego ajustas a cada uno.</p></div>
      <button class="btn" id="btnNueva">+ Plantilla</button></div>
    ${ps.map(p => `<div class="card click" data-id="${esc(p.id)}">
      <h3>${esc(p.nombre)}</h3>
      <p class="sub">${p.mesociclos.length} mesociclo(s) · ${p.mesociclos.map(m => `${m.semanas}${m.descarga ? '+1' : ''} sem × ${m.dias.length} días`).join(' · ')}</p>
    </div>`).join('') || '<div class="vacio">Aún no hay plantillas.</div>'}`;
  $$('[data-id]', app).forEach(el => el.onclick = () => ir('plantilla/' + el.dataset.id));
  $('#btnNueva', app).onclick = async () => { const p = nuevoPrograma(); await datos.plantillas.guardar(p); ir('plantilla/' + p.id); };
}

let guardarPl = null;
async function vPlantilla(app, [id], vigente) {
  const p = await datos.plantillas.obtener(id);
  if (!vigente()) return;
  if (!p) { app.innerHTML = `<div class="vacio">Plantilla no encontrada.</div>`; return; }
  $('#titulo').textContent = 'Plantilla';
  app.innerHTML = `<a href="#/plantillas" class="link">← Plantillas</a>
    <div class="fila mt mb"><span class="grow"></span>
      <button class="btn ghost sm" id="btnDup">Duplicar</button>
      <button class="btn ghost sm" id="btnBorrarPl" style="color:var(--danger)">Borrar</button></div>
    <div id="ed"></div>`;
  editorPrograma($('#ed', app), p, prog => {
    clearTimeout(guardarPl);
    guardarPl = setTimeout(() => datos.plantillas.guardar(prog), 500);
  });
  $('#btnDup', app).onclick = async () => {
    const n = { ...renovarIds(sinMeta(p)), nombre: p.nombre + ' (copia)' };
    await datos.plantillas.guardar(n); ir('plantilla/' + n.id);
  };
  $('#btnBorrarPl', app).onclick = async () => {
    if (!await confirmar(`¿Borrar la plantilla «${p.nombre}»? Los clientes que la usan no se ven afectados.`, { ok: 'Borrar', peligro: true })) return;
    await datos.plantillas.borrar(p.id); ir('plantillas');
  };
}

/* ================= menú ================= */
export function menuEntrenador() {
  const u = datos.estado.usuario;
  modal(`<h3 class="mb">Opciones</h3>
    <button class="btn ghost full mb" id="mExp">Descargar copia de todo</button>
    ${datos.estado.modo === 'firebase' ? '<button class="btn ghost full mb" id="mSalir">Cerrar sesión</button>' : ''}
    <p class="sub">${datos.estado.modo === 'local'
      ? 'Modo local: los datos solo están en este navegador.'
      : `Conectado como ${esc(u?.email || u?.displayName || 'entrenador')}. Los datos están en Firebase y en caché en este dispositivo.`}</p>`);
  $('#mExp').onclick = async () => {
    const [cs, ps] = await Promise.all([datos.clientes.listar(), datos.plantillas.listar()]);
    const sesiones = Object.fromEntries(await Promise.all(cs.map(async c => [c.id, await datos.sesiones.listar(c.id)])));
    descargarJSON({ clientes: cs, plantillas: ps, sesiones, fecha: hoy() }, `entrenador-copia-${hoy()}.json`);
    cerrarModal();
  };
  $('#mSalir')?.addEventListener('click', async () => { await datos.salir(); cerrarModal(); render(); });
}

export const vistasEntrenador = { clientes: vClientes, cliente: vCliente, sesion: vSesion, plantillas: vPlantillas, plantilla: vPlantilla };
