import { db } from '../db/index.ts';
import { complaints, complaintLogs } from '../db/schema.ts';
import { eq, desc, asc } from 'drizzle-orm';
import {
  ComplaintItem,
  ComplaintLogItem,
  CreateComplaintPayload,
  UpdateComplaintStatusPayload,
} from '../types/complaint.ts';

function maskNik(nik: string): string {
  if (!nik || nik.length < 10) return '537104**********';
  return `${nik.slice(0, 6)}******${nik.slice(-4)}`;
}

function maskName(name: string, isConfidential: boolean): string {
  if (isConfidential) {
    return 'Pelapor Rahasia (Dilindungi Kelurahan)';
  }
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p, idx) => (idx === 0 ? p : `${p.charAt(0)}.`))
    .join(' ');
}

function toIsoString(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapLogRowToItem(log: typeof complaintLogs.$inferSelect): ComplaintLogItem {
  return {
    id: log.id,
    complaintId: log.complaintId,
    status: log.status,
    note: log.note,
    actorName: log.actorName,
    actorRole: log.actorRole,
    createdAt: toIsoString(log.createdAt),
  };
}

function mapComplaintRowToItem(
  row: typeof complaints.$inferSelect,
  logs: (typeof complaintLogs.$inferSelect)[],
  isExactOwnerLookup = false
): ComplaintItem {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    nikMasked: maskNik(row.nik),
    reporterName:
      isExactOwnerLookup && !row.isConfidential
        ? row.reporterName
        : maskName(row.reporterName, row.isConfidential),
    rtNumber: row.rtNumber,
    rwNumber: row.rwNumber,
    addressDetail: row.isConfidential
      ? `Wilayah RT ${row.rtNumber} / RW ${row.rwNumber}, Kel. Fatululi (Lokasi Spesifik Dirahasiakan)`
      : row.addressDetail,
    category: row.category,
    subCategory: row.subCategory,
    urgency: row.urgency,
    isConfidential: row.isConfidential,
    title: row.title,
    description: row.description,
    photoDataUrl: row.photoDataUrl || '',
    qrSourcePost: row.qrSourcePost || 'PORTAL-UTAMA',
    status: row.status,
    targetAgency: row.targetAgency || 'Internal Kelurahan Fatululi',
    officialLetterNumber: row.officialLetterNumber || '',
    adminNotes: row.adminNotes || '',
    verifiedByName: row.verifiedByName || '',
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    logs: logs.map(mapLogRowToItem),
  };
}

/**
 * Fetches complaints and their timeline logs from the PostgreSQL database,
 * returning records aligned with the ComplaintItem interface.
 */
export async function fetchComplaintsFromPostgres(query?: string): Promise<ComplaintItem[]> {
  try {
    const allRows = await db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.createdAt));

    const allLogs = await db
      .select()
      .from(complaintLogs)
      .orderBy(asc(complaintLogs.createdAt));

    const logsByComplaintId = new Map<number, (typeof complaintLogs.$inferSelect)[]>();
    for (const log of allLogs) {
      const existing = logsByComplaintId.get(log.complaintId) || [];
      existing.push(log);
      logsByComplaintId.set(log.complaintId, existing);
    }

    const trimmedQuery = (query || '').trim().toUpperCase();

    const filteredRows = trimmedQuery
      ? allRows.filter(
          (row) =>
            row.ticketNumber.toUpperCase() === trimmedQuery ||
            row.ticketNumber.toUpperCase().includes(trimmedQuery) ||
            row.nik === trimmedQuery
        )
      : allRows;

    const isExactOwnerLookup =
      trimmedQuery.length === 16 ||
      allRows.some((r) => r.ticketNumber.toUpperCase() === trimmedQuery);

    return filteredRows.map((row) =>
      mapComplaintRowToItem(row, logsByComplaintId.get(row.id) || [], isExactOwnerLookup)
    );
  } catch (error) {
    console.error('PostgreSQL Service Error in fetchComplaintsFromPostgres:', error);
    throw new Error('Gagal mengambil data pengaduan dari database PostgreSQL.', { cause: error });
  }
}

/**
 * Saves a new citizen or subsidy complaint into the PostgreSQL database
 * along with its initial audit log, returning a complete ComplaintItem.
 */
