import pg from 'pg';

const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    const rawUrl = (process.env.DATABASE_URL || '').trim();
    const cleanUrl = rawUrl.replace(/:(\[)([^\]]+)(\])@/, ':$2@');

    pool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

// Resilient In-Memory Fallback (Used automatically if Supabase free-tier database is paused)
let fallbackComplaints = [
  {
    id: 1,
    ticketNumber: 'FTL-045',
    nikMasked: '537104******0003',
    reporterName: 'Yohanes B.',
    rtNumber: '003',
    rwNumber: '001',
    addressDetail: 'Jl. Kali Dendeng RT 003 / RW 001, Kel. Fatululi',
    category: 'musibah_darurat',
    subCategory: 'Musibah / Darurat',
    urgency: 'darurat',
    isConfidential: false,
    title: 'Genangan Banjir & Pohon Tumbang di Sekitar Kali Dendeng',
    description:
      'Air meluap ke badan jalan dan dahan pohon besar menutup akses warga RT 003 / RW 001.',
    photoDataUrl: '',
    qrSourcePost: 'Pos RT 003 / RW 001',
    status: 'ditinjau_kelurahan',
    targetAgency: 'BPBD Kota Kupang & Damkar',
    officialLetterNumber: '400.10.2/101/KEL-FTL/XI/2026',
    adminNotes: 'Tim Kasi Trantib telah berkoordinasi dengan Posko BPBD Kota Kupang.',
    verifiedByName: 'Melkianus Bria, S.Sos (Kasi Trantib Fatululi)',
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    logs: [
      {
        id: 1,
        complaintId: 1,
        status: 'ditinjau_kelurahan',
        note: 'Laporan DARURAT diterima dari Pos RT 003 / RW 001 dan langsung masuk antrean prioritas Kasi Trantib & Posko Siaga.',
        actorName: 'Sistem E-Lapor Fatululi',
        actorRole: 'Registrasi Digital',
        createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      },
    ],
  },
  {
    id: 2,
    ticketNumber: 'FTL-2026-042',
    nikMasked: '537104******0001',
    reporterName: 'Pelapor Rahasia (Dilindungi Kelurahan)',
    rtNumber: '012',
    rwNumber: '004',
    addressDetail: 'Wilayah RT 012 / RW 004, Kel. Fatululi (Lokasi Spesifik Dirahasiakan)',
    category: 'khusus_rahasia',
    subCategory: 'Khusus / Sensitif',
    urgency: 'tinggi',
    isConfidential: true,
    title: 'Gangguan Ketertiban Malam & Aktivitas Meresahkan Warga',
    description:
      'Mohon patroli gabungan Polsek Oebobo dan Trantib Kelurahan pada jam malam di sekitar jalur kos RT 012.',
    photoDataUrl: '',
    qrSourcePost: 'Barcode Pos RT 012',
    status: 'koordinasi_rt_rw',
    targetAgency: 'Kepolisian Sektor (Polsek Oebobo) / Bhabinkamtibmas',
    officialLetterNumber: '',
    adminNotes: 'Identitas pelapor dirahasiakan; koordinasi tertutup dengan Bhabinkamtibmas.',
    verifiedByName: 'Melkianus Bria, S.Sos (Kasi Trantib Fatululi)',
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    logs: [
      {
        id: 2,
        complaintId: 2,
        status: 'koordinasi_rt_rw',
        note: 'Diverifikasi oleh Kasi Trantib Fatululi untuk patroli bersama Bhabinkamtibmas.',
        actorName: 'Melkianus Bria, S.Sos',
        actorRole: 'Kasi Trantib Fatululi',
        createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      },
    ],
  },
  {
    id: 3,
    ticketNumber: 'FTL-039',
    nikMasked: '537104******0008',
    reporterName: 'Maria F.',
    rtNumber: '008',
    rwNumber: '003',
    addressDetail: 'RT 008 / RW 003 • Pangkalan Oebobo',
    category: 'subsidi_minyak_tanah',
    subCategory: 'Subsidi Minyak',
    urgency: 'tinggi',
    isConfidential: false,
    title: 'Stok Kosong / Harga di Atas HET — Pangkalan Oebobo (RT 008 / RW 003)',
    description:
      'Kuota minyak tanah subsidi cepat habis sebelum warga RT 008 terlayani seluruhnya.',
    photoDataUrl: '',
    qrSourcePost: 'Pos RT 008 / RW 003',
    status: 'menunggu_verifikasi',
    targetAgency: 'Disperindag Kota Kupang & Agen Pertamina',
    officialLetterNumber: '',
    adminNotes: 'Menunggu jadwal inspeksi lapangan ke pangkalan.',
    verifiedByName: '',
    createdAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
    logs: [
      {
        id: 3,
        complaintId: 3,
        status: 'menunggu_verifikasi',
        note: 'Laporan distribusi minyak tanah subsidi teregistrasi.',
        actorName: 'Sistem E-Lapor Fatululi',
        actorRole: 'Registrasi Digital',
        createdAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
      },
    ],
  },
  {
    id: 4,
    ticketNumber: 'FTL-035',
    nikMasked: '537104******0002',
    reporterName: 'Kornelis N.',
    rtNumber: '015',
    rwNumber: '005',
    addressDetail: 'RT 015 / RW 005 Kel. Fatululi',
    category: 'umum_lingkungan',
    subCategory: 'Umum / Batas Tanah',
    urgency: 'normal',
    isConfidential: false,
    title: 'Sengketa Batas Lahan Pekarangan & Saluran Air Warga',
    description:
      'Permohonan mediasi batas tanah dan perbaikan saluran drainase antar warga RT 015.',
    photoDataUrl: '',
    qrSourcePost: 'PORTAL-UTAMA',
    status: 'diteruskan_instansi',
    targetAgency: 'Internal Kelurahan Fatululi / Mediasi RT-RW',
    officialLetterNumber: '400.10.2/104/KEL-FTL/XI/2026',
    adminNotes: 'Surat Pengantar Mediasi telah diterbitkan dan ditandatangani Lurah Fatululi.',
    verifiedByName: 'Yuliana Manafe, S.IP (Lurah Fatululi)',
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
    logs: [
      {
        id: 4,
        complaintId: 4,
        status: 'diteruskan_instansi',
        note: 'Surat Pengantar Mediasi resmi diterbitkan Kelurahan Fatululi.',
        actorName: 'Yuliana Manafe, S.IP',
        actorRole: 'Lurah Fatululi',
        createdAt: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
      },
    ],
  },
];

