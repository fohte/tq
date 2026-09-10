import '#bootstrap'

import { serve } from '@hono/node-server'

import { app } from '#app'
import { startRecurringTaskScheduler } from '#services/recurring-task-scheduler'
import { startReminderScheduler } from '#services/task-reminders'

const port = Number(process.env['PORT']) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${String(info.port)}`)
})

const reminderTimer = startReminderScheduler()
const recurringTaskTimer = startRecurringTaskScheduler()

// Otherwise the two intervals keep the process alive with no way to stop them.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(reminderTimer)
    clearInterval(recurringTaskTimer)
    process.exit(0)
  })
}
