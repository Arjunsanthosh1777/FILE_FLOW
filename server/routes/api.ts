import { Router, Request, Response } from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import fs from 'fs';
import { ImageService, SupportedImageFormat } from '../services/imageService.js';
import { PdfService } from '../services/pdfService.js';
import { FileStore } from '../services/fileStore.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const apiRouter = Router();

// Multer in-memory storage for high-speed processing without disk thrashing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file limit
    files: 25, // max 25 files per batch
  },
});

/**
 * Health check endpoint
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'FILEFLOW',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Image conversion & compression endpoint
 */
apiRouter.post(
  '/convert-compress',
  upload.array('files'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No image files provided for processing.' });
        return;
      }

      const targetFormat = req.body.targetFormat ? req.body.targetFormat.toLowerCase() : undefined;
      const quality = req.body.quality ? parseInt(req.body.quality, 10) : 80;
      const width = req.body.width ? parseInt(req.body.width, 10) : undefined;
      const height = req.body.height ? parseInt(req.body.height, 10) : undefined;

      const validFormats = ['jpeg', 'jpg', 'png', 'webp'];
      if (targetFormat && !validFormats.includes(targetFormat)) {
        res.status(400).json({
          error: `Invalid target format "${targetFormat}". Supported formats: JPG, PNG, WebP.`,
        });
        return;
      }

      const results = [];

      for (const file of files) {
        try {
          const processResult = await ImageService.process(file.buffer, {
            targetFormat: targetFormat === 'jpg' ? 'jpeg' : targetFormat,
            quality,
            width,
            height,
          });

          const stored = FileStore.saveFile(
            processResult.buffer,
            file.originalname,
            processResult.mimeType,
            processResult.extension,
            `Convert & Compress (${processResult.format.toUpperCase()} @ ${quality}%)`
          );

          results.push({
            fileId: stored.id,
            originalName: file.originalname,
            fileName: stored.fileName,
            originalBytes: processResult.originalBytes,
            processedBytes: processResult.processedBytes,
            savedBytes: processResult.savedBytes,
            savingsPercent: processResult.savingsPercent,
            format: processResult.format,
            mimeType: processResult.mimeType,
            width: processResult.width,
            height: processResult.height,
            quality,
            downloadUrl: `/api/download/${stored.id}`,
          });
        } catch (itemErr: any) {
          results.push({
            originalName: file.originalname,
            error: itemErr.message || 'Failed to process image file.',
          });
        }
      }

      res.json({
        success: true,
        count: results.length,
        items: results,
      });
    } catch (err: any) {
      console.error('Error in /convert-compress:', err);
      res.status(500).json({
        error: err.message || 'Internal server error while processing images.',
      });
    }
  }
);

/**
 * PDF Inspection endpoint (returns page count and metadata)
 */
apiRouter.post(
  '/pdf/info',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No PDF file uploaded.' });
        return;
      }

      const info = await PdfService.inspect(file.buffer);
      res.json({
        success: true,
        fileName: file.originalname,
        pageCount: info.pageCount,
        sizeBytes: info.sizeBytes,
        title: info.title || null,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Unable to inspect PDF file.' });
    }
  }
);

/**
 * PDF Merge endpoint
 */
