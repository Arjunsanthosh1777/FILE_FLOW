export type AppTab = 'images' | 'pdf-merge' | 'pdf-split' | 'history';

export interface ProcessedItem {
  id: string;
  originalName: string;
  originalBytes: number;
  processedBytes?: number;
  savedBytes?: number;
  savingsPercent?: number;
  format?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  downloadUrl?: string;
  errorMessage?: string;
  file?: File;
  previewUrl?: string;
}

export interface PdfMergeItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  pageCount?: number;
  status: 'ready' | 'inspecting' | 'error';
}

export interface HistoryEntry {
  id: string;
  originalName: string;
  fileName: string;
  sizeBytes: number;
  originalBytes?: number;
  savingsPercent?: number;
  operation: string;
  createdAt: number;
  downloadUrl: string;
}
