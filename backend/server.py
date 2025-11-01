from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
    signature: Optional[str] = None  # Base64 image de la signature
    signed_at: Optional[str] = None  # Horodatage de l'émargement
    signature_status: str = "not_required"  # not_required, pending, signed, expired
    signature_deadline: Optional[str] = None  # Délai de 2h après la fin de séance
    attendance_email_sent: bool = False  # Email d'émargement envoyé ou non
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    subject: str
    date: str
    start_time: str
    end_time: str
    student_id: str
    validation_deadline_hours: int = 48

class SessionValidate(BaseModel):
    status: str  # "confirmed" or "rejected"

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
    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
    
    html_body = f"""
    <html>
      <head>
        <style>
          body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
          .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
          .header {{ background-color: #1e3a5f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
          .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
          .button {{ display: inline-block; background-color: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }}
          .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>TerciForm - Émargement de séance</h2>
          </div>
          <div class="content">
            <p>Bonjour {student_name},</p>
            <p>Vous venez d'assister à la séance suivante :</p>
            <ul>
              <li><strong>Matière :</strong> {subject}</li>
              <li><strong>Date :</strong> {date}</li>
              <li><strong>Horaires :</strong> {start_time} - {end_time}</li>
            </ul>
            <p><strong>Merci d'effectuer l'émargement relatif à cette séance en cliquant sur le bouton ci-dessous.</strong></p>
            <p style="color: #d9534f;"><strong>⚠️ Attention :</strong> Vous avez 2 heures après la fin de la séance pour émarger.</p>
            <div style="text-align: center;">
              <a href="{frontend_url}" class="button">Accéder à mon espace et émarger</a>
            </div>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement par TerciForm</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    return send_email(to_email, "TerciForm - Émargement de séance", html_body)


# Routes
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_data.model_dump()
    plain_password = user_dict['password']  # Sauvegarder le mot de passe en clair
    hashed_password = get_password_hash(user_dict.pop('password'))
    user_dict['password_hash'] = hashed_password
    user_dict['plain_password'] = plain_password  # Stocker le mot de passe en clair
    
    # Initialize credit_hours = total_hours for new students
    if user_dict.get('role') == 'student' and 'total_hours' in user_dict:
        user_dict['credit_hours'] = user_dict['total_hours']
    
    user = User(**user_dict)
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password_hash'] = hashed_password
    doc['plain_password'] = plain_password
    
    await db.users.insert_one(doc)
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
    
    # Create session
    session = Session(
        subject=session_data.subject,
        date=session_data.date,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        student_id=session_data.student_id,
        student_name=student['name'],
        student_email=student['email'],
        validation_deadline=deadline.isoformat(),
        duration_hours=duration
    )
    
    doc = session.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sessions.insert_one(doc)
    
    # Send email to student
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
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
                <a href="{frontend_url}" style="background-color: #1e3a5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accédez à TerciLog</a>
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
    
    send_email(student['email'], f"Nouvelle séance TerciForm - {session_data.subject}", email_body)
    
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

@api_router.post("/sessions/{session_id}/sign")
async def sign_session(session_id: str, signature_data: dict, current_user: User = Depends(get_current_user)):
    """Enregistrer la signature d'un élève pour une séance"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer la séance
    session_doc = await db.sessions.find_one({"id": session_id, "student_id": current_user.id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Vérifier le délai de 2 heures
    if session_doc.get('signature_deadline'):
        deadline = datetime.fromisoformat(session_doc['signature_deadline'])
        if datetime.now(timezone.utc) > deadline:
            await db.sessions.update_one({"id": session_id}, {"$set": {"signature_status": "expired"}})
            raise HTTPException(status_code=400, detail="Signature deadline expired (2 hours after session end)")
    
    # Enregistrer la signature
    signed_at = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {
            "signature": signature_data.get("signature"),
            "signed_at": signed_at,
            "signature_status": "signed"
        }}
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
    
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
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
                <a href="{frontend_url}" style="background-color: #1e3a5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accédez à TerciLog</a>
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
    
    return {"message": "Attendance email resent"}


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
        # Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
        existing = await db.users.find_one({"email": data["email"], "id": {"$ne": student_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
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
                    await db.sessions.update_one(
                        {"id": session_doc['id']},
                        {"$set": {
                            "attendance_email_sent": True,
                            "signature_status": "pending",
                            "signature_deadline": signature_deadline.isoformat()
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
    
    # Get current month if not specified
    if not month:
        now = datetime.now(timezone.utc)
        month = now.strftime('%Y-%m')
    
    # Filter sessions for the specified month
    all_sessions = await db.sessions.find({}, {"_id": 0}).to_list(1000)
    monthly_sessions = [s for s in all_sessions if s['date'].startswith(month)]
    
    students = await db.users.find({"role": "student"}, {"_id": 0}).to_list(1000)
    
    # Calculer les heures totales (TOUTES les séances du mois)
    total_hours = sum(s.get('duration_hours', 0) for s in monthly_sessions)
    confirmed_hours = sum(s.get('duration_hours', 0) for s in monthly_sessions if s['status'] == 'confirmed')
    rejected_hours = sum(s.get('duration_hours', 0) for s in monthly_sessions if s['status'] == 'rejected')
    
    stats = {
        "month": month,
        "total_sessions": len(monthly_sessions),
        "total_hours": total_hours,
        "pending_sessions": len([s for s in monthly_sessions if s['status'] == 'pending']),
        "confirmed_sessions": len([s for s in monthly_sessions if s['status'] == 'confirmed']),
        "confirmed_hours": confirmed_hours,
        "rejected_sessions": len([s for s in monthly_sessions if s['status'] == 'rejected']),
        "rejected_hours": rejected_hours,
        "students": [{"id": s['id'], "name": s['name'], "email": s['email'], "credit_hours": s['credit_hours']} for s in students]
    }
    
    return stats

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
