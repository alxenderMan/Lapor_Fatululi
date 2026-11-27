import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  updateUserProfile,
  getAdminComplaints,
} from './src/db/repository.ts';
import {
  fetchComplaintsFromPostgres,
  saveComplaintToPostgres,
  updateComplaintStatusInPostgres,
  registerOfficerInPostgres,
  loginOfficerFromPostgres,
} from './src/services/postgresComplaintService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // 0. SEO Endpoints: Google Search Console verification, robots.txt & sitemap.xml
  app.get('/google6432c421dd182b92.html', (_req, res) => {
    res.type('text/html').send('google-site-verification: google6432c421dd182b92.html');
  });

  app.get('/robots.txt', (req, res) => {
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const today = new Date().toISOString().split('T')[0];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
  });

  const VALID_OFFICER_TOKENS = new Set([
    'FTL-SEC-LURAH-2026',
    'FTL-SEC-TRANTIB-2026',
    'FTL-SEC-ADMIN-2026',
    'FTL-SEC-RT012-2026',
    'FTL-SEC-GOOGLE-ADMIN',
    'FTL-SEC-CUSTOM-2026',
  ]);

  const OFFICE_REGISTRATION_CODE = 'FATULULI-2026';

  // 0b. Officer Account Registration (Backed by Cloud SQL PostgreSQL via Drizzle)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const {
        username,
        nipOrCode,
        password,
        name,
        jabatan,
        role,
        rtScope,
        officeRegistrationCode,
      } = req.body || {};

      if (String(officeRegistrationCode || '').trim().toUpperCase() !== OFFICE_REGISTRATION_CODE) {
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

      const account = await registerOfficerInPostgres({
        username: cleanUser,
        nipOrCode: cleanNip,
        password: cleanPass,
        name: cleanName,
        jabatan: defaultJabatan,
        role: validRole,
        rtScope: rtVal,
      });

      return res.status(201).json({ account });
    } catch (error: any) {
      console.error('Error in POST /api/auth/register:', error);
      return res.status(400).json({ error: error.message || 'Gagal mendaftarkan akun petugas.' });
    }
  });

  // 0c. Officer Account Login (Backed by Cloud SQL PostgreSQL via Drizzle)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { usernameOrNip, password } = req.body || {};
      const cleanInput = String(usernameOrNip || '').trim();
      const cleanPass = String(password || '').trim();

      if (!cleanInput || !cleanPass) {
        return res.status(400).json({ error: 'Username/NIP dan Kata Sandi wajib diisi.' });
      }

      const account = await loginOfficerFromPostgres(cleanInput, cleanPass);
      if (account) {
        return res.status(200).json({ account });
      }

      return res.status(401).json({
        error: 'Username/NIP atau Kata Sandi tidak ditemukan.',
      });
    } catch (error: any) {
      console.error('Error in POST /api/auth/login:', error);
      return res.status(500).json({ error: error.message || 'Gagal memverifikasi akun petugas.' });
    }
  });

  const submissionTimestampsByIp = new Map<string, number[]>();

  // 1. Public API: List & Track Complaints by Ticket Number or 16-digit NIK via PostgreSQL Service Layer
  app.get('/api/complaints/track', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const items = await fetchComplaintsFromPostgres(q);
      res.json({ items });
    } catch (error: any) {
      console.error('Error in GET /api/complaints/track:', error);
      res.status(500).json({ error: error.message || 'Gagal memuat data pengaduan.' });
    }
  });

  // 2. Public API: Submit a New Citizen Complaint (with 16-digit NIK verification & Anti-Spam Rate Limiting)
  app.post('/api/complaints', async (req, res) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const nowMs = Date.now();
      const recentSubmissions = (submissionTimestampsByIp.get(clientIp) || []).filter(
        (ts) => nowMs - ts < 60_000
      );
      if (recentSubmissions.length >= 4) {
        return res.status(429).json({
          error:
            'Batas Pengiriman Tercapai: Mohon tunggu 1 menit sebelum mengirim laporan baru untuk mencegah spam.',
        });
      }

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

      if (photoDataUrl && String(photoDataUrl).length > 4_500_000) {
        return res.status(400).json({
          error: 'Ukuran foto bukti terlalu besar (maksimal 3 MB).',
        });
      }

      recentSubmissions.push(nowMs);
      submissionTimestampsByIp.set(clientIp, recentSubmissions);

      const created = await saveComplaintToPostgres({
        nik: cleanNik,
        reporterName: String(reporterName),
        reporterPhone: String(reporterPhone),
        rtNumber: String(rtNumber),
        rwNumber: String(rwNumber),
        addressDetail: String(addressDetail || `RT ${rtNumber} / RW ${rwNumber}, Kelurahan Fatululi`),
        category: String(category || 'umum_lingkungan'),
        subCategory: String(subCategory || 'Layanan Umum Lingkungan'),
        urgency: String(urgency || 'normal'),
        isConfidential: Boolean(isConfidential),
        title: String(title),
        description: String(description),
        photoDataUrl: String(photoDataUrl || ''),
        qrSourcePost: String(qrSourcePost || 'PORTAL-UTAMA'),
      });

      res.status(201).json({ complaint: created });
    } catch (error: any) {
      console.error('Error in POST /api/complaints:', error);
      res.status(500).json({ error: error.message || 'Gagal mengirim pengaduan warga.' });
    }
  });

  // 3. Protected Multi-User API: Get or Initialize Officer / RT-RW Profile
  app.get('/api/admin/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'aparat@fatululi.kupangkota.go.id';
      const name = req.user!.name;
      const profile = await getOrCreateUser(uid, email, name);
      res.json({ profile });
    } catch (error: any) {
      console.error('Error in GET /api/admin/me:', error);
      res.status(500).json({ error: error.message || 'Gagal memuat profil aparat.' });
    }
  });

  // 4. Protected Multi-User API: Update Active Role (Lurah / Kasi Trantib / Ketua RT / Ketua RW)
  app.patch('/api/admin/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const { fullName, role, jabatan, rtNumber, rwNumber, phone } = req.body || {};
      const updated = await updateUserProfile(uid, {
        fullName,
        role,
        jabatan,
        rtNumber,
        rwNumber,
        phone,
      });
      res.json({ profile: updated });
    } catch (error: any) {
      console.error('Error in PATCH /api/admin/me:', error);
      res.status(500).json({ error: error.message || 'Gagal memperbarui peran pengguna.' });
    }
  });

  // 5. Protected Multi-User API: Fetch Complaints for Dashboard Verification & PDF Export
  app.get('/api/admin/complaints', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'aparat@fatululi.kupangkota.go.id';
      const profile = await getOrCreateUser(uid, email, req.user!.name);
      const items = await getAdminComplaints(profile);
      res.json({ items, profile });
    } catch (error: any) {
      console.error('Error in GET /api/admin/complaints:', error);
      res.status(500).json({ error: error.message || 'Gagal memuat daftar pengaduan admin.' });
    }
  });

  // 6. Protected Multi-User API: Verify & Update Status / Generate Official Letter Number
  app.patch('/api/admin/complaints/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const complaintId = Number(req.params.id);
      if (!complaintId || Number.isNaN(complaintId)) {
        return res.status(400).json({ error: 'ID pengaduan tidak valid.' });
      }

      const uid = req.user!.uid;
      const email = req.user!.email || 'aparat@fatululi.kupangkota.go.id';
      const profile = await getOrCreateUser(uid, email, req.user!.name);

      const { status, targetAgency, officialLetterNumber, adminNotes } = req.body || {};
      if (!status) {
        return res.status(400).json({ error: 'Status tindak lanjut wajib dipilih.' });
      }

      const updated = await updateComplaintStatusInPostgres(complaintId, {
        status: String(status),
        targetAgency: String(targetAgency || 'Internal Kelurahan Fatululi'),
        officialLetterNumber: String(officialLetterNumber || ''),
        adminNotes: String(adminNotes || ''),
        actorUid: uid,
        actorName: profile.fullName,
        actorRole: profile.jabatan,
      });

      res.json({ complaint: updated });
    } catch (error: any) {
      console.error('Error in PATCH /api/admin/complaints/:id/status:', error);
      res.status(500).json({ error: error.message || 'Gagal memperbarui status pengaduan.' });
    }
  });

  // 7. Protected Officer Action API: Update Status / Disposisi (Requires verified officer token)
  app.patch('/api/complaints/:id/status', async (req, res) => {
    try {
      const officerHeader = req.headers['x-officer-role'];
      const officerToken = String(req.headers['x-officer-token'] || '');
      const authHeader = req.headers.authorization;

      if ((!officerHeader || !VALID_OFFICER_TOKENS.has(officerToken)) && !authHeader) {
        return res.status(403).json({
          error: 'Akses Ditolak: Token otorisasi petugas tidak valid. Silakan login kembali sebagai Pegawai Kelurahan / Lurah.',
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

      const updated = await updateComplaintStatusInPostgres(complaintId, {
        status: String(status),
        targetAgency: String(targetAgency || 'Internal Kelurahan Fatululi'),
        officialLetterNumber: String(officialLetterNumber || ''),
        adminNotes: String(adminNotes || ''),
        actorUid: String(officerHeader || 'kasi-trantib-fatululi'),
        actorName: String(actorName || 'Kasi Trantib Fatululi'),
        actorRole: String(actorRole || 'Panel Pegawai & Lurah'),
      });

      res.json({ complaint: updated });
    } catch (error: any) {
      console.error('Error in PATCH /api/complaints/:id/status:', error);
      res.status(500).json({ error: error.message || 'Gagal memperbarui status pengaduan.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIPEMAS Fatululi Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
