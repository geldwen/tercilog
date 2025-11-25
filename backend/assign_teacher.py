#!/usr/bin/env python3
"""
Script pour assigner Jonathan GHIZZO comme formateur à tous les élèves existants
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def assign_teacher():
    # MongoDB connection
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔄 Assignation de Jonathan GHIZZO à tous les élèves...")
    
    # Compter les élèves avant
    total_students = await db.users.count_documents({"role": "student"})
    print(f"📊 Nombre total d'élèves : {total_students}")
    
    # Assigner Jonathan GHIZZO avec son email terciform@gmail.com
    result = await db.users.update_many(
        {"role": "student"},
        {"$set": {
            "teacher_name": "Jonathan GHIZZO",
            "teacher_email": "terciform@gmail.com",
            "teacher_phone": ""
        }}
    )
    
    print(f"✅ {result.modified_count} élèves mis à jour avec le formateur Jonathan GHIZZO")
    print(f"✅ Email du formateur : terciform@gmail.com")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(assign_teacher())
