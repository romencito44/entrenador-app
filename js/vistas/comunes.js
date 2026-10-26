/* Piezas que comparten el panel del entrenador y la vista del cliente. */

import { $, $$, esc, fmtNum, fmtFecha, num } from '../util.js';
import { GRUPOS, ROLES } from '../biblioteca.js';
import { metricaSesion, seriesTrabajo } from '../progresion.js';
import { fmtDescanso } from '../util.js';

export const METRICAS = {
  '1rm': ['1RM estimado', 'kg'],
  peso: ['Peso máximo', 'kg'],
  vol: ['Volumen', 'kg'],
  reps: ['Reps totales', 'reps'],
};

export function textoPres(p) {
  const reps = p.reps ? (p.reps[0] === p.reps[1] ? p.reps[0] : `${p.reps[0]}-${p.reps[1]}`) : '';
  const partes = [`${p.series} × ${reps}`, `RIR ${p.rir}`];
  if (p.descanso) partes.push(fmtDescanso(p.descanso));
  return partes.join(' · ');
}

export function badgeRol(rol) {
  if (rol === 'top') return '<span class="badge acc">Top set</span>';
  if (rol === 'backoff') return '<span class="badge">Back off</span>';
  return '';
}

export function fmtSerie(s, unidad) {
  const kg = s.kg != null && s.kg !== '' ? (typeof s.kg === 'number' ? fmtNum(s.kg) : String(s.kg)) : '';
  const reps = s.reps != null && s.reps !== '' ? String(s.reps) : '';
  if (unidad === 'reps') return reps ? `${reps} reps` : '—';
  if (kg && reps) return `${kg} × ${reps}`;
  return kg || (reps ? `${reps} reps` : '—');
}

export function nombreSesion(s) {
  if (s.importada) return s.etiqueta || 'Sesión importada';
  return s.titulo || s.diaNombre || 'Sesión';
}

