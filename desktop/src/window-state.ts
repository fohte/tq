import { Result } from 'neverthrow'

export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type WindowBoundsStore = {
  load: () => Result<WindowBounds | undefined, unknown>
  save: (bounds: WindowBounds) => Result<void, unknown>
}

type TimerApi = {
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}

export const createDebouncedAction = (
  action: () => void,
  delayMs: number,
  timers: TimerApi = { setTimeout, clearTimeout },
): { schedule: () => void; flush: () => void } => {
  let timeout: ReturnType<typeof setTimeout> | undefined

  const cancel = () => {
    if (timeout === undefined) return
    timers.clearTimeout(timeout)
    timeout = undefined
  }

  return {
    schedule: () => {
      cancel()
      timeout = timers.setTimeout(() => {
        timeout = undefined
        action()
      }, delayMs)
    },
    flush: () => {
      cancel()
      action()
    },
  }
}

type WindowBoundsStorage = {
  read: () => string
  write: (serialized: string) => void
}

export const parseWindowBounds = (value: unknown): WindowBounds | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('x' in value) ||
    !('y' in value) ||
    !('width' in value) ||
    !('height' in value)
  ) {
    return undefined
  }

  const { x, y, width, height } = value
  if (
    typeof x !== 'number' ||
    !Number.isInteger(x) ||
    typeof y !== 'number' ||
    !Number.isInteger(y) ||
    typeof width !== 'number' ||
    !Number.isInteger(width) ||
    width <= 0 ||
    typeof height !== 'number' ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    return undefined
  }

  return { x, y, width, height }
}

export const initialWindowBounds = (workArea: WindowBounds): WindowBounds => {
  const width = Math.min(320, workArea.width)
  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y,
    width,
    height: workArea.height,
  }
}

export const clampWindowBounds = (
  bounds: WindowBounds,
  workArea: WindowBounds,
): WindowBounds => {
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  return {
    x: Math.min(
      Math.max(bounds.x, workArea.x),
      workArea.x + workArea.width - width,
    ),
    y: Math.min(
      Math.max(bounds.y, workArea.y),
      workArea.y + workArea.height - height,
    ),
    width,
    height,
  }
}

export const createWindowBoundsStore = ({
  read,
  write,
}: WindowBoundsStorage): WindowBoundsStore => {
  const parse = Result.fromThrowable(
    (serialized: string): unknown => JSON.parse(serialized),
    (caughtErr) => caughtErr,
  )

  return {
    load: () =>
      Result.fromThrowable(read, (caughtErr) => caughtErr)().andThen(
        (serialized) => parse(serialized).map(parseWindowBounds),
      ),
    save: (bounds) =>
      Result.fromThrowable(
        () => {
          write(JSON.stringify(bounds))
        },
        (caughtErr) => caughtErr,
      )(),
  }
}
