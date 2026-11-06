import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ComplaintRecordForPDF {
  id: number;
  ticketNumber: string;
  nik?: string;
  nikMasked?: string;
  reporterName: string;
  reporterPhone?: string;
  rtNumber: string;
  rwNumber: string;
  addressDetail: string;
  category: string;
  subCategory: string;
  urgency: string;
  isConfidential: boolean;
  title: string;
  description: string;
  qrSourcePost: string;
  status: string;
  targetAgency: string;
  officialLetterNumber: string;
  adminNotes: string;
  verifiedByName: string;
  createdAt: string | Date;
}

const CATEGORY_LABELS: Record<string, string> = {
  umum_lingkungan: 'Umum & Lingkungan (Batas Tanah / Polusi Ternak / Fasum)',
  khusus_rahasia: 'Khusus & Rahasia (Whistleblowing / Ketertiban)',
  subsidi_minyak_tanah: 'Khusus Subsidi (Distribusi & Antrean Minyak Tanah)',
  musibah_darurat: 'Musibah & Darurat (Kebakaran / Banjir / Bencana)',
};

const STATUS_LABELS: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  ditinjau_kelurahan: 'Sedang Ditinjau Kelurahan',
  koordinasi_rt_rw: 'Dikoordinasikan Bersama RT/RW',
  diteruskan_instansi: 'Diteruskan ke Instansi Lintas Sektoral',
  selesai: 'Selesai Ditindaklanjuti',
  ditolak: 'Ditolak / Tidak Valid',
};

