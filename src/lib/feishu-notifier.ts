import { LimitUpData } from './fetch-limit-up.js'

interface FeishuCardMessage {
  msg_type: 'interactive'
  card: any
}

interface FeishuTextMessage {
  msg_type: 'text'
  content: { text: string }
}

const webhookUrl = () => process.env.FEISHU_WEBHOOK_URL

export async function sendToFeishu(report: string, cardTitle?: string): Promise<void> {
  const url = webhookUrl()
  if (!url) {
    console.error('未设置 FEISHU_WEBHOOK_URL')
    return
  }

  const message: FeishuCardMessage = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: cardTitle || '📊 每日自选股技术分析' },
        template: 'blue',
      },
      elements: [{ tag: 'markdown', content: report }],
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`飞书推送失败: ${res.status} ${body}`)
  }
}

export async function sendFeishuCard(
  card: { header: any; elements: any[] },
): Promise<void> {
  const url = webhookUrl()
  if (!url) {
    console.error('未设置 FEISHU_WEBHOOK_URL')
    return
  }

  const message: FeishuCardMessage = {
    msg_type: 'interactive',
    card,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`飞书卡片推送失败: ${res.status} ${body}`)
  }
}

/** 发送涨停板报告：文字概要 + GitHub 热点分布图链接 */
export async function sendLimitUpReport(data: LimitUpData, htmlUrl: string): Promise<void> {
  const url = webhookUrl()
  if (!url) {
    console.error('未设置 FEISHU_WEBHOOK_URL')
    return
  }

  // 前10题材
  const topSectors = Object.entries(data.sectorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `${name}(${count})`)
    .join(' ')

  const text = [
    `📊 **涨停热点分布** | ${data.date}`,
    `涨停 **${data.totalCount}** 只`,
    ``,
    `题材: ${topSectors}`,
    ``,
    `[📈 查看完整热点分布图](${htmlUrl})`,
  ].join('\n')

  const message: FeishuTextMessage = {
    msg_type: 'text',
    content: { text },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`飞书推送失败: ${res.status} ${body}`)
  }
}
