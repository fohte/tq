import { parseSearchQuery } from 'api/search-query-parser'

function splitSearchQueryTokens(query: string): string[] {
  const tokens: string[] = []
  let tokenStart = 0
  let quoteChar: string | undefined

  for (let index = 0; index < query.length; index++) {
    const character = query[index]
    if (quoteChar !== undefined) {
      if (character === '\\' && query[index + 1] === quoteChar) {
        index++
      } else if (character === quoteChar) {
        quoteChar = undefined
      }
      continue
    }

    if (character === '"' || character === "'") {
      quoteChar = character
    } else if (character === ' ' || character === '\t') {
      if (tokenStart < index) tokens.push(query.slice(tokenStart, index))
      tokenStart = index + 1
    }
  }

  if (tokenStart < query.length) tokens.push(query.slice(tokenStart))
  return tokens
}

export function removeSearchContextTokens(query: string): string {
  return splitSearchQueryTokens(query)
    .filter((token) => parseSearchQuery(token).context == null)
    .join(' ')
}
