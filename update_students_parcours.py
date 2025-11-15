#!/usr/bin/env python3
"""
Script pour mettre à jour tous les élèves existants avec le parcours "Anglais"
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def update_students_parcours():
    # Connexion MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔍 Recherche de tous les élèves...")
    
    # Récupérer tous les élèves
    students = await db.users.find({"role": "student"}, {"_id": 0}).to_list(length=None)
    
    print(f"✅ Trouvé {len(students)} élève(s)")
    
    # Mettre à jour chaque élève avec "Anglais"
    updated_count = 0
    for student in students:
        student_id = student.get("id")
        student_name = student.get("name", "Inconnu")
        current_parcours = student.get("parcours", "")
        
        # Mettre à jour avec "Anglais"
        result = await db.users.update_one(
            {"id": student_id},
            {"$set": {"parcours": "Anglais"}}
        )
        
        if result.modified_count > 0:
            print(f"  ✓ {student_name}: '{current_parcours}' → 'Anglais'")
            updated_count += 1
        else:
            print(f"  - {student_name}: déjà 'Anglais' ou non modifié")
    
    print(f"\n🎉 Mise à jour terminée : {updated_count} élève(s) modifié(s)")
    
    # Vérification
    print("\n🔍 Vérification des parcours...")
    students_after = await db.users.find({"role": "student"}, {"_id": 0, "name": 1, "parcours": 1}).to_list(length=None)
    for s in students_after:
        print(f"  • {s.get('name')}: {s.get('parcours', 'NON DÉFINI')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_students_parcours())
