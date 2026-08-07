import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SYMBOLS, TIMEFRAMES, getSymbolSpec, type Timeframe } from "@/lib/market/symbols";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/charts")({
  head: () => ({
    meta: [
      { title: "Live Charts · KiliMarkets" },
      { name: "description", content: "Interactive market charts with TradingView integration." },
      { property: "og:title", content: "Live Charts · KiliMarkets" },
      { property: "og:description", content: "Interactive market charts with TradingView integration." },
    ],
  }),
  component: ChartsPage,
});

function ChartsPage() {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const spec = getSymbolSpec(symbol);

  const widgetUrl = useMemo(() => {
    const params = new URLSearchParams({
      frameElementId: `tradingview_${symbol.toLowerCase()}`,
      symbol: getTradingViewSymbol(symbol),
      interval: getTradingViewInterval(timeframe),
      theme: "dark",
      style: "1",
      locale: "en",
      timezone: "Etc/UTC",
      toolbarbg: "%23f1f3f6",
      allow_symbol_change: "false",
      save_image: "false",
      details: "1",
      calendar: "false",
      hotlist: "false",
      news: "false",
      withdateranges: "false",
    });

    return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol, timeframe]);

  return (
    <main className="flex h-[calc(100vh-5rem)] flex-col">
      <header className="flex items-center gap-2 px-3 py-3">
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-auto gap-1 border-0 bg-transparent px-0 text-xl font-bold shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem key={s.symbol} value={s.symbol}>
                {s.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
          <SelectTrigger className="h-9 w-auto rounded-lg bg-secondary text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="rounded-md bg-primary/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          TradingView
        </span>

        <div className="ml-auto text-right num">
          <div className="text-sm font-semibold text-muted-foreground">{spec.name}</div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 px-3 pb-3">
        <div className="h-full overflow-hidden rounded-xl border border-border bg-background/70">
          <iframe
            key={widgetUrl}
            src={widgetUrl}
            title={`${spec.symbol} chart`}
            className="h-full w-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    </main>
  );
}

function getTradingViewSymbol(symbol: string) {
  switch (symbol) {
    case "XAUUSD":
      return "OANDA:XAUUSD";
    case "EURUSD":
      return "OANDA:EURUSD";
    case "NAS100":
      return "NASDAQ:NDX";
    default:
      return `BINANCE:${getSymbolSpec(symbol).feedSymbol}`;
  }
}

function getTradingViewInterval(timeframe: Timeframe) {
  switch (timeframe) {
    case "1m":
      return "1";
    case "5m":
      return "5";
    case "15m":
      return "15";
    case "30m":
      return "30";
    case "1h":
      return "60";
    case "4h":
      return "240";
    case "1d":
      return "D";
    default:
      return "W";
  }
}
