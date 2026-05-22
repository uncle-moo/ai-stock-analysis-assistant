import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { AnalysisResult, AIAnalysisReport } from './types.js'

const baseURL = process.env.LLM_BASE_URL
const openai = createOpenAI({
  apiKey: process.env.LLM_API_KEY,
  ...(baseURL ? { baseURL } : {}),
})

function buildPrompt(result: AnalysisResult): string {
  const gapLines = result.gaps.map(g =>
    `${g.date} ${g.type === 'up' ? '向上' : '向下'}缺口 (${g.startPrice}→${g.endPrice})${g.filled ? ' [已回补]' : ' [未回补]'}`
  ).join('\n')

  const gapGuidance = result.gaps.filter(g => !g.filled).map(g =>
    g.type === 'up'
      ? `- ${g.date} 向上缺口(${g.startPrice}→${g.endPrice})，未回补，回调时该区域可作支撑参考`
      : `- ${g.date} 向下缺口(${g.startPrice}→${g.endPrice})，未回补，反弹时该区域可作压力参考`
  ).join('\n')

  return `你是一名资深股票技术分析师。请基于以下技术指标对 ${result.name}(${result.code}) 进行全面的技术分析。

## 当前行情
- 股价: ${result.price} (${result.changePercent >= 0 ? '+' : ''}${result.changePercent.toFixed(2)}%)
- 趋势判断: ${result.trend === 'bullish' ? '偏多' : result.trend === 'bearish' ? '偏空' : '中性'}

## 均线
- MA5: ${isNaN(result.mas.ma5) ? 'N/A' : result.mas.ma5.toFixed(2)}
- MA10: ${isNaN(result.mas.ma10) ? 'N/A' : result.mas.ma10.toFixed(2)}
- MA20: ${isNaN(result.mas.ma20) ? 'N/A' : result.mas.ma20.toFixed(2)}
- MA60: ${isNaN(result.mas.ma60) ? 'N/A' : result.mas.ma60.toFixed(2)}
- 均线状态: ${result.maStatus}

## MACD
- 状态: ${result.macdStatus}

## RSI(14)
${isNaN(result.rsi) ? '- 数据不足' : `- RSI值: ${result.rsi.toFixed(2)} (${result.rsiStatus})`}

## 成交量
- 状态: ${result.volumeStatus}

## 支撑位
${result.supportLevels.length > 0 ? result.supportLevels.map(v => `- ${v.toFixed(2)}`).join('\n') : '- 暂无明确支撑'}

## 压力位
${result.resistanceLevels.length > 0 ? result.resistanceLevels.map(v => `- ${v.toFixed(2)}`).join('\n') : '- 暂无明确压力'}

## 缺口分析
${gapLines || '- 无明显缺口'}
${gapGuidance ? `\n### 缺口操作提示\n${gapGuidance}` : ''}

请输出以下分析（中文，简洁专业）：
1. 整体趋势判断（一句话）
2. 技术面要点（3-4点关键技术指标的综合解读）
3. 短期预测（未来3个交易日的走势判断，含上涨/下跌/横盘的概率评估）
4. 关键价位（明确的支撑位和压力位，含建议的止损位和止盈位）
5. 操作建议（持有/买入/卖出/观望，及建议的买入卖出价格区间）
6. 风险提示（一句话）

格式要求：每项用标题+内容，清晰易读，适合直接推送到飞书。`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function analyzeWithLLM(result: AnalysisResult, retries = 3): Promise<AIAnalysisReport> {
  const prompt = buildPrompt(result)

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { text } = await generateText({
        model: openai.chat(process.env.LLM_MODEL || 'gpt-4o-mini'),
        prompt,
        temperature: 0.7,
      })
      return {
        stock: result.name,
        code: result.code,
        overallTrend: text,
        technicalHighlights: '',
        shortTermPrediction: '',
        keyLevels: '',
        suggestion: '',
        riskNote: '',
      }
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
  throw new Error('LLM调用失败（已达到最大重试次数）')
}
