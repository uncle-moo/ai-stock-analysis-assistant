import puppeteer from 'puppeteer'
import { execSync } from 'child_process'

function findChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ]
  for (const p of candidates) {
    if (p) {
      try {
        execSync(`test -x "${p}"`, { stdio: 'ignore' })
        return p
      } catch {}
    }
  }
  return undefined
}

function launchBrowser() {
  const executablePath = findChrome()
  return puppeteer.launch({
    headless: true,
    ...(executablePath && { executablePath }),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

export async function htmlToPng(html: string): Promise<Buffer> {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 600 })
    await page.setContent(html, { waitUntil: 'networkidle0' as any })
    const raw = await page.screenshot({ type: 'png', fullPage: true })
    return Buffer.from(raw)
  } finally {
    await browser.close()
  }
}

export async function screenshotHTML(
  htmlPath: string,
  outputPath: string,
  selector: string
): Promise<void> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })

    const element = await page.$(selector)
    if (!element) {
      throw new Error(`截图失败: 未找到选择器 "${selector}"`)
    }

    await element.screenshot({ path: outputPath, type: 'png' })
  } finally {
    await browser.close()
  }
}
