/* Andrea: su mesociclo 3 y el importador del plan antiguo (un HTML por cliente).

   El plan antiguo guardaba en localStorage claves como
     meso2-dia3-hip-thrust-top-mc2-s1-carga = "70"
     meso2-dia3-hip-thrust-top-mc2-s1-reps  = "6"
     meso2-dia3-mc2-completada              = true
     meso1-dia1-adductor-mc1                = "55-12"   (formato antiguo: texto libre)
   y su botón "Exportar" descarga ese mismo objeto en JSON. */

import { uid } from './util.js';
import { BIBLIOTECA } from './biblioteca.js';

function ej(ejercicio, rol, series, reps, rir, descanso, extra = {}) {
  const b = BIBLIOTECA[ejercicio];
  return {
    id: uid(), ejercicio, nombre: b.nombre, grupo: b.grupo, unidad: b.unidad, incremento: b.incremento,
    rol, series, reps, rir, descanso, notas: '', ...extra,
  };
}

const RAMPA = { extra: { desde: 3, mas: 1 } };

export function programaAndrea() {
  return {
    id: uid(),
    nombre: 'Hipertrofia pierna, glúteo y espalda',
    descripcion: 'Bloque 3 tras dos mesociclos (acumulación e intensificación). Vuelve a acumular volumen sobre cargas más altas, con la espalda como prioridad.',
    mesociclos: [{
      id: uid(),
      nombre: 'Mesociclo 3 · Reacumulación',
      foco: 'Más volumen con RIR 1 en back off y accesorios. Espalda dos días de verdad. Desde el microciclo 3, una serie más en glúteo y espalda. Objetivo: la primera dominada estricta (se prueba en la descarga).',
      semanas: 5,
      descarga: true,
      dias: [
        { id: uid(), nombre: 'Día 1 · Pierna', enfoque: 'Cuádriceps · aductor · femoral · gemelo', ejercicios: [
          ej('adductor', 'normal', 3, [12, 15], 1, 75),
          ej('sentadilla-pendular', 'top', 1, [5, 6], 0, 180, { notas: 'Si salen 7 reps o más, el peso va corto: la app te sube el doble.' }),
          ej('sentadilla-pendular', 'backoff', 2, [6, 9], 1, 150),
          ej('prensa-piernas', 'normal', 3, [8, 10], 1, 120),
          ej('extension-cuadriceps', 'normal', 3, [10, 12], 1, 90),
          ej('femoral-sentado', 'normal', 3, [10, 12], 1, 90, { notas: 'Nuevo: sustituye al femoral tumbado.' }),
          ej('elevacion-talon-sentado', 'normal', 3, [12, 15], 1, 60),
        ] },
        { id: uid(), nombre: 'Día 2 · Torso', enfoque: 'Press · jalón · remo · hombro · tríceps', ejercicios: [
          ej('press-banca-inclinado', 'top', 1, [5, 6], 0, 150),
          ej('press-banca-inclinado', 'backoff', 2, [6, 9], 1, 120),
          ej('jalon-neutro', 'normal', 3, [10, 12], 1, 90, { notas: 'Nuevo.', ...RAMPA }),
          ej('remo-pecho-apoyado', 'normal', 3, [8, 12], 1, 90, { notas: 'Nuevo.', ...RAMPA }),
          ej('press-militar-mancuernas', 'normal', 3, [8, 10], 1, 90),
          ej('extension-triceps-cuerda', 'normal', 3, [12, 15], 1, 60),
          ej('dominadas-elastico', 'normal', 2, [5, 8], 2, 120, { notas: 'Técnica: subida limpia, sin balanceo, deja 1-2 de margen.' }),
        ] },
        { id: uid(), nombre: 'Día 3 · Pierna', enfoque: 'Cadena posterior · glúteo', ejercicios: [
          ej('hip-thrust', 'top', 1, [5, 6], 0, 180),
          ej('hip-thrust', 'backoff', 2, [6, 9], 1, 150, RAMPA),
          ej('peso-muerto-rumano', 'top', 1, [5, 6], 0, 180),
          ej('peso-muerto-rumano', 'backoff', 2, [6, 9], 1, 150),
          ej('bulgaras-gluteos', 'normal', 3, [10, 12], 1, 90, { notas: 'Vuelven en lugar de la zancada.' }),
          ej('abduccion-cadera', 'normal', 3, [12, 15], 1, 60, { notas: 'Nuevo: glúteo medio.', ...RAMPA }),
          ej('patada-gluteo-polea', 'normal', 2, [12, 15], 1, 60),
          ej('elevacion-talon-pie', 'normal', 3, [12, 15], 1, 60),
        ] },
        { id: uid(), nombre: 'Día 4 · Espalda', enfoque: 'Tirón · bíceps · core', ejercicios: [
          ej('rack-chin', 'normal', 3, [6, 10], 1, 120, { notas: 'Al final de la última serie, una negativa lenta (4-5 s).', ...RAMPA }),
          ej('remo-t', 'normal', 3, [8, 12], 1, 120),
          ej('jalon-unilateral', 'normal', 3, [10, 12], 1, 75, { notas: 'Nuevo: cada lado por separado.' }),
          ej('pullover-polea', 'normal', 3, [12, 15], 1, 60, { notas: 'Nuevo: dorsal sin bíceps.' }),
          ej('curl-biceps-mancuernas', 'normal', 3, [10, 12], 1, 60),
          ej('elevacion-cadera', 'normal', 3, [15, 30], 1, 60),
          ej('abdominales-crunch-polea', 'normal', 3, [12, 20], 1, 60),
        ] },
      ],
    }],
  };
}

