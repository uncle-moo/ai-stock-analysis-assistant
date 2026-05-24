import { StockData, KLine, Market } from './types.js'

const SINA_REALTIME_URL = 'https://hq.sinajs.cn/list='
const TENCENT_KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
const SINA_HISTORICAL_URL = 'https://quotes.money.163.com/service/chddata.html'

function detectMarket(code: string): Market {
  if (code.endsWith('.HK')) return 'HK'
  if (code.endsWith('.SZ')) return 'A'
  if (code.endsWith('.SH')) return 'A'
  if (/^[A-Z]+$/.test(code)) return 'US'
  return 'A'
}

function normalizeCode(code: string): string {
  const market = detectMarket(code)
  if (market === 'US') return code
  if (market === 'HK') return code.replace('.HK', '')
  return code.replace(/\.(SZ|SH)$/i, '')
}

function toTencentCode(code: string, market: Market): string {
  const raw = normalizeCode(code)
  if (market === 'A') {
    const prefix = raw.startsWith('6') || raw.startsWith('9') ? 'sh' : 'sz'
    return `${prefix}${raw}`
  }
  if (market === 'HK') return `hk${raw}`
  return raw
}

function toSinaPrefix(code: string, market: Market): string {
  const raw = normalizeCode(code)
  if (market === 'A') {
    const prefix = raw.startsWith('6') || raw.startsWith('9') ? 'sh' : 'sz'
    return `${prefix}${raw}`
  }
  if (market === 'HK') return `hk${raw}`
  return raw
}

function parseSinaRealtime(raw: string, code: string): Partial<StockData> {
  const match = raw.match(/"(.+)"/)
  if (!match) throw new Error('无法解析新浪实时数据')
  const parts = match[1].split(',')
  return {
    code: normalizeCode(code),
    name: parts[0],
    open: parseFloat(parts[1]),
    price: parseFloat(parts[3]),
    high: parseFloat(parts[4]),
    low: parseFloat(parts[5]),
    changePercent: parseFloat(parts[3]) && parseFloat(parts[2])
      ? ((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2]) * 100)
      : 0,
    changeAmount: parseFloat(parts[3]) - parseFloat(parts[2]),
    volume: parseFloat(parts[8]) || 0,
  }
}

function parseSinaHistorical(csvText: string, code: string): KLine[] {
  const lines = csvText.trim().split('\n').slice(1)
  const klines: KLine[] = []
  for (const line of lines) {
    const cols = line.split(',')
    if (cols.length < 6) continue
    const close = parseFloat(cols[3])
    if (isNaN(close) || close === 0) continue
    klines.push({
      date: cols[0],
      open: parseFloat(cols[1]),
      high: parseFloat(cols[2]),
      close,
      low: parseFloat(cols[4]),
      volume: parseFloat(cols[5]),
      amount: parseFloat(cols[6]) || undefined,
    })
  }
  return klines.reverse()
}

function parseTencentKlines(data: any, code: string): { klines: KLine[]; name: string } {
  const codeKey = Object.keys(data?.data ?? {})[0]
  const dayData = data?.data?.[codeKey]?.day ?? data?.data?.[codeKey]?.qfqday ?? []
  return {
    klines: dayData.map((item: string[]) => ({
      date: item[0],
      open: parseFloat(item[1]),
      close: parseFloat(item[2]),
      high: parseFloat(item[3]),
      low: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    })),
    name: code,
  }
}

async function fetchFromTencent(code: string, market: Market, days: number): Promise<{ klines: KLine[]; name: string }> {
  const tcCode = toTencentCode(code, market)
  const url = `${TENCENT_KLINE_URL}?param=${tcCode},day,,,${days},qfq`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.qq.com/' },
  })
  if (!res.ok) throw new Error(`腾讯请求失败: ${res.status}`)
  const json = await res.json()
  if (!json?.data || json.code !== 0) throw new Error('腾讯K线无数据')
  const result = parseTencentKlines(json, code)
  if (result.klines.length === 0) throw new Error('腾讯返回空K线')
  return result
}