apiRouter.post(
  '/pdf/merge',
  upload.array('files'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length < 2) {
        res.status(400).json({ error: 'Please provide at least 2 PDF files to merge.' });
        return;
      }

      const totalOriginalBytes = files.reduce((acc, f) => acc + f.size, 0);
      const buffers = files.map((f) => f.buffer);

      const merged = await PdfService.merge(buffers);

      const customName = req.body.outputName
        ? `${req.body.outputName.replace(/\.pdf$/i, '')}.pdf`
        : 'merged_document.pdf';

      const stored = FileStore.saveFile(
        merged.buffer,
        customName,
        'application/pdf',
        'pdf',
        `PDF Merge (${files.length} documents, ${merged.pageCount} pages)`
      );

      res.json({
        success: true,
        fileId: stored.id,
        fileName: stored.fileName,
        pageCount: merged.pageCount,
        originalBytes: totalOriginalBytes,
        processedBytes: merged.sizeBytes,
        savedBytes: Math.max(0, totalOriginalBytes - merged.sizeBytes),
        savingsPercent: totalOriginalBytes > 0
          ? Number((((totalOriginalBytes - merged.sizeBytes) / totalOriginalBytes) * 100).toFixed(1))
          : 0,
        downloadUrl: `/api/download/${stored.id}`,
      });
    } catch (err: any) {
      console.error('Error in /pdf/merge:', err);
      res.status(400).json({ error: err.message || 'Failed to merge PDF files.' });
    }
  }
);

/**
 * PDF Split endpoint
 */
apiRouter.post(
  '/pdf/split',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No PDF file provided for splitting.' });
        return;
      }

      const rangeString = req.body.ranges;
      if (!rangeString || typeof rangeString !== 'string' || !rangeString.trim()) {
        res.status(400).json({
          error: 'Please provide page range(s) to split (e.g. "1-3", "1, 3, 5", or "all").',
        });
        return;
      }

      const result = await PdfService.split(file.buffer, rangeString, file.originalname);

      const stored = FileStore.saveFile(
        result.buffer,
        result.fileName,
        result.mimeType,
        result.isZip ? 'zip' : 'pdf',
        `PDF Split (${rangeString}, ${result.pageCount} total pages)`
      );

      res.json({
        success: true,
        fileId: stored.id,
        fileName: stored.fileName,
        isZip: result.isZip,
        pageCount: result.pageCount,
        extractedFileCount: result.extractedFileCount,
        originalBytes: file.size,
        processedBytes: stored.sizeBytes,
        savedBytes: Math.max(0, file.size - stored.sizeBytes),
        savingsPercent: file.size > 0
          ? Number((((file.size - stored.sizeBytes) / file.size) * 100).toFixed(1))
          : 0,
        downloadUrl: `/api/download/${stored.id}`,
      });
    } catch (err: any) {
      console.error('Error in /pdf/split:', err);
      res.status(400).json({ error: err.message || 'Failed to split PDF file.' });
    }
  }
);

/**
 * Download processed file by safe ID
 */
