import React, { useState } from 'react';
import {
  FileText,
  Scissors,
  Download,
  CheckCircle2,
  AlertCircle,
  Archive,
  Layers,
  Sparkles,
} from 'lucide-react';
import { HistoryEntry } from '../types/index.js';
import { formatBytes } from '../utils/formatters.js';
import { Dropzone } from './Dropzone.js';

interface PdfSplitterProps {
  onRecordHistory: (entry: HistoryEntry) => void;
  onLoadSample: (type: 'image' | 'pdf') => void;
  onErrorToast: (msg: string) => void;
}

export const PdfSplitter: React.FC<PdfSplitterProps> = ({
  onRecordHistory,
  onLoadSample,
  onErrorToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitMode, setSplitMode] = useState<'range' | 'single' | 'all'>('range');
  const [rangeInput, setRangeInput] = useState('1-2');
  const [singlePageInput, setSinglePageInput] = useState('1');

  const [splitResult, setSplitResult] = useState<{
    downloadUrl: string;
    fileName: string;
    pageCount: number;
    isZip: boolean;
    extractedFileCount: number;
    processedBytes: number;
  } | null>(null);

  // File chosen
  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (!pdfFile) {
      onErrorToast('Please select a valid PDF file.');
      return;
    }

    if (pdfFile.size > 50 * 1024 * 1024) {
      onErrorToast('File exceeds 50MB limit.');
      return;
    }

    setSelectedFile(pdfFile);
    setSplitResult(null);
    setIsInspecting(true);

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      const res = await fetch('/api/pdf/info', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to read PDF document.');
      }

      setPageCount(data.pageCount);
      // Set reasonable default range
      if (data.pageCount >= 2) {
        setRangeInput(`1-${Math.min(data.pageCount, 2)}`);
      } else {
        setRangeInput('1');
      }
      setSinglePageInput('1');
    } catch (err: any) {
      onErrorToast(err.message || 'Failed to inspect PDF.');
      setSelectedFile(null);
      setPageCount(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSplit = async () => {
    if (!selectedFile || !pageCount) return;

    let finalRanges = '';
    if (splitMode === 'range') {
      finalRanges = rangeInput.trim();
    } else if (splitMode === 'single') {
      finalRanges = singlePageInput.trim();
    } else {
      finalRanges = 'all';
    }

    if (!finalRanges) {
      onErrorToast('Please specify a valid page range.');
      return;
    }

    setIsSplitting(true);
    setSplitResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('ranges', finalRanges);

      const response = await fetch('/api/pdf/split', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to split PDF file.');
      }

      setSplitResult({
        downloadUrl: data.downloadUrl,
        fileName: data.fileName,
        pageCount: data.pageCount,
        isZip: data.isZip,
        extractedFileCount: data.extractedFileCount,
        processedBytes: data.processedBytes,
      });

      // Record to history
      onRecordHistory({
        id: data.fileId,
        originalName: selectedFile.name,
        fileName: data.fileName,
        sizeBytes: data.processedBytes,
        originalBytes: selectedFile.size,
        savingsPercent: data.savingsPercent,
        operation: `PDF Split (${finalRanges})`,
        createdAt: Date.now(),
        downloadUrl: data.downloadUrl,
      });
    } catch (err: any) {
      onErrorToast(err.message || 'Failed to split PDF.');
    } finally {
      setIsSplitting(false);
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setPageCount(null);
    setSplitResult(null);
  };

  return (
    <div className="space-y-6">
      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFiles}
          isPdfOnly={true}
          acceptedFormatsText="PDF (.pdf)"
          onLoadSample={onLoadSample}
        />
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
          {/* Active File Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono tabular-nums">{formatBytes(selectedFile.size)}</span>
                  <span aria-hidden="true">·</span>
                  {isInspecting ? (
                    <span className="text-sky-400 animate-pulse">Inspecting page count...</span>
                  ) : pageCount ? (
                    <span className="font-mono font-medium text-slate-300 tabular-nums">
                      {pageCount} total page{pageCount > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetSelection}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors whitespace-nowrap self-start sm:self-center"
            >
              Choose Different PDF
            </button>
          </div>

          {/* Split Mode Selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Extraction Method
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSplitMode('range')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  splitMode === 'range'
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-semibold text-white mb-1">Custom Range</div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Extract specific ranges like 1-3, 5, or 8-10.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode('single')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  splitMode === 'single'
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-semibold text-white mb-1">Single Page</div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Extract one exact page as a new PDF.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode('all')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  splitMode === 'all'
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-semibold text-white mb-1">Split All Pages</div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Extract every page into individual PDFs (.ZIP).
                </div>
              </button>
            </div>
          </div>

          {/* Mode-Specific Input */}
          {splitMode === 'range' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">
                  Page Range Specification
                </label>
                {pageCount && (
                  <span className="text-slate-400 font-mono text-[11px]">
                    Valid: 1 to {pageCount}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="e.g. 1-2, 4, 6-8"
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Tip: Enter discrete ranges (e.g., <code className="text-sky-300">1-2, 3-4</code>). If multiple ranges are specified, they will be archived into a convenient ZIP.
              </p>
            </div>
          )}

          {splitMode === 'single' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2">
              <label className="font-semibold text-slate-300 text-xs block">
                Select Page Number to Extract
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max={pageCount || 100}
                  value={singlePageInput}
                  onChange={(e) => setSinglePageInput(e.target.value)}
                  className="w-28 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-sky-500 font-mono"
                />
                <span className="text-xs text-slate-400">
                  of {pageCount || 1} total pages
                </span>
              </div>
            </div>
          )}

          {splitMode === 'all' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-xs text-slate-300">
              Each of the <span className="font-semibold text-white font-mono">{pageCount || 'all'}</span> pages will be saved as an independent single-page PDF and bundled into a ZIP file.
            </div>
          )}

          {/* Action Trigger */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={isSplitting || isInspecting}
              onClick={handleSplit}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
            >
              <Scissors className={`w-3.5 h-3.5 ${isSplitting ? 'animate-spin' : ''}`} />
              <span>{isSplitting ? 'Splitting Document...' : 'Split & Download'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Split Result Card */}
      {splitResult && (
        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              {splitResult.isZip ? (
                <Archive className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {splitResult.isZip ? 'PDF Pages Split & Archived' : 'Page Extracted Successfully'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {splitResult.fileName} · <span className="font-mono tabular-nums">{formatBytes(splitResult.processedBytes)}</span>
              </p>
            </div>
          </div>

          <a
            href={splitResult.downloadUrl}
            download
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Output {splitResult.isZip ? '(.ZIP)' : '(.PDF)'}</span>
          </a>
        </div>
      )}
    </div>
  );
};
