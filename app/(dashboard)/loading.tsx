import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-8 w-full max-w-lg" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="gap-0 py-0">
            <CardContent className="space-y-3 px-5 py-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="gap-0 py-0 xl:col-span-2">
          <CardContent className="px-5 py-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-5 h-[220px] w-full" />
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 px-5 py-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 px-5 py-5">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
