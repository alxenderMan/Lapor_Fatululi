import { db } from '../db/index.ts';
import { users, complaints, complaintLogs } from '../db/schema.ts';
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
 * Fetches complaints and their timeline logs directly from Cloud SQL PostgreSQL.
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
 * Saves a new citizen or subsidy complaint into Cloud SQL PostgreSQL.
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
 * and mediation notes of a complaint in Cloud SQL PostgreSQL.
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

/**
 * Registers a new officer account into the PostgreSQL users table via Drizzle ORM.
 */
export async function registerOfficerInPostgres(input: {
  username: string;
  nipOrCode: string;
  password: string;
  name: string;
  jabatan: string;
  role: string;
  rtScope: string;
}) {
  try {
    const uidKey = `acct-${input.username.toLowerCase()}`;
    const existingUsers = await db.select().from(users);
    const alreadyExists = existingUsers.some(
      (u) =>
        u.uid.toLowerCase() === uidKey ||
        u.email.toLowerCase() === input.username.toLowerCase() ||
        (u.rwNumber || '').toLowerCase() === input.nipOrCode.toLowerCase()
    );

    if (alreadyExists) {
      throw new Error('Username atau NIP tersebut sudah terdaftar. Silakan langsung masuk (Login).');
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: uidKey,
        email: input.username.toLowerCase(),
        fullName: input.name,
        role: input.role,
        jabatan: input.jabatan,
        rtNumber: input.rtScope,
        rwNumber: input.nipOrCode,
        phone: input.password,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.uid,
      username: row.email,
      securityToken: 'FTL-SEC-CUSTOM-2026',
      name: row.fullName,
      jabatan: row.jabatan,
      role: row.role,
      nipOrCode: row.rwNumber || row.email,
      rtScope: row.rtNumber || undefined,
    };
  } catch (error: any) {
    console.error('PostgreSQL Service Error in registerOfficerInPostgres:', error);
    throw new Error(error.message || 'Gagal mendaftarkan akun petugas di PostgreSQL.', {
      cause: error,
    });
  }
}

/**
 * Authenticates a registered officer account from the PostgreSQL users table via Drizzle ORM.
 */
export async function loginOfficerFromPostgres(usernameOrNip: string, password: string) {
  try {
    const cleanInput = usernameOrNip.trim().toLowerCase();
    const allUsers = await db.select().from(users);

    const matched = allUsers.find(
      (u) =>
        (u.email.toLowerCase() === cleanInput ||
          u.uid.toLowerCase() === `acct-${cleanInput}` ||
          (u.rwNumber || '').toLowerCase() === cleanInput) &&
        u.phone === password
    );

    if (!matched) {
      return null;
    }

    return {
      id: matched.uid,
      username: matched.email,
      securityToken: 'FTL-SEC-CUSTOM-2026',
      name: matched.fullName,
      jabatan: matched.jabatan,
      role: matched.role,
      nipOrCode: matched.rwNumber || matched.email,
      rtScope: matched.rtNumber || undefined,
    };
  } catch (error) {
    console.error('PostgreSQL Service Error in loginOfficerFromPostgres:', error);
    throw new Error('Gagal memverifikasi akun petugas di database PostgreSQL.', { cause: error });
  }
}
