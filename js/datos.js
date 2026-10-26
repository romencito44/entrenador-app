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

export const estado = { modo: 'local', usuario: null, rol: null, clienteId: null };

let impl = null;

export async function iniciar() {
  const usarFirebase = !!firebaseConfig && !new URLSearchParams(location.search).has('local');
  impl = usarFirebase ? await crearFirebase() : crearLocal();
  estado.modo = usarFirebase ? 'firebase' : 'local';
  await impl.iniciar();
  const acceso = leerAcceso();
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
}

export function salirDeCliente() {
  localStorage.removeItem(SESION_CLIENTE);
  estado.rol = estado.usuario && !estado.usuario.isAnonymous ? 'entrenador' : null;
  estado.clienteId = null;
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
    async salir() { await A.signOut(auth); estado.usuario = null; },
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
      const q = F.query(F.collection(fs, col), F.where('entrenadorUid', '==', uidActual()));
      const snap = await F.getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },
    async obtener(col, id) {
      const d = await F.getDoc(F.doc(fs, col, id));
      return d.exists() ? { ...d.data(), id: d.id } : null;
    },
    async guardar(col, o) {
      const datos = limpio({ ...o, entrenadorUid: o.entrenadorUid || uidActual() });
      F.setDoc(F.doc(fs, col, o.id), datos).catch(e => console.error(e));
      return datos;
    },
    async borrar(col, id) {
      if (col === 'clientes') {
        const ss = await F.getDocs(F.collection(fs, 'clientes', id, 'sesiones'));
        await Promise.all(ss.docs.map(d => F.deleteDoc(d.ref)));
      }
      await F.deleteDoc(F.doc(fs, col, id));
    },
    async listarSesiones(cid) {
      const snap = await F.getDocs(F.collection(fs, 'clientes', cid, 'sesiones'));
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },
    // Sin await al escribir: sin cobertura, setDoc no resuelve hasta que el
    // servidor confirma, pero la escritura ya está en la caché local.
    async guardarSesion(cid, s) { F.setDoc(F.doc(fs, 'clientes', cid, 'sesiones', s.id), limpio(s)).catch(e => console.error(e)); return s; },
    async borrarSesion(cid, id) { F.deleteDoc(F.doc(fs, 'clientes', cid, 'sesiones', id)).catch(e => console.error(e)); },
    async guardarAlta(cid, alta) { F.updateDoc(F.doc(fs, 'clientes', cid), { alta: limpio(alta) }).catch(e => console.error(e)); },
  };
}
