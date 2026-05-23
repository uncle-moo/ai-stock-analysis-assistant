import 'dotenv/config'
import { fetchLimitUpData } from './lib/fetch-limit-up.js'
import { formatLimitUpTable } from './lib/limit-up-formatter.js'
import { buildLimitUpCard } from './lib/limit-up-card.js'
import { sendFeishuCard } from './lib/feishu-notifier.js'

async function main() {
  console.log('=== 涨停板连板分析 ===')
  try {
    const data = await fetchLimitUpData()
    console.log(`获取到 ${data.totalCount} 只涨停股票`)

    // 控制台输出文本表格
    const table = formatLimitUpTable(data)
    console.log('\n--- 涨停分析表格 ---')
    console.log(table)

    // 推送飞书精美卡片
    if (process.env.FEISHU_WEBHOOK_URL) {
      console.log('\n--- 推送精美卡片至飞书 ---')
      const card = buildLimitUpCard(data)
      await sendFeishuCard(card)
      console.log('涨停板卡片已推送至飞书')
    }
  } catch (e) {
    console.error('分析失败:', e)
  }
}

main()
