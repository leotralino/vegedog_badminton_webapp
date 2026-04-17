import { test, expect } from '@playwright/test'

// Returns a datetime-local string (YYYY-MM-DDTHH:MM) offset by `hoursFromNow`
function futureDateTime(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 3_600_000)
  // Round to nearest 15 min
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return d.toISOString().slice(0, 16)
}

// ── Create a session and return its URL ────────────────────────────────────
async function createTestSession(page: import('@playwright/test').Page) {
  await page.goto('/sessions/new')

  await page.fill('input[placeholder="周五菜狗"]', 'E2E 测试场次')

  // Pick the first preset location option
  const presetBtn = page.locator('button', { hasText: '文娱' }).first()
  if (await presetBtn.count() > 0) {
    await presetBtn.click()
  } else {
    // Fall back to custom location input
    await page.fill('input[placeholder="地点昵称（如：菜狗村）"]', 'E2E 球馆')
  }

  await page.fill('input[type="datetime-local"]', futureDateTime(4))
  const deadlineInputs = page.locator('input[type="datetime-local"]')
  await deadlineInputs.nth(1).fill(futureDateTime(2))

  await page.fill('input[type="number"][min="1"][max="20"]', '2')   // courts
  await page.fill('input[type="number"][min="1"][max="200"]', '4')  // max participants

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/sessions\/[a-f0-9-]{36}$/, { timeout: 10_000 })
  return page.url()
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session lifecycle', () => {
  let sessionUrl: string

  test('create a session', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await expect(page.locator('h1, h2').filter({ hasText: 'E2E 测试场次' })).toBeVisible()
    await expect(page.getByText('正在接龙')).toBeVisible()
  })

  test('join session with own name', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await page.goto(sessionUrl)

    // The join input should be pre-filled with the user's nickname
    const joinBtn = page.locator('button', { hasText: /以".*"加入/ })
    await expect(joinBtn).toBeVisible()
    await joinBtn.click()

    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=已报名（1/')).toBeVisible()
  })

  test('join with +1 (different name)', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await page.goto(sessionUrl)

    // Join own name first
    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    // Change name and join again as +1
    const nameInput = page.locator('input[type="text"]').filter({ hasText: '' }).first()
    // The name input is near the join button
    const joinSection = page.locator('button', { hasText: /以".*"加入/ })
    const input = joinSection.locator('..').locator('input').first()
    await input.fill('E2E 小明')
    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=已报名（2/')).toBeVisible()
  })

  test('withdraw from session', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await page.goto(sessionUrl)

    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    // Click withdraw button on own participant row
    await page.locator('button', { hasText: '退出' }).first().click()
    // Confirm dialog
    await page.locator('button', { hasText: '确认退出' }).click()
    await expect(page.getByText('已退出')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=已报名（0/')).toBeVisible()
  })

  test('waitlist kicks in when session is full', async ({ page }) => {
    await page.goto('/sessions/new')

    await page.fill('input[placeholder="周五菜狗"]', 'E2E 候补测试')
    const presetBtn = page.locator('button', { hasText: '文娱' }).first()
    if (await presetBtn.count() > 0) await presetBtn.click()
    else await page.fill('input[placeholder="地点昵称（如：菜狗村）"]', 'E2E 球馆')

    await page.fill('input[type="datetime-local"]', futureDateTime(4))
    await page.locator('input[type="datetime-local"]').nth(1).fill(futureDateTime(2))
    await page.fill('input[type="number"][min="1"][max="20"]', '1')   // 1 court
    await page.fill('input[type="number"][min="1"][max="200"]', '1')  // max 1 person

    await page.click('button[type="submit"]')
    await page.waitForURL(/\/sessions\/[a-f0-9-]{36}$/)
    const url = page.url()

    // Join as self (fills the 1 spot)
    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    // Join as +1 (should go to waitlist)
    const input = page.locator('input').filter({ has: page.locator('[placeholder]') }).last()
    await page.locator('input[type="text"]').last().fill('E2E 候补者')
    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    // Waitlist section should appear
    await expect(page.getByText('候补')).toBeVisible()
  })

  test('lock session and mark 加时', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await page.goto(sessionUrl)

    // Join first
    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    // Lock
    await page.locator('button', { hasText: '🔒 锁定接龙' }).click()
    await expect(page.getByText('已锁定')).toBeVisible({ timeout: 5_000 })

    // Mark 加时 on own row
    const lateBtn = page.locator('button', { hasText: '+时' }).first()
    await expect(lateBtn).toBeVisible()
    await lateBtn.click()
    // Button should now be highlighted (active state)
    await expect(lateBtn).toHaveClass(/brand|green|active|bg-/, { timeout: 3_000 })
  })

  test('lock session and toggle payment status', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await page.goto(sessionUrl)

    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    await page.locator('button', { hasText: '🔒 锁定接龙' }).click()
    await expect(page.getByText('已锁定')).toBeVisible({ timeout: 5_000 })

    // Payment record should appear as 未支付
    const payBtn = page.locator('button', { hasText: '未支付' }).first()
    await expect(payBtn).toBeVisible()

    // Toggle to paid
    await payBtn.click()
    await expect(page.locator('button', { hasText: '已付 ✓' }).first()).toBeVisible({ timeout: 5_000 })

    // Toggle back to unpaid
    await page.locator('button', { hasText: '已付 ✓' }).first().click()
    await expect(page.locator('button', { hasText: '未支付' }).first()).toBeVisible({ timeout: 5_000 })
  })

  test('close session after locking', async ({ page }) => {
    sessionUrl = await createTestSession(page)
    await page.goto(sessionUrl)

    await page.locator('button', { hasText: /以".*"加入/ }).click()
    await expect(page.getByText('已加入！🎉')).toBeVisible({ timeout: 5_000 })

    await page.locator('button', { hasText: '🔒 锁定接龙' }).click()
    await expect(page.getByText('已锁定')).toBeVisible({ timeout: 5_000 })

    await page.locator('button', { hasText: '移入历史' }).click()
    await expect(page.getByText('已结束')).toBeVisible({ timeout: 5_000 })

    // Session should appear in history
    await page.goto('/history')
    await expect(page.locator('text=E2E 测试场次')).toBeVisible()
  })
})
