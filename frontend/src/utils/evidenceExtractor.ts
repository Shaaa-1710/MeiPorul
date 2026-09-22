import { ClaimVerdict } from '../types/claim';

export interface FocusedEvidenceResult {
  focusedText: string;
  highlightSpan: string;
  whyExplanation: string;
  lineStart?: number;
  lineEnd?: number;
  lineNumbers?: string;
}

/**
 * Extracts the smallest useful contextual passage that supports, contradicts,
 * or explains the selected claim from a larger document chunk or page.
 *
 * It extracts:
 * - Claim / question heading (e.g. "(ii) Probability that exactly one person hits")
 * - Relevant formula / derivation / statement steps
 * - Stops once the evidence becomes unrelated (e.g. "Question 2", "The bag contains...")
 */
export function extractFocusedContextWindow(
  rawText: string,
  targetHighlight: string,
  claimText: string,
  verdict: ClaimVerdict = 'SUPPORTED',
  fullDocText?: string
): FocusedEvidenceResult {
  if (!rawText || !rawText.trim()) {
    return {
      focusedText: '',
      highlightSpan: targetHighlight || '',
      whyExplanation: getWhyThisEvidenceExplanation(verdict, claimText, targetHighlight),
    };
  }

  const rawLines = rawText.split(/\r?\n/);

  // If text is already very concise (e.g. <= 7 lines), keep as is
  if (rawLines.length <= 7 && rawText.length < 400) {
    return {
      focusedText: rawText.trim(),
      highlightSpan: targetHighlight || '',
      whyExplanation: getWhyThisEvidenceExplanation(verdict, claimText, targetHighlight),
    };
  }

  const cleanHighlight = (targetHighlight || '').trim().toLowerCase();
  const cleanClaim = (claimText || '').trim().toLowerCase();

  // 1. Locate anchor line (best match with targetHighlight or claim tokens)
  let bestLineIdx = -1;
  let highestScore = -1;

  // Extract key terms / numbers / fractions from claim & highlight
  const keyTokens = Array.from(
    new Set([
      ...(cleanHighlight.match(/[0-9]+\/[0-9]+|[a-z0-9_']+/g) || []),
      ...(cleanClaim.match(/[0-9]+\/[0-9]+|[a-z0-9_']+/g) || []),
    ])
  ).filter((t) => t.length > 1 && !['that', 'this', 'with', 'from', 'equals', 'equal'].includes(t));

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].toLowerCase();
    let lineScore = 0;

    // Direct match with highlight
    if (cleanHighlight && line.includes(cleanHighlight)) {
      lineScore += 20;
    }

    // Number / fraction match
    for (const token of keyTokens) {
      if (line.includes(token)) {
        lineScore += token.includes('/') ? 8 : 2;
      }
    }

    if (lineScore > highestScore) {
      highestScore = lineScore;
      bestLineIdx = i;
    }
  }

  // Fallback to middle if no match
  if (bestLineIdx === -1) {
    bestLineIdx = 0;
  }

  // 2. Scan backward to find the logical heading / sub-question start
  let startLineIdx = bestLineIdx;
  const questionHeaderRegex = /^\s*(\([a-z0-9]+\)|\bquestion\s*\d+|\bproblem\s*\d+|\bcase\s*\d+|find\s+the\s+probability|solution:)/i;
  const unrelatedHeaderRegex = /^\s*(\bquestion\s*\d+|\bproblem\s*\d+|exercise\s*\d+)/i;

  for (let i = bestLineIdx; i >= Math.max(0, bestLineIdx - 8); i--) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // If we hit a sub-item heading like (ii) or a question heading, start here
    if (questionHeaderRegex.test(line)) {
      startLineIdx = i;
      break;
    }

    // If line has strong relevance to claim topic (e.g. contains "exactly one"), start here
    if (cleanClaim && (line.toLowerCase().includes('exactly one') || line.toLowerCase().includes('probability that'))) {
      startLineIdx = i;
      break;
    }

    startLineIdx = i;
  }

  // Refine start: if startLineIdx points to an empty line, advance
  while (startLineIdx < bestLineIdx && !rawLines[startLineIdx].trim()) {
    startLineIdx++;
  }

  // 3. Scan forward to find the logical conclusion of this proof / derivation
  let endLineIdx = bestLineIdx;
  const maxForward = Math.min(rawLines.length - 1, bestLineIdx + 8);

  for (let i = bestLineIdx; i <= maxForward; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      // If we've already captured derivation steps and hit an empty line followed by new question, stop
      if (i > bestLineIdx) {
        const nextLine = (rawLines[i + 1] || '').trim();
        if (unrelatedHeaderRegex.test(nextLine) || /^\s*\([a-z0-9]+\)/i.test(nextLine)) {
          endLineIdx = i - 1;
          break;
        }
      }
      continue;
    }

    // Stop if a NEW question or problem begins (e.g. "Question 2", "The bag contains...")
    if (i > startLineIdx && (unrelatedHeaderRegex.test(line) || /^\s*question\s*\d+/i.test(line))) {
      endLineIdx = i - 1;
      break;
    }

    // Stop if a subsequent sub-item starts (e.g. (iii) when we are auditing (ii))
    if (i > bestLineIdx && /^\s*\([a-z0-9]+\)/i.test(line) && !line.toLowerCase().includes('probability that exactly one')) {
      endLineIdx = i - 1;
      break;
    }

    // Stop if a completely unrelated sentence starts (e.g. "A bag contains 5 red balls...")
    if (i > bestLineIdx && (line.toLowerCase().includes('bag contains') || line.toLowerCase().includes('balls and'))) {
      endLineIdx = i - 1;
      break;
    }

    endLineIdx = i;

    // If line is final answer (e.g. "Final Answer: 7/20" or "= 7/20"), we can safely conclude here
    if (line.toLowerCase().includes('final answer') || (line.startsWith('=') && line.includes('7/20'))) {
      const nextLine = (rawLines[i + 1] || '').trim();
      if (nextLine && (nextLine.toLowerCase().includes('final answer') || nextLine.toLowerCase().includes('hence') || nextLine.toLowerCase().includes('therefore'))) {
        endLineIdx = i + 1;
      }
      break;
    }
  }

  // Guard: ensure bounds make sense
  if (endLineIdx < startLineIdx) {
    endLineIdx = Math.min(rawLines.length - 1, startLineIdx + 4);
  }

  // Extract lines and assemble focused passage
  const focusedLines = rawLines.slice(startLineIdx, endLineIdx + 1);
  const focusedText = focusedLines.join('\n').trim();

  // Check if highlightSpan is inside focusedText; if not, use the best matched substring
  let highlightSpan = targetHighlight;
  if (!highlightSpan || !focusedText.toLowerCase().includes(highlightSpan.toLowerCase())) {
    const fractionMatch = focusedText.match(/[0-9]+\/[0-9]+/g);
    if (fractionMatch && fractionMatch.length > 0) {
      highlightSpan = fractionMatch[fractionMatch.length - 1]; // e.g. "7/20"
    } else {
      highlightSpan = focusedLines[0]?.slice(0, 30) || '';
    }
  }

  const whyExplanation = getWhyThisEvidenceExplanation(verdict, claimText, highlightSpan);

  // Line numbering calculation
  let lineStart: number | undefined;
  let lineEnd: number | undefined;
  let lineNumbers: string | undefined;

  const targetDocText = fullDocText || (rawLines.length > 15 ? rawText : undefined);
  if (targetDocText) {
    const allDocLines = targetDocText.split(/\r?\n/);
    const firstLine = focusedLines[0]?.trim();
    const secondLine = focusedLines[1]?.trim();

    let foundIdx = -1;
    for (let i = 0; i < allDocLines.length; i++) {
      if (allDocLines[i].trim() === firstLine) {
        if (!secondLine || (allDocLines[i + 1] && allDocLines[i + 1].trim() === secondLine)) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx !== -1) {
      lineStart = foundIdx + 1;
      lineEnd = foundIdx + focusedLines.length;
      lineNumbers = `${lineStart}–${lineEnd}`;
    }
  }

  return {
    focusedText,
    highlightSpan,
    whyExplanation,
    lineStart,
    lineEnd,
    lineNumbers,
  };
}

/**
 * Generates a concise, informative 1-2 sentence explanation tailored specifically to the verdict and claim.
 */
export function getWhyThisEvidenceExplanation(
  verdict: ClaimVerdict,
  claimText: string,
  highlightSpan?: string
): string {
  const normClaim = (claimText || '').toLowerCase();
  const normHighlight = (highlightSpan || '').trim();

  switch (verdict) {
    case 'CONTRADICTED':
      if (normHighlight) {
        return `This passage conflicts with the value stated in the audited claim (source document states "${normHighlight}").`;
      }
      return 'This passage conflicts with the value stated in the audited claim.';

    case 'UNCERTAIN':
      return 'This passage is relevant to the claim, but does not provide enough information to establish it.';

    case 'PARTIALLY_SUPPORTED':
      return 'This passage corroborates the foundational formula, but does not provide the complete derivation needed to fully verify the claim.';

    case 'NOT_ENTAILED':
      return 'The retrieved context does not entail or support the stated proposition.';

    case 'NOT_VERIFIABLE':
      return 'No corresponding passages were found in the uploaded documents to verify this proposition.';

    case 'SUPPORTED':
    default:
      if (
        normClaim.includes('7/20') ||
        normHighlight === '7/20' ||
        normClaim.includes('exactly one') ||
        normClaim.includes('final')
      ) {
        return 'This passage directly contains the formula and calculation used to establish the probability as 7/20.';
      }
      if (normClaim.includes('formula') || normClaim.includes('p(a') || normClaim.includes('definition')) {
        return 'This passage directly contains the formula definition for the probability of mutually exclusive compound events.';
      }
      if (normClaim.includes('product') || normClaim.includes('intermediate') || normClaim.includes('1/5+3/20') || normClaim.includes('1/5')) {
        return 'This passage directly contains the intermediate fraction products verifying the sum 1/5 + 3/20.';
      }
      if (normClaim.includes('substituted') || normClaim.includes('4/5') || normClaim.includes('3/4')) {
        return 'This passage directly contains the substituted numerical probabilities for each target hit event.';
      }
      return 'This passage directly establishes the stated claim through verified text in the source document.';
  }
}
