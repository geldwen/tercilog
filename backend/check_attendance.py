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
        
        now = datetime.now(timezone.utc)
        logger.info(f"Checking for sessions to send attendance emails at {now}")
        
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
                
                # Parse la date (peut être sans timezone)
                try:
                    session_end = datetime.fromisoformat(session_datetime_str)
                    # Si pas de timezone, on assume UTC
                    if session_end.tzinfo is None:
                        session_end = session_end.replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.error(f"Invalid date format for session {session_doc.get('id')}: {session_datetime_str}")
                    continue
                
                # Si la séance est terminée (heure actuelle > heure de fin)
                if now > session_end:
                    # Calculer le délai de 2 heures
                    signature_deadline = session_end + timedelta(hours=2)
                    
                    logger.info(f"Session {session_doc['id']} ended. Sending attendance email...")
                    
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
                        logger.info(f"Attendance email sent for session {session_doc['id']}, both signatures set to pending")
            except Exception as e:
                logger.error(f"Error processing session {session_doc.get('id')}: {e}")
                continue
        
        logger.info(f"Process completed. {emails_sent} attendance emails sent.")
        client.close()
        
    except Exception as e:
        logger.error(f"Error in check_and_send_emails: {e}")
        raise

async def run_service():
    """Boucle principale du service"""
    logger.info("Attendance email service started")
    while True:
        try:
            await check_and_send_emails()
        except Exception as e:
            logger.error(f"Error in service loop: {e}")
        
        # Attendre 2 minutes avant la prochaine vérification
        logger.info("Waiting 2 minutes before next check...")
        await asyncio.sleep(120)  # 120 secondes = 2 minutes

if __name__ == "__main__":
    asyncio.run(run_service())
