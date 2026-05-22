import { StockData, AnalysisResult, MACDResult, Gap } from './types.js'

function sma(values: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += values[j]
      result.push(sum / period)
    }
  }
  return result
}

function ema(values: number[], period: number): number[] {
  const result: number[] = []
  const multiplier = 2 / (period + 1)
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[i])
    } else {
      result.push((values[i] - result[i - 1]) * multiplier + result[i - 1])
    }
  }
  return result
}

function calculateMACD(closes: number[]): MACDResult {
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const dif: number[] = []
  for (let i = 0; i < closes.length; i++) {
    dif.push(ema12[i] - ema26[i])
  }
  const dea = ema(dif, 9)
  const histogram: number[] = []
  for (let i = 0; i < dif.length; i++) {
    histogram.push((dif[i] - dea[i]) * 2)
  }
  return { macd: dif, signal: dea, histogram }
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [NaN]
  let gain = 0, loss = 0
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (i < period) {
      gain += Math.max(diff, 0)
      loss += Math.max(-diff, 0)
      if (i === period - 1) {
        const avgGain = gain / period
        const avgLoss = loss / period
        rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
      } else {
        rsi.push(NaN)
      }
    } else {
      const prevAvgGain = gain / period
      const prevAvgLoss = loss / period
      const currentGain = Math.max(diff, 0)
      const currentLoss = Math.max(-diff, 0)
      gain = prevAvgGain * (period - 1) + currentGain
      loss = prevAvgLoss * (period - 1) + currentLoss
      const avgGain = gain / period
      const avgLoss = loss / period
      rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    }
  }
  return rsi
}

function findPeaks(prices: number[]): number[] {
  const peaks: number[] = []
  for (let i = 1; i < prices.length - 1; i++) {
    if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
      peaks.push(prices[i])
    }
  }
  return peaks
}

function findTroughs(prices: number[]): number[] {
  const troughs: number[] = []
  for (let i = 1; i < prices.length - 1; i++) {
    if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
      troughs.push(prices[i])
    }
  }
  return troughs
}

function clusterValues(values: number[], tolerance = 0.02): number[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const clusters: number[] = [sorted[0]]
  for (const v of sorted) {
    const last = clusters[clusters.length - 1]
    if (Math.abs(v - last) / last > tolerance) {
      clusters.push(v)
    }
  }
  return clusters
}

function findGaps(klines: { high: number; low: number; date: string }[]): Gap[] {
  const gaps: Gap[] = []
  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1]
    const curr = klines[i]
    if (curr.low > prev.high) {
      gaps.push({
        date: curr.date,
        type: 'up',
        startPrice: prev.high,
        endPrice: curr.low,
        filled: false,
      })
    } else if (curr.high < prev.low) {
      gaps.push({
        date: curr.date,
        type: 'down',
        startPrice: curr.high,
        endPrice: prev.low,
        filled: false,
      })
    }
  }
  for (const gap of gaps) {
    for (const k of klines) {
      if (k.date <= gap.date) continue
      if (gap.type === 'up' && k.low <= gap.endPrice) {
        gap.filled = true
        break
      }
      if (gap.type === 'down' && k.high >= gap.endPrice) {
        gap.filled = true
        break
      }
    }
  }
  return gaps
}