export async function saveComplaintToPostgres(
  input: CreateComplaintPayload
): Promise<ComplaintItem> {
  try {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const ticketNumber = `FTL-${ym}-${randSuffix}`;

    const insertedComplaints = await db
      .insert(complaints)
      .values({
        ticketNumber,
        nik: input.nik.trim(),
        reporterName: input.reporterName.trim(),
        reporterPhone: input.reporterPhone.trim(),
        rtNumber: input.rtNumber.trim().padStart(3, '0'),
        rwNumber: input.rwNumber.trim().padStart(3, '0'),
        addressDetail: input.addressDetail.trim(),
        category: input.category,
        subCategory: input.subCategory,
        urgency: input.urgency,
        isConfidential: input.isConfidential || input.category === 'khusus_rahasia',
        title: input.title.trim(),
        description: input.description.trim(),
        photoDataUrl: input.photoDataUrl || '',
        qrSourcePost: input.qrSourcePost || 'PORTAL-UTAMA',
        status: input.urgency === 'darurat' ? 'ditinjau_kelurahan' : 'menunggu_verifikasi',
        targetAgency:
          input.category === 'musibah_darurat'
            ? 'BPBD Kota Kupang & Damkar'
            : input.category === 'subsidi_minyak_tanah'
            ? 'Disperindag Kota Kupang & Agen Pertamina'
            : input.category === 'khusus_rahasia'
            ? 'Polsek Oebobo & Kasi Trantib'
            : 'Internal Kelurahan Fatululi',
      })
      .returning();

    const createdRow = insertedComplaints[0];

    const insertedLogs = await db
      .insert(complaintLogs)
      .values({
        complaintId: createdRow.id,
        status: createdRow.status,
        note:
          input.urgency === 'darurat'
            ? `Laporan DARURAT diterima dari ${createdRow.qrSourcePost} dan langsung masuk antrean prioritas Kasi Trantib & Posko Siaga.`
            : `Laporan warga berhasil diregistrasi melalui ${createdRow.qrSourcePost} dengan Nomor Tiket ${createdRow.ticketNumber}.`,
        actorName: 'Sistem E-Lapor Fatululi',
        actorRole: 'Registrasi Digital',
      })
      .returning();

    return mapComplaintRowToItem(createdRow, insertedLogs, true);
  } catch (error) {
    console.error('PostgreSQL Service Error in saveComplaintToPostgres:', error);
    throw new Error('Gagal menyimpan laporan pengaduan ke database PostgreSQL.', { cause: error });
  }
}

/**
 * Updates the status, disposition agency, official referral letter number,
 * and mediation notes of a complaint in PostgreSQL and appends a log entry,
 * returning the updated ComplaintItem.
 */
export async function updateComplaintStatusInPostgres(
  complaintId: number,
  input: UpdateComplaintStatusPayload
): Promise<ComplaintItem> {
  try {
    const now = new Date();
    let letterNo = (input.officialLetterNumber || '').trim();
    if (!letterNo && (input.status === 'diteruskan_instansi' || input.status === 'selesai')) {
      const romanMonths = [
        'I',
        'II',
        'III',
        'IV',
        'V',
        'VI',
        'VII',
        'VIII',
        'IX',
        'X',
        'XI',
        'XII',
      ];
      const monthRoman = romanMonths[now.getMonth()];
      letterNo = `400.10.2/${100 + complaintId}/KEL-FTL/${monthRoman}/${now.getFullYear()}`;
    }

    const updatedRows = await db
      .update(complaints)
      .set({
        status: input.status,
        targetAgency: input.targetAgency,
        officialLetterNumber: letterNo,
        adminNotes: input.adminNotes,
        verifiedByUid: input.actorUid || 'aparat-fatululi',
        verifiedByName: `${input.actorName} (${input.actorRole})`,
        updatedAt: now,
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    if (!updatedRows.length) {
      throw new Error('Data pengaduan tidak ditemukan di database PostgreSQL.');
    }

    await db.insert(complaintLogs).values({
      complaintId,
      status: input.status,
      note:
        input.adminNotes.trim() ||
        `Status diperbarui menjadi ${input.status} dengan instansi tujuan ${input.targetAgency}.`,
      actorName: input.actorName,
      actorRole: input.actorRole,
    });

    const updatedLogs = await db
      .select()
      .from(complaintLogs)
      .where(eq(complaintLogs.complaintId, complaintId))
      .orderBy(asc(complaintLogs.createdAt));

    return mapComplaintRowToItem(updatedRows[0], updatedLogs, true);
  } catch (error) {
    console.error('PostgreSQL Service Error in updateComplaintStatusInPostgres:', error);
    throw new Error('Gagal memperbarui status pengaduan di database PostgreSQL.', {
      cause: error,
    });
  }
}