export const ALTA_ANDREA = {
  completada: true, objetivo: 'Hipertrofia de pierna, glúteo y espalda. Primera dominada sin ayuda.',
  nivel: 'intermedio', dias: 4, duracion: '60-75 min', altura: 175, peso: 62,
  material: 'Gimnasio completo (pendular, hip thrust, poleas, mancuernas, barra, banda elástica)',
  lesiones: 'Ninguna indicada', notas: 'Viene de 10 semanas: mesociclo 1 (acumulación) y 2 (intensificación).',
};

/* ---------- importador del plan antiguo ---------- */

// Clave del plan antiguo → [ejercicio de la biblioteca, rol]
const MAPA = {
  'adductor': ['adductor', 'normal'],
  'sentadilla-pendular-top': ['sentadilla-pendular', 'top'],
  'sentadilla-pendular-backoff': ['sentadilla-pendular', 'backoff'],
  'sentadilla-pendular': ['sentadilla-pendular', 'backoff'],
  'bulgaras-cuadriceps': ['bulgaras-cuadriceps', 'normal'],
  'prensa-piernas': ['prensa-piernas', 'normal'],
  'extension-cuadriceps-d1': ['extension-cuadriceps', 'normal'],
  'extension-cuadriceps-d3': ['extension-cuadriceps', 'normal'],
  'femoral-tumbado': ['femoral-tumbado', 'normal'],
  'elevacion-talon-sentado': ['elevacion-talon-sentado', 'normal'],
  'press-banca-inclinado-top': ['press-banca-inclinado', 'top'],
  'press-banca-inclinado-backoff': ['press-banca-inclinado', 'backoff'],
  'press-banca-inclinado': ['press-banca-inclinado', 'backoff'],
  'dominadas-elastico': ['dominadas-elastico', 'normal'],
  'remo-gironda': ['remo-gironda', 'normal'],
  'elevaciones-laterales-polea': ['elevaciones-laterales-polea', 'normal'],
  'extension-triceps-unilateral': ['extension-triceps-unilateral', 'normal'],
  'extension-triceps-cuerda': ['extension-triceps-cuerda', 'normal'],
  'press-militar-mancuernas': ['press-militar-mancuernas', 'normal'],
  'abdominales-crunch-polea': ['abdominales-crunch-polea', 'normal'],
  'hip-thrust-top': ['hip-thrust', 'top'],
  'hip-thrust-backoff': ['hip-thrust', 'backoff'],
  'hip-thrust': ['hip-thrust', 'backoff'],
  'peso-muerto-rumano-top': ['peso-muerto-rumano', 'top'],
  'peso-muerto-rumano-backoff': ['peso-muerto-rumano', 'backoff'],
  'peso-muerto-rumano': ['peso-muerto-rumano', 'backoff'],
  'bulgaras-gluteos': ['bulgaras-gluteos', 'normal'],
  'zancada-caminando': ['zancada-caminando', 'normal'],
  'patada-gluteo-polea': ['patada-gluteo-polea', 'normal'],
  'elevacion-talon-pie': ['elevacion-talon-pie', 'normal'],
  'rack-chin': ['rack-chin', 'normal'],
  'jalon-pecho-polea': ['jalon-pecho-polea', 'normal'],
  'remo-t': ['remo-t', 'normal'],
  'remo-unilateral-polea': ['remo-unilateral-polea', 'normal'],
  'curl-biceps-mancuernas': ['curl-biceps-mancuernas', 'normal'],
  'elevacion-cadera': ['elevacion-cadera', 'normal'],
};

