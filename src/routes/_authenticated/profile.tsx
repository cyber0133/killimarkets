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
