from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    uid = db.Column(db.String(128), unique=True, nullable=False)
    email = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(64), nullable=False, default="kasi_trantib")
    jabatan = db.Column(db.String(255), nullable=False, default="Kasi Ketentraman & Ketertiban Umum")
    rt_number = db.Column(db.String(10), default="")
    rw_number = db.Column(db.String(10), default="")
    phone = db.Column(db.String(32), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Complaint(db.Model):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    ticket_number = db.Column(db.String(64), unique=True, nullable=False)
    nik = db.Column(db.String(16), nullable=False, index=True)
    reporter_name = db.Column(db.String(255), nullable=False)
    reporter_phone = db.Column(db.String(32), nullable=False)
    rt_number = db.Column(db.String(10), nullable=False)
    rw_number = db.Column(db.String(10), nullable=False)
    address_detail = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(64), nullable=False)
    sub_category = db.Column(db.String(255), nullable=False)
    urgency = db.Column(db.String(32), nullable=False, default="normal")
    is_confidential = db.Column(db.Boolean, nullable=False, default=False)
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=False)
    photo_data_url = db.Column(db.Text, default="")
    qr_source_post = db.Column(db.String(64), default="PORTAL-UTAMA")
    status = db.Column(db.String(64), nullable=False, default="menunggu_verifikasi")
    target_agency = db.Column(db.String(255), default="Internal Kelurahan Fatululi")
    official_letter_number = db.Column(db.String(128), default="")
    admin_notes = db.Column(db.Text, default="")
    verified_by_uid = db.Column(db.String(128), default="")
    verified_by_name = db.Column(db.String(255), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    logs = db.relationship("ComplaintLog", backref="complaint", lazy=True, cascade="all, delete-orphan")


class ComplaintLog(db.Model):
    __tablename__ = "complaint_logs"

    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaints.id"), nullable=False)
    status = db.Column(db.String(64), nullable=False)
    note = db.Column(db.Text, nullable=False)
    actor_name = db.Column(db.String(255), nullable=False)
    actor_role = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
