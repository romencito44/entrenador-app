/* Lo que ve el cliente en su móvil: Hoy, la sesión en curso (registro tipo Hevy),
   el historial, su progreso y el cuestionario de alta. */

import * as datos from '../datos.js';
import { $, $$, esc, uid, hoy, num, fmtNum, toast, modal, cerrarModal, confirmar } from '../util.js';
import { GRUPOS } from '../biblioteca.js';
import { siguienteHueco, huecos, estaHecho, etiquetaSemana, prescripcionSemana, avance, esDescarga } from '../programa.js';
import { sugerir, ultimoRegistro, seriesTrabajo, mejorMarca, e1rm } from '../progresion.js';
import { importarPlanAntiguo } from '../andrea.js';
import { textoPres, badgeRol, fmtSerie, nombreSesion, fechaSesion, htmlDetalleSesion, montarProgreso, htmlAlta, leerAlta } from './comunes.js';
import { ir, render, arrancarDescanso, pararDescanso } from '../app.js';

async function cargar() {
  const id = datos.estado.clienteId;
  const [cliente, sesiones] = await Promise.all([datos.clientes.obtener(id), datos.sesiones.listar(id)]);
  if (!cliente) throw new Error('No se encuentra tu ficha. Pide a tu entrenador un enlace nuevo.');
  $('#titulo').textContent = cliente.nombre;
  return { cliente, sesiones, hechas: sesiones.filter(s => s.estado === 'hecha') };
}

/* ================= Hoy ================= */
async function vHoy(app, _, vigente) {
  const { cliente, sesiones, hechas } = await cargar();
  if (!vigente()) return;
  const prog = cliente.programa;
  const enCurso = sesiones.find(s => s.estado === 'en-curso');
  const sig = prog ? siguienteHueco(prog, sesiones) : null;
  const av = prog ? avance(prog, sesiones) : null;
  const comentada = hechas.find(s => s.comentario);

  let html = '';
  if (!cliente.alta?.completada) {
    html += `<div class="card" style="border-color:var(--accent)">
      <h3>Antes de empezar</h3><p class="sub mb">Cuéntale a tu entrenador tu objetivo, tu material y si tienes alguna molestia. Son dos minutos.</p>
      <button class="btn full" onclick="location.hash='/alta'">Rellenar cuestionario</button></div>`;
  }
  if (enCurso) {
    html += `<div class="card click" id="cEnCurso" style="border-color:var(--accent)">
      <span class="badge acc">En curso</span>
      <h3 class="mt">${esc(nombreSesion(enCurso))}</h3>
      <p class="sub">${contarHechas(enCurso)} series marcadas · toca para continuar</p></div>`;
  }
  if (!prog) {
    html += `<div class="vacio">Tu entrenador todavía no te ha asignado un programa.</div>`;
  } else if (!sig) {
    html += `<div class="card"><h3>Programa terminado</h3><p class="sub">Has completado todas las sesiones de «${esc(prog.nombre)}». Tu entrenador preparará el siguiente bloque.</p></div>`;
  } else {
    const p = sig.dia.ejercicios.map(e => prescripcionSemana(e, sig.meso, sig.semana));
    html += `<div class="card">
      <div class="card-h"><div class="grow">
        <p class="sub">${esc(sig.meso.nombre)} · ${etiquetaSemana(sig.meso, sig.semana)}</p>
        <h2 style="margin-top:4px">${esc(sig.dia.nombre)}</h2>
        ${sig.dia.enfoque ? `<p class="sub">${esc(sig.dia.enfoque)}</p>` : ''}
      </div>${esDescarga(sig.meso, sig.semana) ? '<span class="badge gold">Descarga</span>' : ''}</div>
      <div class="mt" style="display:grid;gap:6px">
        ${p.map(e => `<div class="fila" style="font-size:.9rem"><span class="grow">${esc(e.nombre)} ${badgeRol(e.rol)}</span><span class="faint num" style="font-size:.8rem">${textoPres(e)}</span></div>`).join('')}
      </div>
      ${enCurso ? '' : `<button class="btn full mt" id="btnEmpezar">Empezar entreno</button>`}
      <button class="link mt" id="btnOtro">Hacer otro día</button>
    </div>`;
  }
  if (comentada) {
    html += `<div class="card"><p class="sub">Tu entrenador sobre «${esc(nombreSesion(comentada))}»</p>
      <p style="margin:8px 0 0">${esc(comentada.comentario)}</p></div>`;
  }
  if (av) {
    html += `<div class="card"><div class="fila mb"><span class="grow sub">${esc(prog.nombre)}</span><span class="num faint">${av.hechas}/${av.total}</span></div>
      <div class="barra"><i style="width:${av.total ? Math.round(av.hechas / av.total * 100) : 0}%"></i></div></div>`;
  }
  app.innerHTML = html;

  $('#cEnCurso', app)?.addEventListener('click', () => ir('entrenar'));
  $('#btnEmpezar', app)?.addEventListener('click', () => empezar(cliente, sig));
  $('#btnOtro', app)?.addEventListener('click', () => elegirOtro(cliente, sesiones, !!enCurso));
}

