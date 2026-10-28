"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obtenerSesion } from "@/lib/sesion";
import { Constants, type TablesInsert } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";

const texto = z.string().trim().max(300).nullable();

const esquemaOperacion = z.object({
  accion: z.enum(["crear", "actualizar"]),
  idEmpresa: z.uuid().nullable(),
  filas: z.array(z.number().int()).max(50),
  nombre: z.string().trim().min(1).max(300),
  nit: z.string().regex(/^\d{6,15}$/).nullable(),
  nitDv: z.number().int().min(0).max(9).nullable(),
  representante: texto,
  correo: z.string().trim().max(254).nullable(),
  celular: z.string().regex(/^\d{7,15}$/).nullable(),
  sector: texto,
  sectorNuevo: z.boolean(),
  tamano: z.enum(Constants.public.Enums.tamano_empresa).nullable(),
  municipio: texto,
  departamento: texto,
  vinculo: z.enum(Constants.public.Enums.vinculo_unab).nullable(),
});

export type Operacion = z.infer<typeof esquemaOperacion>;

export type ResultadoImportacion =
  | {
      ok: true;
      creadas: number;
      actualizadas: number;
      contactos: number;
      sectoresNuevos: string[];
      fallidas: { filas: number[]; nombre: string; motivo: string }[];
      duplicadosEnBase: number;
    }
  | { ok: false; error: string };

export async function importarEmpresas(entrada: unknown): Promise<ResultadoImportacion> {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.estadoAcceso !== "aprobado" || !["cde", "admin_cde"].includes(sesion.rol)) {
    return { ok: false, error: "Solo el equipo del CDE puede importar empresas." };
  }
  const parseo = z.array(esquemaOperacion).min(1).max(2000).safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Los datos a importar no son válidos. Vuelve a cargar el archivo." };
  const operaciones = parseo.data;
  const supabase = await crearClienteServidor();

  // 1. Sectores nuevos al catálogo (empresas.sector referencia sectores.nombre)
  const sectoresNuevos = [...new Set(operaciones.filter((o) => o.sectorNuevo && o.sector).map((o) => o.sector!))];
  if (sectoresNuevos.length) {
    const { error } = await supabase
      .from("sectores")
      .upsert(sectoresNuevos.map((nombre) => ({ nombre })), { onConflict: "nombre", ignoreDuplicates: true });
    if (error) return { ok: false, error: `No se pudieron crear los sectores nuevos: ${error.message}` };
  }

  // 2. Las empresas a actualizar solo reciben los datos que les faltan (nunca se sobrescribe lo que hay)
  const ids = operaciones.filter((o) => o.accion === "actualizar" && o.idEmpresa).map((o) => o.idEmpresa!);
  const { data: actuales, error: errorActuales } = ids.length
    ? await supabase
        .from("empresas")
        .select("id, nit, nit_dv, sector, tamano, municipio, departamento, vinculo_unab")
        .in("id", ids)
    : { data: [], error: null };
  if (errorActuales) return { ok: false, error: `No se pudo leer la base: ${errorActuales.message}` };
  const porId = new Map((actuales ?? []).map((e) => [e.id, e]));

  let creadas = 0;
  let actualizadas = 0;
  const fallidas: { filas: number[]; nombre: string; motivo: string }[] = [];
  const contactos: TablesInsert<"contactos_empresa">[] = [];
  const tocadas: string[] = [];

  for (const op of operaciones) {
    const datos = {
      nit: op.nit,
      nit_dv: op.nit ? op.nitDv : null,
      sector: op.sector,
      tamano: op.tamano,
      municipio: op.municipio,
      departamento: op.departamento,
      vinculo_unab: op.vinculo,
    };
    let idEmpresa: string | null = null;

    if (op.accion === "actualizar" && op.idEmpresa && porId.has(op.idEmpresa)) {
      const actual = porId.get(op.idEmpresa)!;
      const faltantes = Object.fromEntries(
        Object.entries(datos).filter(([campo, valor]) => valor !== null && actual[campo as keyof typeof actual] === null),
      ) as Partial<typeof datos>;
      if (Object.keys(faltantes).length) {
        const { error } = await supabase.from("empresas").update(faltantes).eq("id", op.idEmpresa);
        if (error) {
          fallidas.push({ filas: op.filas, nombre: op.nombre, motivo: traducirError(error.message) });
          continue;
        }
      }
      idEmpresa = op.idEmpresa;
      actualizadas++;
    } else {
      const { data, error } = await supabase
        .from("empresas")
        .insert({ nombre: op.nombre, ...datos })
        .select("id")
        .single();
      if (error) {
        fallidas.push({ filas: op.filas, nombre: op.nombre, motivo: traducirError(error.message) });
        continue;
      }
      idEmpresa = data.id;
      creadas++;
    }
    tocadas.push(idEmpresa);

    if (op.representante || op.correo || op.celular) {
      contactos.push({
        id_empresa: idEmpresa,
        nombre: op.representante ?? "Contacto principal",
        cargo: "Representante",
        correo: op.correo,
        telefono: op.celular,
        es_principal: op.accion === "crear",
      });
    }
  }

  // 3. Contactos: no se repiten los que ya existen en la empresa con el mismo correo o celular
  let contactosCreados = 0;
  if (contactos.length) {
    const { data: previos } = await supabase
      .from("contactos_empresa")
      .select("id_empresa, correo, telefono")
      .in("id_empresa", [...new Set(contactos.map((c) => c.id_empresa))]);
    const nuevos = contactos.filter(
      (c) =>
        !(previos ?? []).some(
          (p) => p.id_empresa === c.id_empresa && ((c.correo && p.correo === c.correo) || (c.telefono && p.telefono === c.telefono)),
        ),
    );
    if (nuevos.length) {
      const { error, count } = await supabase.from("contactos_empresa").insert(nuevos, { count: "exact" });
      if (error) fallidas.push({ filas: [], nombre: "Contactos", motivo: traducirError(error.message) });
      else contactosCreados = count ?? nuevos.length;
    }
  }

  // 4. Comprobación final con la vista de la base: ¿quedó algún par parecido entre lo importado?
  let duplicadosEnBase = 0;
  if (tocadas.length) {
    const lista = tocadas.join(",");
    const { count } = await supabase
      .from("posibles_duplicados")
      .select("*", { count: "exact", head: true })
      .or(`id_empresa_a.in.(${lista}),id_empresa_b.in.(${lista})`);
    duplicadosEnBase = count ?? 0;
  }

  revalidatePath("/empresas");
  return { ok: true, creadas, actualizadas, contactos: contactosCreados, sectoresNuevos, fallidas, duplicadosEnBase };
}

function traducirError(mensaje: string): string {
  if (mensaje.includes("empresas_nit_key")) return "Ya existe una empresa con ese NIT";
  if (mensaje.includes("row-level security")) return "Sin permiso para escribir en la base";
  return mensaje;
}
