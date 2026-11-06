import React, { useState } from 'react';
import {
  FileText,
  ArrowUp,
  ArrowDown,
  Trash2,
  Merge,
  Download,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  FilePlus,
} from 'lucide-react';
import { PdfMergeItem, HistoryEntry } from '../types/index.js';
import { formatBytes } from '../utils/formatters.js';
import { Dropzone } from './Dropzone.js';

interface PdfMergerProps {
  onRecordHistory: (entry: HistoryEntry) => void;
  onLoadSample: (type: 'image' | 'pdf') => void;
  onErrorToast: (msg: string) => void;
}

export const PdfMerger: React.FC<PdfMergerProps> = ({
  onRecordHistory,
  onLoadSample,
  onErrorToast,
}) => {
  const [items, setItems] = useState<PdfMergeItem[]>([]);
  const [outputName, setOutputName] = useState('merged_document.pdf');
  const [isMerging, setIsMerging] = useState(false);
  const [mergedResult, setMergedResult] = useState<{
    downloadUrl: string;
    fileName: string;
    pageCount: number;
    originalBytes: number;
    processedBytes: number;
  } | null>(null);

  // Inspect page counts when PDFs are added
  const handleFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length < files.length) {
      onErrorToast('Non-PDF files were ignored. PDF Merger only accepts .pdf files.');
    }

    if (pdfFiles.length === 0) return;

    // Create preliminary items
    const newItems: PdfMergeItem[] = pdfFiles.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      sizeBytes: f.size,
      status: 'inspecting',
    }));

    setItems((prev) => [...prev, ...newItems]);
    setMergedResult(null);

    // Inspect each PDF in parallel
    for (const item of newItems) {
      try {
        const formData = new FormData();
        formData.append('file', item.file);

        const res = await fetch('/api/pdf/info', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const info = await res.json();
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, pageCount: info.pageCount, status: 'ready' }
                : i
            )
          );
        } else {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'ready' } : i))
          );
        }
      } catch (err) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'ready' } : i))
        );
      }
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const updated = [...items];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setItems(updated);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setMergedResult(null);
  };

  const clearQueue = () => {
    setItems([]);
    setMergedResult(null);
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      onErrorToast('Please add at least 2 PDF files to merge.');
      return;
    }

    setIsMerging(true);
    setMergedResult(null);

    try {
      const formData = new FormData();
      for (const item of items) {
        formData.append('files', item.file);
      }
      formData.append('outputName', outputName);

      const response = await fetch('/api/pdf/merge', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to merge PDF files.');
      }

      setMergedResult({
        downloadUrl: data.downloadUrl,
        fileName: data.fileName,
        pageCount: data.pageCount,
        originalBytes: data.originalBytes,
        processedBytes: data.processedBytes,
      });

      // Record to history
      onRecordHistory({
        id: data.fileId,
        originalName: `${items.length} PDFs merged`,
        fileName: data.fileName,
        sizeBytes: data.processedBytes,
        originalBytes: data.originalBytes,
        savingsPercent: data.savingsPercent,
        operation: `PDF Merge (${items.length} files, ${data.pageCount} pages)`,
        createdAt: Date.now(),
        downloadUrl: data.downloadUrl,
      });
    } catch (err: any) {
      onErrorToast(err.message || 'Failed to merge PDF documents.');
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = items.reduce((acc, i) => acc + (i.pageCount || 0), 0);
  const totalSize = items.reduce((acc, i) => acc + i.sizeBytes, 0);

  return (
    <div className="space-y-6">
      <Dropzone
        onFilesSelected={handleFiles}
        isPdfOnly={true}
        acceptedFormatsText="PDF (.pdf)"
        onLoadSample={onLoadSample}
      />

      {/* Merged Success Banner */}
      {mergedResult && (
        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">PDFs Successfully Merged!</h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Output contains <span className="font-semibold text-emerald-400 font-mono tabular-nums">{mergedResult.pageCount} pages</span> ({formatBytes(mergedResult.processedBytes)} total)
              </p>
            </div>
          </div>

          <a
            href={mergedResult.downloadUrl}
            download
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Merged PDF</span>
          </a>
        </div>
      )}

      {/* Merge Queue & Options */}
      {items.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white">Merge Queue Order</h3>
              <p className="text-xs text-slate-400">
                Documents will be combined top to bottom. Use the arrow buttons to reorder.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{items.length} files</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{totalPages} total pages</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatBytes(totalSize)}</span>
            </div>
          </div>

          {/* List of PDFs to merge */}
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono tabular-nums">{formatBytes(item.sizeBytes)}</span>
                      {item.pageCount !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-slate-300">
                            {item.pageCount} page{item.pageCount > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reorder and delete controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveItem(index, 'up')}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded hover:bg-slate-800 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 'down')}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded hover:bg-slate-800 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors ml-1"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Controls & Output Name */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <label className="text-xs text-slate-400 whitespace-nowrap">Output Filename:</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="merged_document.pdf"
                className="bg-slate-950/80 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 w-full outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-2.5 justify-end">
              <button
                type="button"
                onClick={clearQueue}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 rounded-md border border-slate-800 transition-colors whitespace-nowrap"
              >
                Clear All
              </button>
              <button
                type="button"
                disabled={isMerging || items.length < 2}
                onClick={handleMerge}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
              >
                <Merge className={`w-3.5 h-3.5 ${isMerging ? 'animate-spin' : ''}`} />
                <span>{isMerging ? 'Merging Documents...' : `Merge ${items.length} PDFs`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