export function analyzeStock(data: StockData): AnalysisResult {
  const closes = data.klines.map(k => k.close)

  const highs = data.klines.map(k => k.high)
  const lows = data.klines.map(k => k.low)
  const volumes = data.klines.map(k => k.volume)

  const ma5 = sma(closes, 5)
  const ma10 = sma(closes, 10)
  const ma20 = sma(closes, 20)
  const ma60 = sma(closes, 60)

  const macd = calculateMACD(closes)
  const rsiArr = calculateRSI(closes, 14)

  const lastIdx = closes.length - 1
  const currentMA5 = ma5[lastIdx]
  const currentMA10 = ma10[lastIdx]
  const currentMA20 = ma20[lastIdx]
  const currentPrice = data.price

  const currentMA60 = ma60[lastIdx]

  let maStatus: string
  if (!isNaN(currentMA5) && !isNaN(currentMA10) && !isNaN(currentMA20)) {
    if (currentMA5 > currentMA10 && currentMA10 > currentMA20) {
      maStatus = '多头排列'
    } else if (currentMA5 < currentMA10 && currentMA10 < currentMA20) {
      maStatus = '空头排列'
    } else {
      maStatus = '均线缠绕'
    }
  } else {
    maStatus = '数据不足'
  }

  const lastMacd = macd.macd[lastIdx]
  const lastSignal = macd.signal[lastIdx]
  const lastHistogram = macd.histogram[lastIdx]
  const prevHistogram = macd.histogram[lastIdx - 1]

  let macdStatus: string
  if (lastMacd > lastSignal && lastHistogram > 0 && prevHistogram <= 0) {
    macdStatus = '金叉'
  } else if (lastMacd < lastSignal && lastHistogram < 0 && prevHistogram >= 0) {
    macdStatus = '死叉'
  } else if (lastMacd > lastSignal) {
    macdStatus = 'MACD在信号线上方'
  } else {
    macdStatus = 'MACD在信号线下方'
  }

  const lastRSI = rsiArr[lastIdx]

  let rsiStatus: string
  if (isNaN(lastRSI)) {
    rsiStatus = '数据不足'
  } else if (lastRSI > 70) {
    rsiStatus = '超买'
  } else if (lastRSI < 30) {
    rsiStatus = '超卖'
  } else if (lastRSI > 50) {
    rsiStatus = '偏强'
  } else {
    rsiStatus = '偏弱'
  }

  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length)
  const lastVolume = data.volume
  let volumeStatus: string
  if (lastVolume > avgVolume * 1.5) {
    volumeStatus = '放量'
  } else if (lastVolume < avgVolume * 0.5) {
    volumeStatus = '缩量'
  } else {
    volumeStatus = '量能正常'
  }

  const peaks = findPeaks(highs)
  const troughs = findTroughs(lows)
  const resistanceLevels = clusterValues(peaks).slice(-3).filter(v => v > currentPrice * 0.95)
  const supportLevels = clusterValues(troughs).slice(-3).filter(v => v < currentPrice * 1.05)

  const gaps = findGaps(data.klines)
  for (const gap of gaps) {
    if (gap.type === 'up' && !gap.filled && gap.endPrice < currentPrice) {
      supportLevels.push(gap.endPrice)
    }
    if (gap.type === 'down' && !gap.filled && gap.startPrice > currentPrice) {
      resistanceLevels.push(gap.startPrice)
    }
  }

  supportLevels.sort((a, b) => b - a)
  resistanceLevels.sort((a, b) => a - b)

  let trend: 'bullish' | 'bearish' | 'neutral'
  let bullishScore = 0
  if (maStatus === '多头排列') bullishScore++
  if (maStatus === '空头排列') bullishScore--
  if (macdStatus.includes('金叉') || (lastMacd > lastSignal && lastHistogram > 0)) bullishScore++
  if (macdStatus.includes('死叉') || (lastMacd < lastSignal && lastHistogram < 0)) bullishScore--
  if (!isNaN(lastRSI) && lastRSI > 50) bullishScore++
  if (!isNaN(lastRSI) && lastRSI < 50) bullishScore--
  if (currentPrice > currentMA5) bullishScore++
  if (currentPrice < currentMA5) bullishScore--

  if (bullishScore >= 2) trend = 'bullish'
  else if (bullishScore <= -2) trend = 'bearish'
  else trend = 'neutral'

  return {
    code: data.code,
    name: data.name,
    price: data.price,
    changePercent: data.changePercent,
    mas: { ma5: currentMA5, ma10: currentMA10, ma20: currentMA20, ma60: currentMA60 },
    macd,
    macdStatus,
    rsi: lastRSI,
    rsiStatus,
    supportLevels: supportLevels.slice(0, 3),
    resistanceLevels: resistanceLevels.slice(0, 3),
    gaps: gaps.slice(-5),
    trend,
    volumeStatus,
    maStatus,
    source: data.source,
  }
}
