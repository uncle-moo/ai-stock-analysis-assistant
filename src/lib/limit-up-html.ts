import { LimitUpData, LimitUpStock } from './fetch-limit-up.js'

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function ladderLabel(days: number): string {
  if (days >= 8) return '八连板'
  if (days === 7) return '七连板'
  if (days === 6) return '六连板'
  if (days === 5) return '五连板'
  if (days === 4) return '四连板'
  if (days === 3) return '三连板'
  if (days === 2) return '二连板'
  return '首板'
}

function ladderColor(days: number): string {
  if (days >= 8) return '#c62828'
  if (days >= 6) return '#d84315'
  if (days >= 4) return '#ef6c00'
  if (days >= 3) return '#f9a825'
  if (days >= 2) return '#2e7d32'
  return '#546e7a'
}

const TH_COLORS = [
  '#1565c0:#e3f2fd', '#c62828:#ffebee', '#2e7d32:#e8f5e9', '#6a1b9a:#f3e5f5',
  '#e65100:#fff3e0', '#00838f:#e0f7fa', '#ad1457:#fce4ec', '#283593:#e8eaf6',
  '#4e342e:#efebe9', '#37474f:#eceff1',
]

function thStyle(index: number): string {
  const [color, bg] = TH_COLORS[index % TH_COLORS.length].split(':')
  return `background:${bg};color:${color}`
}

// 细分行业 → 大板块（参考申万行业分类体系）
const SECTOR_CATEGORY: Record<string, string> = {
  // TMT / 电子科技
  '元件': '电子科技', '电子化学': '电子科技', '其他电子': '电子科技', '消费电子': '电子科技',
  '半导体': '电子科技', '光学光电': '电子科技', '通信设备': '电子科技', '军工电子': '电子科技',
  '照明设备': '电子科技', '计算机设': '电子科技', '软件开发': '电子科技',
  'IT服务Ⅱ': '电子科技', '互联网电': '电子科技',
  // 高端制造
  '通用设备': '高端制造', '专用设备': '高端制造', '自动化设': '高端制造',
  '电机Ⅱ': '高端制造', '汽车零部': '高端制造', '商用车': '高端制造',
  // 电力新能源
  '电网设备': '电力新能源', '电池': '电力新能源', '电力': '电力新能源',
  '光伏设备': '电力新能源', '炼化及贸': '电力新能源',
  // 材料资源
  '化学制品': '材料资源', '化学原料': '材料资源', '玻璃玻纤': '材料资源',
  '塑料': '材料资源', '橡胶': '材料资源', '农化制品': '材料资源',
  '工业金属': '材料资源', '小金属': '材料资源', '金属新材': '材料资源',
  // 医药
  '生物制品': '医药', '医疗器械': '医药', '中药Ⅱ': '医药', '化学制药': '医药',
  // 消费
  '食品加工': '消费', '调味发酵': '消费', '一般零售': '消费', '服装家纺': '消费',
  '饰品': '消费', '家居用品': '消费', '饲料': '消费', '农产品加': '消费',
  '纺织制造': '消费', '造纸': '消费',
  // 地产基建
  '房地产开': '地产基建', '水泥': '地产基建', '装修装饰': '地产基建',
  '铁路公路': '地产基建', '多元金融': '地产基建',
}
const CATEGORY_ORDER = ['电子科技', '高端制造', '电力新能源', '材料资源', '医药', '消费', '地产基建']

function getCategory(sector: string): string {
  return SECTOR_CATEGORY[sector] || '其它'
}

function renderStock(sp: LimitUpStock): string {
  let cls = 'sn'
  if (sp.isHighTurnover) cls += ' hot'
  if (sp.isOneWord) cls += ' oz'
  else if (sp.is30Percent) cls += ' p30'
  else if (sp.is20Percent) cls += ' p20'
  return `<span class="${cls}" title="${sp.code}">${sp.name}</span>`
}

