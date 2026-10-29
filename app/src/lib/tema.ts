// Tema claro/oscuro: la elección se guarda en el navegador; sin elección se sigue el modo del sistema.
export const LLAVE_TEMA = "cde-tema";

/** Se ejecuta en <head> antes de pintar, para que la página no parpadee en blanco al cargar en modo oscuro. */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${LLAVE_TEMA}");var o=t?t==="oscuro":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",o)}catch(e){}})()`;
