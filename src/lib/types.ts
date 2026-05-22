export interface WatchlistConfig {
  name: string
  stocks: WatchlistStock[]
}

export interface WatchlistStock {
  code: string
  name?: string
  market?: Market
}

export type Market = 'A' | 'HK' | 'US'

export interface KLine {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount?: number
}

export interface StockData {
  code: string
  name: string
  price: number
  changePercent: number
  changeAmount: number
  high: number
  low: number
  open: number
  volume: number
  klines: KLine[]
  source: string
}

export interface MACDResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

export interface Gap {
  date: string
  type: 'up' | 'down'
  startPrice: number
  endPrice: number
  filled: boolean
}

export interface AnalysisResult {
  code: string
  name: string
  price: number
  changePercent: number
  mas: { ma5: number; ma10: number; ma20: number; ma60: number }
  macd: MACDResult
  macdStatus: string
  rsi: number
  rsiStatus: string
  supportLevels: number[]
  resistanceLevels: number[]
  gaps: Gap[]
  trend: 'bullish' | 'bearish' | 'neutral'
  volumeStatus: string
  maStatus: string
  source: string
}

export interface AIAnalysisReport {
  stock: string
  code: string
  overallTrend: string
  technicalHighlights: string
  shortTermPrediction: string
  keyLevels: string
  suggestion: string
  riskNote: string
}
