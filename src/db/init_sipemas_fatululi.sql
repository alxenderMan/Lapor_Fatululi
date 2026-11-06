-- ============================================================================
-- SKRIP SQL INISIALISASI DATABASE POSTGRESQL: sipemas_fatululi
-- Cara Pakai di pgAdmin 4 / DBeaver:
-- 1. Buat database baru bernama: sipemas_fatululi
-- 2. Klik kanan pada database sipemas_fatululi -> pilih "Query Tool"
-- 3. Tempel (Paste) seluruh isi file ini lalu klik tombol Run / Execute (F5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'kasi_trantib',
  jabatan TEXT NOT NULL DEFAULT 'Kasi Ketentraman & Ketertiban Umum',
  rt_number TEXT DEFAULT '',
  rw_number TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  nik TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  rt_number TEXT NOT NULL,
  rw_number TEXT NOT NULL,
  address_detail TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_data_url TEXT DEFAULT '',
  qr_source_post TEXT DEFAULT 'PORTAL-UTAMA',
  status TEXT NOT NULL DEFAULT 'menunggu_verifikasi',
  target_agency TEXT DEFAULT 'Internal Kelurahan Fatululi',
  official_letter_number TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  verified_by_uid TEXT DEFAULT '',
  verified_by_name TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_logs (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Awal Contoh Pengaduan Kelurahan Fatululi
INSERT INTO complaints (
  ticket_number, nik, reporter_name, reporter_phone, rt_number, rw_number,
  address_detail, category, sub_category, urgency, is_confidential,
  title, description, qr_source_post, status, target_agency, official_letter_number, admin_notes
) VALUES
(
  'FTL-045', '5371040911880003', 'Yohanes B.', '081239481001', '003', '001',
  'Pos RT 003 / RW 001 • Ada Bukti Foto', 'musibah_darurat', 'Musibah / Darurat', 'darurat', FALSE,
  'Genangan Banjir & Pohon Tumbang',
  'Hujan deras menyebabkan genangan banjir dan pohon tumbang menutup akses jalan warga di sekitar Pos RT 003 / RW 001 Kelurahan Fatululi.',
  'Barcode Pos RT 003', 'ditinjau_kelurahan', 'BPBD Kota Kupang & Damkar', '',
  'Tim Kasi Trantib bersama Ketua RT 003 menyiapkan koordinasi cepat dengan BPBD & Damkar Kota Kupang.'
),
(
  'FTL-2026-042', '5371042107790002', 'Kornelis Ndun', '081239481002', '012', '004',
  'RT 012 / RW 004 • Koordinasi Ketua RT', 'khusus_rahasia', 'Khusus / Sensitif', 'tinggi', TRUE,
  'Keluhan Limbah & Bau Kandang Ternak Babi di Pemukiman Padat',
  'Laporan rahasia warga mengenai pembuangan limbah kandang ternak babi ke saluran drainase pemukiman padat RT 012 / RW 004.',
  'Barcode Pos RT 012', 'koordinasi_rt_rw', 'Internal Kelurahan Fatululi / Mediasi RT-RW', '',
  '29 Okt 2026, 10:00 WITA • Petugas Kasi Trantib bersama Ketua RT 012 sedang melakukan peninjauan ke lokasi pemilik ternak untuk penertiban saluran limbah.'
),
(
  'FTL-039', '5371045506920004', 'Maria L.', '081239481003', '008', '003',
  'RT 008 / RW 003 • Pangkalan Oebobo', 'subsidi_minyak_tanah', 'Subsidi Minyak', 'tinggi', FALSE,
  'Antrean & Kuota Minyak Tanah Habis',
  'Warga RT 008 melaporkan antrean panjang dan kuota minyak tanah subsidi cepat habis di Pangkalan Oebobo.',
  'Barcode Pos RT 008', 'koordinasi_rt_rw', 'Disperindag Kota Kupang & Agen Pertamina', '',
  'Verifikasi kuota distribusi bersama Ketua RT 008 pada Pangkalan Oebobo.'
),
(
  'FTL-035', '5371041203840005', 'Hendrikus T.', '081239481004', '015', '005',
  'RT 015 / RW 005 • Perlu Mediasi Lanjutan', 'umum_lingkungan', 'Umum / Batas Tanah', 'normal', FALSE,
  'Sengketa Patok Batas Tanah Warga',
  'Permohonan mediasi dan surat pengantar resmi terkait pergeseran patok batas pekarangan antarwarga di RT 015 / RW 005.',
  'Barcode Pos RT 015', 'diteruskan_instansi', 'Kepolisian Sektor (Polsek Oebobo) / Bhabinkamtibmas',
  '300.1.1/035/KEL-FTL/X/2026',
  'Mediasi tingkat RT/Kelurahan telah dilaksanakan, diterbitkan Surat Pengantar Resmi ke Bhabinkamtibmas Polsek Oebobo.'
)
ON CONFLICT (ticket_number) DO NOTHING;