export function fechaSesion(s) {
  if (s.importada) return 'Plan antiguo';
  return s.fecha ? fmtFecha(s.fecha, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
}

/* ---------- detalle de una sesión (solo lectura) ---------- */
export function htmlDetalleSesion(s) {
  const fb = s.feedback || {};
  const grupos = Object.entries(fb.grupos || {});
  return `
    ${s.ejercicios.filter(e => (e.series || []).some(x => x.kg !== '' || x.reps !== '')).map(e => `
      <div class="card">
        <div class="card-h"><div class="grow"><h3>${esc(e.nombre)}</h3></div>${badgeRol(e.rol)}</div>
        <div class="mt" style="display:grid;gap:4px">
          ${(e.series || []).filter(x => x.kg !== '' || x.reps !== '').map((x, i) =>
            `<div class="fila" style="font-size:.9rem"><span class="faint num" style="width:22px">${x.tipo && x.tipo !== 'N' ? x.tipo : i + 1}</span>
             <span class="num">${esc(fmtSerie(x, e.unidad))}</span>${x.pr ? '<span class="badge gold">PR</span>' : ''}</div>`).join('') || '<span class="faint">Sin series anotadas</span>'}
        </div>
        ${e.nota ? `<p class="sub mt">${esc(e.nota)}</p>` : ''}
      </div>`).join('')}
    ${grupos.length || fb.notas || fb.sensacion ? `<div class="card">
      <h3 class="mb">Cómo fue</h3>
      ${fb.sensacion ? `<p class="sub">Sensación general: <b>${['', 'Floja', 'Normal', 'Muy buena'][fb.sensacion]}</b></p>` : ''}
      ${grupos.map(([g, v]) => `<div class="fila mt" style="font-size:.88rem">
          <b style="min-width:90px">${esc(GRUPOS[g] || g)}</b>
          <span class="badge">Congestión ${['', 'baja', 'media', 'alta'][v.congestion] || '—'}</span>
          <span class="badge">Carga ${['', 'fácil', 'justa', 'demasiado'][v.carga] || '—'}</span>
          ${v.dolor ? '<span class="badge danger">Dolor articular</span>' : ''}
        </div>`).join('')}
      ${fb.notas ? `<p class="mt">${esc(fb.notas)}</p>` : ''}
    </div>` : ''}`;
}

/* ---------- gráfico de evolución por ejercicio ---------- */
export function opcionesEjercicios(historial) {
  const vistos = new Map();
  [...historial].reverse().forEach(s => (s.ejercicios || []).forEach(e => {
    if (seriesTrabajo(e).length && !vistos.has(e.ejercicio)) vistos.set(e.ejercicio, { nombre: e.nombre, unidad: e.unidad });
  }));
  return vistos;
}

/* Un punto por sesión: la métrica sobre todas las series de ese ejercicio (top + back off juntos). */
export function puntosEjercicio(historial, ejercicio, metrica) {
  return [...historial].reverse().map(s => {
    const series = (s.ejercicios || []).filter(e => e.ejercicio === ejercicio).flatMap(e => e.series || []);
    if (!series.length) return null;
    const v = metricaSesion({ series }, metrica);
    return v == null ? null : { v, s };
  }).filter(Boolean);
}

export function grafico(puntos, unidad) {
  if (puntos.length < 2) return `<div class="vacio">Hacen falta al menos dos sesiones para dibujar la línea.</div>`;
  const W = 600, H = 200, P = 34;
  const vs = puntos.map(p => p.v);
  const max = Math.max(...vs), min = Math.min(...vs), rng = (max - min) || 1;
  const x = i => P + i * (W - P - 12) / (puntos.length - 1);
  const y = v => H - 24 - (v - min) / rng * (H - 48);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${d}L${x(puntos.length - 1).toFixed(1)},${H - 24}L${x(0).toFixed(1)},${H - 24}Z`;
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución">
    <defs><linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#ff5a36" stop-opacity=".28"/><stop offset="1" stop-color="#ff5a36" stop-opacity="0"/></linearGradient></defs>
    <line class="eje" x1="${P}" x2="${W - 8}" y1="${H - 24}" y2="${H - 24}"/>
    <text x="4" y="${y(max) + 4}">${fmtNum(Math.round(max * 10) / 10)}</text>
    <text x="4" y="${y(min) + 4}">${fmtNum(Math.round(min * 10) / 10)}</text>
    <path class="area" d="${area}"/>
    <path class="lin" d="${d}"/>
    ${puntos.map((p, i) => `<circle class="${p.s.importada ? 'imp' : ''}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4"><title>${esc(nombreSesion(p.s))}: ${fmtNum(Math.round(p.v * 10) / 10)} ${unidad}</title></circle>`).join('')}
  </svg>`;
}

/* Vista de progreso completa: selector de ejercicio + métrica + gráfico + últimas marcas. */
export function montarProgreso(cont, historial, estadoSel) {
  const ops = opcionesEjercicios(historial);
  if (!ops.size) { cont.innerHTML = `<div class="vacio">Aún no hay sesiones con series anotadas.</div>`; return; }
  if (!ops.has(estadoSel.ej)) estadoSel.ej = [...ops.keys()][ops.size - 1];
  const info = ops.get(estadoSel.ej);
  if (info.unidad !== 'kg') estadoSel.m = 'reps';
  const pts = puntosEjercicio(historial, estadoSel.ej, estadoSel.m);
  const [nomM, uni] = METRICAS[estadoSel.m];
  const ultimo = pts[pts.length - 1], primero = pts[0];
  cont.innerHTML = `
    <div class="field"><select id="selEj">${[...ops].map(([k, v]) => `<option value="${esc(k)}" ${k === estadoSel.ej ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('')}</select></div>
    <div class="seg mb" id="segM">${Object.entries(METRICAS).map(([k, [n]]) =>
      `<button data-m="${k}" class="${k === estadoSel.m ? 'on' : ''}" ${info.unidad !== 'kg' && k !== 'reps' ? 'disabled style="opacity:.35"' : ''}>${n}</button>`).join('')}</div>
    <div class="card">
      ${pts.length ? `<div class="grid2 mb">
        <div class="kpi"><b>${fmtNum(Math.round(ultimo.v * 10) / 10)}</b><span>${nomM} · última</span></div>
        <div class="kpi"><b>${pts.length > 1 ? (ultimo.v >= primero.v ? '+' : '') + fmtNum(Math.round((ultimo.v - primero.v) * 10) / 10) : '—'}</b><span>desde el inicio (${uni})</span></div>
      </div>` : ''}
      ${grafico(pts, uni)}
      <p class="sub mt">${estadoSel.m === '1rm' ? 'Fuerza máxima estimada (Epley): sube tanto si añades kilos como si haces más reps con el mismo peso.' : ''} Los puntos grises vienen del plan antiguo.</p>
    </div>`;
  $('#selEj', cont).onchange = e => { estadoSel.ej = e.target.value; estadoSel.m = '1rm'; montarProgreso(cont, historial, estadoSel); };
  $$('#segM button', cont).forEach(b => b.onclick = () => { estadoSel.m = b.dataset.m; montarProgreso(cont, historial, estadoSel); });
}

/* ---------- cuestionario de alta ---------- */
export const ALTA_VACIA = { completada: false, objetivo: '', nivel: 'principiante', dias: 3, duracion: '', altura: '', peso: '', material: '', lesiones: '', notas: '' };

export function htmlAlta(a) {
  a = { ...ALTA_VACIA, ...(a || {}) };
  return `
    <div class="field"><label class="lbl">Objetivo</label><textarea id="aObj" placeholder="Qué quieres conseguir">${esc(a.objetivo)}</textarea></div>
    <div class="grid2">
      <div class="field"><label class="lbl">Nivel</label><select id="aNiv">
        ${['principiante', 'intermedio', 'avanzado'].map(n => `<option ${a.nivel === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl">Días por semana</label><input id="aDias" type="number" min="1" max="7" value="${esc(a.dias)}"></div>
      <div class="field"><label class="lbl">Altura (cm)</label><input id="aAlt" type="number" inputmode="numeric" value="${esc(a.altura)}"></div>
      <div class="field"><label class="lbl">Peso (kg)</label><input id="aPeso" type="text" inputmode="decimal" value="${esc(a.peso)}"></div>
    </div>
    <div class="field"><label class="lbl">Tiempo por sesión</label><input id="aDur" value="${esc(a.duracion)}" placeholder="p. ej. 60-75 min"></div>
    <div class="field"><label class="lbl">Material disponible</label><input id="aMat" value="${esc(a.material)}" placeholder="Gimnasio completo, casa con mancuernas…"></div>
    <div class="field"><label class="lbl">Lesiones o molestias</label><textarea id="aLes" placeholder="Si no hay, déjalo vacío">${esc(a.lesiones)}</textarea></div>
    <div class="field"><label class="lbl">Algo más</label><textarea id="aNot">${esc(a.notas)}</textarea></div>`;
}

export function leerAlta(cont) {
  const v = id => $('#' + id, cont).value.trim();
  return { completada: true, objetivo: v('aObj'), nivel: v('aNiv'), dias: num(v('aDias')) || 3, duracion: v('aDur'),
    altura: num(v('aAlt')) || '', peso: num(v('aPeso')) || '', material: v('aMat'), lesiones: v('aLes'), notas: v('aNot') };
}

export { GRUPOS, ROLES };
