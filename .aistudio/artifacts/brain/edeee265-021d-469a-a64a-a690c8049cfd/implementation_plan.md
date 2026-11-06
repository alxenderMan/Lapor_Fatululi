# Integrasi Service Layer PostgreSQL & Konfigurasi Multi-Environment Database (SIPEMAS Fatululi)

Membangun lapisan layanan (*service layer*) terstruktur di sisi backend dan frontend untuk berinteraksi langsung dengan database PostgreSQL menggunakan kredensial `.env.example`, memastikan seluruh fungsi pengambilan (*fetch*), penyimpanan (*save*), dan pembaruan status pengaduan selaras penuh dengan definisi tipe `ComplaintItem` serta mudah diganti ke instance PostgreSQL mana pun.

### User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan arsitektur dan konfigurasi yang telah dikonfirmasi untuk diterapkan:

- **Keputusan Terkonfirmasi 1 (Dukungan Koneksi PostgreSQL Fleksibel)**: Konfigurasi koneksi database PostgreSQL mendukung **Google Cloud SQL otomatis** (via Unix socket `/cloudsql/...` atau variabel `SQL_*`) sekaligus mendukung **PostgreSQL eksternal/lokal kustom** melalui `DATABASE_URL` atau kombinasi `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, dan `SQL_SSL` yang didokumentasikan secara jelas di `.env.example`.
- **Keputusan Terkonfirmasi 2 (Service Layer Terpadu Frontend & Backend)**: Membuat modul *Service Layer* di sisi backend dan frontend yang mengenkapsulasi seluruh operasi baca/tulis pengaduan tanpa bergantung pada data statis/mock, serta mengembalikan objek yang tervalidasi penuh dengan kontrak tipe `ComplaintItem` dan `ComplaintLogItem`.

### 1. Overview & Core Concept

- **What It Does**:
  1. Memperluas `.env.example` dan pengelola koneksi *Connection Pool* PostgreSQL agar pengguna dapat langsung beralih ke database PostgreSQL sendiri (pgAdmin lokal, Docker, Supabase, Neon, atau Cloud SQL) hanya dengan mengubah variabel lingkungan tanpa menyentuh kode aplikasi.
  2. Menyediakan **Backend PostgreSQL Service Layer** yang memetakan baris tabel relasional `complaints` dan `complaint_logs` secara langsung menjadi struktur `ComplaintItem` yang konsisten (lengkap dengan `nikMasked`, `photoDataUrl`, `logs`, dan `createdAt` berformat string ISO).
  3. Menyediakan **Frontend Complaint Service Layer** yang menggantikan pemanggilan `fetch` mentah di komponen UI dengan fungsi bertipe kuat (`fetchComplaints`, `fetchComplaintByTicketOrNik`, `saveNewComplaint`, `saveSubsidyComplaint`, dan `updateComplaintStatus`).
- **Target Audience / Persona**:
  - **Pengembang / Mahasiswa**: Memudahkan pengembangan lanjutan, pengujian di PostgreSQL lokal, maupun perpindahan server database.
  - **Warga & Pegawai Kelurahan Fatululi**: Menjamin setiap laporan yang dikirim atau diverifikasi langsung dibaca dan ditulis dari database PostgreSQL secara *real-time*.
- **Key Value**: Pemisahan tanggung jawab (*Separation of Concerns*) yang bersih antara komponen tampilan React, lapisan layanan API/Database, dan skema PostgreSQL.

### 2. User Experience & Visual Design

- **Key User Flows**:
  - **Pemuatan & Pelacakan Data Real-Time**: Saat halaman dibuka atau warga mencari Nomor Tiket / NIK 16 digit, aplikasi memanggil fungsi layanan `fetchComplaints(query)` yang mengambil data langsung dari PostgreSQL dan merender tahapan penyelesaian secara akurat.
  - **Penyimpanan Laporan Umum & Subsidi**: Saat warga mengirim formulir pengaduan umum atau laporan khusus subsidi minyak tanah, aplikasi memanggil `saveNewComplaint()` / `saveSubsidyComplaint()`, memvalidasi NIK 16 digit, menyimpan baris baru beserta log tahap pertama ke PostgreSQL, dan langsung mengembalikan objek `ComplaintItem` lengkap untuk ditampilkan ke layar.
  - **Pembaruan Status oleh Aparat**: Saat Lurah, Kasi Trantib, atau Ketua RT memperbarui status mediasi atau menerbitkan surat pengantar, aplikasi memanggil `updateComplaintStatus()` yang mencatat perubahan ke tabel `complaints` dan `complaint_logs` di PostgreSQL.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Mempertahankan desain antarmuka *Lapor Fatululi* dan *Dashboard Admin Fatululi* yang bersih, responsif, dan bebas gangguan teknis.
  - *Color Palette & Mood*: Biru Instansi (`#1D4ED8`), Amber Layanan Subsidi (`#F59E0B`), dan Sidebar Gelap (`#111827`).
  - *Interactive Feedback & Motion*: Indikator pemuatan (*loading state*) dan notifikasi *toast* saat transaksi database PostgreSQL berhasil disimpan atau diperbarui.

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Koneksi PostgreSQL Dual-Mode (`DATABASE_URL` + Parameter `SQL_*`)**
  - *Chosen Approach*: Mendukung `DATABASE_URL` (format URI standar `postgresql://user:pass@host:5432/dbname`) sebagai prioritas kustom, dan otomatis menggunakan variabel `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` ketika berjalan di lingkungan Cloud SQL.
  - *Why*: Memungkinkan pengguna mengganti database ke PostgreSQL lokal (pgAdmin) maupun cloud (Supabase/Neon/Cloud SQL) hanya dengan menyalin satu baris URL koneksi di `.env`.
  - *Alternatives Considered*: Mengunci konfigurasi hanya pada format socket Cloud SQL — ditolak karena menyulitkan pengguna saat ingin mengganti ke database PostgreSQL lokal atau penyedia lain.
