// Pure constants module (no db side-effect imports) so the web package can
// import it without pulling in server-only dependencies.

// Requires a non-word, non-`#` character (or string start) before the `#` and
// forbids a trailing word character, so `#123` matches but `foo#123`,
// `##123`, and `#123abc` don't.
export const MENTION_PATTERN = /(?<![\w#])#(\d+)(?!\w)/g
