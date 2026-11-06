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
      `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`
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

  // 2. Public API: Submit a New Citizen Complaint (with 16-digit NIK verification) via PostgreSQL Service Layer
  app.post('/api/complaints', async (req, res) => {
    try {
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

  // 7. Protected Officer Action API: Update Status / Disposisi (Blocked for unauthenticated public citizens)
  app.patch('/api/complaints/:id/status', async (req, res) => {
    try {
      const officerHeader = req.headers['x-officer-role'];
      const authHeader = req.headers.authorization;

      if (!officerHeader && !authHeader) {
        return res.status(403).json({
          error: 'Akses Ditolak: Warga tidak dapat mengubah data pengaduan. Silakan login sebagai Pegawai Kelurahan / Lurah.',
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
