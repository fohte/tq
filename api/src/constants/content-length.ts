// Every field capped here is re-parsed synchronously through the
// milkdown/remark markdown parser on each write (see #services/task-links),
// so an uncapped length is a CPU-blocking DoS vector. 100k chars is an
// order of magnitude below where parse time becomes noticeable.
export const MAX_MARKDOWN_CONTENT_LENGTH = 100_000

// HTML task pages are excluded from the remark re-parse (see
// #services/task-links), so this cap only needs to bound document size, not
// parse time.
export const MAX_HTML_CONTENT_LENGTH = 1_000_000
