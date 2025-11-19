#!/usr/bin/env python3
"""Script pour créer une ressource de test pour l'élève JOJO"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path
from datetime import datetime, timezone
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def create_resource():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # ID de l'élève JOJO
    student_id = "5048760c-f368-4763-89b8-17b4a85259cc"
    
    # Créer une ressource de test
    resource = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        "category": "TEST_PARCOURS",
        "sub_type": "POSITIONNEMENT",
        "template_name": "Test bureautique débutant",
        "resource_type": "FORM",
        "status": "NON_COMMENCE",
        "score": None,
        "submitted_at": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.student_resources.insert_one(resource)
    print(f"✅ Ressource créée avec succès!")
    print(f"   ID: {resource['id']}")
    print(f"   Élève: {student_id}")
    print(f"   Template: {resource['template_name']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_resource())
