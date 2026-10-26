# Entrenador · planes y progreso

PWA para entrenador y clientes: programas por mesociclos, registro de series tipo Hevy
con carga sugerida, encuesta al terminar (estilo RP) y panel con adherencia y comentarios.
Los datos van a Firebase (proyecto `entrenos-1df6e`) y quedan en caché en el móvil para
entrenar sin cobertura.

## Probar en el ordenador

```bash
node servidor.js
```

- http://localhost:4174 → con Firebase (entrar con Google).
- http://localhost:4174/?local → modo local, sin Firebase, todo en este navegador.

Tests de la lógica de progresión y del importador: `node --test tests/progresion.test.mjs`.

## Puesta en marcha de Firebase (una vez)

1. **Firestore Database** → Crear base de datos → ubicación `eur3` → modo producción.
2. **Firestore → Reglas**: pega el contenido de `firestore.rules` y pulsa Publicar.
3. **Authentication → Método de inicio de sesión**: activa **Google** y **Anónimo**.
4. **Authentication → Configuración → Dominios autorizados**: añade el dominio donde se
   publique la app (por ejemplo `romencito44.github.io`). `localhost` ya viene.

## Cómo se usa

- **Entrenador**: entra con Google. Crea clientes, asígnales una plantilla y ajústala.
  «Enlace» genera el link que se le manda al cliente por WhatsApp.
- **Cliente**: abre su enlace (entra sin cuenta), ve la sesión que le toca, apunta serie a
  serie y al terminar responde la encuesta. Lo que anota le llega al entrenador.
- **Historial antiguo**: en la ficha del cliente, «Importar JSON del plan antiguo» acepta el
  archivo que exporta el plan en HTML de Andrea. Reimportar no duplica.

## Estructura

| Archivo | Qué hace |
|---|---|
| `js/datos.js` | Capa de datos: local (localStorage) o Firestore con caché offline |
| `js/programa.js` | Mesociclos, semanas, descarga, siguiente sesión |
| `js/progresion.js` | Carga sugerida, récords, ajuste de volumen |
| `js/biblioteca.js` | Ejercicios: la clave une el historial entre bloques |
| `js/andrea.js` | Mesociclo 3 de Andrea e importador del plan antiguo |
| `js/vistas/` | Pantallas del cliente, del entrenador y el editor de programas |
| `sw.js` | Offline: archivos de la app y SDK de Firebase |
| `firestore.rules` | Quién puede leer y escribir qué |
