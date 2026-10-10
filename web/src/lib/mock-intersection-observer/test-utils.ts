import { vi } from 'vitest'

// Pagination hooks only read isIntersecting, so tests do not need layout geometry.
export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  private readonly callback: (entries: { isIntersecting: boolean }[]) => void
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()

  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }])
  }
}
