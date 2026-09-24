const MODE_BY_PREFIX = {
  '#': 'tasks',
  '!': 'projects',
  '/': 'pages',
  '>': 'commands',
} as const

export function parseSearchMode(query: string) {
  const prefix = query[0]
  if (prefix === '#' || prefix === '!' || prefix === '/' || prefix === '>') {
    return {
      mode: MODE_BY_PREFIX[prefix],
      prefix,
      text: query.slice(1).trimStart(),
    }
  }

  return { mode: undefined, prefix: undefined, text: query }
}
