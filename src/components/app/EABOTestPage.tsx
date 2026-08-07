import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  Circle,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Trash2,
  TrendingUp,
  User,
  Wrench,
  X,
} from "lucide-react";

type TabKey = "chart" | "botting" | "accounting" | "tools";
type PaymentAction = "subscribe" | "topup" | "withdraw";

type Candle = { o: number; h: number; l: number; c: number; t: number };

type IndicatorState = { ema12: number; ema26: number; rsiVal: number; er: number; atr: number };

type Signal = { action: "BUY" | "SELL" | "HOLD"; confidence: number; regime: string; emaDiffPct: number; reason: string };

type Position = { id: string; symbol: string; dir: 1 | -1; lots: number; entry: number; botId: string | null; openedAt: number };

type BotModel = {
  id: string;
  symbol: string;
  strategyId: StrategyId;
  timeframe: string;
  checkSec: number;
  elapsed: number;
  running: boolean;
  lastSignal: Signal | null;
  confHistory: Array<{ v: number }>;
  decisions: Array<{ t: number; action: string; reason: string; confidence: number; q?: string }>;
};

type ActivityItem = { t: number; text: string; kind: "info" | "buy" | "sell" };

type PendingRequest = { id: number; title: string; amount?: number; status: string };

type SymbolDef = { id: string; name: string; basePrice: number; vol: number; decimals: number; multiplier: number; defaultLots: number };

type MarketState = Record<string, { price: number; drift: number; ticks: number[]; candles: Candle[]; tickInCandle: number; indicators: IndicatorState }>;

type StrategyConfig = { label: string; regime: "trending" | "range" | null; mode: "trend" | "reversion"; minEmaDiff?: number; rsiGate?: number; rsiHigh?: number; rsiLow?: number };

const T = {
  bg: "#0A0E14",
  card: "#0e0e0f",
  cardAlt: "#161D2C",
  border: "#232B3B",
  borderSoft: "#1A2130",
  teal: "#2DD4BF",
  tealSoft: "rgba(45,212,191,0.12)",
  red: "#F87171",
  redSoft: "rgba(248,113,113,0.12)",
  amber: "#FBBF24",
  amberSoft: "rgba(251,191,36,0.12)",
  blue: "#60A5FA",
  text: "#E7EBF3",
  textDim: "#8993A6",
  textFaint: "#4E5768",
};

const SYMBOL_DEFS: SymbolDef[] = [
  { id: "XAUUSD", name: "Gold", basePrice: 4031.6, vol: 0.55, decimals: 2, multiplier: 100, defaultLots: 0.1 },
  { id: "BTCUSD", name: "Bitcoin", basePrice: 64680, vol: 55, decimals: 2, multiplier: 1, defaultLots: 0.05 },
  { id: "ETHUSD", name: "Ethereum", basePrice: 1881.1, vol: 3.4, decimals: 2, multiplier: 1, defaultLots: 0.5 },
  { id: "EURUSD", name: "Euro / USD", basePrice: 1.0855, vol: 0.00075, decimals: 5, multiplier: 1000, defaultLots: 0.2 },
  { id: "NAS100", name: "Nasdaq 100", basePrice: 19540, vol: 9.5, decimals: 1, multiplier: 1, defaultLots: 0.02 },
];

const STRATEGIES = {
  trend: { label: "Trend Following", regime: "trending", mode: "trend", minEmaDiff: 0.02, rsiGate: 50 },
  reversal: { label: "Smart Reversal", regime: "range", mode: "reversion", rsiHigh: 70, rsiLow: 30 },
  meanrev: { label: "Mean Reversion", regime: "range", mode: "reversion", rsiHigh: 65, rsiLow: 35 },
  breakout: { label: "Breakout", regime: "trending", mode: "trend", minEmaDiff: 0.05, rsiGate: 55 },
  momentum: { label: "Momentum", regime: null, mode: "trend", minEmaDiff: 0.01, rsiGate: 50 },
  scalping: { label: "Scalping", regime: null, mode: "trend", minEmaDiff: 0.006, rsiGate: 50 },
} as const;

type StrategyId = keyof typeof STRATEGIES;

const TICKS_PER_CANDLE = 4;
const MAX_TICKS = 260;
const MAX_CANDLES = 60;
const LEVERAGE = 100;
const TICK_MS = 1500;
const START_BALANCE = 10000;
const EABO_STORAGE_KEY = "eabo-sim-state-v1";

type PersistedEaboState = {
  tab: TabKey;
  market: MarketState;
  balance: number;
  positions: Position[];
  activity: ActivityItem[];
  bots: BotModel[];
  selectedSymbol: string;
  botForm: { symbol: string; strategyId: StrategyId; timeframe: string; checkSec: number };
  tradeForm: { symbol: string; dir: 1 | -1; lots: number };
  askText: string;
  subscription: { active: boolean; plan: string; amount: number };
};

type PaymentModalState = {
  open: boolean;
  type: PaymentAction | null;
  selectedNetwork: string;
  amount: string;
  address: string;
  countdown: number;
  step: "details" | "payment" | "pending";
};

function getPersistedEaboState(): PersistedEaboState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(EABO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedEaboState;
  } catch {
    return null;
  }
}

function persistEaboState(state: PersistedEaboState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EABO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures in private browsing or restricted environments
  }
}

