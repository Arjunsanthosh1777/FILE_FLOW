import React, { useState, useRef } from 'react';
import { UploadCloud, FileImage, FileText, ArrowUpRight } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedFormatsText?: string;
  isPdfOnly?: boolean;
  isImageOnly?: boolean;
  onLoadSample?: (type: 'image' | 'pdf') => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  acceptedFormatsText = 'JPG, JPEG, PNG, WebP, PDF',
  isPdfOnly = false,
  isImageOnly = false,
  onLoadSample,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptMime = isPdfOnly
    ? '.pdf,application/pdf'
    : isImageOnly
    ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
    : '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center ${
        isDragOver
          ? 'border-sky-500 bg-sky-500/10 scale-[1.005]'
          : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptMime}
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
            isDragOver
              ? 'bg-sky-500/20 text-sky-400'
              : 'bg-slate-800/80 text-slate-400 group-hover:text-sky-400 group-hover:bg-slate-800'
          }`}
        >
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-base font-semibold text-white mb-1">
          Drop your files here, or{' '}
          <span className="text-sky-400 hover:underline">browse</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Supported: {acceptedFormatsText} · Up to 50MB per file
        </p>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <FileImage className="w-3.5 h-3.5" />
            <span>Images</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>PDFs</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Zero Server Tracing</span>
        </div>

        {onLoadSample && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400"
          >
            <span>Need a test file?</span>
            {!isPdfOnly && (
              <button
                type="button"
                onClick={() => onLoadSample('image')}
                className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2"
              >
                Sample Image
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
            {!isPdfOnly && !isImageOnly && <span aria-hidden="true">·</span>}
            {!isImageOnly && (
              <button
                type="button"
                onClick={() => onLoadSample('pdf')}
                className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2"
              >
                Sample PDF (3 Pages)
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
