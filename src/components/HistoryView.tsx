import React from 'react';
import {
  History,
  Download,
  Trash2,
  FileCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { HistoryEntry } from '../types/index.js';
import { formatBytes, formatTimeAgo } from '../utils/formatters.js';

interface HistoryViewProps {
  entries: HistoryEntry[];
  onClearHistory: () => void;
  onGoToConverter: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  entries,
  onClearHistory,
  onGoToConverter,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Recent Conversions</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Files processed during this session. Download links are active for 1 hour.
          </p>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center bg-slate-900/30">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <History className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">No Conversion History Yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            Upload and convert images or merge/split PDFs to view your recent output history here.
          </p>
          <button
            type="button"
            onClick={onGoToConverter}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Convert Your First File</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">File & Operation</th>
                  <th className="py-3 px-4">Original Size</th>
                  <th className="py-3 px-4">Processed Size</th>
                  <th className="py-3 px-4">Savings</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* File & Operation */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <FileCheck className="w-4 h-4 text-sky-400 shrink-0" />
                        <div className="min-w-0 max-w-xs">
                          <p className="font-semibold text-slate-200 truncate" title={entry.fileName}>
                            {entry.fileName}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {entry.operation}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Original Size */}
                    <td className="py-3.5 px-4 font-mono text-slate-400 tabular-nums">
                      {entry.originalBytes ? formatBytes(entry.originalBytes) : '—'}
                    </td>

                    {/* Processed Size */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-200 tabular-nums">
                      {formatBytes(entry.sizeBytes)}
                    </td>

                    {/* Savings */}
                    <td className="py-3.5 px-4">
                      {entry.savingsPercent !== undefined && entry.savingsPercent > 0 ? (
                        <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                          -{entry.savingsPercent}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatTimeAgo(entry.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={entry.downloadUrl}
                        download
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:text-white bg-sky-950/60 hover:bg-sky-600 border border-sky-800/60 rounded-md transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
