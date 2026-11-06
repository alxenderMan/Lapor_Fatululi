import express, { Request, Response, NextFunction } from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { eq, desc, asc } from 'drizzle-orm';
import { Pool, type PoolConfig } from 'pg';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

// --- 1. Firebase Admin Setup (Safe for Serverless ESM) ---
if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'absolute-booth-qggh3',
  });
}
const adminAuth = getAuth();

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Tidak memiliki akses: Token autentikasi tidak ditemukan.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res
      .status(401)
      .json({ error: 'Tidak memiliki akses: Token tidak valid atau kedaluwarsa.' });
  }
};

// --- 2. Drizzle PostgreSQL Schema ---
const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('kasi_trantib'),
  jabatan: text('jabatan').notNull().default('Kasi Ketentraman & Ketertiban Umum'),
  rtNumber: text('rt_number').default('001'),
  rwNumber: text('rw_number').default('001'),
  phone: text('phone').default('0811-3800-112'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  nik: text('nik').notNull(),
  reporterName: text('reporter_name').notNull(),
  reporterPhone: text('reporter_phone').notNull(),
  rtNumber: text('rt_number').notNull(),
  rwNumber: text('rw_number').notNull(),
  addressDetail: text('address_detail').notNull(),
  category: text('category').notNull(),
  subCategory: text('sub_category').notNull(),
  urgency: text('urgency').notNull().default('normal'),
  isConfidential: boolean('is_confidential').notNull().default(false),
  title: text('title').notNull(),
  description: text('description').notNull(),
  photoDataUrl: text('photo_data_url'),
  qrSourcePost: text('qr_source_post').default('PORTAL-UTAMA'),
  status: text('status').notNull().default('menunggu_verifikasi'),
  targetAgency: text('target_agency').default('Internal Kelurahan Fatululi'),
  officialLetterNumber: text('official_letter_number'),
  adminNotes: text('admin_notes'),
  verifiedByUid: text('verified_by_uid'),
  verifiedByName: text('verified_by_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const complaintLogs = pgTable('complaint_logs', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id')
    .references(() => complaints.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- 3. Serverless PostgreSQL Connection Pool (Supabase / Cloud SQL) ---
declare global {
  var _vercelPostgresPool: Pool | undefined;
}

function buildServerlessPoolConfig(): PoolConfig {
  const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();
  const customDatabaseUrl = rawDatabaseUrl.replace(/:(\[)([^\]]+)(\])@/, ':$2@');

  if (customDatabaseUrl && customDatabaseUrl.startsWith('postgres')) {
    return {
      connectionString: customDatabaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 15000,
    };
  }

  return {
    host: process.env.SQL_HOST || 'localhost',
    port: Number(process.env.SQL_PORT || 5432),
    user: process.env.SQL_USER || 'postgres',
    password: process.env.SQL_PASSWORD || '',
    database: process.env.SQL_DB_NAME || 'postgres',
    ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 15000,
  };
}

function getDb() {
  if (!global._vercelPostgresPool) {
    global._vercelPostgresPool = new Pool(buildServerlessPoolConfig());
  }
  return drizzle(global._vercelPostgresPool, {
    schema: { users, complaints, complaintLogs },
  });
}

// --- 4. Helper Functions ---
function maskNik(nik: string): string {
  if (!nik || nik.length < 10) return '537104**********';
  return `${nik.slice(0, 6)}******${nik.slice(-4)}`;
}

function maskName(name: string, isConfidential: boolean): string {
  if (isConfidential) {
    return 'Pelapor Rahasia (Dilindungi Kelurahan)';
  }
  const parts = name.trim().split(/\s+/);
  return parts.map((p, idx) => (idx === 0 ? p : `${p.charAt(0)}.`)).join(' ');
}

function toIsoString(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapComplaintRow(
  row: typeof complaints.$inferSelect,
  logs: (typeof complaintLogs.$inferSelect)[],
  isExactOwnerLookup = false
) {
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
    logs: logs.map((l) => ({
      id: l.id,
      complaintId: l.complaintId,
      status: l.status,
      note: l.note,
      actorName: l.actorName,
      actorRole: l.actorRole,
      createdAt: toIsoString(l.createdAt),
    })),
  };
}

// --- 5. Express Application Routes ---
const app = express();
app.use(express.json({ limit: '10mb' }));

// Public API: List & Track Complaints
app.get('/api/complaints/track', async (req, res) => {
  try {
    const db = getDb();
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const allRows = await db.select().from(complaints).orderBy(desc(complaints.createdAt));
    const allLogs = await db.select().from(complaintLogs).orderBy(asc(complaintLogs.createdAt));

    const logsByComplaintId = new Map<number, (typeof complaintLogs.$inferSelect)[]>();
    for (const log of allLogs) {
      const existing = logsByComplaintId.get(log.complaintId) || [];
      existing.push(log);
      logsByComplaintId.set(log.complaintId, existing);
    }

    const trimmedQuery = q.trim().toUpperCase();
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

    const items = filteredRows.map((row) =>
      mapComplaintRow(row, logsByComplaintId.get(row.id) || [], isExactOwnerLookup)
    );

    res.json({ items });
  } catch (error: any) {
    console.error('Error in GET /api/complaints/track:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat data pengaduan.' });
  }
});

