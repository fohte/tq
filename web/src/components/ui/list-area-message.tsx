import type { ReactNode } from 'react'

export function ListAreaMessage({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
