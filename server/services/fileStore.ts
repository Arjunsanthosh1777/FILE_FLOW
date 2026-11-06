import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  operation: string;
}

const TEMP_DIR = path.resolve(process.cwd(), 'temp_storage');

// Ensure directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// In-memory catalog of stored files mapped to safe IDs
const fileRegistry = new Map<string, StoredFile>();

// Clean up files older than 1 hour periodically
const FILE_TTL_MS = 60 * 60 * 1000; // 1 hour

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, file] of fileRegistry.entries()) {
    if (now - file.createdAt > FILE_TTL_MS) {
      try {
        if (fs.existsSync(file.filePath)) {
          fs.unlinkSync(file.filePath);
        }
      } catch (err) {
        console.error(`Failed to clean up expired file ${id}:`, err);
      }
      fileRegistry.delete(id);
    }
  }
}, 15 * 60 * 1000); // Check every 15 minutes

cleanupInterval.unref();


export const FileStore = {
  /**
   * Save a processed buffer to temporary storage and return a safe file record.
   * Never exposes internal filesystem paths to the client.
   */
  saveFile(buffer: Buffer, originalName: string, mimeType: string, extension: string, operation: string): StoredFile {
    const id = crypto.randomUUID();
    const safeBase = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .slice(0, 50);
    const sanitizedFileName = `${safeBase}-${id.slice(0, 8)}.${extension.replace(/^\./, '')}`;
    const filePath = path.join(TEMP_DIR, sanitizedFileName);

    fs.writeFileSync(filePath, buffer);

    const record: StoredFile = {
      id,
      originalName,
      fileName: sanitizedFileName,
      filePath,
      mimeType,
      sizeBytes: buffer.length,
      createdAt: Date.now(),
      operation,
    };

    fileRegistry.set(id, record);
    return record;
  },

  getFile(id: string): StoredFile | undefined {
    return fileRegistry.get(id);
  },

  deleteFile(id: string): boolean {
    const file = fileRegistry.get(id);
    if (!file) return false;
    try {
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
    } catch (err) {
      console.error(`Failed to delete file ${id}:`, err);
    }
    fileRegistry.delete(id);
    return true;
  },

  clearAll(): number {
    let count = 0;
    for (const [id, file] of fileRegistry.entries()) {
      try {
        if (fs.existsSync(file.filePath)) {
          fs.unlinkSync(file.filePath);
        }
        count++;
      } catch (err) {
        console.error(`Failed to delete file ${id}:`, err);
      }
      fileRegistry.delete(id);
    }
    return count;
  },

  getAll(): StoredFile[] {
    return Array.from(fileRegistry.values());
  }
};
