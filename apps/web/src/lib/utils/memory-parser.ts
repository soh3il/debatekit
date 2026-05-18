type MemoryEntry = {
  id: number;
  section: string | null;
  text: string;
  raw: string;
};

const PLACEHOLDER_PATTERNS = [
  /^\[.*goes here.*\]$/i,
  /^\[.*important.*information.*\]$/i,
];

function isPlaceholder(line: string) {
  return PLACEHOLDER_PATTERNS.some(p => p.test(line.trim()));
}

function parseMemoryEntries(content: string): MemoryEntry[] {
  const lines = content.split('\n');
  const entries: MemoryEntry[] = [];
  let currentSection: string | null = null;
  let id = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Skip top-level heading (# Working Memory, etc.)
    if (/^#\s+/.test(trimmed) && !/^##\s+/.test(trimmed)) {
      continue;
    }

    // Track section headers
    if (/^##\s+/.test(trimmed)) {
      currentSection = trimmed.replace(/^##\s+/, '');
      continue;
    }

    // Skip placeholder lines
    if (isPlaceholder(trimmed)) {
      continue;
    }

    // Clean leading "- " for display text
    const text = trimmed.replace(/^[-*]\s+/, '');

    entries.push({
      id,
      raw: line,
      section: currentSection,
      text,
    });
    id++;
  }

  return entries;
}

function removeMemoryEntry(content: string, entryId: number): string | null {
  const entries = parseMemoryEntries(content);
  const remaining = entries.filter(e => e.id !== entryId);

  if (remaining.length === 0) {
    return null;
  }

  // Reconstruct grouped by section
  const sections = new Map<string | null, MemoryEntry[]>();
  for (const entry of remaining) {
    const group = sections.get(entry.section) ?? [];
    group.push(entry);
    sections.set(entry.section, group);
  }

  const lines: string[] = ['# Working Memory', ''];

  for (const [section, sectionEntries] of sections) {
    if (section) {
      lines.push(`## ${section}`, '');
    }
    for (const entry of sectionEntries) {
      lines.push(entry.raw);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export type { MemoryEntry };
export { parseMemoryEntries, removeMemoryEntry };
