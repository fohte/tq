import type { ReactNode } from 'react'

import { ModalPanel } from '#components/ui/modal-panel'

function DesktopModalFrame({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
      <ModalPanel>{children}</ModalPanel>
    </div>
  )
}

export { DesktopModalFrame }
