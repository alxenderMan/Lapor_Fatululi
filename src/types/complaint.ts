import { ComplaintRecordForPDF } from '../utils/pdfGenerator.ts';

export interface ComplaintLogItem {
  id: number;
  complaintId: number;
  status: string;
  note: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

export interface ComplaintItem extends ComplaintRecordForPDF {
  photoDataUrl: string;
  updatedAt?: string;
  logs: ComplaintLogItem[];
}

export interface CreateComplaintPayload {
  nik: string;
  reporterName: string;
  reporterPhone: string;
  rtNumber: string;
  rwNumber: string;
  addressDetail: string;
  category: string;
  subCategory: string;
  urgency: string;
  isConfidential: boolean;
  title: string;
  description: string;
  photoDataUrl?: string;
  qrSourcePost?: string;
}

export interface CreateSubsidyComplaintPayload {
  nik: string;
  pangkalanLabel: string;
  rtNumber: string;
  rwNumber: string;
  addressDetail: string;
  kendalaDistribusi: string;
  description: string;
}

export interface UpdateComplaintStatusPayload {
  status: string;
  targetAgency: string;
  officialLetterNumber?: string;
  adminNotes: string;
  actorUid?: string;
  actorName: string;
  actorRole: string;
}