const contarHechas = s => s.ejercicios.reduce((a, e) => a + e.series.filter(x => x.ok).length, 0);

function elegirOtro(cliente, sesiones, hayEnCurso) {
  const hs = huecos(cliente.programa);
  const sig = siguienteHueco(cliente.programa, sesiones);
  // Solo la semana en la que está y la siguiente: es para cambiar el orden, no para saltar bloques.
  const ini = sig ? hs.indexOf(hs.find(h => h.meso.id === sig.meso.id && h.semana === sig.semana)) : 0;
  const rango = hs.slice(Math.max(0, ini), sig ? ini + sig.meso.dias.length * 2 : hs.length);
  modal(`<h3 class="mb">Elige la sesión</h3>
    <div class="lista-ses">${rango.map((h, i) => {
      const hecho = estaHecho(sesiones, h.meso.id, h.semana, h.dia.id);
      return `<div class="ses-fila" data-i="${i}" ${hecho ? 'style="opacity:.5"' : ''}><div class="grow"><b>${esc(h.dia.nombre)}</b>
        <p class="sub">${esc(h.meso.nombre)} · ${etiquetaSemana(h.meso, h.semana)}</p></div>${hecho ? '<span class="badge ok">Hecha</span>' : ''}</div>`;
    }).join('')}</div>`);
  $$('#modal [data-i]').forEach(el => el.onclick = () => {
    if (hayEnCurso) { cerrarModal(); return toast('Termina o descarta primero la sesión en curso'); }
    cerrarModal(); empezar(cliente, rango[+el.dataset.i]);
  });
}

async function empezar(cliente, h) {
  const s = {
    id: uid(), ts: Date.now(), fecha: hoy(), inicio: Date.now(), estado: 'en-curso',
    mesoId: h.meso.id, semana: h.semana, diaId: h.dia.id, diaNombre: h.dia.nombre,
    titulo: `${h.dia.nombre} · ${etiquetaSemana(h.meso, h.semana)}`, mesoNombre: h.meso.nombre,
    ejercicios: h.dia.ejercicios.map(e => {
      const p = prescripcionSemana(e, h.meso, h.semana);
      return {
        pid: e.id, ejercicio: e.ejercicio, rol: e.rol || 'normal', nombre: e.nombre, grupo: e.grupo, unidad: e.unidad || 'kg',
        pres: { series: p.series, reps: p.reps, rir: p.rir, descanso: p.descanso, incremento: p.incremento, descarga: p.descarga, notas: e.notas || '' },
        series: Array.from({ length: p.series }, () => ({ tipo: 'N', kg: '', reps: '', ok: false })),
        nota: '',
      };
    }),
  };
  await datos.sesiones.guardar(datos.estado.clienteId, s);
  ir('entrenar');
}

/* ================= Entrenar ================= */
let guardarTimer = null;
function guardarPronto(s, ya = false) {
  clearTimeout(guardarTimer);
  const f = () => datos.sesiones.guardar(datos.estado.clienteId, s);
  if (ya) return f();
  guardarTimer = setTimeout(f, 700);
}

let wakeLock = null;
async function pantallaEncendida(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/entrenar')) pantallaEncendida(true);
});

