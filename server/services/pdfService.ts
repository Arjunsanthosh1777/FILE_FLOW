import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export interface SplitResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  isZip: boolean;
  pageCount: number;
  extractedFileCount: number;
}

export const PdfService = {
  /**
   * Validate that buffer is a valid PDF and extract page information
   */
  async inspect(buffer: Buffer) {
    if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
      throw new Error('Invalid file format. File does not start with standard PDF header.');
    }

    try {
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pageCount = doc.getPageCount();
      return {
        pageCount,
        title: doc.getTitle() || undefined,
        sizeBytes: buffer.length,
      };
    } catch (err: any) {
      throw new Error(`Corrupt or encrypted PDF file: ${err.message || 'Unable to read document'}`);
    }
  },

  /**
   * Merge multiple PDF buffers in the specified order
   */
  async merge(pdfBuffers: Buffer[]): Promise<{ buffer: Buffer; pageCount: number; sizeBytes: number }> {
    if (!pdfBuffers || pdfBuffers.length < 2) {
      throw new Error('At least 2 PDF files are required for merging.');
    }

    const mergedDoc = await PDFDocument.create();
    let totalPages = 0;

    for (let i = 0; i < pdfBuffers.length; i++) {
      const buf = pdfBuffers[i];
      try {
        const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pageIndices = srcDoc.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
        for (const page of copiedPages) {
          mergedDoc.addPage(page);
          totalPages++;
        }
      } catch (err: any) {
        throw new Error(`Failed to read PDF document #${i + 1}: ${err.message}`);
      }
    }

    const mergedBytes = await mergedDoc.save();
    const finalBuffer = Buffer.from(mergedBytes);

    return {
      buffer: finalBuffer,
      pageCount: totalPages,
      sizeBytes: finalBuffer.length,
    };
  },

  /**
   * Parse range string like "1-3, 5, 8-10" into array of 0-based page index groups
   */
  parsePageRanges(rangeStr: string, totalPages: number): number[][] {
    const trimmed = rangeStr.trim().toLowerCase();
    
    // Split into distinct groups if comma-separated
    const groups = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    if (groups.length === 0) {
      throw new Error('Please specify at least one page or range to split.');
    }

    const resultGroups: number[][] = [];

    for (const group of groups) {
      if (group === 'all') {
        for (let i = 0; i < totalPages; i++) {
          resultGroups.push([i]);
        }
        continue;
      }

      if (group.includes('-')) {
        const parts = group.split('-');
        if (parts.length !== 2) {
          throw new Error(`Invalid range format: "${group}". Expected format like "1-5".`);
        }
        const start = parseInt(parts[0].trim(), 10);
        const end = parseInt(parts[1].trim(), 10);

        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Invalid range numbers in "${group}".`);
        }
        if (start < 1 || end < 1) {
          throw new Error(`Page numbers must be 1 or greater in "${group}".`);
        }
        if (start > end) {
          throw new Error(`Start page (${start}) cannot be greater than end page (${end}) in "${group}".`);
        }
        if (end > totalPages) {
          throw new Error(`Requested page ${end} exceeds document page count of ${totalPages}.`);
        }

        const pages: number[] = [];
        for (let p = start; p <= end; p++) {
          pages.push(p - 1); // 0-indexed
        }
        resultGroups.push(pages);
      } else {
        const pageNum = parseInt(group, 10);
        if (isNaN(pageNum) || pageNum < 1) {
          throw new Error(`Invalid page number "${group}".`);
        }
        if (pageNum > totalPages) {
          throw new Error(`Requested page ${pageNum} exceeds document page count of ${totalPages}.`);
        }
        resultGroups.push([pageNum - 1]);
      }
    }

    return resultGroups;
  },

  /**
   * Split PDF by page ranges.
   * If single group requested, returns a single PDF.
   * If multiple groups (or 'all') requested, packages them into a convenient ZIP archive.
   */
  async split(buffer: Buffer, rangeString: string, originalName: string): Promise<SplitResult> {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    if (totalPages === 0) {
      throw new Error('The PDF document contains no pages.');
    }

    const groups = this.parsePageRanges(rangeString, totalPages);
    const baseName = originalName.replace(/\.pdf$/i, '');

    // Single group: output single PDF directly
    if (groups.length === 1) {
      const pageIndices = groups[0];
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        newDoc.addPage(page);
      }
      const pdfBytes = await newDoc.save();
      const outBuffer = Buffer.from(pdfBytes);
      const rangeLabel = pageIndices.length === 1 
        ? `page-${pageIndices[0] + 1}` 
        : `pages-${pageIndices[0] + 1}-${pageIndices[pageIndices.length - 1] + 1}`;

      return {
        buffer: outBuffer,
        fileName: `${baseName}_${rangeLabel}.pdf`,
        mimeType: 'application/pdf',
        isZip: false,
        pageCount: pageIndices.length,
        extractedFileCount: 1,
      };
    }

    // Multiple groups: package into ZIP
    const zip = new JSZip();

    for (let i = 0; i < groups.length; i++) {
      const pageIndices = groups[i];
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        newDoc.addPage(page);
      }
      const pdfBytes = await newDoc.save();
      const label = pageIndices.length === 1
        ? `page_${pageIndices[0] + 1}`
        : `pages_${pageIndices[0] + 1}_to_${pageIndices[pageIndices.length - 1] + 1}`;
      
      zip.file(`${baseName}_part_${i + 1}_${label}.pdf`, pdfBytes);
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return {
      buffer: zipContent,
      fileName: `${baseName}_split_pages.zip`,
      mimeType: 'application/zip',
      isZip: true,
      pageCount: groups.reduce((acc, g) => acc + g.length, 0),
      extractedFileCount: groups.length,
    };
  },
};
