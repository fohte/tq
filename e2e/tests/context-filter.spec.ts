import { expect, test, todayStr, uniqueTitle } from './fixtures'

function isoAt(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

test('context filter narrows both the task list and the calendar', async ({
  page,
  request,
  createTask,
}) => {
  const workTitle = uniqueTitle('E2E Work')
  const personalTitle = uniqueTitle('E2E Personal')

  const workTask = await createTask({
    title: workTitle,
    context: 'work',
    startDate: todayStr(),
    estimatedMinutes: 30,
  })
  const personalTask = await createTask({
    title: personalTitle,
    context: 'personal',
    startDate: todayStr(),
    estimatedMinutes: 30,
  })

  for (const [taskId, hour] of [
    [workTask.id, 9],
    [personalTask.id, 11],
  ] as const) {
    const res = await request.post('/api/schedule/time-blocks', {
      data: {
        taskId,
        startTime: isoAt(hour),
        endTime: isoAt(hour + 1),
      },
    })
    expect(res.ok()).toBeTruthy()
  }

  await page.goto('/tasks')
  const main = page.locator('main')
  await main.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.getByText(workTitle, { exact: true })).toBeVisible()
  await expect(page.getByText(personalTitle, { exact: true })).toBeVisible()

  await main.getByRole('button', { name: 'Work', exact: true }).click()
  await expect(page.getByText(workTitle, { exact: true })).toBeVisible()
  await expect(page.getByText(personalTitle, { exact: true })).toBeHidden()

  // The filter mode is in-memory React state above the router: a client-side
  // navigation preserves it, but page.goto() would hard-reload and reset it.
  await page.getByRole('link', { name: 'Calendar' }).click()
  const calendar = page.locator('.tq-calendar')
  await expect(calendar.getByText(workTitle, { exact: true })).toBeVisible()
  await expect(calendar.getByText(personalTitle, { exact: true })).toHaveCount(
    0,
  )
  await expect(calendar.getByText('予定あり').first()).toBeVisible()
})
