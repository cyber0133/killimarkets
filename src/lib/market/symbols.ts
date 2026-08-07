export type AssetClass = "Metals" | "Crypto" | "Forex";

export interface SymbolSpec {
  /** Display symbol used everywhere in the UI. */
  symbol: string;
  /** Instrument name on the live feed. */
  feedSymbol: string;
  name: string;
  assetClass: AssetClass;
  /** Decimal places used for price formatting. */
  digits: number;
  /** Value of one price unit move for 1 lot, used for risk sizing. */
  contractSize: number;
}

export const SYMBOLS: SymbolSpec[] = [
  { symbol: "XAUUSD", feedSymbol: "PAXGUSDT", name: "Gold vs US Dollar", assetClass: "Metals", digits: 2, contractSize: 100 },
  { symbol: "BTCUSD", feedSymbol: "BTCUSDT", name: "Bitcoin vs US Dollar", assetClass: "Crypto", digits: 2, contractSize: 1 },
  { symbol: "ETHUSD", feedSymbol: "ETHUSDT", name: "Ethereum vs US Dollar", assetClass: "Crypto", digits: 2, contractSize: 1 },
  { symbol: "SOLUSD", feedSymbol: "SOLUSDT", name: "Solana vs US Dollar", assetClass: "Crypto", digits: 3, contractSize: 1 },
  { symbol: "BNBUSD", feedSymbol: "BNBUSDT", name: "BNB vs US Dollar", assetClass: "Crypto", digits: 2, contractSize: 1 },
  { symbol: "XRPUSD", feedSymbol: "XRPUSDT", name: "XRP vs US Dollar", assetClass: "Crypto", digits: 4, contractSize: 1 },
  { symbol: "DOGEUSD", feedSymbol: "DOGEUSDT", name: "Dogecoin vs US Dollar", assetClass: "Crypto", digits: 5, contractSize: 1 },
  { symbol: "ADAUSD", feedSymbol: "ADAUSDT", name: "Cardano vs US Dollar", assetClass: "Crypto", digits: 4, contractSize: 1 },
  { symbol: "LINKUSD", feedSymbol: "LINKUSDT", name: "Chainlink vs US Dollar", assetClass: "Crypto", digits: 3, contractSize: 1 },
  { symbol: "EURUSD", feedSymbol: "EURUSDT", name: "Euro vs US Dollar", assetClass: "Forex", digits: 4, contractSize: 100000 },
];

const BY_SYMBOL = new Map(SYMBOLS.map((s) => [s.symbol, s]));

export function getSymbolSpec(symbol: string): SymbolSpec {
  return BY_SYMBOL.get(symbol) ?? SYMBOLS[0];
}

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};

export function formatPrice(value: number, digits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}