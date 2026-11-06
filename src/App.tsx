import React, { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import {
  Upload,
  LogIn,
  LogOut,
  CheckCircle2,
  X,
  UserCheck,
  ChevronDown,
  Home,
  Bell,
  Search,
  FileText,
  ShieldAlert,
  Clock,
  MapPin,
  PhoneCall,
  QrCode,
  Send,
  Flame,
  Droplets,
  Users,
  EyeOff,
  Printer,
  Download,
  ArrowRight,
  Building2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  generateOfficialReferralLetterPDF,
  generatePeriodicArchiveReportPDF,
} from './utils/pdfGenerator.ts';
import { ComplaintItem } from './types/complaint.ts';
import {
  fetchComplaints,
  saveComplaint,
  saveSubsidyComplaint,
  updateComplaintStatus,
  registerOfficerAccount,
  loginOfficerAccount,
} from './services/complaintService.ts';

interface ActiveOfficerSession {
  id: string;
  username: string;
  password: string;
  securityToken: string;
  name: string;
  jabatan: string;
  role: 'lurah' | 'kasi_trantib' | 'staf_admin' | 'ketua_rt';
  nipOrCode: string;
  rtScope?: string;
}

type ScreenView = 'portal_warga' | 'login_aparat' | 'admin_panel';
type CitizenTab = 'buat_laporan' | 'lacak_status' | 'aduan_subsidi';

const AUTHORIZED_GOOGLE_EMAILS = new Set([
  'alxendergeghi@gmail.com',
  'lurah@fatululi.kupangkota.go.id',
  'admin@fatululi.kupangkota.go.id',
]);

const PRESET_OFFICER_ACCOUNTS: ActiveOfficerSession[] = [
  {
    id: 'lurah-fatululi',
    username: 'lurah',
    password: 'Fatululi#Lurah2026',
    securityToken: 'FTL-SEC-LURAH-2026',
    name: 'Yuliana Manafe, S.IP',
    jabatan: 'Lurah Fatululi',
    role: 'lurah',
    nipOrCode: '197808192005012008',
  },
  {
    id: 'kasi-trantib',
    username: 'trantib',
    password: 'Fatululi#Trantib2026',
    securityToken: 'FTL-SEC-TRANTIB-2026',
    name: 'Melkianus Bria, S.Sos',
    jabatan: 'Kasi Trantib Fatululi',
    role: 'kasi_trantib',
    nipOrCode: '198204122009031004',
  },
  {
    id: 'admin-kelurahan',
    username: 'admin',
    password: 'Fatululi#Admin2026',
    securityToken: 'FTL-SEC-ADMIN-2026',
    name: 'Hendrikus Lulan, A.Md',
    jabatan: 'Admin & Arsip Kelurahan',
    role: 'staf_admin',
    nipOrCode: '199110042015031002',
  },
  {
    id: 'ketua-rt-012',
    username: 'rt012',
    password: 'Fatululi#RT2026',
    securityToken: 'FTL-SEC-RT012-2026',
    name: 'Bpk. Petrus Tari (Ketua RT 012)',
    jabatan: 'Ketua RT 012 / RW 004',
    role: 'ketua_rt',
    nipOrCode: 'RT012-FATULULI',
    rtScope: '012',
  },
];

const PANGKALAN_OPTIONS = [
  {
    label: 'Pangkalan Oebobo (RT 008 / RW 003)',
    rt: '008',
    rw: '003',
    address: 'RT 008 / RW 003 • Pangkalan Oebobo',
  },
  {
    label: 'Pangkalan Jl. Frans Seda (RT 014 / RW 005)',
    rt: '014',
    rw: '005',
    address: 'RT 014 / RW 005 • Pangkalan Jl. Frans Seda',
  },
  {
    label: 'Pangkalan Pemukiman Padat (RT 012 / RW 004)',
    rt: '012',
    rw: '004',
    address: 'RT 012 / RW 004 • Pangkalan Fatululi Tengah',
  },
  {
    label: 'Pangkalan Kali Dendeng (RT 003 / RW 001)',
    rt: '003',
    rw: '001',
    address: 'RT 003 / RW 001 • Pangkalan Kali Dendeng',
  },
];

const AGENCY_LIST = [
  'Kepolisian Sektor (Polsek Oebobo) / Bhabinkamtibmas',
  'BPBD Kota Kupang & Damkar',
  'Dinas Pemadam Kebakaran Kota Kupang',
  'Dinas Sosial Kota Kupang',
  'Disperindag Kota Kupang & Agen Pertamina',
  'Dinas Lingkungan Hidup & Kebersihan Kota Kupang',
  'Internal Kelurahan Fatululi / Mediasi RT-RW',
];

const CATEGORY_CARDS = [
  {
    id: 'umum_lingkungan',
    title: 'Umum & Lingkungan',
    desc: 'Batas tanah, limbah ternak, drainase & fasilitas umum',
    icon: Users,
    activeClass: 'border-[#1D4ED8] bg-blue-50/70 text-[#1E40AF]',
  },
  {
    id: 'khusus_rahasia',
    title: 'Khusus / Rahasia',
    desc: 'Identitas pelapor disembunyikan penuh dari publik & tetangga',
    icon: EyeOff,
    activeClass: 'border-amber-500 bg-amber-50/70 text-amber-900',
  },
  {
    id: 'subsidi_minyak_tanah',
    title: 'Subsidi Minyak Tanah',
    desc: 'Antrean pangkalan, kelangkaan stok, atau harga di atas HET',
    icon: Droplets,
    activeClass: 'border-amber-600 bg-amber-50/80 text-amber-900',
  },
  {
    id: 'musibah_darurat',
    title: 'Musibah / Darurat',
    desc: 'Pohon tumbang, banjir, kebakaran & respon cepat lintas instansi',
    icon: Flame,
    activeClass: 'border-red-600 bg-red-50/70 text-red-900',
  },
];

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenView>('portal_warga');
  const [citizenTab, setCitizenTab] = useState<CitizenTab>('buat_laporan');

  // Officer Authentication State (Separates Public Citizen View vs Admin/Lurah Dashboard)
  const [officerSession, setOfficerSession] = useState<ActiveOfficerSession | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // Login & Registration Form State (Starts empty so public visitors cannot bypass authentication)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginNipInput, setLoginNipInput] = useState<string>('');
  const [loginPinInput, setLoginPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState<boolean>(false);

  // Registration Form State
  const [regName, setRegName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regNip, setRegNip] = useState<string>('');
  const [regRole, setRegRole] = useState<'lurah' | 'kasi_trantib' | 'staf_admin' | 'ketua_rt'>(
    'staf_admin'
  );
  const [regRtScope, setRegRtScope] = useState<string>('012');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regOfficeCode, setRegOfficeCode] = useState<string>('');

  // PostgreSQL Complaints State
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Citizen Tracking State
  const [searchInput, setSearchInput] = useState<string>('FTL-2026-042');
  const [trackedComplaint, setTrackedComplaint] = useState<ComplaintItem | null>(null);

  // Citizen Subsidy Form State
  const [selectedPangkalan, setSelectedPangkalan] = useState<string>(PANGKALAN_OPTIONS[0].label);
  const [kendalaDistribusi, setKendalaDistribusi] = useState<string>(
    'Stok Kosong / Harga di Atas HET / Kuota Warga'
  );
  const [subsidiNik, setSubsidiNik] = useState<string>('');
  const [subsidiKeterangan, setSubsidiKeterangan] = useState<string>('');
  const [submittingSubsidi, setSubmittingSubsidi] = useState<boolean>(false);
  const [subsidiFeedback, setSubsidiFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    ticket?: string;
  } | null>(null);

  // Citizen General Complaint Form State
  const [formNik, setFormNik] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formRt, setFormRt] = useState<string>('012');
  const [formRw, setFormRw] = useState<string>('004');
  const [formCategory, setFormCategory] = useState<string>('umum_lingkungan');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formPhoto, setFormPhoto] = useState<string>('');
  const [submittingGeneral, setSubmittingGeneral] = useState<boolean>(false);
  const [generalFeedback, setGeneralFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    ticket?: string;
  } | null>(null);
  const [selectedQrPosRt, setSelectedQrPosRt] = useState<string>('012');

  // Navigation & Admin Dashboard State
  const [adminSidebarMenu, setAdminSidebarMenu] = useState<string>('dashboard');
  const [isPublicMenuOpen, setIsPublicMenuOpen] = useState<boolean>(false);
  const [openSidebarGroups, setOpenSidebarGroups] = useState<{
    pengaduan: boolean;
    layanan: boolean;
  }>({
    pengaduan: true,
    layanan: false,
  });
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<string>('semua');
  const [adminRtFilter, setAdminRtFilter] = useState<string>('semua');
  const [selectedLetterTicketId, setSelectedLetterTicketId] = useState<number>(0);
  const [selectedLetterAgency, setSelectedLetterAgency] = useState<string>(AGENCY_LIST[0]);
  const [archivePeriod, setArchivePeriod] = useState<string>('Oktober 2026 (Bulanan)');
  const [archiveCategory, setArchiveCategory] = useState<string>('Semua Kategori & RT');
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [readNotifIds, setReadNotifIds] = useState<number[]>([]);
  const [hideUrgentBanner, setHideUrgentBanner] = useState<boolean>(false);

  // Status Update Modal for Admin Table Actions
  const [editingItem, setEditingItem] = useState<ComplaintItem | null>(null);
  const [modalStatus, setModalStatus] = useState<string>('koordinasi_rt_rw');
  const [modalAgency, setModalAgency] = useState<string>(AGENCY_LIST[0]);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [savingModal, setSavingModal] = useState<boolean>(false);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchComplaints();
      setComplaints(items);
      const defaultTracked =
        items.find((c: ComplaintItem) => c.ticketNumber === 'FTL-2026-042') ||
        items[0] ||
        null;
      setTrackedComplaint((prev) => {
        if (!prev) return defaultTracked;
        return items.find((c: ComplaintItem) => c.id === prev.id) || defaultTracked;
      });
      const ftl035 =
        items.find((c: ComplaintItem) => c.ticketNumber === 'FTL-035') || items[0];
      if (ftl035) {
        setSelectedLetterTicketId((prev) => prev || ftl035.id);
      }
    } catch (err) {
      console.error('Error loading complaints from PostgreSQL service:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const emailLower = (user.email || '').toLowerCase();
        const isWhitelisted =
          AUTHORIZED_GOOGLE_EMAILS.has(emailLower) ||
          emailLower.endsWith('@fatululi.kupangkota.go.id');

        if (!isWhitelisted) {
          await signOut(auth);
          setFirebaseUser(null);
          setOfficerSession(null);
          setLoginError(
            `Akses Ditolak: Email Google (${user.email}) tidak terdaftar sebagai Aparat Kelurahan Fatululi.`
          );
          return;
        }

        setFirebaseUser(user);
        const googleOfficer: ActiveOfficerSession = {
          id: user.uid,
          username: emailLower,
          password: '',
          securityToken: 'FTL-SEC-GOOGLE-ADMIN',
          name: user.displayName || 'Pegawai Kelurahan Fatululi',
          jabatan: 'Lurah / Kasi Trantib Fatululi',
          role: 'lurah',
          nipOrCode: user.email || 'NIP-TERVERIFIKASI',
        };
        setOfficerSession(googleOfficer);
        setActiveScreen('admin_panel');
      } else {
        setFirebaseUser(null);
      }
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 4000);
  };

  // Officer Login Handler (Checks Preset Accounts + PostgreSQL officer_accounts)
  const handleOfficerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputUser = loginNipInput.trim();
    const inputPass = loginPinInput.trim();

    if (!inputUser || !inputPass) {
      setLoginError('Mohon masukkan Username / NIP Aparat dan Kata Sandi.');
      return;
    }

    const matchedPreset = PRESET_OFFICER_ACCOUNTS.find(
      (acc) =>
        (acc.username.toLowerCase() === inputUser.toLowerCase() ||
          acc.nipOrCode.toLowerCase() === inputUser.toLowerCase()) &&
        acc.password === inputPass
    );

    if (matchedPreset) {
      setOfficerSession(matchedPreset);
      setLoginPinInput('');
      setAdminRtFilter(matchedPreset.rtScope || 'semua');
      setActiveScreen('admin_panel');
      showToast(`Selamat datang, ${matchedPreset.name} (${matchedPreset.jabatan}).`);
      return;
    }

    setSubmittingAuth(true);
    try {
      const dbAccount = await loginOfficerAccount(inputUser, inputPass);
      const customSession: ActiveOfficerSession = {
        id: dbAccount.id,
        username: dbAccount.username,
        password: '',
        securityToken: dbAccount.securityToken,
        name: dbAccount.name,
        jabatan: dbAccount.jabatan,
        role: dbAccount.role,
        nipOrCode: dbAccount.nipOrCode,
        rtScope: dbAccount.rtScope,
      };
      setOfficerSession(customSession);
      setLoginPinInput('');
      setAdminRtFilter(customSession.rtScope || 'semua');
      setActiveScreen('admin_panel');
      showToast(`Selamat datang, ${customSession.name} (${customSession.jabatan}).`);
    } catch (err: any) {
      setLoginError(
        err.message ||
          'Akses Ditolak: Username/NIP atau Kata Sandi Aparat tidak sesuai. Pastikan menggunakan akun resmi Kelurahan Fatululi.'
      );
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Officer Registration Handler (Saves new Officer Account to PostgreSQL)
  const handleOfficerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!regName.trim() || !regUsername.trim() || !regPassword.trim() || !regOfficeCode.trim()) {
      setLoginError('Mohon lengkapi Nama Lengkap, Username, Kata Sandi, dan Kode Otorisasi Kantor.');
      return;
    }

    if (regPassword.trim().length < 6) {
      setLoginError('Kata Sandi minimal 6 karakter.');
      return;
    }

    setSubmittingAuth(true);
    try {
      const jabatanMap: Record<string, string> = {
        lurah: 'Lurah Fatululi',
        kasi_trantib: 'Kasi Trantib Fatululi',
        staf_admin: 'Staf Administrasi Kelurahan',
        ketua_rt: `Ketua RT ${regRtScope.padStart(3, '0')} Fatululi`,
      };

      const created = await registerOfficerAccount({
        username: regUsername.trim(),
        nipOrCode: regNip.trim() || regUsername.trim().toUpperCase(),
        password: regPassword.trim(),
        name: regName.trim(),
        jabatan: jabatanMap[regRole] || 'Staf Administrasi Kelurahan',
        role: regRole,
        rtScope: regRole === 'ketua_rt' ? regRtScope.padStart(3, '0') : undefined,
        officeRegistrationCode: regOfficeCode.trim(),
      });

      const newSession: ActiveOfficerSession = {
        id: created.id,
        username: created.username,
        password: '',
        securityToken: created.securityToken,
        name: created.name,
        jabatan: created.jabatan,
        role: created.role,
        nipOrCode: created.nipOrCode,
        rtScope: created.rtScope,
      };

      setOfficerSession(newSession);
      setRegPassword('');
      setRegOfficeCode('');
      setAdminRtFilter(newSession.rtScope || 'semua');
      setActiveScreen('admin_panel');
      showToast(`Akun berhasil dibuat! Selamat datang, ${newSession.name}.`);
    } catch (err: any) {
      setLoginError(err.message || 'Gagal mendaftarkan akun baru.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleGoogleOfficerLogin = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch {
      setLoginError('Gagal masuk dengan Google. Silakan gunakan Login Akun Dinas di atas.');
    }
  };

  // Officer Logout Handler
  const handleOfficerLogout = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    setOfficerSession(null);
    setEditingItem(null);
    setActiveScreen('portal_warga');
    showToast('Sesi aparat telah ditutup. Kembali ke halaman publik.');
  };

  // Search Ticket Handler
  const handleSearchTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = searchInput.trim();
    const extractedCode = raw.split(' ')[0].replace(/^#/, '').toUpperCase();

    const found = complaints.find(
      (item) =>
        item.ticketNumber.toUpperCase() === extractedCode ||
        item.ticketNumber.toUpperCase().includes(extractedCode) ||
        raw.includes(item.ticketNumber) ||
        (raw.replace(/\D/g, '').length === 16 && item.nikMasked?.slice(0, 6) === raw.slice(0, 6))
    );

    setCitizenTab('lacak_status');
    if (found) {
      setTrackedComplaint(found);
      showToast(`Menampilkan progres tiket #${found.ticketNumber}`);
    } else if (complaints.length > 0) {
      showToast('Tiket tidak ditemukan, menampilkan contoh tiket #FTL-2026-042.');
    }
  };

  // Submit Subsidy Form Handler
  const handleSubsidiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubsidiFeedback(null);

    const cleanNik = subsidiNik.replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      setSubsidiFeedback({
        type: 'error',
        text: `NIK Pelapor wajib 16 digit angka KTP (saat ini: ${cleanNik.length} digit).`,
      });
      return;
    }

    if (!subsidiKeterangan.trim()) {
      setSubsidiFeedback({
        type: 'error',
        text: 'Mohon isi keterangan waktu kejadian, harga jual, atau kendala kuota RT.',
      });
      return;
    }

    const pangkalanObj =
      PANGKALAN_OPTIONS.find((p) => p.label === selectedPangkalan) || PANGKALAN_OPTIONS[0];

    setSubmittingSubsidi(true);
    try {
      const createdComplaint = await saveSubsidyComplaint({
        nik: cleanNik,
        pangkalanLabel: pangkalanObj.label,
        rtNumber: pangkalanObj.rt,
        rwNumber: pangkalanObj.rw,
        addressDetail: pangkalanObj.address,
        kendalaDistribusi,
        description: subsidiKeterangan.trim(),
      });

      const newTicket = createdComplaint.ticketNumber || 'FTL-BARU';
      setSubsidiFeedback({
        type: 'success',
        text: `Laporan Subsidi berhasil dikirim dengan Nomor Tiket ${newTicket}.`,
        ticket: newTicket,
      });
      setSubsidiNik('');
      setSubsidiKeterangan('');
      await loadComplaints();
      setTrackedComplaint(createdComplaint);
      setSearchInput(newTicket);
    } catch (err: any) {
      setSubsidiFeedback({
        type: 'error',
        text: err.message || 'Gagal mengirim laporan subsidi.',
      });
    } finally {
      setSubmittingSubsidi(false);
    }
  };

  // Submit General Complaint Form Handler
  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralFeedback(null);

    const cleanNik = formNik.replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      setGeneralFeedback({
        type: 'error',
        text: `NIK wajib tepat 16 digit angka KTP (saat ini: ${cleanNik.length} digit).`,
      });
      return;
    }

    setSubmittingGeneral(true);
    try {
      const subCatMap: Record<string, string> = {
        musibah_darurat: 'Musibah / Darurat',
        khusus_rahasia: 'Khusus / Sensitif',
        subsidi_minyak_tanah: 'Subsidi Minyak',
        umum_lingkungan: 'Umum / Batas Tanah',
      };

      const createdComplaint = await saveComplaint({
        nik: cleanNik,
        reporterName: formName || 'Warga Fatululi',
        reporterPhone: formPhone || '081239481100',
        rtNumber: formRt.padStart(3, '0'),
        rwNumber: formRw.padStart(3, '0'),
        addressDetail: `RT ${formRt.padStart(3, '0')} / RW ${formRw.padStart(3, '0')} Kel. Fatululi`,
        category: formCategory,
        subCategory: subCatMap[formCategory] || 'Umum / Lingkungan',
        urgency: formCategory === 'musibah_darurat' ? 'darurat' : 'normal',
        isConfidential: formCategory === 'khusus_rahasia',
        title: formTitle,
        description: formDesc,
        photoDataUrl: formPhoto,
        qrSourcePost: `Barcode Pos RT ${formRt.padStart(3, '0')}`,
      });

      const newTicket = createdComplaint.ticketNumber || '';
      setGeneralFeedback({
        type: 'success',
        text: `Laporan berhasil terdaftar dengan Nomor Tiket #${newTicket}`,
        ticket: newTicket,
      });
      setFormTitle('');
      setFormDesc('');
      setFormPhoto('');
      await loadComplaints();
      setTrackedComplaint(createdComplaint);
      setSearchInput(newTicket);
    } catch (err: any) {
      setGeneralFeedback({
        type: 'error',
        text: err.message || 'Gagal mengirim pengaduan.',
      });
    } finally {
      setSubmittingGeneral(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Protected Admin Table Action Button Click Handler
  const handleAdminRowAction = (item: ComplaintItem) => {
    if (!officerSession) {
      setActiveScreen('login_aparat');
      return;
    }

    if (item.category === 'umum_lingkungan' || item.ticketNumber === 'FTL-035') {
      generateOfficialReferralLetterPDF(
        item,
        officerSession.name,
        officerSession.jabatan
      );
      showToast(`Surat Pengantar Polsek untuk #${item.ticketNumber} berhasil diunduh (.PDF)`);
      return;
    }

    setEditingItem(item);
    setModalStatus(
      item.category === 'musibah_darurat'
        ? 'diteruskan_instansi'
        : item.status === 'menunggu_verifikasi'
        ? 'koordinasi_rt_rw'
        : 'selesai'
    );
    setModalAgency(item.targetAgency || AGENCY_LIST[0]);
    setModalNotes(item.adminNotes || '');
  };

  const handleSaveModalStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !officerSession) return;
    setSavingModal(true);
    try {
      await updateComplaintStatus(
        editingItem.id,
        {
          status: modalStatus,
          targetAgency: modalAgency,
          officialLetterNumber: editingItem.officialLetterNumber,
          adminNotes: modalNotes,
          actorName: officerSession.name,
          actorRole: officerSession.jabatan,
        },
        officerSession.role,
        officerSession.securityToken
      );
      setEditingItem(null);
      await loadComplaints();
      showToast(
        `Status tiket #${editingItem.ticketNumber} berhasil diperbarui oleh ${officerSession.name}.`
      );
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui status.');
    } finally {
      setSavingModal(false);
    }
  };

  // Filter Admin Table Rows
  const filteredAdminRows = complaints.filter((item) => {
    if (adminSidebarMenu === 'rahasia' && item.category !== 'khusus_rahasia') return false;
    if (adminSidebarMenu === 'subsidi' && item.category !== 'subsidi_minyak_tanah') return false;
    if (adminSidebarMenu === 'darurat' && item.category !== 'musibah_darurat') return false;

    if (adminCategoryFilter !== 'semua' && item.category !== adminCategoryFilter) return false;
    if (adminRtFilter !== 'semua' && item.rtNumber !== adminRtFilter) return false;

    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      return (
        item.ticketNumber.toLowerCase().includes(q) ||
        item.reporterName.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.rtNumber.includes(q) ||
        (item.nikMasked || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Determine active step index (1..4) for the vertical timeline
  const getStepProgressIndex = (status: string) => {
    if (status === 'menunggu_verifikasi') return 1;
    if (status === 'ditinjau_kelurahan') return 2;
    if (status === 'koordinasi_rt_rw') return 3;
    if (status === 'diteruskan_instansi' || status === 'selesai') return 4;
    return 3;
  };

  const activeTracked = trackedComplaint || complaints[0];
  const activeStepIdx = activeTracked ? getStepProgressIndex(activeTracked.status) : 3;

  // Derive notifications for Admin Dashboard
  const actionableNotifications = complaints
    .filter((item) => item.status !== 'selesai')
    .sort((a, b) => {
      const score = (c: ComplaintItem) =>
        c.category === 'musibah_darurat' || c.urgency === 'darurat'
          ? 3
          : c.status === 'menunggu_verifikasi'
          ? 2
          : 1;
      return score(b) - score(a);
    });

  const unreadNotifications = actionableNotifications.filter(
    (item) => !readNotifIds.includes(item.id)
  );

  const countInProgress = complaints.filter((c) => c.status !== 'selesai').length;
  const countResolved = complaints.filter(
    (c) => c.status === 'selesai' || c.status === 'diteruskan_instansi'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* =====================================================================
          HEADER PORTAL PUBLIK WARGA (Modern, Natural & Ringkas)
         ===================================================================== */}
      {activeScreen !== 'admin_panel' && (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                setActiveScreen('portal_warga');
                setCitizenTab('buat_laporan');
              }}
              title="Home"
              className="w-10 h-10 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white flex items-center justify-center shadow-xs shrink-0 transition-colors cursor-pointer"
            >
              <Home className="w-5 h-5" />
            </button>
            <div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight whitespace-nowrap block">
                Lapor Fatululi
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Layanan Pengaduan Kelurahan Fatululi
              </span>
            </div>
          </div>

          {/* Quick Desktop Links + Collapsible Pill Dropdown */}
          <div className="relative flex items-center gap-3">
            {activeScreen === 'portal_warga' && (
              <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-full">
                <button
                  type="button"
                  onClick={() => setCitizenTab('buat_laporan')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    citizenTab === 'buat_laporan'
                      ? 'bg-white text-[#1D4ED8] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Buat Laporan
                </button>
                <button
                  type="button"
                  onClick={() => setCitizenTab('lacak_status')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    citizenTab === 'lacak_status'
                      ? 'bg-white text-[#1D4ED8] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cek Status Tiket
                </button>
                <button
                  type="button"
                  onClick={() => setCitizenTab('aduan_subsidi')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    citizenTab === 'aduan_subsidi'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Subsidi Minyak Tanah
                </button>
              </div>
            )}

            <div className="relative flex flex-col items-end">
              <button
                type="button"
                onClick={() => setIsPublicMenuOpen((prev) => !prev)}
                className="w-fit px-4 py-2 rounded-full bg-[#334155] hover:bg-[#3E4C63] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-3 shadow-xs transition-all cursor-pointer"
              >
                <span>
                  {activeScreen === 'login_aparat'
                    ? 'Login Petugas'
                    : citizenTab === 'lacak_status'
                    ? 'Cek Status Tiket'
                    : citizenTab === 'aduan_subsidi'
                    ? 'Subsidi Minyak'
                    : 'Pengaduan'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-white transition-transform duration-200 ${
                    isPublicMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isPublicMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsPublicMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-40 flex flex-col items-end gap-1.5 bg-[#111827]/95 p-2.5 rounded-2xl border border-slate-700/80 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScreen('portal_warga');
                        setCitizenTab('buat_laporan');
                        setIsPublicMenuOpen(false);
                      }}
                      className={`w-fit whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        activeScreen === 'portal_warga' && citizenTab === 'buat_laporan'
                          ? 'bg-[#1D4ED8] text-white'
                          : 'bg-[#334155] text-slate-100 hover:bg-[#475569]'
                      }`}
                    >
                      Buat Pengaduan Baru
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveScreen('portal_warga');
                        setCitizenTab('lacak_status');
                        setIsPublicMenuOpen(false);
                      }}
                      className={`w-fit whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        activeScreen === 'portal_warga' && citizenTab === 'lacak_status'
                          ? 'bg-[#1D4ED8] text-white'
                          : 'bg-[#334155] text-slate-100 hover:bg-[#475569]'
                      }`}
                    >
                      Pelacakan Status Tiket
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveScreen('portal_warga');
                        setCitizenTab('aduan_subsidi');
                        setIsPublicMenuOpen(false);
                      }}
                      className={`w-fit whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        activeScreen === 'portal_warga' && citizenTab === 'aduan_subsidi'
                          ? 'bg-[#1D4ED8] text-white'
                          : 'bg-[#334155] text-slate-100 hover:bg-[#475569]'
                      }`}
                    >
                      Aduan Subsidi Minyak
                    </button>

                    {officerSession ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveScreen('admin_panel');
                            setIsPublicMenuOpen(false);
                          }}
                          className="w-fit whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold bg-[#334155] text-amber-300 hover:bg-[#475569] transition-colors cursor-pointer"
                        >
                          Dashboard ({officerSession.jabatan})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPublicMenuOpen(false);
                            handleOfficerLogout();
                          }}
                          className="w-fit whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold bg-red-950/90 text-red-200 hover:bg-red-900 border border-red-800/70 inline-flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <span>Logout</span>
                          <LogOut className="w-3.5 h-3.5 text-red-300" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveScreen('login_aparat');
                          setIsPublicMenuOpen(false);
                        }}
                        className={`w-fit whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          activeScreen === 'login_aparat'
                            ? 'bg-[#1D4ED8] text-white'
                            : 'bg-[#334155] text-slate-100 hover:bg-[#475569]'
                        }`}
                      >
                        Login Pegawai / Lurah
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Global Feedback Toast */}
      {toastBanner && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0F172A] text-white px-5 py-3.5 rounded-2xl shadow-lg border border-slate-700 flex items-center gap-3 text-xs font-medium max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* =====================================================================
          PORTAL UTAMA WARGA (MODERN CIVIC TECH PORTAL)
         ===================================================================== */}
      {activeScreen === 'portal_warga' && (
        <>
          {/* Modern Civic Hero Banner with Integrated Quick Ticket Tracker */}
          <section className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E3A8A] text-white border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-6 py-8 sm:py-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] font-semibold">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Pemerintah Kota Kupang • Kecamatan Oebobo</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                    Sistem Layanan Pengaduan & Aspirasi Masyarakat Kelurahan Fatululi
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Sampaikan laporan lingkungan, ketertiban umum, kendala distribusi minyak tanah
                    subsidi, maupun kondisi darurat secara transparan dan terintegrasi langsung
                    dengan RT/RW setempat.
                  </p>

                  {/* Live Transparency Counters */}
                  <div className="pt-2 flex flex-wrap items-center gap-6">
                    <div>
                      <div className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
                        {Math.max(48, complaints.length + 44)}
                      </div>
                      <div className="text-[11px] text-slate-400">Laporan Teregistrasi</div>
                    </div>
                    <div className="h-7 w-px bg-slate-700" />
                    <div>
                      <div className="text-lg sm:text-xl font-extrabold text-amber-400 tabular-nums">
                        {Math.max(3, countInProgress)}
                      </div>
                      <div className="text-[11px] text-slate-400">Sedang Ditindaklanjuti</div>
                    </div>
                    <div className="h-7 w-px bg-slate-700" />
                    <div>
                      <div className="text-lg sm:text-xl font-extrabold text-emerald-400 tabular-nums">
                        {Math.max(36, countResolved + 35)}
                      </div>
                      <div className="text-[11px] text-slate-400">Selesai & Diarsipkan</div>
                    </div>
                  </div>
                </div>

                {/* Quick Ticket Lookup Box inside Hero */}
                <div className="lg:col-span-5">
                  <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>Lacak Cepat Progres Laporan</span>
                      <span className="text-[11px] font-normal text-slate-300">
                        Nomor Tiket / NIK
                      </span>
                    </div>
                    <form onSubmit={handleSearchTicket} className="mt-3 flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="Contoh: FTL-2026-042 atau 16 digit NIK"
                          className="w-full bg-white text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0 transition-colors cursor-pointer"
                      >
                        Cek Status
                      </button>
                    </form>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                      <span>Tiket terbaru:</span>
                      {complaints.slice(0, 4).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setTrackedComplaint(c);
                            setSearchInput(c.ticketNumber);
                            setCitizenTab('lacak_status');
                          }}
                          className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] transition-colors cursor-pointer"
                        >
                          #{c.ticketNumber.replace('FTL-2026-', 'FTL-')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Main 12-Column Citizen Workspace */}
          <main className="max-w-7xl w-full mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT 7 COLUMNS: Interactive Tabbed Workspace */}
              <div className="lg:col-span-7 space-y-6">
                {/* Modern Segmented Control Bar */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 grid grid-cols-3 gap-1.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setCitizenTab('buat_laporan')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      citizenTab === 'buat_laporan'
                        ? 'bg-[#1D4ED8] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>Buat Pengaduan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCitizenTab('lacak_status')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      citizenTab === 'lacak_status'
                        ? 'bg-[#1D4ED8] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Lacak Status ({complaints.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCitizenTab('aduan_subsidi')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      citizenTab === 'aduan_subsidi'
                        ? 'bg-[#D97706] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5 shrink-0" />
                    <span>Subsidi Minyak</span>
                  </button>
                </div>

                {/* =========================================================
                    TAB 1: FORM PENGADUAN MASYARAKAT MODERN
                   ========================================================= */}
                {citizenTab === 'buat_laporan' && (
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#1D4ED8] uppercase tracking-wider">
                          Formulir Pengaduan Warga
                        </span>
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                          Sampaikan Laporan Baru
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormCategory('musibah_darurat');
                          setFormNik('5371040911880003');
                          setFormName('Yohanes B.');
                          setFormPhone('082144559812');
                          setFormRt('003');
                          setFormRw('001');
                          setFormTitle('Genangan Banjir & Pohon Tumbang');
                          setFormDesc(
                            'Darurat: Pohon tumbang dan genangan banjir di sekitar Pos RT 003 / RW 001 membutuhkan penanganan segera BPBD / Damkar.'
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span>Isi Cepat Laporan Darurat</span>
                      </button>
                    </div>

                    {generalFeedback && (
                      <div
                        className={`mb-6 p-4 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 ${
                          generalFeedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div>
                          <p className="font-bold">{generalFeedback.text}</p>
                          <p className="text-[11px] mt-0.5 opacity-80">
                            Data laporan telah tersimpan ke database PostgreSQL Kelurahan Fatululi.
                          </p>
                        </div>
                        {generalFeedback.ticket && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchInput(generalFeedback.ticket || '');
                              setCitizenTab('lacak_status');
                            }}
                            className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            Lihat Status
                          </button>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleGeneralSubmit} className="space-y-5">
                      {/* Interactive 4 Category Cards */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-800 mb-2.5">
                          Pilih Kategori Pengaduan *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {CATEGORY_CARDS.map((cat) => {
                            const Icon = cat.icon;
                            const isSelected = formCategory === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setFormCategory(cat.id)}
                                className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                  isSelected
                                    ? `${cat.activeClass} border-2 shadow-2xs`
                                    : 'border-slate-200 bg-[#F8FAFC] hover:border-slate-300 text-slate-700'
                                }`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                    isSelected
                                      ? 'bg-white shadow-2xs'
                                      : 'bg-white border border-slate-200 text-slate-500'
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-extrabold">{cat.title}</div>
                                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                                    {cat.desc}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 16-Digit NIK Field with Live Counter */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-extrabold text-slate-800">
                            NIK KTP Warga Fatululi (16 Digit) *
                          </label>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                formNik.length === 16 ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                            >
                              {formNik.length}/16 digit
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormNik('5371042107790002');
                                if (!formName) setFormName('Kornelis Ndun');
                                if (!formPhone) setFormPhone('085239110445');
                              }}
                              className="text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
                            >
                              Contoh NIK
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={16}
                          value={formNik}
                          onChange={(e) => setFormNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="Masukkan 16 digit NIK KTP Kota Kupang (537104...)"
                          required
                          className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition-colors"
                        />
                      </div>

                      {/* Name & Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                            Nama Lengkap Pelapor *
                          </label>
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Sesuai KTP (Disamarkan jika Rahasia)"
                            required
                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                            Nomor HP / WhatsApp Aktif *
                          </label>
                          <input
                            type="tel"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            placeholder="0812xxxxxxxx"
                            required
                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* RT / RW & Title */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                            Nomor RT *
                          </label>
                          <input
                            type="text"
                            maxLength={3}
                            value={formRt}
                            onChange={(e) => setFormRt(e.target.value.replace(/\D/g, ''))}
                            placeholder="012"
                            required
                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                            Nomor RW *
                          </label>
                          <input
                            type="text"
                            maxLength={3}
                            value={formRw}
                            onChange={(e) => setFormRw(e.target.value.replace(/\D/g, ''))}
                            placeholder="004"
                            required
                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8]"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                            Judul / Pokok Laporan *
                          </label>
                          <input
                            type="text"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            placeholder="Ringkasan masalah di lokasi..."
                            required
                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Chronology */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                          Rincian Kronologi & Patokan Lokasi *
                        </label>
                        <textarea
                          rows={3}
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          placeholder="Jelaskan permasalahan secara singkat dan jelas untuk memudahkan peninjauan petugas..."
                          required
                          className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                        />
                      </div>

                      {/* Upload & Submit Row */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-[#1D4ED8]" />
                          <span>
                            {formPhoto ? 'Bukti Foto Terlampir' : 'Lampirkan Foto Lapangan'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={submittingGeneral}
                          className="px-6 py-3 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span>
                            {submittingGeneral ? 'Mengirim Laporan...' : 'Kirim Laporan Resmi'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* =========================================================
                    TAB 2: PELACAKAN STATUS TIKET TRANSPARAN
                   ========================================================= */}
                {citizenTab === 'lacak_status' && (
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-5 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#1D4ED8] uppercase tracking-wider">
                          Transparansi Tindak Lanjut
                        </span>
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                          Status Perkembangan Pengaduan
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={loadComplaints}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Perbarui</span>
                      </button>
                    </div>

                    {/* Search Form */}
                    <form
                      onSubmit={handleSearchTicket}
                      className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                    >
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Masukkan Nomor Tiket (contoh: FTL-2026-042) atau 16 digit NIK..."
                        className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8]"
                      />
                      <button
                        type="submit"
                        className="bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-colors shrink-0 cursor-pointer"
                      >
                        Cari Tiket
                      </button>
                    </form>

                    {/* Ticket Selector Pills */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Pilih tiket terdaftar:</span>
                      {complaints.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setTrackedComplaint(c);
                            setSearchInput(c.ticketNumber);
                          }}
                          className={`px-2.5 py-1 rounded-full font-mono font-bold transition-colors cursor-pointer ${
                            activeTracked?.id === c.id
                              ? 'bg-[#1D4ED8] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          #{c.ticketNumber.replace('FTL-2026-', 'FTL-')}
                        </button>
                      ))}
                    </div>

                    {/* Active Ticket Summary Box */}
                    {activeTracked && (
                      <div className="mt-6 bg-[#F0F7FF] border border-[#BFDBFE] rounded-2xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-[#1D4ED8] uppercase tracking-wide">
                            {activeTracked.isConfidential ||
                            activeTracked.category === 'khusus_rahasia'
                              ? 'Kategori Khusus / Rahasia (Privasi Pelapor Dilindungi)'
                              : activeTracked.category === 'subsidi_minyak_tanah'
                              ? 'Kategori Distribusi Subsidi Minyak Tanah'
                              : activeTracked.category === 'musibah_darurat'
                              ? 'Kategori Musibah / Darurat Prioritas'
                              : 'Kategori Umum / Lingkungan & Mediasi'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[#1E40AF] font-mono text-[11px] font-extrabold">
                            #{activeTracked.ticketNumber}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-2">
                          {activeTracked.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          Wilayah: RT {activeTracked.rtNumber} / RW {activeTracked.rwNumber} Kel.
                          Fatululi • Pelapor: {activeTracked.reporterName} (
                          {activeTracked.nikMasked})
                        </p>
                      </div>
                    )}

                    {/* 4-Stage Progress Timeline */}
                    <div className="mt-7 pl-2 space-y-0">
                      {/* Step 1 */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-[#16A34A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            1
                          </div>
                          <div className="w-0.5 h-14 bg-[#16A34A]" />
                        </div>
                        <div className="pb-5">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Laporan Diterima Sistem & Pos RT {activeTracked?.rtNumber || '012'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Data laporan teregistrasi di database Kelurahan Fatululi dengan nomor
                            tiket #{activeTracked?.ticketNumber}.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                              activeStepIdx >= 2
                                ? 'bg-[#16A34A] text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            2
                          </div>
                          <div
                            className={`w-0.5 h-14 ${
                              activeStepIdx >= 3 ? 'bg-[#F59E0B]' : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <div className="pb-5">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Verifikasi Administrasi & NIK Warga Fatululi
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Kasi Trantib memeriksa keabsahan laporan dan meneruskan koordinasi ke
                            Ketua RT {activeTracked?.rtNumber || '012'}.
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 ${
                              activeStepIdx === 3
                                ? 'bg-[#F59E0B] text-slate-950'
                                : activeStepIdx > 3
                                ? 'bg-[#16A34A] text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            3
                          </div>
                          <div className="h-14 border-l-2 border-dashed border-slate-300" />
                        </div>
                        <div className="pb-5">
                          <h4
                            className={`text-xs sm:text-sm font-extrabold ${
                              activeStepIdx === 3 ? 'text-[#B45309]' : 'text-slate-900'
                            }`}
                          >
                            Koordinasi RT/RW & Mediasi Lapangan
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {activeTracked?.adminNotes ||
                              `Petugas Kelurahan bersama Ketua RT ${
                                activeTracked?.rtNumber || '012'
                              } melakukan peninjauan langsung ke lokasi aduan.`}
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                              activeStepIdx >= 4
                                ? 'bg-[#16A34A] text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            4
                          </div>
                        </div>
                        <div>
                          <h4
                            className={`text-xs sm:text-sm font-extrabold ${
                              activeStepIdx >= 4 ? 'text-emerald-800' : 'text-slate-400'
                            }`}
                          >
                            Penyelesaian & Penerbitan Surat Pengantar Instansi
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {activeStepIdx >= 4
                              ? `Tindak lanjut selesai. Surat Resmi Nomor ${
                                  activeTracked?.officialLetterNumber ||
                                  '300.1.1/035/KEL-FTL/X/2026'
                                } diterbitkan untuk ${activeTracked?.targetAgency}.`
                              : 'Menunggu hasil mediasi akhir atau penerbitan surat pengantar dinas.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    TAB 3: KANAL KHUSUS ADUAN DISTRIBUSI SUBSIDI MINYAK TANAH
                   ========================================================= */}
                {citizenTab === 'aduan_subsidi' && (
                  <div className="bg-[#FFFDF5] border-2 border-[#FDE68A] rounded-3xl p-6 sm:p-8 shadow-2xs">
                    <div className="inline-flex items-center gap-2 bg-[#F59E0B] text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-full uppercase tracking-wide">
                      <Droplets className="w-3.5 h-3.5" />
                      <span>Kanal Pengawasan Subsidi Warga</span>
                    </div>

                    <h2 className="text-xl font-extrabold text-[#78350F] mt-4">
                      Aduan Distribusi Minyak Tanah & Bantuan Sosial
                    </h2>
                    <p className="text-xs text-[#B45309] leading-relaxed mt-1.5">
                      Laporkan kelangkaan stok, harga jual melebihi HET, atau kendala pembagian
                      kuota pada pangkalan resmi di wilayah Kelurahan Fatululi.
                    </p>

                    {subsidiFeedback && (
                      <div
                        className={`mt-4 p-4 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 ${
                          subsidiFeedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-red-50 border-red-300 text-red-900'
                        }`}
                      >
                        <span>{subsidiFeedback.text}</span>
                        {subsidiFeedback.ticket && (
                          <button
                            type="button"
                            onClick={() => setCitizenTab('lacak_status')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            Lacak Tiket
                          </button>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleSubsidiSubmit} className="mt-5 space-y-4">
                      <div>
                        <label className="block text-xs font-extrabold text-[#78350F] mb-1.5">
                          Lokasi Pangkalan / Agen Minyak Tanah *
                        </label>
                        <select
                          value={selectedPangkalan}
                          onChange={(e) => setSelectedPangkalan(e.target.value)}
                          className="w-full bg-white border border-[#FCD34D] rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#D97706]"
                        >
                          {PANGKALAN_OPTIONS.map((p) => (
                            <option key={p.label} value={p.label}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-[#78350F] mb-1.5">
                          Jenis Kendala di Lapangan *
                        </label>
                        <select
                          value={kendalaDistribusi}
                          onChange={(e) => setKendalaDistribusi(e.target.value)}
                          className="w-full bg-white border border-[#FCD34D] rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#D97706]"
                        >
                          <option value="Stok Kosong / Harga di Atas HET / Kuota Warga">
                            Stok Kosong / Harga di Atas HET / Kuota Warga
                          </option>
                          <option value="Antrean Panjang & Pembelian Jeriken Berlebih">
                            Antrean Panjang & Pembelian Jeriken Berlebih
                          </option>
                          <option value="Keterlambatan Pasokan Truk Tangki Agen">
                            Keterlambatan Pasokan Truk Tangki Agen
                          </option>
                          <option value="Kendala Pembagian Bantuan Sosial / Beras">
                            Kendala Pembagian Bantuan Sosial / Beras
                          </option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-extrabold text-[#78350F]">
                            NIK Pelapor (16 Digit KTP) *
                          </label>
                          <button
                            type="button"
                            onClick={() => setSubsidiNik('5371045203900001')}
                            className="text-[11px] font-bold text-[#B45309] hover:underline cursor-pointer"
                          >
                            Isi Contoh NIK
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={16}
                          value={subsidiNik}
                          onChange={(e) =>
                            setSubsidiNik(e.target.value.replace(/\D/g, '').slice(0, 16))
                          }
                          placeholder="Masukkan 16 digit NIK KTP"
                          className="w-full bg-white border border-[#FCD34D] rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#D97706]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-[#78350F] mb-1.5">
                          Keterangan Waktu Kejadian & Harga *
                        </label>
                        <textarea
                          rows={3}
                          value={subsidiKeterangan}
                          onChange={(e) => setSubsidiKeterangan(e.target.value)}
                          placeholder="Sebutkan jam kejadian, harga per liter yang diminta, atau kondisi antrean..."
                          className="w-full bg-white border border-[#FCD34D] rounded-xl p-3.5 text-xs text-slate-900 focus:outline-none focus:border-[#D97706]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingSubsidi}
                        className="w-full bg-[#D97706] hover:bg-[#B45309] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm py-3.5 rounded-xl transition-colors cursor-pointer"
                      >
                        {submittingSubsidi ? 'Mengirim Laporan...' : 'Kirim Laporan Subsidi'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* RIGHT 5 COLUMNS: Alur Penanganan & Pos QR RT Interaktif */}
              <div className="lg:col-span-5 space-y-6">
                {/* Card 1: Alur Penanganan Aduan */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs">
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">
                        Alur Penanganan Aduan
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Standar pelayanan terpadu Kelurahan Fatululi
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {[
                      {
                        step: '1',
                        badgeClass: 'bg-[#DBEAFE] text-[#1E40AF]',
                        title: 'Scan Barcode Pos RT / Input Web',
                        desc: 'Warga melapor mandiri melalui QR Pos RT atau langsung lewat portal web.',
                      },
                      {
                        step: '2',
                        badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
                        title: 'Verifikasi Pegawai Kelurahan',
                        desc: 'Petugas memvalidasi NIK warga Fatululi dan berkoordinasi dengan Ketua RT/RW.',
                      },
                      {
                        step: '3',
                        badgeClass: 'bg-[#E0E7FF] text-[#3730A3]',
                        title: 'Tindak Lanjut & Surat Pengantar',
                        desc: 'Mediasi lapangan atau penerbitan surat resmi ke Polsek, BPBD, Damkar, atau Dinas.',
                      },
                      {
                        step: '4',
                        badgeClass: 'bg-[#DCFCE7] text-[#15803D]',
                        title: 'Selesai & Arsip Digital PDF',
                        desc: 'Status diperbarui secara transparan dan terekam otomatis ke buku register PDF.',
                      },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-4">
                        <div
                          className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${item.badgeClass}`}
                        >
                          {item.step}
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: Akses Cepat via Pos RT (Interactive QR Card) */}
                <div className="bg-[#0F172A] rounded-3xl p-6 sm:p-7 text-white shadow-sm border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-amber-400">
                          Akses Cepat Pos QR RT/RW
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Terhubung langsung ke form pengaduan warga
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pos RT Switcher Pills */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {['012', '008', '003', '015'].map((rt) => (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => {
                          setSelectedQrPosRt(rt);
                          setFormRt(rt);
                        }}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                          selectedQrPosRt === rt
                            ? 'bg-[#1D4ED8] text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Pos RT {rt}
                      </button>
                    ))}
                  </div>

                  <div className="my-5 mx-auto w-44 h-44 bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner">
                    <QRCodeSVG
                      value={`${window.location.origin}/?pos=POS-RT${selectedQrPosRt}`}
                      size={128}
                      fgColor="#0F172A"
                    />
                    <span className="mt-1.5 text-[10px] font-mono font-bold text-slate-600">
                      POS-RT{selectedQrPosRt}-FATULULI
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hotline Lurah: (0380) 821xxx</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      Layanan 24 Jam
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* =====================================================================
          SCREEN LOGIN APARAT: GERBANG AUTENTIKASI KHUSUS LURAH / PEGAWAI / RT-RW
         ===================================================================== */}
      {activeScreen === 'login_aparat' && (
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-9 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => setActiveScreen('portal_warga')}
                title="Kembali ke Home"
                className="w-11 h-11 rounded-2xl bg-[#0F172A] text-[#F59E0B] flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <Home className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">
                  Login Portal Pegawai & Lurah
                </h1>
                <p className="text-xs text-slate-500">
                  Akses Verifikasi Aduan, Mediasi & Ekspor PDF Resmi
                </p>
              </div>
            </div>

            {/* Tab Switcher: Masuk Akun vs Buat Akun Baru */}
            <div className="mb-5 bg-slate-100 p-1 rounded-2xl grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setLoginError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk Akun (Login)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setLoginError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-white text-[#1D4ED8] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Buat Akun Baru
              </button>
            </div>

            {loginError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
                {loginError}
              </div>
            )}

            {authTab === 'login' ? (
              <form onSubmit={handleOfficerLoginSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                  Halaman ini khusus untuk <strong>Lurah, Kasi Trantib, Staf Administrasi, dan Ketua RT/RW Kelurahan Fatululi</strong>. Warga umum tidak memerlukan login untuk membuat atau melacak pengaduan.
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                    Username / NIP Akun Dinas *
                  </label>
                  <input
                    type="text"
                    value={loginNipInput}
                    onChange={(e) => setLoginNipInput(e.target.value)}
                    placeholder="Masukkan Username atau 18 digit NIP..."
                    autoComplete="username"
                    required
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                    Kata Sandi / Password Aparat *
                  </label>
                  <input
                    type="password"
                    value={loginPinInput}
                    onChange={(e) => setLoginPinInput(e.target.value)}
                    placeholder="Masukkan kata sandi akun dinas..."
                    autoComplete="current-password"
                    required
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-3.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{submittingAuth ? 'Memverifikasi...' : 'Masuk ke Dashboard Admin'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleOfficerRegisterSubmit} className="space-y-3.5">
                <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                  Pendaftaran akun baru staf/RT-RW membutuhkan <strong>Kode Otorisasi Kantor Kelurahan</strong> dari Lurah atau Admin Utama agar warga luar tidak dapat membuat akun admin sembarangan.
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Nama Lengkap & Gelar Petugas *
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Contoh: Lukas Neno, S.AP"
                    required
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Username Login *
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Contoh: lukas_ftl"
                      required
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      NIP / Kode RT (Opsional)
                    </label>
                    <input
                      type="text"
                      value={regNip}
                      onChange={(e) => setRegNip(e.target.value)}
                      placeholder="1985xxxxxxxx / RT-005"
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Jabatan / Peran *
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) =>
                        setRegRole(
                          e.target.value as 'lurah' | 'kasi_trantib' | 'staf_admin' | 'ketua_rt'
                        )
                      }
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                    >
                      <option value="staf_admin">Staf Administrasi</option>
                      <option value="kasi_trantib">Kasi Trantib & Pelayanan</option>
                      <option value="lurah">Lurah Fatululi</option>
                      <option value="ketua_rt">Ketua RT / RW</option>
                    </select>
                  </div>
                  {regRole === 'ketua_rt' && (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        Nomor Wilayah RT *
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={regRtScope}
                        onChange={(e) => setRegRtScope(e.target.value.replace(/\D/g, ''))}
                        placeholder="012"
                        required
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Buat Kata Sandi Baru *
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Kode Otorisasi Kantor *
                    </label>
                    <input
                      type="password"
                      value={regOfficeCode}
                      onChange={(e) => setRegOfficeCode(e.target.value)}
                      placeholder="Kode rahasia kantor..."
                      required
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1D4ED8] focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-3.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4 text-[#F59E0B]" />
                  <span>
                    {submittingAuth
                      ? 'Menyimpan Akun ke Database...'
                      : 'Daftarkan Akun & Masuk Dashboard'}
                  </span>
                </button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3 text-[11px] text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>ATAU SSO GOOGLE</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleOfficerLogin}
              className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#1D4ED8]" />
              <span>Login dengan Akun Google Resmi</span>
            </button>
          </div>
        </main>
      )}

      {/* =====================================================================
          KHUSUS ADMIN / LURAH / PEGAWAI VIEW: PANEL PEGAWAI & LURAH
         ===================================================================== */}
      {activeScreen === 'admin_panel' && officerSession && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
          {/* LEFT DARK SIDEBAR (#111827) with Home icon and auto-width (w-fit) option pills */}
          <aside className="w-full lg:w-64 bg-[#111827] text-slate-300 p-5 flex flex-col justify-between shrink-0">
            <div>
              {/* Brand Lockup inside Sidebar with Home Icon */}
              <div className="flex items-center gap-3 px-2 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdminSidebarMenu('dashboard');
                  }}
                  title="Home Dashboard"
                  className="w-10 h-10 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <Home className="w-5 h-5" />
                </button>
                <div>
                  <div className="text-sm font-extrabold text-white leading-tight">
                    Admin Fatululi
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Panel Pegawai & Lurah</div>
                </div>
              </div>

              {/* Collapsible Click-to-Open Sidebar Menu (Each pill hugs its option text width w-fit) */}
              <nav className="mt-7 flex flex-col items-start gap-2.5">
                {/* Group 1: Pengaduan Dropdown Pill */}
                <div className="flex flex-col items-start">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSidebarGroups((prev) => ({
                        ...prev,
                        pengaduan: !prev.pengaduan,
                      }))
                    }
                    className="w-fit px-4 py-2 rounded-full bg-[#334155] hover:bg-[#3E4C63] text-white text-sm font-semibold inline-flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <span>Pengaduan</span>
                    <ChevronDown
                      className={`w-4 h-4 text-white transition-transform duration-200 ${
                        openSidebarGroups.pengaduan ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSidebarGroups.pengaduan && (
                    <div className="mt-2 pl-2 flex flex-col items-start gap-1.5">
                      {[
                        {
                          id: 'dashboard',
                          label: 'Dashboard & Aduan Masuk',
                        },
                        {
                          id: 'rahasia',
                          label: 'Aduan Khusus / Rahasia (4)',
                        },
                        {
                          id: 'subsidi',
                          label: 'Aduan Subsidi Minyak (9)',
                        },
                        {
                          id: 'darurat',
                          label: 'Musibah / Darurat (1)',
                        },
                      ].map((menu) => {
                        const isActive = adminSidebarMenu === menu.id;
                        return (
                          <button
                            key={menu.id}
                            type="button"
                            onClick={() => setAdminSidebarMenu(menu.id)}
                            className={`w-fit px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#1D4ED8] text-white shadow-xs'
                                : 'bg-[#1E293B] text-slate-300 hover:bg-[#334155] hover:text-white'
                            }`}
                          >
                            {menu.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Group 2: Dokumen & Layanan Dropdown Pill */}
                <div className="flex flex-col items-start">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSidebarGroups((prev) => ({
                        ...prev,
                        layanan: !prev.layanan,
                      }))
                    }
                    className="w-fit px-4 py-2 rounded-full bg-[#334155] hover:bg-[#3E4C63] text-white text-sm font-semibold inline-flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <span>Dokumen & Layanan</span>
                    <ChevronDown
                      className={`w-4 h-4 text-white transition-transform duration-200 ${
                        openSidebarGroups.layanan ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSidebarGroups.layanan && (
                    <div className="mt-2 pl-2 flex flex-col items-start gap-1.5">
                      {[
                        {
                          id: 'surat',
                          label: 'Buat Surat Pengantar Dinas',
                        },
                        {
                          id: 'arsip',
                          label: 'Arsip Digital & Ekspor PDF',
                        },
                        {
                          id: 'qr_poster',
                          label: 'Cetak Poster QR Pos RT/RW',
                        },
                        {
                          id: 'akun',
                          label: 'Manajemen Akun Pegawai/RT',
                        },
                      ].map((menu) => {
                        const isActive = adminSidebarMenu === menu.id;
                        return (
                          <button
                            key={menu.id}
                            type="button"
                            onClick={() => setAdminSidebarMenu(menu.id)}
                            className={`w-fit px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#1D4ED8] text-white shadow-xs'
                                : 'bg-[#1E293B] text-slate-300 hover:bg-[#334155] hover:text-white'
                            }`}
                          >
                            {menu.label}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setActiveScreen('portal_warga')}
                        className="w-fit px-3.5 py-2 rounded-full text-xs font-semibold bg-[#1E293B] text-slate-300 hover:bg-[#334155] hover:text-white transition-all cursor-pointer"
                      >
                        Halaman Publik Warga
                      </button>

                      <button
                        type="button"
                        onClick={handleOfficerLogout}
                        className="w-fit px-4 py-2 rounded-full text-xs font-semibold bg-red-950/90 text-red-200 hover:bg-red-900 border border-red-800/70 inline-flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <span>Logout</span>
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* Bottom Officer Status Box inside Sidebar with Direct Logout Option */}
            <div className="mt-8 bg-[#1E293B] rounded-xl p-4 border border-slate-700/60">
              <div className="text-xs font-extrabold text-white">{officerSession.jabatan}</div>
              <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
                {officerSession.name}
              </div>
              <div className="text-[11px] font-semibold text-sky-400 mt-1">
                Terhubung Database Aktif
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Akses Multi-User Aktif</div>

              {/* Quick Switcher for Public View & Direct Logout */}
              <div className="mt-3 pt-3 border-t border-slate-700 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveScreen('portal_warga')}
                  className="w-fit py-1.5 px-3 rounded-full bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home Warga</span>
                </button>
                <button
                  type="button"
                  onClick={handleOfficerLogout}
                  className="w-fit py-1.5 px-3.5 rounded-full bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-[11px] font-bold text-red-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>

          {/* RIGHT MAIN WORKSPACE */}
          <div className="flex-1 flex flex-col bg-[#F8FAFC]">
            {/* Top White Header inside Admin Panel */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Manajemen Pengaduan & Arsip Digital Kelurahan Fatululi
                </h1>
                <p className="text-[11px] text-slate-500">
                  Petugas Aktif:{' '}
                  <span className="font-bold text-slate-800">{officerSession.name}</span> (
                  {officerSession.jabatan})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Notification Bell & Dropdown for New & Urgent Complaints */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen((prev) => !prev)}
                    title="Notifikasi Pengaduan Masuk & Tindak Lanjut"
                    className="relative px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-[#1D4ED8]" />
                    <span>Notifikasi</span>
                    {unreadNotifications.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold leading-none">
                        {unreadNotifications.length}
                      </span>
                    )}
                  </button>

                  {isNotifOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsNotifOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl z-40 overflow-hidden">
                        <div className="px-4 py-3 bg-[#111827] text-white flex items-center justify-between">
                          <div>
                            <div className="text-xs font-extrabold">
                              Notifikasi Pengaduan & Tindak Lanjut
                            </div>
                            <div className="text-[11px] text-slate-300">
                              {unreadNotifications.length} belum dibaca •{' '}
                              {actionableNotifications.length} perlu tindak lanjut
                            </div>
                          </div>
                          {unreadNotifications.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setReadNotifIds(actionableNotifications.map((n) => n.id))
                              }
                              className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                            >
                              Tandai Dibaca
                            </button>
                          )}
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                          {actionableNotifications.length === 0 ? (
                            <div className="p-5 text-center text-xs text-slate-500">
                              Semua pengaduan telah selesai ditindaklanjuti.
                            </div>
                          ) : (
                            actionableNotifications.map((notif) => {
                              const isUnread = !readNotifIds.includes(notif.id);
                              const isEmergency =
                                notif.category === 'musibah_darurat' ||
                                notif.urgency === 'darurat';
                              const isNew = notif.status === 'menunggu_verifikasi';
                              const shortCode = notif.ticketNumber.replace('FTL-2026-', 'FTL-');

                              return (
                                <div
                                  key={notif.id}
                                  className={`p-3.5 transition-colors ${
                                    isUnread ? 'bg-blue-50/50' : 'bg-white'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        isEmergency
                                          ? 'bg-red-100 text-red-700'
                                          : isNew
                                          ? 'bg-blue-100 text-[#1D4ED8]'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {isEmergency
                                        ? 'Darurat • Segera Tindak Lanjuti'
                                        : isNew
                                        ? 'Pengaduan Baru Masuk'
                                        : 'Perlu Mediasi / Verifikasi RT'}
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-slate-500">
                                      #{shortCode}
                                    </span>
                                  </div>

                                  <div className="text-xs font-extrabold text-slate-900 mt-1.5">
                                    {notif.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Wilayah RT {notif.rtNumber} / RW {notif.rwNumber} • Status:{' '}
                                    {notif.status.replace(/_/g, ' ')}
                                  </div>

                                  <div className="mt-2.5 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReadNotifIds((prev) =>
                                          prev.includes(notif.id) ? prev : [...prev, notif.id]
                                        );
                                        setIsNotifOpen(false);
                                        handleAdminRowAction(notif);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-[11px] font-bold transition-colors cursor-pointer"
                                    >
                                      Tindak Lanjuti Sekarang
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const target =
                      complaints.find((c) => c.id === selectedLetterTicketId) || complaints[0];
                    if (target) {
                      generateOfficialReferralLetterPDF(
                        target,
                        officerSession.name,
                        officerSession.jabatan
                      );
                      showToast(`Surat Pengantar untuk #${target.ticketNumber} berhasil diunduh.`);
                    }
                  }}
                  className="bg-[#EFF6FF] hover:bg-blue-100 border border-[#93C5FD] text-[#1D4ED8] font-extrabold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Buat Surat Pengantar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    generatePeriodicArchiveReportPDF(
                      complaints,
                      `${archivePeriod} — ${archiveCategory}`,
                      officerSession.name
                    );
                    showToast('Laporan Buku Arsip Digital (.PDF) berhasil diunduh.');
                  }}
                  className="bg-[#16A34A] hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Laporan PDF</span>
                </button>
              </div>
            </div>

            {/* Simple Urgent / New Complaint Notification Banner for Staff */}
            {!hideUrgentBanner && actionableNotifications.length > 0 && (
              <div className="mx-8 mt-5 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-[#78350F]">
                    <span className="font-extrabold">Pemberitahuan Staf Kelurahan: </span>
                    Terdapat{' '}
                    <span className="font-extrabold">
                      {actionableNotifications.length} pengaduan aktif
                    </span>{' '}
                    (termasuk laporan prioritas{' '}
                    <span className="font-extrabold">
                      #{actionableNotifications[0].ticketNumber.replace('FTL-2026-', 'FTL-')}
                    </span>
                    ) yang memerlukan verifikasi atau tindak lanjut segera.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdminRowAction(actionableNotifications[0])}
                    className="px-3.5 py-1.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Tindak Lanjuti Prioritas
                  </button>
                  <button
                    type="button"
                    onClick={() => setHideUrgentBanner(true)}
                    title="Tutup pemberitahuan"
                    className="p-1.5 rounded-lg text-[#92400E] hover:bg-amber-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 4 KPI Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 px-8 pt-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-semibold text-slate-500">Total Aduan Bulan Ini</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tabular-nums">
                  {Math.max(48, complaints.length + 44)}
                </div>
                <div className="text-xs font-bold text-[#16A34A] mt-2">
                  Terekam di Arsip Digital
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-semibold text-slate-500">
                  Menunggu Verifikasi & RT
                </div>
                <div className="text-2xl font-extrabold text-[#D97706] mt-1.5 tabular-nums">12</div>
                <div className="text-xs font-bold text-[#D97706] mt-2">
                  Perlu Koordinasi RT/RW
                </div>
              </div>

              <div className="bg-[#FFFDF5] border border-[#FDE68A] rounded-2xl p-5">
                <div className="text-xs font-extrabold text-[#92400E]">
                  Aduan Subsidi Minyak Tanah
                </div>
                <div className="text-2xl font-extrabold text-[#92400E] mt-1.5 tabular-nums">9</div>
                <div className="text-xs font-bold text-[#B45309] mt-2">
                  Laporan Pangkalan/Kuota
                </div>
              </div>

              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-5">
                <div className="text-xs font-extrabold text-[#991B1B]">
                  Darurat / Lintas Instansi
                </div>
                <div className="text-2xl font-extrabold text-[#DC2626] mt-1.5 tabular-nums">3</div>
                <div className="text-xs font-bold text-[#DC2626] mt-2">
                  Polsek / BPBD / Damkar
                </div>
              </div>
            </div>

            {/* Real-Time Complaints Table Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 mx-8 mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Daftar Pengaduan Warga (Real-Time dari Web & Barcode Pos RT)
                </h2>
                {adminSidebarMenu === 'akun' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 mr-1">Ganti Peran Aktif:</span>
                    {PRESET_OFFICER_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setOfficerSession(acc);
                          showToast(`Beralih peran ke ${acc.jabatan} (${acc.name})`);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          officerSession.id === acc.id
                            ? 'bg-[#1D4ED8] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {acc.jabatan}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search & Filter Row */}
              <div className="flex flex-wrap items-center gap-3.5 mt-4 mb-5">
                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Cari NIK, Nama, atau Nomor RT..."
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>

                <select
                  value={adminCategoryFilter}
                  onChange={(e) => setAdminCategoryFilter(e.target.value)}
                  className="bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="semua">Semua Kategori Aduan</option>
                  <option value="musibah_darurat">Musibah / Darurat</option>
                  <option value="khusus_rahasia">Khusus / Sensitif</option>
                  <option value="subsidi_minyak_tanah">Subsidi Minyak</option>
                  <option value="umum_lingkungan">Umum / Batas Tanah</option>
                </select>

                <select
                  value={adminRtFilter}
                  onChange={(e) => setAdminRtFilter(e.target.value)}
                  className="bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="semua">Filter Wilayah RT/RW</option>
                  <option value="003">RT 003 / RW 001</option>
                  <option value="008">RT 008 / RW 003</option>
                  <option value="012">RT 012 / RW 004</option>
                  <option value="014">RT 014 / RW 005</option>
                  <option value="015">RT 015 / RW 005</option>
                </select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                      <th className="py-3.5 px-4">ID & WAKTU</th>
                      <th className="py-3.5 px-4">PELAPOR & NIK</th>
                      <th className="py-3.5 px-4">KATEGORI & SIFAT</th>
                      <th className="py-3.5 px-4">RINGKASAN MASALAH & RT</th>
                      <th className="py-3.5 px-4">STATUS & TINDAKAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredAdminRows.map((row) => {
                      const displayTicket = row.ticketNumber.replace('FTL-2026-', 'FTL-');
                      const timeLabel =
                        displayTicket === 'FTL-045'
                          ? 'Hari Ini, 10:12'
                          : displayTicket === 'FTL-042'
                          ? 'Kemarin'
                          : displayTicket === 'FTL-039'
                          ? '27 Okt 2026'
                          : displayTicket === 'FTL-035'
                          ? '25 Okt 2026'
                          : 'Hari Ini';

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            <div className="font-extrabold text-slate-900">#{displayTicket}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{timeLabel}</div>
                          </td>

                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            {row.isConfidential || row.category === 'khusus_rahasia' ? (
                              <>
                                <div className="font-bold text-[#92400E]">
                                  [Identitas Dirahasiakan]
                                </div>
                                <div className="text-[11px] font-semibold text-[#16A34A] mt-0.5">
                                  NIK Terverifikasi Sistem
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-extrabold text-slate-900">
                                  {row.reporterName}
                                </div>
                                <div className="text-[11px] font-semibold text-[#16A34A] mt-0.5">
                                  NIK Warga Valid
                                </div>
                              </>
                            )}
                          </td>

                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            {row.category === 'musibah_darurat' && (
                              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FEF2F2] text-[#DC2626] font-extrabold text-[11px]">
                                Musibah / Darurat
                              </span>
                            )}
                            {row.category === 'khusus_rahasia' && (
                              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-extrabold text-[11px]">
                                Khusus / Sensitif
                              </span>
                            )}
                            {row.category === 'subsidi_minyak_tanah' && (
                              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] font-extrabold text-[11px]">
                                Subsidi Minyak
                              </span>
                            )}
                            {row.category === 'umum_lingkungan' && (
                              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DBEAFE] text-[#1E40AF] font-extrabold text-[11px]">
                                Umum / Batas Tanah
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 align-middle">
                            <div className="font-extrabold text-slate-900">
                              {displayTicket === 'FTL-042'
                                ? 'Polusi Bau Kandang Ternak Babi'
                                : row.title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {displayTicket === 'FTL-045'
                                ? 'Pos RT 003 / RW 001 • Ada Bukti Foto'
                                : displayTicket === 'FTL-042'
                                ? 'RT 012 / RW 004 • Koordinasi Ketua RT'
                                : displayTicket === 'FTL-039'
                                ? 'RT 008 / RW 003 • Pangkalan Oebobo'
                                : displayTicket === 'FTL-035'
                                ? 'RT 015 / RW 005 • Perlu Mediasi Lanjutan'
                                : `RT ${row.rtNumber} / RW ${row.rwNumber} • ${row.status}`}
                            </div>
                          </td>

                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            {row.category === 'musibah_darurat' ? (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Teruskan ke BPBD / Damkar
                              </button>
                            ) : row.category === 'khusus_rahasia' ? (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 rounded-xl bg-[#F8FAFC] hover:bg-blue-50 border border-[#93C5FD] text-[#1E40AF] font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Update Status / Mediasi
                              </button>
                            ) : row.category === 'subsidi_minyak_tanah' ? (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 rounded-xl bg-[#F8FAFC] hover:bg-blue-50 border border-[#93C5FD] text-[#1E40AF] font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Verifikasi Bersama RT {row.rtNumber}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 rounded-xl bg-[#F59E0B] hover:bg-amber-600 text-slate-950 font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Cetak Pengantar Polsek
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom 2-Column Action Cards Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-8 my-6">
              {/* Bottom Left: Pembuatan Surat Pengantar Lintas Instansi */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-[#1D4ED8]" />
                    <span>Pembuatan Surat Pengantar Lintas Instansi</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Fasilitasi otomatis surat resmi kelurahan untuk penanganan lanjutan:
                  </p>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-2">
                        Pilih ID Tiket Pengaduan
                      </label>
                      <select
                        value={selectedLetterTicketId}
                        onChange={(e) => setSelectedLetterTicketId(Number(e.target.value))}
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1D4ED8]"
                      >
                        {complaints.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.ticketNumber.replace('FTL-2026-', 'FTL-')} - {c.title} (RT{' '}
                            {c.rtNumber} / RW {c.rwNumber})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-2">
                        Instansi Tujuan Tindak Lanjut
                      </label>
                      <select
                        value={selectedLetterAgency}
                        onChange={(e) => setSelectedLetterAgency(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1D4ED8]"
                      >
                        {AGENCY_LIST.map((ag) => (
                          <option key={ag} value={ag}>
                            {ag}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const target =
                      complaints.find((c) => c.id === selectedLetterTicketId) || complaints[0];
                    if (target) {
                      generateOfficialReferralLetterPDF(
                        {
                          ...target,
                          targetAgency: selectedLetterAgency,
                        },
                        officerSession.name,
                        officerSession.jabatan
                      );
                      showToast(
                        `Surat Resmi PDF untuk #${target.ticketNumber} (${selectedLetterAgency}) berhasil diunduh.`
                      );
                    }
                  }}
                  className="mt-6 w-full bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-xs py-3.5 rounded-xl transition-colors cursor-pointer"
                >
                  Generate & Unduh Surat Resmi (PDF)
                </button>
              </div>

              {/* Bottom Right: Manajemen Arsip Digital & Ekspor PDF Berkala */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#16A34A]" />
                    <span>Manajemen Arsip Digital & Ekspor PDF Berkala</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Pengganti buku pengaduan fisik untuk permintaan data dari Dinas/Pemkot Kupang.
                  </p>

                  <div className="mt-5">
                    <label className="block text-xs font-extrabold text-slate-800 mb-2">
                      Periode Rekapitulasi Laporan
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <select
                        value={archivePeriod}
                        onChange={(e) => setArchivePeriod(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none"
                      >
                        <option value="Oktober 2026 (Bulanan)">Oktober 2026 (Bulanan)</option>
                        <option value="Triwulan IV 2026">Triwulan IV 2026</option>
                        <option value="Semester II 2026">Semester II 2026</option>
                      </select>

                      <select
                        value={archiveCategory}
                        onChange={(e) => setArchiveCategory(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none"
                      >
                        <option value="Semua Kategori & RT">Semua Kategori & RT</option>
                        <option value="Khusus Subsidi Minyak Tanah">
                          Khusus Subsidi Minyak Tanah
                        </option>
                        <option value="Aduan Rahasia / Sensitif">Aduan Rahasia / Sensitif</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-3.5 text-xs text-[#065F46]">
                    <div className="font-extrabold">Sinkronisasi Buku Arsip Fisik Kelurahan:</div>
                    <div className="mt-0.5 text-[11px] text-[#047857]">
                      Data historis perpindahan warga lama tetap terpisah di buku manual kantor.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    generatePeriodicArchiveReportPDF(
                      complaints,
                      `${archivePeriod} — ${archiveCategory}`,
                      officerSession.name
                    );
                    showToast('Buku Arsip Digital (.PDF) berhasil diunduh.');
                  }}
                  className="mt-6 w-full bg-[#16A34A] hover:bg-emerald-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition-colors cursor-pointer"
                >
                  Ekspor Buku Arsip Digital (.PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Updating Status / Mediasi */}
      {editingItem && officerSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-7 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div>
                <span className="text-xs font-extrabold text-[#1D4ED8]">
                  #{editingItem.ticketNumber} • RT {editingItem.rtNumber} / RW{' '}
                  {editingItem.rwNumber}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Tindak Lanjut & Verifikasi ({officerSession.jabatan})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  Tahapan Status Tindak Lanjut
                </label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900"
                >
                  <option value="menunggu_verifikasi">
                    1. Laporan Diterima via Barcode Pos RT
                  </option>
                  <option value="ditinjau_kelurahan">
                    2. Diverifikasi oleh Pegawai Kelurahan Fatululi
                  </option>
                  <option value="koordinasi_rt_rw">
                    3. Sedang Dikoordinasikan Bersama RT/RW & Mediasi Lapangan
                  </option>
                  <option value="diteruskan_instansi">
                    4. Diteruskan ke Instansi Terkait (Polsek / BPBD / Damkar)
                  </option>
                  <option value="selesai">5. Selesai Ditindaklanjuti & Terekam Arsip PDF</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  Instansi Tujuan / Koordinasi
                </label>
                <select
                  value={modalAgency}
                  onChange={(e) => setModalAgency(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800"
                >
                  {AGENCY_LIST.map((ag) => (
                    <option key={ag} value={ag}>
                      {ag}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  Catatan Mediasi / Peninjauan Lapangan
                </label>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Tuliskan hasil koordinasi bersama Ketua RT/RW atau instansi..."
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingModal}
                  className="px-6 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-xs cursor-pointer"
                >
                  {savingModal ? 'Menyimpan...' : 'Simpan & Perbarui Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
