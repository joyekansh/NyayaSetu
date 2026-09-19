const FILLER_PATTERNS = [
  /\bhello(?:\s+guys)?\b/gi,
  /\bmic(?:rophone)?\s+check\b/gi,
  /\bmike\s+check\b/gi,
];

export function cleanSpeechTranscript(input: string): string {
  let text = input
    .replace(/\s+/g, ' ')
    .trim();

  for (const pattern of FILLER_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  text = collapseRepeatedWords(text);
  text = collapseRepeatedPhrases(text);
  text = collapseOverlappingPrefixes(text);
  text = keepLongestRepeatedClause(text);
  text = text.replace(/\s+/g, ' ').trim();

  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

export function appendCleanTranscript(existing: string, next: string): string {
  const cleaned = cleanSpeechTranscript(next);
  if (!cleaned) return existing.trim();
  const base = existing.trim();
  if (!base) return cleaned;
  if (base.toLowerCase().endsWith(cleaned.toLowerCase())) return base;
  return `${base} ${cleaned}`.trim();
}

function collapseRepeatedWords(input: string): string {
  const words = input.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  for (const word of words) {
    const previous = output.at(-1);
    if (previous && normalize(previous) === normalize(word)) continue;
    output.push(word);
  }
  return output.join(' ');
}

function collapseRepeatedPhrases(input: string): string {
  const words = input.split(/\s+/).filter(Boolean);
  for (let size = 6; size >= 2; size -= 1) {
    let i = 0;
    const output: string[] = [];
    while (i < words.length) {
      const phrase = words.slice(i, i + size).map(normalize).join(' ');
      const next = words.slice(i + size, i + size * 2).map(normalize).join(' ');
      output.push(...words.slice(i, i + size));
      i += size;
      while (phrase && phrase === next) {
        i += size;
      }
    }
    words.splice(0, words.length, ...output);
  }
  return words.join(' ');
}

function collapseOverlappingPrefixes(input: string): string {
  const words = input.split(/\s+/).filter(Boolean);
  let changed = true;
  while (changed) {
    changed = false;
    for (let start = 0; start < words.length; start += 1) {
      for (let size = Math.min(8, words.length - start); size >= 2; size -= 1) {
        const phrase = words.slice(start, start + size).map(normalize).join(' ');
        const nextStart = start + size;
        const next = words.slice(nextStart, nextStart + size).map(normalize).join(' ');
        if (phrase && phrase === next) {
          words.splice(nextStart, size);
          changed = true;
          break;
        }
        for (let overlap = size - 1; overlap >= 2; overlap -= 1) {
          const suffix = words.slice(start + size - overlap, start + size).map(normalize).join(' ');
          const prefix = words.slice(nextStart, nextStart + overlap).map(normalize).join(' ');
          if (suffix && suffix === prefix) {
            words.splice(nextStart, overlap);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      if (changed) break;
    }
  }
  return words.join(' ');
}

function keepLongestRepeatedClause(input: string): string {
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length < 12) return input;
  for (let size = Math.min(12, Math.floor(words.length / 2)); size >= 5; size -= 1) {
    for (let start = 0; start + size * 2 <= words.length; start += 1) {
      const phrase = words.slice(start, start + size).map(normalize).join(' ');
      const nextWindow = words.slice(start + size).map(normalize).join(' ');
      const repeatIndex = nextWindow.indexOf(phrase);
      if (phrase && repeatIndex >= 0) {
        const repeatWordOffset = nextWindow.slice(0, repeatIndex).split(/\s+/).filter(Boolean).length;
        const repeatStart = start + size + repeatWordOffset;
        return [
          ...words.slice(0, repeatStart),
          ...words.slice(repeatStart + size),
        ].join(' ');
      }
    }
  }
  return input;
}

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}
