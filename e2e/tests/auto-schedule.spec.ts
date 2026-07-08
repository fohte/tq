import { expect, test, uniqueTitle } from './fixtures'

function todayStr(): string {
  const d = new Date()
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TimeBlock {
  id: string
  taskId: string
  startTime: string
  isAutoScheduled: boolean
}

async function fetchBlockForTask(
  request: import('@playwright/test').APIRequestContext,
  taskId: string,
): Promise<TimeBlock> {
  const res = await request.get('/api/schedule/time-blocks', {
    params: {
      date: todayStr(),
      tzOffset: String(new Date().getTimezoneOffset()),
    },
  })
  expect(res.ok()).toBeTruthy()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only response shape, not runtime-validated
  const blocks = (await res.json()) as TimeBlock[]
  const block = blocks.find((b) => b.taskId === taskId)
  if (block == null) throw new Error('no time block found for task')
  return block
}

test('auto-schedules a queued task, then persists a manual drag adjustment', async ({
  page,
  request,
  createTask,
}) => {
  const title = uniqueTitle('E2E Auto')
  const task = await createTask({ title, estimatedMinutes: 30 })

  await page.goto('/')
  const tabs = page.getByTestId('queue-tabs')
  await tabs.getByRole('button', { name: 'All', exact: true }).click()
  await page
    .getByTestId('all-task-row')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Add to Today' })
    .click()

  await tabs.getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('button', { name: 'Auto Schedule', exact: true }).click()

  const calendar = page.locator('.tq-calendar')
  const event = calendar.locator('.fc-timegrid-event', { hasText: title })
  await expect(event).toBeVisible()
  await expect(event.getByText('Auto', { exact: true })).toBeVisible()

  const autoBlock = await fetchBlockForTask(request, task.id)
  expect(autoBlock.isAutoScheduled).toBe(true)

  // Manually drag the event two hours later (slot height is 2.5rem per 30min).
  // FullCalendar's drag interaction needs a real pointer-move sequence with a
  // pause after the initial move to cross its drag-start threshold. The
  // event may be scheduled outside the calendar's initial scroll position
  // (scrollTime), so it must be scrolled into view before computing its box.
  await event.scrollIntoViewIfNeeded()
  const box = await event.boundingBox()
  if (box == null) throw new Error('event has no bounding box')
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + 20, { steps: 5 })
  await page.waitForTimeout(200)
  await page.mouse.move(startX, startY + 300, { steps: 15 })
  await page.waitForTimeout(200)
  await page.mouse.up()

  await expect(event.getByText('Auto', { exact: true })).toBeHidden()

  await page.reload()
  const manualBlock = await fetchBlockForTask(request, task.id)
  expect(manualBlock.isAutoScheduled).toBe(false)
  expect(manualBlock.startTime).not.toBe(autoBlock.startTime)
})