const ORDEN_MICRO = { mc1: 1, mc2: 2, mc3: 3, mc4: 4, mc5: 5, descarga: 6 };
const NOMBRE_DIA = { dia1: 'Día 1', dia2: 'Día 2', dia3: 'Día 3', dia4: 'Día 4' };

/* "55-12", "55x12", "55 × 12", "12" → [{kg, reps}] */
function textoLibre(txt) {
  const t = String(txt).trim().replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(?:kg)?\s*[-x×*\/]\s*(\d+)/i);
  if (m) return [{ kg: m[1].replace('.', ','), reps: m[2] }];
  const solo = t.match(/^(\d+(?:\.\d+)?)/);
  return solo ? [{ kg: solo[1].replace('.', ','), reps: '' }] : [];
}

/* Devuelve las sesiones (ya en el formato de la app) que salen del JSON antiguo.
   Solo se crea una sesión por día y microciclo que tenga algún dato. */
export function importarPlanAntiguo(datos) {
  const grupos = new Map();   // "meso2|dia3|mc2" → { meso, dia, micro, ejercicios: Map }
  const re = /^(meso\d)-(dia\d)-(.+?)-(mc\d|descarga)(?:-s(\d+)-(carga|reps))?$/;
  for (const [clave, valor] of Object.entries(datos || {})) {
    if (valor == null || valor === '' || typeof valor === 'boolean') continue;
    const m = clave.match(re);
    if (!m) continue;
    const [, meso, dia, slugEj, micro, serie, campo] = m;
    const mapa = MAPA[slugEj];
    if (!mapa) continue;
    const k = `${meso}|${dia}|${micro}`;
    if (!grupos.has(k)) grupos.set(k, { meso, dia, micro, ejercicios: new Map() });
    const g = grupos.get(k);
    const ke = `${mapa[0]}|${mapa[1]}`;
    if (!g.ejercicios.has(ke)) g.ejercicios.set(ke, { ejercicio: mapa[0], rol: mapa[1], series: [] });
    const e = g.ejercicios.get(ke);
    if (serie) {
      const i = +serie - 1;
      e.series[i] ||= { tipo: 'N', kg: '', reps: '', ok: true };
      e.series[i][campo === 'carga' ? 'kg' : 'reps'] = String(valor).trim();
    } else if (!e.series.length) {
      e.series = textoLibre(valor).map(s => ({ tipo: 'N', ...s, ok: true }));
    }
  }

  const out = [];
  for (const g of grupos.values()) {
    const ejercicios = [...g.ejercicios.values()].map(e => {
      const b = BIBLIOTECA[e.ejercicio];
      return { pid: null, ejercicio: e.ejercicio, rol: e.rol, nombre: b.nombre, grupo: b.grupo, unidad: b.unidad,
        series: e.series.filter(Boolean).filter(s => s.kg !== '' || s.reps !== '') };
    }).filter(e => e.series.length);
    if (!ejercicios.length) continue;
    const nMeso = +g.meso.slice(4);
    const micro = ORDEN_MICRO[g.micro] || 0;
    out.push({
      id: `imp-${g.meso}-${g.dia}-${g.micro}`,          // id fijo: reimportar no duplica
      ts: nMeso * 1000 + micro * 10 + (+g.dia.slice(3)),  // orden cronológico, por debajo de cualquier fecha real
      fecha: null,
      importada: true,
      etiqueta: `Plan antiguo · Meso ${nMeso} · ${g.micro === 'descarga' ? 'Descarga' : g.micro.toUpperCase()} · ${NOMBRE_DIA[g.dia] || g.dia}`,
      estado: 'hecha',
      mesoId: null, semana: null, diaId: null,
      diaNombre: NOMBRE_DIA[g.dia] || g.dia,
      ejercicios,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}