function fmt(value: number, decimals = 2) {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${fmt(Math.abs(value), 2)}`;
}

function formatCountdown(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getPaymentAddress(network: string) {
  switch (network) {
    case "ETH":
      return "0x8A4dB4f0D1c9E7aF4A7d3b2C4d8F0dEcB21A8A2B";
    case "USDT TRC20":
      return "TQf4Gq4PqYxE5Z3aQ2H8v4VmB9CxL1mJEr";
    case "USDC":
      return "0xC4e3d2f9B8dE1a8f9C2f3F2E5dA4A8A4c2F1F2A0";
    case "SOL":
      return "7Y2X9pTbf8L3Aq9mCkzP81vQrA6L7yK4sD3wX5nQh6M";
    default:
      return "bc1q9x4h7u2k9p3s5r7y8w0p2x4q6n8j0m2l3k5t7v";
  }
}

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

function ema(values: number[], period: number) {
  if (values.length === 0) return 0;
  if (values.length < period) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

function rsi(values: number[], period = 14) {
  if (values.length < period + 1) return 50;
  const slice = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function efficiencyRatio(values: number[], period = 10) {
  if (values.length < period + 1) return 0;
  const slice = values.slice(-(period + 1));
  const change = Math.abs(slice[slice.length - 1] - slice[0]);
  let vol = 0;
  for (let i = 1; i < slice.length; i++) vol += Math.abs(slice[i] - slice[i - 1]);
  return vol === 0 ? 0 : change / vol;
}

function atrFromCandles(candles: Candle[], period = 14) {
  if (candles.length < 2) return 0;
  const slice = candles.slice(-period - 1);
  const trs: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const p = slice[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function classifyRegime(er: number) {
  if (er >= 0.3) return "trending";
  if (er < 0.15) return "choppy";
  return "range";
}

function evaluateStrategy(stratId: StrategyId, ind: IndicatorState): Signal {
  const cfg = STRATEGIES[stratId];
  const { ema12, ema26, rsiVal, er } = ind;
  const emaDiffPct = ema26 !== 0 ? ((ema12 - ema26) / ema26) * 100 : 0;
  const regime = classifyRegime(er);
  const confidence = clamp(Math.round(50 + emaDiffPct * 8 + (rsiVal - 50) * 0.6 + (er * 100 - 25) * 0.4), 5, 97);

  if (cfg.regime && regime !== cfg.regime) {
    return {
      action: "HOLD",
      confidence,
      regime,
      emaDiffPct,
      reason: cfg.regime === "trending"
        ? `${regime === "choppy" ? "Choppy" : "Range-bound"} market (ER=${er.toFixed(2)} < 0.30) — ${cfg.label} stands aside until a trend forms.`
        : `Market is trending (ER=${er.toFixed(2)} ≥ 0.30) — ${cfg.label} waits for a range to form before fading extremes.`,
    };
  }

  if (cfg.mode === "trend") {
    if (emaDiffPct >= (cfg.minEmaDiff ?? 0) && rsiVal > (cfg.rsiGate ?? 50)) {
      return { action: "BUY", confidence, regime, emaDiffPct, reason: `EMA12 is ${emaDiffPct.toFixed(2)}% above EMA26 and RSI=${rsiVal.toFixed(1)} confirms upside momentum (ER=${er.toFixed(2)}).` };
    }
    if (emaDiffPct <= -(cfg.minEmaDiff ?? 0) && rsiVal < 100 - (cfg.rsiGate ?? 50)) {
      return { action: "SELL", confidence, regime, emaDiffPct, reason: `EMA12 is ${Math.abs(emaDiffPct).toFixed(2)}% below EMA26 and RSI=${rsiVal.toFixed(1)} confirms downside momentum (ER=${er.toFixed(2)}).` };
    }
    return { action: "HOLD", confidence, regime, emaDiffPct, reason: `EMA/RSI not yet aligned (EMA Δ ${emaDiffPct.toFixed(2)}%, RSI ${rsiVal.toFixed(1)}) — waiting for stronger trend confirmation.` };
  }

  if (rsiVal >= (cfg.rsiHigh ?? 70)) {
    return { action: "SELL", confidence, regime, emaDiffPct, reason: `Overbought — RSI=${rsiVal.toFixed(1)} in a ${regime} market (ER=${er.toFixed(2)}). Fading back toward the mean.` };
  }
  if (rsiVal <= (cfg.rsiLow ?? 30)) {
    return { action: "BUY", confidence, regime, emaDiffPct, reason: `Oversold — RSI=${rsiVal.toFixed(1)} in a ${regime} market (ER=${er.toFixed(2)}). Fading back toward the mean.` };
  }

  return { action: "HOLD", confidence, regime, emaDiffPct, reason: `Price is inside the range (RSI=${rsiVal.toFixed(1)}) — waiting for an extreme to fade.` };
}

function seedMarket(): MarketState {
  const next: MarketState = {};
  SYMBOL_DEFS.forEach((symbol) => {
    next[symbol.id] = {
      price: symbol.basePrice,
      drift: (Math.random() - 0.5) * 0.4,
      ticks: [symbol.basePrice],
      candles: [{ o: symbol.basePrice, h: symbol.basePrice, l: symbol.basePrice, c: symbol.basePrice, t: 0 }],
      tickInCandle: 0,
      indicators: { ema12: symbol.basePrice, ema26: symbol.basePrice, rsiVal: 50, er: 0, atr: 0 },
    };
  });
  return next;
}

function stepSymbol(def: SymbolDef, state: MarketState[string], tickCount: number) {
  let drift = state.drift + (Math.random() - 0.5) * 0.05;
  drift = clamp(drift, -1, 1);
  const noise = (Math.random() - 0.5) * 2;
  const change = (drift * 0.6 + noise * 0.4) * def.vol * 0.18;
  const price = Math.max(def.vol, state.price + change);
  const ticks = [...state.ticks, price].slice(-MAX_TICKS);
  let candles = state.candles;
  let tickInCandle = state.tickInCandle + 1;
  const last = candles[candles.length - 1];
  const updatedLast = { ...last, h: Math.max(last.h, price), l: Math.min(last.l, price), c: price };
  if (tickInCandle >= TICKS_PER_CANDLE) {
    candles = [...candles.slice(0, -1), updatedLast, { o: price, h: price, l: price, c: price, t: tickCount }].slice(-MAX_CANDLES);
    tickInCandle = 0;
  } else {
    candles = [...candles.slice(0, -1), updatedLast];
  }
  const ema12 = ema(ticks, 12);
  const ema26 = ema(ticks, 26);
  const rsiVal = rsi(ticks, 14);
  const er = efficiencyRatio(ticks, 10);
  const atr = atrFromCandles(candles, 14);
  return { price, drift, ticks, candles, tickInCandle, indicators: { ema12, ema26, rsiVal, er, atr } };
}

function useTweenedNumber(target: number, duration = 350) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = display;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = clamp((ts - startRef.current) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      }
    };
    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return display;
}

function Badge({ children, tone = "teal" }: { children: string; tone?: "teal" | "red" | "amber" | "gray" }) {
  const map = {
    teal: { bg: T.tealSoft, fg: T.teal },
    red: { bg: T.redSoft, fg: T.red },
    amber: { bg: T.amberSoft, fg: T.amber },
    gray: { bg: "rgba(255,255,255,0.06)", fg: T.textDim },
  } as const;
  const c = map[tone];
  return <span className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ background: c.bg, color: c.fg }}>{children}</span>;
}

function ActionBadge({ action }: { action: string }) {
  if (action === "BUY") return <Badge tone="teal">Buy</Badge>;
  if (action === "SELL") return <Badge tone="red">Sell</Badge>;
  return <Badge tone="gray">Hold</Badge>;
}

function RegimeBadge({ regime }: { regime: string }) {
  if (regime === "trending") return <span className="flex items-center gap-1 text-xs" style={{ color: T.teal }}><TrendingUp size={12} /> trending</span>;
  if (regime === "choppy") return <span className="flex items-center gap-1 text-xs" style={{ color: T.red }}>⌁ choppy</span>;
  return <span className="flex items-center gap-1 text-xs" style={{ color: T.amber }}>↔ range</span>;
}

function IndicatorBar({ label, value, unit = "", range = 10 }: { label: string; value: number; unit?: string; range?: number }) {
  const pct = clamp(((value + range) / (range * 2)) * 100, 0, 100);
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0" style={{ color: T.textDim }}>{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: T.borderSoft }}>
        <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: T.textFaint }} />
        <div className="absolute inset-y-0 rounded-full transition-all duration-500" style={{ background: positive ? T.teal : T.red, left: positive ? "50%" : `${pct}%`, width: `${Math.abs(pct - 50)}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right font-mono" style={{ color: positive ? T.teal : T.red }}>{value >= 0 ? "+" : ""}{value.toFixed(1)}{unit}</span>
    </div>
  );
}