const SIG_TIPO = { N: 'C', C: 'F', F: 'D', D: 'N' };
const NOMBRE_TIPO = { N: 'Serie normal', C: 'Calentamiento', F: 'Al fallo', D: 'Drop set' };

async function vEntrenar(app, _, vigente) {
  const { sesiones, hechas } = await cargar();
  if (!vigente()) return;
  const s = sesiones.find(x => x.estado === 'en-curso');
  if (!s) { ir('hoy'); return; }
  pantallaEncendida(true);

  // Sugerencias del día (no se guardan: se recalculan con el historial).
  const sug = [];
  s.ejercicios.forEach((e, i) => {
    const p = { ...e.pres, ejercicio: e.ejercicio, rol: e.rol, unidad: e.unidad };
    const ant = ultimoRegistro(hechas, e.ejercicio, e.rol);
    const dolor = !!ant?.sesion.feedback?.grupos?.[e.grupo]?.dolor;
    const topHoy = e.rol === 'backoff' ? sug[s.ejercicios.findIndex(x => x.ejercicio === e.ejercicio && x.rol === 'top')] : null;
    sug[i] = sugerir(p, hechas, { dolor, topHoy });
  });
  const marcas = s.ejercicios.map(e => mejorMarca(hechas, e.ejercicio));

  const pintar = () => {
    const total = s.ejercicios.reduce((a, e) => a + e.series.length, 0);
    app.innerHTML = `
      <div class="fila mb"><div class="grow"><p class="sub">${esc(s.mesoNombre || '')}</p><h2>${esc(nombreSesion(s))}</h2>
        <p class="sub">${contarHechas(s)}/${total} series</p></div></div>
      ${s.ejercicios.map((e, i) => htmlEjercicio(e, i, sug[i], ultimoRegistro(hechas, e.ejercicio, e.rol))).join('')}
      <button class="btn full mt" id="btnTerminar">Terminar entreno</button>
      <button class="btn ghost full mt" id="btnDescartar">Descartar sesión</button>`;
    montar();
  };

  const montar = () => {
    $$('table.series input', app).forEach(inp => inp.addEventListener('input', () => {
      const [i, j] = inp.dataset.p.split('-').map(Number);
      s.ejercicios[i].series[j][inp.dataset.k] = inp.value.trim();
      guardarPronto(s);
    }));
    $$('.tipo-serie', app).forEach(b => b.onclick = () => {
      const [i, j] = b.dataset.p.split('-').map(Number);
      const serie = s.ejercicios[i].series[j];
      serie.tipo = SIG_TIPO[serie.tipo || 'N'];
      toast(NOMBRE_TIPO[serie.tipo]);
      guardarPronto(s); pintar();
    });
    $$('.check', app).forEach(b => b.onclick = () => {
      const [i, j] = b.dataset.p.split('-').map(Number);
      const e = s.ejercicios[i], serie = e.series[j];
      if (!serie.ok) {
        // Casillas vacías: se toma lo que sugería la app (el texto en gris).
        const fila = b.closest('tr');
        if (!serie.kg && e.unidad !== 'reps') serie.kg = $('input[data-k=kg]', fila)?.placeholder || '';
        if (!serie.reps) serie.reps = $('input[data-k=reps]', fila)?.placeholder || '';
        if (!serie.reps && !serie.kg) return toast('Apunta peso y reps');
        serie.ok = true;
        const valor = e.unidad === 'kg' ? e1rm(num(serie.kg), num(serie.reps)) : 0;
        serie.pr = serie.tipo !== 'C' && marcas[i] > 0 && valor > marcas[i];
        if (serie.pr) { marcas[i] = valor; toast('¡Nuevo récord en ' + e.nombre + '!'); }
        arrancarDescanso(e.pres.descanso);
      } else {
        serie.ok = false; serie.pr = false;
      }
      guardarPronto(s, true); pintar();
    });
    $$('[data-add]', app).forEach(b => b.onclick = () => {
      const e = s.ejercicios[+b.dataset.add];
      const ult = e.series[e.series.length - 1] || {};
      e.series.push({ tipo: 'N', kg: ult.kg || '', reps: '', ok: false });
      guardarPronto(s); pintar();
    });
    $$('[data-quitar]', app).forEach(b => b.onclick = () => {
      const e = s.ejercicios[+b.dataset.quitar];
      if (e.series.length > 1) { e.series.pop(); guardarPronto(s); pintar(); }
    });
    $$('[data-nota]', app).forEach(b => b.onclick = () => {
      const e = s.ejercicios[+b.dataset.nota];
      modal(`<h3 class="mb">Nota · ${esc(e.nombre)}</h3>
        <textarea id="mNota" autofocus placeholder="Molestias, máquina distinta, sensaciones…">${esc(e.nota)}</textarea>
        <button class="btn full mt" id="mOk">Guardar</button>`);
      $('#mOk').onclick = () => { e.nota = $('#mNota').value.trim(); guardarPronto(s); cerrarModal(); pintar(); };
    });
    $('#btnTerminar', app).onclick = () => terminar(s);
    $('#btnDescartar', app).onclick = async () => {
      if (!await confirmar('¿Descartar esta sesión? Se pierde lo anotado.', { ok: 'Descartar', peligro: true })) return;
      clearTimeout(guardarTimer);
      await datos.sesiones.borrar(datos.estado.clienteId, s.id);
      pararDescanso(); pantallaEncendida(false); ir('hoy');
    };
  };

  pintar();
}

