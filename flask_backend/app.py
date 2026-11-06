import random
from datetime import datetime
from flask import Flask, request, jsonify
from config import Config
from models import db, User, Complaint, ComplaintLog

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)


def mask_nik(nik: str) -> str:
    if not nik or len(nik) < 10:
        return "537104**********"
    return f"{nik[:6]}******{nik[-4:]}"


@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    payload = request.get_json(force=True)
    nik = "".join(ch for ch in str(payload.get("nik", "")) if ch.isdigit())

    if len(nik) != 16:
        return jsonify({
            "error": "Validasi Gagal: NIK wajib berjumlah tepat 16 digit angka."
        }), 400

    now = datetime.utcnow()
    ticket_number = f"FTL-{now.strftime('%Y%m')}-{random.randint(1000, 9999)}"
    category = payload.get("category", "umum_lingkungan")
    urgency = payload.get("urgency", "normal")
    is_confidential = bool(payload.get("isConfidential")) or category == "khusus_rahasia"

    complaint = Complaint(
        ticket_number=ticket_number,
        nik=nik,
        reporter_name=payload["reporterName"].strip(),
        reporter_phone=payload["reporterPhone"].strip(),
        rt_number=str(payload["rtNumber"]).zfill(3),
        rw_number=str(payload["rwNumber"]).zfill(3),
        address_detail=payload["addressDetail"].strip(),
        category=category,
        sub_category=payload.get("subCategory", "Umum"),
        urgency=urgency,
        is_confidential=is_confidential,
        title=payload["title"].strip(),
        description=payload["description"].strip(),
        photo_data_url=payload.get("photoDataUrl", ""),
        qr_source_post=payload.get("qrSourcePost", "PORTAL-UTAMA"),
        status="ditinjau_kelurahan" if urgency == "darurat" else "menunggu_verifikasi",
    )
    db.session.add(complaint)
    db.session.flush()

    initial_log = ComplaintLog(
        complaint_id=complaint.id,
        status=complaint.status,
        note=f"Laporan teregistrasi melalui {complaint.qr_source_post} dengan Tiket {ticket_number}.",
        actor_name="Sistem E-Lapor Fatululi",
        actor_role="Registrasi Digital",
    )
    db.session.add(initial_log)
    db.session.commit()

    return jsonify({"ticketNumber": ticket_number, "status": complaint.status}), 201


@app.route("/api/complaints/track", methods=["GET"])
def track_complaint():
    q = request.args.get("q", "").strip().upper()
    query = Complaint.query.order_by(Complaint.created_at.desc())

    if q:
        query = query.filter(
            (Complaint.ticket_number.ilike(f"%{q}%")) | (Complaint.nik == q)
        )

    results = []
    for item in query.all():
        results.append({
            "ticketNumber": item.ticket_number,
            "nikMasked": mask_nik(item.nik),
            "reporterName": "Pelapor Rahasia (Dilindungi Kelurahan)" if item.is_confidential else item.reporter_name,
            "rtNumber": item.rt_number,
            "rwNumber": item.rw_number,
            "category": item.category,
            "subCategory": item.sub_category,
            "urgency": item.urgency,
            "title": item.title,
            "status": item.status,
            "targetAgency": item.target_agency,
            "officialLetterNumber": item.official_letter_number,
        })
    return jsonify({"items": results})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
