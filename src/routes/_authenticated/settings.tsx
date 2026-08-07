import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings \u00b7 KiliMarkets" },
      { name: "description", content: "Chart appearance, AI assistant key and MetaTrader 5 account settings." },
      { property: "og:title", content: "Settings \u00b7 KiliMarkets" },
      { property: "og:description", content: "Chart appearance, AI and MetaTrader 5 settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [grid, setGrid] = useState(true);
  const [volume, setVolume] = useState(true);
  const [crosshair, setCrosshair] = useState(true);
  const [watermark, setWatermark] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("user_settings").select("*").maybeSingle();
      if (data) {
        setGrid(data.show_grid);
        setVolume(data.show_volume);
        setCrosshair(data.show_crosshair);
        setWatermark(data.watermark_text ?? "");
        setAnthropicKey(data.anthropic_api_key ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: auth.user.id,
        show_grid: grid,
        show_volume: volume,
        show_crosshair: crosshair,
        watermark_text: watermark,
        anthropic_api_key: anthropicKey,
      },
      { onConflict: "user_id" },
    );
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  if (loading) return <main className="p-6 text-sm text-muted-foreground">Loading settings\u2026</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <Row label="Grid"><Switch checked={grid} onCheckedChange={setGrid} aria-label="Grid" /></Row>
        <Row label="Volume"><Switch checked={volume} onCheckedChange={setVolume} aria-label="Volume" /></Row>
        <Row label="Crosshair"><Switch checked={crosshair} onCheckedChange={setCrosshair} aria-label="Crosshair" /></Row>
      </section>

      <label className="mt-5 block">
        <span className="mb-1 block text-xs text-muted-foreground">Watermark</span>
        <Input value={watermark} onChange={(e) => setWatermark(e.target.value)} className="h-12 rounded-xl bg-surface" />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs text-muted-foreground">Anthropic API key</span>
        <Input
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="sk-ant-\u2026"
          className="h-12 rounded-xl bg-surface"
        />
      </label>

      <Button onClick={save} className="mt-5 h-13 w-full rounded-xl py-3.5 text-base font-semibold">
        Save settings
      </Button>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}
