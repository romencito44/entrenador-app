/* Capa de datos.
   Dos implementaciones con la misma interfaz:
   · local: localStorage de este navegador (sin config de Firebase).
   · firebase: Firestore con caché persistente, así que funciona sin
     cobertura y sincroniza al volver la red.

   Colecciones en Firestore:
     plantillas/{id}                 { entrenadorUid, ...programa }
     clientes/{id}                   { entrenadorUid, nombre, codigo, alta, programa, notas, creado }
     clientes/{id}/accesos/{uid}     { codigo, ts }      ← el móvil del cliente
     clientes/{id}/sesiones/{id}     { ...sesion } */

import { firebaseConfig, FIREBASE_SDK } from './config.js';

const SESION_CLIENTE = 'entrenador_app_acceso';   // { clienteId, codigo } en modo cliente

export const estado = { modo: 'local', usuario: null, rol: null, clienteId: null, vistaPrevia: false };

let impl = null;

/* Llega algo nuevo de fuera (lo que anota la clienta, el comentario del entrenador).
   app.js decide si repinta: no lo hace en pantallas donde se está escribiendo. */
let oyenteCambio = null, avisoPendiente = null;
export const alCambiar = f => { oyenteCambio = f; };
function avisarCambio() {
  clearTimeout(avisoPendiente);
  avisoPendiente = setTimeout(() => oyenteCambio?.(), 300);
}

export async function iniciar() {
  const usarFirebase = !!firebaseConfig && !new URLSearchParams(location.search).has('local');
  impl = usarFirebase ? await crearFirebase() : crearLocal();
  estado.modo = usarFirebase ? 'firebase' : 'local';
  await impl.iniciar();
  let acceso = leerAcceso();
  // Con Google dentro, un acceso guardado es el que dejaba antes «Ver como cliente»:
  // el entrenador se quedaba atrapado en la vista de la clienta. Se descarta.
  if (acceso && usarFirebase && estado.usuario && !estado.usuario.isAnonymous) {
    localStorage.removeItem(SESION_CLIENTE);
    acceso = null;
  }
  if (acceso) {
    estado.rol = 'cliente';
    estado.clienteId = acceso.clienteId;
  } else if (estado.usuario && !estado.usuario.isAnonymous) {
    estado.rol = 'entrenador';
  }
  return estado;
}

export function leerAcceso() {
  try { return JSON.parse(localStorage.getItem(SESION_CLIENTE) || 'null'); } catch { return null; }
}

export async function entrarComoCliente(clienteId, codigo) {
  await impl.entrarCliente(clienteId, codigo);
  localStorage.setItem(SESION_CLIENTE, JSON.stringify({ clienteId, codigo }));
  estado.rol = 'cliente';
  estado.clienteId = clienteId;
  estado.vistaPrevia = false;
}

/* «Ver como cliente» del entrenador: solo en memoria. Como dueño de la ficha
   ya puede leerla, así que no se registra ningún acceso ni se guarda nada. */
export function verComoCliente(clienteId) {
  estado.rol = 'cliente';
  estado.clienteId = clienteId;
  estado.vistaPrevia = true;
}

export function salirDeCliente() {
  if (!estado.vistaPrevia) localStorage.removeItem(SESION_CLIENTE);
  estado.rol = estado.usuario && !estado.usuario.isAnonymous ? 'entrenador' : null;
  estado.clienteId = null;
  estado.vistaPrevia = false;
}

export async function entrarEntrenador() { await impl.entrarEntrenador(); estado.rol = 'entrenador'; }
export async function salir() { await impl.salir(); estado.rol = null; }

export const clientes = {
  listar: () => impl.listar('clientes'),
  obtener: id => impl.obtener('clientes', id),
  guardar: c => impl.guardar('clientes', c),
  borrar: id => impl.borrar('clientes', id),
};

export const plantillas = {
  listar: () => impl.listar('plantillas'),
  obtener: id => impl.obtener('plantillas', id),
  guardar: p => impl.guardar('plantillas', p),
  borrar: id => impl.borrar('plantillas', id),
};

export const sesiones = {
  /* Ordenadas de la más reciente a la más antigua. */
  listar: clienteId => impl.listarSesiones(clienteId).then(ss => ss.sort((a, b) => (b.ts || 0) - (a.ts || 0))),
  guardar: (clienteId, s) => impl.guardarSesion(clienteId, s),
  borrar: (clienteId, id) => impl.borrarSesion(clienteId, id),
};

