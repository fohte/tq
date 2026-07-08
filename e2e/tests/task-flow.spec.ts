import { expect, test, uniqueTitle } from './fixtures'

test('create → set parent → place on calendar → complete', async ({
  page,
  request,
  createTask,
  trackTaskId,
}) => {
  const parentTitle = uniqueTitle('E2E Parent')
  const childTitle = uniqueTitle('E2E Child')
  const parent = await createTask({ title: parentTitle })

  const tabs = page.getByTestId('queue-tabs')
  await page.goto('/')

  let childId = ''
  await test.step('create the task via the quick-add input', async () => {
    await tabs.getByRole('button', { name: 'All', exact: true }).click()
    await page.getByRole('button', { name: 'Add task' }).click()
    const quickAdd = page.getByPlaceholder(/New task/)
    await quickAdd.fill(childTitle)
    // The row renders optimistically with a placeholder id before the
    // request settles, so read the real id from the API response rather
    // than the DOM.
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' && res.url().endsWith('/api/tasks'),
      ),
      quickAdd.press('Enter'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only response shape, not runtime-validated
    const created = (await createResponse.json()) as { id: string }
    childId = created.id
    trackTaskId(childId)
  })

  const childRow = page
    .getByTestId('all-task-row')
    .filter({ hasText: childTitle })
  const childLink = childRow.getByRole('link')

  await test.step('set the parent and an estimate', async () => {
    // Wait for the invalidation-triggered refetch to replace the optimistic
    // row (which still points at the placeholder id) with the real one.
    await expect(childLink).toHaveAttribute('href', `/tasks/${childId}`)
    await childLink.click()
    await expect(page).toHaveURL(`/tasks/${childId}`)

    // The PC and mobile sidebar layouts render simultaneously (one hidden
    // via CSS), so every field lookup below filters to the visible one.
    const parentSelect = page.getByLabel('Parent').filter({ visible: true })
    const parentOptionValue = await parentSelect
      .locator('option', { hasText: parentTitle })
      .getAttribute('value')
    if (parentOptionValue == null) throw new Error('parent option not found')
    await parentSelect.selectOption(parentOptionValue)
    await expect(parentSelect).toHaveValue(parent.id)

    const estimateField = page.getByLabel('Estimate').filter({ visible: true })
    await estimateField.click()
    await estimateField.fill('30m')
    await page.keyboard.press('Enter')

    await page.reload()
    await expect(parentSelect).toHaveValue(parent.id)
    await expect(estimateField).toHaveText('30m')
  })

  const queueRow = page
    .getByTestId('today-queue-row')
    .filter({ hasText: childTitle })

  await test.step('queue it for today and auto-schedule onto the calendar', async () => {
    await page.goto('/')
    await tabs.getByRole('button', { name: 'All', exact: true }).click()
    await childRow.getByRole('button', { name: 'Add to Today' }).click()

    await tabs.getByRole('button', { name: 'Today', exact: true }).click()
    await expect(queueRow).toBeVisible()

    await page
      .getByRole('button', { name: 'Auto Schedule', exact: true })
      .click()
    await expect(
      page.locator('.tq-calendar').getByText(childTitle),
    ).toBeVisible()
  })

  await test.step('complete it from the queue', async () => {
    await queueRow.getByRole('button', { name: 'Start task' }).click()
    await queueRow.getByRole('button', { name: 'Complete task' }).click()
    await expect(
      queueRow.getByRole('button', { name: 'Complete task' }),
    ).toBeHidden()
  })

  const res = await request.get(`/api/tasks/${childId}`)
  expect(res.ok()).toBeTruthy()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only response shape, not runtime-validated
  const task = (await res.json()) as { status: string; parentId: string }
  expect({ status: task.status, parentId: task.parentId }).toEqual({
    status: 'completed',
    parentId: parent.id,
  })
})
