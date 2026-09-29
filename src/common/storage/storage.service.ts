import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadedFileResult {
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

// Allowed MIME types for comment attachments
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
]);

// Max file size: 25 MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    const rawBaseUrl =
      process.env.UPLOADS_BASE_URL ??
      `http://localhost:${process.env.PORT ?? 5000}/api/uploads`;
    this.baseUrl = rawBaseUrl.replace(/\/+$/, '');

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory at: ${this.uploadDir}`);
    }
  }

  /**
   * Save a file buffer to disk and return its metadata.
   * Used when processing multipart/form-data uploads from Fastify.
   */
  async saveFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<UploadedFileResult> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        `File type '${mimeType}' is not allowed. Allowed types: images, PDF, Office docs, text, zip, video, audio.`,
      );
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      );
    }

    const ext = path.extname(originalName) || '';
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    this.logger.log(`Saved file: ${uniqueName} (${buffer.length} bytes)`);

    return {
      name: originalName,
      size: buffer.length,
      mimeType,
      url: `${this.baseUrl}/${uniqueName}`,
    };
  }

  /**
   * Delete a file from disk by its stored URL.
   */
  deleteFile(url: string): void {
    try {
      const filename = path.basename(url);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted file: ${filename}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file from URL: ${url}`, error);
    }
  }
}