function htmlEjercicio(e, i, sug, ant) {
  const prev = ant ? seriesTrabajo(ant.ej) : [];
  let iTrabajo = 0;
  const filas = e.series.map((x, j) => {
    // La columna "anterior" y la sugerencia van por series de trabajo: los calentamientos no cuentan.
    const k = x.tipo === 'C' ? -1 : iTrabajo++;
    const p = k >= 0 ? prev[k] : null;
    const sg = k >= 0 ? sug?.series[Math.min(k, sug.series.length - 1)] : null;
    const phKg = sg?.kg != null ? fmtNum(sg.kg) : (p?.kg || '');
    const phReps = sg?.reps != null ? String(sg.reps) : (p?.reps || '');
    const kgCelda = e.unidad === 'reps' ? '<span class="faint">—</span>'
      : `<input data-p="${i}-${j}" data-k="kg" value="${esc(x.kg)}" placeholder="${esc(phKg)}" inputmode="${e.unidad === 'banda' ? 'text' : 'decimal'}" aria-label="Peso serie ${j + 1}">`;
    return `<tr class="${x.ok ? 'hecha' : ''}">
      <td><button class="tipo-serie ${x.tipo || 'N'}" data-p="${i}-${j}" title="Tipo de serie">${x.tipo && x.tipo !== 'N' ? x.tipo : k + 1}</button></td>
      <td class="prev">${p ? esc(fmtSerie(p, e.unidad)) : '—'}</td>
      <td>${kgCelda}</td>
      <td><input data-p="${i}-${j}" data-k="reps" value="${esc(x.reps)}" placeholder="${esc(phReps)}" inputmode="numeric" aria-label="Reps serie ${j + 1}"></td>
      <td><button class="check" data-p="${i}-${j}" aria-label="Serie hecha">✓</button>${x.pr ? '<span class="pr">PR</span>' : ''}</td>
    </tr>`;
  }).join('');
  const colKg = { kg: 'Kg', banda: 'Banda', reps: '' }[e.unidad] ?? 'Kg';
  return `<div class="ej">
    <div class="ej-h"><div class="grow"><h3>${esc(e.nombre)}</h3>
      <div class="ej-pres">${textoPres(e.pres)}</div>
      ${e.pres.notas ? `<div class="ej-notas">${esc(e.pres.notas)}</div>` : ''}</div>${badgeRol(e.rol)}</div>
    ${sug ? `<div class="sug ${sug.tipo}"><span>${esc(sug.texto)}</span></div>` : ''}
    <table class="series"><thead><tr><th>Serie</th><th>Anterior</th><th>${colKg}</th><th>Reps</th><th></th></tr></thead>
      <tbody>${filas}</tbody></table>
    <div class="ej-pie">
      <span><button class="link" data-add="${i}">+ Serie</button> <button class="link dim" data-quitar="${i}">− Serie</button></span>
      <button class="link dim" data-nota="${i}">${e.nota ? 'Nota ✓' : 'Nota'}</button>
    </div>
  </div>`;
}

