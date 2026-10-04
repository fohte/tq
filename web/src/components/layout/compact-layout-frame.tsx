import type { ReactNode } from 'react'

export function CompactLayoutFrame({ children }: { children: ReactNode }) {
  return <div className="h-dvh w-full overflow-hidden">{children}</div>
}
