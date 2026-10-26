/* Estructura de un programa y cómo se recorre.
   Sin DOM: lo usan las vistas y los tests.

   programa = { id, nombre, descripcion, mesociclos: [mesociclo] }
   mesociclo = { id, nombre, foco, semanas, descarga, dias: [dia] }
     · semanas: microciclos normales; si descarga es true se añade una semana más.
   dia = { id, nombre, enfoque, ejercicios: [prescripcion] }
   prescripcion = { id, ejercicio, nombre, grupo, rol, unidad, series, reps: [min, max],
                    rir, descanso, incremento, notas, extra?: { desde, mas } }
     · extra: a partir de la semana `desde` se suman `mas` series (rampa de volumen). */

import { uid } from './util.js';

export const RIR_DESCARGA = 4;

export function totalSemanas(meso) {
  return (meso.semanas || 0) + (meso.descarga ? 1 : 0);
}

export function esDescarga(meso, semana) {
  return !!meso.descarga && semana === (meso.semanas || 0) + 1;
}

export function etiquetaSemana(meso, semana) {
  return esDescarga(meso, semana) ? 'Descarga' : `MC${semana}`;
}

/* Prescripción efectiva de un ejercicio en una semana concreta. */
export function prescripcionSemana(p, meso, semana) {
  let series = p.series || 1;
  if (p.extra && p.extra.desde && semana >= p.extra.desde && !esDescarga(meso, semana)) series += p.extra.mas || 0;
  if (esDescarga(meso, semana)) {
    // Descarga: un tercio menos de series (3→2, 2→1) y RIR 4, mismo rango de reps.
    return { ...p, series: Math.max(1, Math.round(series * 2 / 3)), rir: RIR_DESCARGA, descarga: true };
  }
  return { ...p, series, descarga: false };
}

/* Lista ordenada de todas las sesiones que tiene el programa. */
export function huecos(programa) {
  const out = [];
  (programa?.mesociclos || []).forEach((meso, mi) => {
    for (let s = 1; s <= totalSemanas(meso); s++) {
      meso.dias.forEach((dia, di) => out.push({ meso, mi, semana: s, dia, di }));
    }
  });
  return out;
}

const claveHueco = (mesoId, semana, diaId) => `${mesoId}|${semana}|${diaId}`;

/* La primera sesión del programa que aún no está hecha. */
export function siguienteHueco(programa, sesiones) {
  const hechas = new Set(sesiones.filter(s => s.estado === 'hecha')
    .map(s => claveHueco(s.mesoId, s.semana, s.diaId)));
  return huecos(programa).find(h => !hechas.has(claveHueco(h.meso.id, h.semana, h.dia.id))) || null;
}

export function estaHecho(sesiones, mesoId, semana, diaId) {
  return sesiones.some(s => s.estado === 'hecha' && s.mesoId === mesoId && s.semana === semana && s.diaId === diaId);
}

/* Progreso del programa: cuántas sesiones hechas de las planificadas. */
export function avance(programa, sesiones) {
  const hs = huecos(programa);
  const hechas = hs.filter(h => estaHecho(sesiones, h.meso.id, h.semana, h.dia.id)).length;
  return { hechas, total: hs.length };
}

/* Copia profunda con ids nuevos (al asignar una plantilla a un cliente o duplicar). */
export function renovarIds(programa) {
  const p = JSON.parse(JSON.stringify(programa));
  p.id = uid();
  p.mesociclos.forEach(m => {
    m.id = uid();
    m.dias.forEach(d => { d.id = uid(); d.ejercicios.forEach(e => { e.id = uid(); }); });
  });
  return p;
}

export function nuevaPrescripcion(base = {}) {
  return {
    id: uid(), ejercicio: '', nombre: '', grupo: 'gluteo', rol: 'normal', unidad: 'kg',
    series: 3, reps: [10, 12], rir: 1, descanso: 90, incremento: 2.5, notas: '', ...base,
  };
}

export function nuevoMesociclo(n = 1) {
  return { id: uid(), nombre: `Mesociclo ${n}`, foco: '', semanas: 4, descarga: true,
    dias: [{ id: uid(), nombre: 'Día 1', enfoque: '', ejercicios: [] }] };
}

export function nuevoPrograma(nombre = 'Programa nuevo') {
  return { id: uid(), nombre, descripcion: '', mesociclos: [nuevoMesociclo(1)] };
}
