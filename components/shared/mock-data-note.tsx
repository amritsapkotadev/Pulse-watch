import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MockDataNote({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 bg-muted text-muted-foreground", className)}
      title="Demo data only — values are illustrative, not live monitoring results."
    >
      <Info className="size-3" aria-hidden="true" />
      Mock data
    </Badge>
  );
}
