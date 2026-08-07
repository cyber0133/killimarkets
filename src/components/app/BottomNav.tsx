import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bot, BriefcaseBusiness, History, RefreshCw, TrendingUp, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/charts", label: "Charts", icon: BarChart3 },
  { to: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { to: "/history", label: "History", icon: History },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/eabottest", label: "EABO", icon: RefreshCw },
  { to: "/simulator", label: "Terminal", icon: RefreshCw },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Wrench },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:text-foreground"
              >
                {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />}
                <Icon className={cn("size-5", active && "text-primary")} strokeWidth={active ? 2.4 : 1.8} />
                <span className="sr-only sm:not-sr-only sm:text-[11px]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
