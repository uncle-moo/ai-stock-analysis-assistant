import 'dotenv/config'
import { fetchLimitUpData } from './lib/fetch-limit-up.js'
import { formatLimitUpTable } from './lib/limit-up-formatter.js'
import { generateLimitUpHTML } from './lib/limit-up-html.js'
import { sendLimitUpReport } from './lib/feishu-notifier.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

async function main() {
  console.log('=== 涨停板连板分析 ===')
  try {
    const data = await fetchLimitUpData()
    console.log(`获取到 ${data.totalCount} 只涨停股票`)

    // 控制台输出文本表格
    const table = formatLimitUpTable(data)
    console.log('\n--- 涨停分析表格 ---')
    console.log(table)

    // 生成 HTML 并保存到 output/
    const html = generateLimitUpHTML(data)
    const outputDir = path.join(PROJECT_ROOT, 'output')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    const htmlPath = path.join(outputDir, 'limit-up-latest.html')
    fs.writeFileSync(htmlPath, html, 'utf8')
    console.log(`HTML 已保存至: ${htmlPath}`)

    // GitHub 预览链接 (htmlpreview.github.io 可渲染 raw HTML)
    const githubUrl = 'https://htmlpreview.github.io/?https://raw.githubusercontent.com/uncle-moo/ai-stock-analysis-assistant/main/output/limit-up-latest.html'

    // 推送飞书消息（含 GitHub 链接）
    if (process.env.FEISHU_WEBHOOK_URL) {
      console.log('\n--- 推送至飞书 ---')
      await sendLimitUpReport(data, githubUrl)
      console.log('涨停板报告已推送至飞书')
    }
  } catch (e) {
    console.error('分析失败:', e)
    process.exit(1)
  }
}

main()
