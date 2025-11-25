#!/usr/bin/env python3
"""
Script pour mettre à jour tous les élèves avec la photo de Jonathan GHIZZO
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def update_profiles():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔄 Mise à jour des photos de profil...")
    
    # Mettre à jour tous les élèves avec la photo de Jonathan GHIZZO
    result = await db.users.update_many(
        {"role": "student"},
        {"$set": {
            "profile_picture": "/static/profile_pictures/jonathan_ghizzo.png"
        }}
    )
    
    print(f"✅ {result.modified_count} élèves mis à jour avec la photo de Jonathan GHIZZO")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_profiles())
