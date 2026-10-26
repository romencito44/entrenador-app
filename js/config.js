/* Configuración de Firebase (proyecto entrenos-1df6e).
   Estos datos no son secretos: identifican el proyecto y van en la página.
   Lo que protege los datos son las reglas de firestore.rules.
   Con null, la app funciona en "modo local" (todo en este navegador).
   Abrir la app con ?local fuerza el modo local aunque haya configuración. */
export const firebaseConfig = {
  apiKey: 'AIzaSyAptfotTjn7QWpoQX-AEqXanXtJBTEC9K0',
  authDomain: 'entrenos-1df6e.firebaseapp.com',
  projectId: 'entrenos-1df6e',
  storageBucket: 'entrenos-1df6e.firebasestorage.app',
  messagingSenderId: '1076974693963',
  appId: '1:1076974693963:web:a7b942441040492d87a7ce',
};

/* Versión del SDK de Firebase que se carga desde el CDN de Google.
   Si la cambias, sube también CACHE en sw.js. */
export const FIREBASE_SDK = '10.12.2';
