import { db } from './index.ts';
import { users, complaints, complaintLogs } from './schema.ts';
import { eq, desc, or, asc } from 'drizzle-orm';

export interface CreateComplaintInput {
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

export interface UpdateComplaintStatusInput {
  status: string;
  targetAgency: string;
  officialLetterNumber: string;
  adminNotes: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
}

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

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const defaultName = displayName || email.split('@')[0] || 'Aparat Kelurahan';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: defaultName,
        role: 'kasi_trantib',
        jabatan: 'Kasi Ketentraman & Ketertiban Umum',
        rtNumber: '014',
        rwNumber: '005',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Gagal memuat profil pengguna dari database.', { cause: error });
  }
}

export async function updateUserProfile(
  uid: string,
  updates: {
    fullName?: string;
    role?: string;
    jabatan?: string;
    rtNumber?: string;
    rwNumber?: string;
    phone?: string;
  }
) {
  try {
    const result = await db
      .update(users)
      .set({
        ...(updates.fullName !== undefined ? { fullName: updates.fullName } : {}),
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.jabatan !== undefined ? { jabatan: updates.jabatan } : {}),
        ...(updates.rtNumber !== undefined ? { rtNumber: updates.rtNumber } : {}),
        ...(updates.rwNumber !== undefined ? { rwNumber: updates.rwNumber } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      })
      .where(eq(users.uid, uid))
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Gagal memperbarui peran aparat di database.', { cause: error });
  }
}

export async function getPublicComplaintsAndTrack(query?: string) {
  try {
    const allRows = await db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.createdAt));

    const allLogs = await db
      .select()
      .from(complaintLogs)
      .orderBy(asc(complaintLogs.createdAt));

    const logsByComplaintId = new Map<number, typeof allLogs>();
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

    return filteredRows.map((row) => ({
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      logs: logsByComplaintId.get(row.id) || [],
    }));
  } catch (error) {
    console.error('Database query failed in getPublicComplaintsAndTrack:', error);
    throw new Error('Gagal mengambil data pelacakan pengaduan.', { cause: error });
  }
}

export async function createPublicComplaint(input: CreateComplaintInput) {
  try {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const ticketNumber = `FTL-${ym}-${randSuffix}`;

    const inserted = await db
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

    const createdComplaint = inserted[0];

    await db.insert(complaintLogs).values({
      complaintId: createdComplaint.id,
      status: createdComplaint.status,
      note:
        input.urgency === 'darurat'
          ? `Laporan DARURAT diterima dari ${createdComplaint.qrSourcePost} dan langsung masuk antrean prioritas Kasi Trantib & Posko Siaga.`
          : `Laporan warga berhasil diregistrasi melalui ${createdComplaint.qrSourcePost} dengan Nomor Tiket ${createdComplaint.ticketNumber}.`,
      actorName: 'Sistem E-Lapor Fatululi',
      actorRole: 'Registrasi Digital',
    });

    return createdComplaint;
  } catch (error) {
    console.error('Database query failed in createPublicComplaint:', error);
    throw new Error('Gagal menyimpan laporan pengaduan ke database.', { cause: error });
  }
}

export async function getAdminComplaints(userProfile: {
  role: string;
  rtNumber: string | null;
  rwNumber: string | null;
}) {
  try {
    const allRows = await db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.createdAt));

    const allLogs = await db
      .select()
      .from(complaintLogs)
      .orderBy(asc(complaintLogs.createdAt));

    const logsByComplaintId = new Map<number, typeof allLogs>();
    for (const log of allLogs) {
      const existing = logsByComplaintId.get(log.complaintId) || [];
      existing.push(log);
      logsByComplaintId.set(log.complaintId, existing);
    }

    const isRtOrRwOfficer =
      userProfile.role === 'ketua_rt' || userProfile.role === 'ketua_rw';

    return allRows.map((row) => {
      // Protect whistleblower identity from neighbor RT/RW heads if confidential
      const shouldMaskForLocalNeighbor = isRtOrRwOfficer && row.isConfidential;

      return {
        ...row,
        nik: shouldMaskForLocalNeighbor ? maskNik(row.nik) : row.nik,
        reporterName: shouldMaskForLocalNeighbor
          ? 'Warga Pelapor (Identitas Dilindungi Kelurahan)'
          : row.reporterName,
        reporterPhone: shouldMaskForLocalNeighbor
          ? 'Dirahasiakan (Akses Khusus Lurah/Kasi Trantib)'
          : row.reporterPhone,
        logs: logsByComplaintId.get(row.id) || [],
      };
    });
  } catch (error) {
    console.error('Database query failed in getAdminComplaints:', error);
    throw new Error('Gagal memuat daftar pengaduan untuk dashboard aparat.', { cause: error });
  }
}

export async function updateComplaintStatusAndLog(
  complaintId: number,
  input: UpdateComplaintStatusInput
) {
  try {
    const now = new Date();
    let letterNo = input.officialLetterNumber.trim();
    if (!letterNo && (input.status === 'diteruskan_instansi' || input.status === 'selesai')) {
      const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      const monthRoman = romanMonths[now.getMonth()];
      letterNo = `400.10.2/${100 + complaintId}/KEL-FTL/${monthRoman}/${now.getFullYear()}`;
    }

    const updated = await db
      .update(complaints)
      .set({
        status: input.status,
        targetAgency: input.targetAgency,
        officialLetterNumber: letterNo,
        adminNotes: input.adminNotes,
        verifiedByUid: input.actorUid,
        verifiedByName: `${input.actorName} (${input.actorRole})`,
        updatedAt: now,
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    if (!updated.length) {
      throw new Error('Data pengaduan tidak ditemukan.');
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

    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateComplaintStatusAndLog:', error);
    throw new Error('Gagal memperbarui status pengaduan di database.', { cause: error });
  }
}
