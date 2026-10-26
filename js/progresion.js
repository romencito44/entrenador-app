/* Reglas de progresión, récords y ajuste de volumen.
   Funciones puras: reciben la prescripción y el historial, devuelven la
   sugerencia. No tocan el DOM ni los datos. */

import { num, fmtNum } from './util.js';

/* Series de trabajo (sin calentamientos) con algún dato. */
export function seriesTrabajo(ej) {
  return (ej?.series || []).filter(s => s.tipo !== 'C' && (num(s.kg) != null || num(s.reps) != null));
}

/* Busca en el historial (sesiones hechas, de más reciente a más antigua) la
   última vez que se hizo este ejercicio con este rol. */
export function ultimoRegistro(historial, ejercicio, rol) {
  for (const ses of historial) {
    const ej = (ses.ejercicios || []).find(e => e.ejercicio === ejercicio && (e.rol || 'normal') === (rol || 'normal'));
    if (ej && seriesTrabajo(ej).length) return { sesion: ses, ej };
  }
  return null;
}

/* Sumar o restar un salto a un peso ya real (12,5 + 1 = 13,5, sin redondear al salto). */
const sumar = (k, d) => Math.max(0, Math.round((k + d) * 4) / 4);

/* Peso calculado (p. ej. 90 % del top set): al múltiplo del salto más cercano. */
const redondear = (x, inc) => {
  if (!inc) return Math.round(x * 2) / 2;
  return Math.max(inc, Math.round(x / inc) * inc);
};

/* Sugerencia para hoy.
   p: prescripción efectiva de la semana (programa.prescripcionSemana).
   historial: sesiones hechas del cliente, la más reciente primero.
   opciones.topHoy: sugerencia del top set del mismo ejercicio hoy (para el
     primer back off sin historial).
   opciones.dolor: el cliente marcó dolor articular en este grupo la última vez.

   Devuelve { series: [{kg, reps}], texto, tipo } o null si no hay nada que decir.
   tipo: 'subir' | 'reps' | 'mantener' | 'bajar' | 'tantear' | 'descarga' | 'banda' */
export function sugerir(p, historial, opciones = {}) {
  const [min, max] = p.reps || [8, 12];
  const n = p.series || 1;
  const inc = p.incremento || 2.5;
  const prev = ultimoRegistro(historial, p.ejercicio, p.rol);
  const prevSeries = prev ? seriesTrabajo(prev.ej) : [];

  if (!prev) {
    if (p.rol === 'backoff' && opciones.topHoy && opciones.topHoy.series[0]?.kg != null) {
      const kg = redondear(opciones.topHoy.series[0].kg * 0.9, inc);
      return { series: Array.from({ length: n }, () => ({ kg, reps: min })),
        texto: `Primer back off: ~10 % menos que el top set (${fmtNum(kg)} kg).`, tipo: 'tantear' };
    }
    return { series: Array.from({ length: n }, () => ({ kg: null, reps: min })),
      texto: 'Sin registro previo: primera sesión de tanteo, busca un peso que te deje en el RIR que marca.', tipo: 'tantear' };
  }

  const reps = prevSeries.map(s => num(s.reps) ?? 0);
  const kgs = prevSeries.map(s => num(s.kg));
  const kgRef = kgs.find(k => k != null) ?? null;
  const filas = i => prevSeries[Math.min(i, prevSeries.length - 1)];

  if (p.descarga) {
    return { series: Array.from({ length: n }, (_, i) => ({ kg: num(filas(i).kg), reps: min })),
      texto: `Descarga: mismo peso que la última vez, ${min} reps dejando ${p.rir} en reserva.`, tipo: 'descarga' };
  }

  if (p.unidad === 'banda') {
    if (Math.max(...reps) >= max) {
      return { series: Array.from({ length: n }, () => ({ kg: null, reps: min })),
        texto: `Llegaste a ${max} reps: baja de banda hoy y vuelve a ${min}.`, tipo: 'banda' };
    }
    return { series: Array.from({ length: n }, (_, i) => ({ kg: filas(i).kg || null, reps: Math.min(max, (num(filas(i).reps) ?? min) + 1) })),
      texto: 'Misma banda, una rep más por serie.', tipo: 'reps' };
  }

  if (p.unidad === 'reps' || kgRef == null) {
    const todas = reps.every(r => r >= max);
    return { series: Array.from({ length: n }, (_, i) => ({ kg: null, reps: Math.min(max, (num(filas(i).reps) ?? min) + (todas ? 0 : 1)) })),
      texto: todas ? `Tope del rango (${max}): añade lastre o una pausa arriba.` : 'Una rep más por serie.', tipo: 'reps' };
  }

  if (opciones.dolor) {
    return { series: Array.from({ length: n }, (_, i) => ({ kg: num(filas(i).kg), reps: num(filas(i).reps) })),
      texto: 'La última vez marcaste molestia articular: repite peso y reps, sin forzar.', tipo: 'mantener' };
  }

  if (p.rol === 'top') {
    const r = reps[0], k = kgs[0] ?? kgRef;
    if (r >= max + 1) {
      const kg = sumar(k, inc * 2);
      return { series: [{ kg, reps: min }], texto: `Hiciste ${r} reps: el peso iba corto. Sube a ${fmtNum(kg)} kg y vuelve a ${min}.`, tipo: 'subir' };
    }
    if (r >= max) {
      const kg = sumar(k, inc);
      return { series: [{ kg, reps: min }], texto: `Llegaste a ${max} reps: sube a ${fmtNum(kg)} kg y vuelve a ${min}.`, tipo: 'subir' };
    }
    if (r < min - 1) {
      const kg = sumar(k, -inc);
      return { series: [{ kg, reps: min }], texto: `Te quedaste en ${r} reps: baja a ${fmtNum(kg)} kg y consolida.`, tipo: 'bajar' };
    }
    return { series: [{ kg: k, reps: Math.min(max, r + 1) }], texto: `Mismo peso, busca ${Math.min(max, r + 1)} reps.`, tipo: 'reps' };
  }

  // Back off y accesorios: doble progresión. Cuando todas las series llegan
  // al tope del rango, se sube peso y se vuelve abajo.
  if (reps.length >= Math.min(n, prevSeries.length) && reps.every(r => r >= max)) {
    const kg = sumar(kgRef, inc);
    return { series: Array.from({ length: n }, () => ({ kg, reps: min })),
      texto: `Todas las series a ${max}: sube a ${fmtNum(kg)} kg y vuelve a ${min}.`, tipo: 'subir' };
  }
  return { series: Array.from({ length: n }, (_, i) => {
      const f = filas(i);
      return { kg: num(f.kg) ?? kgRef, reps: Math.min(max, Math.max(min, (num(f.reps) ?? min) + 1)) };
    }),
    texto: 'Mismo peso, una rep más en cada serie hasta llegar al tope.', tipo: 'reps' };
}

