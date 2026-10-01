import {
  ApprovalStatus,
  CRPriority,
  CRStatus,
  CRType,
} from '@prisma/client';

export { ApprovalStatus, CRPriority, CRStatus, CRType };

export interface CRStatsResponse {
  total: number;
  draft: number;
  pendingApproval: number;
  pendingModification: number;
  rejected: number;
  approved: number;
  approvedHours: number;
}

export interface CREffortRowItem {
  id?: string;
  role: string;
  estimatedHours: number;
  purchaseHours: number;
  notes?: string;
  order?: number;
}
