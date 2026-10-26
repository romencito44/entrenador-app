// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerir, ajusteVolumen, mejorMarca, e1rm } from '../js/progresion.js';
import { prescripcionSemana, siguienteHueco, totalSemanas } from '../js/programa.js';

const ses = (ejercicio, rol, series, ts = 1) =>
  ({ ts, estado: 'hecha', ejercicios: [{ ejercicio, rol, unidad: 'kg', series: series.map(([kg, reps, tipo = 'N']) => ({ kg, reps, tipo })) }] });

const top = { ejercicio: 'hip-thrust', rol: 'top', unidad: 'kg', series: 1, reps: [5, 6], rir: 0, incremento: 2.5 };
const back = { ...top, rol: 'backoff', series: 2, reps: [6, 9], rir: 1 };
const acc = { ejercicio: 'remo-t', rol: 'normal', unidad: 'kg', series: 3, reps: [8, 12], rir: 1, incremento: 2.5 };

test('top set: al tope del rango sube un incremento', () => {
  const s = sugerir(top, [ses('hip-thrust', 'top', [['70', '6']])]);
  assert.equal(s.tipo, 'subir');
  assert.deepEqual(s.series, [{ kg: 72.5, reps: 5 }]);
});

test('top set: 7+ reps con rango 5-6 sube doble (el peso iba corto)', () => {
  const s = sugerir(top, [ses('hip-thrust', 'top', [['65', '9']])]);
  assert.equal(s.series[0].kg, 70);
});

test('top set: dentro del rango mantiene peso y pide una rep más', () => {
  const s = sugerir(top, [ses('hip-thrust', 'top', [['70', '5']])]);
  assert.equal(s.tipo, 'reps');
  assert.deepEqual(s.series, [{ kg: 70, reps: 6 }]);
});

test('top set: muy por debajo del rango baja peso', () => {
  const s = sugerir(top, [ses('hip-thrust', 'top', [['70', '3']])]);
  assert.equal(s.tipo, 'bajar');
  assert.equal(s.series[0].kg, 67.5);
});

test('acepta coma decimal', () => {
  const s = sugerir({ ...top, ejercicio: 'press-banca-inclinado', incremento: 1 },
    [ses('press-banca-inclinado', 'top', [['12,5', '6']])]);
  assert.equal(s.series[0].kg, 13.5);
});

test('calentamientos no cuentan', () => {
  const s = sugerir(top, [ses('hip-thrust', 'top', [['40', '10', 'C'], ['70', '5']])]);
  assert.deepEqual(s.series, [{ kg: 70, reps: 6 }]);
});

test('back off sin historial: 90 % del top de hoy', () => {
  const s = sugerir(back, [], { topHoy: { series: [{ kg: 72.5, reps: 5 }] } });
  assert.equal(s.series.length, 2);
  assert.equal(s.series[0].kg, 65);
});

test('doble progresión: todas al tope suben peso', () => {
  const s = sugerir(acc, [ses('remo-t', 'normal', [['30', '12'], ['30', '12'], ['30', '12']])]);
  assert.equal(s.tipo, 'subir');
  assert.equal(s.series[0].kg, 32.5);
  assert.equal(s.series[0].reps, 8);
});

test('doble progresión: si no, misma carga y +1 rep por serie', () => {
  const s = sugerir(acc, [ses('remo-t', 'normal', [['30', '12'], ['30', '10'], ['30', '9']])]);
  assert.deepEqual(s.series.map(x => x.reps), [12, 11, 10]);
  assert.ok(s.series.every(x => x.kg === 30));
});

test('dolor articular: no sube', () => {
  const s = sugerir(acc, [ses('remo-t', 'normal', [['30', '12'], ['30', '12'], ['30', '12']])], { dolor: true });
  assert.equal(s.tipo, 'mantener');
  assert.equal(s.series[0].kg, 30);
});

test('banda: a 10 reps toca bajar de banda', () => {
  const p = { ejercicio: 'rack-chin', rol: 'normal', unidad: 'banda', series: 3, reps: [6, 10] };
  const h = [{ ts: 1, estado: 'hecha', ejercicios: [{ ejercicio: 'rack-chin', rol: 'normal', unidad: 'banda', series: [{ kg: 'verde', reps: '10' }] }] }];
  assert.equal(sugerir(p, h).tipo, 'banda');
});

test('usa la sesión más reciente del historial', () => {
  const h = [ses('remo-t', 'normal', [['35', '8']], 2), ses('remo-t', 'normal', [['30', '12']], 1)];
  assert.equal(sugerir(acc, h).series[0].kg, 35);
});

