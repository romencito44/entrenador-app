/* Biblioteca de ejercicios.
   La clave (id) es lo que une el historial entre bloques distintos: si un
   ejercicio se repite en otro mesociclo con la misma clave, la columna
   "Anterior" y la sugerencia de carga siguen funcionando. */

export const GRUPOS = {
  cuadriceps: 'Cuádriceps', gluteo: 'Glúteo', femoral: 'Femoral', aductor: 'Aductor',
  gemelo: 'Gemelo', espalda: 'Espalda', pecho: 'Pecho', hombro: 'Hombro',
  biceps: 'Bíceps', triceps: 'Tríceps', core: 'Core',
};

export const ROLES = { top: 'Top set', backoff: 'Back off', normal: 'Normal' };

export const UNIDADES = { kg: 'kg', banda: 'Banda', reps: 'Solo reps' };

/* [id, nombre, grupo, unidad, incremento] */
const LISTA = [
  ['sentadilla-pendular', 'Sentadilla pendular', 'cuadriceps', 'kg', 2.5],
  ['sentadilla-hack', 'Sentadilla hack', 'cuadriceps', 'kg', 5],
  ['sentadilla-barra', 'Sentadilla con barra', 'cuadriceps', 'kg', 2.5],
  ['prensa-piernas', 'Prensa de piernas', 'cuadriceps', 'kg', 5],
  ['extension-cuadriceps', 'Extensión de cuádriceps', 'cuadriceps', 'kg', 2.5],
  ['bulgaras-cuadriceps', 'Búlgaras (enfocada en cuádriceps)', 'cuadriceps', 'kg', 2],
  ['bulgaras-gluteos', 'Búlgaras (enfocada en glúteos)', 'gluteo', 'kg', 2],
  ['zancada-caminando', 'Zancada caminando con mancuernas', 'gluteo', 'kg', 2],
  ['step-up', 'Step-up con mancuernas', 'gluteo', 'kg', 2],
  ['hip-thrust', 'Hip thrust en máquina', 'gluteo', 'kg', 2.5],
  ['hip-thrust-barra', 'Hip thrust con barra', 'gluteo', 'kg', 2.5],
  ['patada-gluteo-polea', 'Patada de glúteo en polea', 'gluteo', 'kg', 2.5],
  ['abduccion-cadera', 'Abducción de cadera en máquina', 'gluteo', 'kg', 2.5],
  ['elevacion-cadera', 'Elevación de cadera', 'gluteo', 'reps', 0],
  ['peso-muerto-rumano', 'Peso muerto rumano', 'femoral', 'kg', 2.5],
  ['femoral-tumbado', 'Femoral tumbado', 'femoral', 'kg', 2.5],
  ['femoral-sentado', 'Femoral sentado', 'femoral', 'kg', 2.5],
  ['adductor', 'Adductor en máquina', 'aductor', 'kg', 2.5],
  ['elevacion-talon-sentado', 'Elevación de talón sentado', 'gemelo', 'kg', 2.5],
  ['elevacion-talon-pie', 'Elevación de talón de pie', 'gemelo', 'kg', 2.5],
  ['press-banca-inclinado', 'Press banca inclinado con mancuernas', 'pecho', 'kg', 1],
  ['press-banca', 'Press banca con barra', 'pecho', 'kg', 2.5],
  ['aperturas-polea', 'Aperturas en polea', 'pecho', 'kg', 2.5],
  ['press-militar-mancuernas', 'Press militar con mancuernas', 'hombro', 'kg', 1],
  ['elevaciones-laterales-polea', 'Elevaciones laterales en polea', 'hombro', 'kg', 1.25],
  ['elevaciones-laterales', 'Elevaciones laterales con mancuernas', 'hombro', 'kg', 1],
  ['face-pull', 'Face pull', 'hombro', 'kg', 2.5],
  ['dominadas-elastico', 'Dominadas con elástico', 'espalda', 'banda', 0],
  ['dominadas', 'Dominadas', 'espalda', 'reps', 0],
  ['rack-chin', 'Rack chin', 'espalda', 'banda', 0],
  ['jalon-pecho-polea', 'Jalón al pecho (agarre abierto)', 'espalda', 'kg', 2.5],
  ['jalon-neutro', 'Jalón al pecho (agarre neutro)', 'espalda', 'kg', 2.5],
  ['jalon-unilateral', 'Jalón unilateral en polea', 'espalda', 'kg', 1.25],
  ['remo-t', 'Remo T', 'espalda', 'kg', 2.5],
  ['remo-pecho-apoyado', 'Remo con pecho apoyado', 'espalda', 'kg', 2.5],
  ['remo-gironda', 'Remo gironda (agarre neutro)', 'espalda', 'kg', 2.5],
  ['remo-unilateral-polea', 'Remo unilateral en polea', 'espalda', 'kg', 1.25],
  ['pullover-polea', 'Pullover en polea', 'espalda', 'kg', 2.5],
  ['curl-biceps-mancuernas', 'Curl de bíceps con mancuernas', 'biceps', 'kg', 1],
  ['curl-polea', 'Curl de bíceps en polea', 'biceps', 'kg', 1.25],
  ['extension-triceps-cuerda', 'Extensión de tríceps en polea con cuerda', 'triceps', 'kg', 1.25],
  ['extension-triceps-unilateral', 'Extensión de tríceps unilateral en polea', 'triceps', 'kg', 1.25],
  ['abdominales-crunch-polea', 'Crunch abdominal en polea', 'core', 'kg', 2.5],
  ['plancha', 'Plancha', 'core', 'reps', 0],
];

export const BIBLIOTECA = Object.fromEntries(LISTA.map(([id, nombre, grupo, unidad, incremento]) =>
  [id, { id, nombre, grupo, unidad, incremento }]));

export function buscarPorNombre(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  return Object.values(BIBLIOTECA).find(e => e.nombre.toLowerCase() === n) || null;
}