let fallbackOfficers = [];

function maskNik(nik) {
  if (!nik || nik.length < 10) return '537104**********';
  return `${nik.slice(0, 6)}******${nik.slice(-4)}`;
}

function maskName(name, isConfidential) {
  if (isConfidential) {
    return 'Pelapor Rahasia (Dilindungi Kelurahan)';
  }
  const parts = String(name || '').trim().split(/\s+/);
  return parts.map((p, idx) => (idx === 0 ? p : `${p.charAt(0)}.`)).join(' ');
}

function toIsoString(val) {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapComplaintRow(row, logs, isExactOwnerLookup = false) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    nikMasked: maskNik(row.nik),
    reporterName:
      isExactOwnerLookup && !row.is_confidential
        ? row.reporter_name
        : maskName(row.reporter_name, row.is_confidential),
    rtNumber: row.rt_number,
    rwNumber: row.rw_number,
    addressDetail: row.is_confidential
      ? `Wilayah RT ${row.rt_number} / RW ${row.rw_number}, Kel. Fatululi (Lokasi Spesifik Dirahasiakan)`
      : row.address_detail,
    category: row.category,
    subCategory: row.sub_category,
    urgency: row.urgency,
    isConfidential: Boolean(row.is_confidential),
    title: row.title,
    description: row.description,
    photoDataUrl: row.photo_data_url || '',
    qrSourcePost: row.qr_source_post || 'PORTAL-UTAMA',
    status: row.status,
    targetAgency: row.target_agency || 'Internal Kelurahan Fatululi',
    officialLetterNumber: row.official_letter_number || '',
    adminNotes: row.admin_notes || '',
    verifiedByName: row.verified_by_name || '',
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    logs: (logs || []).map((l) => ({
      id: l.id,
      complaintId: l.complaint_id,
      status: l.status,
      note: l.note,
      actorName: l.actor_name,
      actorRole: l.actor_role,
      createdAt: toIsoString(l.created_at),
    })),
  };
}

