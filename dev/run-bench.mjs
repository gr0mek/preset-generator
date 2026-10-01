// node dev/run-bench.mjs [cpuThrottle] — starts nothing; expects `npm run dev` on :5173
import { chromium } from '@playwright/test'
const throttle = Number(process.argv[2] ?? 1)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH })
const page = await browser.newPage()
if (throttle > 1) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
}
await page.goto('http://localhost:5173/dev/bench.html')
await page.waitForFunction(() => window.__bench, null, { timeout: 180000 })
console.log(JSON.stringify({ throttle, ...(await page.evaluate(() => window.__bench)) }))
await browser.close()
