"""
TerciLog v2 — backend allégé.
Trois besoins réels couverts : (1) base de données + emails automatiques,
(2) espace élève avec documents/ressources signables et horodatés,
(3) export Qualiopi par élève / par société.

Volontairement plat, peu de dépendances, pas de fonctionnalités inutilisées.
"""
import os
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv

from database import get_db
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_teacher,
)
from models import (
    UserCreate, UserLogin, User, StudentUpdate,
    PlanningEventCreate, PlanningEvent,
    DocumentCreate, Document, DocumentAssignment, SignRequest,
    ResourceCreate, Resource, ResourceAssignment,
    ActivityLogEntry, new_id, now_utc,
)
from email_service import send_welcome_email, send_document_to_sign_email
from pdf_utils import generate_signature_certificate, generate_qualiopi_export

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("terciform")

UPLOAD_DOCS_DIR = ROOT_DIR / "uploads" / "documents"
UPLOAD_RES_DIR = ROOT_DIR / "uploads" / "resources"
UPLOAD_DOCS_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_RES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TerciForm API")
api_router = APIRouter(prefix="/api")


async def log_activity(user_id: str, action: str, details: str = None):
    db = get_db()
    entry = ActivityLogEntry(user_id=user_id, action=action, details=details)
    await db.activity_log.insert_one(entry.model_dump())


# ============================================================
# AUTH
# ============================================================

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    """
    Inscription. Note : dans l'app réelle, seule la formatrice crée des comptes élève
    depuis son espace (endpoint /students ci-dessous exige le rôle teacher). Cet endpoint
    reste ouvert pour permettre la création du tout premier compte formateur.
    """
    db = get_db()
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

    user = User(
        name=user_data.name,
        email=user_data.email,
        role=user_data.role,
        company=user_data.company,
        phone=user_data.phone,
        parcours=user_data.parcours,
    )
    doc = user.model_dump()
    doc["password_hash"] = hash_password(user_data.password)
    await db.users.insert_one(doc)

    if user.role == "student":
        async def _send_bg():
            try:
                sent = await asyncio.to_thread(send_welcome_email, user.email, user.name, user_data.password)
                logger.info("Email de bienvenue %s pour %s", "envoyé" if sent else "NON envoyé", user.email)
            except Exception as e:
                logger.error("Erreur email de bienvenue pour %s : %s", user.email, e)
        asyncio.create_task(_send_bg())

    return user


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")
    token = create_access_token(user["id"], user["role"])
    await log_activity(user["id"], "login")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")},
    }


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# ============================================================
# ÉLÈVES (gérés uniquement par la formatrice)
# ============================================================

@api_router.post("/students", response_model=User)
async def create_student(user_data: UserCreate, teacher: dict = Depends(require_teacher)):
    db = get_db()
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

    user = User(
        name=user_data.name, email=user_data.email, role="student",
        company=user_data.company, phone=user_data.phone, parcours=user_data.parcours,
    )
    doc = user.model_dump()
    doc["password_hash"] = hash_password(user_data.password)
    await db.users.insert_one(doc)

    async def _send_bg():
        try:
            sent = await asyncio.to_thread(send_welcome_email, user.email, user.name, user_data.password)
            logger.info("Email de bienvenue %s pour %s", "envoyé" if sent else "NON envoyé", user.email)
        except Exception as e:
            logger.error("Erreur email de bienvenue pour %s : %s", user.email, e)
    asyncio.create_task(_send_bg())

    await log_activity(teacher["id"], "student_created", details=user.email)
    return user


@api_router.get("/students", response_model=List[User])
async def list_students(teacher: dict = Depends(require_teacher)):
    db = get_db()
    cursor = db.users.find({"role": "student"})
    return [User(**{k: v for k, v in u.items() if k != "_id"}) async for u in cursor]


@api_router.get("/students/{student_id}", response_model=User)
async def get_student(student_id: str, teacher: dict = Depends(require_teacher)):
    db = get_db()
    u = await db.users.find_one({"id": student_id, "role": "student"})
    if not u:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    return User(**{k: v for k, v in u.items() if k != "_id"})


@api_router.put("/students/{student_id}", response_model=User)
async def update_student(student_id: str, update: StudentUpdate, teacher: dict = Depends(require_teacher)):
    db = get_db()
    changes = {k: v for k, v in update.model_dump().items() if v is not None}
    if changes:
        await db.users.update_one({"id": student_id, "role": "student"}, {"$set": changes})
    u = await db.users.find_one({"id": student_id, "role": "student"})
    if not u:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    return User(**{k: v for k, v in u.items() if k != "_id"})


