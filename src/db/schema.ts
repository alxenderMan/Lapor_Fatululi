import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('kasi_trantib'), // 'lurah' | 'kasi_trantib' | 'staf_kelurahan' | 'ketua_rw' | 'ketua_rt'
  jabatan: text('jabatan').notNull().default('Kasi Ketentraman & Ketertiban Umum'),
  rtNumber: text('rt_number').default(''),
  rwNumber: text('rw_number').default(''),
  phone: text('phone').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  nik: text('nik').notNull(),
  reporterName: text('reporter_name').notNull(),
  reporterPhone: text('reporter_phone').notNull(),
  rtNumber: text('rt_number').notNull(),
  rwNumber: text('rw_number').notNull(),
  addressDetail: text('address_detail').notNull(),
  category: text('category').notNull(), // 'umum_lingkungan' | 'khusus_rahasia' | 'subsidi_minyak_tanah' | 'musibah_darurat'
  subCategory: text('sub_category').notNull(),
  urgency: text('urgency').notNull().default('normal'), // 'normal' | 'tinggi' | 'darurat'
  isConfidential: boolean('is_confidential').notNull().default(false),
  title: text('title').notNull(),
  description: text('description').notNull(),
  photoDataUrl: text('photo_data_url').default(''),
  qrSourcePost: text('qr_source_post').default('PORTAL-UTAMA'),
  status: text('status').notNull().default('menunggu_verifikasi'), // 'menunggu_verifikasi' | 'ditinjau_kelurahan' | 'koordinasi_rt_rw' | 'diteruskan_instansi' | 'selesai' | 'ditolak'
  targetAgency: text('target_agency').default('Internal Kelurahan Fatululi'),
  officialLetterNumber: text('official_letter_number').default(''),
  adminNotes: text('admin_notes').default(''),
  verifiedByUid: text('verified_by_uid').default(''),
  verifiedByName: text('verified_by_name').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const complaintLogs = pgTable('complaint_logs', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id')
    .references(() => complaints.id)
    .notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const complaintsRelations = relations(complaints, ({ many }) => ({
  logs: many(complaintLogs),
}));

export const complaintLogsRelations = relations(complaintLogs, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintLogs.complaintId],
    references: [complaints.id],
  }),
}));
