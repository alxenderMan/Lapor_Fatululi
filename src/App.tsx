import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Home,
  Bell,
  Search,
  FileText,
  Clock,
  PhoneCall,
  QrCode,
  Send,
  Flame,
  Droplets,
  Users,
  EyeOff,
  Printer,
  Download,
  AlertTriangle,
  RefreshCw,
  Globe,
  Mail,
  Check,
  ShieldCheck,
  MapPin,
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
    desc: 'Perselisihan batas tanah warga, polusi limbah ternak, drainase tersumbat, serta ketertiban fasilitas umum di lingkungan RT/RW.',
    icon: Users,
    activeClass: 'border-[#E11D2E] bg-red-50/70 text-neutral-900',
  },
  {
    id: 'khusus_rahasia',
    title: 'Khusus / Rahasia',
    desc: 'Pengaduan sensitif dengan perlindungan penuh: identitas pelapor dan NIK disamarkan secara otomatis dari publik maupun tetangga.',
    icon: EyeOff,
    activeClass: 'border-[#E11D2E] bg-red-50/70 text-neutral-900',
  },
  {
    id: 'subsidi_minyak_tanah',
    title: 'Subsidi Minyak Tanah',
    desc: 'Pengawasan antrean pangkalan minyak tanah subsidi, kelangkaan stok kuota warga, atau harga jual melebihi HET Pemerintah.',
    icon: Droplets,
    activeClass: 'border-[#E11D2E] bg-red-50/70 text-neutral-900',
  },
  {
    id: 'musibah_darurat',
    title: 'Musibah / Darurat',
    desc: 'Kejadian pohon tumbang, genangan banjir, kebakaran pemukiman, dan penerusan surat darurat ke Polsek, BPBD, atau Damkar.',
    icon: Flame,
    activeClass: 'border-[#E11D2E] bg-red-50/70 text-neutral-900',
  },
];

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenView>('portal_warga');
  const [citizenTab, setCitizenTab] = useState<CitizenTab>('buat_laporan');

  // Accordion state for Syarat & Ketentuan section
  const [openAccordion, setOpenAccordion] = useState<number | null>(1);
  // Active hero feature card highlight index
  const [heroCardIndex, setHeroCardIndex] = useState<number>(0);

  // Refs for smooth scrolling from Hero / Navbar / Split CTA buttons
  const workspaceSectionRef = useRef<HTMLDivElement | null>(null);
  const syaratSectionRef = useRef<HTMLDivElement | null>(null);
  const perlindunganSectionRef = useRef<HTMLDivElement | null>(null);

  // Officer Authentication State (Separates Public Citizen View vs Admin/Lurah Dashboard)
  const [officerSession, setOfficerSession] = useState<ActiveOfficerSession | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // Login & Registration Form State
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

  const scrollToWorkspace = (targetTab?: CitizenTab) => {
    setActiveScreen('portal_warga');
    if (targetTab) {
      setCitizenTab(targetTab);
    }
    setTimeout(() => {
      workspaceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

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
    scrollToWorkspace('lacak_status');
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
    <div className="min-h-screen flex flex-col bg-white text-neutral-900 font-sans">
      {/* =====================================================================
          1. STICKY PURE WHITE NAVBAR (Mengikuti Struktur Referensi)
         ===================================================================== */}
      {activeScreen !== 'admin_panel' && (
        <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
            {/* Left Institutional Brand Lockup */}
            <button
              type="button"
              onClick={() => {
                setActiveScreen('portal_warga');
                setCitizenTab('buat_laporan');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="flex flex-col">
                <div className="text-2xl sm:text-[26px] font-black tracking-tighter leading-none text-neutral-950 flex items-center">
                  <span>LAPOR</span>
                  <span className="text-[#E11D2E] ml-1.5">FTL</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1">
                  Kelurahan Fatululi • Kota Kupang
                </span>
              </div>
            </button>

            {/* Right Navigation Links + Search + Login Officer Trigger */}
            <div className="flex items-center gap-2 sm:gap-6">
              <nav className="hidden lg:flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => scrollToWorkspace('buat_laporan')}
                  className={`text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeScreen === 'portal_warga' && citizenTab === 'buat_laporan'
                      ? 'text-[#E11D2E]'
                      : 'text-neutral-700 hover:text-[#E11D2E]'
                  }`}
                >
                  <span>Buat Pengaduan</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToWorkspace('lacak_status')}
                  className={`text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeScreen === 'portal_warga' && citizenTab === 'lacak_status'
                      ? 'text-[#E11D2E]'
                      : 'text-neutral-700 hover:text-[#E11D2E]'
                  }`}
                >
                  <span>Lacak Status ({complaints.length})</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToWorkspace('aduan_subsidi')}
                  className={`text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeScreen === 'portal_warga' && citizenTab === 'aduan_subsidi'
                      ? 'text-[#E11D2E]'
                      : 'text-neutral-700 hover:text-[#E11D2E]'
                  }`}
                >
                  <span>Subsidi Minyak</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveScreen('portal_warga');
                    setTimeout(() => {
                      syaratSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }, 50);
                  }}
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700 hover:text-[#E11D2E] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Syarat & Pos QR</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveScreen('portal_warga');
                    setTimeout(() => {
                      perlindunganSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }, 50);
                  }}
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700 hover:text-[#E11D2E] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Perlindungan</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              </nav>

              {/* Quick Search Icon Trigger */}
              <button
                type="button"
                onClick={() => scrollToWorkspace('lacak_status')}
                title="Cari & Lacak Nomor Tiket Pengaduan"
                className="p-2 text-neutral-800 hover:text-[#E11D2E] transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Dropdown Menu / Officer Login Button */}
              <div className="relative flex flex-col items-end">
                <button
                  type="button"
                  onClick={() => setIsPublicMenuOpen((prev) => !prev)}
                  className="px-4 py-2 rounded-sm bg-[#1A1A1D] hover:bg-[#E11D2E] text-white font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span>
                    {officerSession
                      ? `Panel ${officerSession.jabatan.split(' ')[0]}`
                      : activeScreen === 'login_aparat'
                      ? 'Login Petugas'
                      : 'Menu / Aparat'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${
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
                    <div className="absolute right-0 top-full mt-2 z-40 w-56 bg-[#111113] p-2 rounded-sm border border-neutral-800 shadow-2xl flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPublicMenuOpen(false);
                          scrollToWorkspace('buat_laporan');
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                          activeScreen === 'portal_warga' && citizenTab === 'buat_laporan'
                            ? 'bg-[#E11D2E] text-white'
                            : 'text-neutral-200 hover:bg-neutral-800'
                        }`}
                      >
                        Buat Pengaduan Baru
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPublicMenuOpen(false);
                          scrollToWorkspace('lacak_status');
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                          activeScreen === 'portal_warga' && citizenTab === 'lacak_status'
                            ? 'bg-[#E11D2E] text-white'
                            : 'text-neutral-200 hover:bg-neutral-800'
                        }`}
                      >
                        Pelacakan Status Tiket
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPublicMenuOpen(false);
                          scrollToWorkspace('aduan_subsidi');
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                          activeScreen === 'portal_warga' && citizenTab === 'aduan_subsidi'
                            ? 'bg-[#E11D2E] text-white'
                            : 'text-neutral-200 hover:bg-neutral-800'
                        }`}
                      >
                        Aduan Subsidi Minyak
                      </button>

                      <div className="my-1 border-t border-neutral-800" />

                      {officerSession ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveScreen('admin_panel');
                              setIsPublicMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2.5 text-xs font-bold bg-neutral-800 text-amber-400 hover:bg-neutral-700 transition-colors cursor-pointer"
                          >
                            Dashboard ({officerSession.jabatan})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPublicMenuOpen(false);
                              handleOfficerLogout();
                            }}
                            className="w-full text-left px-3.5 py-2.5 text-xs font-bold bg-red-950/90 text-red-200 hover:bg-red-900 inline-flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span>Logout Aparat</span>
                            <LogOut className="w-3.5 h-3.5 text-red-300" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveScreen('login_aparat');
                            setIsPublicMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                            activeScreen === 'login_aparat'
                              ? 'bg-[#E11D2E] text-white'
                              : 'text-neutral-200 hover:bg-neutral-800'
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
          </div>
        </header>
      )}

      {/* Global Feedback Toast */}
      {toastBanner && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B0B0C] text-white px-5 py-3.5 rounded-sm shadow-2xl border-l-4 border-[#E11D2E] flex items-center gap-3 text-xs font-semibold max-w-md">
          <CheckCircle2 className="w-4 h-4 text-[#E11D2E] shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* =====================================================================
          PORTAL UTAMA WARGA (MENGIKUTI TATA LETAK & PALET WARNA REFERENSI)
         ===================================================================== */}
      {activeScreen === 'portal_warga' && (
        <>
          {/* =================================================================
              2. DARK HERO SECTION (Latar Gelap #0B0B0C, Judul Merah, Kotak Aksi Kanan & Kartu Horizontal Bawah)
             ================================================================= */}
          <section className="relative bg-[#0B0B0C] text-white overflow-hidden border-b border-neutral-800">
            {/* Subtle dark architectural overlay */}
            <div className="
              absolute inset-0 opacity-20 pointer-events-none
              bg-[radial-gradient(circle_at_20%_20%,#262629_0%,transparent_55%),radial-gradient(circle_at_80%_70%,#3f1116_0%,transparent_50%)]
            " />

            <div className="relative max-w-7xl mx-auto px-6 pt-10 pb-14">
              {/* Top Breadcrumb Navigation */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold mb-6">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-[#E11D2E] hover:opacity-80 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                </button>
                <span className="text-neutral-500">|</span>
                <span className="text-neutral-200">Layanan</span>
                <span className="text-neutral-500">|</span>
                <span className="text-[#E11D2E]">
                  Sistem Layanan Pengaduan & Aspirasi Masyarakat Kelurahan Fatululi
                </span>
              </div>

              {/* Hero Main 2-Column Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* Left Column: Main Heading with Red Highlighted Keywords & Concise Description */}
                <div className="lg:col-span-7 space-y-5">
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.12]">
                    <span>Sekilas Layanan </span>
                    <span className="text-[#E11D2E]">Pengaduan Masyarakat</span>
                  </h1>

                  <p className="text-sm sm:text-base text-neutral-200 leading-relaxed max-w-2xl font-normal">
                    Pemerintah Kelurahan Fatululi (Kecamatan Oebobo, Kota Kupang) membuka layanan
                    publik bagi masyarakat yang ingin melaporkan permasalahan lingkungan, ketertiban
                    umum, distribusi minyak tanah subsidi, maupun kondisi darurat secara transparan
                    dan terintegrasi langsung dengan RT/RW setempat, yaitu:
                  </p>

                  {/* Live Transparency Counters Bar */}
                  <div className="pt-2 flex flex-wrap items-center gap-6 text-xs">
                    <div>
                      <span className="text-2xl font-black text-white tabular-nums block">
                        {Math.max(48, complaints.length + 44)}
                      </span>
                      <span className="text-neutral-400">Laporan Teregistrasi</span>
                    </div>
                    <div className="h-8 w-px bg-neutral-700" />
                    <div>
                      <span className="text-2xl font-black text-[#E11D2E] tabular-nums block">
                        {Math.max(3, countInProgress)}
                      </span>
                      <span className="text-neutral-400">Sedang Ditindaklanjuti</span>
                    </div>
                    <div className="h-8 w-px bg-neutral-700" />
                    <div>
                      <span className="text-2xl font-black text-white tabular-nums block">
                        {Math.max(36, countResolved + 35)}
                      </span>
                      <span className="text-neutral-400">Selesai & Diarsipkan</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Thin-Bordered Quick Info & Action Box ("Create Report From:" style) */}
                <div className="lg:col-span-5 flex lg:justify-end">
                  <div className="w-full max-w-md border border-neutral-500/80 bg-[#121214]/90 p-6 sm:p-7">
                    <h2 className="text-base font-extrabold text-white tracking-tight mb-5">
                      Saluran Resmi & Lacak Tiket:
                    </h2>

                    <div className="space-y-3.5 text-xs sm:text-sm">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-[#E11D2E] shrink-0" />
                        <button
                          type="button"
                          onClick={() => scrollToWorkspace('buat_laporan')}
                          className="text-[#E11D2E] hover:underline font-medium text-left truncate cursor-pointer"
                        >
                          https://lapor-fatululi.vercel.app/
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <PhoneCall className="w-4 h-4 text-[#E11D2E] shrink-0" />
                        <span className="text-white font-bold">
                          (0380) 821xxx (Posko Trantib Fatululi)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-[#E11D2E] shrink-0" />
                        <span className="text-neutral-400">
                          pengaduan@fatululi.kupangkota.go.id
                        </span>
                      </div>
                    </div>

                    {/* Integrated Quick Ticket Lookup inside the Right Hero Box */}
                    <div className="mt-5 pt-5 border-t border-neutral-800">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-2">
                        Lacak Cepat Nomor Tiket / NIK
                      </label>
                      <form onSubmit={handleSearchTicket} className="flex gap-2">
                        <input
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="FTL-2026-042 atau 16 digit NIK"
                          className="flex-1 bg-[#1F1F23] border border-neutral-700 text-white px-3.5 py-2.5 text-xs font-semibold placeholder:text-neutral-500 focus:outline-none focus:border-[#E11D2E]"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-[#E11D2E] hover:bg-red-700 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer"
                        >
                          Cek Status
                        </button>
                      </form>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                        <span>Tiket terbaru:</span>
                        {complaints.slice(0, 4).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setTrackedComplaint(c);
                              setSearchInput(c.ticketNumber);
                              scrollToWorkspace('lacak_status');
                            }}
                            className="px-2 py-0.5 bg-neutral-800 hover:bg-[#E11D2E] text-neutral-200 hover:text-white font-mono text-[10px] transition-colors cursor-pointer"
                          >
                            #{c.ticketNumber.replace('FTL-2026-', 'FTL-')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Circular Dark/Red Navigation Arrow Buttons above Horizontal Cards */}
              <div className="mt-8 mb-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setHeroCardIndex((prev) =>
                      prev === 0 ? CATEGORY_CARDS.length - 1 : prev - 1
                    )
                  }
                  title="Kategori Sebelumnya"
                  className="w-10 h-10 rounded-full bg-[#1C1C1F] hover:bg-[#262629] border border-neutral-700 text-[#E11D2E] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHeroCardIndex((prev) => (prev + 1) % CATEGORY_CARDS.length)
                  }
                  title="Kategori Berikutnya"
                  className="w-10 h-10 rounded-full bg-[#1C1C1F] hover:bg-[#262629] border border-neutral-700 text-[#E11D2E] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-neutral-400 ml-1">
                  Klik kartu kategori di bawah untuk langsung mengisi laporan:
                </span>
              </div>

              {/* Bottom Hero Horizontal Row of Dark Charcoal Cards (#262629) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {CATEGORY_CARDS.map((card, idx) => {
                  const isHighlighted = heroCardIndex === idx || formCategory === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setHeroCardIndex(idx);
                        if (card.id === 'subsidi_minyak_tanah') {
                          scrollToWorkspace('aduan_subsidi');
                        } else {
                          setFormCategory(card.id);
                          scrollToWorkspace('buat_laporan');
                        }
                      }}
                      className={`text-left bg-[#262629] hover:bg-[#2E2E32] p-6 transition-all cursor-pointer flex flex-col justify-between border-t-2 ${
                        isHighlighted ? 'border-[#E11D2E]' : 'border-transparent'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-sm font-extrabold text-white">
                            {card.title}
                          </span>
                          <span className="text-[11px] font-bold text-[#E11D2E]">
                            0{idx + 1}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed font-normal">
                          {card.desc}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-neutral-700/60 flex items-center justify-between text-[11px] font-bold text-[#E11D2E]">
                        <span>Pilih & Buat Laporan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* =================================================================
              3. BAGIAN KONTEN UTAMA 1 (PUTIH BERSIH):
                 Daftar Poin Berikon Aksen Merah + Ruang Kerja Interaktif 3 Tab
             ================================================================= */}
          <section ref={workspaceSectionRef} className="bg-white py-14 border-b border-neutral-200">
            <div className="max-w-7xl mx-auto px-6">
              {/* Top Reference Note Line */}
              <p className="text-xs sm:text-sm text-neutral-700 mb-6">
                Untuk informasi lebih lanjut mengenai tata cara dan pelacakan laporan Pengaduan
                Masyarakat, kunjungi{' '}
                <button
                  type="button"
                  onClick={() => scrollToWorkspace('lacak_status')}
                  className="text-[#E11D2E] font-bold hover:underline cursor-pointer"
                >
                  Cek Status Tiket Fatululi
                </button>
              </p>

              {/* Section Title with Red Highlighted Keywords */}
              <h2 className="text-2xl sm:text-4xl font-normal tracking-tight text-neutral-900">
                <span>Jenis </span>
                <span className="text-[#E11D2E]">Pengaduan Masyarakat</span>
                <span> yang Ditangani Kelurahan Fatululi</span>
              </h2>

              {/* Bullet Points with Red Circular Checkmark Icons */}
              <div className="mt-6 space-y-3.5 max-w-5xl">
                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-[#E11D2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                    Melibatkan permasalahan ketertiban umum, batas tanah, kebersihan lingkungan,
                    atau fasilitas warga di wilayah RT/RW Kelurahan Fatululi yang memerlukan mediasi
                    aparat kelurahan maupun penerusan surat pengantar resmi ke Polsek Oebobo, BPBD,
                    dan Damkar; dan/atau
                  </p>
                </div>

                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-[#E11D2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                    Menyangkut pengawasan distribusi minyak tanah bersubsidi pada pangkalan resmi
                    di Kelurahan Fatululi (kelangkaan stok, pembagian kuota RT, atau harga jual di
                    atas Harga Eceran Tertinggi / HET) serta laporan kategori Khusus/Rahasia dengan
                    jaminan perlindungan identitas pelapor (NIK 16 digit KTP Kota Kupang).
                  </p>
                </div>
              </div>

              {/* =============================================================
                  INTERACTIVE CITIZEN WORKSPACE (3 TABS: BUAT PENGADUAN, LACAK STATUS, SUBSIDI MINYAK)
                 ============================================================= */}
              <div className="mt-10">
                {/* Clean Institutional Tab Switcher Bar */}
                <div className="bg-[#EEEEEE] p-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5 border border-neutral-300">
                  <button
                    type="button"
                    onClick={() => setCitizenTab('buat_laporan')}
                    className={`py-3 px-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      citizenTab === 'buat_laporan'
                        ? 'bg-[#E11D2E] text-white shadow-xs'
                        : 'bg-white text-neutral-800 hover:bg-neutral-100'
                    }`}
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>Buat Pengaduan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCitizenTab('lacak_status')}
                    className={`py-3 px-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      citizenTab === 'lacak_status'
                        ? 'bg-[#E11D2E] text-white shadow-xs'
                        : 'bg-white text-neutral-800 hover:bg-neutral-100'
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Lacak Status ({complaints.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCitizenTab('aduan_subsidi')}
                    className={`py-3 px-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      citizenTab === 'aduan_subsidi'
                        ? 'bg-[#E11D2E] text-white shadow-xs'
                        : 'bg-white text-neutral-800 hover:bg-neutral-100'
                    }`}
                  >
                    <Droplets className="w-4 h-4 shrink-0" />
                    <span>Subsidi Minyak</span>
                  </button>
                </div>

                {/* TAB 1: FORMULIR PENGADUAN MASYARAKAT */}
                {citizenTab === 'buat_laporan' && (
                  <div className="bg-white border border-t-0 border-neutral-300 p-6 sm:p-10 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-neutral-200">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#E11D2E] uppercase tracking-widest">
                          Formulir Pengaduan Warga
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-950 mt-0.5">
                          Sampaikan Laporan Baru
                        </h3>
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
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-[#E11D2E]/40 text-[#E11D2E] font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-[#E11D2E]" />
                        <span>Isi Cepat Laporan Darurat</span>
                      </button>
                    </div>

                    {generalFeedback && (
                      <div
                        className={`mb-6 p-4 border-l-4 text-xs font-medium flex items-center justify-between gap-3 ${
                          generalFeedback.type === 'success'
                            ? 'bg-neutral-100 border-emerald-600 text-neutral-900'
                            : 'bg-red-50 border-[#E11D2E] text-red-950'
                        }`}
                      >
                        <div>
                          <p className="font-bold">{generalFeedback.text}</p>
                          <p className="text-[11px] mt-0.5 text-neutral-600">
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
                            className="px-4 py-2 bg-[#E11D2E] hover:bg-red-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            Lihat Status
                          </button>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleGeneralSubmit} className="space-y-6">
                      {/* Interactive 4 Category Cards */}
                      <div>
                        <label className="block text-xs font-extrabold text-neutral-900 uppercase tracking-wider mb-3">
                          Pilih Kategori Pengaduan *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {CATEGORY_CARDS.map((cat) => {
                            const Icon = cat.icon;
                            const isSelected = formCategory === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setFormCategory(cat.id)}
                                className={`text-left p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-[#262629] text-white border-[#E11D2E] border-t-4 shadow-sm'
                                    : 'border-neutral-300 bg-[#F7F7F7] hover:border-neutral-400 text-neutral-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-xs font-extrabold">{cat.title}</span>
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-[#E11D2E] text-white'
                                        : 'bg-white border border-neutral-300 text-[#E11D2E]'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                <div
                                  className={`text-[11px] leading-snug ${
                                    isSelected ? 'text-neutral-300' : 'text-neutral-600'
                                  }`}
                                >
                                  {cat.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 16-Digit NIK Field with Live Counter */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-extrabold text-neutral-900">
                            NIK KTP Warga Fatululi (16 Digit) *
                          </label>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                formNik.length === 16 ? 'text-emerald-700' : 'text-neutral-500'
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
                              className="text-[11px] font-bold text-[#E11D2E] hover:underline cursor-pointer"
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
                          className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white transition-colors"
                        />
                      </div>

                      {/* Name & Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Nama Lengkap Pelapor *
                          </label>
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Sesuai KTP (Disamarkan jika Rahasia)"
                            required
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Nomor HP / WhatsApp Aktif *
                          </label>
                          <input
                            type="tel"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            placeholder="0812xxxxxxxx"
                            required
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-mono text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* RT / RW & Title */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Nomor RT *
                          </label>
                          <input
                            type="text"
                            maxLength={3}
                            value={formRt}
                            onChange={(e) => setFormRt(e.target.value.replace(/\D/g, ''))}
                            placeholder="012"
                            required
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-3 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Nomor RW *
                          </label>
                          <input
                            type="text"
                            maxLength={3}
                            value={formRw}
                            onChange={(e) => setFormRw(e.target.value.replace(/\D/g, ''))}
                            placeholder="004"
                            required
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-3 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Judul / Pokok Laporan *
                          </label>
                          <input
                            type="text"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            placeholder="Ringkasan masalah di lokasi..."
                            required
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Chronology */}
                      <div>
                        <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                          Rincian Kronologi & Patokan Lokasi *
                        </label>
                        <textarea
                          rows={3}
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          placeholder="Jelaskan permasalahan secara singkat dan jelas untuk memudahkan peninjauan petugas..."
                          required
                          className="w-full bg-[#F7F7F7] border border-neutral-300 p-3.5 text-xs text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                        />
                      </div>

                      {/* Upload & Submit Row */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-200">
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#EEEEEE] hover:bg-neutral-300 text-neutral-900 font-bold text-xs cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-[#E11D2E]" />
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
                          className="px-7 py-3.5 bg-[#E11D2E] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
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

                {/* TAB 2: PELACAKAN STATUS TIKET TRANSPARAN */}
                {citizenTab === 'lacak_status' && (
                  <div className="bg-white border border-t-0 border-neutral-300 p-6 sm:p-10 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-5 border-b border-neutral-200">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#E11D2E] uppercase tracking-widest">
                          Transparansi Tindak Lanjut
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-950 mt-0.5">
                          Status Perkembangan Pengaduan
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={loadComplaints}
                        className="px-3.5 py-2 bg-[#EEEEEE] hover:bg-neutral-300 text-neutral-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Perbarui Data</span>
                      </button>
                    </div>

                    {/* Search Form */}
                    <form
                      onSubmit={handleSearchTicket}
                      className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                    >
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Masukkan Nomor Tiket (contoh: FTL-2026-042) atau 16 digit NIK..."
                        className="flex-1 bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                      />
                      <button
                        type="submit"
                        className="bg-[#E11D2E] hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-7 py-3 transition-colors shrink-0 cursor-pointer"
                      >
                        Cari Tiket
                      </button>
                    </form>

                    {/* Ticket Selector Pills */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
                      <span>Pilih tiket terdaftar:</span>
                      {complaints.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setTrackedComplaint(c);
                            setSearchInput(c.ticketNumber);
                          }}
                          className={`px-3 py-1 font-mono font-bold transition-colors cursor-pointer ${
                            activeTracked?.id === c.id
                              ? 'bg-[#E11D2E] text-white'
                              : 'bg-[#EEEEEE] text-neutral-800 hover:bg-neutral-300'
                          }`}
                        >
                          #{c.ticketNumber.replace('FTL-2026-', 'FTL-')}
                        </button>
                      ))}
                    </div>

                    {/* Active Ticket Summary Box */}
                    {activeTracked && (
                      <div className="mt-6 bg-[#262629] text-white border-l-4 border-[#E11D2E] p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-[#E11D2E] uppercase tracking-wider">
                            {activeTracked.isConfidential ||
                            activeTracked.category === 'khusus_rahasia'
                              ? 'Kategori Khusus / Rahasia (Privasi Pelapor Dilindungi)'
                              : activeTracked.category === 'subsidi_minyak_tanah'
                              ? 'Kategori Distribusi Subsidi Minyak Tanah'
                              : activeTracked.category === 'musibah_darurat'
                              ? 'Kategori Musibah / Darurat Prioritas'
                              : 'Kategori Umum / Lingkungan & Mediasi'}
                          </span>
                          <span className="px-3 py-1 bg-[#E11D2E] text-white font-mono text-xs font-extrabold">
                            #{activeTracked.ticketNumber}
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-extrabold text-white mt-2">
                          {activeTracked.title}
                        </h4>
                        <p className="text-xs text-neutral-300 mt-1">
                          Wilayah: RT {activeTracked.rtNumber} / RW {activeTracked.rwNumber} Kel.
                          Fatululi • Pelapor: {activeTracked.reporterName} (
                          {activeTracked.nikMasked})
                        </p>
                      </div>
                    )}

                    {/* 4-Stage Progress Timeline */}
                    <div className="mt-8 pl-2 space-y-0">
                      {/* Step 1 */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-[#E11D2E] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            1
                          </div>
                          <div className="w-0.5 h-14 bg-[#E11D2E]" />
                        </div>
                        <div className="pb-5">
                          <h5 className="text-xs sm:text-sm font-extrabold text-neutral-900">
                            Laporan Diterima Sistem & Pos RT {activeTracked?.rtNumber || '012'}
                          </h5>
                          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
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
                                ? 'bg-[#E11D2E] text-white'
                                : 'bg-neutral-200 text-neutral-600'
                            }`}
                          >
                            2
                          </div>
                          <div
                            className={`w-0.5 h-14 ${
                              activeStepIdx >= 3 ? 'bg-[#E11D2E]' : 'bg-neutral-200'
                            }`}
                          />
                        </div>
                        <div className="pb-5">
                          <h5 className="text-xs sm:text-sm font-extrabold text-neutral-900">
                            Verifikasi Administrasi & NIK Warga Fatululi
                          </h5>
                          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
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
                                ? 'bg-[#262629] text-white ring-2 ring-[#E11D2E]'
                                : activeStepIdx > 3
                                ? 'bg-[#E11D2E] text-white'
                                : 'bg-neutral-200 text-neutral-500'
                            }`}
                          >
                            3
                          </div>
                          <div className="h-14 border-l-2 border-dashed border-neutral-300" />
                        </div>
                        <div className="pb-5">
                          <h5
                            className={`text-xs sm:text-sm font-extrabold ${
                              activeStepIdx === 3 ? 'text-[#E11D2E]' : 'text-neutral-900'
                            }`}
                          >
                            Koordinasi RT/RW & Mediasi Lapangan
                          </h5>
                          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
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
                                ? 'bg-[#E11D2E] text-white'
                                : 'bg-neutral-200 text-neutral-500'
                            }`}
                          >
                            4
                          </div>
                        </div>
                        <div>
                          <h5
                            className={`text-xs sm:text-sm font-extrabold ${
                              activeStepIdx >= 4 ? 'text-neutral-950' : 'text-neutral-400'
                            }`}
                          >
                            Penyelesaian & Penerbitan Surat Pengantar Instansi
                          </h5>
                          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
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

                {/* TAB 3: KANAL KHUSUS ADUAN DISTRIBUSI SUBSIDI MINYAK TANAH */}
                {citizenTab === 'aduan_subsidi' && (
                  <div className="bg-white border border-t-0 border-neutral-300 p-6 sm:p-10 shadow-sm">
                    <div className="inline-flex items-center gap-2 bg-[#262629] text-white text-[11px] font-extrabold px-3.5 py-1.5 uppercase tracking-wider">
                      <Droplets className="w-3.5 h-3.5 text-[#E11D2E]" />
                      <span>Kanal Pengawasan Subsidi Warga</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-950 mt-4">
                      Aduan Distribusi Minyak Tanah & Bantuan Sosial
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mt-1.5">
                      Laporkan kelangkaan stok, harga jual melebihi HET, atau kendala pembagian
                      kuota pada pangkalan resmi di wilayah Kelurahan Fatululi.
                    </p>

                    {subsidiFeedback && (
                      <div
                        className={`mt-5 p-4 border-l-4 text-xs font-medium flex items-center justify-between gap-3 ${
                          subsidiFeedback.type === 'success'
                            ? 'bg-neutral-100 border-emerald-600 text-neutral-900'
                            : 'bg-red-50 border-[#E11D2E] text-red-950'
                        }`}
                      >
                        <span>{subsidiFeedback.text}</span>
                        {subsidiFeedback.ticket && (
                          <button
                            type="button"
                            onClick={() => setCitizenTab('lacak_status')}
                            className="px-4 py-2 bg-[#E11D2E] text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            Lacak Tiket
                          </button>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleSubsidiSubmit} className="mt-6 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Lokasi Pangkalan / Agen Minyak Tanah *
                          </label>
                          <select
                            value={selectedPangkalan}
                            onChange={(e) => setSelectedPangkalan(e.target.value)}
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                          >
                            {PANGKALAN_OPTIONS.map((p) => (
                              <option key={p.label} value={p.label}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                            Jenis Kendala di Lapangan *
                          </label>
                          <select
                            value={kendalaDistribusi}
                            onChange={(e) => setKendalaDistribusi(e.target.value)}
                            className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
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
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-extrabold text-neutral-900">
                            NIK Pelapor (16 Digit KTP) *
                          </label>
                          <button
                            type="button"
                            onClick={() => setSubsidiNik('5371045203900001')}
                            className="text-[11px] font-bold text-[#E11D2E] hover:underline cursor-pointer"
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
                          className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                          Keterangan Waktu Kejadian & Harga *
                        </label>
                        <textarea
                          rows={3}
                          value={subsidiKeterangan}
                          onChange={(e) => setSubsidiKeterangan(e.target.value)}
                          placeholder="Sebutkan jam kejadian, harga per liter yang diminta, atau kondisi antrean..."
                          className="w-full bg-[#F7F7F7] border border-neutral-300 p-3.5 text-xs text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingSubsidi}
                          className="px-7 py-3.5 bg-[#E11D2E] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
                        >
                          {submittingSubsidi ? 'Mengirim Laporan...' : 'Kirim Laporan Subsidi'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* =================================================================
              4. BAGIAN KONTEN UTAMA 2 (ABU-ABU TERANG #EEEEEE):
                 Syarat dan Ketentuan Laporan Pengaduan Masyarakat (Panel Accordion Putih)
             ================================================================= */}
          <section ref={syaratSectionRef} className="bg-[#EEEEEE] py-16 border-b border-neutral-300">
            <div className="max-w-5xl mx-auto px-6">
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-2xl sm:text-4xl font-normal tracking-tight text-neutral-900">
                  <span className="text-[#E11D2E]">Syarat dan Ketentuan</span>
                  <span> Laporan Pengaduan Masyarakat</span>
                </h2>
                <p className="text-xs sm:text-sm text-neutral-700 mt-3 leading-relaxed">
                  Untuk membuat laporan pengaduan masyarakat di wilayah Kelurahan Fatululi, warga
                  diharapkan memperhatikan kelengkapan format laporan, alur verifikasi RT/RW, serta
                  data dukung agar laporan dapat segera ditindaklanjuti.
                </p>
              </div>

              {/* White Accordion Panels with Soft Shadow */}
              <div className="mt-10 space-y-4">
                {/* Accordion 1: Format Laporan & Alur Penanganan 4 Tahap */}
                <div className="bg-white shadow-sm border border-neutral-200/90">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion((prev) => (prev === 1 ? null : 1))}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-extrabold text-neutral-900">
                      Format Laporan Pengaduan yang Baik & Alur Penanganan 4 Tahap Kelurahan
                    </span>
                    {openAccordion === 1 ? (
                      <ChevronUp className="w-4 h-4 text-[#E11D2E] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#E11D2E] shrink-0" />
                    )}
                  </button>

                  {openAccordion === 1 && (
                    <div className="px-6 pb-6 pt-2 border-t border-neutral-100">
                      <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
                        Setiap pengaduan yang dikirimkan melalui web maupun pemindaian Barcode Pos
                        RT akan diproses melalui 4 tahapan standar pelayanan terpadu Kelurahan
                        Fatululi:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          {
                            step: '1',
                            title: 'Scan Barcode Pos RT / Input Web',
                            desc: 'Warga melapor mandiri melalui QR Pos RT setempat atau langsung lewat formulir web dengan mencantumkan 16 digit NIK KTP Kota Kupang.',
                          },
                          {
                            step: '2',
                            title: 'Verifikasi Pegawai Kelurahan',
                            desc: 'Petugas memvalidasi keabsahan NIK warga Fatululi, kronologi lokasi, dan meneruskan koordinasi kepada Ketua RT/RW wilayah terkait.',
                          },
                          {
                            step: '3',
                            title: 'Tindak Lanjut & Surat Pengantar',
                            desc: 'Pelaksanaan mediasi lapangan bersama RT/RW atau penerbitan surat pengantar resmi ke Polsek Oebobo, BPBD, Damkar, atau Disperindag.',
                          },
                          {
                            step: '4',
                            title: 'Selesai & Arsip Digital PDF',
                            desc: 'Status tiket diperbarui secara transparan sehingga dapat dilacak warga dan terekam otomatis ke dalam Buku Register Arsip Digital PDF.',
                          },
                        ].map((item) => (
                          <div
                            key={item.step}
                            className="p-4 bg-[#F9F9F9] border border-neutral-200 flex items-start gap-3.5"
                          >
                            <div className="w-7 h-7 rounded-full bg-[#E11D2E] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                              {item.step}
                            </div>
                            <div>
                              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-900">
                                {item.title}
                              </h3>
                              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Accordion 2: Dokumen/Data Dukung Pengaduan & Akses Cepat Pos QR RT/RW */}
                <div className="bg-white shadow-sm border border-neutral-200/90">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion((prev) => (prev === 2 ? null : 2))}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-extrabold text-neutral-900">
                      Dokumen/Data Dukung Pengaduan & Akses Cepat Barcode Pos QR RT/RW
                    </span>
                    {openAccordion === 2 ? (
                      <ChevronUp className="w-4 h-4 text-[#E11D2E] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#E11D2E] shrink-0" />
                    )}
                  </button>

                  {openAccordion === 2 && (
                    <div className="px-6 pb-6 pt-3 border-t border-neutral-100">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-7 space-y-3 text-xs text-neutral-700 leading-relaxed">
                          <p className="font-bold text-neutral-900">
                            Persyaratan Data Dukung Laporan Warga:
                          </p>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-2.5">
                              <span className="w-4 h-4 rounded-full bg-[#E11D2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                              <span>
                                <strong>NIK 16 Digit Valid:</strong> Digunakan untuk memastikan
                                pelapor merupakan warga yang berdomisili atau berkepentingan di
                                wilayah Kelurahan Fatululi.
                              </span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="w-4 h-4 rounded-full bg-[#E11D2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                              <span>
                                <strong>Bukti Foto Lapangan (Opsional namun Disarankan):</strong>{' '}
                                Foto kondisi drainase, pohon tumbang, antrean pangkalan minyak
                                tanah, atau patokan lokasi kejadian.
                              </span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="w-4 h-4 rounded-full bg-[#E11D2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                              <span>
                                <strong>Pemindaian Barcode Pos QR RT/RW:</strong> Pilih nomor Pos
                                RT di samping untuk memindai QR Code yang otomatis mengisi wilayah
                                RT pada formulir laporan.
                              </span>
                            </li>
                          </ul>

                          {/* Pos RT Switcher Buttons */}
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-neutral-900 mr-1">
                              Pilih Barcode Pos RT:
                            </span>
                            {['012', '008', '003', '015'].map((rt) => (
                              <button
                                key={rt}
                                type="button"
                                onClick={() => {
                                  setSelectedQrPosRt(rt);
                                  setFormRt(rt);
                                }}
                                className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                                  selectedQrPosRt === rt
                                    ? 'bg-[#E11D2E] text-white'
                                    : 'bg-[#EEEEEE] text-neutral-800 hover:bg-neutral-300'
                                }`}
                              >
                                Pos RT {rt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive QR Code Box */}
                        <div className="lg:col-span-5 flex justify-center">
                          <div className="bg-[#262629] text-white p-5 w-full max-w-xs flex flex-col items-center text-center border-t-4 border-[#E11D2E]">
                            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white mb-3">
                              <QrCode className="w-4 h-4 text-[#E11D2E]" />
                              <span>Akses Cepat Pos QR RT {selectedQrPosRt}</span>
                            </div>
                            <div className="bg-white p-3.5 flex flex-col items-center justify-center">
                              <QRCodeSVG
                                value={`${window.location.origin}/?pos=POS-RT${selectedQrPosRt}`}
                                size={120}
                                fgColor="#0B0B0C"
                              />
                              <span className="mt-1.5 text-[10px] font-mono font-bold text-neutral-800">
                                POS-RT{selectedQrPosRt}-FATULULI
                              </span>
                            </div>
                            <span className="mt-3 text-[11px] text-neutral-300">
                              Hotline Lurah: (0380) 821xxx • Layanan 24 Jam
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* =================================================================
              5. BAGIAN KONTEN UTAMA 3 (PUTIH BERSIH):
                 Perlindungan Bagi Pelapor
             ================================================================= */}
          <section ref={perlindunganSectionRef} className="bg-white py-16">
            <div className="max-w-7xl mx-auto px-6">
              <div className="max-w-3xl">
                <h2 className="text-2xl sm:text-4xl font-normal tracking-tight text-neutral-900">
                  <span className="text-[#E11D2E]">Perlindungan</span>
                  <span> Bagi Pelapor</span>
                </h2>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed mt-4">
                  Jika memiliki informasi maupun bukti terjadinya gangguan ketertiban lingkungan,
                  penyelewengan distribusi subsidi minyak tanah, atau permasalahan sensitif antar
                  warga, jangan ragu untuk melaporkannya kepada Pemerintah Kelurahan Fatululi.
                  Kerahasiaan identitas pelapor dijamin sepenuhnya melalui sistem penyamaran NIK
                  otomatis (<span className="font-mono font-bold">537104******0001</span>) dan opsi{' '}
                  <strong>Kategori Khusus / Rahasia</strong> yang menyembunyikan nama pelapor dari
                  publik maupun tetangga sekitar.
                </p>
              </div>
            </div>
          </section>

          {/* =================================================================
              6. BAGIAN AKSI / TOMBOL UTAMA (SPLIT TWO-COLUMN SECTION SEBELUM FOOTER)
                 Kiri: Latar Gelap (#262629) | Kanan: Latar Abu-Abu Terang (#EFEFEF)
             ================================================================= */}
          <section className="bg-white">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
              {/* Left Column: Dark Charcoal Background (#262629) */}
              <div className="lg:col-span-6 bg-[#262629] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  Prosedur Pelaporan Pengaduan Masyarakat
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mt-3 max-w-xl">
                  Pahami prosedur dan tahapan verifikasi pada Sistem Layanan Pengaduan Masyarakat
                  saat Anda hendak membuat laporan atau memantau progres mediasi di Kelurahan
                  Fatululi.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToWorkspace('lacak_status')}
                    className="px-5 py-3 bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Lihat Prosedur & Lacak Tiket
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToWorkspace('aduan_subsidi')}
                    className="px-5 py-3 bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Pengaduan Subsidi Minyak Tanah
                  </button>
                </div>
              </div>

              {/* Right Column: Light Gray Background (#EFEFEF) */}
              <div className="lg:col-span-6 bg-[#EFEFEF] text-neutral-900 p-8 sm:p-12 lg:p-14 flex flex-col justify-center lg:mt-10">
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                  Lapor Masalah & Ketertiban Lingkungan
                </h3>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed mt-3 max-w-xl">
                  Sampaikan laporan lingkungan, fasilitas umum, maupun kondisi darurat di wilayah
                  RT/RW Anda. Kerahasiaan identitas pelapor terjamin!
                </p>
                <div className="mt-7">
                  <button
                    type="button"
                    onClick={() => scrollToWorkspace('buat_laporan')}
                    className="px-6 py-3 bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Lapor Sekarang
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* =====================================================================
          SCREEN LOGIN APARAT: GERBANG AUTENTIKASI KHUSUS LURAH / PEGAWAI / RT-RW
         ===================================================================== */}
      {activeScreen === 'login_aparat' && (
        <main className="flex-1 bg-[#EEEEEE] flex items-center justify-center px-6 py-14">
          <div className="max-w-md w-full bg-white border border-neutral-300 border-t-4 border-t-[#E11D2E] p-8 sm:p-9 shadow-md">
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => setActiveScreen('portal_warga')}
                title="Kembali ke Home"
                className="w-11 h-11 bg-[#0B0B0C] text-white hover:bg-[#E11D2E] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <Home className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-neutral-950">
                  Login Portal Pegawai & Lurah
                </h1>
                <p className="text-xs text-neutral-500">
                  Akses Verifikasi Aduan, Mediasi & Ekspor PDF Resmi
                </p>
              </div>
            </div>

            {/* Tab Switcher: Masuk Akun vs Buat Akun Baru */}
            <div className="mb-5 bg-[#EEEEEE] p-1 grid grid-cols-2 gap-1 border border-neutral-300">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setLoginError(null);
                }}
                className={`py-2.5 px-3 text-xs font-extrabold transition-all cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-[#E11D2E] text-white'
                    : 'bg-white text-neutral-700 hover:text-neutral-950'
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
                className={`py-2.5 px-3 text-xs font-extrabold transition-all cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-[#E11D2E] text-white'
                    : 'bg-white text-neutral-700 hover:text-neutral-950'
                }`}
              >
                Buat Akun Baru
              </button>
            </div>

            {loginError && (
              <div className="mb-5 p-3.5 bg-red-50 border-l-4 border-[#E11D2E] text-xs font-medium text-red-900">
                {loginError}
              </div>
            )}

            {authTab === 'login' ? (
              <form onSubmit={handleOfficerLoginSubmit} className="space-y-4">
                <div className="p-3.5 bg-[#F7F7F7] border border-neutral-200 text-[11px] text-neutral-600 leading-relaxed">
                  Halaman ini khusus untuk{' '}
                  <strong>
                    Lurah, Kasi Trantib, Staf Administrasi, dan Ketua RT/RW Kelurahan Fatululi
                  </strong>
                  . Warga umum tidak memerlukan login untuk membuat atau melacak pengaduan.
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                    Username / NIP Akun Dinas *
                  </label>
                  <input
                    type="text"
                    value={loginNipInput}
                    onChange={(e) => setLoginNipInput(e.target.value)}
                    placeholder="Masukkan Username atau 18 digit NIP..."
                    autoComplete="username"
                    required
                    className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                    Kata Sandi / Password Aparat *
                  </label>
                  <input
                    type="password"
                    value={loginPinInput}
                    onChange={(e) => setLoginPinInput(e.target.value)}
                    placeholder="Masukkan kata sandi akun dinas..."
                    autoComplete="current-password"
                    required
                    className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-mono text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-3.5 bg-[#E11D2E] hover:bg-red-700 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{submittingAuth ? 'Memverifikasi...' : 'Masuk ke Dashboard Admin'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleOfficerRegisterSubmit} className="space-y-3.5">
                <div className="p-3 bg-[#F7F7F7] border border-neutral-300 text-[11px] text-neutral-700 leading-relaxed">
                  Pendaftaran akun baru staf/RT-RW membutuhkan{' '}
                  <strong>Kode Otorisasi Kantor Kelurahan</strong> dari Lurah atau Admin Utama agar
                  warga luar tidak dapat membuat akun admin sembarangan.
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                    Nama Lengkap & Gelar Petugas *
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Contoh: Lukas Neno, S.AP"
                    required
                    className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                      Username Login *
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Contoh: lukas_ftl"
                      required
                      className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                      NIP / Kode RT (Opsional)
                    </label>
                    <input
                      type="text"
                      value={regNip}
                      onChange={(e) => setRegNip(e.target.value)}
                      placeholder="1985xxxxxxxx / RT-005"
                      className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs font-mono text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                      Jabatan / Peran *
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) =>
                        setRegRole(
                          e.target.value as 'lurah' | 'kasi_trantib' | 'staf_admin' | 'ketua_rt'
                        )
                      }
                      className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                    >
                      <option value="staf_admin">Staf Administrasi</option>
                      <option value="kasi_trantib">Kasi Trantib & Pelayanan</option>
                      <option value="lurah">Lurah Fatululi</option>
                      <option value="ketua_rt">Ketua RT / RW</option>
                    </select>
                  </div>
                  {regRole === 'ketua_rt' && (
                    <div>
                      <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                        Nomor Wilayah RT *
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={regRtScope}
                        onChange={(e) => setRegRtScope(e.target.value.replace(/\D/g, ''))}
                        placeholder="012"
                        required
                        className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                      Buat Kata Sandi Baru *
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs font-mono text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-900 mb-1">
                      Kode Otorisasi Kantor *
                    </label>
                    <input
                      type="password"
                      value={regOfficeCode}
                      onChange={(e) => setRegOfficeCode(e.target.value)}
                      placeholder="Kode rahasia kantor..."
                      required
                      className="w-full bg-[#F7F7F7] border border-neutral-300 px-3.5 py-2.5 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#E11D2E] focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-3.5 bg-[#0B0B0C] hover:bg-[#262629] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4 text-[#E11D2E]" />
                  <span>
                    {submittingAuth
                      ? 'Menyimpan Akun ke Database...'
                      : 'Daftarkan Akun & Masuk Dashboard'}
                  </span>
                </button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3 text-[11px] text-neutral-400">
              <div className="h-px flex-1 bg-neutral-200" />
              <span>ATAU SSO GOOGLE</span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleOfficerLogin}
              className="w-full py-3 bg-[#EEEEEE] hover:bg-neutral-300 text-neutral-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#E11D2E]" />
              <span>Login dengan Akun Google Resmi</span>
            </button>
          </div>
        </main>
      )}

      {/* =====================================================================
          7. FOOTER HITAM PEKAT (#050505) DENGAN 4 KOLOM & TOMBOL BACK TO TOP
         ===================================================================== */}
      {activeScreen !== 'admin_panel' && (
        <footer className="bg-[#050505] text-white border-t border-neutral-900">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
              {/* Column 1: Identitas & Alamat Kantor Lurah Fatululi */}
              <div className="lg:col-span-4 lg:pr-6 lg:border-r lg:border-neutral-800 space-y-3">
                <h4 className="text-sm font-extrabold text-white tracking-wide">
                  Kantor Kelurahan Fatululi
                </h4>
                <p className="text-xs text-neutral-300 leading-relaxed font-semibold">
                  Jl. Frans Seda, Kelurahan Fatululi, Kecamatan Oebobo, Kota Kupang, Provinsi Nusa
                  Tenggara Timur 85111
                </p>
                <div className="pt-2 flex items-center gap-3 text-neutral-400">
                  <button
                    type="button"
                    onClick={() => scrollToWorkspace('buat_laporan')}
                    title="Portal Web Resmi"
                    className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-[#E11D2E] text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToWorkspace('lacak_status')}
                    title="Pelacakan Tiket"
                    className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-[#E11D2E] text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenAccordion(2);
                      syaratSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Pos QR RT/RW"
                    className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-[#E11D2E] text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScreen('login_aparat')}
                    title="Portal Aparat Kelurahan"
                    className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-[#E11D2E] text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column 2: Menu Bantuan */}
              <div className="lg:col-span-2 lg:px-4 space-y-2.5">
                <h4 className="text-sm font-extrabold text-white tracking-wide">Bantuan</h4>
                <ul className="space-y-2 text-xs text-neutral-400">
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToWorkspace('buat_laporan')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Buat Pengaduan
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToWorkspace('lacak_status')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      FAQ & Lacak Tiket
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToWorkspace('aduan_subsidi')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Subsidi Minyak Tanah
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenAccordion(2);
                        syaratSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Pos QR RT/RW
                    </button>
                  </li>
                </ul>
              </div>

              {/* Column 3: Menu Informasi */}
              <div className="lg:col-span-2 lg:px-4 lg:border-r lg:border-neutral-800 space-y-2.5">
                <h4 className="text-sm font-extrabold text-white tracking-wide">Informasi</h4>
                <ul className="space-y-2 text-xs text-neutral-400">
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        perlindunganSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Kebijakan Privasi
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        syaratSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Syarat & Ketentuan
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScreen('login_aparat');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Portal Aparat & Lurah
                    </button>
                  </li>
                </ul>
              </div>

              {/* Column 4: Kontak Resmi */}
              <div className="lg:col-span-4 lg:pl-4 space-y-3 text-xs text-neutral-300">
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-4 h-4 text-white shrink-0" />
                  <span>(0380) 821xxx (Kantor Lurah Fatululi)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-white shrink-0" />
                  <span>112 (Call Center Darurat Kota Kupang)</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-white shrink-0" />
                  <span>Posko Trantib & Mediasi RT 001 – RT 015</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-white shrink-0" />
                  <span>pengaduan@fatululi.kupangkota.go.id</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar & Back to Top Button */}
          <div className="bg-[#0B0B0C] border-t border-neutral-900">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
              <span>
                Hak Cipta © 2026 Kelurahan Fatululi Pemerintah Kota Kupang. Semua Hak Dilindungi.
              </span>

              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2.5 text-white font-extrabold text-xs hover:text-[#E11D2E] transition-colors cursor-pointer"
              >
                <span>Back to Top</span>
                <span className="w-7 h-7 rounded-full border border-white/80 flex items-center justify-center">
                  <ChevronUp className="w-4 h-4" />
                </span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* =====================================================================
          KHUSUS ADMIN / LURAH / PEGAWAI VIEW: PANEL PEGAWAI & LURAH
         ===================================================================== */}
      {activeScreen === 'admin_panel' && officerSession && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
          {/* LEFT DARK SIDEBAR (#0B0B0C) with Home icon and auto-width (w-fit) option pills */}
          <aside className="w-full lg:w-64 bg-[#0B0B0C] text-neutral-300 p-5 flex flex-col justify-between shrink-0 border-r border-neutral-800">
            <div>
              {/* Brand Lockup inside Sidebar with Home Icon */}
              <div className="flex items-center gap-3 px-2 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdminSidebarMenu('dashboard');
                  }}
                  title="Home Dashboard"
                  className="w-10 h-10 rounded-xl bg-[#E11D2E] hover:bg-red-700 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <Home className="w-5 h-5" />
                </button>
                <div>
                  <div className="text-sm font-extrabold text-white leading-tight">
                    Admin Fatululi
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Panel Pegawai & Lurah</div>
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
                    className="w-fit px-4 py-2 rounded-full bg-[#262629] hover:bg-neutral-700 text-white text-sm font-semibold inline-flex items-center gap-3 transition-all cursor-pointer"
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
                                ? 'bg-[#E11D2E] text-white shadow-xs'
                                : 'bg-[#1A1A1D] text-neutral-300 hover:bg-[#262629] hover:text-white'
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
                    className="w-fit px-4 py-2 rounded-full bg-[#262629] hover:bg-neutral-700 text-white text-sm font-semibold inline-flex items-center gap-3 transition-all cursor-pointer"
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
                                ? 'bg-[#E11D2E] text-white shadow-xs'
                                : 'bg-[#1A1A1D] text-neutral-300 hover:bg-[#262629] hover:text-white'
                            }`}
                          >
                            {menu.label}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setActiveScreen('portal_warga')}
                        className="w-fit px-3.5 py-2 rounded-full text-xs font-semibold bg-[#1A1A1D] text-neutral-300 hover:bg-[#262629] hover:text-white transition-all cursor-pointer"
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
            <div className="mt-8 bg-[#1A1A1D] rounded-xl p-4 border border-neutral-800">
              <div className="text-xs font-extrabold text-white">{officerSession.jabatan}</div>
              <div className="text-[11px] text-[#E11D2E] font-bold mt-0.5">
                {officerSession.name}
              </div>
              <div className="text-[11px] font-semibold text-emerald-400 mt-1">
                Terhubung Database PostgreSQL
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">Akses Multi-User Aktif</div>

              {/* Quick Switcher for Public View & Direct Logout */}
              <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveScreen('portal_warga')}
                  className="w-fit py-1.5 px-3 rounded-full bg-[#262629] hover:bg-neutral-700 text-[11px] font-bold text-neutral-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home Warga</span>
                </button>
                <button
                  type="button"
                  onClick={handleOfficerLogout}
                  className="w-fit py-1.5 px-3.5 rounded-full bg-[#E11D2E] hover:bg-red-700 text-[11px] font-bold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>

          {/* RIGHT MAIN WORKSPACE */}
          <div className="flex-1 flex flex-col bg-[#F5F5F5]">
            {/* Top White Header inside Admin Panel */}
            <div className="bg-white border-b border-neutral-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-neutral-950">
                  Manajemen Pengaduan & Arsip Digital Kelurahan Fatululi
                </h1>
                <p className="text-[11px] text-neutral-500">
                  Petugas Aktif:{' '}
                  <span className="font-bold text-neutral-900">{officerSession.name}</span> (
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
                    className="relative px-3.5 py-2.5 bg-[#EEEEEE] hover:bg-neutral-300 text-neutral-900 font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-[#E11D2E]" />
                    <span>Notifikasi</span>
                    {unreadNotifications.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#E11D2E] text-white text-[10px] font-extrabold leading-none">
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
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-neutral-300 shadow-2xl z-40 overflow-hidden">
                        <div className="px-4 py-3 bg-[#0B0B0C] text-white flex items-center justify-between">
                          <div>
                            <div className="text-xs font-extrabold">
                              Notifikasi Pengaduan & Tindak Lanjut
                            </div>
                            <div className="text-[11px] text-neutral-300">
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
                              className="text-[11px] font-bold text-[#E11D2E] hover:underline cursor-pointer"
                            >
                              Tandai Dibaca
                            </button>
                          )}
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-200">
                          {actionableNotifications.length === 0 ? (
                            <div className="p-5 text-center text-xs text-neutral-500">
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
                                    isUnread ? 'bg-red-50/40' : 'bg-white'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span
                                      className={`inline-block px-2 py-0.5 text-[10px] font-extrabold ${
                                        isEmergency
                                          ? 'bg-[#E11D2E] text-white'
                                          : isNew
                                          ? 'bg-[#262629] text-white'
                                          : 'bg-neutral-200 text-neutral-800'
                                      }`}
                                    >
                                      {isEmergency
                                        ? 'Darurat • Segera Tindak Lanjuti'
                                        : isNew
                                        ? 'Pengaduan Baru Masuk'
                                        : 'Perlu Mediasi / Verifikasi RT'}
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-neutral-500">
                                      #{shortCode}
                                    </span>
                                  </div>

                                  <div className="text-xs font-extrabold text-neutral-900 mt-1.5">
                                    {notif.title}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 mt-0.5">
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
                                      className="px-3 py-1.5 bg-[#E11D2E] hover:bg-red-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
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
                  className="bg-[#262629] hover:bg-neutral-800 text-white font-extrabold text-xs px-4 py-2.5 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#E11D2E]" />
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
                  className="bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs px-4 py-2.5 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Laporan PDF</span>
                </button>
              </div>
            </div>

            {/* Urgent / New Complaint Notification Banner for Staff */}
            {!hideUrgentBanner && actionableNotifications.length > 0 && (
              <div className="mx-8 mt-5 bg-white border-l-4 border-[#E11D2E] border border-neutral-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#E11D2E] text-white flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-neutral-800">
                    <span className="font-extrabold">Pemberitahuan Staf Kelurahan: </span>
                    Terdapat{' '}
                    <span className="font-extrabold text-[#E11D2E]">
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
                    className="px-3.5 py-1.5 bg-[#E11D2E] hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Tindak Lanjuti Prioritas
                  </button>
                  <button
                    type="button"
                    onClick={() => setHideUrgentBanner(true)}
                    title="Tutup pemberitahuan"
                    className="p-1.5 text-neutral-500 hover:bg-neutral-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 4 KPI Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 px-8 pt-6">
              <div className="bg-white border border-neutral-200 border-t-4 border-t-[#0B0B0C] p-5">
                <div className="text-xs font-semibold text-neutral-500">Total Aduan Bulan Ini</div>
                <div className="text-2xl font-extrabold text-neutral-950 mt-1.5 tabular-nums">
                  {Math.max(48, complaints.length + 44)}
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-2">
                  Terekam di Arsip Digital
                </div>
              </div>

              <div className="bg-white border border-neutral-200 border-t-4 border-t-[#262629] p-5">
                <div className="text-xs font-semibold text-neutral-500">
                  Menunggu Verifikasi & RT
                </div>
                <div className="text-2xl font-extrabold text-neutral-900 mt-1.5 tabular-nums">
                  12
                </div>
                <div className="text-xs font-bold text-neutral-700 mt-2">
                  Perlu Koordinasi RT/RW
                </div>
              </div>

              <div className="bg-white border border-neutral-200 border-t-4 border-t-[#E11D2E] p-5">
                <div className="text-xs font-extrabold text-neutral-800">
                  Aduan Subsidi Minyak Tanah
                </div>
                <div className="text-2xl font-extrabold text-[#E11D2E] mt-1.5 tabular-nums">9</div>
                <div className="text-xs font-bold text-neutral-600 mt-2">
                  Laporan Pangkalan/Kuota
                </div>
              </div>

              <div className="bg-[#262629] text-white border-t-4 border-t-[#E11D2E] p-5">
                <div className="text-xs font-extrabold text-neutral-300">
                  Darurat / Lintas Instansi
                </div>
                <div className="text-2xl font-extrabold text-[#E11D2E] mt-1.5 tabular-nums">3</div>
                <div className="text-xs font-bold text-neutral-300 mt-2">
                  Polsek / BPBD / Damkar
                </div>
              </div>
            </div>

            {/* Real-Time Complaints Table Card */}
            <div className="bg-white border border-neutral-200 p-6 mx-8 mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-neutral-950">
                  Daftar Pengaduan Warga (Real-Time dari Web & Barcode Pos RT)
                </h2>
                {adminSidebarMenu === 'akun' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500 mr-1">Ganti Peran Aktif:</span>
                    {PRESET_OFFICER_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setOfficerSession(acc);
                          showToast(`Beralih peran ke ${acc.jabatan} (${acc.name})`);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          officerSession.id === acc.id
                            ? 'bg-[#E11D2E] text-white'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
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
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Cari NIK, Nama, atau Nomor RT..."
                    className="w-full bg-[#F7F7F7] border border-neutral-300 pl-9 pr-4 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-[#E11D2E]"
                  />
                </div>

                <select
                  value={adminCategoryFilter}
                  onChange={(e) => setAdminCategoryFilter(e.target.value)}
                  className="bg-[#F7F7F7] border border-neutral-300 px-4 py-2.5 text-xs font-medium text-neutral-800 focus:outline-none focus:border-[#E11D2E]"
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
                  className="bg-[#F7F7F7] border border-neutral-300 px-4 py-2.5 text-xs font-medium text-neutral-800 focus:outline-none focus:border-[#E11D2E]"
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
                    <tr className="bg-[#EEEEEE] border-y border-neutral-300 text-[11px] font-extrabold text-neutral-700 uppercase">
                      <th className="py-3.5 px-4">ID & WAKTU</th>
                      <th className="py-3.5 px-4">PELAPOR & NIK</th>
                      <th className="py-3.5 px-4">KATEGORI & SIFAT</th>
                      <th className="py-3.5 px-4">RINGKASAN MASALAH & RT</th>
                      <th className="py-3.5 px-4">STATUS & TINDAKAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-xs">
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
                        <tr key={row.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            <div className="font-extrabold text-neutral-950">#{displayTicket}</div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">{timeLabel}</div>
                          </td>

                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            {row.isConfidential || row.category === 'khusus_rahasia' ? (
                              <>
                                <div className="font-bold text-[#E11D2E]">
                                  [Identitas Dirahasiakan]
                                </div>
                                <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                                  NIK Terverifikasi Sistem
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-extrabold text-neutral-900">
                                  {row.reporterName}
                                </div>
                                <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                                  NIK Warga Valid
                                </div>
                              </>
                            )}
                          </td>

                          <td className="py-4 px-4 align-middle whitespace-nowrap">
                            {row.category === 'musibah_darurat' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E11D2E] text-white font-extrabold text-[11px]">
                                Musibah / Darurat
                              </span>
                            )}
                            {row.category === 'khusus_rahasia' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#262629] text-white font-extrabold text-[11px]">
                                Khusus / Sensitif
                              </span>
                            )}
                            {row.category === 'subsidi_minyak_tanah' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-200 text-neutral-900 font-extrabold text-[11px]">
                                Subsidi Minyak
                              </span>
                            )}
                            {row.category === 'umum_lingkungan' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEEEEE] border border-neutral-300 text-neutral-900 font-extrabold text-[11px]">
                                Umum / Batas Tanah
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 align-middle">
                            <div className="font-extrabold text-neutral-900">
                              {displayTicket === 'FTL-042'
                                ? 'Polusi Bau Kandang Ternak Babi'
                                : row.title}
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
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
                                className="w-56 py-2.5 px-4 bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Teruskan ke BPBD / Damkar
                              </button>
                            ) : row.category === 'khusus_rahasia' ? (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-400 text-neutral-900 font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Update Status / Mediasi
                              </button>
                            ) : row.category === 'subsidi_minyak_tanah' ? (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-400 text-neutral-900 font-extrabold text-xs text-center transition-colors cursor-pointer"
                              >
                                Verifikasi Bersama RT {row.rtNumber}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAdminRowAction(row)}
                                className="w-56 py-2.5 px-4 bg-[#262629] hover:bg-neutral-800 text-white font-extrabold text-xs text-center transition-colors cursor-pointer"
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
              <div className="bg-white border border-neutral-200 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-950 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-[#E11D2E]" />
                    <span>Pembuatan Surat Pengantar Lintas Instansi</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Fasilitasi otomatis surat resmi kelurahan untuk penanganan lanjutan:
                  </p>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold text-neutral-900 mb-2">
                        Pilih ID Tiket Pengaduan
                      </label>
                      <select
                        value={selectedLetterTicketId}
                        onChange={(e) => setSelectedLetterTicketId(Number(e.target.value))}
                        className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-medium text-neutral-900 focus:outline-none focus:border-[#E11D2E]"
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
                      <label className="block text-xs font-extrabold text-neutral-900 mb-2">
                        Instansi Tujuan Tindak Lanjut
                      </label>
                      <select
                        value={selectedLetterAgency}
                        onChange={(e) => setSelectedLetterAgency(e.target.value)}
                        className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-medium text-neutral-900 focus:outline-none focus:border-[#E11D2E]"
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
                  className="mt-6 w-full bg-[#262629] hover:bg-neutral-800 text-white font-extrabold text-xs py-3.5 transition-colors cursor-pointer"
                >
                  Generate & Unduh Surat Resmi (PDF)
                </button>
              </div>

              {/* Bottom Right: Manajemen Arsip Digital & Ekspor PDF Berkala */}
              <div className="bg-white border border-neutral-200 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-950 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#E11D2E]" />
                    <span>Manajemen Arsip Digital & Ekspor PDF Berkala</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Pengganti buku pengaduan fisik untuk permintaan data dari Dinas/Pemkot Kupang.
                  </p>

                  <div className="mt-5">
                    <label className="block text-xs font-extrabold text-neutral-900 mb-2">
                      Periode Rekapitulasi Laporan
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <select
                        value={archivePeriod}
                        onChange={(e) => setArchivePeriod(e.target.value)}
                        className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-medium text-neutral-900 focus:outline-none"
                      >
                        <option value="Oktober 2026 (Bulanan)">Oktober 2026 (Bulanan)</option>
                        <option value="Triwulan IV 2026">Triwulan IV 2026</option>
                        <option value="Semester II 2026">Semester II 2026</option>
                      </select>

                      <select
                        value={archiveCategory}
                        onChange={(e) => setArchiveCategory(e.target.value)}
                        className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-medium text-neutral-900 focus:outline-none"
                      >
                        <option value="Semua Kategori & RT">Semua Kategori & RT</option>
                        <option value="Khusus Subsidi Minyak Tanah">
                          Khusus Subsidi Minyak Tanah
                        </option>
                        <option value="Aduan Rahasia / Sensitif">Aduan Rahasia / Sensitif</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 bg-[#F7F7F7] border-l-4 border-[#0B0B0C] p-3.5 text-xs text-neutral-800">
                    <div className="font-extrabold">Sinkronisasi Buku Arsip Fisik Kelurahan:</div>
                    <div className="mt-0.5 text-[11px] text-neutral-600">
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
                  className="mt-6 w-full bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs py-3.5 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 border-t-4 border-t-[#E11D2E] max-w-lg w-full p-7 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-neutral-200">
              <div>
                <span className="text-xs font-extrabold text-[#E11D2E]">
                  #{editingItem.ticketNumber} • RT {editingItem.rtNumber} / RW{' '}
                  {editingItem.rwNumber}
                </span>
                <h3 className="text-base font-extrabold text-neutral-950 mt-0.5">
                  Tindak Lanjut & Verifikasi ({officerSession.jabatan})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                  Tahapan Status Tindak Lanjut
                </label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-bold text-neutral-900"
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
                <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                  Instansi Tujuan / Koordinasi
                </label>
                <select
                  value={modalAgency}
                  onChange={(e) => setModalAgency(e.target.value)}
                  className="w-full bg-[#F7F7F7] border border-neutral-300 px-4 py-3 text-xs font-medium text-neutral-900"
                >
                  {AGENCY_LIST.map((ag) => (
                    <option key={ag} value={ag}>
                      {ag}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-neutral-900 mb-1.5">
                  Catatan Mediasi / Peninjauan Lapangan
                </label>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Tuliskan hasil koordinasi bersama Ketua RT/RW atau instansi..."
                  required
                  className="w-full bg-[#F7F7F7] border border-neutral-300 p-3.5 text-xs text-neutral-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 bg-neutral-200 text-neutral-800 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingModal}
                  className="px-6 py-2.5 bg-[#E11D2E] hover:bg-red-700 text-white font-extrabold text-xs cursor-pointer"
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