@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, teacher: dict = Depends(require_teacher)):
    db = get_db()
    result = await db.users.delete_one({"id": student_id, "role": "student"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    return {"ok": True}


# ============================================================
# PLANNING (séances TerciLog + rendez-vous personnels)
# ============================================================

@api_router.post("/planning", response_model=PlanningEvent)
async def create_event(event: PlanningEventCreate, teacher: dict = Depends(require_teacher)):
    if event.type == "session" and not event.student_id:
        raise HTTPException(status_code=400, detail="Une séance doit être liée à un élève.")
    db = get_db()
    new_event = PlanningEvent(**event.model_dump())
    payload = new_event.model_dump()
    payload["event_date"] = payload["event_date"].isoformat()
    payload["start_time"] = payload["start_time"].isoformat()
    payload["end_time"] = payload["end_time"].isoformat()
    await db.planning.insert_one(payload)
    return new_event


@api_router.get("/planning")
async def list_events(current_user: dict = Depends(get_current_user)):
    db = get_db()
    query = {} if current_user["role"] == "teacher" else {"student_id": current_user["id"]}
    cursor = db.planning.find(query)
    return [{k: v for k, v in e.items() if k != "_id"} async for e in cursor]


@api_router.delete("/planning/{event_id}")
async def delete_event(event_id: str, teacher: dict = Depends(require_teacher)):
    db = get_db()
    result = await db.planning.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Événement introuvable.")
    return {"ok": True}


# ============================================================
# DOCUMENTS (à signer, avec horodatage)
# ============================================================

@api_router.post("/documents", response_model=Document)
async def create_document(
    title: str = Form(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    student_ids: str = Form(""),   # liste d'ids séparés par des virgules
    planning_event_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    ids = [s.strip() for s in student_ids.split(",") if s.strip()]

    file_path = None
    if file is not None:
        ext = Path(file.filename).suffix or ".pdf"
        fname = f"{new_id()}{ext}"
        dest = UPLOAD_DOCS_DIR / fname
        content = await file.read()
        dest.write_bytes(content)
        file_path = str(dest.relative_to(ROOT_DIR))

    document = Document(
        title=title, category=category, description=description,
        file_path=file_path, planning_event_id=planning_event_id,
        assignments=[DocumentAssignment(student_id=sid) for sid in ids],
        created_by=teacher["id"],
    )
    await db.documents.insert_one(document.model_dump())

    for sid in ids:
        student = await db.users.find_one({"id": sid})
        if student:
            async def _send_bg(email=student["email"], name=student["name"], t=title):
                try:
                    await asyncio.to_thread(send_document_to_sign_email, email, name, t)
                except Exception as e:
                    logger.error("Erreur email document pour %s : %s", email, e)
            asyncio.create_task(_send_bg())

    await log_activity(teacher["id"], "document_created", details=title)
    return document


@api_router.get("/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["role"] == "teacher":
        cursor = db.documents.find({})
    else:
        cursor = db.documents.find({"assignments.student_id": current_user["id"]})
    return [{k: v for k, v in d.items() if k != "_id"} async for d in cursor]


@api_router.get("/documents/{document_id}/file")
async def get_document_file(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    d = await db.documents.find_one({"id": document_id})
    if not d or not d.get("file_path"):
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    if current_user["role"] != "teacher":
        assigned = any(a["student_id"] == current_user["id"] for a in d.get("assignments", []))
        if not assigned:
            raise HTTPException(status_code=403, detail="Accès refusé.")
    return FileResponse(ROOT_DIR / d["file_path"])


@api_router.post("/documents/{document_id}/sign")
async def sign_document(document_id: str, sign_req: SignRequest, request: Request,
                         current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Seul l'élève destinataire peut signer.")
    db = get_db()
    d = await db.documents.find_one({"id": document_id})
    if not d:
        raise HTTPException(status_code=404, detail="Document introuvable.")

    assignments = d.get("assignments", [])
    found = False
    for a in assignments:
        if a["student_id"] == current_user["id"]:
            a["status"] = "signed"
            a["signed_at"] = now_utc()
            a["signature_data"] = sign_req.signature_data
            a["signed_ip"] = request.client.host if request.client else None
            found = True
            break
    if not found:
        raise HTTPException(status_code=403, detail="Ce document ne t'est pas destiné.")

    await db.documents.update_one({"id": document_id}, {"$set": {"assignments": assignments}})
    await log_activity(current_user["id"], "document_signed", details=d.get("title"))
    return {"ok": True, "signed_at": now_utc()}


@api_router.get("/documents/{document_id}/certificate")
async def get_signature_certificate(document_id: str, student_id: str,
                                     current_user: dict = Depends(get_current_user)):
    db = get_db()
    d = await db.documents.find_one({"id": document_id})
    if not d:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    if current_user["role"] != "teacher" and current_user["id"] != student_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    assignment = next((a for a in d.get("assignments", []) if a["student_id"] == student_id), None)
    if not assignment or assignment.get("status") != "signed":
        raise HTTPException(status_code=400, detail="Ce document n'est pas encore signé.")
    student = await db.users.find_one({"id": student_id})
    pdf_bytes = generate_signature_certificate(
        document_title=d["title"], student_name=student["name"], student_email=student["email"],
        signed_at=assignment["signed_at"], signed_ip=assignment.get("signed_ip"),
        signature_data_url=assignment.get("signature_data"),
    )
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf",
                              headers={"Content-Disposition": f'attachment; filename="certificat-{document_id}.pdf"'})


# ============================================================
# RESSOURCES (consultation seule, pas de signature)
# ============================================================

@api_router.post("/resources", response_model=Resource)
async def create_resource(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    student_ids: str = Form(""),
    file: Optional[UploadFile] = File(None),
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    ids = [s.strip() for s in student_ids.split(",") if s.strip()]

    file_path = None
    if file is not None:
        ext = Path(file.filename).suffix or ".pdf"
        fname = f"{new_id()}{ext}"
        dest = UPLOAD_RES_DIR / fname
        content = await file.read()
        dest.write_bytes(content)
        file_path = str(dest.relative_to(ROOT_DIR))

    resource = Resource(
        title=title, description=description, file_path=file_path,
        assignments=[ResourceAssignment(student_id=sid) for sid in ids],
        created_by=teacher["id"],
    )
    await db.resources.insert_one(resource.model_dump())
    await log_activity(teacher["id"], "resource_created", details=title)
    return resource


@api_router.get("/resources")
async def list_resources(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["role"] == "teacher":
        cursor = db.resources.find({})
    else:
        cursor = db.resources.find({"assignments.student_id": current_user["id"]})
    return [{k: v for k, v in r.items() if k != "_id"} async for r in cursor]


@api_router.get("/resources/{resource_id}/file")
async def get_resource_file(resource_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    r = await db.resources.find_one({"id": resource_id})
    if not r or not r.get("file_path"):
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    if current_user["role"] != "teacher":
        assigned = any(a["student_id"] == current_user["id"] for a in r.get("assignments", []))
        if not assigned:
            raise HTTPException(status_code=403, detail="Accès refusé.")
        assignments = r.get("assignments", [])
        for a in assignments:
            if a["student_id"] == current_user["id"] and not a.get("viewed_at"):
                a["viewed_at"] = now_utc()
                await db.resources.update_one({"id": resource_id}, {"$set": {"assignments": assignments}})
                break
    return FileResponse(ROOT_DIR / r["file_path"])


# ============================================================
# EXPORT QUALIOPI
# ============================================================

@api_router.get("/export/qualiopi/student/{student_id}")
async def export_qualiopi_student(student_id: str, teacher: dict = Depends(require_teacher)):
    db = get_db()
    student = await db.users.find_one({"id": student_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")

    docs_cursor = db.documents.find({"assignments.student_id": student_id})
    documents_summary = []
    async for d in docs_cursor:
        a = next((x for x in d.get("assignments", []) if x["student_id"] == student_id), None)
        documents_summary.append({
            "title": d["title"], "category": d["category"],
            "status": a["status"] if a else "sent",
            "signed_at": a.get("signed_at") if a else None,
        })

    events_cursor = db.planning.find({"student_id": student_id, "type": "session"})
    sessions_summary = []
    async for e in events_cursor:
        signed = False
        linked_doc = await db.documents.find_one({"planning_event_id": e["id"], "assignments.student_id": student_id})
        if linked_doc:
            a = next((x for x in linked_doc.get("assignments", []) if x["student_id"] == student_id), None)
            signed = bool(a and a.get("status") == "signed")
        sessions_summary.append({
            "title": e["title"], "event_date": e["event_date"],
            "start_time": e["start_time"], "end_time": e["end_time"],
            "modality": e.get("modality") or "-", "signed": signed,
        })

    pdf_bytes = generate_qualiopi_export(
        student_name=student["name"], student_email=student["email"],
        company=student.get("company"), parcours=student.get("parcours"),
        documents=documents_summary, sessions=sessions_summary,
    )
    await log_activity(teacher["id"], "qualiopi_export", details=f"student:{student['email']}")
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf",
                              headers={"Content-Disposition": f'attachment; filename="qualiopi-{student["name"]}.pdf"'})


@api_router.get("/export/qualiopi/company/{company}")
async def export_qualiopi_company(company: str, teacher: dict = Depends(require_teacher)):
    db = get_db()
    students_cursor = db.users.find({"role": "student", "company": company})
    students = [s async for s in students_cursor]
    if not students:
        raise HTTPException(status_code=404, detail="Aucun élève trouvé pour cette société.")

    # Pour l'instant : un PDF combiné simple (un export par élève, concaténé n'est pas géré ici).
    # Amélioration prévue une fois la maquette Qualiopi précise fournie par Jo.
    all_docs_summary = []
    for student in students:
        docs_cursor = db.documents.find({"assignments.student_id": student["id"]})
        async for d in docs_cursor:
            a = next((x for x in d.get("assignments", []) if x["student_id"] == student["id"]), None)
            all_docs_summary.append({
                "title": f'{d["title"]} — {student["name"]}', "category": d["category"],
                "status": a["status"] if a else "sent",
                "signed_at": a.get("signed_at") if a else None,
            })

    pdf_bytes = generate_qualiopi_export(
        student_name=f"Société : {company}", student_email=f"{len(students)} élève(s)",
        company=company, parcours="—", documents=all_docs_summary, sessions=[],
    )
    await log_activity(teacher["id"], "qualiopi_export", details=f"company:{company}")
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf",
                              headers={"Content-Disposition": f'attachment; filename="qualiopi-{company}.pdf"'})


# ============================================================
# APP SETUP
# ============================================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "app": "TerciForm API v2"}
