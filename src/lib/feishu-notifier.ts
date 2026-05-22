interface FeishuCardMessage {
  msg_type: 'interactive'
  card: any
}

export async function sendToFeishu(report: string): Promise<void> {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('未设置 FEISHU_WEBHOOK_URL')
    return
  }

  const message: FeishuCardMessage = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '📊 每日自选股技术分析' },
        template: 'blue',
      },
      elements: [
        {
          tag: 'markdown',
          content: report,
        },
        {
          tag: 'hr',
        },
        {
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: '⚠️ 本分析由AI生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。' },
          ],
        },
      ],
    },
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`飞书推送失败: ${res.status} ${body}`)
  }
}
