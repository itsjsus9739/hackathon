import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoFicha() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy="true" aria-label="Cargando ficha de la empresa">
      <Skeleton className="h-4 w-24" />
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full max-w-3xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-44" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-24" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-2 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
