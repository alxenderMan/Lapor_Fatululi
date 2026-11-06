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
      connectionTimeoutMillis: 15000,
    });
  }
  return pool;
}

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

    // 1. GET /api/complaints/track
    if (req.method === 'GET' && pathname.startsWith('/api/complaints/track')) {
      const q = (urlObj.searchParams.get('q') || '').trim().toUpperCase();

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
    }

    // 3. PATCH /api/complaints/:id/status
    const statusMatch = pathname.match(/^\/api\/complaints\/(\d+)\/status$/);
    if (req.method === 'PATCH' && statusMatch) {
      const officerHeader = req.headers['x-officer-role'];
      const authHeader = req.headers.authorization;

      if (!officerHeader && !authHeader) {
        return res.status(403).json({
          error:
            'Akses Ditolak: Warga tidak dapat mengubah data pengaduan. Silakan login sebagai Pegawai Kelurahan / Lurah.',
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
    }

    return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  } catch (error) {
    console.error('Vercel API Error:', error);
    return res.status(500).json({
      error: error.message || 'Terjadi kesalahan pada server database PostgreSQL.',
    });
  }
}
