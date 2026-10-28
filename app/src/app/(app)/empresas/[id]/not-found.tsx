import { PantallaBuho } from "@/components/buho/pantalla-buho";

export default function EmpresaNoEncontrada() {
  return (
    <PantallaBuho
      sprite="error-404"
      etiqueta="Error 404"
      titulo="Empresa no encontrada"
      descripcion={<p>No existe una empresa con ese identificador o no tienes permiso para verla.</p>}
      acciones={[{ href: "/empresas", etiqueta: "Volver al listado de empresas" }]}
    />
  );
}
