import { redirect } from "next/navigation";

// El calendario (antes la app Flask de calendario-cde/) ahora vive en Eventos, sobre Supabase
export default function Pagina() {
  redirect("/eventos");
}