export function generateLimitUpHTML(data: LimitUpData): string {
  if (data.stocks.length === 0) {
    return '<html><body style="font-family:sans-serif;text-align:center;padding:40px;color:#666"><h2>今日无涨停股票数据</h2></body></html>'
  }

  const dateObj = new Date()
  const dateStr = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`
  const dayName = DAY_NAMES[dateObj.getDay()]

  // Group stocks by consecutive days
  const groups = new Map<number, LimitUpStock[]>()
  for (const s of data.stocks) {
    const d = s.consecutiveDays
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(s)
  }

  const sortedLadders = [...groups.keys()].sort((a, b) => {
    if (a === 1) return 1
    if (b === 1) return -1
    return b - a
  })

  // Columns: ordered big categories (only those with stocks)
  const categoryStats: Record<string, number> = {}
  for (const s of data.stocks) {
    const cat = getCategory(s.sector)
    categoryStats[cat] = (categoryStats[cat] || 0) + 1
  }
  const columns = CATEGORY_ORDER.filter(c => categoryStats[c])
  if (categoryStats['其它']) columns.push('其它')

  // For each board level, build cell content per big-category column
  // Each cell: stocks grouped by sub-sector with inline sub-sector label
  type BoardRowData = { boardDays: number; cells: string[] }
  const boardData: BoardRowData[] = sortedLadders.map(days => {
    const stocks = groups.get(days)!

    // Group stocks by big category
    const byCategory = new Map<string, LimitUpStock[]>()
    for (const s of stocks) {
      const cat = getCategory(s.sector)
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(s)
    }

    const cells = columns.map(cat => {
      const catStocks = byCategory.get(cat)
      if (!catStocks || catStocks.length === 0) return ''

      // Group by sub-sector within this category
      const bySub = new Map<string, LimitUpStock[]>()
      for (const s of catStocks) {
        if (!bySub.has(s.sector)) bySub.set(s.sector, [])
        bySub.get(s.sector)!.push(s)
      }
      // Sort sub-sectors by count desc
      const sortedSubs = [...bySub.entries()]
        .sort((a, b) => b[1].length - a[1].length)

      return sortedSubs.map(([sector, sectorStocks]) => {
        const names = sectorStocks.map(renderStock).join('')
        return `<span class="sg"><span class="sg-tag">${sector}</span>${names}</span>`
      }).join('')
    })

    return { boardDays: days, cells }
  })

  // Build thead
  const headCells = columns.map((col, i) =>
    `<th style="${col === '其它' ? 'background:#eceff1;color:#666' : thStyle(i)}">${col}</th>`
  ).join('')

  // Build tbody
  const bodyRows: string[] = []
  for (const bd of boardData) {
    const days = bd.boardDays
    const color = ladderColor(days)

    const cells = bd.cells.map(c => `<td>${c}</td>`).join('')

    bodyRows.push(`<tr class="br-first">
      <th class="bl-cell" style="border-left-color:${color}">
        <span class="bn" style="color:${color}">${ladderLabel(days)}</span>
        <span class="bc">${groups.get(days)!.length}</span>
      </th>
      ${cells}
    </tr>`)
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  background:#f0f2f5;padding:24px;width:1400px;color:#333;line-height:1.6
}
.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)}

/* Header */
.hd{
  background:linear-gradient(135deg,#1a3c4a,#225a6b 50%,#1b5e5c);
  color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:center
}
.hd-l .date{font-size:13px;opacity:.75}
.hd-l h1{font-size:24px;font-weight:700;letter-spacing:2px;margin-top:2px}
.hd-r{
  text-align:center;background:rgba(255,255,255,.1);padding:12px 22px;
  border-radius:10px;border:1px solid rgba(255,255,255,.15)
}
.hd-r .num{font-size:36px;font-weight:800;line-height:1}
.hd-r .unit{font-size:12px;opacity:.7;margin-top:2px}

/* Content */
.ct{padding:12px 16px 10px}

/* ===== Unified Table ===== */
.ct table{width:100%;border-collapse:collapse;table-layout:fixed}

/* thead */
.ct thead th{
  padding:6px 4px;font-size:12px;font-weight:700;text-align:center;
  white-space:nowrap;border-radius:3px 3px 0 0;
  border-right:1px solid rgba(0,0,0,.06)
}
.ct thead th:last-child{border-right:none}

/* tbody */
.ct tbody td{
  padding:4px 5px;font-size:13px;
  border-bottom:1px solid #f0f0f0;
  border-right:1px solid #eee;vertical-align:top
}
.ct tbody td:last-child{border-right:none}

/* Sub-sector group */
.sg{display:block;margin:2px 0;line-height:1.7}
.sg-tag{
  display:inline-block;font-size:10px;color:#888;background:#f5f5f5;
  padding:0 4px;border-radius:2px;margin-right:4px;vertical-align:middle
}

/* Board label cell */
.bl-cell{
  width:64px;text-align:center;vertical-align:middle !important;
  padding:6px 4px !important;border-left:4px solid;
  background:#fafbfc;font-weight:400
}
.bl-cell .bn{display:block;font-size:14px;font-weight:700;letter-spacing:1px}
.bl-cell .bc{display:block;font-size:20px;font-weight:800;color:#333;margin-top:2px}

/* Board row separator */
.br-first td{border-top:2px solid #e0e0e0}
.br-first .bl-cell{border-top:2px solid #e0e0e0}

/* Stock name */
.sn{
  display:inline-block;padding:2px 4px;border-radius:3px;
  color:#222;white-space:nowrap;font-size:13px
}
.sn.hot{font-weight:700}
.sn.oz{color:#c62828}
.sn.p20{color:#1565c0}
.sn.p30{color:#6a1b9a}
.sn.hot.oz{font-weight:700;color:#c62828}
.sn.hot.p20{font-weight:700;color:#1565c0}
.sn.hot.p30{font-weight:700;color:#6a1b9a}

/* Summary */
.sm{
  text-align:center;padding:14px 0 4px;
  border-top:2px solid #e0e0e0;margin-top:16px;font-size:15px;color:#666
}
.sm b{color:#c62828;font-size:24px;margin:0 6px}

/* Footer */
.ft{
  background:#fafafa;padding:12px 28px;font-size:12px;color:#aaa;
  border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center
}
.ft .lg{display:flex;gap:14px;flex-wrap:wrap}
.ft .lg span{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#999}
.ld{display:inline-block;width:8px;height:8px;border-radius:50%}
</style>
</head>
<body>
<div class="card">
<div class="hd">
  <div class="hd-l">
    <div class="date">${dateStr} ${dayName}</div>
    <h1>涨停热点分布</h1>
  </div>
  <div class="hd-r">
    <div class="num">${data.totalCount}</div>
    <div class="unit">涨停数</div>
  </div>
</div>

<div class="ct">
  <table>
    <thead><tr><th class="bl-cell"></th>${headCells}</tr></thead>
    <tbody>${bodyRows.join('')}</tbody>
  </table>
<div class="ft">
  <div class="lg">
    <span><b>加粗</b> 权重票/成交&gt;40亿</span>
    <span style="color:#c62828"><b>红字</b> 一字板</span>
    <span style="color:#1565c0"><b>蓝字</b> 20%涨幅(创业板/科创板)</span>
    <span style="color:#6a1b9a"><b>紫字</b> 30%涨幅(北交所)</span>
  </div>
  <span>数据来源: 东方财富</span>
</div>
</div>
</body>
</html>`
}