// Public API: Submit a New Citizen Complaint
app.post('/api/complaints', async (req, res) => {
  try {
    const db = getDb();
    const {
      nik,
      reporterName,
      reporterPhone,
      rtNumber,
      rwNumber,
      addressDetail,
      category,
      subCategory,
      urgency,
      isConfidential,
      title,
      description,
      photoDataUrl,
      qrSourcePost,
    } = req.body || {};

    const cleanNik = String(nik || '').replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      return res.status(400).json({
        error: 'Validasi Gagal: Nomor Induk Kependudukan (NIK) wajib berjumlah tepat 16 digit angka.',
      });
    }

    if (!reporterName || !reporterPhone || !rtNumber || !rwNumber || !title || !description) {
      return res.status(400).json({
        error: 'Validasi Gagal: Mohon lengkapi nama pelapor, nomor HP/WA, RT/RW, judul, dan kronologi pengaduan.',
      });
    }

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const ticketNumber = `FTL-${ym}-${randSuffix}`;
    const cat = String(category || 'umum_lingkungan');
    const urg = String(urgency || 'normal');

    const insertedComplaints = await db
      .insert(complaints)
      .values({
        ticketNumber,
        nik: cleanNik,
        reporterName: String(reporterName).trim(),
        reporterPhone: String(reporterPhone).trim(),
        rtNumber: String(rtNumber).trim().padStart(3, '0'),
        rwNumber: String(rwNumber).trim().padStart(3, '0'),
        addressDetail: String(
          addressDetail || `RT ${rtNumber} / RW ${rwNumber}, Kelurahan Fatululi`
        ).trim(),
        category: cat,
        subCategory: String(subCategory || 'Layanan Umum Lingkungan'),
        urgency: urg,
        isConfidential: Boolean(isConfidential) || cat === 'khusus_rahasia',
        title: String(title).trim(),
        description: String(description).trim(),
        photoDataUrl: String(photoDataUrl || ''),
        qrSourcePost: String(qrSourcePost || 'PORTAL-UTAMA'),
        status: urg === 'darurat' ? 'ditinjau_kelurahan' : 'menunggu_verifikasi',
        targetAgency:
          cat === 'musibah_darurat'
            ? 'BPBD Kota Kupang & Damkar'
            : cat === 'subsidi_minyak_tanah'
            ? 'Disperindag Kota Kupang & Agen Pertamina'
            : cat === 'khusus_rahasia'
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
          urg === 'darurat'
            ? `Laporan DARURAT diterima dari ${createdRow.qrSourcePost} dan langsung masuk antrean prioritas Kasi Trantib & Posko Siaga.`
            : `Laporan warga berhasil diregistrasi melalui ${createdRow.qrSourcePost} dengan Nomor Tiket ${createdRow.ticketNumber}.`,
        actorName: 'Sistem E-Lapor Fatululi',
        actorRole: 'Registrasi Digital',
      })
      .returning();

    res.status(201).json({ complaint: mapComplaintRow(createdRow, insertedLogs, true) });
  } catch (error: any) {
    console.error('Error in POST /api/complaints:', error);
    res.status(500).json({ error: error.message || 'Gagal mengirim pengaduan warga.' });
  }
});

// Protected Officer Action API: Update Status / Disposisi
app.patch('/api/complaints/:id/status', async (req, res) => {
  try {
    const db = getDb();
    const officerHeader = req.headers['x-officer-role'];
    const authHeader = req.headers.authorization;

    if (!officerHeader && !authHeader) {
      return res.status(403).json({
        error:
          'Akses Ditolak: Warga tidak dapat mengubah data pengaduan. Silakan login sebagai Pegawai Kelurahan / Lurah.',
      });
    }

    const complaintId = Number(req.params.id);
    if (!complaintId || Number.isNaN(complaintId)) {
      return res.status(400).json({ error: 'ID pengaduan tidak valid.' });
    }

    const { status, targetAgency, officialLetterNumber, adminNotes, actorName, actorRole } =
      req.body || {};
    if (!status) {
      return res.status(400).json({ error: 'Status tindak lanjut wajib dipilih.' });
    }

    const now = new Date();
    let letterNo = String(officialLetterNumber || '').trim();
    if (!letterNo && (status === 'diteruskan_instansi' || status === 'selesai')) {
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

    const aName = String(actorName || 'Kasi Trantib Fatululi');
    const aRole = String(actorRole || 'Panel Pegawai & Lurah');

    const updatedRows = await db
      .update(complaints)
      .set({
        status: String(status),
        targetAgency: String(targetAgency || 'Internal Kelurahan Fatululi'),
        officialLetterNumber: letterNo,
        adminNotes: String(adminNotes || ''),
        verifiedByUid: String(officerHeader || 'kasi-trantib-fatululi'),
        verifiedByName: `${aName} (${aRole})`,
        updatedAt: now,
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    if (!updatedRows.length) {
      return res.status(404).json({ error: 'Data pengaduan tidak ditemukan.' });
    }

    await db.insert(complaintLogs).values({
      complaintId,
      status: String(status),
      note:
        String(adminNotes || '').trim() ||
        `Status diperbarui menjadi ${status} dengan instansi tujuan ${targetAgency || 'Internal Kelurahan Fatululi'}.`,
      actorName: aName,
      actorRole: aRole,
    });

    const updatedLogs = await db
      .select()
      .from(complaintLogs)
      .where(eq(complaintLogs.complaintId, complaintId))
      .orderBy(asc(complaintLogs.createdAt));

    res.json({ complaint: mapComplaintRow(updatedRows[0], updatedLogs, true) });
  } catch (error: any) {
    console.error('Error in PATCH /api/complaints/:id/status:', error);
    res.status(500).json({ error: error.message || 'Gagal memperbarui status pengaduan.' });
  }
});

// Protected Multi-User API: Get or Initialize Officer Profile
app.get('/api/admin/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const uid = req.user!.uid;
    const email = req.user!.email || 'aparat@fatululi.kupangkota.go.id';
    const defaultName = req.user!.name || email.split('@')[0] || 'Aparat Kelurahan';
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
        set: { email },
      })
      .returning();
    res.json({ profile: result[0] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/me:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat profil aparat.' });
  }
});

export default app;
