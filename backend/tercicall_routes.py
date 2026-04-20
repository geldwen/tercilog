"""
TerciCall CRM - Routes API pour le module de prospection
Endpoints séparés de server.py pour éviter d'alourdir le monolithe
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
import bcrypt
import csv
import io

# Will be initialized from server.py
db = None
tercicall_router = APIRouter(prefix="/tercicall", tags=["TerciCall CRM"])


def init_db(database):
    global db
    db = database


# --- Pydantic Models ---

class TerciCallUserCreate(BaseModel):
    prenom: str
    password: str
    role: str = "user"


class TerciCallLogin(BaseModel):
    prenom: str
    password: str


class ContactModel(BaseModel):
    nom: str = ""
    poste: str = ""
    tel: str = ""
    email: str = ""


class RappelModel(BaseModel):
    date: str = ""
    note: str = ""


class FicheCreate(BaseModel):
    nom: str
    prenom: str = ""
    cat: str = "entreprise"
    marche: str = "direct"
    status: str = "vierge"
    siret: str = ""
    adresse: str = ""
    tel: str = ""
    email: str = ""
    web: str = ""
    secteur: str = ""
    salaries: str = ""
    ca: str = ""
    notes: str = ""
    rappel: Optional[RappelModel] = None
    contacts: List[ContactModel] = []


class FicheUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    cat: Optional[str] = None
    marche: Optional[str] = None
    status: Optional[str] = None
    siret: Optional[str] = None
    adresse: Optional[str] = None
    tel: Optional[str] = None
    email: Optional[str] = None
    web: Optional[str] = None
    secteur: Optional[str] = None
    salaries: Optional[str] = None
    ca: Optional[str] = None
    notes: Optional[str] = None
    rappel: Optional[RappelModel] = None


class ActionModel(BaseModel):
    text: str


class DocumentModel(BaseModel):
    filename: str
    name: str
    type: str = "Autre"
    data: str = ""


# --- Helper ---

def now_fr():
    return datetime.now(timezone(timedelta(hours=2))).strftime("%d/%m/%Y, %H:%M")


# --- User Management ---

@tercicall_router.post("/login")
async def tercicall_login(data: TerciCallLogin):
    user = await db.tercicall_users.find_one(
        {"prenom": {"$regex": f"^{data.prenom}$", "$options": "i"}},
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")

    if not bcrypt.checkpw(data.password.encode('utf-8'), user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")

    session_id = str(uuid.uuid4())

    await db.tercicall_users.update_one(
        {"prenom": {"$regex": f"^{data.prenom}$", "$options": "i"}},
        {"$set": {
            "online": True,
            "last_active": datetime.now(timezone.utc),
            "session_id": session_id
        }}
    )

    return {
        "session_id": session_id,
        "prenom": user["prenom"],
        "role": user["role"]
    }


@tercicall_router.post("/logout")
async def tercicall_logout(data: dict):
    session_id = data.get("session_id")
    if session_id:
        await db.tercicall_users.update_one(
            {"session_id": session_id},
            {"$set": {"online": False, "session_id": None}}
        )
    return {"ok": True}


@tercicall_router.post("/heartbeat")
async def tercicall_heartbeat(data: dict):
    session_id = data.get("session_id")
    if session_id:
        await db.tercicall_users.update_one(
            {"session_id": session_id},
            {"$set": {"last_active": datetime.now(timezone.utc), "online": True}}
        )
    # Mark users inactive after 60s
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
    await db.tercicall_users.update_many(
        {"last_active": {"$lt": cutoff}, "online": True},
        {"$set": {"online": False}}
    )
    return {"ok": True}


@tercicall_router.get("/users")
async def get_tercicall_users():
    users = await db.tercicall_users.find({}, {"_id": 0, "password": 0, "session_id": 0}).to_list(100)
    return users


@tercicall_router.post("/users")
async def create_tercicall_user(data: TerciCallUserCreate):
    existing = await db.tercicall_users.find_one(
        {"prenom": {"$regex": f"^{data.prenom}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Cet utilisateur existe déjà")

    hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_doc = {
        "id": str(uuid.uuid4()),
        "prenom": data.prenom,
        "password": hashed,
        "role": data.role,
        "online": False,
        "last_active": None,
        "session_id": None
    }
    await db.tercicall_users.insert_one(user_doc)
    return {"id": user_doc["id"], "prenom": data.prenom, "role": data.role}


@tercicall_router.delete("/users/{user_id}")
async def delete_tercicall_user(user_id: str):
    result = await db.tercicall_users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return {"ok": True}


# --- Fiches CRUD ---

@tercicall_router.get("/fiches")
async def get_fiches():
    fiches = await db.tercicall_fiches.find({}, {"_id": 0}).to_list(10000)
    return fiches


@tercicall_router.post("/fiches")
async def create_fiche(data: FicheCreate):
    fiche = {
        "id": str(uuid.uuid4()),
        "created": now_fr(),
        "nom": data.nom,
        "prenom": data.prenom,
        "cat": data.cat,
        "marche": data.marche,
        "status": data.status,
        "siret": data.siret,
        "adresse": data.adresse,
        "tel": data.tel,
        "email": data.email,
        "web": data.web,
        "secteur": data.secteur,
        "salaries": data.salaries,
        "ca": data.ca,
        "notes": data.notes,
        "rappel": data.rappel.dict() if data.rappel else None,
        "actions": [{"date": now_fr(), "text": "Fiche créée"}],
        "contacts": [c.dict() for c in data.contacts] if data.contacts else [],
        "documents": [],
        "updated_at": now_fr()
    }
    await db.tercicall_fiches.insert_one(fiche)
    del fiche["_id"]
    return fiche


@tercicall_router.put("/fiches/{fiche_id}")
async def update_fiche(fiche_id: str, data: FicheUpdate):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if "rappel" in update_data and update_data["rappel"]:
        update_data["rappel"] = data.rappel.dict()
    update_data["updated_at"] = now_fr()
    result = await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    fiche = await db.tercicall_fiches.find_one({"id": fiche_id}, {"_id": 0})
    return fiche


@tercicall_router.delete("/fiches/{fiche_id}")
async def delete_fiche(fiche_id: str):
    result = await db.tercicall_fiches.delete_one({"id": fiche_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    return {"ok": True}


# --- Status Update ---

@tercicall_router.put("/fiches/{fiche_id}/status")
async def update_fiche_status(fiche_id: str, data: dict):
    new_status = data.get("status")
    status_labels = {
        "vierge": "Vierge", "qualifie": "Qualifié", "negocie": "Négocié",
        "client1": "1ère prestation", "fidele": "Client fidèle", "perdu": "Inactif"
    }
    label = status_labels.get(new_status, new_status)

    result = await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {
            "$set": {"status": new_status, "updated_at": now_fr()},
            "$push": {"actions": {"date": now_fr(), "text": f"Statut changé → {label}"}}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    fiche = await db.tercicall_fiches.find_one({"id": fiche_id}, {"_id": 0})
    return fiche


# --- Actions ---

@tercicall_router.post("/fiches/{fiche_id}/actions")
async def add_action(fiche_id: str, data: ActionModel):
    action = {"date": now_fr(), "text": data.text}
    result = await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {
            "$push": {"actions": action},
            "$set": {"updated_at": now_fr()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    return action


@tercicall_router.delete("/fiches/{fiche_id}/actions/{action_index}")
async def delete_action(fiche_id: str, action_index: int):
    fiche = await db.tercicall_fiches.find_one({"id": fiche_id}, {"_id": 0})
    if not fiche:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    actions = fiche.get("actions", [])
    if 0 <= action_index < len(actions):
        actions.pop(action_index)
        await db.tercicall_fiches.update_one(
            {"id": fiche_id},
            {"$set": {"actions": actions, "updated_at": now_fr()}}
        )
    return {"ok": True}


# --- Contacts ---

@tercicall_router.post("/fiches/{fiche_id}/contacts")
async def add_contact(fiche_id: str, data: ContactModel):
    contact = {**data.dict(), "date": now_fr()}
    result = await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {
            "$push": {"contacts": contact},
            "$set": {"updated_at": now_fr()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    return contact


@tercicall_router.delete("/fiches/{fiche_id}/contacts/{contact_index}")
async def delete_contact(fiche_id: str, contact_index: int):
    fiche = await db.tercicall_fiches.find_one({"id": fiche_id}, {"_id": 0})
    if not fiche:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    contacts = fiche.get("contacts", [])
    if 0 <= contact_index < len(contacts):
        contacts.pop(contact_index)
        await db.tercicall_fiches.update_one(
            {"id": fiche_id},
            {"$set": {"contacts": contacts, "updated_at": now_fr()}}
        )
    return {"ok": True}


# --- Rappels ---

@tercicall_router.put("/fiches/{fiche_id}/rappel")
async def update_rappel(fiche_id: str, data: dict):
    rappel = data.get("rappel")
    result = await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {"$set": {"rappel": rappel, "updated_at": now_fr()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    return {"ok": True}


@tercicall_router.get("/rappels-du-jour")
async def get_rappels_du_jour():
    today = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
    fiches = await db.tercicall_fiches.find(
        {"rappel.date": {"$lte": today}, "rappel": {"$ne": None}},
        {"_id": 0}
    ).to_list(1000)
    return [f for f in fiches if f.get("rappel") and f["rappel"].get("date")]


# --- Documents ---

@tercicall_router.post("/fiches/{fiche_id}/documents")
async def add_document(fiche_id: str, data: DocumentModel):
    doc = {
        "id": str(uuid.uuid4()),
        "filename": data.filename,
        "name": data.name,
        "type": data.type,
        "date": now_fr(),
        "data": data.data
    }
    result = await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {
            "$push": {"documents": doc},
            "$set": {"updated_at": now_fr()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fiche non trouvée")
    return {"id": doc["id"], "filename": doc["filename"], "name": doc["name"], "type": doc["type"], "date": doc["date"]}


@tercicall_router.delete("/fiches/{fiche_id}/documents/{doc_id}")
async def delete_document(fiche_id: str, doc_id: str):
    await db.tercicall_fiches.update_one(
        {"id": fiche_id},
        {
            "$pull": {"documents": {"id": doc_id}},
            "$set": {"updated_at": now_fr()}
        }
    )
    return {"ok": True}


# --- Stats ---

@tercicall_router.get("/stats")
async def get_stats():
    fiches = await db.tercicall_fiches.find({}, {"_id": 0, "ca": 1, "status": 1, "cat": 1, "marche": 1}).to_list(10000)

    total_ca = 0
    status_counts = {}
    cat_counts = {"entreprise": 0, "particulier": 0}
    marche_counts = {}

    for f in fiches:
        try:
            ca_val = f.get("ca", "")
            if ca_val:
                total_ca += float(str(ca_val).replace(" ", "").replace(",", "."))
        except (ValueError, TypeError):
            pass

        s = f.get("status", "vierge")
        status_counts[s] = status_counts.get(s, 0) + 1

        c = f.get("cat", "entreprise")
        if c in cat_counts:
            cat_counts[c] += 1

        m = f.get("marche", "")
        if m:
            marche_counts[m] = marche_counts.get(m, 0) + 1

    return {
        "total": len(fiches),
        "total_ca": total_ca,
        "status_counts": status_counts,
        "cat_counts": cat_counts,
        "marche_counts": marche_counts
    }


# --- CSV Export ---

@tercicall_router.get("/export-csv")
async def export_csv():
    from fastapi.responses import StreamingResponse

    fiches = await db.tercicall_fiches.find({}, {"_id": 0, "documents": 0}).to_list(10000)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(["Nom", "Prénom", "Catégorie", "Marché", "Statut", "SIRET", "Adresse", "Tél", "Email", "Site web", "Secteur", "Salariés", "CA estimé", "Notes", "Créé le"])

    for f in fiches:
        writer.writerow([
            f.get("nom", ""), f.get("prenom", ""), f.get("cat", ""),
            f.get("marche", ""), f.get("status", ""), f.get("siret", ""),
            f.get("adresse", ""), f.get("tel", ""), f.get("email", ""),
            f.get("web", ""), f.get("secteur", ""), f.get("salaries", ""),
            f.get("ca", ""), f.get("notes", ""), f.get("created", "")
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tercicall_export.csv"}
    )


# --- Seed default admin ---

async def seed_tercicall_admin():
    existing = await db.tercicall_users.find_one(
        {"prenom": {"$regex": "^Jonathan$", "$options": "i"}},
        {"_id": 0}
    )
    if not existing:
        hashed = bcrypt.hashpw("Geldwen1982*+".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        await db.tercicall_users.insert_one({
            "id": str(uuid.uuid4()),
            "prenom": "Jonathan",
            "password": hashed,
            "role": "admin",
            "online": False,
            "last_active": None,
            "session_id": None
        })
        print("TerciCall: Admin Jonathan créé")
