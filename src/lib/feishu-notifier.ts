interface FeishuCardMessage {
  msg_type: 'interactive'
  card: any
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

/**
 * 发送自定义卡片（支持多元素：div / hr / column_set / note 等）
 */
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
