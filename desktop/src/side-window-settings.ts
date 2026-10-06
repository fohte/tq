import { Result } from 'neverthrow'

export type SideWindowSettings = {
  alwaysOnTop: boolean
}

export type SideWindowSettingsStore = {
  load: () => Result<SideWindowSettings | undefined, unknown>
  save: (settings: SideWindowSettings) => Result<void, unknown>
}

type SideWindowSettingsStorage = {
  read: () => string
  write: (serialized: string) => void
}

const parseSideWindowSettings = (
  value: unknown,
): SideWindowSettings | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('alwaysOnTop' in value) ||
    typeof value.alwaysOnTop !== 'boolean'
  ) {
    return undefined
  }

  return { alwaysOnTop: value.alwaysOnTop }
}

export const createSideWindowSettingsStore = ({
  read,
  write,
}: SideWindowSettingsStorage): SideWindowSettingsStore => {
  const parse = Result.fromThrowable(
    (serialized: string): unknown => JSON.parse(serialized),
    (caughtErr) => caughtErr,
  )

  return {
    load: () =>
      Result.fromThrowable(read, (caughtErr) => caughtErr)().andThen(
        (serialized) => parse(serialized).map(parseSideWindowSettings),
      ),
    save: (settings) =>
      Result.fromThrowable(
        () => {
          write(JSON.stringify(settings))
        },
        (caughtErr) => caughtErr,
      )(),
  }
}
