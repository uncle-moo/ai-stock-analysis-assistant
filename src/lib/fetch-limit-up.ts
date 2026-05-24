export interface LimitUpStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnover: number // 成交额 (元)
  consecutiveDays: number // 连板数
  sector: string // 板块/行业
  isOneWord: boolean // 是否一字板
  is20Percent: boolean // 是否 20% 涨幅 (创业板/科创板)
  is30Percent: boolean // 是否 30% 涨幅 (北交所)
  isHighTurnover: boolean // 是否成交额 > 40亿
}

export interface LimitUpData {
  date: string
  totalCount: number
  stocks: LimitUpStock[]
  sectorStats: Record<string, number>
}

const ZT_POOL_URL = 'http://push2ex.eastmoney.com/getTopicZTPool'

function getCandidateDate(): string {
  const now = new Date()
  const day = now.getDay()
  if (day === 0) now.setDate(now.getDate() - 2) // Sun → Fri
  else if (day === 6) now.setDate(now.getDate() - 1) // Sat → Fri
  return now.toISOString().slice(0, 10).replace(/-/g, '')
}

interface ZTPoolItem {
  c: string
  n: string
  p: number
  zdp: number
  amount: number
  lbc: number
  hybk: string
  fbt: number
  zbc: number
}

async function fetchZTPoolPage(date: string, page: number, size: number): Promise<{ pool: ZTPoolItem[]; total: number }> {
  const params = new URLSearchParams({
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    dpt: 'wz.ztzt',
    Pageindex: String(page),
    pagesize: String(size),
    sort: 'fbt:asc',
    date,
  })
  const url = `${ZT_POOL_URL}?${params}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' },
  })
  if (!res.ok) throw new Error(`涨停池请求失败: ${res.status}`)
  const json = await res.json()
  return {
    pool: json?.data?.pool ?? [],
    total: json?.data?.tc ?? 0,
  }
}

async function fetchAllZTPool(date: string): Promise<ZTPoolItem[]> {
  const pageSize = 200
  const all: ZTPoolItem[] = []
  let page = 0
  while (true) {
    const { pool, total } = await fetchZTPoolPage(date, page, pageSize)
    all.push(...pool)
    if (all.length >= total || pool.length < pageSize) break
    page++
  }
  return all
}

function mapZTPoolItem(item: ZTPoolItem): LimitUpStock {
  const code = item.c
  const turnover = item.amount
  return {
    code,
    name: item.n,
    price: item.p / 1000,
    changePercent: item.zdp,
    turnover,
    consecutiveDays: item.lbc,
    sector: item.hybk || '其它',
    isOneWord: item.fbt <= 93000 && item.zbc === 0,
    is20Percent: code.startsWith('300') || code.startsWith('688'),
    is30Percent: code.startsWith('8') || code.startsWith('4'),
    isHighTurnover: turnover > 4000000000,
  }
}

export async function fetchLimitUpData(): Promise<LimitUpData> {
  const date = getCandidateDate()
  console.log(`获取涨停池数据, 日期: ${date}`)

  try {
    const pool = await fetchAllZTPool(date)

    if (pool.length === 0) {
      console.log('今日无涨停数据')
      return {
        date: new Date().toLocaleDateString('zh-CN'),
        totalCount: 0,
        stocks: [],
        sectorStats: {},
      }
    }

    const stocks = pool.map(mapZTPoolItem)
    const sectorStats: Record<string, number> = {}
    stocks.forEach(s => {
      sectorStats[s.sector] = (sectorStats[s.sector] || 0) + 1
    })

    return {
      date: new Date().toLocaleDateString('zh-CN'),
      totalCount: stocks.length,
      stocks,
      sectorStats,
    }
  } catch (e) {
    console.error('获取涨停数据失败:', (e as Error).message)
    return {
      date: new Date().toLocaleDateString('zh-CN'),
      totalCount: 0,
      stocks: [],
      sectorStats: {},
    }
  }
}
