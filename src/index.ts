import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { pinyin } from 'pinyin-pro'
import { fetchStockData } from './lib/fetch-stock.js'
import { analyzeStock } from './lib/analyze-stock.js'
import { analyzeWithLLM } from './lib/ai-analyzer.js'
import { sendToFeishu } from './lib/feishu-notifier.js'
import { WatchlistConfig } from './lib/types.js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const watchlistPath = resolve(process.cwd(), 'watchlist.json')
  const config: WatchlistConfig = JSON.parse(readFileSync(watchlistPath, 'utf-8'))

  const args = process.argv.slice(2).map(a => a.toLowerCase())
  let stocksToAnalyze = config.stocks

  if (args.length > 0) {
    stocksToAnalyze = config.stocks.filter(s => {
      const name = s.name || ''
      const code = s.code
      const initials = pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' })
        .join('')
        .toLowerCase()

      return args.some(arg =>
        code.includes(arg) ||
        name.toLowerCase().includes(arg) ||
        initials.includes(arg)
      )
    })

    if (stocksToAnalyze.length === 0) {
      console.log(`未找到匹配 "${args.join(', ')}" 的股票`)
      return
    }
  }

  console.log(`开始分析股票: ${args.length > 0 ? `筛选 "${args.join(', ')}"` : config.name}`)
  console.log(`股票数量: ${stocksToAnalyze.length}`)

  const parts: string[] = []

  for (let i = 0; i < stocksToAnalyze.length; i++) {
    const stock = stocksToAnalyze[i]
    console.log(`\n[${i + 1}/${stocksToAnalyze.length}] 分析 ${stock.name || stock.code} (${stock.code})...`)

    try {
      const data = await fetchStockData(stock.code, 60)
      console.log(`  数据获取成功: ${data.name} @ ${data.price}`)

      const analysis = analyzeStock(data)
      console.log(`  趋势: ${analysis.trend}, MACD: ${analysis.macdStatus}, RSI: ${analysis.rsiStatus}`)

      const report = await analyzeWithLLM(analysis)
      console.log(`  LLM分析完成`)

      parts.push(report.overallTrend)

      if (i < stocksToAnalyze.length - 1) {
        const delay = 3000
        console.log(`  等待${delay}ms后分析下一只...`)
        await sleep(delay)
      }
    } catch (e) {
      const errMsg = (e as Error).message
      console.error(`  分析失败: ${errMsg}`)
      parts.push(`**${stock.name || stock.code}** (${stock.code}) 分析失败: ${errMsg}`)
    }
  }

  const fullReport = parts.join('\n\n---\n\n')
  const title = args.length > 0 ? `股票分析: ${stocksToAnalyze.map(s => s.name || s.code).join(', ')}` : config.name
  const header = `## 📈 ${title} - ${new Date().toLocaleDateString('zh-CN')} 分析报告\n\n`
  await sendToFeishu(header + fullReport)
  console.log('\n分析报告已推送至飞书')
}

main().catch(e => {
  console.error('运行失败:', e)
  process.exit(1)
})
