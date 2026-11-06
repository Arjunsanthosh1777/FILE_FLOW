/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileImage,
  FileText,
  History as HistoryIcon,
  Merge,
  Scissors,
  ShieldCheck,
  Zap,
  HardDrive,
} from 'lucide-react';
import { Header } from './components/Header.js';
import { ImageConverter } from './components/ImageConverter.js';
import { PdfMerger } from './components/PdfMerger.js';
import { PdfSplitter } from './components/PdfSplitter.js';
import { HistoryView } from './components/HistoryView.js';
import { ToastContainer, ToastMessage } from './components/Toast.js';
import { AppTab, ProcessedItem, HistoryEntry } from './types/index.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('images');
  const [imageItems, setImageItems] = useState<ProcessedItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Show Toast
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load history from localStorage and server
  useEffect(() => {
    const saved = localStorage.getItem('fileflow_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history from localStorage', e);
      }
    }

    // Sync with server history
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files) && data.files.length > 0) {
          setHistory((prev) => {
            const map = new Map<string, HistoryEntry>();
            prev.forEach((h) => map.set(h.id, h));
            data.files.forEach((f: any) => {
              if (!map.has(f.id)) {
                map.set(f.id, {
                  id: f.id,
                  originalName: f.originalName,
                  fileName: f.fileName,
                  sizeBytes: f.sizeBytes,
                  operation: f.operation,
                  createdAt: f.createdAt,
                  downloadUrl: f.downloadUrl,
                });
              }
            });
            return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      })
      .catch(() => {
        // Quiet fallback to localStorage
      });
  }, []);

  // Save history to localStorage
  const recordHistory = (entry: HistoryEntry) => {
    setHistory((prev) => {
      const updated = [entry, ...prev.filter((i) => i.id !== entry.id)].slice(0, 30);
      localStorage.setItem('fileflow_history', JSON.stringify(updated));
      return updated;
    });
    showToast(`Processed: ${entry.fileName}`, 'success');
  };

  const clearHistory = async () => {
    try {
      await fetch('/api/clear-all', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    setHistory([]);
    localStorage.removeItem('fileflow_history');
    showToast('Conversion history and temp files cleared.', 'info');
  };

  // Image queue operations
  const handleAddImageFiles = (files: File[]) => {
    const newItems: ProcessedItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      originalName: file.name,
      originalBytes: file.size,
      status: 'queued',
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setImageItems((prev) => [...prev, ...newItems]);
    setActiveTab('images');
  };

  const handleRemoveImageItem = (id: string) => {
    setImageItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearImageQueue = () => {
    setImageItems([]);
  };

  const handleUpdateImageItem = (id: string, updates: Partial<ProcessedItem>) => {
    setImageItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  // Clear everything
  const handleClearAll = () => {
    handleClearImageQueue();
    clearHistory();
  };

  // Sample file generator helper
  const handleLoadSample = async (forcedType?: 'image' | 'pdf') => {
    const typeToLoad = forcedType || (activeTab === 'images' ? 'image' : 'pdf');

    try {
      showToast(`Generating sample ${typeToLoad}...`, 'info');
      const res = await fetch(`/api/sample-files/${typeToLoad}`);
      if (!res.ok) throw new Error('Failed to load sample');

      const blob = await res.blob();
      const filename = typeToLoad === 'image' ? 'sample-gradient-photo.jpg' : 'sample-multipage-doc.pdf';
      const sampleFile = new File([blob], filename, {
        type: typeToLoad === 'image' ? 'image/jpeg' : 'application/pdf',
      });

      if (typeToLoad === 'image') {
        handleAddImageFiles([sampleFile]);
        setActiveTab('images');
        showToast('Sample image loaded into queue.', 'success');
      } else {
        // PDF loaded
        if (activeTab === 'pdf-split') {
          // Send to split
          showToast('Sample PDF loaded into PDF Splitter.', 'success');
        } else {
          setActiveTab('pdf-merge');
          showToast('Sample PDF ready for PDF Merge.', 'success');
        }
      }
    } catch (err: any) {
      showToast('Could not load sample file.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f17] text-slate-100 flex flex-col selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Bar Contract */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLoadSample={() => handleLoadSample()}
        onClearAll={handleClearAll}
        hasFiles={imageItems.length > 0 || history.length > 0}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Workspace Intro Hero Banner */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-2">
                <Zap className="w-3.5 h-3.5" />
                <span>Real-Time File Processing Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Convert, Compress & Transform Files Instantly
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl text-balance">
                High-performance image conversion powered by Sharp and vector PDF manipulation powered by pdf-lib. All files are securely processed on the backend with zero external tracking.
              </p>
            </div>

            {/* Feature metadata highlights with clean typographic separators (Zero-Pill) */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ephemeral Storage</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                <span>Max 50MB</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">1-Hour Retention</span>
            </div>
          </div>

          {/* Segmented Workspace Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mt-6 max-w-2xl">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'images'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <FileImage className="w-4 h-4" />
              <span>Image Converter & Compressor</span>
            </button>
            <button
              onClick={() => setActiveTab('pdf-merge')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'pdf-merge'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Merge className="w-4 h-4" />
              <span>PDF Merge</span>
            </button>
            <button
              onClick={() => setActiveTab('pdf-split')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'pdf-split'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>PDF Split</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <HistoryIcon className="w-4 h-4" />
              <span>History ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Content Panels */}
        <div className="mt-6">
          {activeTab === 'images' && (
            <ImageConverter
              items={imageItems}
              onAddFiles={handleAddImageFiles}
              onRemoveItem={handleRemoveImageItem}
              onClearQueue={handleClearImageQueue}
              onUpdateItemStatus={handleUpdateImageItem}
              onRecordHistory={recordHistory}
              onLoadSample={handleLoadSample}
              onErrorToast={(msg) => showToast(msg, 'error')}
            />
          )}

          {activeTab === 'pdf-merge' && (
            <PdfMerger
              onRecordHistory={recordHistory}
              onLoadSample={handleLoadSample}
              onErrorToast={(msg) => showToast(msg, 'error')}
            />
          )}

          {activeTab === 'pdf-split' && (
            <PdfSplitter
              onRecordHistory={recordHistory}
              onLoadSample={handleLoadSample}
              onErrorToast={(msg) => showToast(msg, 'error')}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              entries={history}
              onClearHistory={clearHistory}
              onGoToConverter={() => setActiveTab('images')}
            />
          )}
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0c0f17] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">FILEFLOW</span>
            <span aria-hidden="true">·</span>
            <span>Server-side image & PDF processing engine</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Powered by Sharp & pdf-lib</span>
            <span aria-hidden="true">·</span>
            <span>Zero telemetry</span>
          </div>
        </div>
      </footer>

      {/* Toast Alert Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