/* Al terminar: encuesta corta por grupo muscular (al estilo RP) y a guardar. */
function terminar(s) {
  const grupos = [...new Set(s.ejercicios.filter(e => e.series.some(x => x.ok)).map(e => e.grupo))];
  if (!grupos.length) return toast('Marca al menos una serie antes de terminar');
  const fb = { sensacion: 2, notas: '', grupos: Object.fromEntries(grupos.map(g => [g, { congestion: 2, carga: 2, dolor: false }])) };
  const seg = (g, campo, ops) => `<div class="seg" data-g="${g}" data-c="${campo}">${ops.map((o, k) =>
    `<button data-v="${k + 1}" class="${fb.grupos[g][campo] === k + 1 ? 'on' : ''}">${o}</button>`).join('')}</div>`;
  modal(`<h3>¿Cómo ha ido?</h3><p class="sub mb">Tu entrenador lo usa para ajustar las series de la semana que viene.</p>
    ${grupos.map(g => `<div class="card" style="background:var(--surface-2)">
      <b>${esc(GRUPOS[g] || g)}</b>
      <p class="lbl mt">Congestión</p>${seg(g, 'congestion', ['Poca', 'Media', 'Mucha'])}
      <p class="lbl mt">Carga de trabajo</p>${seg(g, 'carga', ['Fácil', 'Justa', 'Demasiado'])}
      <label class="fila mt" style="font-size:.9rem"><input type="checkbox" data-dolor="${g}" style="width:auto;min-height:auto"> Molestia o dolor articular</label>
    </div>`).join('')}
    <p class="lbl">Sensación general</p>
    <div class="seg mb" id="segSens">${['Floja', 'Normal', 'Muy buena'].map((o, k) => `<button data-v="${k + 1}" class="${k === 1 ? 'on' : ''}">${o}</button>`).join('')}</div>
    <textarea id="fbNotas" placeholder="Algo que quieras contarle a tu entrenador"></textarea>
    <button class="btn full mt" id="fbOk">Guardar entreno</button>`);
  $$('#modal .seg[data-g] button').forEach(b => b.onclick = () => {
    const box = b.parentElement;
    fb.grupos[box.dataset.g][box.dataset.c] = +b.dataset.v;
    $$('button', box).forEach(x => x.classList.toggle('on', x === b));
  });
  $$('#segSens button').forEach(b => b.onclick = () => { fb.sensacion = +b.dataset.v; $$('#segSens button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#modal [data-dolor]').forEach(c => c.onchange = () => { fb.grupos[c.dataset.dolor].dolor = c.checked; });
  $('#fbOk').onclick = async () => {
    fb.notas = $('#fbNotas').value.trim();
    // Las series sin marcar y sin datos no se guardan.
    s.ejercicios.forEach(e => { e.series = e.series.filter(x => x.ok || x.kg || x.reps); });
    s.feedback = fb;
    s.estado = 'hecha';
    s.duracionMin = s.inicio ? Math.round((Date.now() - s.inicio) / 60000) : null;
    clearTimeout(guardarTimer);
    await datos.sesiones.guardar(datos.estado.clienteId, s);
    cerrarModal(); pararDescanso(); pantallaEncendida(false);
    toast('Entreno guardado');
    ir('sesion/' + s.id);
  };
}

/* ================= Historial y detalle ================= */
async function vHistorial(app, _, vigente) {
  const { hechas } = await cargar();
  if (!vigente()) return;
  if (!hechas.length) { app.innerHTML = `<h2 class="mb">Historial</h2><div class="vacio">Aún no has terminado ninguna sesión.</div>`; return; }
  app.innerHTML = `<h2 class="mb">Historial</h2><div class="lista-ses">${hechas.map(s => `
    <a class="ses-fila" href="#/sesion/${esc(s.id)}" style="text-decoration:none;color:inherit">
      <div class="grow"><b>${esc(nombreSesion(s))}</b><p class="sub">${esc(fechaSesion(s))}${s.duracionMin ? ` · ${s.duracionMin} min` : ''}</p></div>
      ${s.comentario ? '<span class="badge acc">Comentario</span>' : ''}
      ${s.ejercicios.some(e => e.series.some(x => x.pr)) ? '<span class="badge gold">PR</span>' : ''}
    </a>`).join('')}</div>`;
}

async function vSesion(app, [id], vigente) {
  const { sesiones } = await cargar();
  if (!vigente()) return;
  const s = sesiones.find(x => x.id === id);
  if (!s) { app.innerHTML = `<div class="vacio">No se encuentra esa sesión.</div>`; return; }
  app.innerHTML = `<a href="#/historial" class="link">← Historial</a>
    <h2 class="mt">${esc(nombreSesion(s))}</h2><p class="sub mb">${esc(fechaSesion(s))}${s.duracionMin ? ` · ${s.duracionMin} min` : ''}</p>
    ${s.comentario ? `<div class="card" style="border-color:var(--accent)"><p class="sub">Tu entrenador</p><p style="margin:6px 0 0">${esc(s.comentario)}</p></div>` : ''}
    ${htmlDetalleSesion(s)}`;
}

/* ================= Progreso ================= */
const selProgreso = { ej: null, m: '1rm' };
async function vProgreso(app, _, vigente) {
  const { hechas } = await cargar();
  if (!vigente()) return;
  app.innerHTML = `<h2 class="mb">Progreso</h2><div id="prog"></div>`;
  montarProgreso($('#prog', app), hechas, selProgreso);
}

/* ================= Alta ================= */
async function vAlta(app, _, vigente) {
  const { cliente } = await cargar();
  if (!vigente()) return;
  app.innerHTML = `<h2>Sobre ti</h2><p class="sub mb">Lo verá tu entrenador para ajustar el plan.</p>
    <div class="card">${htmlAlta(cliente.alta)}<button class="btn full" id="btnAlta">Guardar</button></div>`;
  $('#btnAlta', app).onclick = async () => {
    await datos.guardarAlta(cliente.id, leerAlta(app));
    toast('Guardado'); ir('hoy');
  };
}

/* ================= menú ================= */
export function menuCliente() {
  const vistaPrevia = datos.estado.usuario && !datos.estado.usuario.isAnonymous;
  modal(`<h3 class="mb">Opciones</h3>
    <button class="btn ghost full mb" id="mAlta">Mis datos y objetivo</button>
    <button class="btn ghost full mb" id="mImp">Importar historial del plan antiguo</button>
    <button class="btn ghost full mb" id="mExp">Descargar mis datos</button>
    ${vistaPrevia ? '<button class="btn full mb" id="mSalir">Volver al panel de entrenador</button>' : ''}
    <p class="sub">${datos.estado.modo === 'local' ? 'Modo local: los datos solo están en este navegador.' : 'Lo que anotas se guarda en el móvil y se sincroniza con tu entrenador.'}</p>`);
  $('#mAlta').onclick = () => { cerrarModal(); ir('alta'); };
  $('#mImp').onclick = () => { cerrarModal(); importarAntiguo(datos.estado.clienteId); };
  $('#mExp').onclick = async () => {
    const id = datos.estado.clienteId;
    const [c, ss] = await Promise.all([datos.clientes.obtener(id), datos.sesiones.listar(id)]);
    descargarJSON({ cliente: c, sesiones: ss }, `entrenos-${hoy()}.json`);
    cerrarModal();
  };
  $('#mSalir')?.addEventListener('click', () => { datos.salirDeCliente(); cerrarModal(); ir('clientes'); });
}

export function descargarJSON(obj, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Importa el JSON que exporta el plan antiguo (un HTML por cliente). */
export function importarAntiguo(clienteId, despues = render) {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = () => {
    const f = i.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      let ss;
      try { ss = importarPlanAntiguo(JSON.parse(r.result)); } catch { return toast('Ese archivo no es una copia del plan antiguo'); }
      if (!ss.length) return toast('El archivo no tiene series anotadas');
      for (const s of ss) await datos.sesiones.guardar(clienteId, s);
      toast(`${ss.length} sesiones importadas`);
      despues();
    };
    r.readAsText(f);
  };
  i.click();
}

export const vistasCliente = { hoy: vHoy, entrenar: vEntrenar, historial: vHistorial, sesion: vSesion, progreso: vProgreso, alta: vAlta };
