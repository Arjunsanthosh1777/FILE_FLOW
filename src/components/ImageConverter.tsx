import React, { useState } from 'react';
import {
  FileImage,
  Sliders,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Archive,
  RefreshCw,
  ArrowRight,
  Maximize2,
} from 'lucide-react';
import { ProcessedItem, HistoryEntry } from '../types/index.js';
import { formatBytes, formatSavings } from '../utils/formatters.js';
import { Dropzone } from './Dropzone.js';

interface ImageConverterProps {
  items: ProcessedItem[];
  onAddFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onUpdateItemStatus: (id: string, updates: Partial<ProcessedItem>) => void;
  onRecordHistory: (entry: HistoryEntry) => void;
  onLoadSample: (type: 'image' | 'pdf') => void;
  onErrorToast: (msg: string) => void;
}

export const ImageConverter: React.FC<ImageConverterProps> = ({
  items,
  onAddFiles,
  onRemoveItem,
  onClearQueue,
  onUpdateItemStatus,
  onRecordHistory,
  onLoadSample,
  onErrorToast,
}) => {
  const [targetFormat, setTargetFormat] = useState<'webp' | 'jpeg' | 'png'>('webp');
  const [quality, setQuality] = useState<number>(75);
  const [maxWidth, setMaxWidth] = useState<string>('original');
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Validate and add files
  const handleFiles = (files: File[]) => {
    const validFiles: File[] = [];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

    for (const f of files) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (validExtensions.includes(ext) || f.type.startsWith('image/')) {
        if (f.size > 50 * 1024 * 1024) {
          onErrorToast(`"${f.name}" exceeds the 50MB file size limit.`);
          continue;
        }
        validFiles.push(f);
      } else {
        onErrorToast(`"${f.name}" is not a supported image format. Please upload JPG, PNG, or WebP.`);
      }
    }

    if (validFiles.length > 0) {
      onAddFiles(validFiles);
    }
  };

  // Process a single item
  const processItem = async (item: ProcessedItem) => {
    if (!item.file || item.status === 'processing') return;

    onUpdateItemStatus(item.id, { status: 'processing', progress: 25 });

    try {
      const formData = new FormData();
      formData.append('files', item.file);
      formData.append('targetFormat', targetFormat);
      formData.append('quality', quality.toString());
      if (maxWidth !== 'original') {
        formData.append('width', maxWidth);
      }

      onUpdateItemStatus(item.id, { progress: 60 });

      const response = await fetch('/api/convert-compress', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.items || data.items.length === 0) {
        throw new Error(data.error || 'Failed to process image on server.');
      }

      const resItem = data.items[0];
      if (resItem.error) {
        throw new Error(resItem.error);
      }

      onUpdateItemStatus(item.id, {
        status: 'completed',
        progress: 100,
        processedBytes: resItem.processedBytes,
        savedBytes: resItem.savedBytes,
        savingsPercent: resItem.savingsPercent,
        format: resItem.format,
        mimeType: resItem.mimeType,
        width: resItem.width,
        height: resItem.height,
        downloadUrl: resItem.downloadUrl,
      });

      // Record to history
      onRecordHistory({
        id: resItem.fileId,
        originalName: item.originalName,
        fileName: resItem.fileName,
        sizeBytes: resItem.processedBytes,
        originalBytes: item.originalBytes,
        savingsPercent: resItem.savingsPercent,
        operation: `${item.originalName.split('.').pop()?.toUpperCase()} → ${resItem.format.toUpperCase()} (${quality}%)`,
        createdAt: Date.now(),
        downloadUrl: resItem.downloadUrl,
      });
    } catch (err: any) {
      console.error('Error processing item:', err);
      onUpdateItemStatus(item.id, {
        status: 'error',
        errorMessage: err.message || 'Image processing failed.',
      });
    }
  };

  // Process all queued items
  const handleProcessAll = async () => {
    const queuedItems = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (queuedItems.length === 0) return;

    setIsProcessingAll(true);
    for (const item of queuedItems) {
      await processItem(item);
    }
    setIsProcessingAll(false);
  };

  // Batch download completed files
  const handleBatchDownload = async () => {
    const completedItems = items.filter((i) => i.status === 'completed' && i.downloadUrl);
    if (completedItems.length === 0) return;

    // If only one, trigger directly
    if (completedItems.length === 1) {
      window.location.href = completedItems[0].downloadUrl!;
      return;
    }

    try {
      setIsZipping(true);
      const fileIds = completedItems.map((i) => i.downloadUrl!.replace('/api/download/', ''));

      const response = await fetch('/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate batch archive.');
      }

      window.location.href = data.downloadUrl;
    } catch (err: any) {
      onErrorToast(err.message || 'Failed to download batch archive.');
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const queuedCount = items.filter((i) => i.status === 'queued').length;
  const totalOriginalBytes = items.reduce((acc, i) => acc + i.originalBytes, 0);
  const totalProcessedBytes = items
    .filter((i) => i.status === 'completed' && i.processedBytes)
    .reduce((acc, i) => acc + (i.processedBytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <Dropzone
        onFilesSelected={handleFiles}
        isImageOnly={true}
        acceptedFormatsText="JPG, JPEG, PNG, WebP"
        onLoadSample={onLoadSample}
      />

      {/* Global Conversion & Compression Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Target Format */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Target Format</span>
            </label>
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setTargetFormat('webp')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  targetFormat === 'webp'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                WebP <span className="text-[10px] opacity-75 font-normal">(Optimal)</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetFormat('jpeg')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  targetFormat === 'jpeg'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JPG / JPEG
              </button>
              <button
                type="button"
                onClick={() => setTargetFormat('png')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  targetFormat === 'png'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PNG
              </button>
            </div>
          </div>

          {/* Quality Slider & Presets */}
          <div className="space-y-2 flex-1 max-w-lg">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Compression Quality</span>
              </span>
              <span className="font-mono text-sky-400 tabular-nums">{quality}%</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setQuality(90)}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors whitespace-nowrap ${
                  quality === 90 ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30' : 'text-slate-400 hover:text-slate-300 bg-slate-800/60'
                }`}
              >
                90% Max Quality
              </button>
              <button
                type="button"
                onClick={() => setQuality(75)}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors whitespace-nowrap ${
                  quality === 75 ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30' : 'text-slate-400 hover:text-slate-300 bg-slate-800/60'
                }`}
              >
                75% Balanced
              </button>
              <button
                type="button"
                onClick={() => setQuality(50)}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors whitespace-nowrap ${
                  quality === 50 ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30' : 'text-slate-400 hover:text-slate-300 bg-slate-800/60'
                }`}
              >
                50% Compact
              </button>
            </div>
          </div>

          {/* Optional Resize Constraints */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Resize Max Width</span>
            </label>
            <select
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="original">Original Dimensions</option>
              <option value="1920">1920px (Full HD)</option>
              <option value="1280">1280px (Web Standard)</option>
              <option value="800">800px (Mobile / Blog)</option>
            </select>
          </div>
        </div>

        {/* Global Action Bar */}
        {items.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{items.length} file{items.length > 1 ? 's' : ''} in queue</span>
              {completedCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-medium">
                    {completedCount} completed
                  </span>
                </>
              )}
              {queuedCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400 font-medium">
                    {queuedCount} pending
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClearQueue}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md border border-slate-800 transition-colors whitespace-nowrap"
              >
                Clear Queue
              </button>

              {completedCount > 1 && (
                <button
                  type="button"
                  disabled={isZipping}
                  onClick={handleBatchDownload}
                  className="px-3.5 py-1.5 text-xs font-semibold text-sky-400 hover:text-white bg-sky-950/60 hover:bg-sky-600 border border-sky-800/80 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isZipping ? 'Archiving...' : 'Download All (.ZIP)'}</span>
                </button>
              )}

              {queuedCount > 0 && (
                <button
                  type="button"
                  disabled={isProcessingAll}
                  onClick={handleProcessAll}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessingAll ? 'animate-spin' : ''}`} />
                  <span>{isProcessingAll ? 'Processing...' : `Convert & Compress (${queuedCount})`}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Files List / Comparison Cards */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Files Processing Queue
            </h4>
            {completedCount > 0 && totalOriginalBytes > 0 && totalProcessedBytes > 0 && (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Total Saved:</span>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  {formatSavings(totalOriginalBytes, totalProcessedBytes)} ({formatBytes(totalOriginalBytes - totalProcessedBytes)})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* File Thumbnail & Name */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-slate-800/90 border border-slate-700/50 flex items-center justify-center overflow-hidden shrink-0">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.originalName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileImage className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono tabular-nums">{formatBytes(item.originalBytes)}</span>
                      {item.width && item.height && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{item.width}×{item.height}px</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status / Comparison */}
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  {item.status === 'completed' && item.processedBytes !== undefined && (
                    <div className="flex items-center gap-3">
                      {/* Before & After Sizes */}
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-xs font-mono text-slate-400 tabular-nums">
                            {formatBytes(item.originalBytes)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                          <span className="text-xs font-mono font-bold text-white tabular-nums">
                            {formatBytes(item.processedBytes)}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                          {formatSavings(item.originalBytes, item.processedBytes)} ({formatBytes(item.savedBytes || 0)} saved)
                        </p>
                      </div>

                      {/* Download Button */}
                      <a
                        href={item.downloadUrl}
                        download
                        className="p-2 text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-sm shrink-0 flex items-center gap-1 text-xs font-semibold px-3"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  )}

                  {item.status === 'processing' && (
                    <div className="flex items-center gap-2.5 text-xs text-sky-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Optimizing with Sharp...</span>
                    </div>
                  )}

                  {item.status === 'queued' && (
                    <button
                      type="button"
                      onClick={() => processItem(item)}
                      className="px-3 py-1.5 text-xs font-medium text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-600 border border-sky-500/20 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Convert Now
                    </button>
                  )}

                  {item.status === 'error' && (
                    <div className="flex items-center gap-2 text-xs text-rose-400 max-w-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="truncate" title={item.errorMessage}>
                        {item.errorMessage || 'Conversion failed'}
                      </span>
                    </div>
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