async function fetchFromSinaRealtime(code: string, market: Market): Promise<Partial<StockData>> {
  const sinaCode = toSinaPrefix(code, market)
  const url = `${SINA_REALTIME_URL}${sinaCode}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.sina.com.cn/' },
  })
  if (!res.ok) throw new Error(`新浪实时请求失败: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const text = new TextDecoder('gbk').decode(buffer)
  return parseSinaRealtime(text, code)
}

async function fetchFromSinaHistorical(code: string, market: Market, days: number): Promise<KLine[]> {
  const raw = normalizeCode(code)
  let prefix: string
  if (market === 'A') {
    prefix = raw.startsWith('6') ? '0' : '1'
  } else {
    prefix = '0'
  }
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000 * 2)
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const url = `${SINA_HISTORICAL_URL}?code=${prefix}${raw}&start=${fmt(start)}&end=${fmt(end)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://money.163.com/' },
  })
  if (!res.ok) throw new Error(`新浪历史请求失败: ${res.status}`)
  const text = await res.text()
  if (text.includes('404') || text.length < 100) throw new Error('新浪历史无数据')
  return parseSinaHistorical(text, code)
}

function calcLatestFromKlines(klines: KLine[], name: string): Partial<StockData> {
  const last = klines[klines.length - 1]
  if (!last) return {}
  const prev = klines.length > 1 ? klines[klines.length - 2] : last
  const changePercent = prev.close ? ((last.close - prev.close) / prev.close * 100) : 0
  return {
    name,
    price: last.close,
    open: last.open,
    high: last.high,
    low: last.low,
    volume: last.volume,
    changePercent,
    changeAmount: last.close - prev.close,
  }
}

export async function fetchStockData(code: string, days = 60): Promise<StockData> {
  const market = detectMarket(code)
  const errors: string[] = []

  // primary: tencent history + sina realtime
  try {
    const { klines, name } = await fetchFromTencent(code, market, days)
    let realtime: Partial<StockData> = {}
    try {
      realtime = await fetchFromSinaRealtime(code, market)
    } catch {
      realtime = calcLatestFromKlines(klines, name)
    }
    if (klines.length === 0) throw new Error('腾讯返回空K线')
    return {
      code: normalizeCode(code),
      name: realtime.name || name,
      price: realtime.price ?? klines[klines.length - 1].close,
      changePercent: realtime.changePercent ?? 0,
      changeAmount: realtime.changeAmount ?? 0,
      high: realtime.high ?? klines[klines.length - 1].high,
      low: realtime.low ?? klines[klines.length - 1].low,
      open: realtime.open ?? klines[klines.length - 1].open,
      volume: realtime.volume ?? klines[klines.length - 1].volume,
      klines,
      source: 'tencent+sina',
    }
  } catch (e) {
    errors.push(`腾讯: ${(e as Error).message}`)
  }

  // fallback: sina historical
  try {
    const klines = await fetchFromSinaHistorical(code, market, days)
    const realtime = await fetchFromSinaRealtime(code, market)
    if (klines.length === 0) throw new Error('新浪历史返回空K线')
    return {
      code: normalizeCode(code),
      name: realtime.name ?? code,
      price: realtime.price ?? klines[klines.length - 1].close,
      changePercent: realtime.changePercent ?? 0,
      changeAmount: realtime.changeAmount ?? 0,
      high: realtime.high ?? klines[klines.length - 1].high,
      low: realtime.low ?? klines[klines.length - 1].low,
      open: realtime.open ?? klines[klines.length - 1].open,
      volume: realtime.volume ?? klines[klines.length - 1].volume,
      klines,
      source: 'sina',
    }
  } catch (e) {
    errors.push(`新浪: ${(e as Error).message}`)
  }

  throw new Error(`所有数据源均失败:\n${errors.join('\n')}`)
}
