import React from 'react';
import { Layers, Sparkles, Trash2 } from 'lucide-react';
import { AppTab } from '../types/index.js';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLoadSample: () => void;
  onClearAll: () => void;
  hasFiles: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onLoadSample,
  onClearAll,
  hasFiles,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0c0f17]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">FILEFLOW</span>
        </div>

        {/* Zone 2: 4 clean single-line nav tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-sm font-medium">
          <button
            onClick={() => onTabChange('images')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'images'
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Image Converter
          </button>
          <button
            onClick={() => onTabChange('pdf-merge')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'pdf-merge'
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF Merge
          </button>
          <button
            onClick={() => onTabChange('pdf-split')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'pdf-split'
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF Split
          </button>
          <button
            onClick={() => onTabChange('history')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            History
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {hasFiles && (
            <button
              onClick={onClearAll}
              title="Clear all files"
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md border border-slate-800 hover:border-rose-500/30 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Queue</span>
            </button>
          )}
          <button
            onClick={onLoadSample}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-1.5 bg-slate-900/60 overflow-x-auto">
        <button
          onClick={() => onTabChange('images')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap shrink-0 rounded ${
            activeTab === 'images' ? 'text-sky-400 font-semibold' : 'text-slate-400'
          }`}
        >
          Images
        </button>
        <button
          onClick={() => onTabChange('pdf-merge')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap shrink-0 rounded ${
            activeTab === 'pdf-merge' ? 'text-sky-400 font-semibold' : 'text-slate-400'
          }`}
        >
          PDF Merge
        </button>
        <button
          onClick={() => onTabChange('pdf-split')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap shrink-0 rounded ${
            activeTab === 'pdf-split' ? 'text-sky-400 font-semibold' : 'text-slate-400'
          }`}
        >
          PDF Split
        </button>
        <button
          onClick={() => onTabChange('history')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap shrink-0 rounded ${
            activeTab === 'history' ? 'text-sky-400 font-semibold' : 'text-slate-400'
          }`}
        >
          History
        </button>
      </div>
    </header>
  );
};
