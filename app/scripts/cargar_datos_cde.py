"""Limpia los CSV exportados del Cuadro de control del CDE y genera el SQL de carga.

Uso:  python3 scripts/cargar_datos_cde.py <carpeta_con_los_csv> > carga.sql

Los CSV contienen NIT y cédulas de personas reales (Ley 1581): no se versionan en el repo.
El SQL es idempotente (UUID deterministas + ON CONFLICT DO NOTHING).
"""
import collections
import csv
import json
import re
import sys
import unicodedata
import uuid
from pathlib import Path

ESPACIO = uuid.UUID("6f1c2a10-cde0-4a5b-9e00-2026102800aa")
PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
SEMESTRE = "2026-2"  # los proyectos de aula del consolidado iniciaron el 18/08/2026
SECTORES = {"Tecnologico": "Tecnológico", "Sin dato": None}
TAMANOS = {"Emprendimiento", "Micro", "Pequeña", "Mediana", "Grande"}


def calcular_dv(nit: str) -> int:
    suma = sum(int(d) * PESOS[i] for i, d in enumerate(reversed(nit)))
    r = suma % 11
    return 11 - r if r > 1 else r


def limpiar_nit(crudo: str):
    """Devuelve (nit_sin_dv, dv | None)."""
    texto = crudo.strip()
    con_guion = re.match(r"^([\d.\s]+)-\s*(\d)$", texto)
    if con_guion:
        return re.sub(r"\D", "", con_guion.group(1)), int(con_guion.group(2))
    nit = re.sub(r"\D", "", texto)
    if not nit:
        return None, None
    # DV pegado: NIT de empresa (9 dígitos, empieza por 8/9) o persona natural (cédula de 10 + DV)
    if (len(nit) == 10 and nit[0] in "89") or len(nit) == 11:
        if calcular_dv(nit[:-1]) == int(nit[-1]):
            return nit[:-1], int(nit[-1])
    return nit, None


def normalizar(t: str) -> str:
    t = unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\b(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|e\.?\s?u\.?|bic|sas)(?=\s|$)", " ", t)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", t)).strip()


def leer(ruta: Path, saltar: int = 0):
    lineas = ruta.read_text(encoding="utf-8-sig").splitlines()[saltar:]
    return list(csv.DictReader(lineas, delimiter=";"))


# tabla → [(columna, tipo)] en el orden de cada fila
COLUMNAS = {
    "sectores": [("nombre", "text")],
    "empresas": [("id", "uuid"), ("nombre", "text"), ("nit", "text"), ("nit_dv", "smallint"), ("sector", "text"),
                 ("tamano", "public.tamano_empresa"), ("descripcion", "text"), ("municipio", "text"),
                 ("departamento", "text")],
    "postulaciones": [("id", "uuid"), ("id_empresa", "uuid"), ("origen", "text"), ("origen_registro", "text"),
                      ("estado", "text"), ("nit_reportado", "text")],
    "proyectos_aula": [("id", "uuid"), ("id_empresa", "uuid"), ("nombre", "text"), ("semestre", "text"),
                       ("estado", "public.estado_proyecto"), ("estudiantes_reportados", "smallint")],
    "atenciones": [("id", "uuid"), ("id_empresa", "uuid"), ("tipo_actividad", "text"), ("semestre", "text"),
                   ("fecha", "date"), ("notas", "text")],
    "carga_docente": [("docente", "text"), ("asignatura", "text"), ("semestre", "text"), ("proyectos", "smallint"),
                      ("estudiantes", "smallint")],
    "actividades_cronograma": [("id", "uuid"), ("categoria", "text"), ("actividad", "text"), ("fecha_inicio", "date"),
                               ("fecha_fin", "date"), ("hora_inicio", "time"), ("hora_fin", "time"), ("estado", "text"),
                               ("responsable", "text"), ("detalle", "text")],
}


def insertar(tabla: str, columnas, filas) -> str:
    """Un INSERT por tabla con las filas como JSON compacto (cabe en el SQL Editor y en el MCP)."""
    datos = json.dumps(filas, ensure_ascii=False, separators=(",", ":"))
    assert "$datos$" not in datos
    nombres = ", ".join(c for c, _ in columnas)
    valores = ", ".join(f"(f->>{i})::{t}" for i, (_, t) in enumerate(columnas))
    return (f"insert into public.{tabla} ({nombres})\nselect {valores}\n"
            f"from jsonb_array_elements($datos${datos}$datos$::jsonb) f\non conflict do nothing;")


def municipio_y_departamento(texto: str):
    texto = texto.strip()
    if not texto or texto == "Sin dato":
        return None, None
    if "," in texto:
        m, d = (p.strip() for p in texto.split(",", 1))
        return m, d
    if texto.endswith(" Cesar"):
        return texto[: -len(" Cesar")], "Cesar"
    return texto, None