apiRouter.get('/download/:fileId', (req: Request, res: Response): void => {
  const { fileId } = req.params;
  const file = FileStore.getFile(fileId);

  if (!file || !fs.existsSync(file.filePath)) {
    res.status(404).send('File not found or expired. Please convert the file again.');
    return;
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
  res.setHeader('Content-Length', file.sizeBytes);

  const stream = fs.createReadStream(file.filePath);
  stream.pipe(res);
});

/**
 * Batch download multiple files as a single ZIP archive
 */
apiRouter.post('/batch-download', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      res.status(400).json({ error: 'Please provide a list of file IDs to batch download.' });
      return;
    }

    const zip = new JSZip();
    let addedCount = 0;

    for (const id of fileIds) {
      const file = FileStore.getFile(id);
      if (file && fs.existsSync(file.filePath)) {
        const fileData = fs.readFileSync(file.filePath);
        zip.file(file.fileName, fileData);
        addedCount++;
      }
    }

    if (addedCount === 0) {
      res.status(404).json({ error: 'No matching files found to download.' });
      return;
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const stored = FileStore.saveFile(
      zipContent,
      `fileflow_bundle_${Date.now()}.zip`,
      'application/zip',
      'zip',
      `Batch Download (${addedCount} files)`
    );

    res.json({
      success: true,
      fileId: stored.id,
      fileName: stored.fileName,
      sizeBytes: stored.sizeBytes,
      downloadUrl: `/api/download/${stored.id}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate batch zip archive.' });
  }
});

/**
 * Get active storage / conversion history
 */
apiRouter.get('/history', (_req: Request, res: Response): void => {
  const files = FileStore.getAll().map((f) => ({
    id: f.id,
    originalName: f.originalName,
    fileName: f.fileName,
    sizeBytes: f.sizeBytes,
    mimeType: f.mimeType,
    createdAt: f.createdAt,
    operation: f.operation,
    downloadUrl: `/api/download/${f.id}`,
  }));
  res.json({ success: true, files });
});

/**
 * Delete a specific stored file
 */
apiRouter.delete('/files/:fileId', (req: Request, res: Response): void => {
  const { fileId } = req.params;
  const deleted = FileStore.deleteFile(fileId);
  res.json({ success: deleted });
});

/**
 * Clear all stored temporary files
 */
apiRouter.post('/clear-all', (_req: Request, res: Response): void => {
  const clearedCount = FileStore.clearAll();
  res.json({ success: true, clearedCount });
});

/**
 * Generate test samples on the fly so users and tests can try immediately
 */
apiRouter.get('/sample-files/:type', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;

    if (type === 'image') {
      // Generate a sharp test JPEG image with geometric patterns
      const width = 1200;
      const height = 800;
      const svgBuffer = Buffer.from(`
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)" />
          <circle cx="600" cy="400" r="220" fill="#ffffff" fill-opacity="0.25" />
          <circle cx="600" cy="400" r="140" fill="#ffffff" fill-opacity="0.35" />
          <text x="600" y="390" font-family="sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">FILEFLOW SAMPLE</text>
          <text x="600" y="440" font-family="sans-serif" font-size="24" fill="#f8fafc" text-anchor="middle">1200 × 800 High-Res Test Image</text>
        </svg>
      `);

      const jpgBuffer = await (await import('sharp')).default(svgBuffer).jpeg({ quality: 95 }).toBuffer();

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="fileflow-sample-photo.jpg"');
      res.send(jpgBuffer);
      return;
    }

    if (type === 'pdf') {
      // Generate a multi-page sample PDF with pdf-lib
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Page 1
      const page1 = pdfDoc.addPage([600, 400]);
      page1.drawText('FILEFLOW Test Document', {
        x: 50,
        y: 330,
        size: 28,
        font,
        color: rgb(0.09, 0.12, 0.2),
      });
      page1.drawText('Page 1 of 3: Introduction & Overview', {
        x: 50,
        y: 290,
        size: 16,
        font: regularFont,
        color: rgb(0.2, 0.3, 0.45),
      });
      page1.drawText('This sample document is designed to test PDF merging and splitting features.', {
        x: 50,
        y: 250,
        size: 12,
        font: regularFont,
        color: rgb(0.3, 0.35, 0.4),
      });

      // Page 2
      const page2 = pdfDoc.addPage([600, 400]);
      page2.drawText('Page 2 of 3: Data Analytics & Tables', {
        x: 50,
        y: 330,
        size: 24,
        font,
        color: rgb(0.1, 0.4, 0.3),
      });
      page2.drawText('You can extract this specific page by entering range "2" in PDF Split.', {
        x: 50,
        y: 290,
        size: 14,
        font: regularFont,
        color: rgb(0.3, 0.35, 0.4),
      });

      // Page 3
      const page3 = pdfDoc.addPage([600, 400]);
      page3.drawText('Page 3 of 3: Summary & Appendix', {
        x: 50,
        y: 330,
        size: 24,
        font,
        color: rgb(0.5, 0.1, 0.2),
      });
      page3.drawText('This page completes the 3-page test PDF document.', {
        x: 50,
        y: 290,
        size: 14,
        font: regularFont,
        color: rgb(0.3, 0.35, 0.4),
      });

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="fileflow-sample-doc.pdf"');
      res.send(Buffer.from(pdfBytes));
      return;
    }

    res.status(400).json({ error: 'Sample type must be "image" or "pdf".' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate test sample.' });
  }
});
