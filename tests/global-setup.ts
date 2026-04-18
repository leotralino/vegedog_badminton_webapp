import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { TEST_USERS } from './test-users'

export default async function globalSetup() {
  const authDir = path.join(process.cwd(), 'playwright/.auth')
  fs.mkdirSync(authDir, { recursive: true })

  const browser = await chromium.launch()

  for (const [i, user] of TEST_USERS.entries()) {
    const page = await browser.newPage()
    await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3000'}/login`)
    await page.waitForSelector('button:has-text("密码登录")', { timeout: 15_000 })
    await page.click('button:has-text("密码登录")')
    await page.fill('input[type="email"]', user.email)
    await page.fill('input[type="password"]', user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/sessions', { timeout: 10_000 })
    await page.context().storageState({ path: path.join(authDir, `user${i + 1}.json`) })
    await page.close()
    console.log(`✓ saved auth for ${user.nickname} (user${i + 1})`)
  }

  await browser.close()
}
