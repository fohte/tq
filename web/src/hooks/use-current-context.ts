import { useSessionOpenSettings } from '#hooks/use-session-open-settings'

// The context is a per-machine setting, not a per-session choice — see
// `SessionOpenSettings.localContext` (`web/src/lib/session-open.ts`), which
// this hook promotes to the app-wide current context.
export function useCurrentContext(): 'work' | 'personal' {
  const [settings] = useSessionOpenSettings()
  return settings.localContext
}
