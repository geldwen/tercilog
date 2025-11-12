from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File as FastAPIFile
from fastapi.responses import Response, FileResponse
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
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas
import io
from pdf2image import convert_from_path
from PIL import Image as PILImage

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
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str  # "teacher" or "student"
    credit_hours: float = 0.0
    total_hours: float = 0.0
    plain_password: str = ""  # Mot de passe en clair pour l'email
    phone: str = ""
    organism: str = ""
    support_type: str = ""
    session_type: str = ""  # "distanciel" or "présentiel"
    start_date: str = ""
    end_date: str = ""
    welcome_email_sent: bool = False  # Email de bienvenue envoyé ou non
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    modality: str = "distanciel"  # distanciel ou présentiel
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
    teacher_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlanningEventCreate(BaseModel):
    title: str
    date: str
    start_time: str
    end_time: str
    organism: str = ""

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
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
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
    Get the student portal URL from environment variables with fallback cascade.
    Priority order:
    1. STUDENT_PORTAL_URL (recommended)
    2. FRONTEND_URL
    3. REACT_APP_FRONTEND_URL
    4. REACT_APP_BACKEND_URL (removing /api suffix if present)
    5. Fallback: https://tercilog-suite.preview.emergentagent.com
    """
    url = (
        os.getenv("STUDENT_PORTAL_URL")
        or os.getenv("FRONTEND_URL")
        or os.getenv("REACT_APP_FRONTEND_URL")
        or os.getenv("REACT_APP_BACKEND_URL")
        or "https://tercilog-suite.preview.emergentagent.com"
    )
    
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
    
    html_body = f"""<html>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background-color: #1f4acc; padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Bienvenue dans votre espace TerciLog</h1>
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
          Bienvenue dans votre espace TerciLog. Merci de vous connecter pour confirmer vos séances et accéder à votre parcours de formation.
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0 24px 0; text-align: center;">
          <a href="{portal_url}" target="_blank" 
             style="background: #1f4acc; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            Accéder à TerciLog
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid #1f4acc;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;"><strong>Identifiant :</strong> {student_email}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;"><strong>Code secret (temporaire) :</strong> {temp_password}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
            💡 Pour votre sécurité, nous vous recommandons de changer ce code temporaire lors de votre première connexion.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 0 0 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="{portal_url}" style="color: #1f4acc; text-decoration: underline;">{portal_url}</a>
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
    
    return send_email(to_email, "Bienvenue dans votre espace TerciLog", html_body)


