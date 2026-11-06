import React from 'react';
import { Flame, Droplets, ShieldAlert, Trees } from 'lucide-react';

interface EvidenceVisualProps {
  photoDataUrl?: string;
  category: string;
  title: string;
  subCategory?: string;
  className?: string;
}

export const EvidenceVisual: React.FC<EvidenceVisualProps> = ({
  photoDataUrl,
  category,
  title,
  subCategory,
  className = 'h-44 w-full',
}) => {
  if (photoDataUrl && photoDataUrl.startsWith('data:image/')) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-slate-900 border border-slate-200 ${className}`}>
        <img
          src={photoDataUrl}
          alt={`Bukti lapangan: ${title}`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent px-3 py-2 text-xs text-white">
          <span className="font-medium">Foto Bukti Lapangan Warga</span>
        </div>
      </div>
    );
  }

  // Bespoke Documentary Graphic Fallbacks (Zero-Broken-Image Policy)
  if (photoDataUrl === 'svg:minyak_tanah' || category === 'subsidi_minyak_tanah') {
    return (
      <div
        className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-900 via-amber-800 to-slate-900 p-4 text-white border border-amber-700/40 flex flex-col justify-between ${className}`}
      >
        <svg
          className="absolute right-2 bottom-2 h-28 w-28 text-amber-400/15 pointer-events-none"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <rect x="20" y="25" width="60" height="65" rx="8" />
          <rect x="35" y="12" width="30" height="13" rx="3" />
          <path d="M28 45 H72 M28 65 H72" stroke="currentColor" strokeWidth="4" />
        </svg>
        <div className="flex items-center justify-between text-xs text-amber-200/90">
          <span>Dokumentasi Pangkalan Minyak Tanah</span>
          <Droplets className="h-4 w-4 text-amber-300" />
        </div>
        <div className="my-auto">
          <p className="text-xs text-amber-200/80 mb-1">{subCategory || 'Pengawasan Distribusi Subsidi'}</p>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
        </div>
        <div className="text-[11px] text-amber-100/75 font-mono tabular-nums">
          VERIFIKASI KUOTA KK · KELURAHAN FATULULI
        </div>
      </div>
    );
  }

  if (photoDataUrl === 'svg:rahasia' || category === 'khusus_rahasia') {
    return (
      <div
        className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 text-white border border-slate-700 flex flex-col justify-between ${className}`}
      >
        <div className="flex items-center justify-between text-xs text-blue-200">
          <span>Arsip Bukti Terenkripsi (Whistleblowing)</span>
          <ShieldAlert className="h-4 w-4 text-amber-400" />
        </div>
        <div className="my-auto">
          <p className="text-xs text-slate-300 mb-1">Privasi Pelapor Dilindungi dari Tetangga</p>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
        </div>
        <div className="text-[11px] text-slate-300 font-mono tabular-nums">
          AKSES TERBATAS: LURAH & KASI TRANTIB
        </div>
      </div>
    );
  }

  if (photoDataUrl === 'svg:darurat' || category === 'musibah_darurat') {
    return (
      <div
        className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-red-950 via-red-900 to-slate-900 p-4 text-white border border-red-800/50 flex flex-col justify-between ${className}`}
      >
        <div className="flex items-center justify-between text-xs text-red-200">
          <span>Dokumentasi Tanggap Darurat Lingkungan</span>
          <Flame className="h-4 w-4 text-amber-300" />
        </div>
        <div className="my-auto">
          <p className="text-xs text-red-200/80 mb-1">{subCategory || 'Musibah / Bencana Lokal'}</p>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
        </div>
        <div className="text-[11px] text-red-100/80 font-mono tabular-nums">
          KOORDINASI CEPAT: BPBD & DAMKAR KOTA KUPANG
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4 text-white border border-blue-800/40 flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between text-xs text-blue-200">
        <span>Dokumentasi Fasum & Lingkungan RT/RW</span>
        <Trees className="h-4 w-4 text-amber-300" />
      </div>
      <div className="my-auto">
        <p className="text-xs text-blue-200/80 mb-1">{subCategory || 'Lingkungan & Ketertiban Umum'}</p>
        <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
      </div>
      <div className="text-[11px] text-blue-100/75 font-mono tabular-nums">
        PENINJAUAN LAPANGAN · KELURAHAN FATULULI
      </div>
    </div>
  );
};
