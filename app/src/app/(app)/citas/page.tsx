import { redirect } from "next/navigation";

// Citas se reemplazó por Mis contactos (las citas se agendan en Eventos, tipo «Cita»)
export default function Pagina() {
  redirect("/contactos");
}
