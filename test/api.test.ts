import test from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';
import { ImageService } from '../server/services/imageService.js';
import { PdfService } from '../server/services/pdfService.js';
import { FileStore } from '../server/services/fileStore.js';

test('ImageService: should convert and compress JPEG to WebP', async () => {
  // Create a 400x300 sample SVG and convert to JPEG buffer
  const sampleSvg = Buffer.from(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#2563eb" />
      <circle cx="200" cy="150" r="80" fill="#ffffff" />
    </svg>
  `);
  const initialJpeg = await sharp(sampleSvg).jpeg({ quality: 95 }).toBuffer();

  const result = await ImageService.process(initialJpeg, {
    targetFormat: 'webp',
    quality: 60,
  });

  assert.strictEqual(result.format, 'webp');
  assert.strictEqual(result.mimeType, 'image/webp');
  assert.strictEqual(result.extension, 'webp');
  assert.ok(result.processedBytes > 0, 'Processed buffer must not be empty');
  assert.ok(result.width === 400);
  assert.ok(result.height === 300);
});

test('ImageService: lower quality should result in smaller file size', async () => {
  const sampleSvg = Buffer.from(`
    <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="600" fill="#10b981" />
      <polygon points="100,100 400,200 200,500" fill="#f59e0b" />
    </svg>
  `);
  const initialPng = await sharp(sampleSvg).png().toBuffer();

  const highQ = await ImageService.process(initialPng, {
    targetFormat: 'jpeg',
    quality: 95,
  });

  const lowQ = await ImageService.process(initialPng, {
    targetFormat: 'jpeg',
    quality: 30,
  });

  assert.ok(
    lowQ.processedBytes < highQ.processedBytes,
    `Low quality (${lowQ.processedBytes}b) should be smaller than high quality (${highQ.processedBytes}b)`
  );
});

test('ImageService: should reject invalid image buffer with descriptive error', async () => {
  const garbage = Buffer.from('this is not an image');
  await assert.rejects(
    async () => {
      await ImageService.inspect(garbage);
    },
    (err: any) => {
      return err.message.includes('Invalid or corrupt image file');
    }
  );
});

test('PdfService: should inspect, merge, and split PDF documents', async () => {
  // Create first PDF document (2 pages)
  const doc1 = await PDFDocument.create();
  doc1.addPage([500, 500]);
  doc1.addPage([500, 500]);
  const pdf1Bytes = Buffer.from(await doc1.save());

  // Create second PDF document (1 page)
  const doc2 = await PDFDocument.create();
  doc2.addPage([500, 500]);
  const pdf2Bytes = Buffer.from(await doc2.save());

  // Test inspection
  const info1 = await PdfService.inspect(pdf1Bytes);
  assert.strictEqual(info1.pageCount, 2);

  const info2 = await PdfService.inspect(pdf2Bytes);
  assert.strictEqual(info2.pageCount, 1);

  // Test Merge: 2 pages + 1 page = 3 pages
  const merged = await PdfService.merge([pdf1Bytes, pdf2Bytes]);
  assert.strictEqual(merged.pageCount, 3);
  assert.ok(merged.buffer.length > 0);

  // Test Split: extract page 2 from 3-page merged doc
  const splitSingle = await PdfService.split(merged.buffer, '2', 'test_doc.pdf');
  assert.strictEqual(splitSingle.isZip, false);
  assert.strictEqual(splitSingle.pageCount, 1);
  assert.ok(splitSingle.fileName.includes('page-2'));

  // Test Split: range validation
  await assert.rejects(
    async () => {
      await PdfService.split(merged.buffer, '10-12', 'test_doc.pdf');
    },
    (err: any) => {
      return err.message.includes('exceeds document page count');
    }
  );
});

test('FileStore: safely stores and deletes processed files', () => {
  const buffer = Buffer.from('test file content');
  const record = FileStore.saveFile(buffer, 'test-doc.txt', 'text/plain', 'txt', 'Test Operation');

  assert.ok(record.id);
  assert.strictEqual(record.sizeBytes, buffer.length);
  assert.ok(!record.fileName.includes('/'));

  const retrieved = FileStore.getFile(record.id);
  assert.ok(retrieved);
  assert.strictEqual(retrieved?.id, record.id);

  const deleted = FileStore.deleteFile(record.id);
  assert.strictEqual(deleted, true);
  assert.strictEqual(FileStore.getFile(record.id), undefined);
});
