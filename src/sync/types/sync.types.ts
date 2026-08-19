import { Prisma } from '@prisma/client';

export interface SourceUser extends Prisma.JsonObject {
  id: string | number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  designation: string | null;
  avatarUrl: string | null;
  // created_at: Date | string | null;
  // updated_at: Date | string | null;
  status?: string | boolean | null;
  isActive: boolean;
}

export interface SyncSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface SyncResponse {
  success: boolean;
  syncHistoryId: string;
  summary: SyncSummary;
}
