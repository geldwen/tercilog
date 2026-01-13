from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File as FastAPIFile, BackgroundTasks
from fastapi.responses import Response, FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import pytz  # Fuseau horaire Paris
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas
import io
import fitz  # PyMuPDF - pas besoin de poppler !
from PIL import Image as PILImage
from quality_ai_agent import calculate_quality_scores
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import asyncio
from evolution_analysis import generate_evolution_report

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# Mount static files for profile pictures
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="/app/backend/static"), name="static")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Scheduler pour les rappels automatiques (AsyncIOScheduler compatible avec FastAPI)
scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    """Démarrer le scheduler au lancement de l'application"""
    try:
        # Vérifier les rappels toutes les 2 minutes pour être précis sur les 15 min
        scheduler.add_job(
            send_session_reminders,
            trigger=IntervalTrigger(minutes=2),
            id='session_reminders',
            name='Vérification des rappels de séances (15 min avant)',
            replace_existing=True
        )
        scheduler.start()
        logger.info("✅ Scheduler de rappels 15min démarré - Vérification toutes les 2 minutes")
    except Exception as e:
        logger.error(f"Erreur lors du démarrage du scheduler: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Arrêter le scheduler lors de l'arrêt de l'application"""
    try:
        scheduler.shutdown()
        logger.info("✅ Scheduler de rappels arrêté proprement")
    except Exception as e:
        logger.error(f"Erreur lors de l'arrêt du scheduler: {e}")


# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str  # "teacher" or "student"
    credit_hours: float = 0.0
    total_hours: float = 0.0
    phone: str = ""
    organism: str = ""
    support_type: str = ""
    session_type: str = ""  # "distanciel" or "présentiel"
    start_date: str = ""
    end_date: str = ""
    parcours: str = ""  # Matière/Parcours de l'élève (ex: Anglais, Management, Bureautique)
    teacher_name: str = ""  # Nom du formateur assigné
    teacher_email: str = ""  # Email du formateur
    teacher_phone: str = ""  # Téléphone du formateur
    profile_picture: str = ""  # URL de la photo de profil (homme/femme/custom)
    teacher_profile_picture: str = ""  # URL de la photo du formateur
    welcome_email_sent: bool = False  # Email de bienvenue envoyé ou non
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Champs pour le lieu de formation (si présentiel)
    formation_address: str = ""  # Adresse complète (générée automatiquement)
    formation_building: str = ""  # Établissement / Bâtiment
    formation_street_number: str = ""  # N° de rue
    formation_street: str = ""  # Nom de la rue
    formation_postal_code: str = ""
    formation_city: str = ""
    formation_country: str = ""
    formation_transports: str = ""  # Infos transports pour s'y rendre

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    credit_hours: float = 0.0
    total_hours: float = 0.0
    phone: str = ""
    organism: str = ""
    support_type: str = ""
    session_type: str = ""  # "distanciel" or "présentiel"
    start_date: str = ""
    end_date: str = ""
    parcours: str = ""  # Matière/Parcours de l'élève
    teacher_name: str = ""  # Nom du formateur
    teacher_email: str = ""  # Email du formateur
    teacher_phone: str = ""  # Téléphone du formateur
    profile_picture: str = ""  # URL de la photo de profil de l'élève
    teacher_profile_picture: str = ""  # URL de la photo du formateur
    # Champs pour le lieu de formation (si présentiel)
    formation_address: str = ""
    formation_building: str = ""
    formation_street_number: str = ""
    formation_street: str = ""
    formation_postal_code: str = ""
    formation_city: str = ""
    formation_country: str = ""
    formation_transports: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Session(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subject: str
    date: str  # Format: YYYY-MM-DD
    start_time: str  # Format: HH:MM
    end_time: str  # Format: HH:MM
    student_id: str
    student_name: str
    student_email: str
    status: str = "pending"  # pending, confirmed, rejected
    validation_deadline: Optional[str] = None
    validated_at: Optional[str] = None
    duration_hours: float = 0.0
    confirmation_status: str = "pending"  # pending, confirmed
    confirmation_at: Optional[str] = None  # Horodatage de la confirmation de présence
    confirmed_by_student: bool = False  # Confirmation par l'élève avant émargement
    confirmed_by_student_at: Optional[str] = None  # Horodatage de la confirmation élève
    signature: Optional[str] = None  # Base64 image de la signature élève
    signed_at: Optional[str] = None  # Horodatage de l'émargement élève
    signature_status: str = "not_required"  # not_required, pending, signed
    attendance_email_sent: bool = False  # Email d'émargement envoyé ou non
    reminder_email_sent: bool = False  # Email de rappel 5 min avant envoyé ou non
    meeting_link: str = ""  # Lien Google Meet ou autre visio
    teacher_signature: Optional[str] = None  # Base64 image de la signature formateur
    teacher_signed_at: Optional[str] = None  # Horodatage de l'émargement formateur
    teacher_signature_status: str = "scheduled"  # scheduled, pending, signed
    hourly_rate: Optional[float] = None  # Coût horaire en euros (peut être null)
    hourly_rate_source: str = "auto"  # auto (calculé) ou manual (saisi par utilisateur)
    amount: float = 0.0  # Montant total calculé (durée × coût horaire)
    organism: str = ""  # Organisme/Centre de formation
    student_organism: str = ""  # Organisme de l'élève (pour affichage planning)
    modality: str = "distanciel"  # distanciel ou présentiel
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentResource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    parcours: str
    category: str  # "TEST_PARCOURS" ou "QUESTIONNAIRE_QUALIOPI"
    sub_type: str  # "POSITIONNEMENT" | "MI_PARCOURS" | "FIN"
    template_name: str  # Nom du modèle choisi
    template_id: Optional[str] = None  # ID du template dans test_templates
    resource_type: str = "FORM"  # "FILE" ou "FORM"
    status: str = "NON_COMMENCE"  # "NON_COMMENCE" | "EN_COURS" | "SOUMIS"
    score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    subject: str
    date: str
    start_time: str
    end_time: str
    student_id: str
    validation_deadline_hours: int = 48
    meeting_link: str = ""  # Lien Google Meet ou autre visio
    organism: str = ""  # Organisme/Centre de formation
    hourly_rate: Optional[float] = None  # Coût horaire (optionnel, calculé auto si absent)
    hourly_rate_source: str = "auto"  # auto ou manual
    modality: str = "distanciel"  # distanciel ou présentiel

class SessionValidate(BaseModel):
    status: str  # "confirmed" or "rejected"

class TrainingNeeds(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    expectations: str = ""  # Qu'attendez-vous de cette formation ?
    strengths: str = ""  # Quelles sont vos forces actuelles ?
    improvements: str = ""  # Qu'aimeriez-vous améliorer ?
    availability: str = ""  # Quelles sont vos disponibilités ?
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TrainingNeedsCreate(BaseModel):
    expectations: str = ""
    strengths: str = ""
    improvements: str = ""
    availability: str = ""

class StudentDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    category: str  # "positionnement", "evaluation_cours", "evaluation_fin", "support"
    filename: str
    filepath: str
    mime: Optional[str] = None
    size: Optional[int] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    uploaded_by: Optional[str] = None  # ID du formateur qui a uploadé

class StudentCategoryNote(BaseModel):
    """Note/niveau obtenu pour une catégorie entière (pas par document)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    category: str  # "positionnement", "evaluation_cours", "evaluation_fin"
    note: str  # Ex: "B2", "15/20", "Acquis"
    validated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    validated_by: str  # ID du formateur

class StudentFeedback(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    quality_rating: str = ""  # Comment évaluez-vous la qualité de la formation ?
    teacher_support: str = ""  # Le formateur vous a-t-il accompagné efficacement ?
    recommendation: str = ""  # Recommanderiez-vous cette formation ?
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentFeedbackCreate(BaseModel):
    quality_rating: str
    teacher_support: str
    recommendation: str

class PlanningEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    date: str
    start_time: str
    end_time: str
    organism: str = ""
    color: str = "#3B82F6"  # Couleur de l'événement
    hourly_rate: Optional[float] = None  # Tarif horaire
    subject: str = ""  # Matière
    modality: str = "distanciel"  # Type: distanciel ou présentiel
    teacher_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlanningEventCreate(BaseModel):
    title: str
    date: str
    start_time: str
    end_time: str
    organism: str = ""
    color: str = "#3B82F6"  # Couleur de l'événement
    hourly_rate: Optional[float] = None  # Tarif horaire
    subject: str = ""  # Matière
    modality: str = "distanciel"  # Type

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Recalculer les heures restantes pour les élèves
    if user.get('role') == 'student':
        total_hours = user.get('total_hours', 0)
        # Calculer la somme des heures ÉMARGÉES uniquement (sessions signées par l'élève)
        sessions = await db.sessions.find({
            "student_id": user_id,
            "signature_status": "signed"
        }, {"_id": 0}).to_list(10000)
        emargees_hours = sum(s.get('duration_hours', 0) for s in sessions)
        # Heures restantes = total - heures émargées
        user['credit_hours'] = max(0, total_hours - emargees_hours)
    
    return User(**user)

def normalize_subject(subject: str) -> str:
    """Normaliser un sujet/intitulé pour détection de mots-clés"""
    import unicodedata
    import re
    
    # Retirer accents
    normalized = unicodedata.normalize('NFD', subject.lower())
    normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    
    # Retirer ponctuation
    normalized = re.sub(r'[^\w\s]', ' ', normalized)
    
    return normalized


def infer_hourly_rate(subject: str, fallback: float = 40.0) -> float:
    """
    Déterminer le coût horaire basé sur le sujet.
    20€/h pour test de positionnement/équivalence, sinon fallback (40€/h)
    """
    keywords_20 = [
        "test de positionnement",
        "test positionnement",
        "test position",
        "test posi",
        "positionnement initial",
        "positionnement",
        "equivalence",
        "équivalence"  # au cas où
    ]
    
    normalized = normalize_subject(subject)
    
    for keyword in keywords_20:
        if normalize_subject(keyword) in normalized:
            return 20.0
    
    return fallback


def get_student_portal_url():
    """
    Get the student portal URL from environment variables.
    Returns the production URL for student portal.
    """
    # Always use FRONTEND_URL from .env, with a safe production fallback
    url = os.getenv("FRONTEND_URL", "https://teachportal-12.emergent.host")
    
    # Normalize URL
    url = url.strip()
    
    # Remove trailing slash first
    if url.endswith("/"):
        url = url[:-1]
    
    # Remove /api suffix if present (after removing trailing slash)
    if url.endswith("/api"):
        url = url[:-4]
    
    # Ensure https:// or http:// prefix
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url
    
    return url


def format_fr_date(date_str: str) -> str:
    """Format date to French format with full day name: mardi 04/11/2025"""
    days_fr = {
        'Monday': 'lundi', 'Tuesday': 'mardi', 'Wednesday': 'mercredi',
        'Thursday': 'jeudi', 'Friday': 'vendredi', 'Saturday': 'samedi', 'Sunday': 'dimanche'
    }
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        day_name = days_fr.get(date_obj.strftime('%A'), date_obj.strftime('%A').lower())
        return f"{day_name} {date_obj.strftime('%d/%m/%Y')}"
    except:
        return date_str

def format_fr_datetime(dt: datetime) -> str:
    """Format datetime to French format: mardi 04/11/2025 14:30"""
    days_fr = {
        'Monday': 'lundi', 'Tuesday': 'mardi', 'Wednesday': 'mercredi',
        'Thursday': 'jeudi', 'Friday': 'vendredi', 'Saturday': 'samedi', 'Sunday': 'dimanche'
    }
    try:
        day_name = days_fr.get(dt.strftime('%A'), dt.strftime('%A').lower())
        return f"{day_name} {dt.strftime('%d/%m/%Y %H:%M')}"
    except:
        return str(dt)


# ============ SYSTÈME DE TRAÇABILITÉ ÉLÈVE (QUALIOPI) ============
async def log_student_activity(
    student_id: str,
    student_name: str,
    action: str,
    details: dict = None,
    actor: str = "student"
):
    """
    Logger une activité élève pour la traçabilité Qualiopi.
    
    Actions possibles:
    - login: Connexion à l'espace élève
    - logout: Déconnexion
    - signature: Émargement d'une séance
    - questionnaire_q1: Remplissage du questionnaire Q1
    - questionnaire_q2: Remplissage du questionnaire Q2
    - questionnaire_q3: Remplissage du questionnaire Q3
    - test_t1: Passation du test T1
    - test_t2: Passation du test T2
    - test_t3: Passation du test T3
    - visio_join: Connexion à la visioconférence
    - session_confirm: Confirmation d'une séance
    - contact_formateur: Contact avec le formateur
    - view_planning: Consultation du planning
    - view_resources: Consultation des ressources
    """
    try:
        log_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "student_id": student_id,
            "student_name": student_name,
            "action": action,
            "actor": actor,
            "details": details or {}
        }
        await db.student_activity_logs.insert_one(log_entry)
        logger.info(f"Activity logged: {student_name} - {action}")
    except Exception as e:
        logger.error(f"Error logging student activity: {e}")


def send_email(to_email: str, subject: str, html_body: str):
    """Send email using Gmail SMTP"""
    try:
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_PASSWORD')
        
        if not gmail_user or not gmail_password:
            logger.warning("Gmail credentials not configured")
            return False
        
        msg = MIMEMultipart('alternative')
        msg['From'] = gmail_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_string())
        server.quit()
        
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_email_with_attachment(to_email: str, subject: str, html_body: str, pdf_content: bytes, filename: str):
    """Send email with PDF attachment using Gmail SMTP"""
    try:
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_PASSWORD')
        
        if not gmail_user or not gmail_password:
            logger.warning("Gmail credentials not configured")
            return False
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Corps de l'email en HTML
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        # Pièce jointe PDF
        pdf_attachment = MIMEBase('application', 'pdf')
        pdf_attachment.set_payload(pdf_content)
        encoders.encode_base64(pdf_attachment)
        pdf_attachment.add_header('Content-Disposition', f'attachment; filename={filename}')
        msg.attach(pdf_attachment)
        
        # Envoi
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_string())
        server.quit()
        
        logger.info(f"Email with attachment sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email with attachment: {e}")
        return False


async def send_session_reminders():
    """
    Fonction qui vérifie toutes les séances qui commencent dans 15 minutes
    et envoie des rappels par email aux élèves.
    IMPORTANT: Utilise le fuseau horaire Europe/Paris pour tous les calculs.
    """
    try:
        logger.info("🔔 Vérification des rappels de séances (15 min)...")
        
        # TOUJOURS utiliser le fuseau horaire de Paris
        paris_tz = pytz.timezone('Europe/Paris')
        now_paris = datetime.now(paris_tz)
        today = now_paris.strftime('%Y-%m-%d')
        
        logger.info(f"🕐 Heure actuelle Paris: {now_paris.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Chercher les séances à venir qui n'ont pas encore reçu de rappel
        sessions = await db.sessions.find({
            "reminder_15min_sent": {"$ne": True},  # Pas encore envoyé
            "status": {"$in": ["pending", "confirmed"]},  # Séance active
            "date": {"$gte": today}  # Seulement les séances d'aujourd'hui et à venir
        }).to_list(1000)
        
        reminders_sent = 0
        sessions_checked = 0
        
        for session in sessions:
            try:
                # Construire la datetime de la séance
                session_date = session.get("date")  # Format: "2025-11-27"
                session_time = session.get("start_time")  # Format: "14:00"
                
                if not session_date or not session_time:
                    continue
                
                # Parser la date et l'heure EN FUSEAU PARIS
                session_datetime_str = f"{session_date} {session_time}"
                session_datetime_naive = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
                session_datetime = paris_tz.localize(session_datetime_naive)
                
                # Calculer la différence avec l'heure actuelle de Paris
                time_until_session = session_datetime - now_paris
                minutes_until = time_until_session.total_seconds() / 60
                sessions_checked += 1
                
                # Log pour debug (seulement si dans les prochaines 60 minutes)
                if 0 <= minutes_until <= 60:
                    logger.info(f"📋 Séance proche: {session.get('student_name')} - {session_date} {session_time} - dans {minutes_until:.0f} min (Paris)")
                
                if 13 <= minutes_until <= 17:
                    # Récupérer les infos de l'étudiant
                    student = await db.users.find_one({"id": session.get("student_id")}, {"_id": 0})
                    if not student:
                        logger.warning(f"Student not found for session {session.get('id')}")
                        continue
                    
                    student_email = student.get("email")
                    student_name = student.get("name", "")
                    first_name = student_name.split()[0] if student_name else "Élève"
                    
                    # Récupérer le nom du formateur
                    teacher_name = student.get("teacher_name", "votre formateur")
                    
                    modality = session.get("modality", "distanciel")
                    
                    # Construire l'adresse physique complète
                    address_parts = []
                    if student.get("formation_building"):
                        address_parts.append(student.get("formation_building"))
                    street_parts = []
                    if student.get("formation_street_number"):
                        street_parts.append(student.get("formation_street_number"))
                    if student.get("formation_street"):
                        street_parts.append(student.get("formation_street"))
                    if street_parts:
                        address_parts.append(" ".join(street_parts))
                    city_parts = []
                    if student.get("formation_postal_code"):
                        city_parts.append(student.get("formation_postal_code"))
                    if student.get("formation_city"):
                        city_parts.append(student.get("formation_city"))
                    if city_parts:
                        address_parts.append(" ".join(city_parts))
                    
                    full_address = ", ".join(address_parts) if address_parts else student.get("formation_address", "l'adresse indiquée")
                    
                    # Horodatage actuel
                    timestamp_now = datetime.now().strftime("%d/%m/%Y à %H:%M")
                    
                    # Construire le message selon la modalité
                    logo_url = "https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png"
                    
                    if modality == "distanciel" or not modality or modality == "":
                        # Message pour DISTANCIEL - Bleu marine avec logo Terciform
                        email_subject = f"📹 Votre séance en visio commence dans 15 min"
                        email_html = f"""<html>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2D5A87 100%); padding: 24px; text-align: center;">
    <img src="{logo_url}" alt="Terciform" style="max-width: 180px; height: auto; margin-bottom: 16px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📹 Rappel - Séance Visio</h1>
  </div>
  
  <div style="padding: 32px 24px;">
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Bonjour <strong>{first_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Votre séance en visio avec <strong>{teacher_name}</strong> a lieu dans <strong style="color: #1E3A5F;">15 minutes</strong>.
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Merci de vous rendre dans votre espace élève <strong>TerciLog</strong> et cliquer sur le lien visio 
        <span style="display: inline-block; background-color: #E91E63; color: white; padding: 2px 8px; border-radius: 12px; font-size: 14px;">📹 bouton rose caméra</span>.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://teachportal-12.emergent.host" style="display: inline-block; background-color: #1E3A5F; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Accéder à mon espace élève
      </a>
    </div>
    
    <p style="margin: 24px 0 0 0; font-size: 16px; color: #1f2937;">
        Bonne séance ! 📚
    </p>
  </div>
  
  <div style="background-color: #f0f4f8; padding: 16px 24px; text-align: center; border-top: 1px solid #1E3A5F;">
    <p style="margin: 0; font-size: 12px; color: #1E3A5F;">Email envoyé le {timestamp_now}</p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #1E3A5F; font-weight: bold;">Terciform - Propulsez vos compétences</p>
  </div>
</div>
</body>
</html>"""
                    else:
                        # Message pour PRÉSENTIEL - Bleu marine avec logo Terciform
                        email_subject = f"📍 Votre séance en présentiel commence dans 15 min"
                        email_html = f"""<html>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2D5A87 100%); padding: 24px; text-align: center;">
    <img src="{logo_url}" alt="Terciform" style="max-width: 180px; height: auto; margin-bottom: 16px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📍 Rappel - Séance Présentiel</h1>
  </div>
  
  <div style="padding: 32px 24px;">
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Bonjour <strong>{first_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Votre séance avec <strong>{teacher_name}</strong> a lieu dans <strong style="color: #1E3A5F;">15 minutes</strong>.
    </p>
    
    <p style="margin: 0 0 10px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Merci de vous rendre à :
    </p>
    
    <div style="background-color: #e8f4fc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1E3A5F;">
      <p style="margin: 0; font-size: 18px; color: #1E3A5F; font-weight: bold;">
        📍 {full_address}
      </p>
    </div>
    
    <p style="margin: 24px 0 0 0; font-size: 16px; color: #1f2937;">
        Bonne séance ! 📚
    </p>
  </div>
  
  <div style="background-color: #f0f4f8; padding: 16px 24px; text-align: center; border-top: 1px solid #1E3A5F;">
    <p style="margin: 0; font-size: 12px; color: #1E3A5F;">Email envoyé le {timestamp_now}</p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #1E3A5F; font-weight: bold;">Terciform - Propulsez vos compétences</p>
  </div>
</div>
</body>
</html>"""
                    
                    # Envoyer l'email à l'élève
                    email_sent = send_email(student_email, email_subject, email_html)
                    
                    if email_sent:
                        # Marquer le rappel comme envoyé
                        await db.sessions.update_one(
                            {"id": session.get("id")},
                            {"$set": {"reminder_15min_sent": True, "reminder_15min_sent_at": datetime.now(timezone.utc).isoformat()}}
                        )
                        
                        reminders_sent += 1
                        logger.info(f"✅ Rappel 15min envoyé à {student_email} pour la séance du {session_date} à {session_time}")
                        
                        # ======= ENVOI RAPPEL AU PROFESSEUR =======
                        teacher_email = student.get("teacher_email")
                        if teacher_email:
                            # Construire l'email pour le professeur
                            if modality == "distanciel" or not modality or modality == "":
                                teacher_email_subject = f"📹 Rappel : Séance VISIO avec {student_name} dans 15 min"
                                location_text = "en <strong style='color: #E91E63;'>visio</strong>"
                                meeting_link_html = ""
                                meeting_link_value = session.get("meeting_link", "")
                                if meeting_link_value:
                                    meeting_link_html = f"""
                                    <p style="margin: 20px 0; text-align: center;">
                                        <a href="{meeting_link_value}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #E91E63 0%, #9C27B0 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">📹 Rejoindre la visio</a>
                                    </p>"""
                            else:
                                teacher_email_subject = f"📍 Rappel : Séance PRÉSENTIEL avec {student_name} dans 15 min"
                                location_text = f"en <strong style='color: #059669;'>présentiel</strong> à {full_address}"
                                meeting_link_html = ""
                            
                            teacher_email_html = f"""<html>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2D5A87 100%); padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⏰ Rappel Séance - 15 minutes</h1>
  </div>
  
  <div style="padding: 32px 24px;">
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Bonjour,
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Votre séance avec <strong>{student_name}</strong> {location_text} débutera à <strong style="color: #1E3A5F;">{session_time}</strong>.
    </p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>📅 Date :</strong> {session_date}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>🕐 Heure :</strong> {session_time} - {session.get('end_time', '')}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>📚 Matière :</strong> {session.get('subject', '')}</p>
      <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>👤 Élève :</strong> {student_name}</p>
    </div>
    {meeting_link_html}
  </div>
  
  <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 12px; color: #6b7280;">Email automatique envoyé par Terciform</p>
  </div>
</div>
</body>
</html>"""
                            
                            teacher_email_sent = send_email(teacher_email, teacher_email_subject, teacher_email_html)
                            if teacher_email_sent:
                                logger.info(f"✅ Rappel 15min envoyé au PROFESSEUR {teacher_email} pour la séance avec {student_name}")
                            else:
                                logger.error(f"❌ Échec envoi rappel au professeur {teacher_email}")
                        # ======= FIN ENVOI RAPPEL PROFESSEUR =======
                    else:
                        logger.error(f"❌ Échec envoi rappel à {student_email}")
            
            except Exception as e:
                logger.error(f"Erreur lors du traitement de la séance {session.get('id')}: {e}")
                continue
        
        if reminders_sent > 0:
            logger.info(f"🎉 {reminders_sent} rappel(s) 15min envoyé(s) avec succès (sur {sessions_checked} séances vérifiées)")
        else:
            logger.info(f"✓ Aucun rappel 15min à envoyer pour le moment ({sessions_checked} séances vérifiées)")
    
    except Exception as e:
        logger.error(f"Erreur lors de la vérification des rappels 15min: {e}")


def send_attendance_email(to_email: str, student_name: str, subject: str, date: str, start_time: str, end_time: str):
    """Envoyer l'email d'émargement après la fin de séance"""
    
    portal_url = get_student_portal_url()
    
    html_body = f"""<html>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background-color: #ff9800; padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✍️ Émargement disponible</h1>
  </div>
  
  <div style="padding: 32px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family: Arial, Helvetica, sans-serif;">
      <tr>
        <td style="padding: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #333333;">
          Bonjour {student_name},
        </td>
      </tr>
      <tr>
        <td style="padding: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #333333;">
          Votre séance est terminée. Merci de vous connecter à votre espace TerciLog pour émarger votre séance.
        </td>
      </tr>
      <tr>
        <td style="padding: 16px; background-color: #fff3e0; border-radius: 6px; border-left: 4px solid #ff9800;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;"><strong>Matière :</strong> {subject}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;"><strong>Date :</strong> {date}</p>
          <p style="margin: 0; font-size: 14px; color: #333333;"><strong>Horaires :</strong> {start_time} - {end_time}</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px 0 16px 0; text-align: center;">
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #ff9800;">
            Vous pouvez signer à n'importe quel moment.
          </p>
          <a href="{portal_url}" target="_blank" 
             style="background: #ff9800; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            Émarger ma séance
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 0 0 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="{portal_url}" style="color: #ff9800; text-decoration: underline;">{portal_url}</a>
        </td>
      </tr>
    </table>
  </div>
  
  <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Bien cordialement,<br>
      <strong style="color: #333333;">L'équipe Terciform</strong>
    </p>
  </div>
</div>
</body>
</html>"""
    
    return send_email(to_email, "Émargement disponible", html_body)


def send_welcome_email(to_email: str, student_name: str, student_email: str, temp_password: str):
    """Envoyer l'email de bienvenue lors de la création d'un nouvel élève"""
    
    portal_url = get_student_portal_url()
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo et dégradé -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Bienvenue sur TerciForm !</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <p style="font-size: 16px;">Bonjour <strong>{student_name}</strong>,</p>
                
                <p style="font-size: 15px;">Bienvenue dans votre espace de formation TerciForm. Votre compte a été créé avec succès.</p>
                
                <p style="font-size: 15px;">Merci de vous connecter pour confirmer vos séances et accéder à votre parcours de formation.</p>
                
                <!-- Cadre identifiants -->
                <div style="background-color: #e8f4fd; border-left: 4px solid #1e3a5f; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">🔐 Vos identifiants de connexion :</p>
                    <p style="margin: 5px 0; font-size: 14px;"><strong>Identifiant :</strong> {student_email}</p>
                    <p style="margin: 5px 0; font-size: 14px;"><strong>Mot de passe :</strong> {temp_password}</p>
                </div>
                
                <!-- Bouton -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{portal_url}" style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                        🔗 Accéder à mon espace
                    </a>
                </div>
                
                <p style="font-size: 12px; color: #666; margin-top: 20px;">
                    Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
                    <a href="{portal_url}" style="color: #1e3a5f;">{portal_url}</a>
                </p>
                
                <p style="margin-top: 30px; color: #333;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, "🎉 Bienvenue sur TerciForm - Vos identifiants", html_body)


def send_session_reminder_email(to_email: str, student_name: str, subject: str, date: str, start_time: str, end_time: str, meeting_link: str = ""):
    """Envoyer l'email de rappel 15 minutes avant la séance avec design Terciform"""
    portal_url = get_student_portal_url()
    
    # Formater la date
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        days_fr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        months_fr = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        formatted_date = f"{days_fr[date_obj.weekday()]} {date_obj.day} {months_fr[date_obj.month]} {date_obj.year}"
    except:
        formatted_date = date
    
    meeting_section = ""
    if meeting_link:
        meeting_section = f"""
        <div style="text-align: center; margin: 20px 0;">
            <a href="{meeting_link}" 
               style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
                🎥 Rejoindre la visioconférence
            </a>
        </div>
        """
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header avec logo Terciform -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
            <img src="https://customer-assets.emergentagent.com/job_edutrackplus/assets/terciform_logo.png" alt="Terciform" style="height: 60px; width: auto; margin-bottom: 15px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⏰ Rappel de séance - 15 minutes</h1>
        </div>
        
        <!-- Contenu principal -->
        <div style="padding: 30px;">
            <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                Bonjour <strong>{student_name}</strong>,
            </p>
            
            <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="color: #dc2626; margin: 0; font-size: 18px; font-weight: bold;">
                    🚨 Votre séance commence dans 15 minutes !
                </p>
            </div>
            
            <!-- Détails de la séance -->
            <div style="background-color: #f0f9ff; border-left: 4px solid #1e3a5f; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="color: #1e3a5f; margin: 0 0 15px 0; font-size: 18px;">{subject}</h3>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">
                    📅 <strong>{formatted_date}</strong>
                </p>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">
                    🕐 <strong>{start_time} - {end_time}</strong>
                </p>
            </div>
            
            {meeting_section}
            
            <!-- Bouton espace élève -->
            <div style="text-align: center; margin: 25px 0;">
                <a href="{portal_url}" 
                   style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
                    📱 Accéder à mon espace élève
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 12px; margin: 0;">
                Terciform - Organisme de formation professionnelle
            </p>
        </div>
        
    </div>
</body>
</html>
    """
    
    return send_email(to_email, "⏰ TerciForm - Votre séance commence dans 15 minutes", html_body)


def send_session_modified_email(to_email: str, student_name: str, subject: str, date: str, start_time: str, end_time: str):
    """Envoyer un email de notification de modification de séance à l'élève"""
    portal_url = get_student_portal_url()
    
    # Formater la date si possible
    try:
        from datetime import datetime
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        formatted_date = date_obj.strftime("%A %d %B %Y").capitalize()
        # Traduction française des jours
        day_translations = {
            "Monday": "Lundi", "Tuesday": "Mardi", "Wednesday": "Mercredi",
            "Thursday": "Jeudi", "Friday": "Vendredi", "Saturday": "Samedi", "Sunday": "Dimanche"
        }
        month_translations = {
            "January": "janvier", "February": "février", "March": "mars", "April": "avril",
            "May": "mai", "June": "juin", "July": "juillet", "August": "août",
            "September": "septembre", "October": "octobre", "November": "novembre", "December": "décembre"
        }
        for en, fr in day_translations.items():
            formatted_date = formatted_date.replace(en, fr)
        for en, fr in month_translations.items():
            formatted_date = formatted_date.replace(en, fr)
    except:
        formatted_date = date
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 Modification de séance</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <p style="font-size: 16px;">Bonjour <strong>{student_name}</strong>,</p>
                
                <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #856404; font-weight: bold; font-size: 16px;">
                        ⚠️ Une séance a été modifiée par votre formateur.
                    </p>
                </div>
                
                <p style="font-size: 15px;">Veuillez trouver votre nouveau planning dans votre espace personnel.</p>
                
                <div style="background-color: #e8f4fd; border-left: 4px solid #1e3a5f; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Détails de la nouvelle séance :</p>
                    <p style="margin: 5px 0;"><strong>Matière :</strong> {subject}</p>
                    <p style="margin: 5px 0;"><strong>Date :</strong> {formatted_date}</p>
                    <p style="margin: 5px 0;"><strong>Horaires :</strong> {start_time} - {end_time}</p>
                </div>
                
                <!-- Message d'avertissement important -->
                <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="margin: 0 0 12px 0; color: #dc2626; font-weight: bold; font-size: 17px;">
                        ⚠️ IMPORTANT
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        Merci de valider votre présence en cliquant sur le bouton bleu "Confirmer" au moins <strong>48h avant la séance</strong>.
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        Sans confirmation ou demande de report dans ce délai, la séance est considérée comme acceptée.
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        <strong>Toute absence entraîne la perte des heures prévues.</strong>
                    </p>
                    <p style="margin: 0; color: #991b1b; font-size: 15px;">
                        En cas d'impossibilité, contactez votre formateur depuis votre espace personnel.
                    </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{portal_url}" style="background-color: #1e3a5f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                        🔗 Accéder à mon espace
                    </a>
                </div>
                
                <p style="margin-top: 30px; color: #666;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    email_sent = send_email(to_email, "📅 TerciForm - Modification de votre séance", html_body)
    if email_sent:
        logger.info(f"Email de modification de séance envoyé à {to_email}")
    else:
        logger.error(f"Échec envoi email de modification à {to_email}")
    return email_sent


def send_student_confirmed_email(student_name: str, subject: str, date: str, start_time: str, end_time: str):
    """Envoyer un email au professeur quand un élève confirme sa séance"""
    teacher_email = os.environ.get('GMAIL_USER', 'terciform@gmail.com')
    
    # Formater la date
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        formatted_date = date_obj.strftime("%d/%m/%Y")
    except:
        formatted_date = date
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">✅ Confirmation de séance</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <div style="background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #065f46; font-weight: bold; font-size: 18px;">
                        ✅ {student_name} a confirmé sa séance
                    </p>
                </div>
                
                <div style="background-color: #e8f4fd; border-left: 4px solid #1e3a5f; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Détails de la séance :</p>
                    <p style="margin: 5px 0;"><strong>Matière :</strong> {subject}</p>
                    <p style="margin: 5px 0;"><strong>Date :</strong> {formatted_date}</p>
                    <p style="margin: 5px 0;"><strong>Horaires :</strong> {start_time} - {end_time}</p>
                </div>
                
                <p style="margin-top: 30px; color: #666;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    email_sent = send_email(teacher_email, f"✅ Confirmation - {student_name} - {formatted_date}", html_body)
    if email_sent:
        logger.info(f"Email de confirmation envoyé au professeur pour {student_name}")
    else:
        logger.error(f"Échec envoi email de confirmation au professeur pour {student_name}")
    return email_sent


def send_no_confirmation_reminder_to_teacher(student_name: str, student_email: str, subject: str, date: str, start_time: str, end_time: str):
    """Envoyer un email au professeur si l'élève n'a pas confirmé 48h avant"""
    teacher_email = os.environ.get('GMAIL_USER', 'terciform@gmail.com')
    
    # Formater la date
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        formatted_date = date_obj.strftime("%d/%m/%Y")
    except:
        formatted_date = date
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Absence de confirmation</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #92400e; font-weight: bold; font-size: 18px;">
                        ⚠️ {student_name} n'a pas confirmé sa séance
                    </p>
                    <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                        Prendre contact avec lui/elle
                    </p>
                </div>
                
                <div style="background-color: #e8f4fd; border-left: 4px solid #1e3a5f; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Détails de la séance :</p>
                    <p style="margin: 5px 0;"><strong>Élève :</strong> {student_name}</p>
                    <p style="margin: 5px 0;"><strong>Email :</strong> {student_email}</p>
                    <p style="margin: 5px 0;"><strong>Matière :</strong> {subject}</p>
                    <p style="margin: 5px 0;"><strong>Date :</strong> {formatted_date}</p>
                    <p style="margin: 5px 0;"><strong>Horaires :</strong> {start_time} - {end_time}</p>
                </div>
                
                <p style="margin-top: 30px; color: #666;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    email_sent = send_email(teacher_email, f"⚠️ Non confirmé - {student_name} - {formatted_date}", html_body)
    if email_sent:
        logger.info(f"Email d'alerte non-confirmation envoyé au professeur pour {student_name}")
    else:
        logger.error(f"Échec envoi email d'alerte non-confirmation au professeur pour {student_name}")
    return email_sent


def send_no_confirmation_reminder_to_student(to_email: str, student_name: str, date: str, start_time: str, end_time: str):
    """Envoyer un email à l'élève s'il n'a pas confirmé 48h avant"""
    portal_url = get_student_portal_url()
    
    # Formater la date
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        formatted_date = date_obj.strftime("%d/%m/%Y")
    except:
        formatted_date = date
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 Rappel de séance</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <p style="font-size: 16px;">Bonjour <strong>{student_name}</strong>,</p>
                
                <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #92400e; font-size: 15px;">
                        Vous n'avez pas confirmé votre présence pour la séance prévue le <strong>{formatted_date}</strong> à <strong>{start_time}</strong>.
                    </p>
                </div>
                
                <p style="font-size: 15px;">
                    Conformément au règlement intérieur de TerciForm, <strong>la séance est considérée comme acceptée</strong>.
                </p>
                
                <p style="font-size: 15px;">
                    En cas d'empêchement exceptionnel, merci de contacter votre formateur depuis votre espace personnel.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{portal_url}" style="background-color: #1e3a5f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                        🔗 Accéder à mon espace
                    </a>
                </div>
                
                <p style="margin-top: 30px; color: #666;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    email_sent = send_email(to_email, f"📅 TerciForm - Rappel séance du {formatted_date}", html_body)
    if email_sent:
        logger.info(f"Email de rappel non-confirmation envoyé à {to_email}")
    else:
        logger.error(f"Échec envoi email de rappel non-confirmation à {to_email}")
    return email_sent
@api_router.post("/auth/register", response_model=User)
async def save_student_resources(student_id: str, parcours: str, resources: dict):
    """Sauvegarder les tests et questionnaires sélectionnés pour un élève"""
    saved_resources = []
    
    # Tests de parcours
    if resources.get("tests"):
        tests = resources["tests"]
        # Mapping des noms de templates vers leurs IDs
        template_id_mapping = {
            "T1 - Test de positionnement": "test-bureautique-positionnement-v1",
            "T2 - Test à mi parcours": "test-bureautique-mi-parcours-v1",
            "T3 - Test de fin de formation": "test-bureautique-fin-v1",
            "T1 – Test de positionnement informatique": "test-informatique-t1-v2",
            "T2 – Test mi parcours informatique": "test-informatique-t2-v2",
            "T3 – Test fin de parcours Informatique": "test-informatique-t3-v2"
        }
        
        if tests.get("positionnement"):
            template_id = template_id_mapping.get(tests["positionnement"])
            resource = StudentResource(
                student_id=student_id,
                parcours=parcours,
                category="TEST_PARCOURS",
                sub_type="POSITIONNEMENT",
                template_name=tests["positionnement"],
                template_id=template_id,
                resource_type="FORM"
            )
            await db.student_resources.insert_one(resource.dict())
            saved_resources.append(resource.dict())
            logger.info(f"Test positionnement '{tests['positionnement']}' assigné à élève {student_id}")
        
        if tests.get("miParcours"):
            template_id = template_id_mapping.get(tests["miParcours"])
            resource = StudentResource(
                student_id=student_id,
                parcours=parcours,
                category="TEST_PARCOURS",
                sub_type="MI_PARCOURS",
                template_name=tests["miParcours"],
                template_id=template_id,
                resource_type="FORM"
            )
            await db.student_resources.insert_one(resource.dict())
            saved_resources.append(resource.dict())
            logger.info(f"Test mi-parcours '{tests['miParcours']}' assigné à élève {student_id}")
        
        if tests.get("fin"):
            template_id = template_id_mapping.get(tests["fin"])
            resource = StudentResource(
                student_id=student_id,
                parcours=parcours,
                category="TEST_PARCOURS",
                sub_type="FIN",
                template_name=tests["fin"],
                template_id=template_id,
                resource_type="FORM"
            )
            await db.student_resources.insert_one(resource.dict())
            saved_resources.append(resource.dict())
            logger.info(f"Test fin '{tests['fin']}' assigné à élève {student_id}")
    
    # Questionnaires Qualiopi
    if resources.get("questionnaires"):
        questionnaires = resources["questionnaires"]
        if questionnaires.get("q1"):
            resource = StudentResource(
                student_id=student_id,
                parcours=parcours,
                category="QUESTIONNAIRE_QUALIOPI",
                sub_type="POSITIONNEMENT",
                template_name=questionnaires["q1"],
                resource_type="FORM"
            )
            await db.student_resources.insert_one(resource.dict())
            saved_resources.append(resource.dict())
            logger.info(f"Questionnaire Q1 '{questionnaires['q1']}' assigné à élève {student_id}")
        
        if questionnaires.get("q2"):
            resource = StudentResource(
                student_id=student_id,
                parcours=parcours,
                category="QUESTIONNAIRE_QUALIOPI",
                sub_type="MI_PARCOURS",
                template_name=questionnaires["q2"],
                resource_type="FORM"
            )
            await db.student_resources.insert_one(resource.dict())
            saved_resources.append(resource.dict())
            logger.info(f"Questionnaire Q2 '{questionnaires['q2']}' assigné à élève {student_id}")
        
        if questionnaires.get("q3"):
            resource = StudentResource(
                student_id=student_id,
                parcours=parcours,
                category="QUESTIONNAIRE_QUALIOPI",
                sub_type="FIN",
                template_name=questionnaires["q3"],
                resource_type="FORM"
            )
            await db.student_resources.insert_one(resource.dict())
            saved_resources.append(resource.dict())
            logger.info(f"Questionnaire Q3 '{questionnaires['q3']}' assigné à élève {student_id}")
    
    logger.info(f"Total {len(saved_resources)} ressources assignées à l'élève {student_id}")
    return saved_resources


async def register(user_data: UserCreate):
    # Permettre plusieurs élèves avec le même email (pour les tests)
    # Pas de vérification d'unicité d'email
    
    # Create user
    user_dict = user_data.model_dump()
    temp_password = user_dict['password']  # Sauvegarder temporairement pour l'email uniquement
    hashed_password = get_password_hash(user_dict.pop('password'))
    user_dict['password_hash'] = hashed_password
    user_dict['welcome_email_sent'] = False  # Flag pour l'email de bienvenue
    
    # Initialize credit_hours = total_hours for new students
    if user_dict.get('role') == 'student' and 'total_hours' in user_dict:
        user_dict['credit_hours'] = user_dict['total_hours']
    
    user = User(**user_dict)
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password_hash'] = hashed_password
    doc['welcome_email_sent'] = False
    
    await db.users.insert_one(doc)
    
    # Envoyer l'email de bienvenue si c'est un élève
    if user_dict.get('role') == 'student':
        try:
            email_sent = send_welcome_email(
                user_dict['email'],
                user_dict['name'],
                user_dict['email'],
                temp_password
            )
            if email_sent:
                # Mettre à jour le flag d'envoi
                await db.users.update_one(
                    {"id": user.id},
                    {"$set": {"welcome_email_sent": True}}
                )
                logger.info(f"Welcome email sent to {user_dict['email']}")
            else:
                logger.warning(f"Failed to send welcome email to {user_dict['email']}")
        except Exception as e:
            # Ne pas bloquer la création du compte en cas d'erreur email
            logger.error(f"Error sending welcome email to {user_dict['email']}: {e}")
    
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user_doc['id']})
    # Supprimer password_hash avant de créer l'objet User
    user_doc.pop('password_hash', None)
    user = User(**user_doc)
    
    # Logger la connexion pour les élèves (traçabilité Qualiopi)
    if user.role == "student":
        await log_student_activity(
            student_id=user.id,
            student_name=user.name,
            action="login",
            details={"email": user.email}
        )
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/students", response_model=List[User])
async def get_students(current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    students = await db.users.find({"role": "student"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Recalculer les heures restantes pour chaque élève
    for student in students:
        student_id = student.get('id')
        total_hours = student.get('total_hours', 0)
        
        # Calculer la somme des heures ÉMARGÉES uniquement (sessions signées par l'élève)
        sessions = await db.sessions.find({
            "student_id": student_id,
            "signature_status": "signed"
        }, {"_id": 0}).to_list(10000)
        emargees_hours = sum(s.get('duration_hours', 0) for s in sessions)
        
        # Heures restantes = total - heures émargées
        credit_hours = max(0, total_hours - emargees_hours)
        student['credit_hours'] = credit_hours
    
    return students

@api_router.post("/students", response_model=User)
async def create_student(data: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Extraire les ressources si présentes
    resources = data.pop("resources", None)
    
    # Ajouter le role avant la création
    data['role'] = "student"
    
    # Créer l'élève
    user_data = UserCreate(**data)
    student = await register(user_data)
    
    # OBLIGATOIRE : Assigner automatiquement l'élève au professeur qui le crée
    await db.users.update_one(
        {"id": student.id},
        {"$set": {"teacher_id": current_user.id}}
    )
    logger.info(f"Student {student.name} automatically assigned to teacher {current_user.id}")
    
    # Sauvegarder les ressources sélectionnées
    if resources:
        await save_student_resources(student.id, student.parcours, resources)
    
    # Recharger l'élève avec le teacher_id
    updated_student = await db.users.find_one({"id": student.id}, {"_id": 0, "password_hash": 0})
    return User(**updated_student)

@api_router.post("/students/{student_id}/formation-needs")
async def submit_formation_needs(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire des besoins en formation"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Ajouter l'ID et la date
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Vérifier si un questionnaire existe déjà
    existing = await db.formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        # Mettre à jour
        await db.formation_needs_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Formation needs questionnaire updated for student {student_id}")
    else:
        # Créer
        await db.formation_needs_questionnaires.insert_one(questionnaire)
        logger.info(f"Formation needs questionnaire submitted for student {student_id}")
    
    # Logger le remplissage du Q1 (traçabilité Qualiopi)
    student = await db.users.find_one({"id": student_id}, {"_id": 0, "name": 1})
    await log_student_activity(
        student_id=student_id,
        student_name=student.get("name", "Inconnu") if student else "Inconnu",
        action="questionnaire_q1",
        details={"parcours": data.get("parcours", "")}
    )
    
    return {"message": "Questionnaire soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/formation-needs")
async def get_formation_needs(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire des besoins en formation"""
    # Accessible par l'élève lui-même ou par un professeur
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/formation-needs/pdf")
async def download_formation_needs_pdf(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Télécharger le questionnaire de besoins en formation en PDF"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le questionnaire
    questionnaire = await db.formation_needs.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="No questionnaire found for this student")
    
    # Générer le PDF
    pdf_buffer = generate_formation_needs_pdf(student, questionnaire)
    
    return StreamingResponse(
        io.BytesIO(pdf_buffer),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Questionnaire_{student['name'].replace(' ', '_')}.pdf"
        }
    )


@api_router.post("/students/{student_id}/formation-needs/send-email")
async def send_formation_needs_email(
    student_id: str,
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le questionnaire de besoins en formation par email"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    to = data.get('to', '')
    subject = data.get('subject', 'Questionnaire de besoins en formation')
    body = data.get('body', '')
    
    if not to:
        raise HTTPException(status_code=400, detail="Email recipient is required")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le questionnaire
    questionnaire = await db.formation_needs.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="No questionnaire found for this student")
    
    # Générer le PDF
    pdf_bytes = generate_formation_needs_pdf(student, questionnaire)
    
    # Séparer les emails (virgule ou point-virgule)
    to_emails = [email.strip() for email in to.replace(';', ',').split(',') if email.strip()]
    
    if not to_emails:
        raise HTTPException(status_code=400, detail="At least one valid email required")
    
    # Envoyer l'email avec le PDF en pièce jointe
    try:
        gmail_user = os.environ['GMAIL_USER']
        gmail_password = os.environ['GMAIL_PASSWORD']
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        # Corps du message
        msg.attach(MIMEText(body, 'plain'))
        
        # Attacher le PDF
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename=Questionnaire_{student["name"].replace(" ", "_")}.pdf')
        msg.attach(part)
        
        # Envoyer
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Formation needs questionnaire emailed to {to_emails} for student {student_id}")
        return {"message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Error sending formation needs email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


@api_router.post("/students/{student_id}/mid-course-questionnaire")
async def submit_mid_course_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire à mi-parcours"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Ajouter l'ID et la date
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Vérifier si un questionnaire existe déjà
    existing = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        # Mettre à jour
        await db.mid_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Mid-course questionnaire updated for student {student_id}")
    else:
        # Créer
        await db.mid_course_questionnaires.insert_one(questionnaire)
        logger.info(f"Mid-course questionnaire submitted for student {student_id}")
    
    # Logger le remplissage du Q2 (traçabilité Qualiopi)
    student = await db.users.find_one({"id": student_id}, {"_id": 0, "name": 1})
    await log_student_activity(
        student_id=student_id,
        student_name=student.get("name", "Inconnu") if student else "Inconnu",
        action="questionnaire_q2",
        details={"parcours": data.get("parcours", "")}
    )
    
    return {"message": "Questionnaire à mi-parcours soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/mid-course-questionnaire")
async def get_mid_course_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire à mi-parcours"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/mid-course-questionnaire/pdf")
async def download_mid_course_questionnaire_pdf(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Télécharger le questionnaire à mi-parcours en PDF"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le questionnaire
    questionnaire = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="No mid-course questionnaire found for this student")
    
    # Générer le PDF
    pdf_buffer = generate_mid_course_questionnaire_pdf(student, questionnaire)
    
    return StreamingResponse(
        io.BytesIO(pdf_buffer),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Questionnaire_MiParcours_{student['name'].replace(' ', '_')}.pdf"
        }
    )


@api_router.post("/students/{student_id}/mid-course-questionnaire/send-email")
async def send_mid_course_questionnaire_email(
    student_id: str,
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le questionnaire à mi-parcours par email"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    to = data.get('to', '')
    subject = data.get('subject', 'Questionnaire à mi-parcours')
    body = data.get('body', '')
    
    if not to:
        raise HTTPException(status_code=400, detail="Email recipient is required")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le questionnaire
    questionnaire = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="No mid-course questionnaire found for this student")
    
    # Générer le PDF
    pdf_bytes = generate_mid_course_questionnaire_pdf(student, questionnaire)
    
    # Séparer les emails
    to_emails = [email.strip() for email in to.replace(';', ',').split(',') if email.strip()]
    
    if not to_emails:
        raise HTTPException(status_code=400, detail="At least one valid email required")
    
    # Envoyer l'email avec le PDF en pièce jointe
    try:
        gmail_user = os.environ['GMAIL_USER']
        gmail_password = os.environ['GMAIL_PASSWORD']
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        # Corps du message
        msg.attach(MIMEText(body, 'plain'))
        
        # Attacher le PDF
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename=Questionnaire_MiParcours_{student["name"].replace(" ", "_")}.pdf')
        msg.attach(part)
        
        # Envoyer
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Mid-course questionnaire emailed to {to_emails} for student {student_id}")
        return {"message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Error sending mid-course questionnaire email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


@api_router.post("/students/{student_id}/end-course-questionnaire")
async def submit_end_course_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire de fin de formation"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Ajouter l'ID et la date
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Vérifier si un questionnaire existe déjà
    existing = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        # Mettre à jour
        await db.end_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"End-course questionnaire updated for student {student_id}")
    else:
        # Créer
        await db.end_course_questionnaires.insert_one(questionnaire)
        logger.info(f"End-course questionnaire submitted for student {student_id}")
    
    # Logger le remplissage du Q3 (traçabilité Qualiopi)
    student = await db.users.find_one({"id": student_id}, {"_id": 0, "name": 1})
    await log_student_activity(
        student_id=student_id,
        student_name=student.get("name", "Inconnu") if student else "Inconnu",
        action="questionnaire_q3",
        details={"parcours": data.get("parcours", "")}
    )
    
    return {"message": "Questionnaire de fin de formation soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/end-course-questionnaire")
async def get_end_course_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire de fin de formation"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/end-course-questionnaire/pdf")
async def download_end_course_questionnaire_pdf(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Télécharger le questionnaire de fin de formation en PDF"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le questionnaire
    questionnaire = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="No end-course questionnaire found for this student")
    
    # Générer le PDF
    pdf_buffer = generate_end_course_questionnaire_pdf(student, questionnaire)
    
    return StreamingResponse(
        io.BytesIO(pdf_buffer),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Questionnaire_FinFormation_{student['name'].replace(' ', '_')}.pdf"
        }
    )


@api_router.post("/students/{student_id}/end-course-questionnaire/send-email")
async def send_end_course_questionnaire_email(
    student_id: str,
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le questionnaire de fin de formation par email"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    to = data.get('to', '')
    subject = data.get('subject', 'Questionnaire de fin de formation')
    body = data.get('body', '')
    
    if not to:
        raise HTTPException(status_code=400, detail="Email recipient is required")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le questionnaire
    questionnaire = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="No end-course questionnaire found for this student")
    
    # Générer le PDF
    pdf_bytes = generate_end_course_questionnaire_pdf(student, questionnaire)
    
    # Séparer les emails
    to_emails = [email.strip() for email in to.replace(';', ',').split(',') if email.strip()]
    
    if not to_emails:
        raise HTTPException(status_code=400, detail="At least one valid email required")
    
    # Envoyer l'email avec le PDF en pièce jointe
    try:
        gmail_user = os.environ['GMAIL_USER']
        gmail_password = os.environ['GMAIL_PASSWORD']
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        # Corps du message
        msg.attach(MIMEText(body, 'plain'))
        
        # Attacher le PDF
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename=Questionnaire_FinFormation_{student["name"].replace(" ", "_")}.pdf')
        msg.attach(part)
        
        # Envoyer
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"End-course questionnaire emailed to {to_emails} for student {student_id}")
        return {"message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Error sending end-course questionnaire email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


# ============================================================================
# QUESTIONNAIRES BUREAUTIQUE (Q1, Q2, Q3)
# ============================================================================

@api_router.post("/students/{student_id}/bureautique-formation-needs")
async def submit_bureautique_formation_needs(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire des besoins en formation - Bureautique"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        await db.bureautique_formation_needs_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Bureautique formation needs questionnaire updated for student {student_id}")
    else:
        await db.bureautique_formation_needs_questionnaires.insert_one(questionnaire)
        logger.info(f"Bureautique formation needs questionnaire submitted for student {student_id}")
    
    return {"message": "Questionnaire Bureautique soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-formation-needs")
async def get_bureautique_formation_needs(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire des besoins en formation - Bureautique"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.post("/students/{student_id}/bureautique-mid-course-questionnaire")
async def submit_bureautique_mid_course_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire à mi-parcours - Bureautique"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        await db.bureautique_mid_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Bureautique mid-course questionnaire updated for student {student_id}")
    else:
        await db.bureautique_mid_course_questionnaires.insert_one(questionnaire)
        logger.info(f"Bureautique mid-course questionnaire submitted for student {student_id}")
    
    return {"message": "Questionnaire Bureautique à mi-parcours soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-mid-course-questionnaire")
async def get_bureautique_mid_course_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire à mi-parcours - Bureautique"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


# ========== QUESTIONNAIRE DE SATISFACTION Q4 - ANGLAIS ==========
@api_router.post("/students/{student_id}/satisfaction-questionnaire")
async def submit_satisfaction_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire de satisfaction (Q4)"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.satisfaction_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        await db.satisfaction_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Satisfaction questionnaire (Q4) updated for student {student_id}")
    else:
        await db.satisfaction_questionnaires.insert_one(questionnaire)
        logger.info(f"Satisfaction questionnaire (Q4) submitted for student {student_id}")
    
    return {"message": "Questionnaire de satisfaction soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/satisfaction-questionnaire")
async def get_satisfaction_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire de satisfaction (Q4)"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.satisfaction_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.post("/students/{student_id}/bureautique-end-course-questionnaire")
async def submit_bureautique_end_course_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire de fin de formation - Bureautique"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        await db.bureautique_end_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Bureautique end-course questionnaire updated for student {student_id}")
    else:
        await db.bureautique_end_course_questionnaires.insert_one(questionnaire)
        logger.info(f"Bureautique end-course questionnaire submitted for student {student_id}")
    
    return {"message": "Questionnaire Bureautique de fin de formation soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-end-course-questionnaire")
async def get_bureautique_end_course_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire de fin de formation - Bureautique"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.post("/students/{student_id}/generate-bilan")
async def generate_student_bilan(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Générer le Bilan Élève IA avec les 3 questionnaires"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer les 3 questionnaires
    q_besoins = await db.formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    q_mi_parcours = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    q_fin = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    # Vérifier que les 3 questionnaires existent
    if not q_besoins or not q_mi_parcours or not q_fin:
        raise HTTPException(
            status_code=400, 
            detail="Les trois questionnaires doivent être complétés pour générer le bilan"
        )
    
    # Calculer le score de progression
    score = calculer_score_progression(q_fin)
    niveau = attribuer_niveau_progression(score)
    
    # Générer le PDF du bilan
    pdf_bytes = generate_bilan_eleve_pdf(student, q_besoins, q_mi_parcours, q_fin, score, niveau)
    
    # Retourner le PDF
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Bilan_Eleve_{student.get("name", "").replace(" ", "_")}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        }
    )


# ===========================
# QUIZ / TEST TEMPLATES ROUTES
# ===========================

@api_router.get("/test-templates/{template_id}")
async def get_test_template(
    template_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer un template de quiz/test pour affichage à l'élève"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    template = await db.test_templates.find_one({"id": template_id}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Test template not found")
    
    return template


@api_router.post("/students/{student_id}/assign-tests")
async def assign_tests_to_student(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Assigner les tests T1, T2, T3 et questionnaires Q1, Q2, Q3 à un élève existant
    Utile pour les élèves créés sans tests assignés
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'élève existe
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    parcours = student.get("parcours", "")
    
    # Vérifier si des ressources existent déjà
    existing = await db.student_resources.count_documents({"student_id": student_id})
    if existing > 0:
        return {"message": f"Student already has {existing} resources assigned", "count": existing}
    
    # Définir les ressources selon le parcours
    if parcours == "Informatique":
        resources = {
            "tests": {
                "positionnement": "T1 – Test de positionnement informatique",
                "miParcours": "T2 – Test mi parcours informatique",
                "fin": "T3 – Test fin de parcours Informatique"
            },
            "questionnaires": {
                "q1": "Q1 – Questionnaire d'entrée informatique – Besoins et identification",
                "q2": "Q2 – Questionnaire mi-parcours – Informatique",
                "q3": "Q3 – Questionnaire fin de formation – Informatique"
            }
        }
    elif parcours == "Bureautique":
        resources = {
            "tests": {
                "positionnement": "T1 - Test de positionnement",
                "miParcours": "T2 - Test à mi parcours",
                "fin": "T3 - Test de fin de formation"
            },
            "questionnaires": {
                "q1": "Q1 – Questionnaire d'entrée bureautique",
                "q2": "Q2 – Questionnaire mi-parcours bureautique",
                "q3": "Q3 – Questionnaire fin de formation bureautique"
            }
        }
    elif parcours == "Anglais":
        resources = {
            "tests": {
                "positionnement": "T1 - Test de positionnement",
                "miParcours": "T2 - Test à mi parcours",
                "fin": "T3 - Test de fin de formation"
            },
            "questionnaires": {
                "q1": "Q1 – Questionnaire d'entrée anglais",
                "q2": "Q2 – Questionnaire mi-parcours anglais",
                "q3": "Q3 – Questionnaire fin de formation anglais"
            }
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown parcours: {parcours}")
    
    # Assigner les ressources
    saved = await save_student_resources(student_id, parcours, resources)
    
    return {
        "message": f"Successfully assigned {len(saved)} resources to student",
        "student_name": student.get("name"),
        "parcours": parcours,
        "resources_count": len(saved)
    }


@api_router.post("/student-resources/{resource_id}/restart")
async def restart_test(
    resource_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Réinitialiser un test pour permettre à l'élève de le recommencer.
    Uniquement pour les tests T1, T2, T3 qui ont été soumis.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que la ressource existe et appartient à l'élève
    resource = await db.student_resources.find_one(
        {"id": resource_id, "student_id": current_user.id},
        {"_id": 0}
    )
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Vérifier que c'est un test (T1, T2, T3) et qu'il est soumis
    template_name = resource.get("template_name", "")
    is_test = any(t in template_name for t in ["T1", "T2", "T3", "Test de positionnement", "Test mi parcours", "Test fin"])
    
    if not is_test:
        raise HTTPException(status_code=400, detail="Cette ressource n'est pas un test T1, T2 ou T3")
    
    if resource.get("status") != "SOUMIS":
        raise HTTPException(status_code=400, detail="Ce test n'a pas encore été soumis")
    
    # Réinitialiser le test
    await db.student_resources.update_one(
        {"id": resource_id},
        {
            "$set": {
                "status": "NON_COMMENCE",
                "score": None,
                "answers": None,
                "submitted_at": None,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"Test {resource_id} réinitialisé pour l'élève {current_user.id}")
    
    return {
        "message": "Test réinitialisé avec succès",
        "resource_id": resource_id,
        "new_status": "NON_COMMENCE"
    }


@api_router.post("/student-resources/{resource_id}/submit")
async def submit_quiz(
    resource_id: str,
    answers: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Soumettre un quiz et calculer le score automatiquement
    answers = {"Q1": ["B", "C"], "Q2": ["B"], ...}
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la ressource
    resource = await db.student_resources.find_one({"id": resource_id}, {"_id": 0})
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Vérifier que l'élève est bien le propriétaire
    if resource.get("student_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer le template du test pour avoir les bonnes réponses
    # On cherche par template_name qui devrait correspondre
    template = await db.test_templates.find_one(
        {"template_name": resource.get("template_name")},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Test template not found")
    
    # Calculer le score
    total_score = 0
    max_score = 0
    
    for section in template.get("sections", []):
        for question in section.get("questions", []):
            question_id = question.get("id")
            correct_answers = set(question.get("correctAnswers", []))
            points = question.get("points", 1)
            max_score += points
            
            # Récupérer les réponses de l'élève
            student_answers = answers.get("answers", {}).get(question_id, [])
            if not isinstance(student_answers, list):
                student_answers = [student_answers]
            
            student_answers_set = set(student_answers)
            
            # Comparer les réponses
            if student_answers_set == correct_answers:
                total_score += points
    
    # Calculer le pourcentage
    score_percentage = (total_score / max_score * 100) if max_score > 0 else 0
    
    # Mettre à jour la ressource avec le score, le statut ET les réponses
    await db.student_resources.update_one(
        {"id": resource_id},
        {
            "$set": {
                "status": "SOUMIS",
                "score": round(score_percentage, 2),
                "student_answers": answers.get("answers", {}),
                "submitted_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Logger la passation du test (traçabilité Qualiopi)
    test_type = resource.get("resource_type", "TEST")
    test_name = resource.get("template_name", resource.get("name", "Test"))
    # Déterminer le type de test (T1, T2, T3)
    test_action = "test_t1"
    if "mi" in test_name.lower() or "t2" in test_name.lower():
        test_action = "test_t2"
    elif "fin" in test_name.lower() or "t3" in test_name.lower():
        test_action = "test_t3"
    
    await log_student_activity(
        student_id=current_user.id,
        student_name=current_user.name,
        action=test_action,
        details={
            "test_name": test_name,
            "score": round(score_percentage, 2),
            "points": f"{total_score}/{max_score}"
        }
    )
    
    return {
        "success": True,
        "score": round(score_percentage, 2),
        "points": f"{total_score}/{max_score}",
        "status": "SOUMIS"
    }


@api_router.get("/students/{student_id}/resources")
async def get_student_resources(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer toutes les ressources assignées à un élève"""
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "teacher":
        # Vérifier que l'élève appartient bien à ce professeur
        student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
        logger.info(f"DEBUG Resources - student_id: {student_id}, teacher_id: {current_user.id}, student found: {student is not None}, student teacher_id: {student.get('teacher_id') if student else 'N/A'}")
        if not student or student.get("teacher_id") != current_user.id:
            logger.error(f"Access denied - student: {student}, teacher match: {student.get('teacher_id') == current_user.id if student else False}")
            raise HTTPException(status_code=403, detail="Access denied")
    
    resources = await db.student_resources.find(
        {"student_id": student_id},
        {"_id": 0}
    ).to_list(length=None)
    
    return {"resources": resources}


@api_router.get("/students/{student_id}/tests")
async def get_student_tests(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer tous les tests soumis par un élève (pour bilans)"""
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "teacher":
        # Vérifier que l'élève appartient bien à ce professeur
        student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
        if not student or student.get("teacher_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer toutes les ressources de type TEST ou FORM (questionnaires) avec status SOUMIS
    tests = await db.student_resources.find(
        {
            "student_id": student_id,
            "resource_type": {"$in": ["TEST", "FORM"]},
            "status": "SOUMIS"
        },
        {"_id": 0}
    ).to_list(length=None)
    
    return {"tests": tests}

@api_router.get("/tests/all")
async def get_all_tests(current_user: User = Depends(get_current_user)):
    """Récupérer tous les tests de tous les élèves (pour le professeur)"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer tous les élèves du professeur
    students = await db.users.find(
        {"role": "student", "teacher_id": current_user.id},
        {"_id": 0}
    ).to_list(length=None)
    
    student_ids = [s["id"] for s in students]
    
    # Récupérer tous les tests soumis (TEST et FORM = questionnaires)
    tests = await db.student_resources.find(
        {
            "student_id": {"$in": student_ids},
            "resource_type": {"$in": ["TEST", "FORM"]},
            "status": "SOUMIS"
        },
        {"_id": 0}
    ).to_list(length=None)
    
    # Grouper par élève
    tests_by_student = {}
    for test in tests:
        student_id = test["student_id"]
        if student_id not in tests_by_student:
            # Trouver le nom de l'élève
            student = next((s for s in students if s["id"] == student_id), None)
            tests_by_student[student_id] = {
                "student_name": student["name"] if student else "Inconnu",
                "student_email": student["email"] if student else "",
                "tests": []
            }
        tests_by_student[student_id]["tests"].append(test)
    
    return {"students": list(tests_by_student.values())}

@api_router.get("/students/{student_id}/magic-report")
async def generate_magic_report(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Génère un rapport PDF Qualiopi avec graphique et analyse IA"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Vérifier que l'élève appartient au professeur
    if student.get("teacher_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer les 3 tests
    resources = await db.student_resources.find(
        {"student_id": student_id, "category": "TEST_PARCOURS", "status": "SOUMIS"},
        {"_id": 0}
    ).to_list(length=None)
    
    # Trier par sub_type
    tests_map = {}
    for r in resources:
        tests_map[r['sub_type']] = r
    
    t1 = tests_map.get('POSITIONNEMENT')
    t2 = tests_map.get('MI_PARCOURS')
    t3 = tests_map.get('FIN')
    
    if not t1 or not t2 or not t3:
        raise HTTPException(
            status_code=400, 
            detail=f"Les 3 tests doivent être complétés. Statut: T1={bool(t1)}, T2={bool(t2)}, T3={bool(t3)}"
        )
    
    # Générer l'analyse IA pédagogique
    ai_analysis = await generate_ai_pedagogical_analysis(
        student_name=student.get('name', 'N/A'),
        t1_score=t1['score'],
        t2_score=t2['score'],
        t3_score=t3['score'],
        t1_date=t1['submitted_at'].strftime('%d/%m/%Y'),
        t2_date=t2['submitted_at'].strftime('%d/%m/%Y'),
        t3_date=t3['submitted_at'].strftime('%d/%m/%Y')
    )
    
    # Générer le graphique d'évolution
    graph_buffer = generate_evolution_graph(t1['score'], t2['score'], t3['score'])
    
    # Créer le PDF Qualiopi
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    story = []
    styles = getSampleStyleSheet()
    
    # En-tête avec logo Terciform (si disponible)
    logo_path = ROOT_DIR / "terciform_logo.png"
    if logo_path.exists():
        logo = Image(str(logo_path), width=2*inch, height=0.8*inch)
        story.append(logo)
        story.append(Spacer(1, 10))
    
    # Titre principal - Style Qualiopi
    title_style = ParagraphStyle(
        'QualiopiTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#5f44ff'),
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph("Rapport d'Évolution des Compétences", title_style))
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        spaceAfter=30
    )
    story.append(Paragraph("Parcours Bureautique - Analyse Pédagogique", subtitle_style))
    
    # Informations élève - Section Qualiopi
    info_box_style = ParagraphStyle(
        'InfoBox',
        parent=styles['Normal'],
        fontSize=11,
        leading=16,
        leftIndent=10
    )
    
    student_name = student.get('name', student.get('full_name', 'N/A'))
    parcours = student.get('parcours', 'N/A')
    report_date = datetime.now().strftime('%d/%m/%Y')
    report_time = datetime.now().strftime('%H:%M:%S')
    report_timestamp = f"{report_date} à {report_time}"
    
    info_data = [
        ['Élève:', student_name],
        ['Parcours:', parcours],
        ['Date du rapport:', report_date],
        ['Horodatage:', report_timestamp]
    ]
    info_table = Table(info_data, colWidths=[120, 350])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F0F0')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#333333')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
    ]))
    story.append(info_table)
    story.append(Spacer(1, 30))
    
    # Section: Résultats des évaluations
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#5f44ff'),
        spaceAfter=15,
        spaceBefore=10,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph("1. Résultats des évaluations", section_style))
    
    # Tableau des résultats avec dates
    results_data = [
        ['Évaluation', 'Date', 'Score', 'Niveau'],
        [
            'T1 - Positionnement',
            t1['submitted_at'].strftime('%d/%m/%Y'),
            f"{t1['score']}%",
            get_mention_label_text(t1['score'])
        ],
        [
            'T2 - Mi-parcours',
            t2['submitted_at'].strftime('%d/%m/%Y'),
            f"{t2['score']}%",
            get_mention_label_text(t2['score'])
        ],
        [
            'T3 - Fin de formation',
            t3['submitted_at'].strftime('%d/%m/%Y'),
            f"{t3['score']}%",
            get_mention_label_text(t3['score'])
        ]
    ]
    
    results_table = Table(results_data, colWidths=[150, 100, 80, 140])
    results_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#5f44ff')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('FONTSIZE', (0, 1), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8F8F8')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#DDDDDD')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
    ]))
    story.append(results_table)
    story.append(Spacer(1, 30))
    
    # Section: Graphique d'évolution
    story.append(Paragraph("2. Graphique d'évolution", section_style))
    graph_img = Image(graph_buffer, width=5*inch, height=3*inch)
    story.append(graph_img)
    story.append(Spacer(1, 10))
    
    # Indicateur de tendance sous le graphique
    tendance_text = get_tendance_text(t1['score'], t3['score'])
    tendance_style = ParagraphStyle(
        'Tendance',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#5f44ff'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph(tendance_text, tendance_style))
    story.append(Spacer(1, 30))
    
    # Section: Analyse pédagogique (IA) - VERSION SYNTHÉTIQUE
    story.append(Paragraph("3. Analyse pédagogique", section_style))
    
    analysis_style = ParagraphStyle(
        'Analysis',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        alignment=TA_LEFT,
        leftIndent=10,
        rightIndent=10
    )
    
    # L'analyse IA est déjà formatée et courte (10 lignes max)
    story.append(Paragraph(ai_analysis.replace('\n', '<br/>'), analysis_style))
    
    story.append(Spacer(1, 20))
    
    # Footer Qualiopi
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER
    )
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "Rapport conforme aux critères Qualiopi - Document utilisable comme preuve de suivi pédagogique",
        footer_style
    ))
    
    # Générer le PDF
    doc.build(story)
    buffer.seek(0)
    
    # Nom du fichier avec date et nom de l'élève
    filename = f"Rapport_Evolution_{student_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