/* ---------- récords ---------- */

export const e1rm = (kg, reps) => (kg && reps) ? kg * (1 + reps / 30) : 0;

/* Mejor 1RM estimado de un ejercicio en el historial (cualquier rol). */
export function mejorMarca(historial, ejercicio) {
  let mejor = 0;
  for (const ses of historial) for (const ej of ses.ejercicios || []) {
    if (ej.ejercicio !== ejercicio || ej.unidad === 'banda' || ej.unidad === 'reps') continue;
    for (const s of seriesTrabajo(ej)) mejor = Math.max(mejor, e1rm(num(s.kg), num(s.reps)));
  }
  return mejor;
}

/* ---------- ajuste de volumen (al estilo RP) ----------
   feedback por grupo: { congestion: 1-3, dolor: bool, carga: 1-3 }
   congestion 1 = poca, 3 = mucha; carga 1 = fácil, 2 = justa, 3 = demasiado. */
export function ajusteVolumen(fb) {
  if (!fb) return null;
  if (fb.dolor) return { cambio: -1, texto: 'Dolor articular: quita una serie y revisa el ejercicio.' };
  if (fb.carga === 3) return { cambio: -1, texto: 'Se le hizo demasiado: quita una serie.' };
  if (fb.carga === 1 && (fb.congestion || 2) <= 2) return { cambio: +1, texto: 'Le sobró: puedes añadir una serie.' };
  return { cambio: 0, texto: 'Volumen adecuado: mantener.' };
}

/* ---------- métricas para las gráficas ---------- */
export function metricaSesion(ej, metrica) {
  const ss = seriesTrabajo(ej);
  if (!ss.length) return null;
  if (metrica === 'reps') return ss.reduce((a, s) => a + (num(s.reps) || 0), 0);
  if (metrica === 'peso') return Math.max(...ss.map(s => num(s.kg) || 0)) || null;
  if (metrica === 'vol') return ss.reduce((a, s) => a + (num(s.kg) || 0) * (num(s.reps) || 0), 0) || null;
  return Math.max(...ss.map(s => e1rm(num(s.kg), num(s.reps)))) || null;
}
