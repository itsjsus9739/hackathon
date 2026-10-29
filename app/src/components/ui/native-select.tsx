import * as React from "react";

import { cn } from "@/lib/utils";

// Select nativo con el estilo de Input: funciona sin JavaScript (formularios GET y server actions)
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-border h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs md:text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
