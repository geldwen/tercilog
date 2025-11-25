#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def update_urls():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔄 Mise à jour des URLs de photos...")
    
    # Mettre à jour les URLs avec le nouveau format /api/profile-pictures/
    result1 = await db.users.update_many(
        {"profile_picture": "/static/profile_pictures/homme_default.png"},
        {"$set": {"profile_picture": "/api/profile-pictures/homme_default.png"}}
    )
    
    result2 = await db.users.update_many(
        {"profile_picture": "/static/profile_pictures/femme_default.png"},
        {"$set": {"profile_picture": "/api/profile-pictures/femme_default.png"}}
    )
    
    result3 = await db.users.update_many(
        {"profile_picture": "/static/profile_pictures/jonathan_ghizzo.png"},
        {"$set": {"profile_picture": "/api/profile-pictures/jonathan_ghizzo.png"}}
    )
    
    print(f"✅ {result1.modified_count} utilisateurs avec homme_default mis à jour")
    print(f"✅ {result2.modified_count} utilisateurs avec femme_default mis à jour")
    print(f"✅ {result3.modified_count} utilisateurs avec jonathan_ghizzo mis à jour")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_urls())