/* Solo lo que el cliente puede tocar de su ficha. */
export const guardarAlta = (clienteId, alta) => impl.guardarAlta(clienteId, alta);

/* ================= local ================= */
function crearLocal() {
  const KEY = 'entrenador_app_v1';
  let db;
  const cargar = () => {
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
    db = db || { clientes: {}, plantillas: {}, sesiones: {} };
  };
  const persistir = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { throw new Error('El navegador no deja guardar más datos: ' + e.message); }
  };
  const copia = o => o ? JSON.parse(JSON.stringify(o)) : o;
  return {
    async iniciar() { cargar(); estado.usuario = { uid: 'local', isAnonymous: false, displayName: 'Entrenador' }; },
    async entrarEntrenador() {},
    async salir() {},
    async entrarCliente(clienteId, codigo) {
      cargar();
      const c = db.clientes[clienteId];
      if (!c || c.codigo !== codigo) throw new Error('Enlace no válido en este dispositivo. En modo local el enlace solo funciona en el navegador donde se creó el cliente.');
    },
    async listar(col) { cargar(); return Object.values(db[col]).map(copia); },
    async obtener(col, id) { cargar(); return copia(db[col][id]) || null; },
    async guardar(col, o) { cargar(); db[col][o.id] = copia({ ...o, entrenadorUid: 'local' }); persistir(); return o; },
    async borrar(col, id) {
      cargar(); delete db[col][id];
      if (col === 'clientes') delete db.sesiones[id];
      persistir();
    },
    async listarSesiones(cid) { cargar(); return Object.values(db.sesiones[cid] || {}).map(copia); },
    async guardarSesion(cid, s) { cargar(); (db.sesiones[cid] ||= {})[s.id] = copia(s); persistir(); return s; },
    async borrarSesion(cid, id) { cargar(); if (db.sesiones[cid]) delete db.sesiones[cid][id]; persistir(); },
    async guardarAlta(cid, alta) { cargar(); if (db.clientes[cid]) { db.clientes[cid].alta = copia(alta); persistir(); } },
  };
}

