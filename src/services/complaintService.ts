import {
  ComplaintItem,
  CreateComplaintPayload,
  CreateSubsidyComplaintPayload,
  UpdateComplaintStatusPayload,
} from '../types/complaint.ts';

/**
 * Fetches complaints from the PostgreSQL-backed API endpoint.
 * Supports optional ticket number or 16-digit NIK filtering.
 */
export async function fetchComplaints(query?: string): Promise<ComplaintItem[]> {
  const url = query
    ? `/api/complaints/track?q=${encodeURIComponent(query.trim())}`
    : '/api/complaints/track';

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Gagal memuat data pengaduan dari database PostgreSQL.');
  }

  return Array.isArray(data.items) ? (data.items as ComplaintItem[]) : [];
}

/**
 * Saves a general citizen complaint to the PostgreSQL database
 * and returns the newly created ComplaintItem.
 */
export async function saveComplaint(payload: CreateComplaintPayload): Promise<ComplaintItem> {
  const response = await fetch('/api/complaints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.complaint) {
    throw new Error(data.error || 'Gagal menyimpan pengaduan warga ke database PostgreSQL.');
  }

  return data.complaint as ComplaintItem;
}

/**
 * Saves a subsidy (kerosene / social aid) complaint to the PostgreSQL database
 * and returns the newly created ComplaintItem.
 */
export async function saveSubsidyComplaint(
  input: CreateSubsidyComplaintPayload
): Promise<ComplaintItem> {
  return saveComplaint({
    nik: input.nik,
    reporterName: 'Warga Pelapor Subsidi',
    reporterPhone: '081239001122',
    rtNumber: input.rtNumber,
    rwNumber: input.rwNumber,
    addressDetail: input.addressDetail,
    category: 'subsidi_minyak_tanah',
    subCategory: 'Subsidi Minyak',
    urgency: 'tinggi',
    isConfidential: false,
    title: `${input.kendalaDistribusi} — ${input.pangkalanLabel}`,
    description: input.description.trim(),
    qrSourcePost: `Pos RT ${input.rtNumber} / RW ${input.rwNumber}`,
  });
}

/**
 * Updates the status, referral agency, and mediation notes of an existing complaint
 * in the PostgreSQL database (requires authenticated Officer / Lurah role).
 */
export async function updateComplaintStatus(
  complaintId: number,
  payload: UpdateComplaintStatusPayload,
  officerRole: string
): Promise<ComplaintItem> {
  const response = await fetch(`/api/complaints/${complaintId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-officer-role': officerRole,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.complaint) {
    throw new Error(data.error || 'Gagal memperbarui status pengaduan di database PostgreSQL.');
  }

  return data.complaint as ComplaintItem;
}