def send_session_reminder_email(to_email: str, student_name: str, subject: str, date: str, start_time: str, end_time: str, meeting_link: str = ""):
    """Envoyer l'email de rappel 5 minutes avant la séance"""
    portal_url = get_student_portal_url()
    
    meeting_section = ""
    if meeting_link:
        meeting_section = f"""
        <div style="background-color: #e8f0f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #1e3a5f;">🎥 Visioconférence</p>
          <p style="margin: 10px 0 0 0;">Vous pouvez rejoindre la séance depuis votre espace élève ou directement via ce lien :</p>
          <div style="text-align: center; margin-top: 15px;">
            <a href="{meeting_link}" class="button" style="background-color: #28a745;">Rejoindre la visioconférence</a>
          </div>
        </div>
        """
    
    html_body = f"""
    <html>
      <head>
        <style>
          body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
          .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
          .header {{ background-color: #1e3a5f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
          .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
          .button {{ display: inline-block; background-color: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 10px; }}
          .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⏰ TerciForm - Rappel de séance</h2>
          </div>
          <div class="content">
            <p>Bonjour {student_name},</p>
            <p style="font-size: 18px; color: #1e3a5f; font-weight: bold;">Votre séance commence dans 5 minutes !</p>
            <ul>
              <li><strong>Matière :</strong> {subject}</li>
              <li><strong>Date :</strong> {date}</li>
              <li><strong>Horaires :</strong> {start_time} - {end_time}</li>
            </ul>
            {meeting_section}
            <div style="text-align: center; margin-top: 20px;">
              <a href="{portal_url}" class="button">Accéder à mon espace élève</a>
            </div>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement par TerciForm</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    return send_email(to_email, "⏰ TerciForm - Votre séance commence dans 5 minutes", html_body)


# Routes
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Permettre plusieurs élèves avec le même email (pour les tests)
    # Pas de vérification d'unicité d'email
    
    # Create user
    user_dict = user_data.model_dump()
    plain_password = user_dict['password']  # Sauvegarder le mot de passe en clair
    hashed_password = get_password_hash(user_dict.pop('password'))
    user_dict['password_hash'] = hashed_password
    user_dict['plain_password'] = plain_password  # Stocker le mot de passe en clair
    user_dict['welcome_email_sent'] = False  # Flag pour l'email de bienvenue
    
    # Initialize credit_hours = total_hours for new students
    if user_dict.get('role') == 'student' and 'total_hours' in user_dict:
        user_dict['credit_hours'] = user_dict['total_hours']
    
    user = User(**user_dict)
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password_hash'] = hashed_password
    doc['plain_password'] = plain_password
    doc['welcome_email_sent'] = False
    
    await db.users.insert_one(doc)
    
    # Envoyer l'email de bienvenue si c'est un élève
    if user_dict.get('role') == 'student':
        try:
            email_sent = send_welcome_email(
                user_dict['email'],
                user_dict['name'],
                user_dict['email'],
                plain_password
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
    user = User(**user_doc)
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/students", response_model=List[User])
async def get_students(current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    students = await db.users.find({"role": "student"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**s) for s in students]

@api_router.post("/students", response_model=User)
async def create_student(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    user_data.role = "student"
    return await register(user_data)

@api_router.post("/sessions", response_model=Session)
async def create_session(session_data: SessionCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get student info
    student = await db.users.find_one({"id": session_data.student_id}, {"_id": 0})
    if not student or student['role'] != "student":
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Calculate duration
    try:
        start_h, start_m = map(int, session_data.start_time.split(':'))
        end_h, end_m = map(int, session_data.end_time.split(':'))
        duration = (end_h * 60 + end_m - start_h * 60 - start_m) / 60.0
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
    
    # Send email to student
    portal_url = get_student_portal_url()
    student_password = student.get('plain_password', '***')
    
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e3a5f;">Nouvelle séance de formation TerciForm</h2>
            <p>Bonjour {student['name']},</p>
            <p><strong>Vous avez été affecté à la séance {session_data.subject} du {session_data.date} de {session_data.start_time} à {session_data.end_time}.</strong></p>
            <p>Veuillez confirmer votre présence en vous connectant à la plateforme :</p>
            <div style="margin: 30px 0;">
                <a href="{portal_url}" style="background-color: #1e3a5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accédez à TerciLog</a>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Rappel de vos identifiants :</p>
                <p style="margin: 5px 0;"><strong>Identifiant :</strong> {student['email']}</p>
                <p style="margin: 5px 0;"><strong>Mot de passe :</strong> {student_password}</p>
            </div>
            <p style="color: #dc2626; font-weight: bold;">⚠️ Important : En cas d'absence d'une séance validée, les heures de formation seront perdues.</p>
            <p>Cordialement,<br>Votre formateur</p>
        </div>
    </body>
    </html>
    """
    
    # Envoyer l'email de confirmation à l'élève
    email_sent = send_email(student['email'], f"Nouvelle séance TerciForm - {session_data.subject}", email_body)
    
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
    
    return [Session(**s) for s in sessions]

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
async def update_session(session_id: str, data: dict, current_user: User = Depends(get_current_user)):
    """Mettre à jour une séance (ex: ajouter un lien visio)"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Vérifier que la séance existe
    session_doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
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
    
    # Récupérer la séance mise à jour
    updated_session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
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
    student_password = student.get('plain_password', '***')
    
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e3a5f;">Nouvelle séance de formation TerciForm</h2>
            <p>Bonjour {student['name']},</p>
            <p><strong>Vous avez été affecté à la séance {session_doc['subject']} du {session_doc['date']} de {session_doc['start_time']} à {session_doc['end_time']}.</strong></p>
            <p>Veuillez confirmer votre présence en vous connectant à la plateforme :</p>
            <div style="margin: 30px 0;">
                <a href="{portal_url}" style="background-color: #1e3a5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accédez à TerciLog</a>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a5f;">📝 Rappel de vos identifiants :</p>
                <p style="margin: 5px 0;"><strong>Identifiant :</strong> {student['email']}</p>
                <p style="margin: 5px 0;"><strong>Mot de passe :</strong> {student_password}</p>
            </div>
            <p style="color: #dc2626; font-weight: bold;">⚠️ Important : En cas d'absence d'une séance validée, les heures de formation seront perdues.</p>
            <p>Cordialement,<br>Votre formateur</p>
        </div>
    </body>
    </html>
    """
    
    send_email(student['email'], f"Nouvelle séance TerciForm - {session_doc['subject']}", email_body)
    
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
        update_data["hashed_password"] = pwd_context.hash(data["password"])
        update_data["plain_password"] = data["password"]
    
    # Mettre à jour l'élève
    await db.users.update_one({"id": student_id}, {"$set": update_data})
    
    # Récupérer l'élève mis à jour
    updated_student = await db.users.find_one({"id": student_id})
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
    


