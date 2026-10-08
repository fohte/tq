export const numericIdPattern = /^\d+$/
const taskUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const PG_INTEGER_MAX = 2_147_483_647

export function isTaskPreviewId(value: string) {
  return numericIdPattern.test(value)
    ? Number(value) <= PG_INTEGER_MAX
    : taskUuidPattern.test(value)
}
