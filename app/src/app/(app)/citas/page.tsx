import { redirect } from "next/navigation";

export const metadata = { title: "Citas · CDE Conecta" };

// Citas se gestionan en el calendario de /agenda.
export default function Pagina() {
  redirect("/agenda");
}
