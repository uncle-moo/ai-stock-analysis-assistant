import puppeteer from 'puppeteer'

export async function htmlToPng(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 600 })
    await page.setContent(html, { waitUntil: 'networkidle0' as any })
    const raw = await page.screenshot({ type: 'png', fullPage: true })
    return Buffer.from(raw)
  } finally {
    await browser.close()
  }
}