test('descarga: un tercio menos de series y RIR 4', () => {
  const meso = { semanas: 5, descarga: true };
  assert.equal(totalSemanas(meso), 6);
  const p = prescripcionSemana({ ...acc, series: 3 }, meso, 6);
  assert.equal(p.series, 2);
  assert.equal(p.rir, 4);
  assert.equal(prescripcionSemana({ ...acc, series: 2 }, meso, 6).series, 1);
});

test('rampa de volumen: +1 serie desde la semana indicada', () => {
  const meso = { semanas: 5, descarga: true };
  const p = { ...acc, series: 3, extra: { desde: 3, mas: 1 } };
  assert.equal(prescripcionSemana(p, meso, 2).series, 3);
  assert.equal(prescripcionSemana(p, meso, 3).series, 4);
  assert.equal(prescripcionSemana(p, meso, 6).series, 2);
});

test('siguiente sesión: la primera sin hacer, en orden', () => {
  const prog = { mesociclos: [{ id: 'm', semanas: 2, descarga: false, dias: [{ id: 'd1' }, { id: 'd2' }] }] };
  const h = siguienteHueco(prog, [{ estado: 'hecha', mesoId: 'm', semana: 1, diaId: 'd1' }]);
  assert.equal(h.semana, 1);
  assert.equal(h.dia.id, 'd2');
});

test('ajuste de volumen tipo RP', () => {
  assert.equal(ajusteVolumen({ dolor: true }).cambio, -1);
  assert.equal(ajusteVolumen({ carga: 3, congestion: 3 }).cambio, -1);
  assert.equal(ajusteVolumen({ carga: 1, congestion: 1 }).cambio, 1);
  assert.equal(ajusteVolumen({ carga: 2, congestion: 2 }).cambio, 0);
});

test('mejor marca por 1RM estimado', () => {
  const h = [ses('hip-thrust', 'top', [['70', '6']]), ses('hip-thrust', 'backoff', [['65', '9']])];
  assert.equal(mejorMarca(h, 'hip-thrust'), Math.max(e1rm(70, 6), e1rm(65, 9)));
});

import { importarPlanAntiguo, programaAndrea } from '../js/andrea.js';

test('importa el plan antiguo de Andrea (series y texto libre)', () => {
  const ss = importarPlanAntiguo({
    'meso2-dia3-hip-thrust-top-mc2-s1-carga': '70',
    'meso2-dia3-hip-thrust-top-mc2-s1-reps': '6',
    'meso2-dia3-hip-thrust-backoff-mc2-s2-carga': '62,5',
    'meso2-dia3-hip-thrust-backoff-mc2-s2-reps': '8',
    'meso2-dia3-mc2-completada': true,
    'meso1-dia1-adductor-mc1': '55-12',
    'meso1-dia1-mc1-completada': true,
  });
  assert.equal(ss.length, 2);
  assert.equal(ss[0].id, 'imp-meso2-dia3-mc2');               // la más reciente primero
  const top = ss[0].ejercicios.find(e => e.rol === 'top');
  assert.deepEqual([top.series[0].kg, top.series[0].reps], ['70', '6']);
  assert.equal(ss[1].ejercicios[0].series[0].kg, '55');
  // y la sugerencia de hoy sale de ahí: 6 reps en rango 5-6 → +2,5
  const p = programaAndrea().mesociclos[0].dias[2].ejercicios[0];
  assert.equal(sugerir({ ...p, descarga: false }, ss).series[0].kg, 72.5);
});

import { readFileSync, existsSync } from 'node:fs';

test('todas las claves de ejercicio del plan antiguo de Andrea se importan', t => {
  const ruta = new URL('../../Skills/kit-entrenamiento-y-nutricion/Plan entreno andrea/Plan de Entrenamiento - Andrea.html', import.meta.url);
  if (!existsSync(ruta)) return t.skip('No está el HTML antiguo');
  const html = readFileSync(ruta, 'utf8');
  const claves = new Set([...html.matchAll(/data-base="(meso\d-dia\d-.+?-(?:mc\d|descarga))"/g)].map(m => m[1]));
  const datos = Object.fromEntries([...claves].map(k => [k + '-s1-carga', '10']));
  const ss = importarPlanAntiguo(datos);
  const importadas = ss.reduce((a, s) => a + s.ejercicios.length, 0);
  assert.equal(importadas, claves.size);
});
