/** Preserve prose line locations for coverage; headings and fenced examples are not requirements. */
export function instructionLines(content: string): Array<{ line: number; text: string }> {
  const lines: Array<{ line: number; text: string }> = [];
  let fence: string | undefined;
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    const text = raw.trim();
    const marker = /^(?:`{3,}|~{3,})/.exec(text)?.[0];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence || !text || /^#{1,6}\s/.test(text) || /^[-*_]{3,}$/.test(text)) continue;
    lines.push({ line: index + 1, text });
  }
  return lines;
}
