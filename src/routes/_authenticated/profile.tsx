import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile \u00b7 KiliMarkets" },
      { name: "description", content: "Manage your KiliMarkets account, broker connections and session." },
      { property: "og:title", content: "Profile \u00b7 KiliMarkets" },
      { property: "og:description", content: "Manage your account and broker connections." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const accountRows = [
    ["Account ID", user?.id ? user.id.slice(0, 12).toUpperCase() : "DEMO-100294"],
    ["Currency", "USD"],
    ["Leverage", "1:100"],
    ["Balance", "$10,000.00"],
    ["Equity", "$10,340.00"],
    ["Used margin", "$3,200.00"],
    ["Free margin", "$6,800.00"],
    ["Open positions", "3"],
  ] as const;

  const activityItems = [
    { time: "09:32:14", text: "Subscription confirmed for Pro Bot", kind: "info" },
    { time: "09:10:02", text: "Top-up request approved and credited", kind: "buy" },
    { time: "08:47:51", text: "Withdrawal request moved to pending approval", kind: "sell" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-bold">Profile</h1>

      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal information</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="num truncate text-xs">{user?.id}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demo accounting</div>
        <div className="space-y-2">
          {accountRows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between border-b border-border/70 py-2 text-sm last:border-b-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</div>
        <div className="space-y-2 text-xs">
          {activityItems.map((item) => (
            <div key={item.time} className="flex gap-2 rounded-lg border border-border/70 bg-background/40 p-2">
              <span className="shrink-0 font-mono text-muted-foreground">{item.time}</span>
              <span className={item.kind === "buy" ? "text-emerald-400" : item.kind === "sell" ? "text-rose-400" : "text-muted-foreground"}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Button
        variant="outline"
        className="mt-5 h-12 w-full rounded-xl"
        onClick={async () => {
          await supabase.auth.signOut();
          void navigate({ to: "/auth", replace: true });
        }}
      >
        Sign out
      </Button>
    </main>
  );
}
