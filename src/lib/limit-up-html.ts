import { LimitUpData, LimitUpStock } from './fetch-limit-up.js'

function stockRowStyle(stock: LimitUpStock, index: number): string {
  const rows = ['#ffffff', '#f8f9fa']
  return `background: ${rows[index % 2]}`
}

function badgeHtml(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600;color:${color};background:${bg}">${text}</span>`
}

function boardTypeBadge(stock: LimitUpStock): string {
  if (stock.isOneWord) return badgeHtml('一字', '#c62828', '#ffebee')
  if (stock.is30Percent) return badgeHtml('30cm', '#6a1b9a', '#f3e5f5')
  if (stock.is20Percent) return badgeHtml('20cm', '#1565c0', '#e3f2fd')
  return badgeHtml('换手', '#424242', '#e0e0e0')
}

function ladderBadge(days: number): string {
  if (days >= 7) return badgeHtml(`${days}板`, '#b71c1c', '#ffcdd2')
  if (days >= 5) return badgeHtml(`${days}板`, '#e65100', '#ffe0b2')
  if (days >= 3) return badgeHtml(`${days}板`, '#f9a825', '#fff9c4')
  if (days >= 2) return badgeHtml(`${days}板`, '#2e7d32', '#c8e6c9')
  return badgeHtml(`${days}板`, '#616161', '#e0e0e0')
}

export function generateLimitUpHTML(data: LimitUpData): string {
  if (data.stocks.length === 0) {
    return '<html><body style="font-family:sans-serif;text-align:center;padding:40px;color:#666"><h2>今日无涨停股票数据</h2></body></html>'
  }

  const sorted = [...data.stocks].sort((a, b) => {
    if (b.consecutiveDays !== a.consecutiveDays) return b.consecutiveDays - a.consecutiveDays
    return b.turnover - a.turnover
  })

  const topSectors = Object.entries(data.sectorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const changeColor = (pct: number): string => pct >= 0 ? '#d32f2f' : '#388e3c'

  const rows = sorted.map((s, i) => {
    const turnoverYi = (s.turnover / 100000000).toFixed(1)
    return `<tr style="${stockRowStyle(s, i)}">
      <td style="padding:8px 6px;text-align:center;color:#888;font-size:13px">${i + 1}</td>
      <td style="padding:8px 6px;font-family:monospace;font-size:13px;color:#555">${s.code}</td>
      <td style="padding:8px 6px;font-weight:${s.isHighTurnover ? '700' : '400'};font-size:14px">${s.isHighTurnover ? '🔥 ' : ''}${s.name}</td>
      <td style="padding:8px 6px;text-align:right;font-family:monospace;font-size:13px">${s.price.toFixed(2)}</td>
      <td style="padding:8px 6px;text-align:right;font-family:monospace;font-size:13px;color:${changeColor(s.changePercent)};font-weight:600">+${s.changePercent.toFixed(2)}%</td>
      <td style="padding:8px 6px;text-align:center">${ladderBadge(s.consecutiveDays)}</td>
      <td style="padding:8px 6px;text-align:right;font-family:monospace;font-size:13px;color:#555">${turnoverYi}</td>
      <td style="padding:8px 6px;text-align:center;font-size:13px">${boardTypeBadge(s)}</td>
      <td style="padding:8px 6px;font-size:13px;color:#555">${s.sector}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #f0f2f5; padding: 24px; width: 1200px;
}
.header {
  background: linear-gradient(135deg, #1a237e, #283593);
  color: #fff; padding: 20px 28px; border-radius: 12px 12px 0 0;
  display: flex; justify-content: space-between; align-items: center;
}
.header h1 { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.header .meta { text-align: right; font-size: 14px; opacity: 0.85; }
.sector-bar {
  background: #fff; padding: 14px 24px;
  border-left: 1px solid #e8eaed; border-right: 1px solid #e8eaed;
  display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center;
}
.sector-bar .label { font-size: 13px; color: #888; font-weight: 500; margin-right: 4px; }
.sector-bar .tag {
  display: inline-block; padding: 2px 10px; border-radius: 12px;
  font-size: 12px; background: #e8eaf6; color: #283593;
}
.table-wrap { background: #fff; border-left: 1px solid #e8eaed; border-right: 1px solid #e8eaed; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
thead th {
  background: #37474f; color: #fff; padding: 10px 6px;
  font-size: 13px; font-weight: 600; text-align: center;
  position: sticky; top: 0;
}
thead th:first-child { border-radius: 0; }
tbody tr:hover { background: #e3f2fd !important; }
.footer {
  background: #fff; padding: 12px 24px; font-size: 12px; color: #888;
  border: 1px solid #e8eaed; border-radius: 0 0 12px 12px; border-top: none;
  display: flex; gap: 16px; flex-wrap: wrap;
}
.footer span { display: inline-flex; align-items: center; gap: 4px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>📊 涨停板连板分析</h1>
  </div>
  <div class="meta">
    <div>${data.date}</div>
    <div style="font-size:18px;font-weight:600;margin-top:4px">共 ${data.totalCount} 只涨停</div>
  </div>
</div>

<div class="sector-bar">
  <span class="label">题材分布:</span>
  ${topSectors.map(([name, count]) => `<span class="tag">${name} ${count}</span>`).join('')}
</div>

<div class="table-wrap">
<table>
<thead>
<tr>
  <th style="width:36px">#</th>
  <th style="width:90px">代码</th>
  <th>名称</th>
  <th style="width:68px">现价</th>
  <th style="width:74px">涨幅</th>
  <th style="width:64px">连板</th>
  <th style="width:82px">成交额(亿)</th>
  <th style="width:60px">板型</th>
  <th>所属板块</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>

<div class="footer">
  <span>🔴 <b>一字</b> 一字涨停</span>
  <span>🔵 <b>20cm</b> 创业板/科创板</span>
  <span>🟣 <b>30cm</b> 北交所</span>
  <span>🔥 成交额 &gt; 40亿（核心票）</span>
  <span>连板颜色: <span style="color:#2e7d32">2板</span> <span style="color:#f9a825">3-4板</span> <span style="color:#e65100">5-6板</span> <span style="color:#b71c1c">7板+</span></span>
</div>
</body>
</html>`
}
