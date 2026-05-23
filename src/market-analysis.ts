import 'dotenv/config'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { fetchAllIndices, IndexAnalysis, fetchMarketOverview, MarketOverview, fetchNorthboundFunds, NorthboundFunds, fetchMarketNews, MarketNews } from './lib/market-indices.js'
import { sendToFeishu } from './lib/feishu-notifier.js'

const baseURL = process.env.LLM_BASE_URL
const openai = createOpenAI({
  apiKey: process.env.LLM_API_KEY,
  ...(baseURL ? { baseURL } : {}),
})

function ma(v: number | undefined | null, decimals = 2): string {
  if (v == null || isNaN(v)) return 'N/A'
  return v.toFixed(decimals)
}

function trendLabel(trend: string): string {
  if (trend === 'bullish') return '偏多'
  if (trend === 'bearish') return '偏空'
  return '中性'
}

function formatIndexData(results: IndexAnalysis[]): string {
  return results.map(r => {
    const a = r.analysis
    const sign = a.changePercent >= 0 ? '+' : ''

    return `### ${r.config.name}（${r.config.code}）
- 当前点位：${a.price.toFixed(2)}（${sign}${a.changePercent.toFixed(2)}%）
- 趋势判断：${trendLabel(a.trend)}
- 均线：MA5=${ma(a.mas.ma5)} | MA10=${ma(a.mas.ma10)} | MA20=${ma(a.mas.ma20)} | MA60=${ma(a.mas.ma60)}
- 均线状态：${a.maStatus}
- MACD：${a.macdStatus}
- RSI(14)：${ma(a.rsi)}（${a.rsiStatus}）
- 成交量状态：${a.volumeStatus}
- 支撑位：${a.supportLevels.length > 0 ? a.supportLevels.map(v => v.toFixed(2)).join(', ') : '暂无明确支撑'}
- 压力位：${a.resistanceLevels.length > 0 ? a.resistanceLevels.map(v => v.toFixed(2)).join(', ') : '暂无明确压力'}`
  }).join('\n\n')
}

function buildMarketPrompt(results: IndexAnalysis[], overview: MarketOverview, northbound: NorthboundFunds, news: MarketNews[]): string {
  const indexData = formatIndexData(results)
  const marketStats = `
- 两市总成交额：${(overview.totalTurnover / 100000000).toFixed(2)} 亿元
- 涨跌分布：上涨 ${overview.advancing} 家 | 下跌 ${overview.declining} 家 | 平盘 ${overview.unchanged} 家
- 北向资金净流入：${northbound.netInflow.toFixed(2)} 亿元
`
  const newsData = news.map(n => `- [${n.time}] ${n.title}: ${n.summary}`).join('\n')

  return `你是一名资深的股票投资策略专家，擅长结合技术面、资金面和宏观/行业消息面对大盘进行全方位深度研判。请根据以下提供的今日 A 股市场数据及最新消息，撰写一份专业的复盘分析报告。

## 今日市场核心数据
${marketStats}

## 主要指数技术表现
${indexData}

## 最新市场消息面
${newsData}

请按以下结构输出分析报告（使用中文，专业、冷峻、前瞻，Markdown 格式）：

### 一、盘面情绪与核心逻辑
评价今日市场情绪。结合技术走势、资金流向以及最新的宏观/行业消息，分析驱动今日行情的核心逻辑。

### 二、消息面深度解读
筛选并分析上述消息中对市场最具影响力的 2-3 条，说明其对相关板块或大盘短期走势的具体潜在影响。

### 三、技术面多维研判
综合均线、MACD、RSI 等指标，对主要指数的当前技术状态进行深度解读。指出量价配合情况及是否存在关键的技术节点。

### 四、短期走势预测（未来 1-3 个交易日）
明确给出上涨/下跌/横盘的概率评估，并详细阐述理由（需综合考虑技术面支撑/压力与消息面的扰动）。

### 五、实战操作建议
基于全方位分析，对不同仓位和风格的投资者给出具体的实战指导（加仓/减仓/锁仓/调仓方向）。

### 六、潜在风险与不确定性
指出当前市场在技术面或消息面存在的潜在重大隐患或不确定因素。

格式要求：严谨专业，逻辑严密，拒绝模棱两可。直接输出报告内容，无需额外寒暄。`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('=== 每日大盘专业全维度分析报告 ===')
  console.log(`分析日期: ${new Date().toLocaleDateString('zh-CN')}\n`)

  const [results, overview, northbound, news] = await Promise.all([
    fetchAllIndices(),
    fetchMarketOverview(),
    fetchNorthboundFunds(),
    fetchMarketNews()
  ])

  if (results.length === 0) {
    console.error('主要指数数据获取失败')
    process.exit(1)
  }

  console.log('\n--- 生成 AI 综合分析报告 ---')
  const prompt = buildMarketPrompt(results, overview, northbound, news)

  let reportText = ''
  const retries = 3
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { text } = await generateText({
        model: openai.chat(process.env.LLM_MODEL || 'gpt-4o-mini'),
        prompt,
        temperature: 0.7,
      })
      reportText = text
      break
    } catch (e) {
      if (attempt < retries - 1) {
        const wait = 2000 * Math.pow(2, attempt)
        console.error(`  LLM调用失败(${attempt + 1}/${retries}), ${wait}ms后重试: ${(e as Error).message}`)
        await sleep(wait)
      } else {
        throw e
      }
    }
  }

  if (!reportText) {
    console.error('LLM分析生成失败')
    process.exit(1)
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const fullReport = `## 📈 大盘收盘复盘分析 - ${dateStr}\n\n${reportText}`

  console.log('\n--- 推送至飞书 ---')
  await sendToFeishu(fullReport, '📊 每日大盘专业全维度分析')
  console.log('大盘分析报告已推送至飞书')
}

main().catch(e => {
  console.error('运行失败:', e)
  process.exit(1)
})