- **Decision 2: Kontrak Tipe `ComplaintItem` Tunggal di Seluruh Lapisan**
  - *Chosen Approach*: Mendefinisikan kontrak tipe bersama (`ComplaintItem`, `ComplaintLogItem`, `CreateComplaintPayload`, `UpdateComplaintStatusPayload`) yang digunakan secara konsisten oleh *Backend PostgreSQL Service*, *Express API Controller*, dan *Frontend Service Layer*.
  - *Why*: Mencegah ketidaksesuaian tipe data (*type mismatch*) seperti format tanggal, nilai `null` vs string kosong pada `photoDataUrl`, atau struktur array `logs`.

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                   KONFIGURASI ENVIRONMENT (.env.example)                  │
│  • Mode 1 (Custom PostgreSQL URI) : DATABASE_URL="postgresql://..."       │
│  • Mode 2 (Host/Port/Cloud SQL)   : SQL_HOST, SQL_PORT, SQL_USER,         │
│                                     SQL_PASSWORD, SQL_DB_NAME, SQL_SSL    │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                POSTGRESQL CONNECTION POOL & DRIZZLE ORM                   │
│  • Mendeteksi otomatis DATABASE_URL atau kredensial SQL_*                 │
│  • Mengelola pool koneksi PostgreSQL (tabel complaints & complaint_logs)  │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    BACKEND POSTGRESQL SERVICE LAYER                       │
│  • fetchComplaintsFromDb(query?)        -> Promise<ComplaintItem[]>       │
│  • saveComplaintToDb(payload)           -> Promise<ComplaintItem>         │
│  • updateComplaintStatusInDb(id, input) -> Promise<ComplaintItem>         │
│  • Memetakan baris SQL + relasi log ke bentuk persis ComplaintItem        │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ (REST JSON /api/complaints/*)
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND COMPLAINT SERVICE LAYER                      │
│  • fetchComplaints(searchQuery?)        -> Promise<ComplaintItem[]>       │
│  • createComplaint(payload)             -> Promise<ComplaintItem>         │
│  • createSubsidyComplaint(payload)      -> Promise<ComplaintItem>         │
│  • updateComplaintStatus(id, payload)   -> Promise<ComplaintItem>         │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                 KOMPONEN UI REACT (PORTAL WARGA & ADMIN)                  │
│  • Pelacakan Tiket & Form Subsidi   • Form Aduan Umum & QR Pos RT         │
│  • Dashboard Admin & Lurah          • Generator PDF Surat & Buku Arsip    │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State Alignment (`ComplaintItem`)**:
  - Setiap fungsi pembacaan dan penyimpanan di *Service Layer* menjamin pengembalian objek dengan properti yang selaras dengan `ComplaintItem`:
    - `id`, `ticketNumber`, `nikMasked`, `reporterName`, `rtNumber`, `rwNumber`, `addressDetail`
    - `category`, `subCategory`, `urgency`, `isConfidential`, `title`, `description`, `photoDataUrl`
    - `status`, `targetAgency`, `officialLetterNumber`, `adminNotes`, `verifiedByName`
    - `createdAt` & `updatedAt` (dikonversi menjadi string ISO yang konsisten), serta `logs: ComplaintLogItem[]` (lengkap ketika laporan baru disimpan maupun ketika status diperbarui).
