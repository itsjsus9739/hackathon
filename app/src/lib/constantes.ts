// Constantes compartidas por servidor y navegador (sin dependencias de Supabase ni de Next).

export const ZONA_HORARIA = "America/Bogota";

/** Áreas del autodiagnóstico de madurez del CDE (escala 1–5). */
export const AREAS_DIAGNOSTICO = [
  { campo: "estrategia", nombre: "Gestión de Estrategia Empresarial" },
  { campo: "mercadeo_ventas", nombre: "Gestión de Mercadeo y Ventas" },
  { campo: "financiera", nombre: "Gestión Financiera" },
  { campo: "normativa_legal", nombre: "Gestión Normativa y Legal" },
  { campo: "productividad", nombre: "Productividad" },
  { campo: "transformacion_digital", nombre: "Transformación Digital" },
] as const;
