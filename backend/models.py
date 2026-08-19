"""
Modèles Pydantic — TerciLog v2.
Volontairement plat et simple : pas d'héritage compliqué, pas de champs inutilisés.
"""
import uuid
from datetime import datetime, date, time
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.utcnow()


# ---------- Utilisateurs ----------

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["teacher", "student"] = "student"
    company: Optional[str] = None
    phone: Optional[str] = None
    parcours: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    email: EmailStr
    role: Literal["teacher", "student"]
    company: Optional[str] = None
    phone: Optional[str] = None
    parcours: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    parcours: Optional[str] = None


# ---------- Planning ----------

class PlanningEventCreate(BaseModel):
    type: Literal["session", "personal"]
    title: str
    event_date: date
    start_time: time
    end_time: time
    student_id: Optional[str] = None       # requis si type == "session"
    modality: Optional[Literal["presentiel", "distanciel"]] = None
    description: Optional[str] = None


class PlanningEvent(BaseModel):
    id: str = Field(default_factory=new_id)
    type: Literal["session", "personal"]
    title: str
    event_date: date
    start_time: time
    end_time: time
    student_id: Optional[str] = None
    modality: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Documents (à signer) ----------

class DocumentAssignment(BaseModel):
    student_id: str
    status: Literal["sent", "signed"] = "sent"
    sent_at: datetime = Field(default_factory=now_utc)
    signed_at: Optional[datetime] = None
    signature_data: Optional[str] = None   # image base64 (data URL) de la signature
    signed_ip: Optional[str] = None


class DocumentCreate(BaseModel):
    title: str
    category: Literal["administratif", "emargement"]
    description: Optional[str] = None
    student_ids: List[str] = []
    planning_event_id: Optional[str] = None  # utile pour lier un émargement à une séance


class Document(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str
    category: Literal["administratif", "emargement"]
    description: Optional[str] = None
    file_path: Optional[str] = None   # PDF source uploadé par la formatrice (peut être vide pour un émargement généré)
    planning_event_id: Optional[str] = None
    assignments: List[DocumentAssignment] = []
    created_by: str
    created_at: datetime = Field(default_factory=now_utc)


class SignRequest(BaseModel):
    signature_data: str   # image base64 (data URL) capturée côté client


# ---------- Ressources (consultation seule) ----------

class ResourceAssignment(BaseModel):
    student_id: str
    sent_at: datetime = Field(default_factory=now_utc)
    viewed_at: Optional[datetime] = None


class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    student_ids: List[str] = []


class Resource(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str
    description: Optional[str] = None
    file_path: Optional[str] = None
    assignments: List[ResourceAssignment] = []
    created_by: str
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Journal d'activité (traçabilité Qualiopi) ----------

class ActivityLogEntry(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    action: str             # ex: "login", "document_signed", "resource_viewed"
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=now_utc)
