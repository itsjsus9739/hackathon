import { redirect } from "next/navigation";

export const metadata = { title: "Eventos · CDE Conecta" };

// Eventos se gestionan en el calendario de /agenda.
export default function Pagina() {
  redirect("/agenda");
}
