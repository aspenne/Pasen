const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/**
 * Data Dragon's rune and item descriptions as plain text.
 *
 * They are written for the client's own renderer: `<br>` for line breaks and a
 * zoo of custom tags (`<stats>`, `<passive>`, `<lol-uikit-tooltipped-keyword>`)
 * around the words. A tooltip wants the words and the breaks, nothing else, so
 * the breaks become newlines and every tag goes. The quoted lore line at the
 * end of a rune says nothing about what it does, and it is dropped too.
 */
export function ddragonText(html: string | null | undefined): string | null {
  if (!html) return null

  const text = html
    .replace(/<i>\s*['"‘“][\s\S]*?<\/i>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || null
}
