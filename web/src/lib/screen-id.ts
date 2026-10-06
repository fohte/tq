let screenId: string | undefined

export function getScreenId(): string {
  screenId ??= crypto.randomUUID()
  return screenId
}
