interface SideWindowTitleTarget {
  setTitle(title: string): void
  on(
    event: 'page-title-updated',
    listener: (event: { preventDefault: () => void }) => void,
  ): unknown
}

export const setSideWindowTitle = (win: SideWindowTitleTarget) => {
  win.setTitle('tq (Side Window)')
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })
}
