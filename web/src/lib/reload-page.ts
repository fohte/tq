// A real browser's `location` object doesn't allow redefining any of its
// properties, including `reload`. Routing the call through this module lets
// tests replace it wholesale with `vi.mock()` instead.
export function reloadPage(): void {
  location.reload()
}
