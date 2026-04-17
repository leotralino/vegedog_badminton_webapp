import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

export default async function globalSetup() {
  const email    = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) {
    throw new Error('Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local before running tests')
  }

  const authDir = path.join(process.cwd(), 'playwright/.auth')
  fs.mkdirSync(authDir, { recursive: true })

  const browser = await chromium.launch()
  const page    = await browser.newPage()

  await page.goto('http://localhost:3000/login')

  // Make sure password mode is active (it's the default tab)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/sessions', { timeout: 10_000 })

  await page.context().storageState({ path: path.join(authDir, 'user.json') })
  await browser.close()
}
