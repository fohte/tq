import type { MouseEvent, ReactNode } from 'react'

import { getTqDesktopApi } from '#lib/tq-desktop'

const INTERACTIVE_CONTROL_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[tabindex]',
  '[data-slot="preview-card-trigger"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ')

function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
  const desktop = getTqDesktopApi()
  if (
    desktop == null ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  const target = event.target
  if (!(target instanceof Element)) return

  const link = target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return

  const control = target.closest(INTERACTIVE_CONTROL_SELECTOR)
  if (control != null && control !== link && link.contains(control)) return

  if (
    link.hasAttribute('download') ||
    (link.target !== '' && link.target.toLowerCase() !== '_self') ||
    link.origin !== window.location.origin
  ) {
    return
  }

  event.preventDefault()
  desktop.openInMainWindow(`${link.pathname}${link.search}${link.hash}`)
}

export function CompactLayoutFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="h-dvh w-full overflow-hidden"
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  )
}
