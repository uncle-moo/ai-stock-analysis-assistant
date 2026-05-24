import { StockData, KLine, AnalysisResult } from './types.js'
import { analyzeStock } from './analyze-stock.js'

export interface IndexConfig {
  code: string
  name: string
  emSecid: string
}

export interface IndexAnalysis {
  config: IndexConfig
  data: StockData
  analysis: AnalysisResult
}

export interface MarketOverview {
  totalTurnover: number
  advancing: number
  declining: number
  unchanged: number
}

export interface NorthboundFunds {
  netInflow: number // 净流入 (单位: 亿元)
}

export interface MarketNews {
  title: string
  summary: string
  url: string
  time: string
}

export const INDICES: IndexConfig[] = [
  { code: '000001.SH', name: '上证指数', emSecid: '1.000001' },
  { code: '399001.SZ', name: '深证成指', emSecid: '0.399001' },
  { code: '399006.SZ', name: '创业板指', emSecid: '0.399006' },
  { code: '000688.SH', name: '科创50', emSecid: '1.000688' },
]

const TENCENT_KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
const EASTMONEY_MARKET_URL = 'https://push2.eastmoney.com/api/qt/ulist.rt/get'
const EASTMONEY_NORTHBOUND_URL = 'https://push2.eastmoney.com/api/qt/kamt.rt/get'

function toTencentCode(emSecid: string): string {
  const [prefix, code] = emSecid.split('.')
  return `${prefix === '1' ? 'sh' : 'sz'}${code}`
}

function parseTencentKlines(data: any): KLine[] {
  const codeKey = Object.keys(data?.data ?? {})[0]
  const dayData = data?.data?.[codeKey]?.day ?? []
  return dayData.map((item: string[]) => ({
    date: item[0],
    open: parseFloat(item[1]),
    close: parseFloat(item[2]),
    high: parseFloat(item[3]),
    low: parseFloat(item[4]),
    volume: parseFloat(item[5]),
  }))
}

async function fetchTencentKlines(code: string, days: number): Promise<KLine[]> {
  const url = `${TENCENT_KLINE_URL}?param=${code},day,,,${days},qfq`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.qq.com/' },
  })
  if (!res.ok) throw new Error(`腾讯请求失败: ${res.status}`)
  const json = await res.json()
  if (!json?.data || json.code !== 0) throw new Error('腾讯K线无数据')
  return parseTencentKlines(json)
}

async function fetchSingleIndex(config: IndexConfig, days = 60): Promise<StockData> {
  const tencentCode = toTencentCode(config.emSecid)
  const klines = await fetchTencentKlines(tencentCode, days)
  if (klines.length === 0) throw new Error('空K线数据')

  const last = klines[klines.length - 1]
  const prev = klines.length > 1 ? klines[klines.length - 2] : last
  const changePercent = prev.close ? ((last.close - prev.close) / prev.close * 100) : 0

  return {
    code: config.code,
    name: config.name,
    price: last.close,
    changePercent,
    changeAmount: last.close - prev.close,
    high: last.high,
    low: last.low,
    open: last.open,
    volume: last.volume,
    klines,
    source: 'tencent',
  }
}

export async function fetchMarketOverview(): Promise<MarketOverview> {
  const secids = ['1.000001', '0.399001']
  let totalTurnover = 0
  let advancing = 0
  let declining = 0
  let unchanged = 0

  for (const secid of secids) {
    try {
      const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f6,f104,f105,f106`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' },
      })
      if (!res.ok) continue
      const json = await res.json()
      const data = json?.data
      if (data) {
        totalTurnover += data.f6 || 0
        advancing += data.f104 || 0
        declining += data.f105 || 0
        unchanged += data.f106 || 0
      }
    } catch (e) {
      console.error(`获取市场数据失败 (${secid}):`, (e as Error).message)
    }
  }

  return { totalTurnover, advancing, declining, unchanged }
}

export async function fetchNorthboundFunds(): Promise<NorthboundFunds> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/kamt.rt/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' },
    })
    if (!res.ok) return { netInflow: 0 }
    const json = await res.json()
    // f52 是今日净流入 (单位: 万元)
    const netInflowWan = (json?.data?.s2h?.f52 || 0) + (json?.data?.g2h?.f52 || 0)
    return { netInflow: netInflowWan / 10000 } // 转换为亿元
  } catch (e) {
    console.error('获取北向资金失败:', (e as Error).message)
    return { netInflow: 0 }
  }
}

export async function fetchMarketNews(): Promise<MarketNews[]> {
  try {
    const url = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=155&lid=1686&num=15&page=1'
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return []
    const json = await res.json()
    const list = json?.result?.data || []
    return list.map((item: any) => ({
      title: item.title,
      summary: item.intro || '',
      url: item.url,
      time: new Date(parseInt(item.ctime) * 1000).toLocaleString('zh-CN'),
    }))
  } catch (e) {
    console.error('获取市场新闻失败:', (e as Error).message)
    return []
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function fetchAllIndices(): Promise<IndexAnalysis[]> {
  const results: IndexAnalysis[] = []

  for (let i = 0; i < INDICES.length; i++) {
    const idx = INDICES[i]
    console.log(`[${i + 1}/${INDICES.length}] 获取指数数据: ${idx.name} (${idx.code})...`)
    try {
      const data = await fetchSingleIndex(idx)
      const analysis = analyzeStock(data)
      const sign = data.changePercent >= 0 ? '+' : ''
      console.log(`  ${idx.name}: ${data.price}点, 涨跌: ${sign}${data.changePercent.toFixed(2)}%, 趋势: ${analysis.trend === 'bullish' ? '偏多' : analysis.trend === 'bearish' ? '偏空' : '中性'}`)
      results.push({ config: idx, data, analysis })
    } catch (e) {
      console.error(`  获取 ${idx.name} 失败: ${(e as Error).message}`)
    }

    if (i < INDICES.length - 1) {
      await sleep(3000)
    }
  }

  return results
}
