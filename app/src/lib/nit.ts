// Validación del NIT colombiano con el dígito de verificación (DV) de la DIAN.
// Pesos oficiales aplicados de derecha a izquierda sobre el NIT sin DV.
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function calcularDV(nit: string): number {
  const digitos = nit.replace(/\D/g, "");
  if (!digitos || digitos.length > PESOS.length) throw new Error(`NIT inválido: ${nit}`);
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    suma += Number(digitos[digitos.length - 1 - i]) * PESOS[i];
  }
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

export type NitParseado = { nit: string; dv: number | null; valido: boolean | null };

// Acepta "900.123.456-7", "900123456 7", "9001234567" (con DV pegado si se indica) o "900123456".
export function parsearNIT(entrada: string | null | undefined, dvPegado = false): NitParseado | null {
  if (!entrada) return null;
  const limpio = entrada.trim();
  const conGuion = limpio.match(/^([\d.\s]+)[-\s]+(\d)$/);
  let nit: string;
  let dv: number | null = null;
  if (conGuion) {
    nit = conGuion[1].replace(/\D/g, "");
    dv = Number(conGuion[2]);
  } else {
    const digitos = limpio.replace(/\D/g, "");
    if (!digitos) return null;
    if (dvPegado && digitos.length >= 2) {
      nit = digitos.slice(0, -1);
      dv = Number(digitos.slice(-1));
    } else {
      nit = digitos;
    }
  }
  if (nit.length < 6 || nit.length > 15) return { nit, dv, valido: false };
  return { nit, dv, valido: dv === null ? null : calcularDV(nit) === dv };
}

export function formatearNIT(nit: string): string {
  const n = nit.replace(/\D/g, "");
  return `${n.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${calcularDV(n)}`;
}