def principal(carpeta: Path):
    postuladas = leer(carpeta / "empresas_postuladas.csv")
    en_proyectos = leer(next(carpeta.glob("empresas_proyectos_de_aula_*.csv")), 4)
    resumen = leer(sorted(carpeta.glob("proyectos_de_aula_resumen_*.csv"))[0], 4)
    cronograma = leer(next(carpeta.glob("cronograma_cde_*.csv")))

    # 1. Empresas: una por nombre normalizado, uniendo postulaciones y proyectos de aula
    grupos = collections.defaultdict(list)
    for p in postuladas:
        grupos[normalizar(p["Empresa"])].append(p)
    proyectos_por_nombre = {normalizar(e["Empresa"]): e for e in en_proyectos}

    empresas = {}
    avisos = []
    for clave in sorted(set(grupos) | set(proyectos_por_nombre)):
        filas = grupos.get(clave, [])
        nits = collections.Counter(limpiar_nit(f["NIT"]) for f in filas if f["NIT"].strip())
        nit, dv = nits.most_common(1)[0][0] if nits else (None, None)
        if len(nits) > 1:
            avisos.append(f"{filas[0]['Empresa']}: NIT distintos {[n for n, _ in nits]} → se usa {nit}")
        proy = proyectos_por_nombre.get(clave)
        sector = tamano = descripcion = municipio = departamento = None
        if proy:
            sector = SECTORES.get(proy["Sector"], proy["Sector"])
            tamano = proy["Tamaño"] if proy["Tamaño"] in TAMANOS else None
            descripcion = proy["Qué ofrece"].strip().strip("—").strip() or None
            municipio, departamento = municipio_y_departamento(proy["De dónde es"])
        nombre = (proy["Empresa"] if proy else filas[0]["Empresa"]).strip()
        empresas[clave] = dict(
            id=uuid.uuid5(ESPACIO, "empresa:" + clave), nombre=nombre, nit=nit, nit_dv=dv, sector=sector,
            tamano=tamano, descripcion=descripcion, municipio=municipio, departamento=departamento,
        )

    filas = collections.defaultdict(list)
    sectores = sorted({e["sector"] for e in empresas.values() if e["sector"]})
    filas["sectores"] = [[s] for s in sectores]
    for e in empresas.values():
        filas["empresas"].append([str(e["id"]), e["nombre"], e["nit"], e["nit_dv"], e["sector"], e["tamano"],
                                  e["descripcion"], e["municipio"], e["departamento"]])

    # 2. Postulaciones (todas, con su NIT original)
    for p in postuladas:
        id_empresa = empresas[normalizar(p["Empresa"])]["id"]
        filas["postulaciones"].append([p["ID postulación"], str(id_empresa), p["Origen"],
                                       p["Origen de registro (CRM)"], p["Estado"], p["NIT"].strip()])

    # 3. Proyectos de aula (uno por empresa del consolidado) + atención asociada
    for e in en_proyectos:
        emp = empresas[normalizar(e["Empresa"])]
        filas["proyectos_aula"].append([str(uuid.uuid5(ESPACIO, "proyecto:" + str(emp["id"]))), str(emp["id"]),
                                        f"Proyecto de aula {SEMESTRE} · {emp['nombre']}", SEMESTRE, "En curso",
                                        int(e["Estudiantes"])])
        filas["atenciones"].append([str(uuid.uuid5(ESPACIO, "atencion-proyecto:" + str(emp["id"]))), str(emp["id"]),
                                    "Proyectos de aula", SEMESTRE, "2026-08-18", "Importado del Cuadro de control"])

    # 4. Carga docente (sin subtotales ni totales)
    for r in resumen:
        docente = (r.get("Docente") or "").strip()
        if not docente or docente.startswith(("Subtotal", "TOTAL")) or not (r.get("Nº de proyectos") or "").isdigit():
            continue
        filas["carga_docente"].append([docente, r["Asignatura"].strip(), SEMESTRE, int(r["Nº de proyectos"]),
                                       int(r["Nº de estudiantes"])])

    # 5. Cronograma
    for c in cronograma:
        clave = "cronograma:" + "|".join(c[k] for k in ("Categoría", "Actividad", "Fecha Inicio"))
        filas["actividades_cronograma"].append([
            str(uuid.uuid5(ESPACIO, clave)), c["Categoría"], c["Actividad"], c["Fecha Inicio"], c["Fecha Fin"],
            None if c["Hora Inicio"] == "Todo el día" else c["Hora Inicio"] or None, c["Hora Fin"] or None,
            c["Estado"], c["Responsable / Lugar"], c["Detalle"]])

    sql = ["-- Carga de datos reales del Cuadro de control CDE (generado por scripts/cargar_datos_cde.py)"]
    for tabla, columnas in COLUMNAS.items():
        if filas[tabla]:
            sql.append(insertar(tabla, columnas, filas[tabla]))
    print("\n\n".join(sql))
    print(f"-- empresas={len(empresas)} postulaciones={len(postuladas)} proyectos={len(en_proyectos)} "
          f"actividades={len(cronograma)}", file=sys.stderr)
    for a in avisos:
        print("-- AVISO " + a, file=sys.stderr)


if __name__ == "__main__":
    principal(Path(sys.argv[1]))
