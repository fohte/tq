const TQ_DESKTOP_USER_AGENT_TOKEN = 'TQDesktop'

export function hasTqDesktopUserAgent(userAgent: string): boolean {
  return userAgent.includes(TQ_DESKTOP_USER_AGENT_TOKEN)
}

export function hasTqDesktopWindowControls(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    hasTqDesktopUserAgent(navigator.userAgent)
  )
}
