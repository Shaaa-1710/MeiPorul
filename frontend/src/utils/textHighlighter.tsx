import React from 'react';

interface HighlightOptions {
  highlightClass?: string;
  verdictType?: 'SUPPORTED' | 'CONTRADICTED' | 'PARTIALLY_SUPPORTED' | 'UNCERTAIN' | 'NOT_ENTAILED' | 'NOT_VERIFIABLE';
}

/**
 * Safely renders text with highlighted substrings for evidence matching.
 * Supports exact string matching as well as normalized math/operator symbols (* vs ×, flexible whitespace).
 */
export function renderHighlightedEvidence(
  text: string,
  highlight: string | undefined,
  options: HighlightOptions = {}
): React.ReactNode {
  if (!text) return null;
  if (!highlight || !highlight.trim()) {
    return <span>{text}</span>;
  }

  const cleanHighlight = highlight.trim();
  const escaped = cleanHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let regex = new RegExp(`(${escaped})`, 'gi');
  let parts = text.split(regex);

  // If exact regex didn't split, try flexible operator variations (* vs ×, spaces around math symbols)
  if (parts.length <= 1) {
    try {
      const flexible = escaped
        .replace(/\\\*/g, '[*×·]')
        .replace(/×/g, '[*×·]')
        .replace(/\\([=+\-∩/])/g, '\\s*\\$1\\s*');
      const flexRegex = new RegExp(`(${flexible})`, 'gi');
      const flexParts = text.split(flexRegex);
      if (flexParts.length > 1) {
        parts = flexParts;
      }
    } catch {
      // Keep original parts
    }
  }

  if (parts.length <= 1) {
    return <span>{text}</span>;
  }

  const isContradicted = options.verdictType === 'CONTRADICTED';
  const isUncertain = options.verdictType === 'UNCERTAIN' || options.verdictType === 'PARTIALLY_SUPPORTED';

  const defaultHighlightClass = isContradicted
    ? 'bg-rose-100 text-rose-950 border-b-2 border-rose-500 font-semibold px-1 rounded-xs'
    : isUncertain
    ? 'bg-amber-100 text-amber-950 border-b-2 border-amber-500 font-semibold px-1 rounded-xs'
    : 'bg-emerald-100 text-emerald-950 border-b-2 border-emerald-600 font-semibold px-1 rounded-xs';

  const badgeClass = options.highlightClass || defaultHighlightClass;

  return (
    <span>
      {parts.map((part, index) => {
        // Capturing group in split() always lands on odd indices (1, 3, 5...)
        if (index % 2 === 1) {
          return (
            <mark key={index} className={badgeClass}>
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
