export const SIDEBAR_MIN_WIDTH = 160
export const SIDEBAR_MAX_WIDTH = 400
export const SIDEBAR_DEFAULT_WIDTH = 200

export const QUEUE_MIN_WIDTH = 240
export const QUEUE_MAX_WIDTH = 640
export const QUEUE_DEFAULT_WIDTH = 320
export const QUEUE_WIDE_DEFAULT_WIDTH = 384

const CALENDAR_MIN_WIDTH = 240

export function clampPaneWidth(
  width: number,
  minWidth: number,
  maxWidth: number,
): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)))
}

export function getSidebarMaxWidth(viewportWidth: number): number {
  if (viewportWidth < 768) return SIDEBAR_MAX_WIDTH

  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(
      SIDEBAR_MIN_WIDTH,
      viewportWidth - QUEUE_DEFAULT_WIDTH - CALENDAR_MIN_WIDTH,
    ),
  )
}

export function getQueueMaxWidth(viewportWidth: number): number {
  if (viewportWidth < 768) return QUEUE_MAX_WIDTH

  return Math.min(
    QUEUE_MAX_WIDTH,
    Math.max(
      QUEUE_MIN_WIDTH,
      viewportWidth - getSidebarMaxWidth(viewportWidth) - CALENDAR_MIN_WIDTH,
    ),
  )
}
