import { redirect } from "next/navigation";

// Los avisos de insignias, aportes y canjes de la base enlazan a /logros
export default function Logros() {
  redirect("/formacion");
}