/* ================= firebase ================= */
async function crearFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const fs = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  const uidActual = () => auth.currentUser?.uid;
  // Firestore no admite undefined: se limpia antes de guardar.
  const limpio = o => JSON.parse(JSON.stringify(o));

  /* Datos vivos en memoria. Antes cada pantalla hacía getDocs/getDoc, que con
     conexión esperan al servidor: ~1 s por toque. Ahora cada consulta abre un
     onSnapshot la primera vez (que responde al momento desde la caché del móvil
     si ya hay datos) y luego se queda escuchando: las siguientes lecturas salen
     de memoria sin esperar a nadie, y los cambios del otro lado van llegando solos. */
  const vivos = new Map();   // clave → { docs: Map(id → datos), listo: Promise, off }
  const copia = o => o ? JSON.parse(JSON.stringify(o)) : o;

  function vivo(clave, ref, esDoc = false) {
    const k = uidActual() + '|' + clave;
    let v = vivos.get(k);
    if (v) return v.listo.then(() => v);
    v = { docs: new Map() };
    vivos.set(k, v);
    v.listo = new Promise((res, rej) => {
      let primero = true;
      v.off = F.onSnapshot(ref, snap => {
        if (esDoc) {
          v.docs.clear();
          if (snap.exists()) v.docs.set(snap.id, { ...snap.data(), id: snap.id });
        } else {
          snap.docChanges().forEach(ch => {
            if (ch.type === 'removed') v.docs.delete(ch.doc.id);
            else v.docs.set(ch.doc.id, { ...ch.doc.data(), id: ch.doc.id });
          });
        }
        if (primero) { primero = false; res(); }
        // Solo avisa de lo que llega de fuera (otro móvil, el servidor), no de lo que se escribe aquí.
        else if (!snap.metadata.hasPendingWrites) avisarCambio();
      }, err => {
        // Sin permiso o sin red en frío: se olvida para reintentar en la próxima lectura.
        vivos.delete(k);
        if (primero) { primero = false; rej(err); } else console.error(err);
      });
    });
    return v.listo.then(() => v);
  }
  const consulta = col => vivo('col:' + col, F.query(F.collection(fs, col), F.where('entrenadorUid', '==', uidActual())));
  const deSesiones = cid => vivo('ses:' + cid, F.collection(fs, 'clientes', cid, 'sesiones'));
  const delDoc = (col, id) => vivo(`doc:${col}/${id}`, F.doc(fs, col, id), true);

  /* Las escrituras se reflejan en memoria en el acto, para que la pantalla
     siguiente ya las vea aunque el onSnapshot aún no haya saltado. */
  function enMemoria(clave, id, datos) {
    const v = vivos.get(uidActual() + '|' + clave);
    if (!v) return;
    if (datos) v.docs.set(id, copia(datos)); else v.docs.delete(id);
  }
  const apagarTodo = () => { vivos.forEach(v => v.off?.()); vivos.clear(); };

  return {
    iniciar() {
      return new Promise(res => {
        const off = A.onAuthStateChanged(auth, u => { estado.usuario = u; off(); res(); });
      });
    },
    async entrarEntrenador() {
      const cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
      estado.usuario = cred.user;
    },
    async salir() { apagarTodo(); await A.signOut(auth); estado.usuario = null; },
    async entrarCliente(clienteId, codigo) {
      if (!auth.currentUser) {
        const cred = await A.signInAnonymously(auth);
        estado.usuario = cred.user;
      }
      const ref = F.doc(fs, 'clientes', clienteId, 'accesos', uidActual());
      try {
        await F.setDoc(ref, { codigo, ts: Date.now() });
      } catch (e) {
        throw new Error('El enlace no es válido o ha caducado. Pide uno nuevo a tu entrenador.');
      }
    },
    async listar(col) {
      const v = await consulta(col);
      return [...v.docs.values()].map(copia);
    },
    async obtener(col, id) {
      // La ficha suele estar ya en la lista del entrenador; si no (el cliente), se escucha ese documento.
      const lista = vivos.get(uidActual() + '|col:' + col);
      if (lista?.docs.has(id)) return copia(lista.docs.get(id));
      const v = await delDoc(col, id);
      return copia(v.docs.get(id)) || null;
    },
    async guardar(col, o) {
      const datos = limpio({ ...o, entrenadorUid: o.entrenadorUid || uidActual() });
      enMemoria('col:' + col, o.id, datos);
      enMemoria(`doc:${col}/${o.id}`, o.id, datos);
      F.setDoc(F.doc(fs, col, o.id), datos).catch(e => console.error(e));
      return datos;
    },
    async borrar(col, id) {
      enMemoria('col:' + col, id, null);
      enMemoria(`doc:${col}/${id}`, id, null);
      if (col === 'clientes') {
        // Primero lo que cuelga del cliente: sin la ficha, las reglas ya no dejarían borrarlo.
        const [ss, acc] = await Promise.all([
          F.getDocs(F.collection(fs, 'clientes', id, 'sesiones')),
          F.getDocs(F.collection(fs, 'clientes', id, 'accesos')),
        ]);
        await Promise.all([...ss.docs, ...acc.docs].map(d => F.deleteDoc(d.ref)));
      }
      await F.deleteDoc(F.doc(fs, col, id));
    },
    async listarSesiones(cid) {
      const v = await deSesiones(cid);
      return [...v.docs.values()].map(copia);
    },
    // Sin await al escribir: sin cobertura, setDoc no resuelve hasta que el
    // servidor confirma, pero la escritura ya está en la caché local.
    async guardarSesion(cid, s) {
      const datos = limpio(s);
      enMemoria('ses:' + cid, s.id, datos);
      F.setDoc(F.doc(fs, 'clientes', cid, 'sesiones', s.id), datos).catch(e => console.error(e));
      return s;
    },
    async borrarSesion(cid, id) {
      enMemoria('ses:' + cid, id, null);
      F.deleteDoc(F.doc(fs, 'clientes', cid, 'sesiones', id)).catch(e => console.error(e));
    },
    async guardarAlta(cid, alta) {
      const datos = limpio(alta);
      [vivos.get(uidActual() + '|col:clientes'), vivos.get(uidActual() + `|doc:clientes/${cid}`)]
        .forEach(v => { const c = v?.docs.get(cid); if (c) c.alta = copia(datos); });
      F.updateDoc(F.doc(fs, 'clientes', cid), { alta: datos }).catch(e => console.error(e));
    },
  };
}