@api_router.post("/sessions/check-session-reminders")
async def check_and_send_session_reminders():
    """Vérifier les séances qui commencent dans 5 minutes et envoyer les rappels"""
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
    from PIL import Image as PILImage
    
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
    """Générer un PDF du planning de l'élève pour TOUT le parcours"""
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
    
    story = []
    
    # En-tête avec logo et titre
    story.append(build_header(f"Planning de {student['name']}"))
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
        
        # Texte sans balises HTML
        story.append(Paragraph(f"Parcours complet : {len(sessions_sorted)} séance(s) — {total_hours}h", bold_style))
        story.append(Spacer(0, 8))
        
        # Mapping
        days_fr = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
        status_fr = {'pending': 'En attente', 'confirmed': 'Confirmée', 'rejected': 'Refusée'}
        
        # Colonnes proportionnelles - Planning: Date 18% | Matière 38% | Horaires 14% | Durée 10% | Statut 20%
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
            # Date FR - format complet: mardi 04/11/2025
            date_formatted = format_fr_date(session.get('date', ''))
            
            # Matière avec Paragraph pour wrap
            matiere = Paragraph(session.get('subject', ''), cell_style)
            
            # Horaires format: 14:00 - 16:00
            horaires = f"{session.get('start_time', '')} - {session.get('end_time', '')}"
            duree = f"{session.get('duration_hours', 0)}h"
            
            # Statut en toutes lettres
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
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
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
    from PIL import Image as PILImage
    
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
                except Exception as e:
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
                except Exception as e:
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
        
        # Documents (simplified version)
        if documents:
            story.append(Paragraph("Contenu", section_title_style))
            story.append(Spacer(1, 10))
            for idx, doc in enumerate(documents, 1):
                uploaded_at = doc.get('uploaded_at', '')
                if uploaded_at:
                    try:
                        dt = datetime.fromisoformat(uploaded_at.replace('Z', '+00:00'))
                        formatted_date = dt.strftime('%d/%m/%Y à %H:%M')
                    except:
                        formatted_date = uploaded_at
                else:
                    formatted_date = 'Non disponible'
                story.append(Paragraph(f"{idx}. {doc.get('filename', 'N/A')} - {formatted_date}", styles['Normal']))
            story.append(Spacer(1, 20))
        
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