class SendReportRequest(BaseModel):
    email: str


@api_router.post("/students/{student_id}/send-report")
async def send_magic_report_email(
    student_id: str,
    request: SendReportRequest,
    current_user: User = Depends(get_current_user)
):
    """Envoie le rapport d'évolution par email à une adresse spécifiée"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Vérifier que l'élève appartient au professeur
    if student.get("teacher_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Utiliser l'email fourni dans la requête
    recipient_email = request.email
    if not recipient_email or '@' not in recipient_email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Récupérer les 3 tests
    resources = await db.student_resources.find(
        {"student_id": student_id, "category": "TEST_PARCOURS", "status": "SOUMIS"},
        {"_id": 0}
    ).to_list(length=None)
    
    # Trier par sub_type
    tests_map = {}
    for r in resources:
        tests_map[r['sub_type']] = r
    
    t1 = tests_map.get('POSITIONNEMENT')
    t2 = tests_map.get('MI_PARCOURS')
    t3 = tests_map.get('FIN')
    
    if not t1 or not t2 or not t3:
        raise HTTPException(
            status_code=400, 
            detail=f"Les 3 tests doivent être complétés pour envoyer le rapport. Statut: T1={bool(t1)}, T2={bool(t2)}, T3={bool(t3)}"
        )
    
    # Générer le PDF (réutilisation de la logique existante)
    try:
        # Générer l'analyse IA
        ai_analysis = await generate_ai_pedagogical_analysis(
            student_name=student.get('name', 'N/A'),
            t1_score=t1['score'],
            t2_score=t2['score'],
            t3_score=t3['score'],
            t1_date=t1['submitted_at'].strftime('%d/%m/%Y'),
            t2_date=t2['submitted_at'].strftime('%d/%m/%Y'),
            t3_date=t3['submitted_at'].strftime('%d/%m/%Y')
        )
        
        # Générer le graphique
        graph_buffer = generate_evolution_graph(t1['score'], t2['score'], t3['score'])
        
        # Créer le PDF complet (code simplifié - réutilise la logique)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        story = []
        styles = getSampleStyleSheet()
        
        # [Code de génération du PDF identique à magic-report - simplifié ici]
        # On peut appeler une fonction helper pour éviter la duplication
        
        # Pour l'instant, générons un PDF simple
        title_style = ParagraphStyle(
            'QualiopiTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#5f44ff'),
            alignment=TA_CENTER,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        story.append(Paragraph("Rapport d'Évolution des Compétences", title_style))
        story.append(Spacer(1, 20))
        
        # Informations
        student_name = student.get('name', student.get('full_name', 'N/A'))
        info_style = styles['Normal']
        story.append(Paragraph(f"Élève: {student_name}", info_style))
        story.append(Paragraph(f"Parcours: {student.get('parcours', 'N/A')}", info_style))
        story.append(Paragraph(f"Date: {datetime.now().strftime('%d/%m/%Y')}", info_style))
        story.append(Spacer(1, 30))
        
        # Résultats
        results_data = [
            ['Évaluation', 'Date', 'Score'],
            ['T1 - Positionnement', t1['submitted_at'].strftime('%d/%m/%Y'), f"{t1['score']}%"],
            ['T2 - Mi-parcours', t2['submitted_at'].strftime('%d/%m/%Y'), f"{t2['score']}%"],
            ['T3 - Fin de formation', t3['submitted_at'].strftime('%d/%m/%Y'), f"{t3['score']}%"]
        ]
        results_table = Table(results_data)
        results_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#5f44ff')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(results_table)
        story.append(Spacer(1, 20))
        
        # Graphique
        graph_img = Image(graph_buffer, width=5*inch, height=3*inch)
        story.append(graph_img)
        story.append(Spacer(1, 10))
        
        # Tendance
        tendance_text = get_tendance_text(t1['score'], t3['score'])
        tendance_style = ParagraphStyle('Tendance', parent=styles['Normal'], fontSize=11, alignment=TA_CENTER, fontName='Helvetica-Bold')
        story.append(Paragraph(tendance_text, tendance_style))
        story.append(Spacer(1, 20))
        
        # Analyse IA
        story.append(Paragraph("Analyse pédagogique", styles['Heading2']))
        analysis_style = ParagraphStyle('Analysis', parent=styles['Normal'], fontSize=10, leading=14)
        story.append(Paragraph(ai_analysis.replace('\n', '<br/>'), analysis_style))
        
        doc.build(story)
        buffer.seek(0)
        pdf_content = buffer.getvalue()
        
        # Nom du fichier
        filename = f"Rapport_Evolution_{student_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        # Préparer l'email HTML
        email_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto;">
                <h2 style="color: #5f44ff;">Rapport d'Évolution - Terciform</h2>
                <p>Bonjour {student_name},</p>
                <p>Veuillez trouver ci-joint votre rapport d'évolution de compétences pour le parcours <strong>{student.get('parcours', 'Bureautique')}</strong>.</p>
                <p>Ce rapport synthétise vos résultats aux trois évaluations (T1, T2, T3) et présente une analyse pédagogique de votre progression.</p>
                <p><strong>Résultats:</strong></p>
                <ul>
                    <li>T1 (Positionnement): {t1['score']}%</li>
                    <li>T2 (Mi-parcours): {t2['score']}%</li>
                    <li>T3 (Fin de formation): {t3['score']}%</li>
                </ul>
                <p>Cordialement,<br/>
                <strong>L'équipe Terciform</strong></p>
            </div>
        </body>
        </html>
        """
        
        # Envoyer l'email avec la pièce jointe
        success = send_email_with_attachment(
            to_email=recipient_email,
            subject=f"Rapport d'évolution - {student.get('parcours', 'Bureautique')} - Terciform",
            html_body=email_body,
            pdf_content=pdf_content,
            filename=filename
        )
        
        if success:
            return {"success": True, "message": f"Rapport envoyé à {recipient_email}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email - check SMTP configuration")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending report: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating or sending report: {str(e)}")


