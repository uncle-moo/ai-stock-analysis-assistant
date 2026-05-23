import { LimitUpData, LimitUpStock } from './fetch-limit-up.js'

export function formatLimitUpTable(data: LimitUpData): string {
  if (data.stocks.length === 0) return '> 今日无涨停股票数据'

  // 1. 题材概览 (前 10 个)
  const topSectors = Object.entries(data.sectorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `${name}(${count})`)
    .join(' | ')

  let report = `**题材分布**：${topSectors}\n\n---\n`

  // 2. 按连板高度分组
  const groups: Record<number, LimitUpStock[]> = {}
  data.stocks.forEach(s => {
    groups[s.consecutiveDays] = groups[s.consecutiveDays] || []
    groups[s.consecutiveDays].push(s)
  })

  const sortedLadders = Object.keys(groups)
    .map(Number)
    .sort((a, b) => b - a)

  const ladderLabels: Record<number, string> = {
    1: '首板', 2: '二连板', 3: '三连板', 4: '四连板', 5: '五连板', 6: '六连板', 7: '七连板', 8: '八连板'
  }

  // 3. 构建梯队列表
  sortedLadders.forEach(level => {
    const label = ladderLabels[level] || `${level}连板`
    const stocks = groups[level]
    
    // 在每个高度内按板块聚合展示
    const sectorInLevel: Record<string, string[]> = {}
    stocks.forEach(s => {
      let name = s.name
      if (s.isHighTurnover) {
        const turnoverG = (s.turnover / 1000000000).toFixed(1)
        name = `**${name}** 🔥(${turnoverG}亿)`
      }
      
      if (s.isOneWord) name += '🔴'
      else if (s.is20Percent) name += '🔵'
      else if (s.is30Percent) name += '🟣'
      
      sectorInLevel[s.sector] = sectorInLevel[s.sector] || []
      sectorInLevel[s.sector].push(name)
    })

    report += `**【${label} (${stocks.length}只)】**\n`
    Object.entries(sectorInLevel).forEach(([sector, names]) => {
      report += `• [${sector}] ${names.join('、')}\n`
    })
    report += '\n'
  })

  const footer = `\n---\n> **注**：🔴一字；🔵20%；🟣30%；**加粗**🔥为成交额>40亿核心票。`
  
  return `### 📊 ${data.date} 涨停热点分布 (总${data.totalCount})\n\n${report}${footer}`
}
