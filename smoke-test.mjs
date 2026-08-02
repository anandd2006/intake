/**
 * Minimal Playwright smoke test — verifies the app boots and key routes render.
 * Does not require Supabase secrets or Edge Functions to be available;
 * tests for expected client-side content and absence of crash screens.
 */
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  const failures = []

  async function check(label, fn) {
    try {
      await fn()
      console.log(`  ✓ ${label}`)
    } catch (e) {
      console.log(`  ✗ ${label} → ${e.message}`)
      failures.push(label)
    }
  }

  // ── 1. App shell loads ──
  await check('App renders at root', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 })
    const title = await page.title()
    if (!title) throw new Error('Page has no title')
    const bodyText = await page.locator('body').innerText()
    if (bodyText.length === 0) throw new Error('Page body is empty')
  })

  // ── 2. /widget loads the chat widget ──
  await check('/widget loads chat UI', async () => {
    await page.goto(`${BASE_URL}/widget`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForSelector('button[aria-label="Open chat"]', { timeout: 8000 })
  })

  // ── 3. /login shows auth form ──
  await check('/login shows auth form', async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 })
    const body = await page.locator('body').innerText()
    if (!/(Sign in|Log in|Login|Email|Password)/i.test(body)) {
      throw new Error('Login page did not contain expected auth form text')
    }
  })

  // ── 4. 404 route shows fallback ──
  await check('/nonexistent shows fallback', async () => {
    await page.goto(`${BASE_URL}/nonexistent-route-xyz`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const text = await page.locator('body').innerText()
    if (text.length === 0) throw new Error('404 route rendered empty body')
  })

  // ── 5. / route leads to auth or dashboard ──
  await check('/ route is not blank', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 })
    const body = await page.locator('body').innerText()
    if (body.length === 0) throw new Error('Root route rendered empty body')
  })

  await browser.close()

  if (failures.length > 0) {
    console.log(`\n❌ Smoke test failed (${failures.length} check(s) failed)`)
    process.exit(1)
  }

  console.log('\n✅ All smoke tests passed')
}

run().catch((err) => {
  console.error('Smoke test runner crashed:', err)
  process.exit(1)
})