async def generate_ai_pedagogical_analysis(student_name: str, t1_score: float, t2_score: float, t3_score: float, t1_date: str, t2_date: str, t3_date: str) -> str:
    """Génère une analyse pédagogique SYNTHÉTIQUE via GPT-5 (10 lignes max)"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Récupérer la clé Emergent LLM
        emergent_key = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-e102aC2E3A4C11135A')
        
        # Créer le chat
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"magic-report-{datetime.now().timestamp()}",
            system_message="Tu es un formateur certifié Qualiopi. Tu dois produire une analyse pédagogique très synthétique (10 lignes maximum), structurée, claire et exploitable par un auditeur."
        )
        chat.with_model("openai", "gpt-5")
        
        # Nouveau prompt SYNTHÉTIQUE (V2)
        prompt = f"""Élève : {student_name}
Parcours : Bureautique

Scores :
- T1 : {t1_score}%
- T2 : {t2_score}%
- T3 : {t3_score}%

Génère une analyse selon le format ci-dessous, en 10 lignes maximum :

1. Points forts (2 lignes max)
2. Points faibles (2 lignes max)
3. Axes d'amélioration (3 lignes max)
4. Solutions proposées (2 lignes max)
5. Conclusion (1 phrase max)

Style : professionnel, clair, bienveillant, très synthétique, aligné Qualiopi.
IMPORTANT: Respecte strictement la limite de 10 lignes. Pas de phrases trop longues. Pas d'analyse inutile."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return response
        
    except Exception as e:
        # Fallback sur analyse simple si l'IA échoue
        logging.error(f"Erreur lors de l'analyse IA: {e}")
        return generate_fallback_analysis(t1_score, t2_score, t3_score)


def generate_fallback_analysis(t1: float, t2: float, t3: float) -> str:
    """Analyse de secours SYNTHÉTIQUE (10 lignes max) si l'IA n'est pas disponible"""
    diff_t1_t3 = t3 - t1
    
    # Déterminer les points forts
    if t3 >= 60:
        points_forts = f"Score final de {t3}%, compétences acquises. Bonne maîtrise des outils bureautiques."
    elif t3 >= 30:
        points_forts = f"Score final de {t3}%, bases acquises. Participation active et régulière."
    else:
        points_forts = f"Score final de {t3}%. Engagement dans la formation et assiduité constatée."
    
    # Déterminer les points faibles
    if diff_t1_t3 < 0:
        points_faibles = f"Baisse de {abs(diff_t1_t3):.0f} points entre T1 et T3. Difficulté à maintenir le niveau initial."
    elif diff_t1_t3 < 10:
        points_faibles = f"Progression limitée ({diff_t1_t3:.0f} points). Certaines notions restent à consolider."
    else:
        points_faibles = "Rythme d'apprentissage à maintenir. Quelques axes restent perfectibles."
    
    # Axes d'amélioration
    if diff_t1_t3 < 0:
        axes = "Reprendre les bases. Renforcer pratique quotidienne. Proposer exercices adaptés."
    elif t3 < 60:
        axes = "Approfondir les fonctionnalités avancées. Multiplier mises en situation. Suivis réguliers."
    else:
        axes = "Continuer montée en compétences. Explorer fonctions expertes. Autonomie renforcée."
    
    # Solutions proposées
    if diff_t1_t3 < 0:
        solutions = "Accompagnement individuel renforcé. Révisions ciblées sur points bloquants."
    else:
        solutions = "Parcours complémentaire optionnel. Ateliers pratiques thématiques."
    
    # Conclusion
    if diff_t1_t3 > 20:
        conclusion = "Excellente progression, objectifs atteints."
    elif diff_t1_t3 > 10:
        conclusion = "Bonne évolution, formation réussie."
    elif diff_t1_t3 > 0:
        conclusion = "Progression positive, à poursuivre."
    else:
        conclusion = "Accompagnement à renforcer pour consolider."
    
    # Format strict (10 lignes)
    analysis = f"""1. Points forts
{points_forts}

2. Points faibles
{points_faibles}

3. Axes d'amélioration
{axes}

4. Solutions proposées
{solutions}

5. Conclusion
{conclusion}"""
    
    return analysis


def get_tendance_text(t1_score: float, t3_score: float) -> str:
    """Génère le texte de tendance avec icône"""
    if t3_score > t1_score:
        diff = t3_score - t1_score
        return f"📈 Tendance générale : Progression des résultats entre T1 et T3 (+{diff:.0f} points)"
    elif t3_score < t1_score:
        diff = t1_score - t3_score
        return f"📉 Tendance générale : Baisse des résultats entre T1 et T3 (-{diff:.0f} points)"
    else:
        return "➖ Tendance générale : Stable (résultats équivalents T1 et T3)"


