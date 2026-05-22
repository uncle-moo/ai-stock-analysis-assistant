import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fetchStockData } from './lib/fetch-stock.js'
import { analyzeStock } from './lib/analyze-stock.js'
import { analyzeWithLLM } from './lib/ai-analyzer.js'
import { sendToFeishu } from './lib/feishu-notifier.js'
import { WatchlistConfig } from './lib/types.js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const watchlistPath = resolve(process.cwd(), 'watchlist.json')
  const config: WatchlistConfig = JSON.parse(readFileSync(watchlistPath, 'utf-8'))

  console.log(`开始分析自选股: ${config.name}`)
  console.log(`股票数量: ${config.stocks.length}`)

  const parts: string[] = []

  for (let i = 0; i < config.stocks.length; i++) {
    const stock = config.stocks[i]
    console.log(`\n[${i + 1}/${config.stocks.length}] 分析 ${stock.code}...`)

    try {
      const data = await fetchStockData(stock.code, 60)
      console.log(`  数据获取成功: ${data.name} @ ${data.price}`)

      const analysis = analyzeStock(data)
      console.log(`  趋势: ${analysis.trend}, MACD: ${analysis.macdStatus}, RSI: ${analysis.rsiStatus}`)

      const report = await analyzeWithLLM(analysis)
      console.log(`  LLM分析完成`)

      parts.push(report.overallTrend)

      if (i < config.stocks.length - 1) {
        const delay = 3000
        console.log(`  等待${delay}ms后分析下一只...`)
        await sleep(delay)
      }
    } catch (e) {
      const errMsg = (e as Error).message
      console.error(`  分析失败: ${errMsg}`)
      parts.push(`**${stock.code}** 分析失败: ${errMsg}`)
    }
  }

  const fullReport = parts.join('\n\n---\n\n')
  const header = `## 📈 ${config.name} - ${new Date().toLocaleDateString('zh-CN')} 盘前分析\n\n`
  await sendToFeishu(header + fullReport)
  console.log('\n分析报告已推送至飞书')
}

main().catch(e => {
  console.error('运行失败:', e)
  process.exit(1)
})
