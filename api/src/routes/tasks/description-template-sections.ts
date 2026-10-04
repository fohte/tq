export type DescriptionSection = { heading: string; content: string[] }

export function parseDescriptionTemplateSections(
  markdown: string,
): DescriptionSection[] {
  const sections: DescriptionSection[] = []
  let current: DescriptionSection | undefined
  let codeFence: { marker: string; length: number } | undefined

  for (const line of markdown.split(/\r?\n/)) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    const fenceText = fence?.[1]
    const fenceMarker = fenceText?.[0]

    if (codeFence !== undefined) {
      if (
        fenceText !== undefined &&
        fenceMarker === codeFence.marker &&
        fenceText.length >= codeFence.length
      ) {
        codeFence = undefined
        continue
      }
      current?.content.push(line)
      continue
    }
    if (fenceText !== undefined && fenceMarker !== undefined) {
      codeFence = { marker: fenceMarker, length: fenceText.length }
      continue
    }

    const match = line.match(/^\s{0,3}##[ \t]+(.+?)\s*$/)
    if (match?.[1] === undefined) {
      current?.content.push(line)
      continue
    }

    current = {
      heading: match[1].replace(/[ \t]+#+$/, '').trim(),
      content: [],
    }
    sections.push(current)
  }

  return sections
}

export function descriptionTemplateHeadings(markdown: string): string[] {
  return parseDescriptionTemplateSections(markdown).map(
    ({ heading }) => `## ${heading}`,
  )
}