def generate_evolution_graph(t1: float, t2: float, t3: float) -> io.BytesIO:
    """Génère un graphique d'évolution avec matplotlib"""
    import matplotlib
    matplotlib.use('Agg')  # Backend non-interactif
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    
    # Créer la figure
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Données
    tests = ['T1\nPositionnement', 'T2\nMi-parcours', 'T3\nFin de formation']
    scores = [t1, t2, t3]
    
    # Tracer la courbe
    ax.plot(tests, scores, marker='o', linewidth=3, markersize=12, 
            color='#5f44ff', label='Évolution des scores')
    
    # Ajouter les valeurs sur les points
    for i, score in enumerate(scores):
        ax.annotate(f'{score}%', 
                   xy=(i, score), 
                   xytext=(0, 10),
                   textcoords='offset points',
                   ha='center',
                   fontsize=12,
                   fontweight='bold',
                   color='#5f44ff')
    
    # Zones de compétences
    ax.axhspan(0, 30, alpha=0.1, color='red', label='Non acquis')
    ax.axhspan(30, 60, alpha=0.1, color='orange', label='En cours')
    ax.axhspan(60, 100, alpha=0.1, color='green', label='Acquis')
    
    # Configuration
    ax.set_ylim(0, 100)
    ax.set_ylabel('Score (%)', fontsize=12, fontweight='bold')
    ax.set_title('Évolution des compétences bureautiques', 
                fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.legend(loc='upper left', fontsize=10)
    
    # Style
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    # Sauvegarder dans un buffer
    buffer = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buffer.seek(0)
    
    return buffer


def get_mention_label(score):
    """Retourne la mention selon le score (avec emojis)"""
    if score < 30:
        return "Non acquis"
    elif score < 60:
        return "En cours d'acquisition"
    else:
        return "Acquis"


def get_mention_label_text(score):
    """Retourne la mention selon le score (texte seul pour PDF)"""
    if score < 30:
        return "Non acquis"
    elif score < 60:
        return "En cours"
    else:
        return "Acquis"


def analyze_evolution(t1, t2, t3):
    """Analyse l'évolution des scores (fonction conservée pour compatibilité)"""
    diff_t1_t2 = t2 - t1
    diff_t2_t3 = t3 - t2
    diff_t1_t3 = t3 - t1
    
    analysis = f"""
    Score T1 (Positionnement): {t1}%
    Score T2 (Mi-parcours): {t2}% ({'+' if diff_t1_t2 >= 0 else ''}{diff_t1_t2:.2f} points)
    Score T3 (Fin): {t3}% ({'+' if diff_t2_t3 >= 0 else ''}{diff_t2_t3:.2f} points)
    
    Progression globale: {'+' if diff_t1_t3 >= 0 else ''}{diff_t1_t3:.2f} points entre T1 et T3
    """
    
    if diff_t1_t3 > 20:
        analysis += "\n\nExcellente progression! L'élève a montré une forte amélioration de ses compétences bureautiques."
    elif diff_t1_t3 > 10:
        analysis += "\n\nBonne progression. L'élève a progressé de manière satisfaisante."
    elif diff_t1_t3 > 0:
        analysis += "\n\nProgression modérée. L'élève a légèrement progressé."
    elif diff_t1_t3 == 0:
        analysis += "\n\nStagnation. L'élève maintient son niveau sans progression notable."
    else:
        analysis += "\n\nRégression. L'élève a obtenu un score inférieur au test initial. Un accompagnement renforcé est recommandé."
    
    return analysis




@api_router.get("/teachers/qualite-report")
async def get_qualite_report(
    periodeType: str,
    moisIndex: int = None,
    annee: int = None,
    parcours: str = None,
    current_user: User = Depends(get_current_user)
):
    """
    Récupérer les données pour le rapport qualité
    IMPORTANT: Retourne TOUS les élèves assignés au professeur
    La période ne sert QUE pour les calculs de KPI, PAS pour filtrer les élèves
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    logger.info(f"Qualité report requested by teacher {current_user.id}: periodeType={periodeType}, moisIndex={moisIndex}, annee={annee}, parcours={parcours}")
    
    # Calculer la période de filtrage pour les questionnaires
    debut_periode = None
    fin_periode = None
    
    if periodeType == "mois" and moisIndex is not None and annee is not None:
        debut_periode = datetime(annee, moisIndex + 1, 1, tzinfo=timezone.utc)
        if moisIndex + 1 == 12:
            fin_periode = datetime(annee + 1, 1, 1, tzinfo=timezone.utc) - timedelta(days=1)
        else:
            fin_periode = datetime(annee, moisIndex + 2, 1, tzinfo=timezone.utc) - timedelta(days=1)
    elif periodeType == "annee" and annee is not None:
        debut_periode = datetime(annee, 1, 1, tzinfo=timezone.utc)
        fin_periode = datetime(annee, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    logger.info(f"Période de filtrage: {debut_periode} -> {fin_periode}")
    
    # Récupérer TOUS les élèves du professeur
    query = {"role": "student", "teacher_id": current_user.id}
    students = await db.users.find(query, {"_id": 0}).to_list(length=None)
    
    logger.info(f"Found {len(students)} students for teacher {current_user.id}")
    
    result = []
    
    for student in students:
        student_id = student.get("id")
        student_name = student.get("name", "")
        
        # Déterminer la matière/parcours
        student_parcours = student.get("parcours", "Non spécifié")
        
        # Filtrage par parcours (optionnel)
        if parcours and parcours != "Toutes" and student_parcours != parcours:
            logger.debug(f"Student {student_name} filtered out by parcours: {student_parcours} != {parcours}")
            continue
        
        # Récupérer les 3 questionnaires selon le parcours de l'élève
        if student_parcours in ["Bureautique", "Informatique"]:
            # Pour Bureautique/Informatique : chercher dans les deux sources possibles
            # 1) D'abord essayer les collections spécifiques bureautique
            q1 = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            q2 = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            q3 = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            
            # 2) Si pas trouvé, chercher dans student_resources
            if not q1 or not q1.get("answers"):
                q1_resource = await db.student_resources.find_one(
                    {"student_id": student_id, "category": "QUESTIONNAIRE_QUALIOPI", "sub_type": "POSITIONNEMENT"},
                    {"_id": 0}
                )
                if q1_resource and q1_resource.get("status") == "SOUMIS":
                    q1 = {"submitted_at": q1_resource.get("submitted_at"), "answers": q1_resource.get("answers")}
            
            if not q2 or not q2.get("answers"):
                q2_resource = await db.student_resources.find_one(
                    {"student_id": student_id, "category": "QUESTIONNAIRE_QUALIOPI", "sub_type": "MI_PARCOURS"},
                    {"_id": 0}
                )
                if q2_resource and q2_resource.get("status") == "SOUMIS":
                    q2 = {"submitted_at": q2_resource.get("submitted_at"), "answers": q2_resource.get("answers")}
            
            if not q3 or not q3.get("answers"):
                q3_resource = await db.student_resources.find_one(
                    {"student_id": student_id, "category": "QUESTIONNAIRE_QUALIOPI", "sub_type": "FIN"},
                    {"_id": 0}
                )
                if q3_resource and q3_resource.get("status") == "SOUMIS":
                    q3 = {"submitted_at": q3_resource.get("submitted_at"), "answers": q3_resource.get("answers")}
        else:
            # Par défaut : Anglais ou autres parcours
            q1 = await db.formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            q2 = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            q3 = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            
            # Log pour debug
            logger.info(f"[QUALITE DEBUG] Student {student_name} (ID: {student_id}, Parcours: {student_parcours})")
            logger.info(f"[QUALITE DEBUG] Q1: {q1 is not None}, Q2: {q2 is not None}, Q3: {q3 is not None}")
            if q2:
                logger.info(f"[QUALITE DEBUG] Q2 data: submitted_at={q2.get('submitted_at')}")
        
        # Filtrage par période : vérifier si au moins UN questionnaire est dans la période
        # OU si l'élève n'a aucun questionnaire (à inclure aussi)
        has_q_in_period = False
        
        if debut_periode and fin_periode:
            # Vérifier chaque questionnaire
            for q in [q1, q2, q3]:
                if q and q.get("submitted_at"):
                    try:
                        q_date_str = q.get("submitted_at")
                        if isinstance(q_date_str, str):
                            # Parser la date
                            q_date = datetime.fromisoformat(q_date_str.replace('Z', '+00:00'))
                            # Si la date est naive (sans timezone), ajouter UTC
                            if q_date.tzinfo is None:
                                q_date = q_date.replace(tzinfo=timezone.utc)
                        else:
                            q_date = q_date_str
                            if q_date.tzinfo is None:
                                q_date = q_date.replace(tzinfo=timezone.utc)
                        
                        # Si le questionnaire est dans la période
                        if debut_periode <= q_date <= fin_periode:
                            has_q_in_period = True
                            break
                    except Exception as e:
                        logger.warning(f"Error parsing date for student {student_name}: {e}")
            
            # Si l'élève n'a AUCUN questionnaire dans la période ET qu'il a au moins un questionnaire, on le skip
            if not has_q_in_period and (q1 or q2 or q3):
                logger.debug(f"Student {student_name} has no questionnaires in period, skipping")
                continue
            # Si l'élève n'a AUCUN questionnaire du tout, on l'inclut quand même
            if not q1 and not q2 and not q3:
                has_q_in_period = True  # Inclure les élèves sans questionnaire
        
        # Format de retour pour chaque questionnaire - INCLURE TOUTES LES RÉPONSES
        q1_data = {
            "submitted": q1 is not None,
            "submitted_at": q1.get("submitted_at") if q1 else None,
            # Inclure toutes les réponses pour la consultation
            **({k: v for k, v in q1.items() if k not in ['_id', 'student_id']} if q1 else {})
        }
        
        q2_data = {
            "submitted": q2 is not None,
            "submitted_at": q2.get("submitted_at") if q2 else None,
            # Inclure toutes les réponses pour la consultation
            **({k: v for k, v in q2.items() if k not in ['_id', 'student_id']} if q2 else {})
        }
        
        # Règle progressive : si Q2 pas soumis, Q3 ne peut pas être soumis
        q3_submitted = q3 is not None
        if not q2_data["submitted"]:
            q3_submitted = False
        
        # Calculer les scores avec l'agent IA qualité
        score_ressenti_progression = None
        score_satisfaction = None
        difficulties = []
        mastered_skills = []
        
        # Utiliser l'agent IA pour calculer les scores basés sur les réponses à échelle
        if q3_submitted:
            try:
                quality_scores = calculate_quality_scores(q1, q2, q3)
                score_ressenti_progression = quality_scores['score_ressenti_progression']
                score_satisfaction = quality_scores['score_satisfaction']
                difficulties = quality_scores['difficulties']
                mastered_skills = quality_scores.get('mastered_skills', [])
            except Exception as e:
                logger.warning(f"Error calculating quality scores for student {student_name}: {e}")
                # En cas d'erreur, garder les valeurs None
        
        # Extraire overallRating (étoiles) depuis les données Q3
        q3_overall_stars = None
        if q3 and q3_submitted:
            # overallRating peut être envoyé directement ou dans evaluation_globale
            q3_overall_stars = q3.get("overallRating") or q3.get("evaluation_globale")
            if q3_overall_stars:
                try:
                    q3_overall_stars = int(q3_overall_stars)
                except (ValueError, TypeError):
                    q3_overall_stars = None
        
        q3_data = {
            "submitted": q3_submitted,
            "submitted_at": q3.get("submitted_at") if (q3 and q3_submitted) else None,
            "score_ressenti_progression": score_ressenti_progression,
            "score_satisfaction": score_satisfaction,
            "difficulties": difficulties,
            "mastered_skills": mastered_skills,
            "overallStars": q3_overall_stars,  # Étoiles Q3 pour affichage dans Bilan Qualité
            # Inclure toutes les réponses pour la consultation
            **({k: v for k, v in q3.items() if k not in ['_id', 'student_id']} if (q3 and q3_submitted) else {})
        }
        
        result.append({
            "id": student_id,
            "nom": student_name,
            "email": student.get("email", ""),
            "parcours": student_parcours,
            "q1": q1_data,
            "q2": q2_data,
            "q3": q3_data,
        })
    
    logger.info(f"Returning {len(result)} students (all assigned students, no period filter)")
    return result



@api_router.get("/questionnaire-templates/{template_id}")
async def get_questionnaire_template(
    template_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer un template de questionnaire par son ID"""
    template = await db.questionnaire_templates.find_one(
        {"id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    

@api_router.post("/student-resources/{resource_id}/submit-questionnaire")
async def submit_questionnaire(
    resource_id: str,
    answers: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre les réponses d'un questionnaire"""
    # Vérifier que la ressource existe et appartient à l'utilisateur
    resource = await db.student_resources.find_one(
        {"id": resource_id},
        {"_id": 0}
    )
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if resource["student_id"] != current_user.id and current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Sauvegarder les réponses
    await db.student_resources.update_one(
        {"id": resource_id},
        {
            "$set": {
                "status": "SOUMIS",
                "submitted_at": datetime.now().isoformat(),
                "answers": answers
            }
        }
    )
    
    logger.info(f"Questionnaire {resource_id} submitted by user {current_user.id}")
    
    return {"message": "Questionnaire submitted successfully", "resource_id": resource_id}

    return template

@api_router.post("/questionnaire-templates/init")
async def init_questionnaire_templates(
    current_user: User = Depends(get_current_user)
):
    """
    Initialiser les templates de questionnaires pour chaque parcours
    À appeler une seule fois pour créer les templates de base
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier si des templates existent déjà
    existing = await db.questionnaire_templates.count_documents({})
    if existing > 0:
        return {"message": f"Templates déjà existants ({existing})", "count": existing}
    
    # Créer les templates pour Anglais (déjà existants dans le code)
    templates = [
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Anglais",
            "type": "Q1",
            "title": "Questionnaire de besoin en formation - Anglais",
            "description": "Questionnaire initial pour identifier les besoins en formation linguistique",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Anglais",
            "type": "Q2",
            "title": "Questionnaire à mi-parcours - Anglais",
            "description": "Évaluation intermédiaire de la formation",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Anglais",
            "type": "Q3",
            "title": "Questionnaire de fin de formation - Anglais",
            "description": "Bilan final et satisfaction de la formation",
            "created_at": datetime.utcnow().isoformat()
        }
    ]
    
    await db.questionnaire_templates.insert_many(templates)
    logger.info(f"Created {len(templates)} questionnaire templates")
    
    return {"message": "Templates créés avec succès", "count": len(templates)}


@api_router.get("/teachers/qualite-report/debug")
async def debug_qualite_report(
    current_user: User = Depends(get_current_user)
):
    """Debug endpoint pour vérifier les données du professeur"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Compter les élèves
    total_students = await db.users.count_documents({"role": "student"})
    my_students = await db.users.count_documents({"role": "student", "teacher_id": current_user.id})
    
    # Lister mes élèves avec parcours
    students = await db.users.find(
        {"role": "student", "teacher_id": current_user.id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "matiere": 1, "parcours": 1}
    ).to_list(length=50)
    
    # Compter les questionnaires
    q1_count = await db.formation_needs_questionnaires.count_documents({})
    q2_count = await db.mid_course_questionnaires.count_documents({})
    q3_count = await db.end_course_questionnaires.count_documents({})
    
    # Lister TOUS les Q2 soumis avec plus de détails
    all_q2 = await db.mid_course_questionnaires.find({}, {"_id": 0}).to_list(100)
    
    # Créer un mapping student_id -> student_name pour référence
    student_id_to_name = {s.get("id"): s.get("name") for s in students}
    
    # Ajouter le nom de l'étudiant à chaque Q2
    q2_with_names = []
    for q2 in all_q2:
        sid = q2.get("student_id")
        q2_with_names.append({
            "student_id": sid,
            "student_name_from_users": student_id_to_name.get(sid, "NOT FOUND IN USERS"),
            "submitted_at": q2.get("submitted_at"),
            "has_data": bool(q2)
        })
    
    # Pour chaque élève Anglais, vérifier s'il a un Q2
    anglais_students_q2_check = []
    for student in students:
        if student.get("parcours") == "Anglais":
            student_id = student.get("id")
            q2 = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
            anglais_students_q2_check.append({
                "student_name": student.get("name"),
                "student_id": student_id,
                "q2_found": q2 is not None,
                "q2_submitted_at": q2.get("submitted_at") if q2 else None
            })
    
    # Compter les templates
    templates_count = await db.questionnaire_templates.count_documents({})
    
    return {
        "teacher_id": current_user.id,
        "teacher_name": current_user.name,
        "total_students_in_db": total_students,
        "my_students_count": my_students,
        "my_students": students,
        "questionnaires_count": {
            "q1_formation_needs": q1_count,
            "q2_mid_course": q2_count,
            "q3_end_course": q3_count
        },
        "all_q2_in_mid_course_collection": q2_with_names,
        "anglais_students_q2_check": anglais_students_q2_check,
        "templates_count": templates_count
    }


@api_router.delete("/teachers/qualite-report/{student_id}")
async def remove_student_from_report(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Supprimer un élève du rapport qualité (retirer l'association teacher_id)"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'élève appartient au professeur
    student = await db.users.find_one(
        {"id": student_id, "role": "student", "teacher_id": current_user.id},
        {"_id": 0}
    )
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found or not assigned to you")
    
    # Retirer l'association (mettre teacher_id à None)
    await db.users.update_one(
        {"id": student_id},
        {"$unset": {"teacher_id": ""}}
    )
    
    return {"message": "Student removed from report", "student_id": student_id}


@api_router.post("/teachers/relance-questionnaire")
async def relance_questionnaire(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Envoyer une relance par email pour un questionnaire non soumis"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    student_id = data.get("student_id")
    questionnaire = data.get("questionnaire")  # Q1, Q2, Q3
    student_email = data.get("student_email")
    student_name = data.get("student_name")
    
    if not all([student_id, questionnaire, student_email, student_name]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Labels des questionnaires
    questionnaire_labels = {
        "Q1": "Questionnaire d'entrée (Besoins)",
        "Q2": "Questionnaire mi-parcours (Suivi)",
        "Q3": "Questionnaire de fin (Satisfaction)"
    }
    
    label = questionnaire_labels.get(questionnaire, questionnaire)
    first_name = student_name.split()[0] if student_name else "Apprenant"
    teacher_name = current_user.name or "votre formateur"
    
    # Horodatage
    timestamp_now = datetime.now().strftime("%d/%m/%Y à %H:%M")
    
    # Créer l'email de relance
    email_subject = f"🔔 Rappel : Merci de compléter votre {questionnaire}"
    email_html = f"""<html>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🔔 Rappel Questionnaire</h1>
  </div>
  
  <div style="padding: 32px 24px;">
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Bonjour <strong>{first_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Votre formateur <strong>{teacher_name}</strong> vous invite à compléter le questionnaire suivant :
    </p>
    
    <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
      <p style="margin: 0; font-size: 18px; color: #9a3412; font-weight: bold;">
        📋 {label}
      </p>
    </div>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.8;">
        Ce questionnaire est important pour le suivi de votre formation et notre démarche qualité.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://teachportal-12.emergent.host" style="display: inline-block; background-color: #f97316; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Accéder à mon espace
      </a>
    </div>
    
    <p style="margin: 24px 0 0 0; font-size: 15px; color: #6b7280;">
        Merci pour votre participation ! 🙏
    </p>
  </div>
  
  <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Email envoyé le {timestamp_now}</p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">TerciForm - Plateforme de formation</p>
  </div>
</div>
</body>
</html>"""
    
    # Envoyer l'email
    try:
        email_sent = send_email(student_email, email_subject, email_html)
        
        if email_sent:
            # Log la relance
            await db.questionnaire_relances.insert_one({
                "id": str(uuid.uuid4()),
                "student_id": student_id,
                "student_name": student_name,
                "questionnaire": questionnaire,
                "teacher_id": current_user.id,
                "teacher_name": current_user.name,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "email_sent_to": student_email
            })
            
            logger.info(f"✅ Relance {questionnaire} envoyée à {student_email} par {current_user.name}")
            return {"message": f"Relance envoyée avec succès à {student_name}", "questionnaire": questionnaire}
        else:
            raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")
    except Exception as e:
        logger.error(f"❌ Erreur relance questionnaire: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PHASE 2 - ACTIONS FORMATEUR QUALIOPI
# ============================================================================

# Mots-clés pédagogiques pour le parcours ANGLAIS
KEYWORDS_ANGLAIS = {
    "competences_linguistiques": ["oral", "compréhension orale", "expression écrite", "compréhension écrite", "vocabulaire", "grammaire", "prononciation"],
    "pedagogie_methodes": ["rythme", "supports", "méthodes", "préparation", "répétition", "pratique"],
    "objectifs_parcours": ["objectifs non atteints", "certification", "professionnel", "international"],
    "organisation": ["planning", "distanciel", "présentiel", "hybride", "disponibilité"]
}

# Actions suggérées ANGLAIS
KEYWORD_TO_ACTION_ANGLAIS = {
    "oral": "Renforcer les échanges oraux",
    "compréhension orale": "Reformulation / répétition guidée",
    "expression écrite": "Exercices d'écriture ciblés",
    "compréhension écrite": "Travail sur les textes adaptés",
    "vocabulaire": "Travail lexical ciblé",
    "grammaire": "Révision des points grammaticaux",
    "prononciation": "Exercices de phonétique",
    "rythme": "Ajuster le rythme des séances",
    "supports": "Adapter les supports pédagogiques",
    "méthodes": "Diversifier les approches pédagogiques",
    "préparation": "Envoyer les supports en amont",
    "répétition": "Augmenter la fréquence des révisions",
    "pratique": "Augmenter les exercices pratiques",
    "objectifs non atteints": "Revoir les objectifs et adapter le parcours",
    "certification": "Préparation spécifique certification",
    "professionnel": "Adapter au contexte professionnel",
    "international": "Focus sur l'anglais international",
    "planning": "Réorganiser le planning",
    "distanciel": "Adapter le format distanciel",
    "présentiel": "Privilégier le présentiel",
    "hybride": "Équilibrer présentiel/distanciel",
    "disponibilité": "Ajuster selon les disponibilités"
}

# Mots-clés pédagogiques pour le parcours INFORMATIQUE (débutants)
# Structure: internal keywords -> human-readable NEED labels
KEYWORDS_INFORMATIQUE = {
    "bases_usage_ordinateur": ["debutant", "bases", "notions", "niveau faible", "souris", "clavier", "manipulation", "clic", "taper", "dossiers", "fichiers", "explorateur", "organisation"],
    "outils_bureautique": ["word", "traitement de texte", "mise en page", "excel", "tableur", "formule", "cellule", "powerpoint", "presentation", "diaporama"],
    "internet_messagerie": ["internet", "navigation", "recherche", "email", "messagerie", "piece jointe"],
    "securite": ["mot de passe", "phishing", "virus", "arnaque", "securite"],
    "pedagogie": ["rythme", "trop rapide", "trop lent", "pratique", "exercices", "manipuler", "repetition", "revoir", "revision", "pas a pas", "etape", "explications", "autonomie", "bloque", "peur", "confiance"],
    "organisation_materiel": ["materiel", "ordinateur", "equipement", "distanciel", "presentiel", "hybride", "horaire", "planning", "disponibilite"]
}

# Actions suggérées INFORMATIQUE - Mapping internal keywords -> human NEED labels
KEYWORD_TO_ACTION_INFORMATIQUE = {
    # A) Bases / usage ordinateur
    "debutant": "Reprendre les bases informatiques",
    "bases": "Reprendre les bases informatiques",
    "notions": "Reprendre les bases informatiques",
    "niveau faible": "Reprendre les bases informatiques",
    "souris": "Améliorer l'aisance avec clavier/souris",
    "clavier": "Améliorer l'aisance avec clavier/souris",
    "manipulation": "Améliorer l'aisance avec clavier/souris",
    "clic": "Améliorer l'aisance avec clavier/souris",
    "taper": "Améliorer l'aisance avec clavier/souris",
    "dossiers": "Savoir gérer fichiers et dossiers",
    "fichiers": "Savoir gérer fichiers et dossiers",
    "explorateur": "Savoir gérer fichiers et dossiers",
    "organisation": "Savoir gérer fichiers et dossiers",
    # B) Outils
    "word": "Renforcer Word (traitement de texte)",
    "traitement de texte": "Renforcer Word (traitement de texte)",
    "mise en page": "Renforcer Word (traitement de texte)",
    "excel": "Renforcer Excel (tableur)",
    "tableur": "Renforcer Excel (tableur)",
    "formule": "Renforcer Excel (tableur)",
    "cellule": "Renforcer Excel (tableur)",
    "powerpoint": "Renforcer PowerPoint (présentations)",
    "presentation": "Renforcer PowerPoint (présentations)",
    "diaporama": "Renforcer PowerPoint (présentations)",
    "internet": "Mieux utiliser Internet (navigation/recherche)",
    "navigation": "Mieux utiliser Internet (navigation/recherche)",
    "recherche": "Mieux utiliser Internet (navigation/recherche)",
    "email": "Mieux utiliser la messagerie (e-mails)",
    "messagerie": "Mieux utiliser la messagerie (e-mails)",
    "piece jointe": "Mieux utiliser la messagerie (e-mails)",
    # C) Sécurité
    "mot de passe": "Renforcer la sécurité numérique",
    "phishing": "Renforcer la sécurité numérique",
    "virus": "Renforcer la sécurité numérique",
    "arnaque": "Renforcer la sécurité numérique",
    "securite": "Renforcer la sécurité numérique",
    # D) Pédagogie
    "rythme": "Adapter le rythme",
    "trop rapide": "Adapter le rythme",
    "trop lent": "Adapter le rythme",
    "pratique": "Ajouter plus de pratique guidée",
    "exercices": "Ajouter plus de pratique guidée",
    "manipuler": "Ajouter plus de pratique guidée",
    "repetition": "Ajouter des temps de révision",
    "revoir": "Ajouter des temps de révision",
    "revision": "Ajouter des temps de révision",
    "pas a pas": "Consignes plus 'pas à pas'",
    "etape": "Consignes plus 'pas à pas'",
    "explications": "Consignes plus 'pas à pas'",
    "autonomie": "Renforcer l'autonomie et la confiance",
    "bloque": "Renforcer l'autonomie et la confiance",
    "peur": "Renforcer l'autonomie et la confiance",
    "confiance": "Renforcer l'autonomie et la confiance",
    # E) Organisation / matériel
    "materiel": "Adapter le matériel / l'équipement",
    "ordinateur": "Adapter le matériel / l'équipement",
    "equipement": "Adapter le matériel / l'équipement",
    "distanciel": "Adapter le format",
    "presentiel": "Adapter le format",
    "hybride": "Adapter le format",
    "horaire": "Adapter l'organisation",
    "planning": "Adapter l'organisation",
    "disponibilite": "Adapter l'organisation"
}

# Actions mises en place suggestions pour Informatique (NEED -> action suggestion)
NEED_TO_ACTION_INFORMATIQUE = {
    "Reprendre les bases informatiques": "Reprise structurée des fondamentaux + exercices progressifs",
    "Améliorer l'aisance avec clavier/souris": "Ateliers de manipulation guidée",
    "Savoir gérer fichiers et dossiers": "Exercices dédiés organisation fichiers/dossiers",
    "Renforcer Word (traitement de texte)": "Exercices ciblés sur l'outil + cas pratiques",
    "Renforcer Excel (tableur)": "Exercices ciblés sur l'outil + cas pratiques",
    "Renforcer PowerPoint (présentations)": "Exercices ciblés sur l'outil + cas pratiques",
    "Mieux utiliser Internet (navigation/recherche)": "Parcours guidé de navigation/recherche",
    "Mieux utiliser la messagerie (e-mails)": "Atelier e-mail (envoi, pièces jointes, réponses)",
    "Renforcer la sécurité numérique": "Sensibilisation phishing + bonnes pratiques mots de passe",
    "Adapter le rythme": "Ralentissement + pauses + vérifications régulières",
    "Ajouter plus de pratique guidée": "Augmentation du temps de manipulation",
    "Ajouter des temps de révision": "Rituels de révision en début/fin de séance",
    "Consignes plus 'pas à pas'": "Fiches étapes + démonstration puis reproduction",
    "Renforcer l'autonomie et la confiance": "Accompagnement individualisé + objectifs intermédiaires",
    "Adapter le matériel / l'équipement": "Vérification équipement + alternative proposée",
    "Adapter le format": "Adaptation distanciel/présentiel selon contraintes",
    "Adapter l'organisation": "Ajustement créneaux / planning"
}

# Mots déclencheurs de besoin (pour la détection automatique)
NEED_TRIGGER_WORDS = [
    "difficulté", "difficile", "problème", "besoin", "demande", "souhaite", "aimerait",
    "améliorer", "renforcer", "plus de", "pas assez", "insuffisant", "compliqué",
    "mal compris", "pas compris", "confus", "perdu", "lent", "rapide", "trop",
    "manque", "absent", "suggestion", "proposer", "adapter", "changer",
    "peur", "blocage", "stress", "aide", "accompagnement"
]

# Réponses négatives/mitigées
NEGATIVE_RESPONSES = [
    "non", "pas du tout", "plutôt non", "insatisfait", "mécontent", "déçu",
    "partiellement", "pas vraiment", "peu", "rarement", "jamais"
]


def detect_need_in_questionnaire(questionnaire_data: dict, parcours: str = "Anglais") -> dict:
    """
    Analyse un questionnaire pour détecter si un besoin est identifié.
    Retourne: {"has_need": bool, "detected_keywords": list, "reasons": list}
    """
    if not questionnaire_data:
        return {"has_need": False, "detected_keywords": [], "reasons": []}
    
    # Sélectionner la grille selon le parcours
    if parcours == "Informatique":
        keywords_config = KEYWORDS_INFORMATIQUE
        keyword_to_action = KEYWORD_TO_ACTION_INFORMATIQUE
    else:
        keywords_config = KEYWORDS_ANGLAIS
        keyword_to_action = KEYWORD_TO_ACTION_ANGLAIS
    
    has_need = False
    detected_keywords = []
    reasons = []
    
    # Convertir toutes les valeurs en texte pour l'analyse
    all_text = ""
    for key, value in questionnaire_data.items():
        if key in ['submitted', 'submitted_at', 'student_id', 'id', '_id', 'signature', 'signature_data']:
            continue
        
        if isinstance(value, str):
            all_text += " " + value.lower()
        elif isinstance(value, list):
            all_text += " " + " ".join([str(v).lower() for v in value])
        elif isinstance(value, dict):
            for v in value.values():
                if isinstance(v, str):
                    all_text += " " + v.lower()
    
    # 1. Rechercher les mots déclencheurs de besoin
    for trigger in NEED_TRIGGER_WORDS:
        if trigger in all_text:
            has_need = True
            reasons.append(f"Mot-clé détecté: '{trigger}'")
            break
    
    # 2. Rechercher les réponses négatives/mitigées
    for neg in NEGATIVE_RESPONSES:
        if neg in all_text:
            has_need = True
            reasons.append(f"Réponse négative/mitigée: '{neg}'")
            break
    
    # 3. Vérifier les champs spécifiques de difficultés
    difficulties_fields = ['difficulties', 'difficultes', 'difficultes_rencontrees', 'points_ameliorer']
    for field in difficulties_fields:
        if field in questionnaire_data:
            value = questionnaire_data[field]
            if value and (isinstance(value, list) and len(value) > 0) or (isinstance(value, str) and value.strip()):
                has_need = True
                reasons.append(f"Difficultés signalées dans '{field}'")
    
    # 4. Vérifier objectifs non atteints
    objectives_fields = ['objectifs_atteints', 'objectifs']
    for field in objectives_fields:
        if field in questionnaire_data:
            value = str(questionnaire_data[field]).lower()
            if any(neg in value for neg in ['partiel', 'non', 'pas']):
                has_need = True
                reasons.append("Objectifs partiellement ou non atteints")
    
    # 5. Extraire les mots-clés pédagogiques détectés
    all_keywords = []
    for category_keywords in keywords_config.values():
        all_keywords.extend(category_keywords)
    
    for keyword in all_keywords:
        if keyword.lower() in all_text:
            detected_keywords.append(keyword)
    
    return {
        "has_need": has_need,
        "detected_keywords": list(set(detected_keywords)),
        "reasons": reasons[:3],
        "keyword_to_action": keyword_to_action
    }


@api_router.post("/teachers/questionnaire-action/analyze")
async def analyze_questionnaire_for_action(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Analyse un questionnaire pour extraire les mots-clés et détecter les besoins.
    Réponse simplifiée pour UI épurée.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire_data = data.get("questionnaire_data", {})
    parcours = data.get("parcours", "Anglais")
    
    # Sélectionner la grille selon le parcours
    if parcours == "Informatique":
        all_keywords_config = KEYWORDS_INFORMATIQUE
        keyword_to_action = KEYWORD_TO_ACTION_INFORMATIQUE
    else:
        all_keywords_config = KEYWORDS_ANGLAIS
        keyword_to_action = KEYWORD_TO_ACTION_ANGLAIS
    
    # Analyser le questionnaire
    analysis = detect_need_in_questionnaire(questionnaire_data, parcours)
    
    # Générer max 3 actions suggérées
    suggested_actions = []
    for keyword in analysis["detected_keywords"][:3]:
        if keyword in keyword_to_action:
            suggested_actions.append({
                "id": keyword,
                "label": keyword_to_action[keyword]
            })
    
    # Si pas assez d'actions, ajouter "Autre"
    if len(suggested_actions) < 3:
        suggested_actions.append({
            "id": "autre",
            "label": "Autre (texte libre)"
        })
    
    # Générer le texte pré-rempli court (2 lignes max)
    report_draft = ""
    if analysis["detected_keywords"]:
        first_action = suggested_actions[0]["label"] if suggested_actions else "adaptation"
        report_draft = f"L'apprenant a exprimé un besoin d'{first_action.lower()}.\nLe contenu de la formation a été ajusté en conséquence."
    else:
        report_draft = "Analyse effectuée. Aucun besoin particulier identifié.\nLe dispositif est maintenu."
    
    return {
        "has_need": analysis["has_need"],
        "detected_keywords": analysis["detected_keywords"],
        "suggested_actions": suggested_actions[:3],
        "report_draft": report_draft,
        "all_keywords": all_keywords_config,
        "keyword_to_action": keyword_to_action,
        # Pour audit uniquement (non affiché par défaut)
        "detection_details": analysis["reasons"]
    }


# =============================================================================
# AI Q3 SUGGEST - Analyse le Block B du Q3 pour suggestions d'actions
# =============================================================================
@api_router.post("/ai/q3/suggest")
async def ai_q3_suggest_actions(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Analyse le Block B (satisfaction) du Q3 pour suggérer des actions.
    Utilisé dans le modal "Définir une action" pour Q3.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    q3_data = data.get("q3_data", {})
    
    # Fallback: si q3_data est vide, utiliser les données directement
    if not q3_data:
        q3_data = data
    
    # Extraire les réponses du Block B
    contenu_adapte = q3_data.get("contenu_adapte", "")
    rythme_duree = q3_data.get("rythme_duree", "")
    formateur_satisfaisant = q3_data.get("formateur_satisfaisant", "")
    evaluation_globale = q3_data.get("evaluation_globale") or q3_data.get("overallRating")
    recommandation = q3_data.get("recommandation", "")
    avis_formation = q3_data.get("avis_formation", "")
    
    # Analyser les réponses négatives/mitigées du Block B
    negative_responses = ["Plutôt non", "Pas du tout", "Non"]
    mitigated_responses = ["Plutôt oui", "Peut-être"]
    
    detected_issues = []
    suggested_actions = []
    has_need = False
    
    # Analyse contenu/supports
    if contenu_adapte in negative_responses:
        detected_issues.append("contenu_non_adapte")
        suggested_actions.append({
            "id": "adapter_contenu",
            "label": "Adapter les contenus et supports pédagogiques"
        })
        has_need = True
    elif contenu_adapte in mitigated_responses:
        detected_issues.append("contenu_partiellement_adapte")
    
    # Analyse rythme/durée
    if rythme_duree in negative_responses:
        detected_issues.append("rythme_inadapte")
        suggested_actions.append({
            "id": "ajuster_rythme",
            "label": "Ajuster le rythme ou la durée des séances"
        })
        has_need = True
    elif rythme_duree in mitigated_responses:
        detected_issues.append("rythme_partiellement_adapte")
    
    # Analyse formateur
    if formateur_satisfaisant in negative_responses:
        detected_issues.append("formateur_insatisfaisant")
        suggested_actions.append({
            "id": "ameliorer_accompagnement",
            "label": "Améliorer l'accompagnement pédagogique"
        })
        has_need = True
    elif formateur_satisfaisant in mitigated_responses:
        detected_issues.append("formateur_partiellement_satisfaisant")
    
    # Analyse évaluation globale (étoiles)
    try:
        stars = int(evaluation_globale) if evaluation_globale else None
    except (ValueError, TypeError):
        stars = None
    
    if stars and stars <= 2:
        detected_issues.append("evaluation_basse")
        if not any(a["id"] == "ameliorer_accompagnement" for a in suggested_actions):
            suggested_actions.append({
                "id": "revoir_dispositif",
                "label": "Revoir le dispositif de formation"
            })
        has_need = True
    
    # Analyse recommandation
    if recommandation == "Non":
        detected_issues.append("non_recommande")
        has_need = True
    
    # Analyse avis libre pour mots-clés négatifs (recherche de mots entiers)
    import re
    avis_lower = avis_formation.lower() if avis_formation else ""
    # Mots négatifs à rechercher comme mots entiers (pas de substring match)
    negative_keywords = ["difficile", "compliqué", "pas assez", "manque", "problème", "déçu", "insatisfait", "trop long", "trop court", "trop lent", "trop rapide", "ennuyeux", "incomplet"]
    for keyword in negative_keywords:
        # Recherche du mot entier avec word boundaries
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, avis_lower):
            detected_issues.append(f"avis_negatif_{keyword.replace(' ', '_')}")
            has_need = True
            break
    
    # Si pas assez d'actions suggérées mais besoin détecté
    if has_need and len(suggested_actions) == 0:
        suggested_actions.append({
            "id": "analyser_feedback",
            "label": "Analyser le feedback et adapter la formation"
        })
    
    # Ajouter des actions génériques si nécessaire
    if len(suggested_actions) < 3 and has_need:
        generic_actions = [
            {"id": "renforcer_pratique", "label": "Renforcer la mise en pratique"},
            {"id": "personnaliser", "label": "Personnaliser davantage le parcours"},
            {"id": "feedback_regulier", "label": "Mettre en place un feedback plus régulier"}
        ]
        for action in generic_actions:
            if len(suggested_actions) >= 3:
                break
            if not any(a["id"] == action["id"] for a in suggested_actions):
                suggested_actions.append(action)
    
    # Générer le rapport préliminaire
    if has_need:
        issues_text = ", ".join([i.replace("_", " ") for i in detected_issues[:3]])
        report_draft = f"Le bénéficiaire a exprimé des réserves concernant : {issues_text}.\nDes ajustements sont envisagés pour améliorer la qualité de la formation."
    else:
        report_draft = "L'apprenant est globalement satisfait de la formation.\nAucune action corrective n'est nécessaire."
    
    # Étoiles pour affichage
    stars_label = None
    if stars:
        stars_labels = {4: "Excellent", 3: "Bon", 2: "Moyen", 1: "Insatisfaisant"}
        stars_label = stars_labels.get(stars)
    
    return {
        "has_need": has_need,
        "detected_issues": detected_issues,
        "suggested_actions": suggested_actions[:6],  # Max 6 actions
        "report_draft": report_draft,
        "overall_stars": stars,
        "overall_stars_label": stars_label
    }


@api_router.post("/teachers/questionnaire-action/save")
async def save_questionnaire_action(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Enregistre l'action formateur pour un questionnaire.
    Traçabilité Qualiopi obligatoire.
    Phase 2 Simplifié: SANS niveau de besoin, avec besoin_text et actions_text.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    student_id = data.get("student_id")
    student_name = data.get("student_name")
    questionnaire_type = data.get("questionnaire_type")  # Q1, Q2, Q3
    questionnaire_id = data.get("questionnaire_id")
    keywords_internal = data.get("keywords_internal", [])  # Mots-clés internes (non affichés)
    mots_cles = data.get("mots_cles", keywords_internal)
    actions = data.get("actions", [])  # Liste des actions {key, label}
    besoin_text = data.get("besoin_text", "")  # Texte "Besoin du bénéficiaire" (figé)
    actions_text = data.get("actions_text", "")  # Texte "Actions mises en place" (figé)
    compte_rendu_final = data.get("compte_rendu_final", "")
    has_need = data.get("has_need", False)
    
    # ============ SIGNATURE (Phase 2 - Qualiopi) ============
    signature_image = data.get("signature_image")  # base64 PNG
    signed_at = data.get("signed_at")  # ISO timestamp
    signed_by = data.get("signed_by", current_user.name)  # Nom formateur
    
    # Validation: signature obligatoire si has_need est True
    if has_need and not signature_image:
        raise HTTPException(status_code=400, detail="Signature requise pour valider cette action.")
    
    # Rétrocompatibilité avec l'ancien format
    selected_keywords = data.get("selected_keywords", mots_cles)
    selected_actions = data.get("selected_actions", [a.get("label", a) if isinstance(a, dict) else a for a in actions])
    final_text = data.get("final_text", compte_rendu_final)
    
    if not all([student_id, questionnaire_type]):
        raise HTTPException(status_code=400, detail="student_id et questionnaire_type requis")
    
    # Créer l'enregistrement de traçabilité (Phase 2 avec signature)
    action_record = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "student_name": student_name,
        "questionnaire_type": questionnaire_type,
        "questionnaire_id": questionnaire_id,
        "has_need": has_need,
        # Phase 2 Simplifié: pas de niveau_besoin
        "keywords_internal": keywords_internal,  # Stocké mais non affiché dans le détail
        "mots_cles": mots_cles if mots_cles else selected_keywords,
        "actions": actions,  # Liste de {key, label}
        "besoin_text": besoin_text,  # "Le bénéficiaire a exprimé un besoin de..."
        "actions_text": actions_text,  # "Actions mises en place par le formateur..."
        "compte_rendu_final": compte_rendu_final if compte_rendu_final else final_text,
        # ============ SIGNATURE (Phase 2 - Qualiopi) ============
        "signature_image": signature_image,  # base64 PNG
        "signed_at": signed_at or datetime.now(timezone.utc).isoformat(),
        "signed_by": signed_by,
        # Anciens champs pour rétrocompatibilité
        "selected_keywords": selected_keywords if selected_keywords else mots_cles,
        "selected_actions": selected_actions,
        "final_text": final_text if final_text else compte_rendu_final,
        "teacher_id": current_user.id,
        "teacher_name": current_user.name,
        "created_by": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "validated"
    }
    
    # Vérifier si une action existe déjà pour ce questionnaire/élève
    existing = await db.questionnaire_actions.find_one({
        "student_id": student_id,
        "questionnaire_type": questionnaire_type
    })
    
    if existing:
        # Mettre à jour
        await db.questionnaire_actions.update_one(
            {"student_id": student_id, "questionnaire_type": questionnaire_type},
            {"$set": action_record}
        )
        logger.info(f"✅ Action formateur mise à jour pour {student_name} - {questionnaire_type}")
    else:
        # Créer
        await db.questionnaire_actions.insert_one(action_record)
        logger.info(f"✅ Action formateur enregistrée pour {student_name} - {questionnaire_type}")
    
    return {
        "message": "Action enregistrée avec succès",
        "action": action_record
    }


@api_router.delete("/teachers/questionnaire-action/{student_id}/{questionnaire_type}")
async def delete_questionnaire_action(
    student_id: str,
    questionnaire_type: str,
    current_user: User = Depends(get_current_user)
):
    """
    Supprime une action formateur existante pour un élève/questionnaire.
    Utile pour recréer une trace corrompue.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    if questionnaire_type not in ["Q1", "Q2", "Q3"]:
        raise HTTPException(status_code=400, detail="Type de questionnaire invalide")
    
    result = await db.questionnaire_actions.delete_many({
        "student_id": student_id,
        "questionnaire_type": questionnaire_type
    })
    
    return {
        "message": f"Action {questionnaire_type} supprimée pour l'élève {student_id}",
        "deleted_count": result.deleted_count
    }


@api_router.get("/teachers/questionnaire-actions/{student_id}")
async def get_student_questionnaire_actions(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les actions formateur enregistrées pour un élève.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    actions = await db.questionnaire_actions.find(
        {"student_id": student_id},
        {"_id": 0}
    ).to_list(10)
    
    # Organiser par type de questionnaire
    actions_by_type = {
        "Q1": None,
        "Q2": None,
        "Q3": None
    }
    
    for action in actions:
        q_type = action.get("questionnaire_type")
        if q_type in actions_by_type:
            actions_by_type[q_type] = action
    
    return actions_by_type


@api_router.get("/teachers/questionnaire-need-status/{student_id}")
async def get_questionnaire_need_status(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Analyse les questionnaires d'un élève et retourne le statut VERT/ROUGE pour chaque.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    
    parcours = student.get("parcours", "Anglais")
    
    # Récupérer les questionnaires
    if parcours == "Anglais":
        q1 = await db.formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
        q2 = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
        q3 = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    else:
        # Informatique ou autre
        q1 = await db.student_resources.find_one(
            {"student_id": student_id, "category": "QUESTIONNAIRE_QUALIOPI", "sub_type": "POSITIONNEMENT"},
            {"_id": 0}
        )
        q2 = await db.student_resources.find_one(
            {"student_id": student_id, "category": "QUESTIONNAIRE_QUALIOPI", "sub_type": "MI_PARCOURS"},
            {"_id": 0}
        )
        q3 = await db.student_resources.find_one(
            {"student_id": student_id, "category": "QUESTIONNAIRE_QUALIOPI", "sub_type": "FIN"},
            {"_id": 0}
        )
    
    # Récupérer les actions déjà enregistrées
    existing_actions = await db.questionnaire_actions.find(
        {"student_id": student_id},
        {"_id": 0}
    ).to_list(10)
    
    actions_by_type = {}
    for action in existing_actions:
        actions_by_type[action.get("questionnaire_type")] = action
    
    # Analyser chaque questionnaire
    result = {}
    
    for q_type, q_data in [("Q1", q1), ("Q2", q2), ("Q3", q3)]:
        if q_data:
            analysis = detect_need_in_questionnaire(q_data)
            existing_action = actions_by_type.get(q_type)
            
            result[q_type] = {
                "submitted": True,
                "has_need": analysis["has_need"],
                "detected_keywords": analysis["detected_keywords"],
                "reasons": analysis["reasons"],
                "action_defined": existing_action is not None,
                "action": existing_action
            }
        else:
            result[q_type] = {
                "submitted": False,
                "has_need": False,
                "detected_keywords": [],
                "reasons": [],
                "action_defined": False,
                "action": None
            }
    
    return result


@api_router.post("/sessions/bulk")
async def create_bulk_sessions(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Créer plusieurs séances pour plusieurs élèves en une seule fois"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    student_ids = data.get('student_ids', [])
    sessions_data = data.get('sessions', [])
    
    if not student_ids or not sessions_data:
        raise HTTPException(status_code=400, detail="student_ids and sessions required")
    
    created_sessions = []
    
    # Créer toutes les séances
    for student_id in student_ids:
        student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
        if not student:
            continue
        
        student_sessions = []
        for session_data in sessions_data:
            # Récupérer les créneaux horaires (time_slots) s'ils existent
            time_slots = session_data.get('time_slots', [])
            
            # Si time_slots n'existe pas, créer un seul créneau avec start_time/end_time (rétrocompatibilité)
            if not time_slots and session_data.get('start_time') and session_data.get('end_time'):
                time_slots = [{'start_time': session_data['start_time'], 'end_time': session_data['end_time']}]
            
            # Créer une séance pour chaque créneau horaire
            for time_slot in time_slots:
                # Calculate duration (arrondi à 2 décimales)
                try:
                    start_h, start_m = map(int, time_slot['start_time'].split(':'))
                    end_h, end_m = map(int, time_slot['end_time'].split(':'))
                    duration = round((end_h * 60 + end_m - start_h * 60 - start_m) / 60.0, 2)
                except:
                    duration = 0.0
                
                # Calculate deadline
                deadline = datetime.now(timezone.utc) + timedelta(hours=48)
                
                # Calculate hourly_rate and amount
                hourly_rate = session_data.get('hourly_rate')
                if hourly_rate is not None:
                    hourly_rate_source = session_data.get('hourly_rate_source', 'manual')
                else:
                    hourly_rate = infer_hourly_rate(session_data['subject'])
                    hourly_rate_source = "auto"
                
                amount = round(duration * hourly_rate, 2)
                
                # Create session
                new_session = Session(
                    subject=session_data['subject'],
                    date=session_data['date'],
                    start_time=time_slot['start_time'],
                    end_time=time_slot['end_time'],
                    student_id=student_id,
                    student_name=student['name'],
                    student_email=student['email'],
                    validation_deadline=deadline.isoformat(),
                    duration_hours=duration,
                    meeting_link=session_data.get('meeting_link', ''),
                    hourly_rate=hourly_rate,
                    hourly_rate_source=hourly_rate_source,
                    amount=amount,
                    organism=session_data.get('organism', ''),
                    modality=session_data.get('modality', 'distanciel')
                )
                
                doc = new_session.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.sessions.insert_one(doc)
                
                student_sessions.append(new_session)
                created_sessions.append(new_session)
        
        # Envoyer UN SEUL email par élève avec toutes les séances
        if student_sessions:
            portal_url = get_student_portal_url()
            
            # Créer les cartes de séances avec un beau design
            sessions_html = ""
            for s in student_sessions:
                # Formater la date
                try:
                    date_obj = datetime.strptime(s.date, "%Y-%m-%d")
                    days_fr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
                    months_fr = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
                    formatted_date = f"{days_fr[date_obj.weekday()]} {date_obj.day} {months_fr[date_obj.month]} {date_obj.year}"
                except:
                    formatted_date = s.date
                
                modality_badge = '📹 Visioconférence' if s.modality == 'distanciel' else '📍 Présentiel'
                modality_color = '#1565c0' if s.modality == 'distanciel' else '#2e7d32'
                modality_bg = '#e3f2fd' if s.modality == 'distanciel' else '#e8f5e9'
                
                sessions_html += f"""
                <div style="background-color: #ffffff; border-radius: 8px; padding: 15px; margin-bottom: 12px; border-left: 4px solid #1e3a5f; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="margin-bottom: 10px;">
                        <span style="background-color: {modality_bg}; color: {modality_color}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                            {modality_badge}
                        </span>
                    </div>
                    <h3 style="color: #1e3a5f; margin: 0 0 8px 0; font-size: 16px;">{s.subject}</h3>
                    <p style="color: #666; margin: 0; font-size: 14px;">
                        📅 <strong>{formatted_date}</strong><br>
                        🕐 <strong>{s.start_time} - {s.end_time}</strong>
                    </p>
                </div>
                """
            
            email_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header avec logo Terciform -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
            <img src="https://customer-assets.emergentagent.com/job_edutrackplus/assets/terciform_logo.png" alt="Terciform" style="height: 60px; width: auto; margin-bottom: 15px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📅 Nouvelles séances de formation</h1>
        </div>
        
        <!-- Contenu principal -->
        <div style="padding: 30px;">
            <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
                Bonjour <strong>{student['name']}</strong>,
            </p>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 25px;">
                Votre formateur a programmé <strong>{len(student_sessions)} nouvelle(s) séance(s)</strong> :
            </p>
            
            <!-- Liste des séances -->
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                {sessions_html}
            </div>
            
            <!-- Bouton CTA -->
            <div style="text-align: center; margin: 25px 0;">
                <a href="{portal_url}" 
                   style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
                    📱 Accéder à TerciLog
                </a>
            </div>
            
            <!-- Identifiant -->
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Identifiant de connexion :</p>
                <p style="margin: 5px 0; color: #666;"><strong>Identifiant :</strong> {student['email']}</p>
            </div>
            
            <!-- Avertissement -->
            <div style="background-color: #fff8e1; border-left: 4px solid #f57c00; padding: 15px; margin-top: 20px; border-radius: 0 8px 8px 0;">
                <p style="color: #e65100; margin: 0; font-size: 13px;">
                    <strong>⚠️ Important :</strong> En cas d'absence d'une séance validée, les heures de formation seront perdues.
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">Cordialement,</p>
            <p style="color: #1e3a5f; font-size: 14px; font-weight: bold; margin: 0;">Votre formateur</p>
            <p style="color: #999; font-size: 11px; margin-top: 15px;">
                Terciform - Organisme de formation professionnelle
            </p>
        </div>
        
    </div>
</body>
</html>
            """
            
            background_tasks.add_task(
                send_email,
                student['email'],
                f"📅 Nouvelles séances TerciForm - {len(student_sessions)} séance(s)",
                email_body
            )
    
    logger.info(f"Bulk sessions created: {len(created_sessions)} sessions for {len(student_ids)} students")
    return {"message": f"{len(created_sessions)} sessions created", "sessions": created_sessions}


@api_router.post("/sessions", response_model=Session)
async def create_session(session_data: SessionCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get student info
    student = await db.users.find_one({"id": session_data.student_id}, {"_id": 0})
    if not student or student['role'] != "student":
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Calculate duration (arrondi à 2 décimales)
    try:
        start_h, start_m = map(int, session_data.start_time.split(':'))
        end_h, end_m = map(int, session_data.end_time.split(':'))
        duration = round((end_h * 60 + end_m - start_h * 60 - start_m) / 60.0, 2)
    except:
        duration = 0.0
    
    # Calculate deadline
    deadline = datetime.now(timezone.utc) + timedelta(hours=session_data.validation_deadline_hours)
    
    # Calculate hourly_rate and amount (règles de tarification)
    if session_data.hourly_rate is not None:
        # Utiliser le tarif fourni (manuel)
        hourly_rate = session_data.hourly_rate
        hourly_rate_source = session_data.hourly_rate_source or "manual"
    else:
        # Calcul automatique
        hourly_rate = infer_hourly_rate(session_data.subject)
        hourly_rate_source = "auto"
    
    amount = round(duration * hourly_rate, 2)
    
    # Create session - signature_status remains "not_required" until session ends
    # The automatic script will set it to "pending" after session end time
    session = Session(
        subject=session_data.subject,
        date=session_data.date,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        student_id=session_data.student_id,
        student_name=student['name'],
        student_email=student['email'],
        validation_deadline=deadline.isoformat(),
        duration_hours=duration,
        meeting_link=session_data.meeting_link,
        hourly_rate=hourly_rate,
        hourly_rate_source=hourly_rate_source,
        amount=amount,
        organism=getattr(session_data, 'organism', ''),
        modality=session_data.modality
    )
    
    doc = session.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sessions.insert_one(doc)
    
    # Send email to student with logo and gradient design
    portal_url = get_student_portal_url()
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo et dégradé -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 Nouvelle séance programmée</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <p style="font-size: 16px;">Bonjour <strong>{student['name']}</strong>,</p>
                
                <div style="background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #065f46; font-weight: bold; font-size: 16px;">
                        ✅ Vous avez été affecté(e) à une nouvelle séance de formation.
                    </p>
                </div>
                
                <!-- Détails de la séance -->
                <div style="background-color: #e8f4fd; border-left: 4px solid #1e3a5f; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Détails de la séance :</p>
                    <p style="margin: 5px 0;"><strong>Matière :</strong> {session_data.subject}</p>
                    <p style="margin: 5px 0;"><strong>Date :</strong> {session_data.date}</p>
                    <p style="margin: 5px 0;"><strong>Horaires :</strong> {session_data.start_time} - {session_data.end_time}</p>
                </div>
                
                <p style="font-size: 15px;">Veuillez confirmer votre présence en vous connectant à la plateforme :</p>
                
                <!-- Message d'avertissement important -->
                <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="margin: 0 0 12px 0; color: #dc2626; font-weight: bold; font-size: 17px;">
                        ⚠️ IMPORTANT
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        Merci de valider votre présence en cliquant sur le bouton bleu "Confirmer" au moins <strong>48h avant la séance</strong>.
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        Sans confirmation ou demande de report dans ce délai, la séance est considérée comme acceptée.
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        <strong>Toute absence entraîne la perte des heures prévues.</strong>
                    </p>
                    <p style="margin: 0; color: #991b1b; font-size: 15px;">
                        En cas d'impossibilité, contactez votre formateur depuis votre espace personnel.
                    </p>
                </div>
                
                <!-- Bouton -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{portal_url}" style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                        🔗 Confirmer ma présence
                    </a>
                </div>
                
                <!-- Cadre identifiant -->
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Identifiant de connexion :</strong> {student['email']}</p>
                </div>
                
                <p style="margin-top: 30px; color: #333;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Envoyer l'email de confirmation à l'élève
    email_sent = send_email(student['email'], f"📅 TerciForm - Nouvelle séance : {session_data.subject}", email_body)
    
    if email_sent:
        logger.info(f"Email de confirmation envoyé à {student['email']} pour la séance {session.id}")
    else:
        logger.error(f"ÉCHEC envoi email de confirmation à {student['email']} pour la séance {session.id}")
    
    return session

@api_router.get("/sessions", response_model=List[Session])
async def get_sessions(current_user: User = Depends(get_current_user)):
    if current_user.role == "teacher":
        sessions = await db.sessions.find({}, {"_id": 0}).to_list(1000)
    else:
        sessions = await db.sessions.find({"student_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    # Enrichir chaque session avec l'organisme de l'élève si pas déjà présent
    enriched_sessions = []
    for s in sessions:
        # Si organism est vide, récupérer celui de l'élève
        if not s.get('organism') and s.get('student_id'):
            student = await db.users.find_one({"id": s['student_id']}, {"_id": 0, "organism": 1})
            if student and student.get('organism'):
                s['student_organism'] = student['organism']
        enriched_sessions.append(s)
    
    return [Session(**s) for s in enriched_sessions]

@api_router.patch("/sessions/{session_id}/validate", response_model=Session)
async def validate_session(session_id: str, validation: SessionValidate, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    session_doc = await db.sessions.find_one({"id": session_id, "student_id": current_user.id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session_doc['status'] != "pending":
        raise HTTPException(status_code=400, detail="Session already validated")
    
    validated_at = datetime.now(timezone.utc).isoformat()
    
    # Update session status - signature_status will be set by automatic script after session ends
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"status": validation.status, "validated_at": validated_at}}
    )
    
    # Note: Credit hours are now deducted only when session is signed (attendance signature)
    # Not when it's confirmed
    
    # Send email to teacher
    teacher = await db.users.find_one({"role": "teacher"}, {"_id": 0})
    if teacher:
        status_text = "acceptée" if validation.status == "confirmed" else "refusée"
        email_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1e3a5f;">Validation de séance</h2>
                <p>L'élève <strong>{current_user.name}</strong> a {status_text} la séance :</p>
                <ul>
                    <li><strong>Matière :</strong> {session_doc['subject']}</li>
                    <li><strong>Date :</strong> {session_doc['date']}</li>
                    <li><strong>Horaire :</strong> {session_doc['start_time']} - {session_doc['end_time']}</li>
                    <li><strong>Heure de validation :</strong> {datetime.fromisoformat(validated_at).strftime('%d/%m/%Y à %H:%M:%S')}</li>
                </ul>
            </div>
        </body>
        </html>
        """
        send_email(teacher['email'], f"Validation de séance - {current_user.name}", email_body)
    
    session_doc['status'] = validation.status
    session_doc['validated_at'] = validated_at
    return Session(**session_doc)

@api_router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.sessions.delete_one({"id": session_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted"}

@api_router.patch("/sessions/{session_id}/confirm-presence")
async def confirm_presence(session_id: str, current_user: User = Depends(get_current_user)):
    """Confirmer sa présence à une séance (élève) - ancien endpoint pour validation par prof"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la séance
    session_doc = await db.sessions.find_one({"id": session_id, "student_id": current_user.id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Vérifier si déjà confirmé
    if session_doc.get('confirmation_status') == 'confirmed':
        raise HTTPException(status_code=400, detail="Présence déjà confirmée")
    
    # Confirmer la présence
    confirmation_at = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {
            "confirmation_status": "confirmed",
            "confirmation_at": confirmation_at
        }}
    )
    
    logger.info(f"Student {current_user.id} confirmed presence for session {session_id}")
    
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    return Session(**session_doc)


@api_router.patch("/sessions/{session_id}/confirm-by-student")
async def confirm_by_student(session_id: str, current_user: User = Depends(get_current_user)):
    """Confirmer la séance par l'élève (avant émargement)"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la séance
    session_doc = await db.sessions.find_one({"id": session_id, "student_id": current_user.id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Vérifier si déjà confirmé
    if session_doc.get('confirmed_by_student'):
        raise HTTPException(status_code=400, detail="Séance déjà confirmée")
    
    # Confirmer la séance
    confirmed_at = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {
            "confirmed_by_student": True,
            "confirmed_by_student_at": confirmed_at,
            "status": "confirmed"  # Confirmer aussi le statut général
        }}
    )
    
    logger.info(f"Student {current_user.id} confirmed session {session_id}")
    
    # Logger la confirmation (traçabilité Qualiopi)
    await log_student_activity(
        student_id=current_user.id,
        student_name=current_user.name,
        action="session_confirm",
        details={
            "session_id": session_id,
            "subject": session_doc.get("subject", ""),
            "date": session_doc.get("date", ""),
            "start_time": session_doc.get("start_time", ""),
            "end_time": session_doc.get("end_time", "")
        }
    )
    
    # Envoyer un email au professeur pour notifier la confirmation
    try:
        send_student_confirmed_email(
            student_name=current_user.name,
            subject=session_doc.get('subject', 'Non spécifié'),
            date=session_doc.get('date', ''),
            start_time=session_doc.get('start_time', ''),
            end_time=session_doc.get('end_time', '')
        )
    except Exception as e:
        logger.error(f"Erreur envoi email de confirmation au professeur: {e}")
    
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    return Session(**session_doc)


@api_router.post("/sessions/{session_id}/sign")
async def sign_session(session_id: str, signature_data: dict, current_user: User = Depends(get_current_user)):
    """Enregistrer la signature d'un élève pour une séance"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la séance
    session_doc = await db.sessions.find_one({"id": session_id, "student_id": current_user.id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Auto-confirmer si pas encore confirmé
    signed_at = datetime.now(timezone.utc).isoformat()
    update_fields = {
        "signature": signature_data.get("signature"),
        "signed_at": signed_at,
        "signature_status": "signed"
    }
    
    # Si l'élève signe sans avoir confirmé, on confirme automatiquement
    if not session_doc.get('confirmed_by_student'):
        update_fields["confirmed_by_student"] = True
        update_fields["confirmed_by_student_at"] = signed_at
        logger.info(f"Auto-confirming session {session_id} during signature")
    
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": update_fields}
    )
    
    # Déduire les heures du crédit de l'élève (maintenant que la séance est émargée)
    duration_hours = session_doc.get('duration_hours', 0)
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"credit_hours": -duration_hours}}
    )
    
    logger.info(f"Student {current_user.id} signed session {session_id}. Deducted {duration_hours}h from credit.")
    
    # Logger l'émargement (traçabilité Qualiopi)
    await log_student_activity(
        student_id=current_user.id,
        student_name=current_user.name,
        action="signature",
        details={
            "session_id": session_id,
            "subject": session_doc.get("subject", ""),
            "date": session_doc.get("date", ""),
            "start_time": session_doc.get("start_time", ""),
            "end_time": session_doc.get("end_time", ""),
            "duration_hours": duration_hours
        }
    )
    
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    return Session(**session_doc)

@api_router.patch("/sessions/{session_id}/teacher-sign")
async def teacher_sign_session(session_id: str, signature_data: dict, current_user: User = Depends(get_current_user)):
    """Enregistrer la signature du formateur pour une séance"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la séance
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Vérifier si déjà signé
    if session_doc.get('teacher_signature_status') == 'signed':
        raise HTTPException(status_code=400, detail="Teacher already signed this session")
    
    # Enregistrer la signature formateur
    teacher_signed_at = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {
            "teacher_signature": signature_data.get("signature"),
            "teacher_signed_at": teacher_signed_at,
            "teacher_signature_status": "signed"
        }}
    )
    
    logger.info(f"Teacher {current_user.id} signed session {session_id}")
    
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    return Session(**session_doc)



@api_router.put("/sessions/{session_id}")
async def update_session(session_id: str, data: dict, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Mettre à jour une séance (ex: ajouter un lien visio)"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que la séance existe
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Détecter si date ou horaires changent (pour envoi email)
    date_or_time_changed = False
    old_date = session_doc.get("date")
    old_start_time = session_doc.get("start_time")
    old_end_time = session_doc.get("end_time")
    
    if "date" in data and data["date"] != old_date:
        date_or_time_changed = True
    if "start_time" in data and data["start_time"] != old_start_time:
        date_or_time_changed = True
    if "end_time" in data and data["end_time"] != old_end_time:
        date_or_time_changed = True
    
    # Préparer les données de mise à jour
    update_data = {}
    if "meeting_link" in data:
        update_data["meeting_link"] = data["meeting_link"]
    if "subject" in data:
        update_data["subject"] = data["subject"]
    if "date" in data:
        update_data["date"] = data["date"]
    if "start_time" in data:
        update_data["start_time"] = data["start_time"]
    if "end_time" in data:
        update_data["end_time"] = data["end_time"]
    if "signature_status" in data:
        update_data["signature_status"] = data["signature_status"]
    if "attendance_email_sent" in data:
        update_data["attendance_email_sent"] = data["attendance_email_sent"]
    if "organism" in data:
        update_data["organism"] = data["organism"]
    if "hourly_rate" in data:
        update_data["hourly_rate"] = data["hourly_rate"]
        # Recalculer amount si hourly_rate change
        if session_doc.get('duration_hours'):
            update_data["amount"] = round(session_doc['duration_hours'] * data["hourly_rate"], 2)
    if "hourly_rate_source" in data:
        update_data["hourly_rate_source"] = data["hourly_rate_source"]
    if "modality" in data:
        update_data["modality"] = data["modality"]
    
    # Mettre à jour la séance
    await db.sessions.update_one({"id": session_id}, {"$set": update_data})
    
    # Si date ou horaires ont changé, réinitialiser la confirmation élève
    if date_or_time_changed:
        await db.sessions.update_one({"id": session_id}, {"$set": {
            "confirmed_by_student": False,
            "confirmed_by_student_at": None
        }})
        logger.info(f"Confirmation élève réinitialisée pour la séance {session_id} (date/heure modifiée)")
    
    # Récupérer la séance mise à jour
    updated_session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    
    # Envoyer email si date ou horaires ont changé
    if date_or_time_changed:
        student_id = session_doc.get("student_id")
        if student_id:
            student = await db.users.find_one({"id": student_id}, {"_id": 0})
            if student and student.get("email"):
                # Envoyer l'email en arrière-plan
                background_tasks.add_task(
                    send_session_modified_email,
                    student["email"],
                    student.get("name", ""),
                    updated_session.get("subject", ""),
                    updated_session.get("date", ""),
                    updated_session.get("start_time", ""),
                    updated_session.get("end_time", "")
                )
                logger.info(f"Email de modification de séance programmé pour {student['email']}")
                
                # Logger l'envoi de l'email de modification dans l'historique
                await log_student_activity(
                    student_id=student["id"],
                    student_name=student.get("name", ""),
                    action="email_session_modified",
                    details={
                        "session_id": session_id,
                        "subject": updated_session.get("subject", ""),
                        "date": updated_session.get("date", ""),
                        "start_time": updated_session.get("start_time", ""),
                        "end_time": updated_session.get("end_time", "")
                    },
                    actor="teacher"
                )
    
    return Session(**updated_session)


@api_router.post("/sessions/{session_id}/resend-email")
async def resend_session_email(session_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    student = await db.users.find_one({"id": session_doc['student_id']}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    portal_url = get_student_portal_url()
    
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header avec logo et dégradé -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                <img src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="TerciForm" style="max-height: 60px; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 Rappel de séance</h1>
            </div>
            
            <!-- Contenu -->
            <div style="padding: 30px;">
                <p style="font-size: 16px;">Bonjour <strong>{student['name']}</strong>,</p>
                
                <p><strong>Vous avez été affecté(e) à la séance {session_doc['subject']} du {session_doc['date']} de {session_doc['start_time']} à {session_doc['end_time']}.</strong></p>
                
                <p>Veuillez confirmer votre présence en vous connectant à la plateforme :</p>
                
                <!-- Message d'avertissement important -->
                <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="margin: 0 0 12px 0; color: #dc2626; font-weight: bold; font-size: 17px;">
                        ⚠️ IMPORTANT
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        Merci de valider votre présence en cliquant sur le bouton bleu "Confirmer" au moins <strong>48h avant la séance</strong>.
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        Sans confirmation ou demande de report dans ce délai, la séance est considérée comme acceptée.
                    </p>
                    <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 15px;">
                        <strong>Toute absence entraîne la perte des heures prévues.</strong>
                    </p>
                    <p style="margin: 0; color: #991b1b; font-size: 15px;">
                        En cas d'impossibilité, contactez votre formateur depuis votre espace personnel.
                    </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{portal_url}" style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                        🔗 Accéder à mon espace
                    </a>
                </div>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Identifiant de connexion :</strong> {student['email']}</p>
                </div>
                
                <p style="margin-top: 30px; color: #333;">
                    Cordialement,<br>
                    <strong>L'équipe TerciForm</strong>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Cet email a été envoyé automatiquement par TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    send_email(student['email'], f"📅 TerciForm - Rappel séance : {session_doc['subject']}", email_body)
    
    return {"message": "Email resent"}


@api_router.post("/sessions/{session_id}/resend-attendance-email")
async def resend_attendance_email(session_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Envoyer l'email d'émargement
    email_sent = send_attendance_email(
        session_doc['student_email'],
        session_doc['student_name'],
        session_doc['subject'],
        session_doc['date'],
        session_doc['start_time'],
        session_doc['end_time']
    )
    
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send email")
    
    # Update session to mark email as sent and set signature status to pending (élève + formateur)
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {
            "attendance_email_sent": True,
            "signature_status": "pending",
            "teacher_signature_status": "pending"
        }}
    )
    
    return {"message": "Attendance email resent"}


@api_router.post("/sessions/fix-signature-status")
async def fix_signature_status(current_user: User = Depends(get_current_user)):
    """ENDPOINT D'URGENCE: Corriger toutes les séances avec signature mais status pending"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Trouver toutes les séances avec signature mais status pending
    problem_sessions = await db.sessions.find({
        "signature": {"$exists": True, "$ne": None},
        "signature_status": "pending"
    }).to_list(length=None)
    
    fixed_count = 0
    for session in problem_sessions:
        await db.sessions.update_one(
            {"id": session["id"]},
            {"$set": {"signature_status": "signed"}}
        )


@api_router.post("/sessions/activate-all-emargements")
async def activate_all_emargements(current_user: User = Depends(get_current_user)):
    """ENDPOINT D'URGENCE: Activer l'émargement pour TOUTES les séances"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mettre à jour TOUTES les séances avec signature_status = not_required vers pending
    result = await db.sessions.update_many(
        {"signature_status": "not_required"},
        {"$set": {
            "signature_status": "pending",
            "attendance_email_sent": True,
            "signature_deadline": (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
        }}
    )
    
    return {
        "message": f"{result.modified_count} séances activées pour émargement",
        "modified_count": result.modified_count
    }



@api_router.post("/sessions/normalize-hourly-rate")
async def normalize_hourly_rate(month: str = None, current_user: User = Depends(get_current_user)):
    """Normaliser les tarifs horaires pour les séances sans prix"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Filtrer par mois si fourni
    query = {}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    # Trouver les séances sans hourly_rate
    sessions = await db.sessions.find({
        **query,
        "$or": [
            {"hourly_rate": {"$exists": False}},
            {"hourly_rate": None},
            {"hourly_rate": 0}
        ]
    }).to_list(1000)
    
    count = 0
    for session_doc in sessions:
        # Calculer le tarif suggéré
        hourly_rate = infer_hourly_rate(session_doc['subject'])
        duration = session_doc.get('duration_hours', 0)
        amount = round(duration * hourly_rate, 2)
        
        # Mettre à jour
        await db.sessions.update_one(
            {"id": session_doc['id']},
            {"$set": {
                "hourly_rate": hourly_rate,
                "hourly_rate_source": "auto",
                "amount": amount
            }}
        )
        count += 1
    
    return {"message": f"{count} séance(s) normalisée(s)", "count": count}


@api_router.put("/students/{student_id}")
async def update_student(student_id: str, data: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'élève existe
    student = await db.users.find_one({"id": student_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Préparer les données de mise à jour
    update_data = {}
    if "name" in data:
        update_data["name"] = data["name"]
    if "email" in data:
        # Permettre plusieurs élèves avec le même email (pas de vérification)
        update_data["email"] = data["email"]
    if "phone" in data:
        update_data["phone"] = data["phone"]
    if "organism" in data:
        update_data["organism"] = data["organism"]
    if "support_type" in data:
        update_data["support_type"] = data["support_type"]
    if "session_type" in data:
        update_data["session_type"] = data["session_type"]
    if "start_date" in data:
        update_data["start_date"] = data["start_date"]
    if "end_date" in data:
        update_data["end_date"] = data["end_date"]
    if "total_hours" in data:
        update_data["total_hours"] = data["total_hours"]
    if "credit_hours" in data:
        update_data["credit_hours"] = data["credit_hours"]
    if "password" in data and data["password"]:
        # Hasher le nouveau mot de passe
        update_data["password_hash"] = pwd_context.hash(data["password"])
    
    # Champs du formateur
    if "teacher_name" in data:
        update_data["teacher_name"] = data["teacher_name"]
    if "teacher_email" in data:
        update_data["teacher_email"] = data["teacher_email"]
    if "teacher_phone" in data:
        update_data["teacher_phone"] = data["teacher_phone"]
    if "profile_picture" in data:
        update_data["profile_picture"] = data["profile_picture"]
    
    # Champs de l'adresse de formation
    if "formation_address" in data:
        update_data["formation_address"] = data["formation_address"]
    if "formation_building" in data:
        update_data["formation_building"] = data["formation_building"]
    if "formation_street_number" in data:
        update_data["formation_street_number"] = data["formation_street_number"]
    if "formation_street" in data:
        update_data["formation_street"] = data["formation_street"]
    if "formation_postal_code" in data:
        update_data["formation_postal_code"] = data["formation_postal_code"]
    if "formation_city" in data:
        update_data["formation_city"] = data["formation_city"]
    if "formation_country" in data:
        update_data["formation_country"] = data["formation_country"]
    if "formation_transports" in data:
        update_data["formation_transports"] = data["formation_transports"]
    
    # Mettre à jour l'élève
    await db.users.update_one({"id": student_id}, {"$set": update_data})
    
    # Récupérer l'élève mis à jour
    updated_student = await db.users.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    return User(**updated_student)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Supprimer l'élève
    result = await db.users.delete_one({"id": student_id, "role": "student"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Supprimer toutes les séances de cet élève
    await db.sessions.delete_many({"student_id": student_id})
    
    return {"message": "Student deleted"}


@api_router.post("/sessions/check-attendance-emails")
async def check_and_send_attendance_emails():
    """Vérifier les séances terminées et envoyer les emails d'émargement"""
    now = datetime.now(timezone.utc)
    
    # Récupérer toutes les séances confirmées qui n'ont pas encore reçu d'email d'émargement
    sessions = await db.sessions.find({
        "status": "confirmed",
        "attendance_email_sent": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    emails_sent = 0
    for session_doc in sessions:
        try:
            # Construire la date et heure de fin de séance
            session_datetime_str = f"{session_doc['date']}T{session_doc['end_time']}:00"
            session_end = datetime.fromisoformat(session_datetime_str)
            
            # Make session_end timezone-aware (assume UTC if no timezone)
            if session_end.tzinfo is None:
                session_end = session_end.replace(tzinfo=timezone.utc)
            
            # Si la séance est terminée (heure actuelle > heure de fin)
            if now > session_end:
                # Calculer le délai de 2 heures
                signature_deadline = session_end + timedelta(hours=2)
                
                # Envoyer l'email d'émargement
                email_sent = send_attendance_email(
                    session_doc['student_email'],
                    session_doc['student_name'],
                    session_doc['subject'],
                    session_doc['date'],
                    session_doc['start_time'],
                    session_doc['end_time']
                )
                
                if email_sent:
                    # Marquer l'email comme envoyé et mettre à jour le statut de signature
                    # Élève: pending, Formateur: pending aussi
                    await db.sessions.update_one(
                        {"id": session_doc['id']},
                        {"$set": {
                            "attendance_email_sent": True,
                            "signature_status": "pending",
                            "signature_deadline": signature_deadline.isoformat(),
                            "teacher_signature_status": "pending"
                        }}
                    )
                    emails_sent += 1
                    logger.info(f"Attendance email sent for session {session_doc['id']}")
        except Exception as e:
            logger.error(f"Error processing session {session_doc.get('id')}: {e}")
            continue
    
    return {"message": f"{emails_sent} attendance emails sent"}

@api_router.get("/sessions/stats")
async def get_stats(current_user: User = Depends(get_current_user), month: Optional[str] = None):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    


@api_router.post("/sessions/fix-durations")
async def fix_session_durations(current_user: User = Depends(get_current_user)):
    """
    Recalculer et corriger les durées de toutes les séances.
    Corrige les erreurs comme 1.25h pour une séance de 10:00-11:00 (devrait être 1h).
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        sessions = await db.sessions.find({}, {"_id": 0}).to_list(10000)
        fixed_count = 0
        
        for session in sessions:
            start_time = session.get('start_time', '00:00')
            end_time = session.get('end_time', '00:00')
            stored_duration = session.get('duration_hours', 0)
            
            try:
                start = start_time.split(':')
                end = end_time.split(':')
                start_mins = int(start[0]) * 60 + int(start[1])
                end_mins = int(end[0]) * 60 + int(end[1])
                correct_duration = round((end_mins - start_mins) / 60.0, 2)
                
                # Si la durée stockée est différente de la durée calculée
                if abs(correct_duration - stored_duration) > 0.01:
                    # Recalculer le montant aussi
                    hourly_rate = session.get('hourly_rate', 0)
                    new_amount = round(correct_duration * hourly_rate, 2)
                    
                    await db.sessions.update_one(
                        {"id": session['id']},
                        {"$set": {
                            "duration_hours": correct_duration,
                            "amount": new_amount
                        }}
                    )
                    fixed_count += 1
                    logger.info(f"Fixed duration for session {session['id']}: {stored_duration}h -> {correct_duration}h")
            except Exception as e:
                logger.error(f"Error fixing session {session.get('id')}: {e}")
                continue
        
        return {
            "message": f"{fixed_count} séance(s) corrigée(s)",
            "total_checked": len(sessions),
            "fixed_count": fixed_count
        }
    except Exception as e:
        logger.error(f"Error fixing session durations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/sessions/send-30min-reminders")
async def send_30min_reminders(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Endpoint pour forcer l'envoi des rappels 15 minutes avant les séances.
    Accessible uniquement aux enseignants.
    """
    try:
        # Vérifier que c'est un enseignant
        user = await get_current_user(credentials)
        if user.get("role") != "teacher":
            raise HTTPException(status_code=403, detail="Accès réservé aux enseignants")
        
        await send_session_reminders()
        return {"message": "Vérification des rappels 15 minutes effectuée avec succès"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi des rappels: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/sessions/check-session-reminders")
async def check_and_send_session_reminders():
    """Vérifier les séances qui commencent dans 5 minutes et envoyer les rappels (ancien système)"""
    now = datetime.now(timezone.utc)
    
    # Récupérer toutes les séances confirmées qui n'ont pas encore commencé
    sessions = await db.sessions.find({
        "status": "confirmed",
        "reminder_email_sent": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    emails_sent = 0
    for session_doc in sessions:
        try:
            # Construire la date et heure de début de séance
            session_datetime_str = f"{session_doc['date']}T{session_doc['start_time']}:00"
            session_start = datetime.fromisoformat(session_datetime_str)
            
            # Make session_start timezone-aware (assume UTC if no timezone)
            if session_start.tzinfo is None:
                session_start = session_start.replace(tzinfo=timezone.utc)
            
            # Calculer le temps restant avant le début
            time_until_start = (session_start - now).total_seconds() / 60  # en minutes
            
            # Si la séance commence dans moins de 5 minutes et plus de 0 minutes
            if 0 < time_until_start <= 5:
                logger.info(f"Session {session_doc['id']} starts in {time_until_start:.1f} minutes. Sending reminder...")
                
                # Envoyer l'email de rappel
                email_sent = send_session_reminder_email(
                    session_doc['student_email'],
                    session_doc['student_name'],
                    session_doc['subject'],
                    session_doc['date'],
                    session_doc['start_time'],
                    session_doc['end_time'],
                    session_doc.get('meeting_link', '')
                )
                
                if email_sent:
                    # Marquer l'email comme envoyé
                    await db.sessions.update_one(
                        {"id": session_doc['id']},
                        {"$set": {"reminder_email_sent": True}}
                    )
                    emails_sent += 1
                    logger.info(f"Reminder email sent for session {session_doc['id']}")
        except Exception as e:
            logger.error(f"Error processing session {session_doc.get('id')}: {e}")
            continue
    
    return {"message": f"{emails_sent} reminder emails sent"}


def build_header(title: str):
    """Construire l'en-tête avec logo + titre (Flowable Table)"""
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('TitleStyle', parent=styles['Normal'], fontSize=16, fontName='Helvetica-Bold', alignment=2)
    
    logo_path = ROOT_DIR / 'assets' / 'logo_terciform.png'
    
    if logo_path.exists():
        # Charger l'image pour obtenir ses dimensions
        pil_img = PILImage.open(str(logo_path))
        original_width, original_height = pil_img.size
        
        # Contraintes: max-height=50px, conserver ratio
        max_height = 50
        
        # Calculer le ratio de redimensionnement
        ratio = max_height / original_height
        new_width = original_width * ratio
        new_height = max_height
        
        logo = Image(str(logo_path), width=new_width, height=new_height)
    else:
        logo = Paragraph("TERCIFORM", ParagraphStyle('LogoText', parent=styles['Normal'], fontSize=20, fontName='Helvetica-Bold', textColor=colors.HexColor('#223B67')))
    
    title_paragraph = Paragraph(title, title_style)
    
    header_data = [[logo, title_paragraph]]
    header_table = Table(header_data, colWidths=[3*inch, 3*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (1, 0), (1, 0), 0),
    ]))
    
    return header_table


def generate_student_planning_pdf(student: dict, sessions: list, month: str, month_label: str):
    """Générer un PDF du planning de l'élève pour TOUT le parcours avec signatures si disponibles"""
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        rightMargin=36,
        leftMargin=36, 
        topMargin=72,
        bottomMargin=54
    )
    
    # Styles
    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=9)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=9, leading=11, wordWrap='CJK')
    signature_style = ParagraphStyle('SignatureStyle', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#065f46'))
    
    story = []
    
    # En-tête avec logo et titre
    story.append(build_header(f"Planning de formation - {student['name']}"))
    story.append(Spacer(0, 12))
    
    # Informations élève (sans Heures restantes)
    info_data = [
        ['Nom', student.get('name', '')],
        ['Email', student.get('email', '')],
        ['Téléphone', student.get('phone', 'N/A')],
        ['Période', f"{student.get('start_date', 'N/A')} → {student.get('end_date', 'N/A')}"],
        ['Heures totales', f"{student.get('total_hours', 0)}h"],
    ]
    
    info_table = Table(info_data, colWidths=[1.3*inch, 4.2*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8f0f7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#223B67')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D7DEE5')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(info_table)
    story.append(Spacer(0, 12))
    
    # Séances
    if sessions:
        sessions_sorted = sorted(sessions, key=lambda s: s.get('date', ''))
        total_hours = sum(s.get('duration_hours', 0) for s in sessions_sorted)
        
        # Compter les séances signées
        signed_count = sum(1 for s in sessions_sorted if s.get('signature_status') == 'signed')
        signed_hours = sum(s.get('duration_hours', 0) for s in sessions_sorted if s.get('signature_status') == 'signed')
        
        # Texte de résumé
        if signed_count == 0:
            summary_text = f"Parcours complet : {len(sessions_sorted)} séance(s) — {total_hours}h"
        elif signed_count == len(sessions_sorted):
            summary_text = f"Parcours complet émargé : {len(sessions_sorted)} séance(s) — {total_hours}h (toutes signées)"
        else:
            summary_text = f"Parcours : {len(sessions_sorted)} séance(s) — {total_hours}h dont {signed_count} émargée(s) ({signed_hours}h)"
        
        story.append(Paragraph(summary_text, bold_style))
        story.append(Spacer(0, 8))
        
        # Mapping
        status_fr = {'pending': 'En attente', 'confirmed': 'Confirmée', 'rejected': 'Refusée'}
        
        # Vérifier s'il y a des signatures pour ajouter les colonnes
        has_any_signature = any(s.get('signature') or s.get('teacher_signature') for s in sessions_sorted)
        
        if has_any_signature:
            # Colonnes avec signatures: Date 14% | Matière 26% | Horaires 12% | Durée 8% | Statut 14% | Élève 13% | Formateur 13%
            col_widths = [
                0.14 * doc.width,
                0.26 * doc.width,
                0.12 * doc.width,
                0.08 * doc.width,
                0.14 * doc.width,
                0.13 * doc.width,
                0.13 * doc.width
            ]
            
            header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', textColor=colors.white)
            
            table_data = [[
                Paragraph('Date', header_style),
                Paragraph('Matière', header_style),
                Paragraph('Horaires', header_style),
                Paragraph('Durée', header_style),
                Paragraph('Statut', header_style),
                Paragraph('Élève', header_style),
                Paragraph('Formateur', header_style)
            ]]
            
            for session in sessions_sorted:
                # Date FR
                date_formatted = format_fr_date(session.get('date', ''))
                
                # Matière
                matiere = Paragraph(session.get('subject', ''), cell_style)
                
                # Horaires
                horaires = f"{session.get('start_time', '')} - {session.get('end_time', '')}"
                duree = f"{session.get('duration_hours', 0)}h"
                
                # Statut
                statut = status_fr.get(session.get('status', ''), session.get('status', ''))
                statut_paragraph = Paragraph(statut, cell_style)
                
                # Signature élève
                student_sig_content = []
                if session.get('signature'):
                    try:
                        sig_data = session['signature']
                        if sig_data.startswith('data:image'):
                            sig_data = sig_data.split(',')[1]
                        sig_bytes = base64.b64decode(sig_data)
                        sig_img = PILImage.open(io.BytesIO(sig_bytes))
                        sig_img.thumbnail((60, 25))
                        img_buffer = io.BytesIO()
                        sig_img.save(img_buffer, format='PNG')
                        img_buffer.seek(0)
                        student_sig_content.append(Image(img_buffer, width=60, height=25))
                        if session.get('signed_at'):
                            try:
                                signed_dt = datetime.fromisoformat(session['signed_at'].replace('Z', '+00:00'))
                                student_sig_content.append(Paragraph(f"{signed_dt.strftime('%d/%m %H:%M')}", signature_style))
                            except:
                                pass
                    except Exception as e:
                        student_sig_content.append(Paragraph("✓ Signé", signature_style))
                else:
                    student_sig_content.append(Paragraph("-", cell_style))
                
                # Signature formateur
                teacher_sig_content = []
                if session.get('teacher_signature'):
                    try:
                        sig_data = session['teacher_signature']
                        if sig_data.startswith('data:image'):
                            sig_data = sig_data.split(',')[1]
                        sig_bytes = base64.b64decode(sig_data)
                        sig_img = PILImage.open(io.BytesIO(sig_bytes))
                        sig_img.thumbnail((60, 25))
                        img_buffer = io.BytesIO()
                        sig_img.save(img_buffer, format='PNG')
                        img_buffer.seek(0)
                        teacher_sig_content.append(Image(img_buffer, width=60, height=25))
                        if session.get('teacher_signed_at'):
                            try:
                                signed_dt = datetime.fromisoformat(session['teacher_signed_at'].replace('Z', '+00:00'))
                                teacher_sig_content.append(Paragraph(f"{signed_dt.strftime('%d/%m %H:%M')}", signature_style))
                            except:
                                pass
                    except Exception as e:
                        teacher_sig_content.append(Paragraph("✓ Signé", signature_style))
                else:
                    teacher_sig_content.append(Paragraph("-", cell_style))
                
                table_data.append([
                    Paragraph(date_formatted, cell_style),
                    matiere,
                    Paragraph(horaires, cell_style),
                    Paragraph(duree, cell_style),
                    statut_paragraph,
                    student_sig_content if len(student_sig_content) == 1 else student_sig_content,
                    teacher_sig_content if len(teacher_sig_content) == 1 else teacher_sig_content
                ])
            
            # Ligne Totaux
            totals_style = ParagraphStyle('TotalsStyle', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold')
            table_data.append([
                Paragraph('TOTAUX', totals_style),
                '',
                '',
                Paragraph(f'{total_hours}h', totals_style),
                Paragraph(f'{len(sessions_sorted)} séance(s)', totals_style),
                Paragraph(f'{signed_count} signée(s)', totals_style),
                ''
            ])
            
        else:
            # Colonnes sans signatures: Date 18% | Matière 38% | Horaires 14% | Durée 10% | Statut 20%
            col_widths = [
                0.18 * doc.width,
                0.38 * doc.width,
                0.14 * doc.width,
                0.10 * doc.width,
                0.20 * doc.width
            ]
            
            header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold', textColor=colors.white)
            
            table_data = [[
                Paragraph('Date', header_style),
                Paragraph('Matière', header_style),
                Paragraph('Horaires', header_style),
                Paragraph('Durée', header_style),
                Paragraph('Statut', header_style)
            ]]
            
            for session in sessions_sorted:
                # Date FR
                date_formatted = format_fr_date(session.get('date', ''))
                
                # Matière
                matiere = Paragraph(session.get('subject', ''), cell_style)
                
                # Horaires
                horaires = f"{session.get('start_time', '')} - {session.get('end_time', '')}"
                duree = f"{session.get('duration_hours', 0)}h"
                
                # Statut
                statut = status_fr.get(session.get('status', ''), session.get('status', ''))
                statut_paragraph = Paragraph(statut, cell_style)
                
                table_data.append([
                    Paragraph(date_formatted, cell_style),
                    matiere,
                    Paragraph(horaires, cell_style),
                    Paragraph(duree, cell_style),
                    statut_paragraph
                ])
            
            # Ligne Totaux
            totals_style = ParagraphStyle('TotalsStyle', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold')
            table_data.append([
                Paragraph('TOTAUX', totals_style),
                '',
                '',
                Paragraph(f'{total_hours}h', totals_style),
                Paragraph(f'{len(sessions_sorted)} séance(s)', totals_style)
            ])
        
        sessions_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        sessions_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D7DEE5')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#223B67')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9f9f9')]),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f0f7')),
        ]))
        story.append(sessions_table)
    else:
        story.append(Paragraph("Aucune séance programmée", normal_style))
    
    # Footer avec numéro de page
    def add_page_number(canvas, doc):
        canvas.saveState()
        footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
        page_num = canvas.getPageNumber()
        text = f"Page {page_num}"
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0]/2, 30, text)
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer


def generate_attendance_pdf_single_session(session: dict) -> io.BytesIO:
    """Générer un PDF de justificatif d'émargement pour une séance unique"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=72, bottomMargin=54)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#1e3a5f'), spaceAfter=10, alignment=1, fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#666666'), spaceAfter=10, fontName='Helvetica-Bold')
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    italic_style = ParagraphStyle('Italic', parent=styles['Normal'], fontSize=9, textColor=colors.grey, fontName='Helvetica-Oblique')
    warning_style = ParagraphStyle('Warning', parent=styles['Normal'], textColor=colors.red)
    
    story = []
    
    # En-tête
    story.append(build_header("JUSTIFICATIF D'ÉMARGEMENT"))
    story.append(Spacer(0, 12))
    
    # Informations de la séance
    days_fr = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
    
    # Format date FR
    date_formatted = session.get('date', 'N/A')
    try:
        date_obj = datetime.strptime(session.get('date', ''), '%Y-%m-%d')
        day_abbr_fr = days_fr.get(date_obj.strftime('%a'), date_obj.strftime('%a'))
        date_formatted = f"{day_abbr_fr} {date_obj.strftime('%d/%m/%Y')}"
    except:
        pass
    
    session_data = [
        ['Matière:', session.get('subject', 'N/A')],
        ['Date:', date_formatted],
        ['Horaires:', f"{session.get('start_time', '')} - {session.get('end_time', '')}"],
        ['Durée:', f"{session.get('duration_hours', 0)}h"],
        ['Élève:', session.get('student_name', 'N/A')],
        ['Type:', 'Distanciel' if session.get('meeting_link', '') else 'Présentiel'],
    ]
    
    session_table = Table(session_data, colWidths=[1.5*inch, 4.5*inch])
    session_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8f0f7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e3a5f')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(session_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Bloc Signature Élève
    story.append(Paragraph("SIGNATURE ÉLÈVE", subtitle_style))
    if session.get('signature') and session.get('signed_at'):
        signed_date = datetime.fromisoformat(session['signed_at']).strftime('%d/%m/%Y %H:%M')
        story.append(Paragraph(f"✓ Émargé le {signed_date}", normal_style))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph("Signature numérique présente (voir version électronique)", italic_style))
    else:
        story.append(Paragraph("⚠️ Non signé", warning_style))
    
    story.append(Spacer(1, 0.2*inch))
    
    # Bloc Signature Formateur
    story.append(Paragraph("SIGNATURE FORMATEUR", subtitle_style))
    if session.get('teacher_signature') and session.get('teacher_signed_at'):
        signed_date = datetime.fromisoformat(session['teacher_signed_at']).strftime('%d/%m/%Y %H:%M')
        story.append(Paragraph(f"✓ Émargé le {signed_date}", normal_style))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph("Signature numérique présente (voir version électronique)", italic_style))
    else:
        story.append(Paragraph("⚠️ Non signé", warning_style))
    
    story.append(Spacer(1, 0.3*inch))
    
    # Footer avec numéro de page
    def add_page_number(canvas, doc):
        canvas.saveState()
        # Generation time
        generation_time = datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')
        canvas.setFont('Helvetica-Oblique', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawRightString(A4[0] - 36, 30, f"Document généré le {generation_time} (UTC)")
        # Page number
        page_num = canvas.getPageNumber()
        canvas.setFont('Helvetica', 8)
        canvas.drawCentredString(A4[0]/2, 30, f"Page {page_num}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer


def generate_attendance_pdf_month(student: dict, sessions: list, month: str, include_unsigned: bool = False) -> io.BytesIO:
    """Générer un PDF de justificatifs d'émargement pour TOUT le parcours"""
    import base64
    
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        rightMargin=36,
        leftMargin=36, 
        topMargin=72,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=9)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=9, leading=11, wordWrap='CJK')
    small_style = ParagraphStyle('SmallStyle', parent=styles['Normal'], fontSize=7, textColor=colors.grey)
    
    story = []
    
    # En-tête
    story.append(build_header(f"Parcours émargé — {student['name']}"))
    story.append(Spacer(0, 12))
    
    # Sous-titre pour parcours complet (month=None)
    if month is None:
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold', textColor=colors.HexColor('#8B5A2B'))
        story.append(Paragraph("PARCOURS COMPLET — Toutes périodes confondues", subtitle_style))
        story.append(Spacer(0, 8))
    
    # Filtre + tri par date croissante
    if not include_unsigned:
        sessions = [s for s in sessions if s.get('signature_status') == 'signed' or s.get('teacher_signature_status') == 'signed']
    
    sessions_sorted = sorted(sessions, key=lambda s: s.get('date', ''))
    
    if not sessions_sorted:
        story.append(Paragraph("Aucune séance émargée.", normal_style))
    else:
        total_hours = sum(s.get('duration_hours', 0) for s in sessions_sorted)
        signed_hours = sum(s.get('duration_hours', 0) for s in sessions_sorted if s.get('signature_status') == 'signed')
        
        # Calculer la période si parcours complet
        period_text = ""
        if month is None and sessions_sorted:
            first_date = sessions_sorted[0].get('date', '')
            last_date = sessions_sorted[-1].get('date', '')
            if first_date and last_date:
                period_text = f" — Période : {format_fr_date(first_date)} → {format_fr_date(last_date)}"
        
        # Texte sans balises HTML
        story.append(Paragraph(f"Parcours complet : {len(sessions_sorted)} séance(s) émargée(s){period_text}", bold_style))
        story.append(Paragraph(f"Heures totales : {total_hours}h | Heures signées élève : {signed_hours}h", normal_style))
        story.append(Spacer(0, 10))
        
        # Mapping
        days_fr = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
        
        # Colonnes - Parcours émargé: Date 18% | Matière 38% | Durée 10% | Élève 17% | Formateur 17%
        col_widths = [
            0.18 * doc.width,
            0.38 * doc.width,
            0.10 * doc.width,
            0.17 * doc.width,
            0.17 * doc.width
        ]
        
        header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold', textColor=colors.white)
        
        table_data = [[
            Paragraph('Date', header_style),
            Paragraph('Matière', header_style),
            Paragraph('Durée', header_style),
            Paragraph('Élève', header_style),
            Paragraph('Formateur', header_style)
        ]]
        
        for session in sessions_sorted:
            # Date FR - format complet: mardi 04/11/2025
            date_formatted = format_fr_date(session.get('date', ''))
            
            # Matière avec Paragraph pour wrap
            matiere = Paragraph(session.get('subject', ''), cell_style)
            
            # Signature élève - images base64 avec timestamp
            if session.get('signature') and session.get('signed_at'):
                try:
                    sig_data = session['signature'].split(',')[1] if ',' in session['signature'] else session['signature']
                    sig_bytes = base64.b64decode(sig_data)
                    sig_img = PILImage.open(io.BytesIO(sig_bytes))
                    
                    temp_sig_path = f"/tmp/sig_e_{session.get('id', 'x')[:8]}.png"
                    sig_img.save(temp_sig_path)
                    
                    # Image signature max ~100×30 px avec ratio
                    sig_rl = Image(temp_sig_path, width=100, height=30, kind='proportional')
                    # Format: Émargé le DD/MM/YYYY HH:mm
                    signed_date = datetime.fromisoformat(session['signed_at']).strftime('%d/%m/%Y %H:%M')
                    
                    eleve_cell = [sig_rl, Paragraph(f"Émargé le {signed_date}", small_style)]
                except Exception:
                    eleve_cell = Paragraph("Non signé", ParagraphStyle('Red', parent=cell_style, textColor=colors.red))
            else:
                eleve_cell = Paragraph("Non signé", ParagraphStyle('Red', parent=cell_style, textColor=colors.red))
            
            # Signature formateur - images base64 avec timestamp
            if session.get('teacher_signature') and session.get('teacher_signed_at'):
                try:
                    sig_data = session['teacher_signature'].split(',')[1] if ',' in session['teacher_signature'] else session['teacher_signature']
                    sig_bytes = base64.b64decode(sig_data)
                    sig_img = PILImage.open(io.BytesIO(sig_bytes))
                    
                    temp_sig_path = f"/tmp/sig_f_{session.get('id', 'x')[:8]}.png"
                    sig_img.save(temp_sig_path)
                    
                    # Image signature max ~100×30 px avec ratio
                    sig_rl = Image(temp_sig_path, width=100, height=30, kind='proportional')
                    # Format: Émargé le DD/MM/YYYY HH:mm
                    signed_date = datetime.fromisoformat(session['teacher_signed_at']).strftime('%d/%m/%Y %H:%M')
                    
                    formateur_cell = [sig_rl, Paragraph(f"Émargé le {signed_date}", small_style)]
                except Exception:
                    formateur_cell = Paragraph("Non signé", ParagraphStyle('Red', parent=cell_style, textColor=colors.red))
            else:
                formateur_cell = Paragraph("Non signé", ParagraphStyle('Red', parent=cell_style, textColor=colors.red))
            
            table_data.append([
                Paragraph(date_formatted, cell_style),
                matiere,
                Paragraph(f"{session.get('duration_hours', 0)}h", cell_style),
                eleve_cell,
                formateur_cell
            ])
        
        sessions_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        sessions_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D7DEE5')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#223B67')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        story.append(sessions_table)
    
    # Footer avec numéro de page
    def add_page_number(canvas, doc):
        canvas.saveState()
        page_num = canvas.getPageNumber()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0]/2, 30, f"Page {page_num}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer


def generate_feedback_pdf(student: dict, feedback: dict) -> io.BytesIO:
    """Générer un PDF d'avis apprenant"""
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        rightMargin=36,
        leftMargin=36, 
        topMargin=72,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold')
    title_style = ParagraphStyle('Title', parent=styles['Normal'], fontSize=14, fontName='Helvetica-Bold', textColor=colors.HexColor('#0D2040'))
    
    story = []
    
    # En-tête
    story.append(build_header(f"Avis apprenant — {student['name']}"))
    story.append(Spacer(0, 20))
    
    # Info élève
    story.append(Paragraph(f"Élève : {student.get('name', '')}", bold_style))
    story.append(Paragraph(f"Email : {student.get('email', '')}", normal_style))
    story.append(Paragraph(f"Date : {datetime.now(timezone.utc).strftime('%d/%m/%Y')}", normal_style))
    story.append(Spacer(0, 20))
    
    # Questions et réponses
    story.append(Paragraph("1. Comment évaluez-vous la qualité de la formation ?", bold_style))
    story.append(Paragraph(feedback.get('quality_rating', 'Non renseigné'), normal_style))
    story.append(Spacer(0, 12))
    
    story.append(Paragraph("2. Le formateur vous a-t-il accompagné efficacement ?", bold_style))
    story.append(Paragraph(feedback.get('teacher_support', 'Non renseigné'), normal_style))
    story.append(Spacer(0, 12))
    
    story.append(Paragraph("3. Recommanderiez-vous cette formation ?", bold_style))
    story.append(Paragraph(feedback.get('recommendation', 'Non renseigné'), normal_style))
    story.append(Spacer(0, 20))
    
    # Footer
    def add_page_number(canvas, doc):
        canvas.saveState()
        page_num = canvas.getPageNumber()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0]/2, 30, f"Page {page_num}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer


def generate_formation_needs_pdf(student: dict, questionnaire: dict) -> bytes:
    """Générer un PDF du questionnaire de besoins en formation"""
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=72,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold')
    title_style = ParagraphStyle('Title', parent=styles['Normal'], fontSize=14, fontName='Helvetica-Bold', textColor=colors.HexColor('#8B5A2B'))
    section_style = ParagraphStyle('Section', parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#8B5A2B'))
    answer_style = ParagraphStyle('Answer', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#DB2777'), fontName='Helvetica-Bold')
    
    story = []
    
    # En-tête
    story.append(build_header(f"Questionnaire de besoins en formation — {student['name']}"))
    story.append(Spacer(0, 20))
    
    # Info élève
    story.append(Paragraph(f"Bénéficiaire : {student.get('name', '')}", bold_style))
    story.append(Paragraph(f"Email : {student.get('email', '')}", normal_style))
    submitted_at = questionnaire.get('submitted_at', '')
    if submitted_at:
        try:
            dt = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
            formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
            story.append(Paragraph(f"Soumis le : {formatted_date}", normal_style))
        except:
            story.append(Paragraph(f"Soumis le : {submitted_at}", normal_style))
    story.append(Spacer(0, 20))
    
    def render_list(items):
        if isinstance(items, list):
            return ', '.join(items) if items else '—'
        return items if items else '—'
    
    # Section 1: Identification
    story.append(Paragraph("1. Identification", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Situation professionnelle :", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('situation_professionnelle')), answer_style))
    story.append(Spacer(0, 6))
    
    if questionnaire.get('si_en_fonction'):
        story.append(Paragraph("Si en fonction, précisez :", bold_style))
        story.append(Paragraph(questionnaire.get('si_en_fonction', '—'), answer_style))
        story.append(Spacer(0, 6))
    
    story.append(Paragraph("Poste occupé :", bold_style))
    story.append(Paragraph(questionnaire.get('poste_occupe', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Ancienneté dans le poste :", bold_style))
    story.append(Paragraph(questionnaire.get('anciennete', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 2: Motivation et objectifs
    story.append(Paragraph("2. Motivation et objectifs", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Avez-vous déjà suivi une formation d'anglais ? *", bold_style))
    story.append(Paragraph(questionnaire.get('formation_anglais_anterieure', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    if questionnaire.get('formation_details'):
        story.append(Paragraph("Détails de la formation :", bold_style))
        story.append(Paragraph(questionnaire.get('formation_details', '—'), answer_style))
        story.append(Spacer(0, 6))
    
    story.append(Paragraph("Pourquoi souhaitez-vous suivre cette formation ? *", bold_style))
    story.append(Paragraph(questionnaire.get('raison_formation', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Dans quel cadre utiliserez-vous l'anglais ? *", bold_style))
    cadre = render_list(questionnaire.get('cadre_utilisation'))
    if questionnaire.get('cadre_autre'):
        cadre += f", Autre : {questionnaire.get('cadre_autre')}"
    story.append(Paragraph(cadre, answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Quels sont vos objectifs principaux ? *", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('objectifs_principaux')), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Qu'attendez-vous concrètement à la fin de la formation ? *", bold_style))
    story.append(Paragraph(questionnaire.get('attentes_fin_formation', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 3: Niveau et compétences
    story.append(Paragraph("3. Niveau et compétences linguistiques (auto-évaluation)", section_style))
    story.append(Spacer(0, 8))
    
    competences = [
        ('Compréhension orale', 'comprehension_orale'),
        ('Expression orale', 'expression_orale'),
        ('Compréhension écrite', 'comprehension_ecrite'),
        ('Expression écrite', 'expression_ecrite')
    ]
    
    for label, key in competences:
        story.append(Paragraph(f"{label} : ", bold_style))
        story.append(Paragraph(questionnaire.get(key, '—'), answer_style))
        story.append(Spacer(0, 6))
    
    story.append(Spacer(0, 10))
    
    # Section 4: Besoins professionnels
    story.append(Paragraph("4. Besoins professionnels et attentes spécifiques", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Situations où l'anglais est nécessaire :", bold_style))
    story.append(Paragraph(questionnaire.get('situations_anglais_necessaire', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Difficultés rencontrées :", bold_style))
    difficultes = render_list(questionnaire.get('difficultes'))
    if questionnaire.get('difficultes_autre'):
        difficultes += f", Autre : {questionnaire.get('difficultes_autre')}"
    story.append(Paragraph(difficultes, answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Contenu particulier :", bold_style))
    story.append(Paragraph(questionnaire.get('contenu_particulier', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Certification souhaitée :", bold_style))
    cert = questionnaire.get('certification_souhaitee', '—')
    if questionnaire.get('certification_laquelle'):
        cert += f" ({questionnaire.get('certification_laquelle')})"
    story.append(Paragraph(cert, answer_style))
    story.append(Spacer(0, 15))
    
    # Section 5: Contraintes et conditions
    story.append(Paragraph("5. Contraintes et conditions de suivi", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Rythme souhaité :", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('rythme_souhaite')), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Format préféré :", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('format_prefere')), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Contraintes particulières :", bold_style))
    story.append(Paragraph(questionnaire.get('contraintes_particulieres', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 6: Situation de handicap
    story.append(Paragraph("6. Situation de handicap et besoins d'adaptation", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Situation de handicap :", bold_style))
    story.append(Paragraph(questionnaire.get('situation_handicap', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    if questionnaire.get('situation_handicap') == 'Oui':
        story.append(Paragraph("Accompagnement spécifique :", bold_style))
        story.append(Paragraph(questionnaire.get('accompagnement_specifique', '—'), answer_style))
        story.append(Spacer(0, 6))
        
        story.append(Paragraph("Matériel particulier :", bold_style))
        materiel = render_list(questionnaire.get('materiel_particulier'))
        if questionnaire.get('materiel_autre'):
            materiel += f", Autre : {questionnaire.get('materiel_autre')}"
        story.append(Paragraph(materiel, answer_style))
        story.append(Spacer(0, 6))
        
        story.append(Paragraph("Aménagement du rythme :", bold_style))
        amenagement = render_list(questionnaire.get('amenagement_rythme'))
        if questionnaire.get('amenagement_autre'):
            amenagement += f", Autre : {questionnaire.get('amenagement_autre')}"
        story.append(Paragraph(amenagement, answer_style))
        story.append(Spacer(0, 6))
    
    story.append(Spacer(0, 15))
    
    # Signature
    story.append(Paragraph("7. Validation", section_style))
    story.append(Spacer(0, 8))
    story.append(Paragraph("Je certifie l'exactitude des données et transmets mes informations à TerciForm", normal_style))
    story.append(Spacer(0, 10))
    
    # Footer
    def add_page_number(canvas, doc):
        canvas.saveState()
        page_num = canvas.getPageNumber()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0]/2, 30, f"Page {page_num}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer.getvalue()


def generate_mid_course_questionnaire_pdf(student: dict, questionnaire: dict) -> bytes:
    """Générer un PDF du questionnaire à mi-parcours"""
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=72,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold')
    section_style = ParagraphStyle('Section', parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#8B5A2B'))
    answer_style = ParagraphStyle('Answer', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#DB2777'), fontName='Helvetica-Bold')
    
    story = []
    
    # En-tête
    story.append(build_header(f"Questionnaire à mi-parcours — {student['name']}"))
    story.append(Spacer(0, 20))
    
    # Info élève
    story.append(Paragraph(f"Bénéficiaire : {student.get('name', '')}", bold_style))
    story.append(Paragraph(f"Email : {student.get('email', '')}", normal_style))
    submitted_at = questionnaire.get('submitted_at', '')
    if submitted_at:
        try:
            dt = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
            formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
            story.append(Paragraph(f"Soumis le : {formatted_date}", normal_style))
        except:
            story.append(Paragraph(f"Soumis le : {submitted_at}", normal_style))
    story.append(Spacer(0, 20))
    
    def render_list(items):
        if isinstance(items, list):
            return ', '.join(items) if items else '—'
        return items if items else '—'
    
    # Section 1: Informations générales
    story.append(Paragraph("1. Informations générales", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Nom et prénom :", bold_style))
    story.append(Paragraph(questionnaire.get('nom_prenom', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Date du suivi :", bold_style))
    story.append(Paragraph(questionnaire.get('date_suivi', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Formateur référent :", bold_style))
    story.append(Paragraph(questionnaire.get('formateur_referent', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Mode de formation :", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('mode_formation')), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 2: Ressenti
    story.append(Paragraph("💬 2. Ressenti sur le déroulement de la formation", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("La formation répond-elle à vos attentes jusqu'à présent ?", bold_style))
    story.append(Paragraph(questionnaire.get('formation_attentes', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Le rythme et la durée des séances vous conviennent-ils ?", bold_style))
    story.append(Paragraph(questionnaire.get('rythme_duree', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Les supports et méthodes utilisés facilitent-ils votre apprentissage ?", bold_style))
    story.append(Paragraph(questionnaire.get('supports_methodes', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 3: Progression
    story.append(Paragraph("🎯 3. Progression et besoins complémentaires", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Qu'avez-vous le plus appris ou amélioré depuis le début de la formation ?", bold_style))
    story.append(Paragraph(questionnaire.get('apprentissages', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Rencontrez-vous actuellement des difficultés particulières ?", bold_style))
    story.append(Paragraph(questionnaire.get('difficultes', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Souhaitez-vous approfondir certains points ?", bold_style))
    approfondir = questionnaire.get('approfondir', '—')
    if questionnaire.get('approfondir_details'):
        approfondir += f" - {questionnaire.get('approfondir_details')}"
    story.append(Paragraph(approfondir, answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Suggestions pour améliorer le déroulement :", bold_style))
    story.append(Paragraph(questionnaire.get('suggestions', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 4: Suivi formateur
    story.append(Paragraph("🔄 4. Suivi et adaptation (complété par le formateur)", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Observation du formateur :", bold_style))
    story.append(Paragraph(questionnaire.get('observation_formateur', 'Non renseigné'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Ajustement(s) envisagé(s) :", bold_style))
    story.append(Paragraph(questionnaire.get('ajustements', 'Non renseigné'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Décision :", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('decision')), answer_style))
    story.append(Spacer(0, 15))
    
    # Validation
    story.append(Paragraph("✍️ 5. Validation", section_style))
    story.append(Spacer(0, 8))
    story.append(Paragraph(f"Questionnaire soumis le {formatted_date if submitted_at else 'N/A'}", normal_style))
    
    # Footer
    def add_page_number(canvas, doc):
        canvas.saveState()
        page_num = canvas.getPageNumber()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0]/2, 30, f"Page {page_num}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer.getvalue()


def generate_end_course_questionnaire_pdf(student: dict, questionnaire: dict) -> bytes:
    """Générer un PDF du questionnaire de fin de formation"""
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=72,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold')
    section_style = ParagraphStyle('Section', parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#8B5A2B'))
    answer_style = ParagraphStyle('Answer', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#DB2777'), fontName='Helvetica-Bold')
    
    story = []
    
    # En-tête
    story.append(build_header(f"Questionnaire de fin de formation — {student['name']}"))
    story.append(Spacer(0, 20))
    
    # Info élève
    story.append(Paragraph(f"Bénéficiaire : {student.get('name', '')}", bold_style))
    story.append(Paragraph(f"Email : {student.get('email', '')}", normal_style))
    submitted_at = questionnaire.get('submitted_at', '')
    if submitted_at:
        try:
            dt = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
            formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
            story.append(Paragraph(f"Soumis le : {formatted_date}", normal_style))
        except:
            story.append(Paragraph(f"Soumis le : {submitted_at}", normal_style))
    story.append(Spacer(0, 20))
    
    def render_list(items):
        if isinstance(items, list):
            return ', '.join(items) if items else '—'
        return items if items else '—'
    
    # Section 1: Informations générales
    story.append(Paragraph("1. Informations générales", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Nom et prénom :", bold_style))
    story.append(Paragraph(questionnaire.get('nom_prenom', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Date :", bold_style))
    story.append(Paragraph(questionnaire.get('date', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Formateur référent :", bold_style))
    story.append(Paragraph(questionnaire.get('formateur_referent', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Durée totale suivie :", bold_style))
    story.append(Paragraph(questionnaire.get('duree_totale', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Mode de formation :", bold_style))
    story.append(Paragraph(render_list(questionnaire.get('mode_formation')), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 2: Évaluation des acquis
    story.append(Paragraph("🎯 2. Évaluation de vos acquis", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Pensez-vous avoir progressé depuis le début de la formation ?", bold_style))
    story.append(Paragraph(questionnaire.get('progression', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Dans quels domaines avez-vous constaté le plus d'amélioration ?", bold_style))
    domaines = render_list(questionnaire.get('domaines_amelioration'))
    if questionnaire.get('domaines_autre'):
        domaines += f", Autre : {questionnaire.get('domaines_autre')}"
    story.append(Paragraph(domaines, answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Vous sentez-vous plus à l'aise pour utiliser l'anglais dans votre environnement professionnel ?", bold_style))
    story.append(Paragraph(questionnaire.get('aise_professionnel', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Quels points souhaitez-vous encore renforcer ?", bold_style))
    story.append(Paragraph(questionnaire.get('points_renforcer', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Avez-vous atteint les objectifs fixés en début de formation ?", bold_style))
    story.append(Paragraph(questionnaire.get('objectifs_atteints', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 3: Appréciation
    story.append(Paragraph("💬 3. Appréciation de la formation", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Le contenu et les supports ont-ils été adaptés à vos besoins ?", bold_style))
    story.append(Paragraph(questionnaire.get('contenu_adapte', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Le rythme et la durée de la formation vous ont-ils convenu ?", bold_style))
    story.append(Paragraph(questionnaire.get('rythme_duree', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Le formateur a-t-il répondu à vos attentes (écoute, pédagogie, disponibilité) ?", bold_style))
    story.append(Paragraph(questionnaire.get('formateur_satisfaisant', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Comment évalueriez-vous globalement la formation ?", bold_style))
    story.append(Paragraph(questionnaire.get('evaluation_globale', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Recommanderiez-vous cette formation à d'autres personnes ?", bold_style))
    story.append(Paragraph(questionnaire.get('recommandation', '—'), answer_style))
    story.append(Spacer(0, 15))
    
    # Section 4: Perspectives
    story.append(Paragraph("🧩 4. Perspectives et suite du parcours", section_style))
    story.append(Spacer(0, 8))
    
    story.append(Paragraph("Comment comptez-vous utiliser vos nouvelles compétences ?", bold_style))
    story.append(Paragraph(questionnaire.get('utilisation_competences', '—'), answer_style))
    story.append(Spacer(0, 6))
    
    story.append(Paragraph("Souhaitez-vous poursuivre avec une formation complémentaire ?", bold_style))
    formation_comp = questionnaire.get('formation_complementaire', '—')
    if questionnaire.get('formation_complementaire_details'):
        formation_comp += f" - {questionnaire.get('formation_complementaire_details')}"
    story.append(Paragraph(formation_comp, answer_style))
    story.append(Spacer(0, 15))
    
    # Validation
    story.append(Paragraph("✍️ 5. Validation", section_style))
    story.append(Spacer(0, 8))
    story.append(Paragraph(f"Questionnaire soumis le {formatted_date if submitted_at else 'N/A'}", normal_style))
    
    # Footer
    def add_page_number(canvas, doc):
        canvas.saveState()
        page_num = canvas.getPageNumber()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0]/2, 30, f"Page {page_num}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer.getvalue()


@api_router.post("/students/{student_id}/send-planning-pdf")
async def send_student_planning_pdf(student_id: str, data: dict, current_user: User = Depends(get_current_user)):
    """Envoyer le planning d'un élève en PDF par email (TOUTES les séances du parcours)"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le mois (pour compatibilité) et les emails destinataires
    month = data.get('month', '')
    recipient_emails = data.get('recipient_email', '')
    
    if not recipient_emails:
        raise HTTPException(status_code=400, detail="recipient_email required")
    
    # Séparer les emails (virgule ou point-virgule)
    email_list = [email.strip() for email in recipient_emails.replace(';', ',').split(',') if email.strip()]
    
    if not email_list:
        raise HTTPException(status_code=400, detail="At least one valid email required")
    
    # Récupérer TOUTES les séances du parcours (pas de filtre par mois)
    sessions = await db.sessions.find({
        "student_id": student_id
    }, {"_id": 0}).to_list(1000)
    
    # Month label (non utilisé mais gardé pour compatibilité)
    month_labels = {
        '2025-10': 'octobre 2025', '2025-11': 'novembre 2025', '2025-12': 'décembre 2025',
        '2026-01': 'janvier 2026', '2026-02': 'février 2026'
    }
    month_label = month_labels.get(month, month)
    
    # Générer le PDF
    pdf_buffer = generate_student_planning_pdf(student, sessions, month, month_label)
    
    # Envoyer l'email avec le PDF en pièce jointe à tous les destinataires
    try:
        gmail_user = os.environ['GMAIL_USER']
        gmail_password = os.environ['GMAIL_PASSWORD']
        
        emails_sent = 0
        for recipient_email in email_list:
            pdf_buffer.seek(0)  # Réinitialiser le buffer pour chaque email
            
            msg = MIMEMultipart()
            msg['From'] = gmail_user
            msg['To'] = recipient_email
            msg['Subject'] = f"Planning de {student['name']} - {month_label}"
            
            # Corps du message
            body = f"""
Bonjour,

Vous trouverez le planning à venir de {student['name']}.

Cordialement,
TerciForm
            """
            msg.attach(MIMEText(body, 'plain'))
            
            # Attacher le PDF
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(pdf_buffer.read())
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename=Planning_{student["name"].replace(" ", "_")}_{month}.pdf')
            msg.attach(part)
            
            # Envoyer
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
            server.quit()
            
            emails_sent += 1
            logger.info(f"Planning PDF sent to {recipient_email} for student {student_id}")
        
        return {"message": f"Planning envoyé avec succès à {emails_sent} destinataire(s)"}
        
    except Exception as e:
        logger.error(f"Error sending planning PDF: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")


    # Get current month if not specified
    if not month:
        now = datetime.now(timezone.utc)
        month = now.strftime('%Y-%m')
    
    # Filter sessions for the specified month
    all_sessions = await db.sessions.find({}, {"_id": 0}).to_list(1000)
    monthly_sessions = [s for s in all_sessions if s['date'].startswith(month)]
    
    students = await db.users.find({"role": "student"}, {"_id": 0}).to_list(1000)
    
    # Calculer les heures RÉALISÉES (séances émargées avec signature du mois)
    signed_sessions = [s for s in monthly_sessions if s.get('signature') is not None]
    total_hours = sum(s.get('duration_hours', 0) for s in signed_sessions)
    
    # Calculer les heures confirmées et refusées (toutes les séances du mois)
    confirmed_hours = sum(s.get('duration_hours', 0) for s in monthly_sessions if s['status'] == 'confirmed')
    rejected_hours = sum(s.get('duration_hours', 0) for s in monthly_sessions if s['status'] == 'rejected')
    
    stats = {
        "month": month,
        "total_sessions": len(signed_sessions),  # Nombre de séances émargées
        "total_hours": total_hours,  # Heures réalisées = heures émargées
        "pending_sessions": len([s for s in monthly_sessions if s['status'] == 'pending']),
        "confirmed_sessions": len([s for s in monthly_sessions if s['status'] == 'confirmed']),
        "confirmed_hours": confirmed_hours,
        "rejected_sessions": len([s for s in monthly_sessions if s['status'] == 'rejected']),
        "rejected_hours": rejected_hours,
        "students": [{"id": s['id'], "name": s['name'], "email": s['email'], "credit_hours": s['credit_hours']} for s in students]
    }
    
    return stats


# Nouveaux endpoints pour justificatifs signés
@api_router.get("/sessions/{session_id}/attendance-pdf")
async def get_session_attendance_pdf(session_id: str, current_user: User = Depends(get_current_user)):
    """Récupérer le PDF de justificatif d'émargement pour une séance"""
    from fastapi.responses import StreamingResponse
    
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la séance
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Générer le PDF
    pdf_buffer = generate_attendance_pdf_single_session(session)
    
    filename = f"emargement_{session.get('subject', 'session')}_{session.get('date', '')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.post("/students/{student_id}/attendance-pdf")
async def get_student_attendance_pdf_month(
    student_id: str, 
    month: str = "",
    include_unsigned: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le PDF de justificatifs d'émargement pour TOUT le parcours"""
    from fastapi.responses import StreamingResponse
    
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer TOUTES les séances du parcours (pas de filtre par mois)
    sessions = await db.sessions.find({
        "student_id": student_id
    }, {"_id": 0}).to_list(1000)
    
    # Générer le PDF
    pdf_buffer = generate_attendance_pdf_month(student, sessions, month, include_unsigned)
    
    filename = f"parcours_emarge_{student.get('name', 'student')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.post("/send-attendance")
async def send_attendance_pdf(data: dict, current_user: User = Depends(get_current_user)):
    """Envoyer le justificatif d'émargement par email"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    mode = data.get('mode')  # "session", "month", or "full"
    to_emails = data.get('to', [])
    subject = data.get('subject', 'Justificatif d\'émargement')
    body = data.get('body', '')
    
    if not mode or not to_emails:
        raise HTTPException(status_code=400, detail="mode and to required")
    
    pdf_buffer = None
    filename = "justificatif_emargement.pdf"
    student_name = ""
    
    if mode == "session":
        session_id = data.get('session_id')
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required for mode=session")
        
        # Récupérer la séance
        session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Générer le PDF
        pdf_buffer = generate_attendance_pdf_single_session(session)
        filename = f"emargement_{session.get('subject', 'session')}_{session.get('date', '')}.pdf"
        student_name = session.get('student_name', '')
        
    elif mode == "month":
        student_id = data.get('student_id')
        month = data.get('month', '')
        include_unsigned = data.get('include_unsigned', False)
        
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required for mode=month")
        
        # Récupérer l'élève
        student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student_name = student.get('name', '')
        
        # Récupérer les séances du mois spécifié
        sessions = await db.sessions.find({
            "student_id": student_id,
            "date": {"$regex": f"^{month}"}
        }, {"_id": 0}).to_list(1000)
        
        # Filtrer les séances signées si nécessaire
        if not include_unsigned:
            signed_sessions = [s for s in sessions if s.get('signature_status') == 'signed' or s.get('teacher_signature_status') == 'signed']
            if not signed_sessions:
                raise HTTPException(status_code=400, detail="Aucune séance émargée pour ce mois")
            sessions = signed_sessions
        
        # Générer le PDF
        pdf_buffer = generate_attendance_pdf_month(student, sessions, month, include_unsigned)
        filename = f"parcours_emarge_{student_name}_{month}.pdf"
    
    elif mode == "full":
        # PARCOURS COMPLET - toutes les séances signées, tous mois confondus
        student_id = data.get('student_id')
        include_unsigned = data.get('include_unsigned', False)
        
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required for mode=full")
        
        # Récupérer l'élève
        student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student_name = student.get('name', '')
        
        # Récupérer TOUTES les séances du parcours (tous mois)
        sessions = await db.sessions.find({
            "student_id": student_id
        }, {"_id": 0}).to_list(1000)
        
        # Filtrer les séances signées si nécessaire
        if not include_unsigned:
            signed_sessions = [s for s in sessions if s.get('signature_status') == 'signed' or s.get('teacher_signature_status') == 'signed']
            if not signed_sessions:
                raise HTTPException(status_code=400, detail="Aucune séance émargée dans le parcours complet")
            sessions = signed_sessions
        
        # Trier par date
        sessions = sorted(sessions, key=lambda s: (s.get('date', ''), s.get('start_time', '')))
        
        # Générer le PDF avec indication "Parcours complet"
        pdf_buffer = generate_attendance_pdf_month(student, sessions, None, include_unsigned)  # None = full period
        filename = f"parcours_complet_emarge_{student_name}.pdf"
    
    else:
        raise HTTPException(status_code=400, detail="mode must be 'session', 'month', or 'full'")
    
    # Envoyer l'email avec le PDF
    try:
        gmail_user = os.environ['GMAIL_USER']
        gmail_password = os.environ['GMAIL_PASSWORD']
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        # Corps du message
        msg.attach(MIMEText(body, 'plain'))
        
        # Attacher le PDF
        pdf_buffer.seek(0)
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_buffer.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename={filename}')
        msg.attach(part)
        
        # Envoyer
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        # Logger dans audit_logs
        await db.audit_logs.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "teacher",
            "teacher_id": current_user.id,
            "action": "send_attendance_pdf",
            "scope": mode,
            "session_id": data.get('session_id') if mode == "session" else None,
            "student_id": data.get('student_id') if mode == "month" else None,
            "student_name": student_name,
            "recipients": to_emails,
            "result": "ok"
        })
        
        return {"sent": True, "info": f"Justificatif envoyé à {len(to_emails)} destinataire(s)"}
    
    except Exception as e:
        logger.error(f"Failed to send attendance PDF: {e}")
        
        # Logger l'échec
        await db.audit_logs.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "teacher",
            "teacher_id": current_user.id,
            "action": "send_attendance_pdf",
            "scope": mode,
            "session_id": data.get('session_id') if mode == "session" else None,
            "student_id": data.get('student_id') if mode == "month" else None,
            "recipients": to_emails,
            "result": "fail",
            "error": str(e)
        })
        
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


# Training Needs Endpoints
@api_router.post("/students/{student_id}/training-needs", response_model=TrainingNeeds)
async def save_training_needs(student_id: str, needs: TrainingNeedsCreate, current_user: User = Depends(get_current_user)):
    """Sauvegarder les besoins en formation d'un élève"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier si l'élève existe
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Vérifier si les besoins existent déjà
    existing = await db.training_needs.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        # Mettre à jour
        update_data = needs.dict()
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.training_needs.update_one(
            {"student_id": student_id},
            {"$set": update_data}
        )
        
        updated = await db.training_needs.find_one({"student_id": student_id}, {"_id": 0})
        return TrainingNeeds(**updated)
    else:
        # Créer
        needs_dict = needs.dict()
        needs_dict["id"] = str(uuid.uuid4())
        needs_dict["student_id"] = student_id
        needs_dict["created_at"] = datetime.now(timezone.utc)
        needs_dict["updated_at"] = datetime.now(timezone.utc)
        
        await db.training_needs.insert_one(needs_dict)
        return TrainingNeeds(**needs_dict)


@api_router.get("/students/{student_id}/training-needs", response_model=TrainingNeeds)
async def get_training_needs(student_id: str, current_user: User = Depends(get_current_user)):
    """Récupérer les besoins en formation d'un élève"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    needs = await db.training_needs.find_one({"student_id": student_id}, {"_id": 0})
    
    if not needs:
        # Retourner des besoins vides
        return TrainingNeeds(
            id=str(uuid.uuid4()),
            student_id=student_id,
            expectations="",
            strengths="",
            improvements="",
            availability=""
        )
    
    return TrainingNeeds(**needs)


# Student Feedback Endpoints
@api_router.post("/students/{student_id}/feedback")
async def save_student_feedback(student_id: str, feedback: StudentFeedbackCreate, current_user: User = Depends(get_current_user)):
    """Sauvegarder l'avis de l'élève et générer le PDF"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Créer l'avis
    feedback_dict = feedback.dict()
    feedback_dict["id"] = str(uuid.uuid4())
    feedback_dict["student_id"] = student_id
    feedback_dict["student_name"] = student.get('name', '')
    feedback_dict["created_at"] = datetime.now(timezone.utc)
    
    await db.student_feedback.insert_one(feedback_dict)
    
    # Générer le PDF
    try:
        pdf_buffer = generate_feedback_pdf(student, feedback_dict)
        
        # TODO: Sauvegarder le PDF quelque part (pour l'instant, on le retourne)
        # On pourrait l'envoyer par email ou le sauvegarder dans un système de fichiers
        
        return {
            "saved": True,
            "message": "Avis sauvegardé avec succès",
            "feedback_id": feedback_dict["id"]
        }
    except Exception as e:
        logger.error(f"Failed to generate feedback PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@api_router.get("/students/{student_id}/feedback", response_model=List[StudentFeedback])
async def get_student_feedback(student_id: str, current_user: User = Depends(get_current_user)):
    """Récupérer les avis d'un élève"""
    if current_user.role != "student" or current_user.id != student_id:
        # Les formateurs peuvent aussi voir les avis
        if current_user.role != "teacher":
            raise HTTPException(status_code=403, detail="Access denied")
    
    feedbacks = await db.student_feedback.find({"student_id": student_id}, {"_id": 0}).to_list(100)
    return [StudentFeedback(**f) for f in feedbacks]


@api_router.get("/profile-pictures/{filename}")
async def get_profile_picture(filename: str):
    """Servir une photo de profil"""
    file_path = f"/app/backend/static/profile_pictures/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Déterminer le content-type
    content_type = "image/png"
    if filename.endswith('.jpg') or filename.endswith('.jpeg'):
        content_type = "image/jpeg"
    elif filename.endswith('.gif'):
        content_type = "image/gif"
    elif filename.endswith('.webp'):
        content_type = "image/webp"
    
    return FileResponse(file_path, media_type=content_type)


@api_router.post("/upload-profile-picture")
async def upload_profile_picture(file: UploadFile = FastAPIFile(...), current_user: User = Depends(get_current_user)):
    """Upload une photo de profil personnalisée"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que c'est une image
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")
    
    # Générer un nom de fichier unique
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"custom_{uuid.uuid4()}.{file_extension}"
    file_path = f"/app/backend/static/profile_pictures/{unique_filename}"
    
    # Sauvegarder le fichier
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Retourner l'URL relative
    return {"url": f"/api/profile-pictures/{unique_filename}"}


@api_router.post("/students/{student_id}/contact-teacher")
async def contact_teacher(student_id: str, data: dict, current_user: User = Depends(get_current_user)):
    """Envoyer un email au formateur assigné à l'élève"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Vérifier que le formateur est assigné
    if not student.get('teacher_email'):
        raise HTTPException(status_code=400, detail="Aucun formateur assigné ou email non renseigné")
    
    subject = data.get('subject', 'Pas d\'objet')
    message = data.get('message', '')
    
    # Construire l'email
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
            <h2 style="color: #0D2040; border-bottom: 2px solid #2763FF; padding-bottom: 10px;">
                📩 Message d'un élève
            </h2>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>De :</strong> {student.get('name', 'Élève')} ({student.get('email', '')})</p>
                <p style="margin: 0 0 10px 0;"><strong>Parcours :</strong> {student.get('parcours', 'Non spécifié')}</p>
                <p style="margin: 0 0 10px 0;"><strong>Objet :</strong> {subject}</p>
            </div>
            
            <div style="background-color: #EEF4FF; padding: 20px; border-radius: 8px; border-left: 4px solid #2763FF;">
                <h3 style="margin-top: 0; color: #2763FF;">Message :</h3>
                <p style="white-space: pre-line;">{message}</p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #ffffff; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">
                    Cet email a été envoyé automatiquement depuis la plateforme TerciForm.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Envoyer l'email
    email_subject = f"Message de {student.get('name', 'Élève')} - {subject}"
    email_sent = send_email(student.get('teacher_email'), email_subject, email_body)
    
    if email_sent:
        logger.info(f"Email envoyé au formateur {student.get('teacher_email')} par l'élève {student.get('name')}")
        return {"message": "Votre message a été envoyé avec succès à votre formateur"}
    else:
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")


@api_router.get("/students/{student_id}/download-planning-pdf")
async def download_planning_pdf(student_id: str, current_user: User = Depends(get_current_user)):
    """Télécharger le planning PDF pour l'élève"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer toutes les séances
    sessions = await db.sessions.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    
    if not sessions:
        raise HTTPException(status_code=404, detail="Aucune séance trouvée")
    
    # Générer le PDF
    pdf_buffer = generate_student_planning_pdf(student, sessions, "", "")
    
    # Retourner le PDF
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=planning_{student.get('name', 'eleve')}.pdf"
        }
    )


@api_router.get("/students/{student_id}/download-feedback-pdf/{feedback_id}")
async def download_feedback_pdf(student_id: str, feedback_id: str, current_user: User = Depends(get_current_user)):
    """Télécharger le PDF d'avis"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer le feedback
    feedback = await db.student_feedback.find_one({"id": feedback_id, "student_id": student_id}, {"_id": 0})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Générer le PDF
    pdf_buffer = generate_feedback_pdf(student, feedback)
    
    # Retourner le PDF
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=avis_{student.get('name', 'eleve')}.pdf"
        }
    )


# ================================
# DOCUMENTS PARCOURS ÉLÈVE
# ================================

@api_router.post("/students/{student_id}/documents/upload")
async def upload_student_document(
    student_id: str,
    category: str,
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user)
):
    """Upload un document pour un élève"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'élève existe
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Créer le dossier étudiant si nécessaire
    student_dir = Path(f"/app/backend/student_documents/{student_id}/{category}")
    student_dir.mkdir(parents=True, exist_ok=True)
    
    # Sauvegarder le fichier
    filepath = student_dir / file.filename
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Enregistrer en base
    document = StudentDocument(
        student_id=student_id,
        category=category,
        filename=file.filename,
        filepath=str(filepath),
        mime=file.content_type,
        size=len(content),
        uploaded_by=current_user.id
    )
    
    doc_dict = document.model_dump()
    doc_dict['uploaded_at'] = doc_dict['uploaded_at'].isoformat()
    await db.student_documents.insert_one(doc_dict)
    
    logger.info(f"Document uploaded: {file.filename} for student {student_id} in category {category}")
    return document


@api_router.get("/students/{student_id}/documents/{category}", response_model=List[StudentDocument])
async def get_student_documents(
    student_id: str,
    category: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer les documents d'un élève pour une catégorie"""
    if current_user.role != "teacher" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    documents = await db.student_documents.find({
        "student_id": student_id,
        "category": category
    }, {"_id": 0}).to_list(100)
    
    return [StudentDocument(**doc) for doc in documents]


@api_router.get("/students/{student_id}/documents/download/{document_id}")
async def download_student_document(
    student_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Télécharger un document"""
    if current_user.role != "teacher" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    document = await db.student_documents.find_one({"id": document_id, "student_id": student_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filepath = Path(document['filepath'])
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(filepath, filename=document['filename'])


@api_router.put("/students/{student_id}/category-notes/{category}")
async def set_category_note(
    student_id: str,
    category: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Créer ou mettre à jour la note pour une catégorie entière"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'élève existe
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    note_value = data.get('note', '').strip()
    if not note_value:
        raise HTTPException(status_code=400, detail="Note cannot be empty")
    
    # Chercher si une note existe déjà pour cette catégorie
    existing = await db.student_category_notes.find_one(
        {"student_id": student_id, "category": category}, 
        {"_id": 0}
    )
    
    if existing:
        # Mettre à jour
        await db.student_category_notes.update_one(
            {"student_id": student_id, "category": category},
            {"$set": {
                "note": note_value,
                "validated_at": datetime.now(timezone.utc).isoformat(),
                "validated_by": current_user.id
            }}
        )
        logger.info(f"Category note updated: {category} for student {student_id} - note: {note_value}")
        return {"message": "Note updated", "note": note_value}
    else:
        # Créer
        category_note = StudentCategoryNote(
            student_id=student_id,
            category=category,
            note=note_value,
            validated_by=current_user.id
        )
        note_dict = category_note.model_dump()
        note_dict['validated_at'] = note_dict['validated_at'].isoformat()
        await db.student_category_notes.insert_one(note_dict)
        logger.info(f"Category note created: {category} for student {student_id} - note: {note_value}")
        return {"message": "Note created", "note": note_value}


@api_router.get("/students/{student_id}/category-notes/{category}")
async def get_category_note(
    student_id: str,
    category: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer la note d'une catégorie"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    note = await db.student_category_notes.find_one(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    )
    
    if not note:
        return {"note": None}
    
    return note


@api_router.post("/students/{student_id}/category-notes/{category}/generate-pdf")
async def generate_category_pdf(
    student_id: str,
    category: str,
    current_user: User = Depends(get_current_user)
):
    """Générer un PDF de synthèse pour une catégorie (tests/évaluations) - DOWNLOAD"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer les documents de la catégorie
    documents = await db.student_documents.find(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    ).to_list(100)
    
    # Récupérer la note de la catégorie
    category_note = await db.student_category_notes.find_one(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    )
    
    # Mapping des catégories vers titres français
    category_titles = {
        "positionnement": "Test de positionnement",
        "evaluation_cours": "Évaluations en cours de formation",
        "evaluation_fin": "Évaluations de fin de formation"
    }
    
    category_title = category_titles.get(category, category)
    
    # Générer le PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()
    
    # Styles personnalisés
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#8B5A2B'),
        alignment=1,  # Center
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#6B4522'),
        alignment=1,
        spaceAfter=30,
        fontName='Helvetica-Oblique'
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#8B5A2B'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    # En-tête avec logo et cadre décoratif
    logo_path = ROOT_DIR / "assets" / "logo_terciform.png"
    if logo_path.exists():
        try:
            # Logo avec cadre décoratif
            logo = Image(str(logo_path), width=2.5*inch, height=1.06*inch)
            logo.hAlign = 'CENTER'
            
            # Cadre décoratif autour du logo
            logo_table = Table([[logo]], colWidths=[5.5*inch])
            logo_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 15),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F1EC')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#8B5A2B'))
            ]))
            story.append(logo_table)
            story.append(Spacer(1, 25))
        except Exception as e:
            logger.warning(f"Logo not loaded: {e}")
    
    # Bandeau titre avec dégradé visuel
    title_table = Table([[Paragraph(f"{category_title}", title_style)]], colWidths=[5.5*inch])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#8B5A2B')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('ROUNDEDCORNERS', [10, 10, 10, 10])
    ]))
    
    # Modifier le style du titre pour texte blanc
    title_style_white = ParagraphStyle(
        'CustomTitleWhite',
        parent=styles['Heading1'],
        fontSize=22,
        textColor=colors.white,
        alignment=1,
        fontName='Helvetica-Bold'
    )
    
    title_table = Table([[Paragraph(f"{category_title}", title_style_white)]], colWidths=[5.5*inch])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#8B5A2B')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15)
    ]))
    
    story.append(title_table)
    story.append(Spacer(1, 15))
    story.append(Paragraph(f"<para align=center fontSize=13><b>Élève :</b> {student.get('name', 'N/A')}</para>", subtitle_style))
    story.append(Spacer(1, 25))
    
    # Section Contenu (Documents)
    if documents:
        story.append(Paragraph("Contenu", section_title_style))
        story.append(Spacer(1, 10))
        
        # Créer un tableau pour les documents avec visuels
        data = [['N°', 'Visuel / Aperçu', 'Nom du fichier', 'Date de réalisation']]
        for idx, document in enumerate(documents, 1):
            uploaded_at = document.get('uploaded_at', '')
            if uploaded_at:
                try:
                    dt = datetime.fromisoformat(uploaded_at.replace('Z', '+00:00'))
                    formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
                except:
                    formatted_date = uploaded_at
            else:
                formatted_date = 'Non disponible'
            
            # Créer une vignette ou icône pour le fichier
            filepath = Path(document.get('filepath', ''))
            mime = document.get('mime', '')
            thumbnail = None
            
            if filepath.exists():
                try:
                    if mime and 'image' in mime:
                        # Image : inclure directement avec taille réduite
                        thumbnail = Image(str(filepath), width=1*inch, height=1*inch)
                    elif mime and 'pdf' in mime:
                        # PDF : icône PDF stylisée (texte)
                        thumbnail = Paragraph("<para align=center><font size=8 color='red'>📄<br/>PDF</font></para>", styles['Normal'])
                    else:
                        # Autre : icône générique
                        thumbnail = Paragraph("<para align=center><font size=8>📎<br/>DOC</font></para>", styles['Normal'])
                except Exception as e:
                    logger.warning(f"Could not create thumbnail for {filepath}: {e}")
                    thumbnail = Paragraph("<para align=center><font size=8>📎</font></para>", styles['Normal'])
            else:
                thumbnail = Paragraph("<para align=center><font size=8>❌</font></para>", styles['Normal'])
            
            if not thumbnail:
                thumbnail = Paragraph("<para align=center><font size=8>📎</font></para>", styles['Normal'])
            
            data.append([
                str(idx),
                thumbnail,
                document.get('filename', 'N/A'),
                formatted_date
            ])
        
        table = Table(data, colWidths=[0.5*inch, 1.2*inch, 2.8*inch, 1.6*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8B5A2B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),  # N° centré
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),  # Visuel centré
            ('ALIGN', (2, 0), (-1, -1), 'LEFT'),   # Reste à gauche
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F1EC')])
        ]))
        
        story.append(table)
        story.append(Spacer(1, 30))
    else:
        story.append(Paragraph("Aucun document téléversé", styles['Normal']))
        story.append(Spacer(1, 20))
    
    # Section Note avec design amélioré
    if category_note and category_note.get('note'):
        # Bandeau titre section
        note_title_table = Table([[Paragraph("Niveau ou note obtenue", section_title_style)]], colWidths=[5.5*inch])
        note_title_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F4EAE3')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8)
        ]))
        story.append(note_title_table)
        story.append(Spacer(1, 15))
        
        # Encadré pour la note - BIEN CENTRÉ
        note_content = f"""
        <para align=center spaceAfter=0>
            <font size=36 color='#8B5A2B'><b>{category_note['note']}</b></font>
        </para>
        """
        note_data = [[Paragraph(note_content, styles['Normal'])]]
        note_table = Table(note_data, colWidths=[4.5*inch])
        note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFFBF0')),
            ('BOX', (0, 0), (-1, -1), 4, colors.HexColor('#8B5A2B')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 30),
            ('RIGHTPADDING', (0, 0), (-1, -1), 30),
            ('TOPPADDING', (0, 0), (-1, -1), 35),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 35),
            ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#D4A574')),
            ('LINEBELOW', (0, -1), (-1, -1), 2, colors.HexColor('#D4A574'))
        ]))
        
        # Centrer le tableau de note
        note_wrapper = Table([[note_table]], colWidths=[5.5*inch])
        note_wrapper.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
        ]))
        
        story.append(note_wrapper)
        story.append(Spacer(1, 12))
        
        # Date de validation avec icône
        if category_note.get('validated_at'):
            try:
                dt = datetime.fromisoformat(category_note['validated_at'].replace('Z', '+00:00'))
                formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
            except:
                formatted_date = category_note['validated_at']
            
            validation_text = f"✓ Note validée le {formatted_date}"
            validation_para = Paragraph(f"<para align=center fontSize=9 textColor='#6B7280'><i>{validation_text}</i></para>", styles['Normal'])
            
            validation_table = Table([[validation_para]], colWidths=[5.5*inch])
            validation_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E8F5E9')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#A5D6A7'))
            ]))
            story.append(validation_table)
    else:
        # Message si pas de note
        no_note_para = Paragraph("<para align=center fontSize=11 textColor='grey'><i>Note non encore validée</i></para>", styles['Normal'])
        no_note_table = Table([[no_note_para]], colWidths=[5.5*inch])
        no_note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F5F5')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E0E0E0'))
        ]))
        story.append(no_note_table)
    
    story.append(Spacer(1, 30))
    
    # Footer professionnel
    footer_text = f"Document généré le {datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M')} - TerciForm © 2025"
    footer_para = Paragraph(f"<para align=center fontSize=10 textColor='#6B7280'><i>{footer_text}</i></para>", styles['Normal'])
    
    footer_table = Table([[footer_para]], colWidths=[7.0*inch])
    footer_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#CCCCCC'))
    ]))
    story.append(footer_table)
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    # Retourner le PDF
    filename = f"{category}_{student.get('name', 'eleve').replace(' ', '_')}.pdf"
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.post("/students/{student_id}/category-notes/{category}/send-by-email")
async def send_category_pdf_by_email(
    student_id: str,
    category: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le PDF de synthèse par email via Gmail SMTP"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer les emails destinataires
    to_emails_str = data.get('to', '')
    subject = data.get('subject', 'Document de synthèse')
    body = data.get('body', '')
    
    # Parser les emails (séparés par virgules)
    to_emails = [email.strip() for email in to_emails_str.split(',') if email.strip()]
    
    if not to_emails:
        raise HTTPException(status_code=400, detail="Au moins un destinataire requis")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer les documents
    documents = await db.student_documents.find(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    ).to_list(100)
    
    # Récupérer la note
    category_note = await db.student_category_notes.find_one(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    )
    
    # Mapping des catégories
    category_titles = {
        "positionnement": "Test de positionnement",
        "evaluation_cours": "Évaluations en cours de formation",
        "evaluation_fin": "Évaluations de fin de formation"
    }
    category_title = category_titles.get(category, category)
    
    # Générer le PDF (même logique que preview_pdf endpoint)
    try:
        buffer = io.BytesIO()
        # Configuration pour éviter les sauts de page automatiques
        doc_pdf = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            topMargin=30, 
            bottomMargin=30,
            leftMargin=30,
            rightMargin=30,
            allowSplitting=1  # Permet de couper les éléments si nécessaire
        )
        story = []
        styles = getSampleStyleSheet()
        
        # Styles personnalisés
        title_style_white = ParagraphStyle(
            'CustomTitleWhite',
            parent=styles['Heading1'],
            fontSize=22,
            textColor=colors.white,
            alignment=1,
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=14,
            textColor=colors.HexColor('#6B4522'),
            alignment=1,
            spaceAfter=30,
            fontName='Helvetica-Oblique'
        )
        
        section_title_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#8B5A2B'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )
        
        # Logo
        logo_path = ROOT_DIR / "assets" / "logo_terciform.png"
        if logo_path.exists():
            try:
                logo = Image(str(logo_path), width=2.5*inch, height=1.06*inch)
                logo.hAlign = 'CENTER'
                logo_table = Table([[logo]], colWidths=[5.5*inch])
                logo_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 15),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F1EC')),
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#8B5A2B'))
                ]))
                story.append(logo_table)
                story.append(Spacer(1, 25))
            except Exception as e:
                logger.warning(f"Logo not loaded: {e}")
        
        # Titre
        title_table = Table([[Paragraph(f"{category_title}", title_style_white)]], colWidths=[5.5*inch])
        title_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#8B5A2B')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15)
        ]))
        story.append(title_table)
        story.append(Spacer(1, 15))
        story.append(Paragraph(f"<para align=center fontSize=13><b>Élève :</b> {student.get('name', 'N/A')}</para>", subtitle_style))
        story.append(Spacer(1, 25))
        
        # Section Documents - AVEC APERÇUS VISUELS (même logique que preview_pdf)
        temp_files_to_cleanup = []
        
        if documents:
            # Titre de section
            story.append(Spacer(1, 5))
            section_line = Table([['']], colWidths=[6.5*inch])
            section_line.setStyle(TableStyle([
                ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#8B5A2B'))
            ]))
            story.append(section_line)
            story.append(Spacer(1, 8))
            story.append(Paragraph("<font size=14 color='#8B5A2B'><b>Documents téléversés</b></font>", styles['Normal']))
            story.append(Spacer(1, 12))
            
            # Pour chaque document
            for idx, document in enumerate(documents, 1):
                uploaded_at = document.get('uploaded_at', '')
                if uploaded_at:
                    try:
                        dt = datetime.fromisoformat(uploaded_at.replace('Z', '+00:00'))
                        formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
                    except:
                        formatted_date = uploaded_at
                else:
                    formatted_date = 'Non disponible'
                
                filepath = Path(document.get('filepath', ''))
                mime = document.get('mime', '')
                filename = document.get('filename', 'N/A')
                
                # En-tête document
                doc_title_style_pro = ParagraphStyle(
                    'DocTitlePro',
                    parent=styles['Normal'],
                    fontSize=13,
                    textColor=colors.HexColor('#8B5A2B'),
                    fontName='Helvetica-Bold',
                    leading=16,
                    spaceAfter=4
                )
                
                doc_date_style = ParagraphStyle(
                    'DocDate',
                    parent=styles['Normal'],
                    fontSize=9,
                    textColor=colors.HexColor('#666666'),
                    fontName='Helvetica-Oblique',
                    leading=12,
                    spaceAfter=8
                )
                
                story.append(Paragraph(f"<b>Document {idx} : {filename}</b>", doc_title_style_pro))
                story.append(Paragraph(f"Date de réalisation : {formatted_date}", doc_date_style))
                
                # APERÇU VISUEL - conversion PDF en images
                if filepath.exists():
                    try:
                        if mime and 'pdf' in mime:
                            # Convertir le PDF en images avec PyMuPDF (pas besoin de poppler!)
                            logger.info(f"Converting PDF to images for email with PyMuPDF: {filepath}")
                            try:
                                pdf_document = fitz.open(str(filepath))
                                num_pages = min(len(pdf_document), 2)  # Maximum 2 pages
                                
                                for page_idx in range(num_pages):
                                    page = pdf_document[page_idx]
                                    # Convertir en image avec résolution 150 DPI
                                    mat = fitz.Matrix(150/72, 150/72)
                                    pix = page.get_pixmap(matrix=mat)
                                    
                                    # Sauvegarder temporairement
                                    temp_img_path = filepath.parent / f"temp_{uuid.uuid4().hex[:8]}.jpg"
                                    pix.save(str(temp_img_path))
                                    temp_files_to_cleanup.append(temp_img_path)
                                    
                                    story.append(Paragraph(f"<font size=10><b>Page {page_idx + 1}</b></font>", styles['Normal']))
                                    story.append(Spacer(1, 3))
                                    
                                    # Créer l'image ReportLab avec dimensions appropriées
                                    img_reportlab = Image(str(temp_img_path), width=6.0*inch, height=6.0*inch * pix.height / pix.width)
                                    img_reportlab.hAlign = 'CENTER'
                                    story.append(img_reportlab)
                                    story.append(Spacer(1, 8))
                                
                                pdf_document.close()
                                
                            except Exception as pdf_error:
                                logger.error(f"PDF conversion error in email: {pdf_error}")
                                story.append(Paragraph(f"Erreur conversion PDF: {str(pdf_error)}", styles['Normal']))
                        
                        elif mime and 'image' in mime:
                            img = Image(str(filepath), width=6.0*inch, height=None)
                            img.hAlign = 'CENTER'
                            story.append(img)
                            story.append(Spacer(1, 8))
                        
                        else:
                            story.append(Paragraph(f"Document de type : {mime or 'inconnu'}", styles['Normal']))
                    
                    except Exception as e:
                        logger.error(f"Could not create preview in email for {filename}: {e}")
                        story.append(Paragraph(f"Erreur aperçu: {str(e)}", styles['Normal']))
                else:
                    story.append(Paragraph("Fichier non trouvé", styles['Normal']))
                
                # Séparateur
                if idx < len(documents):
                    story.append(Spacer(1, 10))
                    sep_line = Table([['']], colWidths=[6.5*inch])
                    sep_line.setStyle(TableStyle([
                        ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.HexColor('#DDDDDD'))
                    ]))
                    story.append(sep_line)
                    story.append(Spacer(1, 10))
        
        # Note
        if category_note and category_note.get('note'):
            story.append(Paragraph("Niveau ou note obtenue", section_title_style))
            story.append(Spacer(1, 10))
            note_content = f"<para align=center spaceAfter=0><font size=36 color='#8B5A2B'><b>{category_note['note']}</b></font></para>"
            story.append(Paragraph(note_content, styles['Normal']))
            story.append(Spacer(1, 20))
        
        # Footer
        footer_text = f"Document généré le {datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M')} - TerciForm"
        story.append(Paragraph(f"<para align=center fontSize=8 textColor='grey'>{footer_text}</para>", styles['Normal']))
        
        doc_pdf.build(story)
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        
        # Nettoyer les fichiers temporaires
        for temp_file in temp_files_to_cleanup:
            try:
                if temp_file.exists():
                    temp_file.unlink()
            except Exception as e:
                logger.warning(f"Could not delete temp file {temp_file}: {e}")
        
        # Envoyer l'email avec Gmail SMTP
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_PASSWORD')
        
        if not gmail_user or not gmail_password:
            raise HTTPException(status_code=500, detail="Gmail credentials not configured")
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        # Corps du message
        msg.attach(MIMEText(body, 'plain'))
        
        # Attacher le PDF
        pdf_attachment = MIMEBase('application', 'pdf')
        pdf_attachment.set_payload(pdf_bytes)
        encoders.encode_base64(pdf_attachment)
        filename = f"{category}_{student.get('name', 'eleve').replace(' ', '_')}.pdf"
        pdf_attachment.add_header('Content-Disposition', f'attachment; filename={filename}')
        msg.attach(pdf_attachment)
        
        # Envoyer via SMTP
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"PDF email sent to {to_emails} for student {student_id}, category {category}")
        return {"message": "Email envoyé avec succès", "recipients": to_emails}
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'envoi: {str(e)}")


@api_router.delete("/students/{student_id}/documents/{document_id}")
async def delete_student_document(
    student_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Supprimer un document"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    document = await db.student_documents.find_one({"id": document_id, "student_id": student_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Supprimer le fichier
    filepath = Path(document['filepath'])
    if filepath.exists():
        filepath.unlink()
    
    # Supprimer de la base
    await db.student_documents.delete_one({"id": document_id})
    
    logger.info(f"Document deleted: {document['filename']} for student {student_id}")
    return {"message": "Document deleted"}


@api_router.get("/planning/events")
async def get_planning_events(
    current_user: User = Depends(get_current_user)
):
    """Récupérer tous les événements de planning du professeur"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    events = await db.planning_events.find(
        {"teacher_id": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    
    return events


@api_router.post("/planning/events")
async def create_planning_event(
    event_data: PlanningEventCreate,
    current_user: User = Depends(get_current_user)
):
    """Créer un nouvel événement de planning"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    event = PlanningEvent(
        **event_data.dict(),
        teacher_id=current_user.id
    )
    
    await db.planning_events.insert_one(event.dict())
    logger.info(f"Planning event created: {event.id} by teacher {current_user.id}")
    
    return event


@api_router.put("/planning/events/{event_id}")
async def update_planning_event(
    event_id: str,
    event_data: PlanningEventCreate,
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour un événement de planning"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'événement existe et appartient au professeur
    existing_event = await db.planning_events.find_one(
        {"id": event_id, "teacher_id": current_user.id},
        {"_id": 0}
    )
    
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Mettre à jour l'événement
    update_data = event_data.dict()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.planning_events.update_one(
        {"id": event_id, "teacher_id": current_user.id},
        {"$set": update_data}
    )
    
    # Récupérer l'événement mis à jour
    updated_event = await db.planning_events.find_one(
        {"id": event_id},
        {"_id": 0}
    )
    
    logger.info(f"Planning event updated: {event_id} by teacher {current_user.id}")
    return updated_event


@api_router.delete("/planning/events/{event_id}")
async def delete_planning_event(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Supprimer un événement de planning"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que l'événement existe et appartient au professeur
    existing_event = await db.planning_events.find_one(
        {"id": event_id, "teacher_id": current_user.id},
        {"_id": 0}
    )
    
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await db.planning_events.delete_one({"id": event_id, "teacher_id": current_user.id})
    
    logger.info(f"Planning event deleted: {event_id} by teacher {current_user.id}")
    return {"message": "Event deleted"}


class PlanningExportRequest(BaseModel):
    """Requête pour l'export PDF du planning"""
    month: str  # Format: "YYYY-MM"
    month_label: str  # Ex: "Janvier 2026"
    center_filter: Optional[str] = None  # Filtre par organisme (optionnel)


def generate_planning_grid_pdf(events: list, sessions: list, month: str, month_label: str, center_filter: str = None):
    """Générer un PDF du planning mensuel global"""
    buffer = io.BytesIO()
    
    # Utiliser le format paysage pour plus de lisibilité
    from reportlab.lib.pagesizes import A4, landscape
    page_size = landscape(A4)
    
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=page_size, 
        rightMargin=36,
        leftMargin=36, 
        topMargin=50,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Styles personnalisés
    title_style = ParagraphStyle(
        'TitleStyle', 
        parent=styles['Normal'], 
        fontSize=16, 
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1e3a5f'),
        alignment=TA_CENTER
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle', 
        parent=styles['Normal'], 
        fontSize=11,
        textColor=colors.HexColor('#6b7280'),
        alignment=TA_CENTER
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle', 
        parent=styles['Normal'], 
        fontSize=9, 
        fontName='Helvetica-Bold', 
        textColor=colors.white
    )
    
    cell_style = ParagraphStyle(
        'CellStyle', 
        parent=styles['Normal'], 
        fontSize=8, 
        leading=10, 
        wordWrap='CJK'
    )
    
    story = []
    
    # En-tête avec logo Terciform
    title_text = f"Planning - {month_label}"
    if center_filter:
        title_text += f" ({center_filter})"
    
    # Utiliser build_header pour avoir le logo Terciform
    story.append(build_header(title_text))
    story.append(Spacer(0, 12))
    
    # Combiner les événements planning et les sessions
    all_events = []
    
    # Ajouter les sessions de la BDD
    for session in sessions:
        if session.get('date', '').startswith(month):
            all_events.append({
                'date': session.get('date', ''),
                'start_time': session.get('start_time', ''),
                'end_time': session.get('end_time', ''),
                'title': session.get('subject', ''),
                'organism': session.get('organism', '') or session.get('student_organism', ''),
                'student_name': session.get('student_name', ''),
                'status': session.get('status', ''),
                'type': 'session',
                'modality': session.get('modality', 'distanciel'),
                'duration_hours': session.get('duration_hours', 0)
            })
    
    # Ajouter les événements planning locaux
    for event in events:
        if event.get('date', '').startswith(month):
            all_events.append({
                'date': event.get('date', ''),
                'start_time': event.get('start_time', ''),
                'end_time': event.get('end_time', ''),
                'title': event.get('title', ''),
                'organism': event.get('organism', ''),
                'student_name': '',
                'status': '',
                'type': 'event',
                'modality': event.get('modality', 'distanciel'),
                'duration_hours': 0
            })
    
    # Filtrer par centre si demandé
    if center_filter:
        all_events = [e for e in all_events if e.get('organism', '').lower() == center_filter.lower()]
    
    # Trier par date puis par heure
    all_events.sort(key=lambda x: (x.get('date', ''), x.get('start_time', '')))
    
    # Statistiques
    total_events = len(all_events)
    total_sessions = len([e for e in all_events if e['type'] == 'session'])
    total_hours = sum(e.get('duration_hours', 0) for e in all_events if e['type'] == 'session')
    
    stats_text = f"{total_events} événement(s) • {total_sessions} séance(s) • {total_hours}h de formation"
    story.append(Paragraph(stats_text, subtitle_style))
    story.append(Spacer(0, 15))
    
    if not all_events:
        story.append(Paragraph("Aucun événement pour cette période.", cell_style))
    else:
        # Tableau des événements
        # Colonnes: Date (15%) | Horaires (12%) | Intitulé (25%) | Élève (20%) | Organisme (15%) | Type (13%)
        col_widths = [
            0.12 * doc.width,  # Date
            0.10 * doc.width,  # Horaires
            0.28 * doc.width,  # Intitulé
            0.22 * doc.width,  # Élève
            0.15 * doc.width,  # Organisme
            0.13 * doc.width,  # Type/Modalité
        ]
        
        # En-tête du tableau
        table_data = [[
            Paragraph('Date', header_style),
            Paragraph('Horaires', header_style),
            Paragraph('Intitulé', header_style),
            Paragraph('Élève', header_style),
            Paragraph('Organisme', header_style),
            Paragraph('Type', header_style)
        ]]
        
        # Jours de la semaine en français
        days_fr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        
        for event in all_events:
            # Formater la date
            try:
                date_obj = datetime.strptime(event['date'], '%Y-%m-%d')
                day_name = days_fr[date_obj.weekday()]
                date_formatted = f"{day_name} {date_obj.strftime('%d/%m')}"
            except:
                date_formatted = event.get('date', '')
            
            # Horaires
            horaires = f"{event.get('start_time', '')} - {event.get('end_time', '')}"
            
            # Intitulé
            title = event.get('title', '')
            
            # Élève
            student = event.get('student_name', '') or '-'
            
            # Organisme
            organism = event.get('organism', '') or '-'
            
            # Type/Modalité
            if event['type'] == 'session':
                modality = '📹 Visio' if event.get('modality') == 'distanciel' else '📍 Présentiel'
            else:
                modality = '📋 Bloc planning'
            
            table_data.append([
                Paragraph(date_formatted, cell_style),
                Paragraph(horaires, cell_style),
                Paragraph(title, cell_style),
                Paragraph(student, cell_style),
                Paragraph(organism, cell_style),
                Paragraph(modality, cell_style)
            ])
        
        # Créer le tableau
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            # En-tête
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            
            # Corps
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1f2937')),
            
            # Alternance de couleurs pour les lignes
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            
            # Bordures
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            
            # Alignement
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Padding
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        story.append(table)
    
    # Footer avec date de génération
    story.append(Spacer(0, 20))
    footer_style = ParagraphStyle(
        'FooterStyle', 
        parent=styles['Normal'], 
        fontSize=8, 
        textColor=colors.HexColor('#9ca3af'),
        alignment=TA_CENTER
    )
    generation_date = datetime.now().strftime('%d/%m/%Y à %H:%M')
    story.append(Paragraph(f"Document généré le {generation_date} — Terciform", footer_style))
    
    # Construire le PDF
    doc.build(story)
    buffer.seek(0)
    return buffer


@api_router.post("/planning/export-pdf")
async def export_planning_pdf(
    request: PlanningExportRequest,
    current_user: User = Depends(get_current_user)
):
    """Exporter le planning mensuel en PDF"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Récupérer les événements planning du professeur
        planning_events = await db.planning_events.find(
            {"teacher_id": current_user.id},
            {"_id": 0}
        ).to_list(1000)
        
        # Récupérer les sessions du mois
        sessions = await db.sessions.find(
            {"date": {"$regex": f"^{request.month}"}},
            {"_id": 0}
        ).to_list(1000)
        
        # Générer le PDF
        pdf_buffer = generate_planning_grid_pdf(
            events=planning_events,
            sessions=sessions,
            month=request.month,
            month_label=request.month_label,
            center_filter=request.center_filter
        )
        
        logger.info(f"Planning PDF exported for month {request.month} by teacher {current_user.id}")
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Planning_{request.month_label.replace(' ', '_')}.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Error exporting planning PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


class ArchivedStudentsExportRequest(BaseModel):
    """Requête pour l'export PDF des sorties de parcours"""
    month_filter: Optional[str] = None
    students: list


def generate_archived_students_pdf(students: list, month_filter: str = None):
    """Générer un PDF des élèves ayant terminé leur parcours"""
    buffer = io.BytesIO()
    
    from reportlab.lib.pagesizes import A4
    page_size = A4
    
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=page_size, 
        rightMargin=40,
        leftMargin=40, 
        topMargin=50,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        'HeaderStyle', 
        parent=styles['Normal'], 
        fontSize=9, 
        fontName='Helvetica-Bold', 
        textColor=colors.white
    )
    
    cell_style = ParagraphStyle(
        'CellStyle', 
        parent=styles['Normal'], 
        fontSize=8, 
        leading=10, 
        wordWrap='CJK'
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle', 
        parent=styles['Normal'], 
        fontSize=11,
        textColor=colors.HexColor('#6b7280'),
        alignment=TA_CENTER
    )
    
    story = []
    
    # En-tête avec logo
    title_text = "Sorties de parcours"
    if month_filter:
        month_names = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        try:
            year, month_num = month_filter.split('-')
            title_text += f" - {month_names[int(month_num)]} {year}"
        except:
            pass
    
    story.append(build_header(title_text))
    story.append(Spacer(0, 12))
    
    # Statistiques
    total_students = len(students)
    total_hours = sum(s.get('total_hours', 0) for s in students)
    stats_text = f"{total_students} élève(s) • {total_hours}h de formation réalisées au total"
    story.append(Paragraph(stats_text, subtitle_style))
    story.append(Spacer(0, 15))
    
    if not students:
        story.append(Paragraph("Aucun élève historisé pour cette période.", cell_style))
    else:
        # Tableau
        col_widths = [
            0.25 * doc.width,  # Nom
            0.20 * doc.width,  # Organisme
            0.20 * doc.width,  # Email
            0.12 * doc.width,  # Heures réalisées
            0.10 * doc.width,  # Heures restantes
            0.13 * doc.width,  # Date sortie
        ]
        
        table_data = [[
            Paragraph('Élève', header_style),
            Paragraph('Organisme', header_style),
            Paragraph('Email', header_style),
            Paragraph('Heures réalisées', header_style),
            Paragraph('Restantes', header_style),
            Paragraph('Date sortie', header_style)
        ]]
        
        for student in students:
            # Formater la date de sortie
            exit_date = student.get('exit_date', '')
            if exit_date:
                try:
                    date_obj = datetime.strptime(exit_date, '%Y-%m-%d')
                    exit_formatted = date_obj.strftime('%d/%m/%Y')
                except:
                    exit_formatted = exit_date
            else:
                exit_formatted = '-'
            
            name = f"{student.get('name', '')} {student.get('last_name', '')}"
            organism = student.get('organism', '') or '-'
            email = student.get('email', '') or '-'
            total_hours = f"{student.get('total_hours', 0)}h"
            remaining = f"{student.get('credit_hours', 0)}h"
            
            table_data.append([
                Paragraph(name, cell_style),
                Paragraph(organism, cell_style),
                Paragraph(email, cell_style),
                Paragraph(total_hours, cell_style),
                Paragraph(remaining, cell_style),
                Paragraph(exit_formatted, cell_style)
            ])
        
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1f2937')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('ALIGN', (3, 1), (4, -1), 'CENTER'),  # Centrer les heures
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        story.append(table)
    
    # Footer
    story.append(Spacer(0, 20))
    footer_style = ParagraphStyle(
        'FooterStyle', 
        parent=styles['Normal'], 
        fontSize=8, 
        textColor=colors.HexColor('#9ca3af'),
        alignment=TA_CENTER
    )
    generation_date = datetime.now().strftime('%d/%m/%Y à %H:%M')
    story.append(Paragraph(f"Document généré le {generation_date} — Terciform", footer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


@api_router.post("/students/archived/export-pdf")
async def export_archived_students_pdf(
    request: ArchivedStudentsExportRequest,
    current_user: User = Depends(get_current_user)
):
    """Exporter la liste des élèves historisés (sorties de parcours) en PDF"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        pdf_buffer = generate_archived_students_pdf(
            students=request.students,
            month_filter=request.month_filter
        )
        
        month_suffix = f"_{request.month_filter}" if request.month_filter else ""
        filename = f"Sorties_Parcours{month_suffix}.pdf"
        
        logger.info(f"Archived students PDF exported by teacher {current_user.id}")
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        logger.error(f"Error exporting archived students PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


# Fonction supprimée - PyMuPDF utilisé directement dans le code


@api_router.get("/pdf/preview")
async def preview_pdf(
    student_id: str,
    category: str,
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint pour prévisualiser le PDF d'une catégorie (Tests/Évaluations)
    Retourne le PDF en flux binaire avec headers same-origin pour aperçu iframe
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Récupérer les documents de la catégorie
    documents = await db.student_documents.find(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    ).to_list(100)
    
    # Récupérer la note de la catégorie
    category_note = await db.student_category_notes.find_one(
        {"student_id": student_id, "category": category},
        {"_id": 0}
    )
    
    # Mapping des catégories vers titres français
    category_titles = {
        "positionnement": "Test de positionnement",
        "evaluation_cours": "Évaluations en cours de formation",
        "evaluation_fin": "Évaluations de fin de formation"
    }
    
    category_title = category_titles.get(category, category)
    
    # Générer le PDF (même logique que generate_category_pdf)
    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()
    
    # Styles personnalisés
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#8B5A2B'),
        alignment=1,  # Center
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#6B4522'),
        alignment=1,
        spaceAfter=30,
        fontName='Helvetica-Oblique'
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#8B5A2B'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    # En-tête avec logo - Design professionnel
    logo_path = ROOT_DIR / "assets" / "logo_terciform.png"
    if logo_path.exists():
        try:
            logo = Image(str(logo_path), width=3.0*inch, height=1.27*inch)
            logo.hAlign = 'CENTER'
            
            logo_table = Table([[logo]], colWidths=[7.0*inch])
            logo_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 20),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#8B5A2B'))
            ]))
            story.append(logo_table)
            story.append(Spacer(1, 20))
        except Exception as e:
            logger.warning(f"Logo not loaded: {e}")
    
    # Titre principal - Design amélioré
    title_style_white = ParagraphStyle(
        'CustomTitleWhite',
        parent=styles['Heading1'],
        fontSize=26,
        textColor=colors.white,
        alignment=1,
        fontName='Helvetica-Bold',
        leading=32
    )
    
    title_table = Table([[Paragraph(f"{category_title}", title_style_white)]], colWidths=[7.0*inch])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#8B5A2B')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20)
    ]))
    
    story.append(title_table)
    story.append(Spacer(1, 5))
    
    # Bandeau nom de l'élève
    student_style = ParagraphStyle(
        'StudentName',
        parent=styles['Normal'],
        fontSize=16,
        textColor=colors.HexColor('#6B4522'),
        alignment=1,
        fontName='Helvetica-Bold',
        leading=20
    )
    
    student_table = Table([[Paragraph(f"Élève : {student.get('name', 'N/A')}", student_style)]], colWidths=[7.0*inch])
    student_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F4EAE3')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#8B5A2B'))
    ]))
    
    story.append(student_table)
    story.append(Spacer(1, 30))
    
    # Section Documents - Professionnel et lisible
    temp_files_to_cleanup = []  # Liste des fichiers temporaires à nettoyer
    
    if documents:
        # Titre de section avec ligne de séparation
        story.append(Spacer(1, 5))
        section_line = Table([['']], colWidths=[6.5*inch])
        section_line.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#8B5A2B'))
        ]))
        story.append(section_line)
        story.append(Spacer(1, 8))
        story.append(Paragraph("<font size=14 color='#8B5A2B'><b>Documents téléversés</b></font>", styles['Normal']))
        story.append(Spacer(1, 12))
        
        # Pour chaque document, afficher un aperçu visuel complet
        for idx, document in enumerate(documents, 1):
            uploaded_at = document.get('uploaded_at', '')
            if uploaded_at:
                try:
                    dt = datetime.fromisoformat(uploaded_at.replace('Z', '+00:00'))
                    formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
                except:
                    formatted_date = uploaded_at
            else:
                formatted_date = 'Non disponible'
            
            filepath = Path(document.get('filepath', ''))
            mime = document.get('mime', '')
            filename = document.get('filename', 'N/A')
            
            # En-tête document professionnel et compact
            doc_title_style_pro = ParagraphStyle(
                'DocTitlePro',
                parent=styles['Normal'],
                fontSize=13,
                textColor=colors.HexColor('#8B5A2B'),
                fontName='Helvetica-Bold',
                leading=16,
                spaceAfter=4
            )
            
            doc_date_style = ParagraphStyle(
                'DocDate',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#666666'),
                fontName='Helvetica-Oblique',
                leading=12,
                spaceAfter=8
            )
            
            # Titre du document
            story.append(Paragraph(f"<b>Document {idx} : {filename}</b>", doc_title_style_pro))
            # Date de réalisation
            story.append(Paragraph(f"Date de réalisation : {formatted_date}", doc_date_style))
            
            # APERÇU VISUEL COMPLET - PDFs convertis en images avec PyMuPDF
            if filepath.exists():
                try:
                    if mime and 'pdf' in mime:
                        # Convertir le PDF en images avec PyMuPDF (pas besoin de poppler!)
                        logger.info(f"Converting PDF to images with PyMuPDF: {filepath}")
                        try:
                            pdf_document = fitz.open(str(filepath))
                            num_pages = min(len(pdf_document), 2)  # Maximum 2 pages
                            
                            logger.info(f"PDF has {len(pdf_document)} pages, converting {num_pages} pages")
                            
                            for page_idx in range(num_pages):
                                page = pdf_document[page_idx]
                                # Convertir en image avec résolution 150 DPI
                                mat = fitz.Matrix(150/72, 150/72)  # 150 DPI
                                pix = page.get_pixmap(matrix=mat)
                                
                                # Sauvegarder temporairement
                                temp_img_path = filepath.parent / f"temp_{uuid.uuid4().hex[:8]}.jpg"
                                pix.save(str(temp_img_path))
                                temp_files_to_cleanup.append(temp_img_path)
                                
                                # Ajouter au PDF
                                story.append(Paragraph(f"<font size=10><b>Page {page_idx + 1}</b></font>", styles['Normal']))
                                story.append(Spacer(1, 3))
                                
                                # Créer l'image ReportLab avec dimensions appropriées
                                img_reportlab = Image(str(temp_img_path), width=6.0*inch, height=6.0*inch * pix.height / pix.width)
                                img_reportlab.hAlign = 'CENTER'
                                story.append(img_reportlab)
                                story.append(Spacer(1, 8))
                            
                            pdf_document.close()
                            
                        except Exception as pdf_error:
                            logger.error(f"PDF conversion error: {pdf_error}")
                            story.append(Paragraph(f"Erreur conversion PDF: {str(pdf_error)}", styles['Normal']))
                    
                    elif mime and 'image' in mime:
                        # Images : afficher directement
                        img = Image(str(filepath), width=6.0*inch, height=None)
                        img.hAlign = 'CENTER'
                        story.append(img)
                        story.append(Spacer(1, 8))
                    
                    else:
                        story.append(Paragraph(f"Document de type : {mime or 'inconnu'}", styles['Normal']))
                
                except Exception as e:
                    logger.error(f"Could not create preview for {filename}: {e}")
                    story.append(Paragraph(f"Erreur aperçu: {str(e)}", styles['Normal']))
            else:
                story.append(Paragraph("Fichier non trouvé", styles['Normal']))
            
            # Séparateur simple entre documents
            if idx < len(documents):
                story.append(Spacer(1, 10))
                sep_line = Table([['']], colWidths=[6.5*inch])
                sep_line.setStyle(TableStyle([
                    ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.HexColor('#DDDDDD'))
                ]))
                story.append(sep_line)
                story.append(Spacer(1, 10))
    
    else:
        story.append(Paragraph("Aucun document téléversé", styles['Normal']))
        story.append(Spacer(1, 20))
    
    # Section Note - Design professionnel
    if category_note and category_note.get('note'):
        # Titre de la section
        note_header = Table([
            [Paragraph("🎯 Niveau ou note obtenue", section_title_style)]
        ], colWidths=[7.0*inch])
        note_header.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F4EAE3')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#8B5A2B'))
        ]))
        story.append(note_header)
        story.append(Spacer(1, 20))
        
        # Note avec design élégant
        note_content = f"""
        <para align=center spaceAfter=0>
            <font size=48 color='#8B5A2B'><b>{category_note['note']}</b></font>
        </para>
        """
        note_data = [[Paragraph(note_content, styles['Normal'])]]
        note_table = Table(note_data, colWidths=[6.0*inch])
        note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFFBF0')),
            ('BOX', (0, 0), (-1, -1), 3, colors.HexColor('#8B5A2B')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 40),
            ('RIGHTPADDING', (0, 0), (-1, -1), 40),
            ('TOPPADDING', (0, 0), (-1, -1), 50),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 50)
        ]))
        
        note_wrapper = Table([[note_table]], colWidths=[7.0*inch])
        note_wrapper.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
        ]))
        
        story.append(note_wrapper)
        story.append(Spacer(1, 15))
        
        # Date de validation
        if category_note.get('validated_at'):
            try:
                dt = datetime.fromisoformat(category_note['validated_at'].replace('Z', '+00:00'))
                formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
            except:
                formatted_date = category_note['validated_at']
            
            validation_text = f"✓ Note validée le {formatted_date}"
            validation_para = Paragraph(f"<para align=center fontSize=11 textColor='#2E7D32'><b>{validation_text}</b></para>", styles['Normal'])
            
            validation_table = Table([[validation_para]], colWidths=[7.0*inch])
            validation_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E8F5E9')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#A5D6A7'))
            ]))
            story.append(validation_table)
    else:
        no_note_para = Paragraph("<para align=center fontSize=12 textColor='grey'><i>Note non encore validée</i></para>", styles['Normal'])
        no_note_table = Table([[no_note_para]], colWidths=[7.0*inch])
        no_note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F5F5')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E0E0E0'))
        ]))
        story.append(no_note_table)
    
    story.append(Spacer(1, 30))
    
    # Footer professionnel
    footer_text = f"Document généré le {datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M')} - TerciForm © 2025"
    footer_para = Paragraph(f"<para align=center fontSize=10 textColor='#6B7280'><i>{footer_text}</i></para>", styles['Normal'])
    
    footer_table = Table([[footer_para]], colWidths=[7.0*inch])
    footer_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#CCCCCC'))
    ]))
    story.append(footer_table)
    
    # Build PDF
    doc_pdf.build(story)
    buffer.seek(0)
    
    # Nettoyer les fichiers temporaires
    for temp_file in temp_files_to_cleanup:
        try:
            if temp_file.exists():
                temp_file.unlink()
        except Exception as e:
            logger.warning(f"Could not delete temp file {temp_file}: {e}")
    
    # Retourner le PDF avec headers same-origin pour iframe preview
    filename = f"apercu_{category}.pdf"
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Frame-Options": "SAMEORIGIN"
        }
    )


@api_router.get("/bilan-tests")
async def get_bilan_tests(
    periode: str = "mois",
    mois: str = "11",
    annee: str = "2025",
    parcours: str = "tous",
    matiere: str = "toutes",
    current_user: User = Depends(get_current_user)
):
    """Récupère le bilan global des tests pour tous les élèves du professeur"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculer les dates de début et fin pour le filtrage
    try:
        annee_int = int(annee)
        mois_int = int(mois)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year or month")
    
    if periode == "mois":
        # Filtrer sur un mois spécifique
        # Début du mois
        date_debut = datetime(annee_int, mois_int, 1, tzinfo=timezone.utc)
        # Fin du mois (dernier jour à 23:59:59)
        if mois_int == 12:
            date_fin = datetime(annee_int + 1, 1, 1, tzinfo=timezone.utc)
        else:
            date_fin = datetime(annee_int, mois_int + 1, 1, tzinfo=timezone.utc)
    else:
        # Filtrer sur toute l'année
        date_debut = datetime(annee_int, 1, 1, tzinfo=timezone.utc)
        date_fin = datetime(annee_int + 1, 1, 1, tzinfo=timezone.utc)
    
    # Récupérer tous les élèves du professeur
    students = await db.users.find(
        {"role": "student", "teacher_id": current_user.id},
        {"_id": 0}
    ).to_list(length=None)
    
    rows = []
    
    for student in students:
        # Filtrer par parcours si nécessaire
        student_parcours = student.get('parcours', '').lower()
        if parcours != "tous" and student_parcours != parcours.lower():
            continue
        
        # Récupérer les tests du student avec filtre de date
        resources = await db.student_resources.find(
            {
                "student_id": student['id'],
                "category": "TEST_PARCOURS",
                "status": "SOUMIS",
                "submitted_at": {
                    "$gte": date_debut,
                    "$lt": date_fin
                }
            },
            {"_id": 0}
        ).to_list(length=None)
        
        if not resources:
            continue
        
        # Organiser par sub_type
        tests_map = {}
        for r in resources:
            tests_map[r['sub_type']] = r
        
        t1 = tests_map.get('POSITIONNEMENT')
        t2 = tests_map.get('MI_PARCOURS')
        t3 = tests_map.get('FIN')
        
        # On ne garde que les élèves ayant au moins un test
        if not (t1 or t2 or t3):
            continue
        
        t1_score = t1['score'] if t1 else None
        t2_score = t2['score'] if t2 else None
        t3_score = t3['score'] if t3 else None
        
        # Calculer progression
        progression = None
        if t1_score is not None and t3_score is not None:
            progression = t3_score - t1_score
        
        # Niveau final
        niveau_final = "-"
        if t3_score is not None:
            if t3_score >= 60:
                niveau_final = "Acquis"
            elif t3_score >= 30:
                niveau_final = "En cours"
            else:
                niveau_final = "Non acquis"
        
        # Difficultés principales (analyse simple)
        difficulte = None
        remediation = False
        if t3_score is not None and t3_score < 40:
            if student_parcours == "bureautique":
                difficulte = "Fondamentaux bureautiques"
            elif student_parcours == "management":
                difficulte = "Situations managériales complexes"
            elif student_parcours == "anglais":
                difficulte = "Expression orale et écrite"
            else:
                difficulte = "Compétences de base"
            remediation = True
        
        # URL du rapport (si existe)
        rapport_url = None
        if t1 and t2 and t3:
            # Le rapport est disponible si les 3 tests sont faits
            rapport_url = f"/api/students/{student['id']}/magic-report"
        
        row = {
            "id": student['id'],
            "eleve": student.get('name', 'N/A'),
            "parcours": student_parcours.capitalize(),
            "matiere": student_parcours,  # Pour simplification, matière = parcours
            "t1": t1_score,
            "t2": t2_score,
            "t3": t3_score,
            "progression": progression,
            "niveauFinal": niveau_final,
            "difficultePrincipale": difficulte,
            "remediation": remediation,
            "rapportUrl": rapport_url
        }
        
        rows.append(row)
    
    # Calculer les indicateurs globaux
    nb = len(rows)
    
    if nb == 0:
        return {
            "periodeLabel": f"{mois}/{annee}" if periode == "mois" else annee,
            "nbEvaluations": 0,
            "progressionMoyenne": 0,
            "tauxAcquisition": 0,
            "tauxDifficulte": 0,
            "rows": []
        }
    
    # Progression moyenne
    progressions = [r['progression'] for r in rows if r['progression'] is not None]
    progression_moyenne = sum(progressions) / len(progressions) if progressions else 0
    
    # Taux d'acquisition (élèves avec T3 >= 60%)
    t3_vals = [r['t3'] for r in rows if r['t3'] is not None]
    nb_acquis = len([t for t in t3_vals if t >= 60])
    taux_acquisition = (nb_acquis / len(t3_vals)) * 100 if t3_vals else 0
    
    # Taux en difficulté (élèves avec T3 < 40%)
    nb_difficulte = len([t for t in t3_vals if t < 40])
    taux_difficulte = (nb_difficulte / len(t3_vals)) * 100 if t3_vals else 0
    
    return {
        "periodeLabel": f"{mois}/{annee}" if periode == "mois" else annee,
        "nbEvaluations": nb,
        "progressionMoyenne": progression_moyenne,
        "tauxAcquisition": taux_acquisition,
        "tauxDifficulte": taux_difficulte,
        "rows": rows
    }


@api_router.get("/bilan-tests-pdf")
async def generate_bilan_tests_pdf(
    periode: str = "mois",
    mois: str = "11",
    annee: str = "2025",
    parcours: str = "tous",
    matiere: str = "toutes",
    current_user: User = Depends(get_current_user)
):
    """Génère un PDF du bilan global des tests"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer les données (réutilise la logique de l'endpoint précédent)
    bilan_data = await get_bilan_tests(periode, mois, annee, parcours, matiere, current_user)
    
    # Créer le PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Logo
    logo_path = ROOT_DIR / "terciform_logo.png"
    if logo_path.exists():
        logo = Image(str(logo_path), width=2*inch, height=0.8*inch)
        story.append(logo)
        story.append(Spacer(1, 10))
    
    # Titre
    title_style = ParagraphStyle(
        'BilanTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#7c3aed'),
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph("Bilan Global des Tests", title_style))
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    story.append(Paragraph(f"Période: {bilan_data['periodeLabel']}", subtitle_style))
    story.append(Spacer(1, 20))
    
    # Indicateurs clés
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#7c3aed'),
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph("Indicateurs clés", section_style))
    
    indicateurs_data = [
        ['Évaluations réalisées', str(bilan_data['nbEvaluations'])],
        ['Progression moyenne T1 → T3', f"{bilan_data['progressionMoyenne']:.1f} points"],
        ['Taux d\'acquisition final', f"{bilan_data['tauxAcquisition']:.1f}%"],
        ['Élèves en difficulté', f"{bilan_data['tauxDifficulte']:.1f}%"]
    ]
    
    indicateurs_table = Table(indicateurs_data, colWidths=[3.5*inch, 2*inch])
    indicateurs_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F0F0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
    ]))
    story.append(indicateurs_table)
    story.append(Spacer(1, 30))
    
    # Tableau détaillé
    story.append(Paragraph("Résultats détaillés par élève", section_style))
    story.append(Spacer(1, 10))
    
    # En-tête du tableau
    table_data = [['Élève', 'Parcours', 'T1', 'T2', 'T3', 'Progression', 'Niveau']]
    
    # Lignes
    for row in bilan_data['rows']:
        table_data.append([
            row['eleve'],
            row['parcours'],
            f"{row['t1']:.1f}%" if row['t1'] is not None else "—",
            f"{row['t2']:.1f}%" if row['t2'] is not None else "—",
            f"{row['t3']:.1f}%" if row['t3'] is not None else "—",
            f"{'+' if row['progression'] and row['progression'] > 0 else ''}{row['progression']:.1f}" if row['progression'] is not None else "—",
            row['niveauFinal']
        ])
    
    results_table = Table(table_data, colWidths=[1.3*inch, 1*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.8*inch, 1*inch])
    results_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8F8F8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
    ]))
    story.append(results_table)
    story.append(Spacer(1, 20))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER
    )
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        f"Rapport généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} - Terciform",
        footer_style
    ))
    
    # Générer
    doc.build(story)
    buffer.seek(0)
    
    filename = f"Bilan_Tests_{parcours}_{mois}_{annee}.pdf"
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )



# ============================================================================
# LIVRET D'ACCUEIL - ENDPOINTS
# ============================================================================

@api_router.get("/livret-accueil")
async def get_livret_accueil():
    """
    Sert le fichier PDF du livret d'accueil
    """
    file_path = ROOT_DIR / "static" / "documents" / "livret_accueil_terciform.pdf"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Livret d'accueil non trouvé")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename="Livret_Accueil_TerciForm.pdf"
    )


@api_router.post("/students/{student_id}/sign-livret")
async def sign_livret_accueil(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Enregistre la signature du livret d'accueil par un élève
    """
    # Vérifier que l'utilisateur est bien l'élève concerné
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Vérifier que l'élève existe
    student = await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    
    # Enregistrer la signature
    signature_data = {
        "signed": True,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "signature": data.get("signature"),
        "accepted_checkbox": data.get("accepted_checkbox", False)
    }
    
    await db.users.update_one(
        {"id": student_id},
        {"$set": {"livret_accueil": signature_data}}
    )
    
    # Logger la signature du livret d'accueil (traçabilité Qualiopi)
    await log_student_activity(
        student_id=student_id,
        student_name=student.get("name", ""),
        action="livret_accueil_signed",
        details={"signed_at": signature_data["signed_at"]}
    )
    
    return {
        "success": True,
        "message": "Livret d'accueil signé avec succès",
        "signed_at": signature_data["signed_at"]
    }


@api_router.get("/students/{student_id}/livret-status")
async def get_livret_status(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Récupère le statut de signature du livret d'accueil d'un élève
    """
    # Vérifier les permissions
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    student = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0, "livret_accueil": 1}
    )
    
    if not student:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    
    livret_accueil = student.get("livret_accueil", {})
    
    return {
        "signed": livret_accueil.get("signed", False),
        "signed_at": livret_accueil.get("signed_at"),
        "signature": livret_accueil.get("signature") if current_user.role == "teacher" else None
    }


@api_router.post("/students/{student_id}/evolution-report")
async def generate_student_evolution_report(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Génère un rapport d'évolution des compétences pour un élève
    Basé sur les résultats des tests T1, T2, T3
    """
    # Seuls les enseignants peuvent générer le rapport
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès réservé aux enseignants")
    
    # Récupérer l'élève
    student = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0}
    )
    
    if not student:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    
    # Extraire les données du body
    parcours = data.get('parcours', '')
    t1 = data.get('t1')
    t2 = data.get('t2')
    t3 = data.get('t3')
    themes = data.get('themes', [])
    
    # Validation
    if not parcours:
        raise HTTPException(status_code=400, detail="Le parcours est requis")
    
    if t1 is None or t2 is None or t3 is None:
        raise HTTPException(status_code=400, detail="Les scores T1, T2 et T3 sont requis")
    
    # Générer le rapport
    date_rapport = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    horodatage = datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M:%S")
    
    rapport, erreur = generate_evolution_report(
        nom_apprenant=student.get('name'),
        parcours=parcours,
        t1=t1,
        t2=t2,
        t3=t3,
        themes=themes,
        date_rapport=date_rapport,
        horodatage=horodatage
    )
    
    if erreur:
        raise HTTPException(status_code=400, detail=erreur)
    
    logger.info(f"📊 Rapport d'évolution généré pour {student.get('name')} - Parcours: {parcours}")
    
    return rapport


@api_router.get("/students/{student_id}/history")
async def get_student_history(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Récupère l'historique complet des actions et événements d'un élève
    Horodaté avec jour, heure et date pour traçabilité complète
    """
    # Seuls les enseignants peuvent accéder à l'historique
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès réservé aux enseignants")
    
    # Vérifier que l'élève existe
    student = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0}
    )
    
    if not student:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    
    history = []
    
    # 1. Récupérer l'historique de connexion (si disponible dans user)
    if student.get('last_login'):
        history.append({
            "timestamp": student['last_login'],
            "type": "connection",
            "category": "Connexion",
            "title": "Dernière connexion à l'espace élève",
            "description": f"L'élève s'est connecté à son espace TerciLog",
            "metadata": {}
        })
    
    # Date de création du compte
    if student.get('created_at'):
        history.append({
            "timestamp": student['created_at'],
            "type": "account",
            "category": "Compte",
            "title": "Création du compte élève",
            "description": f"Compte créé pour {student.get('name')}",
            "metadata": {
                "email": student.get('email')
            }
        })
    
    # 2. Récupérer toutes les séances (confirmées, émargées, etc.)
    sessions = await db.sessions.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    
    for session in sessions:
        # Événement: Séance créée
        if session.get('created_at'):
            history.append({
                "timestamp": session['created_at'],
                "type": "session",
                "category": "Séance",
                "title": f"Séance de {session.get('subject', 'Formation')} créée",
                "description": f"Date: {session.get('date')} de {session.get('start_time')} à {session.get('end_time')}",
                "metadata": {
                    "session_id": session.get('id'),
                    "modalité": session.get('modality', 'distanciel')
                }
            })
        
        # Événement: Email de confirmation envoyé
        if session.get('confirmation_email_sent'):
            history.append({
                "timestamp": session.get('confirmation_sent_at') or session.get('created_at'),
                "type": "email",
                "category": "Email",
                "title": "Email de confirmation envoyé",
                "description": f"Email de confirmation pour la séance de {session.get('subject')}",
                "metadata": {
                    "session_id": session.get('id'),
                    "email": student.get('email')
                }
            })
        
        # Événement: Séance confirmée par l'élève
        if session.get('status') == 'confirmed' and session.get('validated_at'):
            history.append({
                "timestamp": session['validated_at'],
                "type": "request",
                "category": "Validation",
                "title": "Séance confirmée par l'élève",
                "description": f"L'élève a confirmé sa présence pour la séance de {session.get('subject')}",
                "metadata": {
                    "session_id": session.get('id'),
                    "date": session.get('date')
                }
            })
        
        # Événement: Séance émargée (signature)
        if session.get('signature_status') == 'signed' and session.get('signed_at'):
            history.append({
                "timestamp": session['signed_at'],
                "type": "signature",
                "category": "Émargement",
                "title": "Séance émargée",
                "description": f"L'élève a signé électroniquement la feuille d'émargement pour la séance de {session.get('subject')}",
                "metadata": {
                    "session_id": session.get('id'),
                    "date": session.get('date'),
                    "durée": f"{session.get('duration_hours', 0)}h"
                }
            })
        
        # Événement: Email d'émargement envoyé
        if session.get('attendance_email_sent'):
            history.append({
                "timestamp": session.get('attendance_sent_at') or session.get('date'),
                "type": "email",
                "category": "Email",
                "title": "Email d'émargement envoyé",
                "description": f"Lien d'émargement envoyé pour la séance de {session.get('subject')}",
                "metadata": {
                    "session_id": session.get('id')
                }
            })
        
        # Événement: Rappel 30 min envoyé
        if session.get('reminder_email_sent'):
            # Calculer le timestamp du rappel (30 min avant la séance)
            session_datetime = f"{session.get('date')} {session.get('start_time')}"
            history.append({
                "timestamp": session_datetime,
                "type": "notification",
                "category": "Notification",
                "title": "Rappel automatique envoyé",
                "description": f"Email de rappel envoyé 30 minutes avant la séance de {session.get('subject')}",
                "metadata": {
                    "session_id": session.get('id')
                }
            })
    
    # 3. Récupérer les questionnaires soumis (ancien système)
    questionnaires = await db.questionnaires.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    
    for questionnaire in questionnaires:
        if questionnaire.get('submitted_at'):
            history.append({
                "timestamp": questionnaire['submitted_at'],
                "type": "document",
                "category": "Questionnaire",
                "title": f"Questionnaire {questionnaire.get('template_name', 'Formation')} soumis",
                "description": f"L'élève a complété et signé le questionnaire",
                "metadata": {
                    "questionnaire_id": questionnaire.get('id'),
                    "parcours": questionnaire.get('parcours', '')
                }
            })
    
    # 3b. Questionnaire Q1 (formation_needs_questionnaires)
    q1 = await db.formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if q1 and q1.get('submitted_at'):
        history.append({
            "timestamp": q1['submitted_at'],
            "type": "questionnaire",
            "category": "Questionnaire Q1",
            "title": "Questionnaire Q1 - Début de formation",
            "description": "L'élève a rempli le questionnaire de début de formation (analyse des besoins)",
            "metadata": {
                "parcours": q1.get('parcours', '')
            }
        })
    
    # 3c. Questionnaire Q2 (mid_course_questionnaires)
    q2 = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if q2 and q2.get('submitted_at'):
        history.append({
            "timestamp": q2['submitted_at'],
            "type": "questionnaire",
            "category": "Questionnaire Q2",
            "title": "Questionnaire Q2 - Mi-parcours",
            "description": "L'élève a rempli le questionnaire à mi-parcours",
            "metadata": {
                "parcours": q2.get('parcours', '')
            }
        })
    
    # 3d. Questionnaire Q3 (end_course_questionnaires)
    q3 = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if q3 and q3.get('submitted_at'):
        history.append({
            "timestamp": q3['submitted_at'],
            "type": "questionnaire",
            "category": "Questionnaire Q3",
            "title": "Questionnaire Q3 - Fin de formation",
            "description": "L'élève a rempli le questionnaire de fin de formation",
            "metadata": {
                "parcours": q3.get('parcours', '')
            }
        })
    
    # 3e. Tests T1, T2, T3 (student_resources avec status SOUMIS)
    tests = await db.student_resources.find({
        "student_id": student_id,
        "resource_type": "TEST",
        "status": "SOUMIS"
    }, {"_id": 0}).to_list(100)
    
    for test in tests:
        if test.get('submitted_at'):
            # Déterminer le type de test
            test_name = test.get('template_name', test.get('name', 'Test'))
            test_category = "Test"
            if "positionnement" in test_name.lower() or "début" in test_name.lower() or "t1" in test_name.lower():
                test_category = "Test T1"
            elif "mi" in test_name.lower() or "t2" in test_name.lower():
                test_category = "Test T2"
            elif "fin" in test_name.lower() or "t3" in test_name.lower():
                test_category = "Test T3"
            
            history.append({
                "timestamp": test['submitted_at'].isoformat() if hasattr(test['submitted_at'], 'isoformat') else str(test['submitted_at']),
                "type": "test",
                "category": test_category,
                "title": f"{test_category} - {test_name}",
                "description": f"L'élève a passé le test - Score: {test.get('score', 'N/A')}%",
                "metadata": {
                    "test_name": test_name,
                    "score": test.get('score', 'N/A'),
                    "parcours": test.get('parcours', '')
                }
            })
    
    # 4. Livret d'accueil signé
    if student.get('livret_accueil', {}).get('signed'):
        history.append({
            "timestamp": student['livret_accueil']['signed_at'],
            "type": "livret",
            "category": "Livret d'accueil",
            "title": "Livret d'accueil signé",
            "description": "L'élève a signé électroniquement le livret d'accueil TerciForm",
            "metadata": {}
        })
    
    # 5. Documents téléchargés par l'élève
    documents = await db.documents.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    
    for doc in documents:
        if doc.get('downloaded_at'):
            history.append({
                "timestamp": doc['downloaded_at'],
                "type": "document",
                "category": "Document",
                "title": f"Document téléchargé: {doc.get('name', 'Document')}",
                "description": f"L'élève a téléchargé un document",
                "metadata": {
                    "document_id": doc.get('id'),
                    "catégorie": doc.get('category', '')
                }
            })
    
    # 6. Récupérer les logs d'activité (traçabilité Qualiopi)
    activity_logs = await db.student_activity_logs.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    
    # Mapping des actions vers des libellés français
    action_labels = {
        "login": ("Connexion", "L'élève s'est connecté à son espace TerciLog"),
        "logout": ("Déconnexion", "L'élève s'est déconnecté de son espace"),
        "signature": ("Émargement", "L'élève a signé électroniquement une feuille de présence"),
        "questionnaire_q1": ("Questionnaire Q1", "L'élève a rempli le questionnaire de début de formation"),
        "questionnaire_q2": ("Questionnaire Q2", "L'élève a rempli le questionnaire à mi-parcours"),
        "questionnaire_q3": ("Questionnaire Q3", "L'élève a rempli le questionnaire de fin de formation"),
        "test_t1": ("Test T1", "L'élève a passé le test de positionnement initial"),
        "test_t2": ("Test T2", "L'élève a passé le test intermédiaire"),
        "test_t3": ("Test T3", "L'élève a passé le test final"),
        "visio_join": ("Visioconférence", "L'élève a rejoint une séance en visioconférence"),
        "session_confirm": ("Confirmation", "L'élève a confirmé sa présence à une séance"),
        "contact_formateur": ("Contact formateur", "L'élève a contacté son formateur"),
        "view_planning": ("Consultation planning", "L'élève a consulté son planning"),
        "view_resources": ("Consultation ressources", "L'élève a consulté ses ressources"),
        "email_session_modified": ("Email modification", "Un email de modification de séance a été envoyé"),
        "livret_accueil_signed": ("Livret d'accueil", "L'élève a signé le livret d'accueil")
    }
    
    # Mapping des actions vers des types pour le filtrage frontend
    action_type_mapping = {
        "login": "login",
        "logout": "logout",
        "signature": "signature",
        "questionnaire_q1": "questionnaire",
        "questionnaire_q2": "questionnaire",
        "questionnaire_q3": "questionnaire",
        "test_t1": "test",
        "test_t2": "test",
        "test_t3": "test",
        "visio_join": "visio",
        "session_confirm": "session",
        "contact_formateur": "contact",
        "view_planning": "planning",
        "view_resources": "resources",
        "email_session_modified": "email",
        "livret_accueil_signed": "livret"
    }
    
    for log in activity_logs:
        action = log.get('action', 'unknown')
        label_info = action_labels.get(action, (action.replace("_", " ").title(), f"Action: {action}"))
        event_type = action_type_mapping.get(action, "activity")
        
        history.append({
            "timestamp": log.get('timestamp'),
            "type": event_type,  # Type spécifique pour le filtrage frontend
            "category": label_info[0],
            "title": label_info[0],
            "description": label_info[1],
            "metadata": log.get('details', {})
        })
    
    # Trier l'historique par date décroissante (plus récent en premier)
    history.sort(key=lambda x: x.get('timestamp', '') if x.get('timestamp') else '', reverse=True)
    
    logger.info(f"📊 Historique pour {student.get('name')}: {len(history)} événements")
    
    return {
        "student_id": student_id,
        "student_name": student.get('name'),
        "history": history,
        "total_events": len(history)
    }


@api_router.post("/students/{student_id}/log-visio")
async def log_visio_join(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Logger quand un élève rejoint une visioconférence (traçabilité Qualiopi)"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    await log_student_activity(
        student_id=student_id,
        student_name=current_user.name,
        action="visio_join",
        details={
            "session_id": data.get("session_id", ""),
            "meeting_link": data.get("meeting_link", "")
        }
    )
    
    return {"message": "Visioconférence enregistrée"}


@api_router.put("/sessions/{session_id}/times")
async def update_session_times(
    session_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Modifie les horaires d'une séance existante
    Si plusieurs créneaux sont fournis, supprime la séance actuelle et crée de nouvelles séances
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    # Récupérer la séance actuelle
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Séance non trouvée")
    
    time_slots = data.get('time_slots', [])
    
    if not time_slots:
        raise HTTPException(status_code=400, detail="Aucun créneau horaire fourni")
    
    # Si un seul créneau, mettre à jour la séance existante
    if len(time_slots) == 1:
        slot = time_slots[0]
        
        # Calculer la nouvelle durée (arrondi à 2 décimales)
        try:
            start_h, start_m = map(int, slot['start_time'].split(':'))
            end_h, end_m = map(int, slot['end_time'].split(':'))
            duration = round((end_h * 60 + end_m - start_h * 60 - start_m) / 60.0, 2)
        except:
            duration = session['duration_hours']
        
        # Calculer le nouveau montant
        hourly_rate = data.get('hourly_rate', session.get('hourly_rate', 0))
        amount = round(duration * hourly_rate, 2)
        
        # Mettre à jour la séance
        await db.sessions.update_one(
            {"id": session_id},
            {"$set": {
                "start_time": slot['start_time'],
                "end_time": slot['end_time'],
                "duration_hours": duration,
                "amount": amount
            }}
        )
        
        return {"message": "Horaires mis à jour avec succès", "sessions_created": 1}
    
    # Si plusieurs créneaux, supprimer la séance actuelle et créer de nouvelles séances
    else:
        created_sessions = []
        
        for slot in time_slots:
            # Calculer la durée (arrondi à 2 décimales)
            try:
                start_h, start_m = map(int, slot['start_time'].split(':'))
                end_h, end_m = map(int, slot['end_time'].split(':'))
                duration = round((end_h * 60 + end_m - start_h * 60 - start_m) / 60.0, 2)
            except:
                duration = 0.0
            
            # Calculer le montant
            hourly_rate = data.get('hourly_rate', session.get('hourly_rate', 0))
            amount = round(duration * hourly_rate, 2)
            
            # Calculer la deadline
            deadline = datetime.now(timezone.utc) + timedelta(hours=48)
            
            # Créer une nouvelle séance
            new_session = Session(
                subject=data.get('subject', session['subject']),
                date=data.get('date', session['date']),
                start_time=slot['start_time'],
                end_time=slot['end_time'],
                student_id=session['student_id'],
                student_name=session['student_name'],
                student_email=session['student_email'],
                validation_deadline=deadline.isoformat(),
                duration_hours=duration,
                meeting_link=data.get('meeting_link', session.get('meeting_link', '')),
                hourly_rate=hourly_rate,
                hourly_rate_source=session.get('hourly_rate_source', 'manual'),
                amount=amount,
                organism=session.get('organism', ''),
                modality=data.get('modality', session.get('modality', 'distanciel'))
            )
            
            doc = new_session.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.sessions.insert_one(doc)
            created_sessions.append(new_session.id)
        
        # Supprimer la séance originale
        await db.sessions.delete_one({"id": session_id})
        
        return {
            "message": f"{len(time_slots)} nouvelles séances créées avec succès",
            "sessions_created": len(time_slots),
            "new_session_ids": created_sessions
        }

        raise HTTPException(status_code=404, detail="Élève non trouvé")
    
    livret_accueil = student.get("livret_accueil", {})
    
    return {
        "signed": livret_accueil.get("signed", False),
        "signed_at": livret_accueil.get("signed_at"),
        "signature": livret_accueil.get("signature") if current_user.role == "teacher" else None
    }


# ========================================
# GESTION DES FORMATEURS (TRAINERS)
# ========================================

class FormateurBase(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    societe: str = ""
    telephone: str = ""
    siret: str = ""
    nda: str = ""
    matieres: List[str] = []

class FormateurCreate(FormateurBase):
    pass

class Formateur(FormateurBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    photo_url: str = ""
    cv_url: str = ""
    diplome1_url: str = ""
    diplome2_url: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.get("/formateurs")
async def get_formateurs(current_user: User = Depends(get_current_user)):
    """Récupère la liste des formateurs"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    formateurs = await db.formateurs.find({}, {"_id": 0}).to_list(1000)
    return formateurs

@api_router.get("/formateurs/{formateur_id}")
async def get_formateur(formateur_id: str, current_user: User = Depends(get_current_user)):
    """Récupère un formateur par son ID"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    formateur = await db.formateurs.find_one({"id": formateur_id}, {"_id": 0})
    if not formateur:
        raise HTTPException(status_code=404, detail="Formateur non trouvé")
    return formateur

@api_router.post("/formateurs")
async def create_formateur(
    nom: str = Form(...),
    prenom: str = Form(...),
    email: str = Form(...),
    societe: str = Form(""),
    telephone: str = Form(""),
    siret: str = Form(""),
    nda: str = Form(""),
    matieres: str = Form("[]"),
    photo: UploadFile = FastAPIFile(None),
    cv: UploadFile = FastAPIFile(None),
    diplome1: UploadFile = FastAPIFile(None),
    diplome2: UploadFile = FastAPIFile(None),
    current_user: User = Depends(get_current_user)
):
    """Crée un nouveau formateur avec upload de fichiers"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Vérifier si le formateur existe déjà
    existing = await db.formateurs.find_one({"email": email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Un formateur avec cet email existe déjà")
    
    # Parse des matières
    import json
    try:
        matieres_list = json.loads(matieres)
    except:
        matieres_list = []
    
    # Créer le dossier pour les fichiers formateurs
    formateurs_dir = Path("/app/backend/static/formateurs")
    formateurs_dir.mkdir(parents=True, exist_ok=True)
    
    formateur_id = str(uuid.uuid4())
    formateur_folder = formateurs_dir / formateur_id
    formateur_folder.mkdir(parents=True, exist_ok=True)
    
    # Initialiser URLs
    photo_url = ""
    cv_url = ""
    diplome1_url = ""
    diplome2_url = ""
    
    # Sauvegarder la photo
    if photo and photo.filename:
        ext = Path(photo.filename).suffix
        photo_path = formateur_folder / f"photo{ext}"
        content = await photo.read()
        with open(photo_path, "wb") as f:
            f.write(content)
        photo_url = f"/static/formateurs/{formateur_id}/photo{ext}"
    
    # Sauvegarder le CV
    if cv and cv.filename:
        ext = Path(cv.filename).suffix
        cv_path = formateur_folder / f"cv{ext}"
        content = await cv.read()
        with open(cv_path, "wb") as f:
            f.write(content)
        cv_url = f"/static/formateurs/{formateur_id}/cv{ext}"
    
    # Sauvegarder le diplôme 1
    if diplome1 and diplome1.filename:
        ext = Path(diplome1.filename).suffix
        diplome1_path = formateur_folder / f"diplome1{ext}"
        content = await diplome1.read()
        with open(diplome1_path, "wb") as f:
            f.write(content)
        diplome1_url = f"/static/formateurs/{formateur_id}/diplome1{ext}"
    
    # Sauvegarder le diplôme 2
    if diplome2 and diplome2.filename:
        ext = Path(diplome2.filename).suffix
        diplome2_path = formateur_folder / f"diplome2{ext}"
        content = await diplome2.read()
        with open(diplome2_path, "wb") as f:
            f.write(content)
        diplome2_url = f"/static/formateurs/{formateur_id}/diplome2{ext}"
    
    # Créer le document formateur
    now = datetime.now(timezone.utc)
    formateur_doc = {
        "id": formateur_id,
        "nom": nom,
        "prenom": prenom,
        "email": email.lower(),
        "societe": societe,
        "telephone": telephone,
        "siret": siret,
        "nda": nda,
        "matieres": matieres_list,
        "photo_url": photo_url,
        "cv_url": cv_url,
        "diplome1_url": diplome1_url,
        "diplome2_url": diplome2_url,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.formateurs.insert_one(formateur_doc)
    
    # Retourner sans _id
    del formateur_doc["_id"] if "_id" in formateur_doc else None
    
    return formateur_doc

@api_router.patch("/formateurs/{formateur_id}")
async def update_formateur(
    formateur_id: str,
    nom: str = Form(None),
    prenom: str = Form(None),
    email: str = Form(None),
    societe: str = Form(None),
    telephone: str = Form(None),
    siret: str = Form(None),
    nda: str = Form(None),
    matieres: str = Form(None),
    photo: UploadFile = FastAPIFile(None),
    cv: UploadFile = FastAPIFile(None),
    diplome1: UploadFile = FastAPIFile(None),
    diplome2: UploadFile = FastAPIFile(None),
    current_user: User = Depends(get_current_user)
):
    """Met à jour un formateur"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    formateur = await db.formateurs.find_one({"id": formateur_id})
    if not formateur:
        raise HTTPException(status_code=404, detail="Formateur non trouvé")
    
    import json
    update_data = {}
    
    if nom is not None:
        update_data["nom"] = nom
    if prenom is not None:
        update_data["prenom"] = prenom
    if email is not None:
        update_data["email"] = email.lower()
    if societe is not None:
        update_data["societe"] = societe
    if telephone is not None:
        update_data["telephone"] = telephone
    if siret is not None:
        update_data["siret"] = siret
    if nda is not None:
        update_data["nda"] = nda
    if matieres is not None:
        try:
            update_data["matieres"] = json.loads(matieres)
        except:
            pass
    
    # Dossier formateur
    formateurs_dir = Path("/app/backend/static/formateurs")
    formateur_folder = formateurs_dir / formateur_id
    formateur_folder.mkdir(parents=True, exist_ok=True)
    
    # Mise à jour des fichiers
    if photo and photo.filename:
        ext = Path(photo.filename).suffix
        photo_path = formateur_folder / f"photo{ext}"
        content = await photo.read()
        with open(photo_path, "wb") as f:
            f.write(content)
        update_data["photo_url"] = f"/static/formateurs/{formateur_id}/photo{ext}"
    
    if cv and cv.filename:
        ext = Path(cv.filename).suffix
        cv_path = formateur_folder / f"cv{ext}"
        content = await cv.read()
        with open(cv_path, "wb") as f:
            f.write(content)
        update_data["cv_url"] = f"/static/formateurs/{formateur_id}/cv{ext}"
    
    if diplome1 and diplome1.filename:
        ext = Path(diplome1.filename).suffix
        diplome1_path = formateur_folder / f"diplome1{ext}"
        content = await diplome1.read()
        with open(diplome1_path, "wb") as f:
            f.write(content)
        update_data["diplome1_url"] = f"/static/formateurs/{formateur_id}/diplome1{ext}"
    
    if diplome2 and diplome2.filename:
        ext = Path(diplome2.filename).suffix
        diplome2_path = formateur_folder / f"diplome2{ext}"
        content = await diplome2.read()
        with open(diplome2_path, "wb") as f:
            f.write(content)
        update_data["diplome2_url"] = f"/static/formateurs/{formateur_id}/diplome2{ext}"
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.formateurs.update_one({"id": formateur_id}, {"$set": update_data})
    
    # Récupérer le formateur mis à jour
    updated_formateur = await db.formateurs.find_one({"id": formateur_id}, {"_id": 0})
    return updated_formateur

@api_router.delete("/formateurs/{formateur_id}")
async def delete_formateur(formateur_id: str, current_user: User = Depends(get_current_user)):
    """Supprime un formateur"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    formateur = await db.formateurs.find_one({"id": formateur_id})
    if not formateur:
        raise HTTPException(status_code=404, detail="Formateur non trouvé")
    
    # Supprimer les fichiers associés
    formateurs_dir = Path("/app/backend/static/formateurs") / formateur_id
    if formateurs_dir.exists():
        import shutil
        shutil.rmtree(formateurs_dir)
    
    # Supprimer de la base
    await db.formateurs.delete_one({"id": formateur_id})
    
    return {"message": "Formateur supprimé avec succès"}


# Include router
app.include_router(api_router)

def calculer_score_progression(questionnaire_fin: dict) -> int:
    """
    Calcule un score de progression sur 100 basé sur le questionnaire de fin
    """
    score = 0
    
    # Progression globale (40 points)
    progression = questionnaire_fin.get('progression_globale', '')
    if progression == 'Très satisfaisante':
        score += 40
    elif progression == 'Satisfaisante':
        score += 30
    elif progression == 'Moyenne':
        score += 15
    
    # Objectifs atteints (30 points)
    objectifs = questionnaire_fin.get('objectifs_atteints', '')
    if objectifs == 'Oui':
        score += 30
    elif objectifs == 'Partiellement':
        score += 15
    
    # Évaluation globale sur 5 (20 points)
    try:
        eval_globale = int(questionnaire_fin.get('evaluation_globale', 0))
        score += (eval_globale / 5.0) * 20
    except:
        pass
    
    # Recommandation (10 points)
    recommandation = questionnaire_fin.get('recommandation', '')
    if recommandation == 'Oui':
        score += 10
    elif recommandation == 'Peut-être':
        score += 5
    
    return min(100, int(score))


def attribuer_niveau_progression(score: int) -> dict:
    """
    Attribue un niveau de progression selon le score
    """
    if score >= 76:
        return {
            "niveau": "Progression excellente", 
            "couleur": "#1976D2",  # Bleu
            "couleur_bg": "#E3F2FD"
        }
    elif score >= 51:
        return {
            "niveau": "Progression solide", 
            "couleur": "#388E3C",  # Vert
            "couleur_bg": "#E8F5E9"
        }
    elif score >= 26:
        return {
            "niveau": "Progression moyenne", 
            "couleur": "#F57C00",  # Orange
            "couleur_bg": "#FFF3E0"
        }
    else:
        return {
            "niveau": "Progression limitée", 
            "couleur": "#D32F2F",  # Rouge
            "couleur_bg": "#FFEBEE"
        }


def generate_bilan_eleve_pdf(student: dict, q_besoins: dict, q_mi_parcours: dict, q_fin: dict, score: int, niveau: dict) -> bytes:
    """
    Génère le PDF du Bilan Élève IA avec synthèse automatique
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, 
                           leftMargin=36, rightMargin=36,
                           topMargin=72, bottomMargin=54)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Style personnalisé pour le titre
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#8B5A2B'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    # Style pour les sections
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#8B5A2B'),
        spaceAfter=12,
        spaceBefore=20,
        fontName='Helvetica-Bold'
    )
    
    # Style normal
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        leading=16,
        spaceAfter=8
    )
    
    # En-tête avec logo TerciForm
    story.append(Paragraph("🎓 TERCIFORM", title_style))
    story.append(Paragraph("Bilan Élève - Synthèse IA", title_style))
    story.append(Spacer(1, 20))
    
    # Informations élève
    story.append(Paragraph("📋 Informations du bénéficiaire", section_style))
    info_data = [
        ["Nom :", student.get('name', '—')],
        ["Email :", student.get('email', '—')],
        ["Date du bilan :", datetime.now().strftime("%d/%m/%Y")]
    ]
    info_table = Table(info_data, colWidths=[2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F5F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
    ]))
    story.append(info_table)
    story.append(Spacer(1, 20))
    
    # Score de progression avec bandeau coloré
    story.append(Paragraph("🎯 Score de Progression", section_style))
    score_table = Table(
        [[Paragraph(f"<b>{score}/100</b>", ParagraphStyle('ScoreStyle', fontSize=36, textColor=colors.HexColor(niveau['couleur']), alignment=TA_CENTER))],
         [Paragraph(f"<b>{niveau['niveau']}</b>", ParagraphStyle('NiveauStyle', fontSize=14, textColor=colors.HexColor(niveau['couleur']), alignment=TA_CENTER))]],
        colWidths=[6*inch]
    )
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(niveau['couleur_bg'])),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor(niveau['couleur']))
    ]))
    story.append(score_table)
    story.append(Spacer(1, 20))
    
    # Synthèse IA automatique
    story.append(Paragraph("🤖 Synthèse IA - Analyse de parcours", section_style))
    
    # Objectifs initiaux
    objectifs_initiaux = q_besoins.get('objectifs_principaux', '') or q_besoins.get('raison_formation', 'Non précisé')
    synthese_text = f"""
    <b>Objectifs initiaux :</b><br/>
    Le bénéficiaire souhaitait initialement {objectifs_initiaux}.<br/><br/>
    
    <b>Évolution à mi-parcours :</b><br/>
    À mi-parcours, le bénéficiaire a rapporté : "{q_mi_parcours.get('apprentissages', 'Progression en cours')}".<br/>
    Difficultés rencontrées : {q_mi_parcours.get('difficultes', 'Aucune difficulté majeure signalée')}.<br/><br/>
    
    <b>Bilan final :</b><br/>
    En fin de formation, le bénéficiaire se déclare {q_fin.get('progression_globale', 'satisfait')} de sa progression.
    Objectifs atteints : {q_fin.get('objectifs_atteints', 'Oui')}.<br/>
    Appréciation du formateur : {q_fin.get('appreciation_formateur', 'Très bon parcours')}.<br/><br/>
    
    <b>Recommandations :</b><br/>
    {q_fin.get('formation_complementaire', 'Formation réussie, pas de recommandation particulière')}.
    """
    
    story.append(Paragraph(synthese_text, normal_style))
    story.append(Spacer(1, 20))
    
    # Domaines d'amélioration
    story.append(Paragraph("📈 Domaines d'amélioration identifiés", section_style))
    domaines = q_fin.get('domaines_amelioration', 'Compréhension orale, Expression écrite')
    story.append(Paragraph(f"• {domaines}", normal_style))
    story.append(Spacer(1, 15))
    
    # Recommandation finale
    recommandation_finale = "Oui" if q_fin.get('recommandation') == 'Oui' else "Non précisé"
    story.append(Paragraph(f"<b>Recommandation de la formation :</b> {recommandation_finale}", normal_style))
    
    # Pied de page
    story.append(Spacer(1, 30))
    footer_text = f"Document généré automatiquement par TerciForm IA le {datetime.now().strftime('%d/%m/%Y à %H:%M')}"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))
    
    # Construire le PDF
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()




@app.on_event("shutdown")
async def shutdown_db_client():
    # Arrêter le scheduler
    if scheduler.running:
        scheduler.shutdown()
        logger.info("✅ Scheduler de rappels arrêté")
    # Fermer la connexion MongoDB
    client.close()
