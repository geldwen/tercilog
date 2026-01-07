#!/usr/bin/env python3
"""
Service pour vérifier et envoyer les emails d'émargement automatiquement
Tourne en boucle et vérifie toutes les 2 minutes
"""
import asyncio
import sys
import os
from pathlib import Path
import time

# Ajouter le répertoire parent au path
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
import logging

load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def check_and_send_emails():
    """Vérifie les séances terminées et envoie les emails d'émargement"""
    try:
        # Connexion MongoDB
        mongo_url = os.environ['MONGO_URL']
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ['DB_NAME']]
        
        # Import de la fonction d'envoi d'email
        from server import send_attendance_email
        
        # Utiliser l'heure locale (pas UTC) car les séances sont planifiées en heure locale
        now = datetime.now()
        logger.info(f"Checking for sessions to send attendance emails at {now.strftime('%Y-%m-%d %H:%M')}")
        
        # Récupérer toutes les séances confirmées qui n'ont pas encore reçu d'email d'émargement
        sessions = await db.sessions.find({
            "status": {"$in": ["confirmed", "pending"]},  # Inclure aussi pending
            "attendance_email_sent": {"$ne": True}
        }, {"_id": 0}).to_list(1000)
        
        emails_sent = 0
        for session_doc in sessions:
            try:
                # Construire la date et heure de fin de séance (en heure locale)
                session_date = session_doc.get('date', '')
                session_end_time = session_doc.get('end_time', '')
                
                if not session_date or not session_end_time:
                    continue
                
                session_datetime_str = f"{session_date} {session_end_time}"
                
                try:
                    session_end = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
                except ValueError:
                    logger.error(f"Invalid date format for session {session_doc.get('id')}: {session_datetime_str}")
                    continue
                
                # Si la séance est terminée (heure actuelle > heure de fin)
                # Tolérance de 5 minutes pour éviter les retards d'envoi
                if now >= session_end:
                    logger.info(f"Session {session_doc['id']} ended at {session_end_time}. Sending attendance email to {session_doc.get('student_email')}...")
                    
                    # Envoyer l'email d'émargement
                    email_sent = send_attendance_email(
                        session_doc.get('student_email', ''),
                        session_doc.get('student_name', ''),
                        session_doc.get('subject', ''),
                        session_doc.get('date', ''),
                        session_doc.get('start_time', ''),
                        session_doc.get('end_time', '')
                    )
                    
                    if email_sent:
                        # Marquer l'email comme envoyé et mettre à jour le statut de signature
                        # Élève: pending, Formateur: pending aussi (pas de délai)
                        await db.sessions.update_one(
                            {"id": session_doc['id']},
                            {"$set": {
                                "attendance_email_sent": True,
                                "signature_status": "pending",
                                "teacher_signature_status": "pending"
                            }}
                        )
                        emails_sent += 1
                        logger.info(f"Attendance email sent for session {session_doc['id']}, both signatures set to pending")
            except Exception as e:
                logger.error(f"Error processing session {session_doc.get('id')}: {e}")
                continue
        
        logger.info(f"Process completed. {emails_sent} attendance emails sent.")
        client.close()
        
    except Exception as e:
        logger.error(f"Error in check_and_send_emails: {e}")
        raise


async def check_48h_confirmation_reminders():
    """Vérifie les séances dans 48h et envoie des rappels si pas confirmées"""
    try:
        # Connexion MongoDB
        mongo_url = os.environ['MONGO_URL']
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ['DB_NAME']]
        
        # Import des fonctions d'envoi d'email
        from server import send_no_confirmation_reminder_to_teacher, send_no_confirmation_reminder_to_student
        
        now = datetime.now(timezone.utc)
        # Calculer la fenêtre de 48h (entre 48h et 47h30 pour éviter les doublons)
        target_time_start = now + timedelta(hours=47, minutes=30)
        target_time_end = now + timedelta(hours=48, minutes=30)
        
        logger.info(f"Checking for sessions between {target_time_start} and {target_time_end} without confirmation")
        
        # Récupérer toutes les séances confirmées (par le prof) mais pas confirmées par l'élève
        # dans la fenêtre de 48h
        sessions = await db.sessions.find({
            "status": {"$in": ["confirmed", "pending"]},
            "confirmed_by_student": {"$ne": True},
            "confirmation_48h_reminder_sent": {"$ne": True}  # Pas encore envoyé
        }, {"_id": 0}).to_list(1000)
        
        reminders_sent = 0
        for session_doc in sessions:
            try:
                # Construire la date et heure de début de séance
                session_datetime_str = f"{session_doc['date']}T{session_doc['start_time']}:00"
                
                try:
                    session_start = datetime.fromisoformat(session_datetime_str)
                    if session_start.tzinfo is None:
                        session_start = session_start.replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.error(f"Invalid date format for session {session_doc.get('id')}: {session_datetime_str}")
                    continue
                
                # Si la séance est dans la fenêtre de 48h
                if target_time_start <= session_start <= target_time_end:
                    logger.info(f"Session {session_doc['id']} is in 48h and not confirmed. Sending reminders...")
                    
                    # Envoyer email au professeur
                    teacher_email_sent = send_no_confirmation_reminder_to_teacher(
                        student_name=session_doc.get('student_name', 'Inconnu'),
                        student_email=session_doc.get('student_email', ''),
                        subject=session_doc.get('subject', 'Non spécifié'),
                        date=session_doc.get('date', ''),
                        start_time=session_doc.get('start_time', ''),
                        end_time=session_doc.get('end_time', '')
                    )
                    
                    # Envoyer email à l'élève
                    student_email_sent = send_no_confirmation_reminder_to_student(
                        to_email=session_doc.get('student_email', ''),
                        student_name=session_doc.get('student_name', 'Inconnu'),
                        date=session_doc.get('date', ''),
                        start_time=session_doc.get('start_time', ''),
                        end_time=session_doc.get('end_time', '')
                    )
                    
                    if teacher_email_sent or student_email_sent:
                        # Marquer le rappel comme envoyé
                        await db.sessions.update_one(
                            {"id": session_doc['id']},
                            {"$set": {
                                "confirmation_48h_reminder_sent": True,
                                "confirmation_48h_reminder_sent_at": now.isoformat()
                            }}
                        )
                        reminders_sent += 1
                        logger.info(f"48h reminder sent for session {session_doc['id']}")
                        
            except Exception as e:
                logger.error(f"Error processing 48h reminder for session {session_doc.get('id')}: {e}")
                continue
        
        logger.info(f"48h reminder check completed. {reminders_sent} reminders sent.")
        client.close()
        
    except Exception as e:
        logger.error(f"Error in check_48h_confirmation_reminders: {e}")
        raise

async def run_service():
    """Boucle principale du service"""
    logger.info("Attendance and confirmation reminder service started")
    while True:
        try:
            # Vérifier les emails d'émargement (séances terminées)
            await check_and_send_emails()
            
            # Vérifier les rappels de confirmation 48h avant
            await check_48h_confirmation_reminders()
            
        except Exception as e:
            logger.error(f"Error in service loop: {e}")
        
        # Attendre 2 minutes avant la prochaine vérification
        logger.info("Waiting 2 minutes before next check...")
        await asyncio.sleep(120)  # 120 secondes = 2 minutes

if __name__ == "__main__":
    asyncio.run(run_service())
