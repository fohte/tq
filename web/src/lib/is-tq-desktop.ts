const TQ_DESKTOP_USER_AGENT_TOKEN = 'TQDesktop'

export function hasTqDesktopWindowControls(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes(TQ_DESKTOP_USER_AGENT_TOKEN)
  )
}
