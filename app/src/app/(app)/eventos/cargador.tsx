"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// FullCalendar mide la pantalla y usa la zona horaria del navegador: se monta solo en el cliente
export const CalendarioEventos = dynamic(() => import("./calendario"), {
  ssr: false,
  loading: () => <Skeleton className="h-[70vh] w-full" />,
});
