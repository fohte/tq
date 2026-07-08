import { expect, test, uniqueTitle } from './fixtures'

test('rolls back an optimistic status change when the request fails', async ({
  page,
  createTask,
}) => {
  const title = uniqueTitle('E2E Rollback')
  const task = await createTask({ title })

  // Delay the abort so the optimistic update has a window to be observed
  // before the rollback (onMutate applies synchronously; onError only fires
  // once this route settles).
  await page.route('**/api/tasks/*/status', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.abort()
  })

  await page.goto(`/tasks/${task.id}`)
  const statusSelect = page.getByLabel('Status').filter({ visible: true })
  await expect(statusSelect).toHaveValue('todo')

  await statusSelect.selectOption('in_progress')
  await expect(statusSelect).toHaveValue('in_progress')

  await expect(statusSelect).toHaveValue('todo')
})
