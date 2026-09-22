import React, { useState, useEffect } from 'react';
import { Claim } from '../../types/claim';
import { Evidence } from '../../types/evidence';
import { renderHighlightedEvidence } from '../../utils/textHighlighter';
import { extractFocusedContextWindow } from '../../utils/evidenceExtractor';
import { useChat } from '../../context/ChatContext';
import {
  X,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface EvidencePopoverProps {
  claims: Claim[];
  isOpen: boolean;
  onClose: () => void;
  initialClaimId?: string;
}

export const EvidencePopover: React.FC<EvidencePopoverProps> = ({
  claims,
  isOpen,
  onClose,
  initialClaimId,
}) => {
  const { openEvidenceViewer, selectClaim } = useChat();

  const displayClaims = claims.length > 0 ? claims : [];

  // Initialize selected claim index based on initialClaimId or first claim
  const [selectedClaimIndex, setSelectedClaimIndex] = useState<number>(() => {
    if (initialClaimId && displayClaims.length > 0) {
      const idx = displayClaims.findIndex((c) => c.claim_id === initialClaimId);
      if (idx !== -1) return idx;
    }
    return 0;
  });

  // Keep in sync if initialClaimId prop changes
  useEffect(() => {
    if (initialClaimId && displayClaims.length > 0) {
      const idx = displayClaims.findIndex((c) => c.claim_id === initialClaimId);
      if (idx !== -1) {
        setSelectedClaimIndex(idx);
      }
    }
  }, [initialClaimId, displayClaims]);

  if (!isOpen || displayClaims.length === 0) return null;

  const currentClaim = displayClaims[selectedClaimIndex] || displayClaims[0];
  const primaryEvidence: Evidence | undefined =
    currentClaim.evidence && currentClaim.evidence.length > 0
      ? currentClaim.evidence[0]
      : undefined;

  const handlePrevClaim = () => {
    if (selectedClaimIndex > 0) {
      const newIdx = selectedClaimIndex - 1;
      setSelectedClaimIndex(newIdx);
      selectClaim(displayClaims[newIdx]);
    }
  };

  const handleNextClaim = () => {
    if (selectedClaimIndex < displayClaims.length - 1) {
      const newIdx = selectedClaimIndex + 1;
      setSelectedClaimIndex(newIdx);
      selectClaim(displayClaims[newIdx]);
    }
  };

  const handleOpenDocument = () => {
    if (primaryEvidence) {
      openEvidenceViewer(primaryEvidence);
      onClose();
    }
  };

  // Dynamically extract the smallest useful context window for the selected claim
  const rawEvidenceText = primaryEvidence?.text || '';
  const initialHighlight = primaryEvidence?.highlight || '';
  const focusedResult = extractFocusedContextWindow(
    rawEvidenceText,
    initialHighlight,
    currentClaim.text,
    currentClaim.verdict,
    primaryEvidence?.full_text
  );

  const displayEvidenceText = focusedResult.focusedText || rawEvidenceText;
  const displayHighlight = focusedResult.highlightSpan || initialHighlight;
  const whyExplanation = primaryEvidence?.why_explanation || focusedResult.whyExplanation;

  // Format line information strictly from real data without inventing numbers
  const formatLineInfo = () => {
    if (primaryEvidence?.lineStart && primaryEvidence?.lineEnd) {
      return `Page ${primaryEvidence.page} · Lines ${primaryEvidence.lineStart}–${primaryEvidence.lineEnd}`;
    }
    if (primaryEvidence?.line_numbers) {
      return `Page ${primaryEvidence.page} · Lines ${primaryEvidence.line_numbers}`;
    }
    if (focusedResult.lineNumbers) {
      return `Page ${primaryEvidence?.page || 1} · Lines ${focusedResult.lineNumbers}`;
    }
    return `Page ${primaryEvidence?.page || 1} · Relevant passage`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-gray-300 w-full max-w-xl flex flex-col overflow-hidden text-left font-sans">
        {/* Header: Evidence (1 of 5) [ < ] [ > ] [ × ] */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 tracking-tight">
              Evidence
            </h3>
            {displayClaims.length > 1 && (
              <span className="text-xs text-gray-500 font-normal">
                ({selectedClaimIndex + 1} of {displayClaims.length})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {displayClaims.length > 1 && (
              <div className="flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5 bg-gray-50">
                <button
                  type="button"
                  onClick={handlePrevClaim}
                  disabled={selectedClaimIndex <= 0}
                  className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous proposition evidence"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextClaim}
                  disabled={selectedClaimIndex >= displayClaims.length - 1}
                  className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next proposition evidence"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close evidence"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto max-h-[75vh] divide-y divide-gray-100">
          {/* 1. AUDITED CLAIM */}
          <div className="px-6 py-4 bg-gray-50/60">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Audited Claim
            </span>
            <p className="text-[15px] font-medium text-gray-900 leading-relaxed font-sans">
              "{currentClaim.text}"
            </p>
          </div>

          {primaryEvidence ? (
            <>
              {/* 2. SOURCE INFORMATION */}
              <div className="px-6 py-4 bg-white space-y-1.5">
                <div className="flex items-center gap-2 text-base font-semibold text-gray-900 tracking-tight">
                  <FileText className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>{primaryEvidence.document_name}</span>
                </div>
                <div className="text-xs sm:text-[13px] text-gray-700 pl-6 space-y-0.5 font-sans">
                  <div className="font-medium text-gray-800">
                    {formatLineInfo()}
                  </div>
                  {primaryEvidence.section && (
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                      {primaryEvidence.section}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. RELEVANT EVIDENCE */}
              <div className="px-6 py-4 bg-white space-y-2.5">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                  Relevant Evidence
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 sm:p-5 text-[15px] sm:text-[16px] text-gray-900 leading-[1.65] font-sans whitespace-pre-wrap select-text shadow-2xs">
                  {renderHighlightedEvidence(displayEvidenceText, displayHighlight, {
                    verdictType: currentClaim.verdict,
                  })}
                </div>
              </div>

              {/* 4. WHY THIS EVIDENCE? */}
              <div className="px-6 py-4 bg-white space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                  Why this evidence?
                </span>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-sans">
                  {whyExplanation}
                </p>
              </div>

              {/* 5. SOURCE & OPEN DOCUMENT ACTION */}
              <div className="px-6 py-3.5 bg-gray-50/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                    Source
                  </span>
                  <p className="text-xs text-gray-700 font-medium mt-0.5 font-sans">
                    {primaryEvidence.document_name} · Page {primaryEvidence.page}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenDocument}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 hover:border-gray-300 text-xs font-medium text-gray-700 transition-colors cursor-pointer shadow-2xs"
                  title="Open full document page"
                >
                  <span>Open Document</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-gray-500 text-xs space-y-1">
              <p className="font-medium text-gray-800 text-sm">No retrieved evidence passage found.</p>
              <p className="text-gray-500">
                The proposition could not be bound to an indexed passage in the uploaded documents.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
