#!/usr/bin/env python3
"""
Script pour vérifier et envoyer les emails de rappel 5 minutes avant les séances
À exécuter périodiquement (toutes les minutes) via cron ou supervisor
"""
import asyncio
import sys
import os
from pathlib import Path

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

async def check_and_send_reminders():
    """Vérifie les séances qui commencent dans 5 minutes et envoie les rappels"""
    try:
        # Connexion MongoDB
        mongo_url = os.environ['MONGO_URL']
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ['DB_NAME']]
        
        # Import de la fonction d'envoi d'email
        from server import send_session_reminder_email
        
        now = datetime.now(timezone.utc)
        logger.info(f"Checking for sessions starting in 5 minutes at {now}")
        
        # Récupérer toutes les séances confirmées qui n'ont pas encore reçu de rappel
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
        
        logger.info(f"Process completed. {emails_sent} reminder emails sent.")
        client.close()
        
    except Exception as e:
        logger.error(f"Error in check_and_send_reminders: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(check_and_send_reminders())
