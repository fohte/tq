import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { jsonBody, patchSchedulingSettings, setupTestDb } from '#testing'

setupTestDb()

interface SchedulingSettingsResponse {
  workingHoursStart: string
  workingHoursEnd: string
  minimumBlockMinutes: number
  autoRescheduleOnGcalChange: boolean
  updatedAt: string
}

function normalize(settings: SchedulingSettingsResponse) {
  return { ...settings, updatedAt: 'DATE' }
}

describe('GET /api/scheduling-settings', () => {
  it('returns the default settings', async () => {
    const res = await app.request('/api/scheduling-settings')

    expect(res.status).toBe(200)
    const body = await jsonBody<SchedulingSettingsResponse>(res)
    expect(normalize(body)).toEqual({
      workingHoursStart: '09:00',
      workingHoursEnd: '19:00',
      minimumBlockMinutes: 30,
      autoRescheduleOnGcalChange: true,
      updatedAt: 'DATE',
    })
  })
})

describe('PATCH /api/scheduling-settings', () => {
  it('updates a single field', async () => {
    const res = await patchSchedulingSettings({ minimumBlockMinutes: 45 })

    expect(res.status).toBe(200)
    const body = await jsonBody<SchedulingSettingsResponse>(res)
    expect(normalize(body)).toEqual({
      workingHoursStart: '09:00',
      workingHoursEnd: '19:00',
      minimumBlockMinutes: 45,
      autoRescheduleOnGcalChange: true,
      updatedAt: 'DATE',
    })
  })

  it('updates workingHoursStart and workingHoursEnd together', async () => {
    const res = await patchSchedulingSettings({
      workingHoursStart: '08:00',
      workingHoursEnd: '17:00',
    })

    expect(res.status).toBe(200)
    const body = await jsonBody<SchedulingSettingsResponse>(res)
    expect(normalize(body)).toEqual({
      workingHoursStart: '08:00',
      workingHoursEnd: '17:00',
      minimumBlockMinutes: 30,
      autoRescheduleOnGcalChange: true,
      updatedAt: 'DATE',
    })
  })

  it('returns 400 when only workingHoursStart is set', async () => {
    const res = await patchSchedulingSettings({ workingHoursStart: '08:00' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when workingHoursStart is not before workingHoursEnd', async () => {
    const res = await patchSchedulingSettings({
      workingHoursStart: '19:00',
      workingHoursEnd: '09:00',
    })

    expect(res.status).toBe(400)
  })

  it.each([0, -1])(
    'returns 400 when minimumBlockMinutes is %i',
    async (minimumBlockMinutes) => {
      const res = await patchSchedulingSettings({ minimumBlockMinutes })

      expect(res.status).toBe(400)
    },
  )
})
