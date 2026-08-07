import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase, signInLocal, signUpLocal, ADMIN_EMAIL, ADMIN_PASSWORD } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in \u00b7 KiliMarkets" },
      { name: "description", content: "Sign in to your KiliMarkets trading terminal to reach your charts and bots." },
      { property: "og:title", content: "Sign in \u00b7 KiliMarkets" },
      { property: "og:description", content: "Sign in to your KiliMarkets trading terminal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/charts", replace: true });
  }, [loading, user, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setBusy(true);
    const isLocalAdmin = email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
    let result: any;

    try {
      if (mode === "signin") {
        result = isLocalAdmin
          ? await signInLocal(email, password)
          : await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = isLocalAdmin
          ? await signUpLocal(email, password)
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/charts` },
            });
      }

      if (result?.error?.message?.includes("Failed to fetch") || result?.error?.message?.includes("Network request failed")) {
        result = mode === "signin" ? await signInLocal(email, password) : await signUpLocal(email, password);
      }
    } catch (error) {
      result = await (mode === "signin" ? signInLocal(email, password) : signUpLocal(email, password));
    }

    setBusy(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      toast.success("Account created — check your inbox to confirm your email.");
      return;
    }
    void navigate({ to: "/charts", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-2xl">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight">
          <span className="size-2.5 rounded-full bg-primary" />
          KiliMarkets
        </h1>
        <p className="mt-2 text-center text-muted-foreground">
          {mode === "signin" ? "Sign in to your account" : "Create your account"}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-xl bg-surface text-base"
          />
          <Input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-xl bg-surface text-base"
          />
          <Button type="submit" disabled={busy} className="mt-5 h-14 w-full rounded-xl text-base font-semibold">
            {busy ? "Please wait\u2026" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
