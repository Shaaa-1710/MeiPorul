import * as pdfjsLib from 'pdfjs-dist';
import { DocumentChunk } from '../types/document';

// Configure pdfjs worker in browser environment
if (typeof window !== 'undefined') {
  try {
    // Vite bundles new URL(...) worker properly
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export interface ParsedDocumentResult {
  chunks: DocumentChunk[];
  fullText: string;
  description: string;
  totalPages: number;
}

/**
 * Robust text extractor for PDFs.
 * Iterates through every page, extracts all text items, reconstructs lines,
 * and preserves mathematical formulas, fractions, and symbols.
 */
async function extractTextFromPdf(buffer: ArrayBuffer, docId: string): Promise<ParsedDocumentResult> {
  const chunks: DocumentChunk[] = [];
  const fullTextParts: string[] = [];
  let totalPages = 1;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageLines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const item of textContent.items as any[]) {
        if (!('str' in item)) continue;
        const str = item.str;
        if (!str && !item.hasEOL) continue;

        // Group by vertical line position if transform is available
        const currentY = item.transform ? Math.round(item.transform[5]) : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
          if (currentLine.trim()) {
            pageLines.push(currentLine.trim());
          }
          currentLine = str;
        } else {
          currentLine += (currentLine.length > 0 && !currentLine.endsWith(' ') && !str.startsWith(' ') ? ' ' : '') + str;
        }

        if (item.hasEOL) {
          if (currentLine.trim()) {
            pageLines.push(currentLine.trim());
          }
          currentLine = '';
        }

        lastY = currentY;
      }

      if (currentLine.trim()) {
        pageLines.push(currentLine.trim());
      }

      const pageText = pageLines.join('\n').trim();
      if (pageText.length > 0) {
        fullTextParts.push(pageText);

        // Detect section title from first non-trivial line
        const candidateTitle = pageLines.find((l) => l.trim().length > 3 && l.trim().length < 80) || `Page ${pageNum}`;
        const cleanTitle = candidateTitle.replace(/[#*_]/g, '').trim();

        // If page is long, break into paragraph chunks; otherwise 1 chunk per page
        const paragraphs = pageText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

        if (paragraphs.length > 1 && pageText.length > 600) {
          paragraphs.forEach((para, pIdx) => {
            const trimmed = para.trim();
            chunks.push({
              chunk_id: `chk_${docId}_p${pageNum}_${pIdx + 1}`,
              page_number: pageNum,
              section_title: pIdx === 0 ? cleanTitle : `${cleanTitle} (Part ${pIdx + 1})`,
              token_count: Math.max(10, Math.round(trimmed.length / 4)),
              content: trimmed,
            });
          });
        } else {
          chunks.push({
            chunk_id: `chk_${docId}_p${pageNum}_1`,
            page_number: pageNum,
            section_title: cleanTitle,
            token_count: Math.max(15, Math.round(pageText.length / 4)),
            content: pageText,
          });
        }
      }
    }
  } catch (pdfErr) {
    console.warn('Primary pdfjs extraction failed, attempting fallback binary string parsing:', pdfErr);
    // Fallback: decode text strings from PDF binary stream
    const fallbackText = extractStringsFromPdfBinary(new Uint8Array(buffer));
    if (fallbackText.trim().length > 0) {
      fullTextParts.push(fallbackText);
      const paras = fallbackText.split(/\n\s*\n/).filter((p) => p.trim().length > 15);
      paras.forEach((para, idx) => {
        chunks.push({
          chunk_id: `chk_${docId}_raw_${idx + 1}`,
          page_number: Math.floor(idx / 3) + 1,
          section_title: `Extracted Section ${idx + 1}`,
          token_count: Math.round(para.length / 4),
          content: para.trim(),
        });
      });
    }
  }

  const fullText = fullTextParts.join('\n\n');
  const summarySnippet = fullText.slice(0, 150).replace(/\s+/g, ' ').trim();

  return {
    chunks,
    fullText,
    description: summarySnippet ? `${summarySnippet}...` : 'Indexed document content.',
    totalPages,
  };
}

/**
 * Fallback scanner that extracts ASCII & UTF-8 printable character sequences
 * from raw PDF byte streams in case pdfjs encounters unhandled encoding or worker failure.
 */
function extractStringsFromPdfBinary(bytes: Uint8Array): string {
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const raw = textDecoder.decode(bytes);
  const found: string[] = [];

  // Match text in parentheses (Tj operator format)
  const tjRegex = /\(([^()]{3,})\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(raw)) !== null) {
    const clean = match[1].replace(/\\([()\\])/g, '$1').trim();
    if (clean.length > 2 && !clean.startsWith('/')) {
      found.push(clean);
    }
  }

  // Also match bracketed text [ (str) 12 (str) ] TJ
  const bracketRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = bracketRegex.exec(raw)) !== null) {
    const inner = match[1];
    const subParts = inner.match(/\(([^()]+)\)/g);
    if (subParts) {
      const combined = subParts
        .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
        .join('');
      if (combined.trim().length > 2) {
        found.push(combined.trim());
      }
    }
  }

  // If Tj/TJ extraction found content, return it joined
  if (found.length > 5) {
    return found.join(' ');
  }

  // Last resort: extract printable lines
  const lines = raw.split(/[\r\n]+/);
  const printableLines = lines.filter((l) => {
    const trimmed = l.trim();
    return (
      trimmed.length > 20 &&
      !trimmed.startsWith('%') &&
      !trimmed.startsWith('<<') &&
      !trimmed.startsWith('obj') &&
      !trimmed.startsWith('endobj') &&
      !trimmed.includes('/Filter') &&
      !trimmed.includes('/Length') &&
      /^[a-zA-Z0-9\s.,;:()=+'"/\-–—*×∩∪]+$/.test(trimmed)
    );
  });

  return printableLines.slice(0, 50).join('\n');
}

/**
 * Universal document parser supporting PDF, TXT, CSV, MD, JSON, etc.
 */
export async function parseUploadedDocument(file: File, docId: string): Promise<ParsedDocumentResult> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    return await extractTextFromPdf(arrayBuffer, docId);
  }

  // Text-based files
  let rawText = '';
  try {
    rawText = await file.text();
  } catch (err) {
    console.error('Failed to read file as text:', err);
    rawText = '';
  }

  const chunks: DocumentChunk[] = [];
  const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0 && rawText.trim().length > 0) {
    paragraphs.push(rawText.trim());
  }

  paragraphs.forEach((para, idx) => {
    const trimmed = para.trim();
    chunks.push({
      chunk_id: `chk_${docId}_${idx + 1}`,
      page_number: Math.floor(idx / 3) + 1,
      section_title: `Section ${idx + 1}`,
      token_count: Math.max(10, Math.round(trimmed.length / 4)),
      content: trimmed,
    });
  });

  return {
    chunks,
    fullText: rawText,
    description: rawText.slice(0, 150).replace(/\s+/g, ' ').trim() || 'Uploaded text document.',
    totalPages: Math.max(1, Math.ceil(paragraphs.length / 3)),
  };
}