def create_pdf_preview_image(pdf_path: Path, max_width: float = 5.0 * inch) -> tuple:
    """
    Convertir les premières pages d'un PDF en images pour inclusion dans le rapport
    Retourne (liste_images, liste_fichiers_temp, succès)
    """
    try:
        # Convertir les 2 premières pages du PDF en images
        images_pil = convert_from_path(
            str(pdf_path),
            first_page=1,
            last_page=2,  # Limiter à 2 pages pour éviter des PDFs trop lourds
            dpi=150  # Qualité moyenne pour garder une taille raisonnable
        )
        
        result_images = []
        temp_files = []
        for idx, img_pil in enumerate(images_pil):
            # Sauvegarder temporairement l'image avec un nom unique
            temp_img_path = pdf_path.parent / f"temp_{pdf_path.stem}_page{idx}_{uuid.uuid4().hex[:8]}.jpg"
            img_pil.save(str(temp_img_path), 'JPEG', quality=85)
            temp_files.append(temp_img_path)
            
            # Créer l'image ReportLab avec dimensions appropriées
            img_reportlab = Image(str(temp_img_path), width=max_width, height=max_width * img_pil.height / img_pil.width)
            result_images.append(img_reportlab)
        
        return result_images, temp_files, True
    except Exception as e:
        logger.warning(f"Could not convert PDF to images: {e}")
        return [], [], False


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
    
    # Section Documents - AVEC APERÇUS VISUELS COMPLETS ET MISE EN PAGE PROFESSIONNELLE
    temp_files_to_cleanup = []  # Liste des fichiers temporaires à nettoyer
    
    if documents:
        # Titre de section avec style professionnel
        section_header = Table([
            [Paragraph("📋 Documents téléversés", section_title_style)]
        ], colWidths=[7.0*inch])
        section_header.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F4EAE3')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#8B5A2B'))
        ]))
        story.append(section_header)
        story.append(Spacer(1, 20))
        
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
            
            # Bandeau titre document - Style plus professionnel
            doc_title_style = ParagraphStyle(
                'DocTitle',
                parent=styles['Normal'],
                fontSize=13,
                textColor=colors.white,
                fontName='Helvetica-Bold',
                leading=16
            )
            
            doc_subtitle_style = ParagraphStyle(
                'DocSubtitle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#666666'),
                fontName='Helvetica-Oblique',
                leading=14
            )
            
            # En-tête du document avec numéro et nom - compact
            doc_header = Table([
                [Paragraph(f"Document {idx}", doc_title_style)],
                [Paragraph(filename, doc_title_style)]
            ], colWidths=[7.0*inch])
            doc_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#8B5A2B')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
            ]))
            story.append(doc_header)
            story.append(Spacer(1, 5))
            
            # Date simple sans cadre
            story.append(Paragraph(f"<i>📅 Date de réalisation : {formatted_date}</i>", doc_subtitle_style))
            story.append(Spacer(1, 10))
            
            # APERÇU VISUEL DU DOCUMENT - SANS CADRE, SANS SAUT DE PAGE
            if filepath.exists():
                try:
                    if mime and 'pdf' in mime:
                        # Pour les PDFs : convertir les 2 premières pages en images (PLUS GRANDES)
                        pdf_images, temp_files, success = create_pdf_preview_image(filepath, max_width=6.5*inch)
                        if success and pdf_images:
                            temp_files_to_cleanup.extend(temp_files)
                            for page_idx, img in enumerate(pdf_images, 1):
                                # Indication de page simple
                                story.append(Paragraph(f"<b>Page {page_idx}</b>", styles['Normal']))
                                story.append(Spacer(1, 5))
                                
                                # Image SANS cadre, centrée
                                img.hAlign = 'CENTER'
                                story.append(img)
                                story.append(Spacer(1, 10))
                        else:
                            story.append(Paragraph("⚠️ Impossible de générer l'aperçu du PDF", styles['Normal']))
                    
                    elif mime and 'image' in mime:
                        # Pour les images : afficher directement SANS cadre (PLUS GRANDES)
                        img = Image(str(filepath), width=6.5*inch, height=None)
                        img.hAlign = 'CENTER'
                        story.append(img)
                        story.append(Spacer(1, 10))
                    
                    else:
                        # Autres types de fichiers
                        story.append(Paragraph(f"📎 Document de type : {mime or 'inconnu'}", styles['Normal']))
                
                except Exception as e:
                    logger.warning(f"Could not create preview for {filename}: {e}")
                    error_para = Paragraph("⚠️ Erreur lors de la génération de l'aperçu", styles['Normal'])
                    error_table = Table([[error_para]], colWidths=[7.0*inch])
                    error_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFEBEE')),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10)
                    ]))
                    story.append(error_table)
            else:
                story.append(Paragraph("❌ Fichier non trouvé", styles['Normal']))
            
            # Séparateur simple entre documents (seulement si pas le dernier)
            if idx < len(documents):
                story.append(Spacer(1, 15))
                separator = Table([['']], colWidths=[7.0*inch])
                separator.setStyle(TableStyle([
                    ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#CCCCCC'))
                ]))
                story.append(separator)
                story.append(Spacer(1, 15))
    
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


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
