import { QuickActionCard } from "@/components/shared/quick-action-card";
import { quickActions } from "@/lib/navigation";

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2
            id="quick-actions-heading"
            className="text-base font-semibold text-foreground"
          >
            Quick Actions
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Shortcuts to upcoming workspace features.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <QuickActionCard key={action.href} {...action} />
        ))}
      </div>
    </section>
  );
}