function CandleShape(props: { x: number; y: number; width: number; height: number; payload?: Candle }) {
  const { x, y, width, height, payload } = props;
  if (!payload || payload.h === payload.l) return null;
  const { o, h, l, c } = payload;
  const ratio = height / (h - l || 1);
  const isUp = c >= o;
  const color = isUp ? T.teal : T.red;
  const bodyTop = y + (h - Math.max(o, c)) * ratio;
  const bodyHeight = Math.max(1.5, Math.abs(o - c) * ratio);
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x + width * 0.22} y={bodyTop} width={width * 0.56} height={bodyHeight} fill={color} rx={0.5} />
    </g>
  );
}

function CandleChart({ candles, decimals }: { candles: Candle[]; decimals: number }) {
  const data = candles.map((c, index) => ({ ...c, idx: index, range: [c.l, c.h] }));
  const lo = Math.min(...candles.map((c) => c.l));
  const hi = Math.max(...candles.map((c) => c.h));
  const pad = (hi - lo) * 0.08 || 1;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="idx" hide />
        <YAxis domain={[lo - pad, hi + pad]} orientation="right" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={62} tickFormatter={(value) => fmt(value as number, decimals)} />
        <ReferenceLine y={candles[candles.length - 1]?.c} stroke={T.teal} strokeDasharray="3 3" strokeOpacity={0.5} />
        <Bar dataKey="range" shape={CandleShape as never} isAnimationActive={false} />
        <Tooltip contentStyle={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelFormatter={() => ""} formatter={(value, _name, payload) => [`O ${fmt((payload as { payload: Candle }).payload.o, decimals)} H ${fmt((payload as { payload: Candle }).payload.h, decimals)} L ${fmt((payload as { payload: Candle }).payload.l, decimals)} C ${fmt((payload as { payload: Candle }).payload.c, decimals)}`, ""]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Sparkline({ data, color }: { data: Array<{ v: number }>; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${color})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border p-4 ${className}`} style={{ background: T.card, borderColor: T.border }}>{children}</div>;
}

function getSymbolDef(symbol: string) {
  return SYMBOL_DEFS.find((item) => item.id === symbol) ?? SYMBOL_DEFS[0];
}

function getPositionPnl(position: Position, market: MarketState) {
  const current = market[position.symbol];
  const def = getSymbolDef(position.symbol);
  if (!current) return 0;
  return (current.price - position.entry) * position.dir * position.lots * def.multiplier;
}

export function EABOTestPage() {
  const persistedState = getPersistedEaboState();
  const [tab, setTab] = useState<TabKey>(persistedState?.tab ?? "chart");
  const tickCountRef = useRef(0);
  const [market, setMarket] = useState<MarketState>(persistedState?.market ?? seedMarket());
  const [balance, setBalance] = useState(persistedState?.balance ?? START_BALANCE);
  const [positions, setPositions] = useState<Position[]>(persistedState?.positions ?? []);
  const [activity, setActivity] = useState<ActivityItem[]>(persistedState?.activity ?? [{ t: Date.now(), text: "Simulation started — demo account funded with $10,000.00.", kind: "info" }]);
  const [bots, setBots] = useState<BotModel[]>(persistedState?.bots ?? []);
  const [selectedSymbol, setSelectedSymbol] = useState(persistedState?.selectedSymbol ?? "XAUUSD");
  const [botForm, setBotForm] = useState(persistedState?.botForm ?? { symbol: "XAUUSD", strategyId: "momentum" as StrategyId, timeframe: "1h", checkSec: 60 });
  const [tradeForm, setTradeForm] = useState(persistedState?.tradeForm ?? { symbol: "XAUUSD", dir: 1 as 1 | -1, lots: 0.1 });
  const [manualOrderCollapsed, setManualOrderCollapsed] = useState(true);
  const [askText, setAskText] = useState(persistedState?.askText ?? "");
  const [subscription, setSubscription] = useState(persistedState?.subscription ?? { active: false, plan: "Basic", amount: 0 });
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([
    { id: 1, title: "Subscription", amount: 99, status: "Pending" },
    { id: 2, title: "Top-up", amount: 500, status: "Pending approval" },
    { id: 3, title: "Withdrawal request", amount: 250, status: "Pending approval" },
  ]);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({ open: false, type: null, selectedNetwork: "BTC", amount: "", address: "", countdown: 20 * 60, step: "details" });

  const logActivity = (text: string, kind: ActivityItem["kind"] = "info") => {
    setActivity((prev) => [{ t: Date.now(), text, kind }, ...prev].slice(0, 60));
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      tickCountRef.current += 1;
      const tickCount = tickCountRef.current;
      setMarket((prev) => {
        const next: MarketState = {};
        SYMBOL_DEFS.forEach((def) => {
          next[def.id] = stepSymbol(def, prev[def.id], tickCount);
        });
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    persistEaboState({
      tab,
      market,
      balance,
      positions,
      activity,
      bots,
      selectedSymbol,
      botForm,
      tradeForm,
      askText,
      subscription,
    });
  }, [tab, market, balance, positions, activity, bots, selectedSymbol, botForm, tradeForm, askText, subscription]);

  useEffect(() => {
    if (!paymentModal.open) return;

    const timer = window.setInterval(() => {
      setPaymentModal((prev) => (prev.open ? { ...prev, countdown: Math.max(0, prev.countdown - 1) } : prev));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [paymentModal.open]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBots((prevBots) => {
        if (prevBots.length === 0) return prevBots;
        return prevBots.map((bot) => {
          if (!bot.running) return bot;

          const current = market[bot.symbol];
          if (!current) return bot;

          const elapsed = bot.elapsed + 1000;
          if (elapsed < bot.checkSec * 1000) {
            return { ...bot, elapsed };
          }

          const signal = evaluateStrategy(bot.strategyId, current.indicators);
          const confHistory = [...bot.confHistory, { v: signal.confidence }].slice(-30);
          const decisions = [{ t: Date.now(), action: signal.action, reason: signal.reason, confidence: signal.confidence }, ...bot.decisions].slice(0, 12);
          const shouldAct = signal.action !== "HOLD" && signal.confidence >= 60;
          const shouldOpen = shouldAct && (!bot.lastSignal || bot.lastSignal.action !== signal.action || bot.lastSignal.confidence < 60);
          const shouldFlip = shouldAct && bot.lastSignal && bot.lastSignal.action !== signal.action && bot.lastSignal.confidence >= 60;

          if (shouldOpen || shouldFlip) {
            setPositions((positionsState) => {
              const existing = positionsState.find((pos) => pos.botId === bot.id);
              const def = getSymbolDef(bot.symbol);
              if (!existing && shouldOpen) {
                const newPos: Position = { id: `${bot.id}-${Date.now()}`, symbol: bot.symbol, dir: signal.action === "BUY" ? 1 : -1, lots: def.defaultLots, entry: current.price, botId: bot.id, openedAt: Date.now() };
                logActivity(`${bot.symbol} · ${STRATEGIES[bot.strategyId].label} — opened ${signal.action} ${def.defaultLots} lots @ ${fmt(current.price, def.decimals)}.`, signal.action === "BUY" ? "buy" : "sell");
                return [newPos, ...positionsState];
              }
              if (existing && shouldFlip) {
                const pnl = (current.price - existing.entry) * existing.dir * existing.lots * def.multiplier;
                setBalance((value) => value + pnl);
                logActivity(`${bot.symbol} · ${STRATEGIES[bot.strategyId].label} — closed on signal flip, realized ${fmtMoney(pnl)}.`, pnl >= 0 ? "buy" : "sell");
                return positionsState.filter((pos) => pos.id !== existing.id);
              }
              return positionsState;
            });
          }

          return {
            ...bot,
            elapsed: 0,
            lastSignal: signal,
            confHistory,
            decisions,
          };
        });
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [market]);

  const unrealizedTotal = positions.reduce((sum, position) => sum + getPositionPnl(position, market), 0);

  const equity = balance + unrealizedTotal;
  const usedMargin = positions.reduce((sum, position) => {
    const current = market[position.symbol];
    const def = getSymbolDef(position.symbol);
    if (!current) return sum;
    return sum + (current.price * position.lots * def.multiplier) / LEVERAGE;
  }, 0);
  const freeMargin = equity - usedMargin;

  const animBalance = useTweenedNumber(balance);
  const animEquity = useTweenedNumber(equity);
  const animProfit = useTweenedNumber(unrealizedTotal);

  const closePosition = (id: string) => {
    const position = positions.find((item) => item.id === id);
    if (!position) return;
    const pnl = getPositionPnl(position, market);
    setBalance((value) => value + pnl);
    setPositions((prev) => prev.filter((item) => item.id !== id));
    logActivity(`Closed ${position.symbol} ${position.dir === 1 ? "BUY" : "SELL"} ${position.lots} lots manually — realized ${fmtMoney(pnl)}.`, pnl >= 0 ? "buy" : "sell");
  };

  const openManualPosition = () => {
    const def = getSymbolDef(tradeForm.symbol);
    const current = market[tradeForm.symbol];
    const newPos: Position = { id: `manual-${Date.now()}`, symbol: tradeForm.symbol, dir: tradeForm.dir, lots: tradeForm.lots, entry: current.price, botId: null, openedAt: Date.now() };
    setPositions((prev) => [newPos, ...prev]);
    logActivity(`Manually opened ${tradeForm.symbol} ${tradeForm.dir === 1 ? "BUY" : "SELL"} ${tradeForm.lots} lots @ ${fmt(current.price, def.decimals)}.`, tradeForm.dir === 1 ? "buy" : "sell");
  };

  const startBot = () => {
    const id = `bot-${Date.now()}`;
    setBots((prev) => [...prev, { id, symbol: botForm.symbol, strategyId: botForm.strategyId, timeframe: botForm.timeframe, checkSec: Number(botForm.checkSec), elapsed: 0, running: true, lastSignal: null, confHistory: [], decisions: [] }]);
    logActivity(`Started ${STRATEGIES[botForm.strategyId].label} bot on ${botForm.symbol} (${botForm.timeframe}, checks every ${botForm.checkSec}s).`, "info");
  };

  const stopBot = (id: string) => {
    setBots((prev) => prev.map((bot) => (bot.id === id ? { ...bot, running: false } : bot)));
    logActivity(`Stopped bot on ${bots.find((bot) => bot.id === id)?.symbol}.`, "info");
  };

  const removeBot = (id: string) => setBots((prev) => prev.filter((bot) => bot.id !== id));

  const resetSimulation = () => {
    setMarket(seedMarket());
    setBalance(START_BALANCE);
    setPositions([]);
    setBots([]);
    setSubscription({ active: false, plan: "Basic", amount: 0 });
    setActivity([{ t: Date.now(), text: "Simulation reset — demo account funded with $10,000.00.", kind: "info" }]);
    tickCountRef.current = 0;
  };

  const openPaymentModal = (type: PaymentAction) => {
    const defaultAmount = type === "subscribe" ? "99" : type === "topup" ? "500" : "250";
    const defaultNetwork = type === "withdraw" ? "USDT TRC20" : "BTC";
    const networkAddress = getPaymentAddress(defaultNetwork);

    setPaymentModal({
      open: true,
      type,
      selectedNetwork: defaultNetwork,
      amount: defaultAmount,
      address: networkAddress,
      countdown: 20 * 60,
      step: "details",
    });
  };

  const closePaymentModal = () => {
    setPaymentModal({ open: false, type: null, selectedNetwork: "BTC", amount: "", address: "", countdown: 20 * 60, step: "details" });
  };

  const showPaymentDetails = () => {
    const parsed = Number(paymentModal.amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      logActivity("Enter a valid amount before proceeding.", "info");
      return;
    }

    setPaymentModal((prev) => ({ ...prev, step: "payment", address: getPaymentAddress(prev.selectedNetwork), countdown: 20 * 60 }));
  };

  const confirmPayment = () => {
    if (!paymentModal.type) return;

    const parsed = Number(paymentModal.amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      logActivity("Enter a valid amount before confirming.", "info");
      return;
    }

    if (paymentModal.countdown <= 0) {
      logActivity("This payment window has expired. Please open it again.", "info");
      return;
    }

    if (paymentModal.type === "subscribe") {
      if (balance < parsed) {
        logActivity("Subscription failed — insufficient balance.", "info");
        return;
      }
    } else if (paymentModal.type === "withdraw" && parsed > balance) {
      logActivity("Withdrawal failed — insufficient balance.", "info");
      return;
    }

    const actionLabel = paymentModal.type === "subscribe" ? "subscription" : paymentModal.type === "topup" ? "top-up" : "withdrawal";
    logActivity(`Your ${actionLabel} request is now pending confirmation.`, "info");
    setPendingRequests((prev) => [
      {
        id: Date.now(),
        title: paymentModal.type === "subscribe" ? "Subscription" : paymentModal.type === "topup" ? "Top-up" : "Withdrawal request",
        amount: parsed,
        status: paymentModal.type === "subscribe" ? "Pending" : "Pending approval",
      },
      ...prev,
    ].slice(0, 6));
    setPaymentModal((prev) => ({ ...prev, step: "pending" }));

    window.setTimeout(() => {
      if (paymentModal.type === "subscribe") {
        setBalance((value) => value - parsed);
        setSubscription({ active: true, plan: "Pro Bot", amount: parsed });
        logActivity(`Subscribed to Pro Bot with ${fmtMoney(parsed)} via ${paymentModal.selectedNetwork}.`, "info");
      } else if (paymentModal.type === "topup") {
        setBalance((value) => value + parsed);
        logActivity(`Added ${fmtMoney(parsed)} to your trading account via ${paymentModal.selectedNetwork}.`, "buy");
      } else {
        setBalance((value) => value - parsed);
        logActivity(`Requested withdrawal of ${fmtMoney(parsed)} to ${paymentModal.address}.`, "sell");
      }

      closePaymentModal();
    }, 1400);
  };

  const askModel = (bot: BotModel) => {
    if (!askText.trim() || !bot.lastSignal) return;
    const q = askText.toLowerCase();
    let answer = bot.lastSignal.reason;
    if (q.includes("why") && q.includes("hold")) answer = `Currently holding: ${bot.lastSignal.reason}`;
    else if (q.includes("buy")) answer = bot.lastSignal.action === "BUY" ? bot.lastSignal.reason : `Not buying right now — ${bot.lastSignal.reason}`;
    else if (q.includes("sell")) answer = bot.lastSignal.action === "SELL" ? bot.lastSignal.reason : `Not selling right now — ${bot.lastSignal.reason}`;
    else if (q.includes("confidence")) answer = `Current confidence is ${bot.lastSignal.confidence}%, derived from EMA separation, RSI, and the efficiency ratio — not a fixed or fabricated score.`;
    setBots((prev) => prev.map((item) => (item.id === bot.id ? { ...item, decisions: [{ t: Date.now(), action: "ASK", reason: answer, confidence: bot.lastSignal!.confidence, q: askText }, ...item.decisions].slice(0, 12) } : item)));
    setAskText("");
  };

  const currentSymbol = selectedSymbol;
  const currentDef = getSymbolDef(currentSymbol);
  const current = market[currentSymbol];
  const last = current?.candles[current.candles.length - 1];
  const prevClose = current?.candles.length && current.candles.length > 1 ? current.candles[current.candles.length - 2].c : last?.o ?? current.price;
  const change = last ? last.c - prevClose : 0;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const up = change >= 0;

  return (
    <main className="portfolio-shell min-h-screen w-full bg-background text-foreground" style={{ background: T.bg, color: T.text }}>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-3 pb-24 pt-3 sm:px-4">
        {paymentModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3 py-6">
            <div className="w-full max-w-md rounded-3xl border p-4 shadow-2xl" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="section-kicker">{paymentModal.type === "subscribe" ? "Bot subscription" : paymentModal.type === "topup" ? "Top-up request" : "Withdrawal request"}</div>
                  <div className="mt-1 text-xl font-semibold">{paymentModal.type === "subscribe" ? "Secure crypto payment" : paymentModal.type === "topup" ? "Add funds safely" : "Withdraw to a wallet"}</div>
                </div>
                <button onClick={closePaymentModal} className="rounded-full border p-2" style={{ background: T.cardAlt, borderColor: T.border, color: T.textDim }}>
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 rounded-2xl border p-3" style={{ background: T.cardAlt, borderColor: T.border }}>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>
                  <span className={paymentModal.step === "details" ? "text-teal-400" : "text-muted-foreground"}>1. Details</span>
                  <span style={{ color: T.textFaint }}>•</span>
                  <span className={paymentModal.step === "payment" || paymentModal.step === "pending" ? "text-teal-400" : "text-muted-foreground"}>2. Payment</span>
                </div>

                {paymentModal.step === "pending" ? (
                  <div className="rounded-2xl border p-4 text-center" style={{ background: T.card, borderColor: T.border }}>
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border" style={{ background: T.tealSoft, borderColor: `${T.teal}33`, color: T.teal }}>
                      <RefreshCw size={20} className="animate-spin" />
                    </div>
                    <div className="text-sm font-semibold">Pending confirmation</div>
                    <div className="mt-2 text-xs leading-relaxed" style={{ color: T.textDim }}>
                      Your request is being processed and will be finalized shortly.
                    </div>
                  </div>
                ) : paymentModal.step === "details" ? (
                  <>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Network</label>
                    <select
                      value={paymentModal.selectedNetwork}
                      onChange={(event) => {
                        const network = event.target.value;
                        setPaymentModal((prev) => ({ ...prev, selectedNetwork: network, address: getPaymentAddress(network) }));
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.card, borderColor: T.border, color: T.text }}
                    >
                      <option value="BTC">Bitcoin</option>
                      <option value="ETH">Ethereum</option>
                      <option value="USDT TRC20">USDT TRC20</option>
                      <option value="USDC">USDC</option>
                      <option value="SOL">Solana</option>
                    </select>

                    <label className="mt-3 mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Amount</label>
                    <input
                      type="number"
                      min="1"
                      value={paymentModal.amount}
                      onChange={(event) => setPaymentModal((prev) => ({ ...prev, amount: event.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.card, borderColor: T.border, color: T.text }}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-2xl border p-3" style={{ background: T.card, borderColor: T.border }}>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Network</div>
                        <div className="mt-1 text-sm font-semibold">{paymentModal.selectedNetwork}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Amount</div>
                        <div className="mt-1 text-sm font-semibold">{fmtMoney(Number(paymentModal.amount || 0))}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-2xl border p-3" style={{ background: T.card, borderColor: T.border }}>
                      <div className="pr-3">
                        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>{paymentModal.type === "withdraw" ? "Destination wallet" : "Deposit address"}</div>
                        <div className="mt-1 break-all font-mono text-xs" style={{ color: T.text }}>{paymentModal.address}</div>
                      </div>
                      <div className="rounded-xl border p-2" style={{ background: T.cardAlt, borderColor: T.border }}>
                        <div className="grid grid-cols-4 gap-1">
                          {Array.from({ length: 24 }).map((_, index) => (
                            <div key={index} className="h-2.5 w-2.5 rounded-sm" style={{ background: index % 2 === 0 ? T.teal : T.textFaint }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {paymentModal.step === "payment" && (
                <>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border px-3 py-2" style={{ background: T.cardAlt, borderColor: T.border }}>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Expiry</div>
                      <div className="text-sm font-semibold" style={{ color: paymentModal.countdown > 0 ? T.teal : T.red }}>{formatCountdown(paymentModal.countdown)}</div>
                    </div>
                    <div className="text-right text-xs" style={{ color: T.textDim }}>
                      <div>Secure wallet transfer</div>
                      <div>20 minute window</div>
                    </div>
                  </div>

                  {paymentModal.type === "withdraw" && (
                    <div className="mt-4 rounded-2xl border p-3" style={{ background: T.cardAlt, borderColor: T.border }}>
                      <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Destination wallet</label>
                      <input
                        value={paymentModal.address}
                        onChange={(event) => setPaymentModal((prev) => ({ ...prev, address: event.target.value }))}
                        placeholder="Enter wallet address"
                        className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.card, borderColor: T.border, color: T.text }}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={closePaymentModal} className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                  Cancel
                </button>
                {paymentModal.step === "details" ? (
                  <button onClick={showPaymentDetails} className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.teal, color: "#04231F" }}>
                    Continue
                  </button>
                ) : paymentModal.step === "pending" ? (
                  <button className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.border, color: T.textDim }} disabled>
                    Pending confirmation
                  </button>
                ) : (
                  <button onClick={confirmPayment} disabled={paymentModal.countdown <= 0} className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: paymentModal.countdown > 0 ? T.teal : T.border, color: paymentModal.countdown > 0 ? "#04231F" : T.textDim }}>
                    {paymentModal.type === "subscribe" ? "Confirm subscription" : paymentModal.type === "topup" ? "Confirm top-up" : "Confirm withdrawal"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <header className="mb-3 flex items-center justify-between rounded-2xl border px-4 py-3" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <RefreshCw size={18} className="text-primary" />
            </div>
            <div>
              <p className="section-kicker">Paper trading</p>
              <h1 className="section-title">EABO Test</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary" style={{ borderColor: T.border }}>
            <span className="inline-block h-2 w-2 rounded-full bg-primary" /> LIVE
          </div>
        </header>

        <section className="mb-3 rounded-2xl border p-4" style={{ background: T.card, borderColor: T.border }}>
          <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>
            Floating P/L
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums" style={{ color: unrealizedTotal >= 0 ? T.teal : T.red }}>
            {unrealizedTotal >= 0 ? "+" : ""}
            {fmtMoney(animProfit)}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Balance
              </div>
              <div className="text-lg font-semibold font-mono" style={{ color: T.text }}>
                {fmtMoney(animBalance)}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Equity
              </div>
              <div className="text-sm font-semibold font-mono" style={{ color: T.text }}>
                {fmtMoney(animEquity)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Margin
              </div>
              <div className="text-sm font-semibold font-mono" style={{ color: T.text }}>
                {fmtMoney(usedMargin)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Free
              </div>
              <div className="text-sm font-semibold font-mono" style={{ color: T.text }}>
                {fmtMoney(freeMargin)}
              </div>
            </div>
          </div>
        </section>

        <div className="mb-3 rounded-2xl border p-3" style={{ background: T.card, borderColor: T.border }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="section-kicker">Premium access</div>
              <div className="text-sm font-semibold">Subscribe for bot</div>
            </div>
            <div className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ background: subscription.active ? T.tealSoft : T.amberSoft, borderColor: T.border, color: subscription.active ? T.teal : T.amber }}>
              {subscription.active ? "Active" : "Available"}
            </div>
          </div>
          <button onClick={() => openPaymentModal("subscribe")} className="w-full rounded-2xl border p-3.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-all duration-200 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${T.card} 0%, ${T.cardAlt} 100%)`, borderColor: T.border }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border" style={{ background: T.tealSoft, borderColor: `${T.teal}33`, color: T.teal }}>
                  <Bot size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">Subscribe for bot</div>
                    <div className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: T.tealSoft, borderColor: `${T.teal}33`, color: T.teal }}>Premium</div>
                  </div>
                  <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textDim }}>Unlock premium automation and richer signals for {fmtMoney(99)}.</div>
                </div>
              </div>
              <div className="text-sm font-semibold" style={{ color: T.teal }}>Join</div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] uppercase tracking-[0.2em]" style={{ borderColor: T.borderSoft, color: T.textFaint }}>
              <span>Priority access</span>
              <span>Instant activation</span>
            </div>
          </button>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2 rounded-2xl border p-2" style={{ background: T.card, borderColor: T.border }}>
          {[
            { id: "chart", label: "Chart", icon: TrendingUp },
            { id: "botting", label: "Botting", icon: Bot },
            { id: "accounting", label: "Accounting", icon: User },
            { id: "tools", label: "Tools", icon: Wrench },
          ].map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id as TabKey)} className="rounded-xl px-2 py-2 text-center text-sm font-medium transition" style={{ background: active ? T.tealSoft : "transparent", color: active ? T.teal : T.textDim }}>
                <div className="mx-auto mb-1 flex justify-center"><Icon size={16} /></div>
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 rounded-2xl border p-3" style={{ background: T.card, borderColor: T.border }}>
          {tab === "chart" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedSymbol((current) => current === "XAUUSD" ? "BTCUSD" : "XAUUSD")} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                  {selectedSymbol}
                </button>
                <Badge tone="teal">Live</Badge>
              </div>
              <div className="rounded-2xl border p-4" style={{ background: T.cardAlt, borderColor: T.border }}>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>{currentDef.name}</div>
                    <div className="text-3xl font-semibold font-mono">{fmt(last?.c ?? current.price, currentDef.decimals)}</div>
                  </div>
                  <div className="text-right font-mono text-sm" style={{ color: up ? T.teal : T.red }}>
                    {up ? "+" : ""}{fmt(change, currentDef.decimals)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-3 text-xs font-mono" style={{ color: T.textDim }}>
                  <span>O {fmt(last?.o ?? current.price, currentDef.decimals)}</span>
                  <span>H {fmt(last?.h ?? current.price, currentDef.decimals)}</span>
                  <span>L {fmt(last?.l ?? current.price, currentDef.decimals)}</span>
                  <span>C {fmt(last?.c ?? current.price, currentDef.decimals)}</span>
                </div>
                <CandleChart candles={current.candles} decimals={currentDef.decimals} />
              </div>
              <Panel>
                <div className="mb-3 section-kicker">Bot setup</div>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Strategy</label>
                    <select value={botForm.strategyId} onChange={(event) => setBotForm((prev) => ({ ...prev, strategyId: event.target.value as StrategyId }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {Object.entries(STRATEGIES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Symbol</label>
                    <select value={botForm.symbol} onChange={(event) => setBotForm((prev) => ({ ...prev, symbol: event.target.value }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {SYMBOL_DEFS.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Timeframe</label>
                    <select value={botForm.timeframe} onChange={(event) => setBotForm((prev) => ({ ...prev, timeframe: event.target.value }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {['1m', '5m', '15m', '1h', '4h'].map((timeframe) => <option key={timeframe} value={timeframe}>{timeframe}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Check every (sec)</label>
                    <input type="number" min="5" value={botForm.checkSec} onChange={(event) => setBotForm((prev) => ({ ...prev, checkSec: Number(event.target.value) }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }} />
                  </div>
                </div>
                <button onClick={startBot} className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{ background: T.teal, color: "#04231F" }}><Play size={15} /> Start bot</button>
              </Panel>
              <Panel>
                <div className="mb-3 section-kicker">Live indicators</div>
                <div className="space-y-2.5">
                  <IndicatorBar label="Trend (EMA)" value={((current.indicators.ema12 - current.indicators.ema26) / current.indicators.ema26) * 1000} />
                  <IndicatorBar label="Momentum (RSI)" value={current.indicators.rsiVal - 50} />
                  <IndicatorBar label="Efficiency Ratio" value={current.indicators.er * 20} range={6} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <RegimeBadge regime={classifyRegime(current.indicators.er)} />
                  <span className="text-xs" style={{ color: T.textFaint }}>· ATR {fmt(current.indicators.atr, currentDef.decimals)}</span>
                </div>
              </Panel>
            </div>
          )}

          {tab === "botting" && (
            <div className="space-y-4">
              <Panel>
                <div className="mb-3 section-kicker">Bot setup</div>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Strategy</label>
                    <select value={botForm.strategyId} onChange={(event) => setBotForm((prev) => ({ ...prev, strategyId: event.target.value as StrategyId }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {Object.entries(STRATEGIES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Symbol</label>
                    <select value={botForm.symbol} onChange={(event) => setBotForm((prev) => ({ ...prev, symbol: event.target.value }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {SYMBOL_DEFS.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Timeframe</label>
                    <select value={botForm.timeframe} onChange={(event) => setBotForm((prev) => ({ ...prev, timeframe: event.target.value }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {['1m', '5m', '15m', '1h', '4h'].map((timeframe) => <option key={timeframe} value={timeframe}>{timeframe}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Check every (sec)</label>
                    <input type="number" min="5" value={botForm.checkSec} onChange={(event) => setBotForm((prev) => ({ ...prev, checkSec: Number(event.target.value) }))} className="w-full rounded-lg border px-2.5 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }} />
                  </div>
                </div>
                <button onClick={startBot} className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{ background: T.teal, color: "#04231F" }}><Play size={15} /> Start bot</button>
              </Panel>

              <Panel>
                <button type="button" onClick={() => setManualOrderCollapsed((prev) => !prev)} className="mb-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition" style={{ background: "transparent", borderColor: T.border, color: T.textDim }}>
                  <div>
                    <div className="section-kicker">Manual order</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>
                      {manualOrderCollapsed ? "Tap to open" : "Tap to collapse"}
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: T.textFaint }}>{manualOrderCollapsed ? "▸" : "▾"}</div>
                </button>
                {!manualOrderCollapsed && (
                  <div className="space-y-3">
                    <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Choose the market and size before placing the trade</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Symbol</label>
                        <select value={tradeForm.symbol} onChange={(event) => setTradeForm((prev) => ({ ...prev, symbol: event.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}>
                          {SYMBOL_DEFS.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Lot size</label>
                        <input type="number" step="0.01" min="0.01" value={tradeForm.lots} onChange={(event) => setTradeForm((prev) => ({ ...prev, lots: Number(event.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }} />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Take profit</label>
                        <input type="number" step="0.01" min="0.01" placeholder="Optional" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Stop loss</label>
                        <input type="number" step="0.01" min="0.01" placeholder="Optional" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }} />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button onClick={() => setTradeForm((prev) => ({ ...prev, dir: 1 }))} className="flex items-center justify-center gap-1 rounded-lg border py-2 text-sm font-semibold shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_18px_rgba(16,185,129,0.25)] animate-pulse" style={{ background: tradeForm.dir === 1 ? "rgba(16,185,129,0.18)" : T.cardAlt, borderColor: tradeForm.dir === 1 ? T.teal : T.border, color: tradeForm.dir === 1 ? T.teal : T.textDim }}><ArrowUp size={14} /> Buy</button>
                      <button onClick={() => setTradeForm((prev) => ({ ...prev, dir: -1 }))} className="flex items-center justify-center gap-1 rounded-lg border py-2 text-sm font-semibold shadow-[0_0_0_1px_rgba(248,113,113,0.2),0_0_18px_rgba(248,113,113,0.25)] animate-pulse" style={{ background: tradeForm.dir === -1 ? "rgba(248,113,113,0.18)" : T.cardAlt, borderColor: tradeForm.dir === -1 ? T.red : T.border, color: tradeForm.dir === -1 ? T.red : T.textDim }}><ArrowDown size={14} /> Sell</button>
                    </div>
                    <button onClick={openManualPosition} className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{ background: T.teal, color: "#04231F" }}><Plus size={16} /> Open position</button>
                  </div>
                )}
              </Panel>

              <Panel>
                <div className="mb-3 flex items-center justify-between">
                  <div className="section-kicker">Open positions</div>
                  <Badge tone="gray">{positions.length}</Badge>
                </div>
                {positions.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm" style={{ borderColor: T.border, color: T.textDim }}>
                    No live trades yet — open one manually or let a bot take a signal.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.map((position) => {
                      const currentPosition = market[position.symbol];
                      const pnl = getPositionPnl(position, market);
                      return (
                        <div key={position.id} className="rounded-xl border p-3" style={{ background: T.cardAlt, borderColor: T.border }}>
                          <div className="mb-2 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold">{position.symbol}</div>
                              <div className="text-[11px]" style={{ color: T.textFaint }}>{position.dir === 1 ? "Long" : "Short"} · {position.lots} lots</div>
                            </div>
                            <Badge tone={pnl >= 0 ? "teal" : "red"}>{pnl >= 0 ? "up" : "down"}</Badge>
                          </div>
                          <div className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
                            <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>Entry</div><div className="mt-1 font-mono">{fmt(position.entry, getSymbolDef(position.symbol).decimals)}</div></div>
                            <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>Current</div><div className="mt-1 font-mono">{fmt(currentPosition?.price ?? position.entry, getSymbolDef(position.symbol).decimals)}</div></div>
                            <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>P/L</div><div className="mt-1 font-mono" style={{ color: pnl >= 0 ? T.teal : T.red }}>{fmtMoney(pnl)}</div></div>
                          </div>
                          <button onClick={() => closePosition(position.id)} className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold" style={{ background: T.redSoft, color: T.red }}><X size={14} /> Close</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <div className="space-y-3">
                {bots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: T.border, color: T.textDim }}>
                    <div className="mb-2 flex justify-center"><Bot size={20} /></div>
                    No bots running
                  </div>
                ) : bots.map((bot) => {
                  const currentBot = market[bot.symbol];
                  const signal = bot.lastSignal;
                  const regime = signal ? signal.regime : classifyRegime(currentBot.indicators.er);
                  const secondsLeft = Math.max(0, bot.checkSec - Math.floor(bot.elapsed / 1000));
                  return (
                    <div key={bot.id} className="overflow-hidden rounded-2xl border" style={{ background: T.cardAlt, borderColor: T.border }}>
                      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: T.borderSoft }}>
                        <div className="flex items-center gap-2">
                          <Circle size={8} fill={bot.running ? T.teal : T.textFaint} style={{ color: bot.running ? T.teal : T.textFaint }} />
                          <span className="font-semibold">{bot.symbol}</span>
                          <span className="text-xs" style={{ color: T.textFaint }}>· {STRATEGIES[bot.strategyId].label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {signal && <ActionBadge action={signal.action} />}
                          <RegimeBadge regime={regime} />
                        </div>
                      </div>
                      <div className="grid gap-2 border-b p-4 text-center text-sm sm:grid-cols-4" style={{ borderColor: T.borderSoft }}>
                        <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>Price</div><div className="mt-1 font-mono font-semibold">{fmt(currentBot.price, getSymbolDef(bot.symbol).decimals)}</div></div>
                        <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>Timeframe</div><div className="mt-1 font-mono font-semibold">{bot.timeframe}</div></div>
                        <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>Confidence</div><div className="mt-1 font-mono font-semibold" style={{ color: T.teal }}>{signal ? `${signal.confidence}%` : "—"}</div></div>
                        <div><div className="text-[10px] uppercase" style={{ color: T.textFaint }}>Next</div><div className="mt-1 font-mono font-semibold">{bot.running ? `${secondsLeft}s` : "paused"}</div></div>
                      </div>
                      <div className="border-b p-4" style={{ borderColor: T.borderSoft }}>
                        <div className="mb-2 section-kicker">Signal reasoning</div>
                        <div className="rounded-lg border p-2.5 text-xs leading-relaxed" style={{ background: T.card, borderColor: T.border, color: T.textDim }}>
                          {signal ? signal.reason : "Waiting for the first check to compute EMA, RSI, and Efficiency Ratio from live ticks…"}
                        </div>
                        <div className="mt-3 space-y-2">
                          <IndicatorBar label="Trend (EMA)" value={((currentBot.indicators.ema12 - currentBot.indicators.ema26) / currentBot.indicators.ema26) * 1000} />
                          <IndicatorBar label="Momentum (RSI)" value={currentBot.indicators.rsiVal - 50} />
                          <IndicatorBar label="Regime (ER)" value={currentBot.indicators.er * 20} range={6} />
                        </div>
                      </div>
                      <div className="border-b p-4" style={{ borderColor: T.borderSoft }}>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: T.textFaint }}>Confidence history</div>
                        <Sparkline data={bot.confHistory.length ? bot.confHistory : [{ v: 50 }, { v: 50 }]} color={T.teal} />
                      </div>
                      <div className="p-4">
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className="text-base">🧠</span>
                          <span className="section-kicker">Ask the model</span>
                        </div>
                        <div className="mb-3 flex gap-2">
                          <input value={askText} onChange={(event) => setAskText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && askModel(bot)} placeholder="Ask why HOLD or BUY…" className="flex-1 rounded-lg border px-3 py-2 text-xs" style={{ background: T.card, borderColor: T.border, color: T.text }} />
                          <button onClick={() => askModel(bot)} className="rounded-lg p-2" style={{ background: T.tealSoft, color: T.teal }}><Send size={14} /></button>
                        </div>
                        {bot.decisions.length > 0 && <div className="space-y-1.5 text-[11px]">{bot.decisions.map((decision, index) => <div key={index} className="flex gap-2"><span className="shrink-0 font-mono" style={{ color: T.textFaint }}>{new Date(decision.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><span className="shrink-0 font-semibold" style={{ color: decision.action === "BUY" ? T.teal : decision.action === "SELL" ? T.red : decision.action === "ASK" ? T.blue : T.textDim }}>{decision.action === "ASK" ? `Q: ${decision.q}` : decision.action}</span><span className="truncate" style={{ color: T.textDim }}>{decision.reason}</span></div>)}</div>}
                      </div>
                      <div className="flex gap-2 border-t p-3" style={{ borderColor: T.borderSoft }}>
                        {bot.running ? <button onClick={() => stopBot(bot.id)} className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold" style={{ background: T.redSoft, color: T.red }}><Square size={14} /> Stop</button> : <button onClick={() => removeBot(bot.id)} className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold" style={{ background: T.card, color: T.textDim, border: `1px solid ${T.border}` }}><Trash2 size={14} /> Remove</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "accounting" && (
            <div className="space-y-4">
              <Panel>
                <div className="mb-3 section-kicker">Demo accounting</div>
                {[
                  ["Account ID", "DEMO-100294"],
                  ["Currency", "USD"],
                  ["Leverage", `1:${LEVERAGE}`],
                  ["Balance", fmtMoney(balance)],
                  ["Equity", fmtMoney(equity)],
                  ["Used margin", fmtMoney(usedMargin)],
                  ["Free margin", fmtMoney(freeMargin)],
                  ["Open positions", positions.length],
                ].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b py-2 text-sm" style={{ borderColor: T.borderSoft }}><span style={{ color: T.textDim }}>{label}</span><span className="font-mono font-semibold">{value}</span></div>)}
              </Panel>
              <Panel>
                <div className="mb-3 section-kicker">Activity</div>
                <div className="space-y-2 text-xs">
                  {activity.map((item, index) => <div key={index} className="flex gap-2"><span className="shrink-0 font-mono" style={{ color: T.textFaint }}>{new Date(item.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><span style={{ color: item.kind === "buy" ? T.teal : item.kind === "sell" ? T.red : T.textDim }}>{item.text}</span></div>)}
                </div>
              </Panel>
            </div>
          )}

          {tab === "tools" && (
            <div className="space-y-4">
              <Panel>
                <div className="mb-3 section-kicker">Trading tools</div>
                <div className="rounded-2xl border p-4" style={{ background: T.cardAlt, borderColor: T.border }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Current account</div>
                      <div className="mt-1 text-sm" style={{ color: T.textDim }}>
                        {subscription.active ? `${subscription.plan} · ${fmtMoney(subscription.amount)}/mo` : "Starter plan · no active bot subscription"}
                      </div>
                    </div>
                    <div className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ background: T.tealSoft, borderColor: T.border, color: T.teal }}>
                      {subscription.active ? "Active" : "Basic"}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <button onClick={() => openPaymentModal("subscribe")} className="group rounded-2xl border p-3.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-all duration-200 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${T.card} 0%, ${T.cardAlt} 100%)`, borderColor: T.border }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl border" style={{ background: T.tealSoft, borderColor: `${T.teal}33`, color: T.teal }}>
                            <Bot size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold">Subscribe for bot</div>
                              <div className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: T.tealSoft, borderColor: `${T.teal}33`, color: T.teal }}>Premium</div>
                            </div>
                            <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textDim }}>Unlock premium automation and richer signals for {fmtMoney(99)}.</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold" style={{ color: T.teal }}>Join</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] uppercase tracking-[0.2em]" style={{ borderColor: T.borderSoft, color: T.textFaint }}>
                        <span>Priority access</span>
                        <span>Instant activation</span>
                      </div>
                    </button>

                    <button onClick={() => openPaymentModal("topup")} className="group rounded-2xl border p-3.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-all duration-200 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${T.card} 0%, ${T.cardAlt} 100%)`, borderColor: T.border }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl border" style={{ background: T.amberSoft, borderColor: `${T.amber}33`, color: T.amber }}>
                            <Plus size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold">Top up to trade</div>
                              <div className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: T.amberSoft, borderColor: `${T.amber}33`, color: T.amber }}>Fast</div>
                            </div>
                            <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textDim }}>Add {fmtMoney(500)} to keep your account funded for live trading.</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold" style={{ color: T.amber }}>Add</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] uppercase tracking-[0.2em]" style={{ borderColor: T.borderSoft, color: T.textFaint }}>
                        <span>Low friction</span>
                        <span>Same-day credit</span>
                      </div>
                    </button>

                    <button onClick={() => openPaymentModal("withdraw")} className="group rounded-2xl border p-3.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-all duration-200 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${T.card} 0%, ${T.cardAlt} 100%)`, borderColor: T.border }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl border" style={{ background: T.redSoft, borderColor: `${T.red}33`, color: T.red }}>
                            <ArrowDown size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold">Withdraw</div>
                              <div className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: T.redSoft, borderColor: `${T.red}33`, color: T.red }}>Secure</div>
                            </div>
                            <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textDim }}>Withdraw {fmtMoney(250)} with protected wallet confirmation.</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold" style={{ color: T.red }}>Cash out</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] uppercase tracking-[0.2em]" style={{ borderColor: T.borderSoft, color: T.textFaint }}>
                        <span>Verified wallet</span>
                        <span>Protected flow</span>
                      </div>
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel>
                <div className="mb-3 section-kicker">Quick controls</div>
                <button onClick={resetSimulation} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: T.cardAlt, borderColor: T.border, color: T.text }}><RotateCcw size={14} /> Reset simulation</button>
              </Panel>

              <Panel>
                <div className="mb-3 section-kicker">Engine details</div>
                {[["Tick interval", `${TICK_MS} ms`], ["Leverage", `1:${LEVERAGE}`], ["Symbols", SYMBOL_DEFS.map((item) => item.id).join(", ")]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b py-2 text-sm" style={{ borderColor: T.borderSoft }}><span style={{ color: T.textDim }}>{label}</span><span className="font-mono">{value}</span></div>)}
              </Panel>

              <Panel>
                <div className="mb-3 flex items-center justify-between">
                  <div className="section-kicker">Request history</div>
                  <div className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ background: T.tealSoft, borderColor: T.border, color: T.teal }}>
                    Pending
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border p-3" style={{ background: T.cardAlt, borderColor: T.border }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{request.title}</div>
                          {request.amount !== undefined && <div className="mt-1 text-xs" style={{ color: T.textDim }}>{fmtMoney(request.amount)}</div>}
                        </div>
                        <div className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ background: request.status === "Pending" ? T.tealSoft : T.amberSoft, borderColor: T.border, color: request.status === "Pending" ? T.teal : T.amber }}>
                          {request.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
