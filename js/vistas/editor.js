/* Editor de programas: mesociclos → días → ejercicios.
   Lo usan las plantillas y el programa de cada cliente. */

import { $$, esc, uid, slug, num, clonar, confirmar } from '../util.js';
import { BIBLIOTECA, GRUPOS, ROLES, UNIDADES, buscarPorNombre } from '../biblioteca.js';
import { nuevaPrescripcion, nuevoMesociclo, totalSemanas } from '../programa.js';
import { textoPres, badgeRol } from './comunes.js';

const abiertos = new Set();   // prescripciones desplegadas (sobrevive a los repintados)

export function editorPrograma(cont, prog, alCambiar) {
  const cambio = (repintar = true) => { alCambiar(prog); if (repintar) pintar(); };

  function pintar() {
    cont.innerHTML = `
      <div class="field"><label class="lbl">Nombre del programa</label><input data-f="nombre" value="${esc(prog.nombre)}"></div>
      <div class="field"><label class="lbl">Descripción</label><textarea data-f="descripcion" style="min-height:60px">${esc(prog.descripcion || '')}</textarea></div>
      ${prog.mesociclos.map((m, mi) => htmlMeso(m, mi)).join('')}
      <button class="btn ghost full" data-acc="addMeso">+ Mesociclo (copia del anterior)</button>
      <datalist id="dlEj">${Object.values(BIBLIOTECA).map(e => `<option value="${esc(e.nombre)}">`).join('')}</datalist>`;
    montar();
  }

  function htmlMeso(m, mi) {
    return `<div class="meso">
      <div class="fila"><span class="badge acc">Mesociclo ${mi + 1}</span><span class="grow"></span>
        <button class="icon-btn" data-acc="borrarMeso" data-mi="${mi}" title="Borrar mesociclo">✕</button></div>
      <div class="field mt"><label class="lbl">Nombre</label><input data-m="${mi}" data-f="nombre" value="${esc(m.nombre)}"></div>
      <div class="field"><label class="lbl">Foco del bloque</label><textarea data-m="${mi}" data-f="foco" style="min-height:60px">${esc(m.foco || '')}</textarea></div>
      <div class="grid2">
        <div class="field"><label class="lbl">Microciclos (semanas)</label><input type="number" min="1" max="12" data-m="${mi}" data-f="semanas" value="${m.semanas}"></div>
        <div class="field"><label class="lbl">Descarga al final</label>
          <select data-m="${mi}" data-f="descarga"><option value="1" ${m.descarga ? 'selected' : ''}>Sí (+1 semana)</option><option value="0" ${m.descarga ? '' : 'selected'}>No</option></select></div>
      </div>
      <p class="sub">${totalSemanas(m)} semanas · ${m.dias.length} días por semana. En la descarga la app quita un tercio de las series y pone RIR 4.</p>
      ${m.dias.map((d, di) => htmlDia(d, mi, di, m.dias.length)).join('')}
      <button class="btn ghost sm mt" data-acc="addDia" data-mi="${mi}">+ Día</button>
    </div>`;
  }

  function htmlDia(d, mi, di, n) {
    return `<div class="dia">
      <div class="fila">
        <input class="grow" data-m="${mi}" data-d="${di}" data-f="nombre" value="${esc(d.nombre)}" style="font-weight:600">
        <button class="icon-btn" data-acc="subirDia" data-mi="${mi}" data-di="${di}" ${di ? '' : 'disabled'} title="Subir">↑</button>
        <button class="icon-btn" data-acc="dupDia" data-mi="${mi}" data-di="${di}" title="Duplicar día">⧉</button>
        <button class="icon-btn" data-acc="borrarDia" data-mi="${mi}" data-di="${di}" title="Borrar día">✕</button>
      </div>
      <input class="mt" data-m="${mi}" data-d="${di}" data-f="enfoque" value="${esc(d.enfoque || '')}" placeholder="Enfoque (p. ej. cuádriceps · aductor · gemelo)">
      <div class="mt">${d.ejercicios.map((e, ei) => htmlPres(e, mi, di, ei, d.ejercicios.length)).join('') || '<p class="sub">Sin ejercicios.</p>'}</div>
      <button class="link" data-acc="addEj" data-mi="${mi}" data-di="${di}">+ Ejercicio</button>
    </div>`;
  }

  function htmlPres(e, mi, di, ei, n) {
    const k = `data-m="${mi}" data-d="${di}" data-e="${ei}"`;
    const abierto = abiertos.has(e.id);
    return `<div class="pres">
      <div class="pres-res" data-acc="toggle" data-id="${e.id}">
        <span class="faint num" style="width:18px">${ei + 1}</span>
        <div class="grow"><b>${esc(e.nombre || 'Ejercicio sin nombre')}</b> ${badgeRol(e.rol)}
          <div class="sub num" style="font-size:.78rem">${textoPres(e)}${e.extra?.desde ? ` · +${e.extra.mas} desde MC${e.extra.desde}` : ''}</div></div>
        <span class="faint">${abierto ? '▾' : '▸'}</span>
      </div>
      ${abierto ? `<div class="pres-form">
        <div class="c4"><label class="lbl">Ejercicio</label><input list="dlEj" ${k} data-f="nombre" value="${esc(e.nombre)}" placeholder="Busca o escribe uno nuevo"></div>
        <div class="c2"><label class="lbl">Grupo</label><select ${k} data-f="grupo">${Object.entries(GRUPOS).map(([g, n]) => `<option value="${g}" ${e.grupo === g ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl">Tipo</label><select ${k} data-f="rol">${Object.entries(ROLES).map(([r, n]) => `<option value="${r}" ${e.rol === r ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl">Carga en</label><select ${k} data-f="unidad">${Object.entries(UNIDADES).map(([u, n]) => `<option value="${u}" ${e.unidad === u ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl">Series</label><input type="number" min="1" ${k} data-f="series" value="${e.series}"></div>
        <div><label class="lbl">Reps mín.</label><input type="number" min="1" ${k} data-f="repsMin" value="${e.reps[0]}"></div>
        <div><label class="lbl">Reps máx.</label><input type="number" min="1" ${k} data-f="repsMax" value="${e.reps[1]}"></div>
        <div><label class="lbl">RIR</label><input type="number" min="0" max="5" ${k} data-f="rir" value="${e.rir}"></div>
        <div><label class="lbl">Descanso (s)</label><input type="number" min="0" step="15" ${k} data-f="descanso" value="${e.descanso}"></div>
        <div><label class="lbl">Salto (kg)</label><input inputmode="decimal" ${k} data-f="incremento" value="${String(e.incremento ?? '').replace('.', ',')}"></div>
        <div><label class="lbl">+1 serie desde MC</label><input type="number" min="0" ${k} data-f="extraDesde" value="${e.extra?.desde || ''}" placeholder="—"></div>
        <div><label class="lbl">Series extra</label><input type="number" min="0" ${k} data-f="extraMas" value="${e.extra?.mas || ''}" placeholder="—"></div>
        <div class="c4"><label class="lbl">Notas para el cliente</label><input ${k} data-f="notas" value="${esc(e.notas || '')}"></div>
        <div class="c4 fila">
          <button class="btn ghost sm" data-acc="subirEj" ${k} ${ei ? '' : 'disabled'}>↑</button>
          <button class="btn ghost sm" data-acc="bajarEj" ${k} ${ei < n - 1 ? '' : 'disabled'}>↓</button>
          <button class="btn ghost sm" data-acc="dupEj" ${k}>Duplicar</button>
          <span class="grow"></span>
          <button class="btn ghost sm" data-acc="borrarEj" ${k} style="color:var(--danger)">Quitar</button>
        </div>
      </div>` : ''}
    </div>`;
  }

  function aplicarCampo(el) {
    const f = el.dataset.f, v = el.value;
    if (el.dataset.e != null) {
      const e = prog.mesociclos[+el.dataset.m].dias[+el.dataset.d].ejercicios[+el.dataset.e];
      if (f === 'nombre') {
        e.nombre = v.trim();
        const b = buscarPorNombre(v);
        // De la biblioteca: hereda grupo, unidad y salto. Si es nuevo, la clave sale del nombre.
        if (b) Object.assign(e, { ejercicio: b.id, grupo: b.grupo, unidad: b.unidad, incremento: b.incremento });
        else e.ejercicio = slug(v);
      } else if (f === 'repsMin') e.reps = [Math.max(1, num(v) || 1), Math.max(num(v) || 1, e.reps[1])];
      else if (f === 'repsMax') e.reps = [Math.min(e.reps[0], num(v) || e.reps[0]), Math.max(1, num(v) || e.reps[1])];
      else if (f === 'extraDesde' || f === 'extraMas') {
        const ex = { desde: e.extra?.desde || 0, mas: e.extra?.mas || 1, [f === 'extraDesde' ? 'desde' : 'mas']: num(v) || 0 };
        if (ex.desde && ex.mas) e.extra = ex; else delete e.extra;
      } else if (['series', 'rir', 'descanso', 'incremento'].includes(f)) e[f] = Math.max(0, num(v) ?? 0);
      else e[f] = v;
      return true;
    }
    if (el.dataset.d != null) { prog.mesociclos[+el.dataset.m].dias[+el.dataset.d][f] = v; return false; }
    if (el.dataset.m != null) {
      const m = prog.mesociclos[+el.dataset.m];
      if (f === 'semanas') m.semanas = Math.max(1, Math.min(12, num(v) || 1));
      else if (f === 'descarga') m.descarga = v === '1';
      else m[f] = v;
      return f === 'semanas' || f === 'descarga';
    }
    prog[f] = v;
    return false;
  }

  function montar() {
    $$('[data-f]', cont).forEach(el => el.addEventListener('change', () => cambio(aplicarCampo(el))));
    $$('[data-acc]', cont).forEach(el => el.addEventListener('click', async ev => {
      ev.stopPropagation();
      const { acc } = el.dataset;
      const mi = +el.dataset.mi || +el.dataset.m || 0, di = +(el.dataset.di ?? el.dataset.d ?? 0), ei = +el.dataset.e;
      const m = prog.mesociclos[mi], dias = m?.dias, ejs = dias?.[di]?.ejercicios;
      switch (acc) {
        case 'toggle': abiertos.has(el.dataset.id) ? abiertos.delete(el.dataset.id) : abiertos.add(el.dataset.id); return pintar();
        case 'addMeso': {
          const ult = prog.mesociclos[prog.mesociclos.length - 1];
          const nuevo = ult ? clonar(ult) : nuevoMesociclo(1);
          nuevo.id = uid(); nuevo.nombre = `Mesociclo ${prog.mesociclos.length + 1}`;
          nuevo.dias.forEach(d => { d.id = uid(); d.ejercicios.forEach(e => { e.id = uid(); }); });
          prog.mesociclos.push(nuevo); return cambio();
        }
        case 'borrarMeso':
          if (prog.mesociclos.length === 1) return;
          if (!await confirmar(`¿Borrar «${m.nombre}»?`, { ok: 'Borrar', peligro: true })) return;
          prog.mesociclos.splice(mi, 1); return cambio();
        case 'addDia': dias.push({ id: uid(), nombre: `Día ${dias.length + 1}`, enfoque: '', ejercicios: [] }); return cambio();
        case 'subirDia': [dias[di - 1], dias[di]] = [dias[di], dias[di - 1]]; return cambio();
        case 'dupDia': {
          const d = clonar(dias[di]); d.id = uid(); d.nombre += ' (copia)'; d.ejercicios.forEach(e => { e.id = uid(); });
          dias.splice(di + 1, 0, d); return cambio();
        }
        case 'borrarDia':
          if (!await confirmar(`¿Borrar «${dias[di].nombre}»?`, { ok: 'Borrar', peligro: true })) return;
          dias.splice(di, 1); return cambio();
        case 'addEj': { const e = nuevaPrescripcion(); ejs.push(e); abiertos.add(e.id); return cambio(); }
        case 'subirEj': [ejs[ei - 1], ejs[ei]] = [ejs[ei], ejs[ei - 1]]; return cambio();
        case 'bajarEj': [ejs[ei + 1], ejs[ei]] = [ejs[ei], ejs[ei + 1]]; return cambio();
        case 'dupEj': { const e = { ...clonar(ejs[ei]), id: uid() }; ejs.splice(ei + 1, 0, e); return cambio(); }
        case 'borrarEj': ejs.splice(ei, 1); return cambio();
      }
    }));
  }

  pintar();
}
