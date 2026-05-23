import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

/**
 * 获取涨停池数据 (通过 AKShare Python Bridge)
 */
export async function fetchLimitUpData(): Promise<LimitUpData> {
  try {
    const pythonScript = path.join(__dirname, 'fetch_limit_up.py')
    console.log(`正在通过 AKShare 获取最近交易日数据...`)
    const output = execSync(`python3 "${pythonScript}"`, { encoding: 'utf8' })
    const list = JSON.parse(output)
    
    if (list.length === 0) {
      console.log('今日无涨停数据')
      return {
        date: new Date().toLocaleDateString('zh-CN'),
        totalCount: 0,
        stocks: [],
        sectorStats: {},
      }
    }

    const stocks: LimitUpStock[] = list.map((item: any) => {
      const code = item.f12
      const name = item.f14
      const turnover = item.f6

      return {
        code,
        name,
        price: item.f2,
        changePercent: item.f3,
        turnover,
        consecutiveDays: item.f161,
        sector: item.f100 || '其它',
        isOneWord: item.is_one_word_force || (item.f17 === item.f15 && item.f18 === item.f15),
        is20Percent: code.startsWith('300') || code.startsWith('688'),
        is30Percent: code.startsWith('8') || code.startsWith('4'),
        isHighTurnover: turnover > 4000000000,
      }
    })

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
    console.error('获取 AKShare 数据失败:', (e as Error).message)
    return {
      date: new Date().toLocaleDateString('zh-CN'),
      totalCount: 0,
      stocks: [],
      sectorStats: {},
    }
  }
}