export default async function handler(req, res) {
  try {
    const db = getPool();
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    // 0. Officer Account Registration & Login
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const {
        username,
        nipOrCode,
        password,
        name,
        jabatan,
        role,
        rtScope,
        officeRegistrationCode,
      } = body;

      if (String(officeRegistrationCode || '').trim().toUpperCase() !== 'FATULULI-2026') {
        return res.status(403).json({
          error:
            'Kode Otorisasi Kantor Kelurahan salah. Hubungi Lurah / Admin Utama untuk mendapatkan kode pendaftaran petugas.',
        });
      }

      const cleanUser = String(username || '').trim().toLowerCase();
      const cleanPass = String(password || '').trim();
      const cleanName = String(name || '').trim();
      const cleanNip = String(nipOrCode || cleanUser).trim();

      if (!cleanUser || cleanPass.length < 6 || !cleanName) {
        return res.status(400).json({
          error: 'Username, Nama Lengkap, dan Kata Sandi (minimal 6 karakter) wajib diisi.',
        });
      }

      const validRole = ['lurah', 'kasi_trantib', 'staf_admin', 'ketua_rt'].includes(role)
        ? role
        : 'staf_admin';
      const defaultJabatan =
        jabatan ||
        (validRole === 'lurah'
          ? 'Lurah Fatululi'
          : validRole === 'kasi_trantib'
          ? 'Kasi Trantib Fatululi'
          : validRole === 'ketua_rt'
          ? `Ketua RT ${String(rtScope || '001').padStart(3, '0')}`
          : 'Staf Administrasi Kelurahan');
      const rtVal = validRole === 'ketua_rt' ? String(rtScope || '012').padStart(3, '0') : '';

      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS officer_accounts (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            nip_or_code TEXT NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            jabatan TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'staf_admin',
            rt_scope TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
          );
        `);

        const existing = await db.query(
          'SELECT id FROM officer_accounts WHERE LOWER(username) = $1 OR LOWER(nip_or_code) = $2',
          [cleanUser, cleanNip.toLowerCase()]
        );
        if (existing.rows.length > 0) {
          return res.status(409).json({
            error: 'Username atau NIP tersebut sudah terdaftar. Silakan langsung masuk (Login).',
          });
        }

        const inserted = await db.query(
          `INSERT INTO officer_accounts (username, nip_or_code, password, full_name, jabatan, role, rt_scope)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [cleanUser, cleanNip, cleanPass, cleanName, defaultJabatan, validRole, rtVal]
        );

        const row = inserted.rows[0];
        return res.status(201).json({
          account: {
            id: `custom-${row.id}`,
            username: row.username,
            securityToken: 'FTL-SEC-CUSTOM-2026',
            name: row.full_name,
            jabatan: row.jabatan,
            role: row.role,
            nipOrCode: row.nip_or_code,
            rtScope: row.rt_scope || undefined,
          },
        });
      } catch {
        const memRow = {
          id: fallbackOfficers.length + 1,
          username: cleanUser,
          nipOrCode: cleanNip,
          password: cleanPass,
          name: cleanName,
          jabatan: defaultJabatan,
          role: validRole,
          rtScope: rtVal || undefined,
        };
        fallbackOfficers.push(memRow);
        return res.status(201).json({
          account: {
            id: `custom-${memRow.id}`,
            username: memRow.username,
            securityToken: 'FTL-SEC-CUSTOM-2026',
            name: memRow.name,
            jabatan: memRow.jabatan,
            role: memRow.role,
            nipOrCode: memRow.nipOrCode,
            rtScope: memRow.rtScope,
          },
        });
      }
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const cleanInput = String(body.usernameOrNip || '').trim().toLowerCase();
      const cleanPass = String(body.password || '').trim();

      if (!cleanInput || !cleanPass) {
        return res.status(400).json({ error: 'Username/NIP dan Kata Sandi wajib diisi.' });
      }

      try {
        const found = await db.query(
          `SELECT * FROM officer_accounts
           WHERE (LOWER(username) = $1 OR LOWER(nip_or_code) = $1) AND password = $2
           LIMIT 1`,
          [cleanInput, cleanPass]
        );

        if (found.rows.length > 0) {
          const row = found.rows[0];
          return res.status(200).json({
            account: {
              id: `custom-${row.id}`,
              username: row.username,
              securityToken: 'FTL-SEC-CUSTOM-2026',
              name: row.full_name,
              jabatan: row.jabatan,
              role: row.role,
              nipOrCode: row.nip_or_code,
              rtScope: row.rt_scope || undefined,
            },
          });
        }
      } catch {
        const memFound = fallbackOfficers.find(
          (a) =>
            (a.username.toLowerCase() === cleanInput ||
              a.nipOrCode.toLowerCase() === cleanInput) &&
            a.password === cleanPass
        );
        if (memFound) {
          return res.status(200).json({
            account: {
              id: `custom-${memFound.id}`,
              username: memFound.username,
              securityToken: 'FTL-SEC-CUSTOM-2026',
              name: memFound.name,
              jabatan: memFound.jabatan,
              role: memFound.role,
              nipOrCode: memFound.nipOrCode,
              rtScope: memFound.rtScope,
            },
          });
        }
      }

      return res.status(401).json({
        error: 'Username/NIP atau Kata Sandi tidak ditemukan.',
      });
    }

    // 1. GET /api/complaints/track
    if (req.method === 'GET' && pathname.startsWith('/api/complaints/track')) {
      const q = (urlObj.searchParams.get('q') || '').trim().toUpperCase();

      try {
        const complaintsRes = await db.query(
          'SELECT * FROM complaints ORDER BY created_at DESC'
        );
        const logsRes = await db.query(
          'SELECT * FROM complaint_logs ORDER BY created_at ASC'
        );

        const logsByComplaintId = new Map();
        for (const log of logsRes.rows) {
          const list = logsByComplaintId.get(log.complaint_id) || [];
          list.push(log);
          logsByComplaintId.set(log.complaint_id, list);
        }

        const allRows = complaintsRes.rows;
        const filteredRows = q
          ? allRows.filter(
              (r) =>
                String(r.ticket_number || '').toUpperCase() === q ||
                String(r.ticket_number || '').toUpperCase().includes(q) ||
                String(r.nik || '') === q
            )
          : allRows;

        const isExactOwnerLookup =
          q.length === 16 ||
          allRows.some((r) => String(r.ticket_number || '').toUpperCase() === q);

        const items = filteredRows.map((row) =>
          mapComplaintRow(row, logsByComplaintId.get(row.id) || [], isExactOwnerLookup)
        );

        return res.status(200).json({ items });
      } catch {
        const items = q
          ? fallbackComplaints.filter(
              (item) =>
                item.ticketNumber.toUpperCase() === q ||
                item.ticketNumber.toUpperCase().includes(q)
            )
          : fallbackComplaints;
        return res.status(200).json({ items });
      }
    }

    // 2. POST /api/complaints
    if (req.method === 'POST' && pathname === '/api/complaints') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
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
      } = body;

      const cleanNik = String(nik || '').replace(/\D/g, '');
      if (cleanNik.length !== 16) {
        return res.status(400).json({
          error:
            'Validasi Gagal: Nomor Induk Kependudukan (NIK) wajib berjumlah tepat 16 digit angka.',
        });
      }

      if (!reporterName || !reporterPhone || !rtNumber || !rwNumber || !title || !description) {
        return res.status(400).json({
          error:
            'Validasi Gagal: Mohon lengkapi nama pelapor, nomor HP/WA, RT/RW, judul, dan kronologi pengaduan.',
        });
      }

      if (photoDataUrl && String(photoDataUrl).length > 4500000) {
        return res.status(400).json({
          error: 'Ukuran foto bukti terlalu besar (maksimal 3 MB).',
        });
      }

      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
      const ticketNumber = `FTL-${ym}-${randSuffix}`;
      const cat = String(category || 'umum_lingkungan');
      const urg = String(urgency || 'normal');
      const conf = Boolean(isConfidential) || cat === 'khusus_rahasia';
      const initialStatus = urg === 'darurat' ? 'ditinjau_kelurahan' : 'menunggu_verifikasi';
      const targetAgency =
        cat === 'musibah_darurat'
          ? 'BPBD Kota Kupang & Damkar'
          : cat === 'subsidi_minyak_tanah'
          ? 'Disperindag Kota Kupang & Agen Pertamina'
          : cat === 'khusus_rahasia'
          ? 'Polsek Oebobo & Kasi Trantib'
          : 'Internal Kelurahan Fatululi';

      try {
        const insertRes = await db.query(
          `INSERT INTO complaints (
            ticket_number, nik, reporter_name, reporter_phone, rt_number, rw_number,
            address_detail, category, sub_category, urgency, is_confidential,
            title, description, photo_data_url, qr_source_post, status, target_agency
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          RETURNING *`,
          [
            ticketNumber,
            cleanNik,
            String(reporterName).trim(),
            String(reporterPhone).trim(),
            String(rtNumber).trim().padStart(3, '0'),
            String(rwNumber).trim().padStart(3, '0'),
            String(addressDetail || `RT ${rtNumber} / RW ${rwNumber}, Kelurahan Fatululi`).trim(),
            cat,
            String(subCategory || 'Layanan Umum Lingkungan'),
            urg,
            conf,
            String(title).trim(),
            String(description).trim(),
            String(photoDataUrl || ''),
            String(qrSourcePost || 'PORTAL-UTAMA'),
            initialStatus,
            targetAgency,
          ]
        );

        const createdRow = insertRes.rows[0];
        const logNote =
          urg === 'darurat'
            ? `Laporan DARURAT diterima dari ${createdRow.qr_source_post} dan langsung masuk antrean prioritas Kasi Trantib & Posko Siaga.`
            : `Laporan warga berhasil diregistrasi melalui ${createdRow.qr_source_post} dengan Nomor Tiket ${createdRow.ticket_number}.`;

        const logRes = await db.query(
          `INSERT INTO complaint_logs (complaint_id, status, note, actor_name, actor_role)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [
            createdRow.id,
            createdRow.status,
            logNote,
            'Sistem E-Lapor Fatululi',
            'Registrasi Digital',
          ]
        );

        return res
          .status(201)
          .json({ complaint: mapComplaintRow(createdRow, logRes.rows, true) });
      } catch {
        const newId = fallbackComplaints.length + 10;
        const createdItem = {
          id: newId,
          ticketNumber,
          nikMasked: maskNik(cleanNik),
          reporterName: conf
            ? 'Pelapor Rahasia (Dilindungi Kelurahan)'
            : String(reporterName).trim(),
          rtNumber: String(rtNumber).trim().padStart(3, '0'),
          rwNumber: String(rwNumber).trim().padStart(3, '0'),
          addressDetail: String(
            addressDetail || `RT ${rtNumber} / RW ${rwNumber}, Kelurahan Fatululi`
          ).trim(),
          category: cat,
          subCategory: String(subCategory || 'Layanan Umum Lingkungan'),
          urgency: urg,
          isConfidential: conf,
          title: String(title).trim(),
          description: String(description).trim(),
          photoDataUrl: String(photoDataUrl || ''),
          qrSourcePost: String(qrSourcePost || 'PORTAL-UTAMA'),
          status: initialStatus,
          targetAgency,
          officialLetterNumber: '',
          adminNotes: '',
          verifiedByName: '',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          logs: [
            {
              id: Date.now(),
              complaintId: newId,
              status: initialStatus,
              note: `Laporan warga berhasil diregistrasi dengan Nomor Tiket ${ticketNumber}.`,
              actorName: 'Sistem E-Lapor Fatululi',
              actorRole: 'Registrasi Digital',
              createdAt: now.toISOString(),
            },
          ],
        };
        fallbackComplaints = [createdItem, ...fallbackComplaints];
        return res.status(201).json({ complaint: createdItem });
      }
    }

    // 3. PATCH /api/complaints/:id/status
    const statusMatch = pathname.match(/^\/api\/complaints\/(\d+)\/status$/);
    if (req.method === 'PATCH' && statusMatch) {
      const validTokens = new Set([
        'FTL-SEC-LURAH-2026',
        'FTL-SEC-TRANTIB-2026',
        'FTL-SEC-ADMIN-2026',
        'FTL-SEC-RT012-2026',
        'FTL-SEC-GOOGLE-ADMIN',
        'FTL-SEC-CUSTOM-2026',
      ]);
      const officerHeader = req.headers['x-officer-role'];
      const officerToken = String(req.headers['x-officer-token'] || '');
      const authHeader = req.headers.authorization;

      if ((!officerHeader || !validTokens.has(officerToken)) && !authHeader) {
        return res.status(403).json({
          error:
            'Akses Ditolak: Token otorisasi petugas tidak valid. Silakan login kembali sebagai Pegawai Kelurahan / Lurah.',
        });
      }

      const complaintId = Number(statusMatch[1]);
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { status, targetAgency, officialLetterNumber, adminNotes, actorName, actorRole } =
        body;

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

      try {
        const updateRes = await db.query(
          `UPDATE complaints
           SET status = $1,
               target_agency = $2,
               official_letter_number = $3,
               admin_notes = $4,
               verified_by_uid = $5,
               verified_by_name = $6,
               updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [
            String(status),
            String(targetAgency || 'Internal Kelurahan Fatululi'),
            letterNo,
            String(adminNotes || ''),
            String(officerHeader || 'kasi-trantib-fatululi'),
            `${aName} (${aRole})`,
            complaintId,
          ]
        );

        if (!updateRes.rows.length) {
          return res.status(404).json({ error: 'Data pengaduan tidak ditemukan.' });
        }

        await db.query(
          `INSERT INTO complaint_logs (complaint_id, status, note, actor_name, actor_role)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            complaintId,
            String(status),
            String(adminNotes || '').trim() ||
              `Status diperbarui menjadi ${status} dengan instansi tujuan ${
                targetAgency || 'Internal Kelurahan Fatululi'
              }.`,
            aName,
            aRole,
          ]
        );

        const updatedLogs = await db.query(
          'SELECT * FROM complaint_logs WHERE complaint_id = $1 ORDER BY created_at ASC',
          [complaintId]
        );

        return res
          .status(200)
          .json({ complaint: mapComplaintRow(updateRes.rows[0], updatedLogs.rows, true) });
      } catch {
        const idx = fallbackComplaints.findIndex((c) => c.id === complaintId);
        const target = idx >= 0 ? fallbackComplaints[idx] : fallbackComplaints[0];
        const updatedItem = {
          ...target,
          status: String(status),
          targetAgency: String(targetAgency || 'Internal Kelurahan Fatululi'),
          officialLetterNumber: letterNo,
          adminNotes: String(adminNotes || ''),
          verifiedByName: `${aName} (${aRole})`,
          updatedAt: now.toISOString(),
          logs: [
            ...(target.logs || []),
            {
              id: Date.now(),
              complaintId: target.id,
              status: String(status),
              note:
                String(adminNotes || '').trim() ||
                `Status diperbarui menjadi ${status} dengan instansi tujuan ${
                  targetAgency || 'Internal Kelurahan Fatululi'
                }.`,
              actorName: aName,
              actorRole: aRole,
              createdAt: now.toISOString(),
            },
          ],
        };
        if (idx >= 0) {
          fallbackComplaints[idx] = updatedItem;
        }
        return res.status(200).json({ complaint: updatedItem });
      }
    }

    return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  } catch (error) {
    console.error('Vercel API Error:', error);
    return res.status(500).json({
      error: error.message || 'Terjadi kesalahan pada server database PostgreSQL.',
    });
  }
}
