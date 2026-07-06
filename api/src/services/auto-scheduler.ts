export interface BusyRange {
  start: Date
  end: Date
}

export interface FreeSlot {
  startTime: Date
  endTime: Date
  durationMinutes: number
}

/**
 * Compute the free gaps within [dayStart, dayEnd) after clipping and
 * merging the given busy ranges.
 */
export function calculateFreeSlots(
  dayStart: Date,
  dayEnd: Date,
  busyRanges: BusyRange[],
): FreeSlot[] {
  const clipped = busyRanges
    .map((range) => ({
      start:
        range.start.getTime() < dayStart.getTime() ? dayStart : range.start,
      end: range.end.getTime() > dayEnd.getTime() ? dayEnd : range.end,
    }))
    .filter((range) => range.start.getTime() < range.end.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: BusyRange[] = []
  for (const range of clipped) {
    const last = merged[merged.length - 1]
    if (last != null && range.start.getTime() <= last.end.getTime()) {
      if (range.end.getTime() > last.end.getTime()) {
        last.end = range.end
      }
    } else {
      merged.push({ start: range.start, end: range.end })
    }
  }

  const freeSlots: FreeSlot[] = []
  let cursor = dayStart
  for (const range of merged) {
    if (range.start.getTime() > cursor.getTime()) {
      freeSlots.push(makeFreeSlot(cursor, range.start))
    }
    if (range.end.getTime() > cursor.getTime()) {
      cursor = range.end
    }
  }
  if (dayEnd.getTime() > cursor.getTime()) {
    freeSlots.push(makeFreeSlot(cursor, dayEnd))
  }

  return freeSlots
}

function makeFreeSlot(start: Date, end: Date): FreeSlot {
  return {
    startTime: start,
    endTime: end,
    durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
  }
}

export interface SchedulableTask {
  taskId: string
  estimatedMinutes: number
}

export interface AssignedBlock {
  taskId: string
  startTime: Date
  endTime: Date
}

/**
 * Greedily pack tasks (in the given order) back-to-back into free slots.
 * A task is never split across slots: if it doesn't fit in the remaining
 * room of the current slot, placement moves to the start of the next slot.
 * Tasks that don't fit anywhere are left unassigned.
 */
export function autoAssign(
  tasks: SchedulableTask[],
  freeSlots: FreeSlot[],
): AssignedBlock[] {
  const blocks: AssignedBlock[] = []
  let slotIndex = 0
  let cursor: Date | null = freeSlots[0]?.startTime ?? null

  for (const task of tasks) {
    const neededMs = task.estimatedMinutes * 60000

    while (slotIndex < freeSlots.length) {
      const slot = freeSlots[slotIndex]
      if (slot == null) break
      if (cursor == null) cursor = slot.startTime
      const remainingMs = slot.endTime.getTime() - cursor.getTime()
      if (remainingMs >= neededMs) break
      slotIndex++
      cursor = null
    }

    if (slotIndex >= freeSlots.length || cursor == null) break

    const startTime = cursor
    const endTime = new Date(startTime.getTime() + neededMs)
    blocks.push({ taskId: task.taskId, startTime, endTime })
    cursor = endTime
  }

  return blocks
}
