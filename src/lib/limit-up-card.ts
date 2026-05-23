import { LimitUpData, LimitUpStock } from './fetch-limit-up.js'

const LADDER_LABELS: Record<number, string> = {
  1: '首板', 2: '二连板', 3: '三连板', 4: '四连板', 5: '五连板',
  6: '六连板', 7: '七连板', 8: '八连板',
}

function stockSuffix(s: LimitUpStock): string {
  // 返回值：一字→红 20%→蓝 30%→紫
  if (s.isOneWord) return ' 🔴'
  if (s.is30Percent) return ' 🟣'
  if (s.is20Percent) return ' 🔵'
  return ''
}

/** 成交额标记：>40亿 加粗+🔥 */
function turnoverTag(turnover: number): string {
  if (turnover > 4_000_000_000) {
    return ` 🔥${(turnover / 100_000_000).toFixed(0)}亿`
  }
  return ''
}

function escapeMd(text: string): string {
  return text.replace(/([_*\[\]()~`#>|+\-!])/g, '\\$1')
}

export function buildLimitUpCard(data: LimitUpData) {
  const elements: any[] = []

  // ── 统计栏：双列 ──
  elements.push({
    tag: 'column_set',
    flex_mode: 'bisect',
    columns: [
      {
        tag: 'column', width: 'weighted', weight: 1,
        elements: [{ tag: 'div', text: { tag: 'lark_md', content: `📅 **${data.date}**` } }],
      },
      {
        tag: 'column', width: 'weighted', weight: 1,
        elements: [{ tag: 'div', text: { tag: 'lark_md', content: `🔥 **涨停 ${data.totalCount} 只**` } }],
      },
    ],
  })

  // ── 题材分布 ──
  const topSectors = Object.entries(data.sectorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => `${escapeMd(name)}(${count})`)
    .join(' · ')

  elements.push({
    tag: 'div',
    text: { tag: 'lark_md', content: `**题材分布**：${topSectors}` },
  })

  // ── 按连板高度分组 ──
  const groups: Record<number, LimitUpStock[]> = {}
  data.stocks.forEach(s => {
    groups[s.consecutiveDays] = groups[s.consecutiveDays] || []
    groups[s.consecutiveDays].push(s)
  })

  const sortedLevels = Object.keys(groups).map(Number).sort((a, b) => b - a)

  for (const level of sortedLevels) {
    elements.push({ tag: 'hr' })

    const stocks = groups[level]
    const label = LADDER_LABELS[level] || `${level}连板`
    const emoji = level >= 5 ? '🚀' : level >= 3 ? '🔥' : level === 2 ? '📈' : '📌'

    // ── 连板级别标题行（模拟左侧标记+计数） ──
    elements.push({
      tag: 'column_set',
      flex_mode: 'none',
      columns: [
        {
          tag: 'column', width: 'content',
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: `${emoji} **${label}**` } }],
        },
        {
          tag: 'column', width: 'weighted', weight: 1,
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: `共 ${stocks.length} 只` } }],
        },
      ],
    })

    // ── 按板块聚合 ──
    const sectorInLevel: Record<string, LimitUpStock[]> = {}
    stocks.forEach(s => {
      sectorInLevel[s.sector] = sectorInLevel[s.sector] || []
      sectorInLevel[s.sector].push(s)
    })

    // 对首板且板块数>8时折叠为简表
    const isFold = level === 1 && Object.keys(sectorInLevel).length > 6

    if (!isFold) {
      // 详细模式：每板块一行
      const sortedSectors = Object.entries(sectorInLevel)
        .sort((a, b) => b[1].length - a[1].length)

      for (const [sector, sectorStocks] of sortedSectors) {
        const stockText = sectorStocks.map(s => {
          const name = escapeMd(s.name.replace(/\s+/g, ''))
          const suffix = stockSuffix(s)
          const turnover = turnoverTag(s.turnover)
          // 成交额>40亿 加粗
          if (turnover) {
            return `**${name}**${turnover}${suffix}`
          }
          return `${name}${suffix}`
        }).join(' · ')

        elements.push({
          tag: 'div',
          text: { tag: 'lark_md', content: `**${escapeMd(sector)}**　${stockText}` },
        })
      }
    } else {
      // 折叠模式：仅显示板块分布 + 重点个股
      const sectorSummary = Object.entries(sectorInLevel)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 12)
        .map(([name, list]) => `${escapeMd(name)}(${list.length})`)
        .join(' · ')

      const topByTurnover = [...stocks]
        .sort((a, b) => b.turnover - a.turnover)
        .slice(0, 6)

      const topText = topByTurnover.map(s => {
        const name = escapeMd(s.name.replace(/\s+/g, ''))
        const suffix = stockSuffix(s)
        const turnover = turnoverTag(s.turnover)
        if (turnover) return `**${name}**${turnover}${suffix}`
        return `${name}${suffix}`
      }).join(' · ')

      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**板块分布**：${sectorSummary}\n**重点个股**：${topText}`,
        },
      })
    }
  }

  // ── 底部图例 ──
  elements.push({ tag: 'hr' })
  elements.push({
    tag: 'note',
    elements: [
      { tag: 'plain_text', content: '🔴一字板  🔵20%涨停(创/科)  🟣30%涨停(北交)  🔥成交额>40亿 加粗=权重/核心票' },
    ],
  })

  return {
    header: { title: { tag: 'plain_text', content: '📊 涨停板连板分析' }, template: 'indigo' },
    elements,
  }
}