export function generateOfficialReferralLetterPDF(
  item: ComplaintRecordForPDF,
  officerName = 'Yuliana Manafe, S.IP',
  officerTitle = 'Lurah Fatululi'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const letterNumber =
    item.officialLetterNumber ||
    `400.10.2/${100 + item.id}/KEL-FTL/X/${now.getFullYear()}`;

  // KOP SURAT RESMI PEMERINTAH KOTA KUPANG
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PEMERINTAH KOTA KUPANG', 105, 16, { align: 'center' });
  doc.setFontSize(13);
  doc.text('KECAMATAN OEBOBO', 105, 22, { align: 'center' });
  doc.setFontSize(15);
  doc.text('KELURAHAN FATULULI', 105, 28, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Jalan Frans Seda, Kelurahan Fatululi, Kecamatan Oebobo, Kota Kupang - NTT | Kode Pos 85111',
    105,
    33,
    { align: 'center' }
  );

  // Garis Ganda Kop Surat
  doc.setLineWidth(0.8);
  doc.line(20, 36, 190, 36);
  doc.setLineWidth(0.25);
  doc.line(20, 37.2, 190, 37.2);

  // Tempat & Tanggal Surat
  doc.setFontSize(10);
  doc.text(`Kupang, ${dateStr}`, 190, 45, { align: 'right' });

  // Metadata Surat
  doc.text('Nomor', 20, 48);
  doc.text(`: ${letterNumber}`, 45, 48);
  doc.text('Sifat', 20, 53);
  doc.text(
    `: ${
      item.urgency === 'darurat'
        ? 'Sangat Segera / Darurat'
        : item.isConfidential
        ? 'Rahasia / Penting'
        : 'Penting'
    }`,
    45,
    53
  );
  doc.text('Lampiran', 20, 58);
  doc.text(': 1 (Satu) Berkas Bukti Lapangan Digital', 45, 58);
  doc.text('Perihal', 20, 63);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `: Surat Pengantar Tindak Lanjut Pengaduan Masyarakat (${item.ticketNumber})`,
    45,
    63
  );

  // Tujuan Instansi Lintas Sektoral
  doc.setFont('helvetica', 'normal');
  doc.text('Kepada Yth.', 20, 74);
  doc.setFont('helvetica', 'bold');
  doc.text(`Kepala / Pimpinan ${item.targetAgency || 'Instansi Terkait'}`, 20, 79);
  doc.setFont('helvetica', 'normal');
  doc.text('di -', 20, 84);
  doc.setFont('helvetica', 'bold');
  doc.text('      KUPANG', 20, 89);

  // Paragraf Pembuka
  doc.setFont('helvetica', 'normal');
  const introText =
    'Dengan hormat, menindaklanjuti laporan masyarakat yang teregistrasi melalui Sistem Pengaduan Masyarakat Digital (SIPEMAS) Kelurahan Fatululi dan hasil verifikasi berjenjang bersama pengurus RT/RW setempat, bersama ini kami meneruskan rincian pengaduan warga untuk mendapatkan penanganan lintas sektoral sesuai kewenangan instansi:';
  const splitIntro = doc.splitTextToSize(introText, 170);
  doc.text(splitIntro, 20, 99);

  // Tabel Detail Pengaduan
  const reporterIdentity = item.isConfidential
    ? 'DIRAHASIAKAN (Perlindungan Saksi / Whistleblower Kelurahan Fatululi)'
    : `${item.reporterName} (NIK: ${item.nik || item.nikMasked || '-'})`;

  autoTable(doc, {
    startY: 114,
    margin: { left: 20, right: 20 },
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: 3,
      lineColor: [180, 190, 205],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 118 },
    },
    body: [
      ['Nomor Tiket & Kanal QR', `${item.ticketNumber} (${item.qrSourcePost || 'PORTAL-UTAMA'})`],
      ['Identitas Warga Pelapor', reporterIdentity],
      ['Wilayah RT / RW & Lokasi', `RT ${item.rtNumber} / RW ${item.rwNumber} — ${item.addressDetail}`],
      ['Kategori Pengaduan', CATEGORY_LABELS[item.category] || item.category],
      ['Sub-Kategori Masalah', item.subCategory],
      ['Tingkat Urgensi', item.urgency.toUpperCase()],
      ['Pokok Pengaduan', item.title],
      ['Uraian / Kronologi Lapangan', item.description],
      [
        'Catatan Verifikasi Kelurahan / RT-RW',
        item.adminNotes || 'Telah diverifikasi oleh aparat Kelurahan Fatululi untuk ditindaklanjuti.',
      ],
    ],
  });

  const finalY = (doc as any).lastAutoTable.finalY || 205;

  // Paragraf Penutup
  const closingText =
    'Demikian Surat Pengantar dan Laporan Resmi ini disampaikan sebagai bahan koordinasi dan tindak lanjut di lapangan. Atas perhatian dan kerja sama lintas sektoral dalam melayani masyarakat Kelurahan Fatululi, Kota Kupang, kami ucapkan terima kasih.';
  const splitClosing = doc.splitTextToSize(closingText, 170);
  doc.text(splitClosing, 20, finalY + 10);

  // Blok Tanda Tangan
  const signY = Math.min(finalY + 26, 245);
  doc.text('Mengetahui / Mengesahkan,', 130, signY);
  doc.setFont('helvetica', 'bold');
  doc.text('a.n. LURAH FATULULI', 130, signY + 5);
  doc.text(officerTitle.toUpperCase(), 130, signY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('[Dokumen Teregistrasi Secara Digital]', 130, signY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(officerName, 130, signY + 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Pemerintah Kota Kupang', 130, signY + 36);

  // Tembusan
  doc.setFontSize(8.5);
  doc.text('Tembusan disampaikan kepada Yth.:', 20, signY + 22);
  doc.text('1. Bapak Camat Oebobo Kota Kupang (sebagai laporan);', 20, signY + 27);
  doc.text(`2. Ketua RW ${item.rwNumber} / Ketua RT ${item.rtNumber} Kelurahan Fatululi;`, 20, signY + 32);
  doc.text('3. Arsip Digital SIPEMAS Kelurahan Fatululi.', 20, signY + 37);

  doc.save(`Surat_Pengantar_${item.ticketNumber}_Fatululi.pdf`);
}

export function generatePeriodicArchiveReportPDF(
  items: ComplaintRecordForPDF[],
  filterLabel = 'Semua Kategori & RT/RW',
  officerName = 'Melkianus Bria, S.Sos'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Kop Surat Landscape
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PEMERINTAH KOTA KUPANG — KECAMATAN OEBOBO — KELURAHAN FATULULI', 148.5, 14, {
    align: 'center',
  });
  doc.setFontSize(14);
  doc.text(
    'BUKU REGISTER DIGITAL & REKAPITULASI PENGADUAN MASYARAKAT',
    148.5,
    21,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Dokumen Pengganti Buku Pengaduan Fisik Manual | Filter Cakupan: ${filterLabel} | Dicetak: ${dateStr}`,
    148.5,
    27,
    { align: 'center' }
  );

  doc.setLineWidth(0.6);
  doc.line(14, 30, 283, 30);

  // Ringkasan Statistik
  const total = items.length;
  const selesai = items.filter((i) => i.status === 'selesai').length;
  const proses = items.filter(
    (i) =>
      i.status === 'ditinjau_kelurahan' ||
      i.status === 'koordinasi_rt_rw' ||
      i.status === 'diteruskan_instansi'
  ).length;
  const menunggu = items.filter((i) => i.status === 'menunggu_verifikasi').length;

  doc.setFontSize(9.5);
  doc.text(
    `Total Laporan Tercatat: ${total} Aduan   |   Dalam Tindak Lanjut / Koordinasi: ${proses}   |   Selesai: ${selesai}   |   Menunggu Verifikasi: ${menunggu}`,
    14,
    36
  );

  autoTable(doc, {
    startY: 40,
    margin: { left: 14, right: 14 },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    head: [
      [
        'No',
        'No. Tiket & Pos QR',
        'Tanggal',
        'Pelapor & NIK',
        'RT/RW',
        'Kategori & Sub-Kategori',
        'Pokok Aduan Warga',
        'Instansi Tujuan & No. Surat',
        'Status Akhir',
      ],
    ],
    body: items.map((item, index) => [
      String(index + 1),
      `${item.ticketNumber}\n(${item.qrSourcePost || 'PORTAL'})`,
      new Date(item.createdAt).toLocaleDateString('id-ID'),
      item.isConfidential
        ? 'PELAPOR RAHASIA\n(Whistleblowing)'
        : `${item.reporterName}\n${item.nik || item.nikMasked || ''}`,
      `RT ${item.rtNumber}\nRW ${item.rwNumber}`,
      `${item.subCategory}\n[${item.urgency.toUpperCase()}]`,
      item.title,
      `${item.targetAgency || '-'}\n${item.officialLetterNumber || '(Belum ada surat)'}`,
      STATUS_LABELS[item.status] || item.status,
    ]),
  });

  const finalY = Math.min(((doc as any).lastAutoTable?.finalY || 150) + 10, 175);
  doc.setFontSize(9.5);
  doc.text(`Kupang, ${dateStr}`, 225, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text('Petugas Pengelola Arsip SIPEMAS Kelurahan Fatululi,', 225, finalY + 5);
  doc.text(officerName, 225, finalY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text('Rekapitulasi Resmi untuk Pelaporan Pemerintah Kota Kupang', 14, finalY + 22);

  doc.save(`Buku_Register_Pengaduan_Fatululi_${now.toISOString().slice(0, 10)}.pdf`);
}
