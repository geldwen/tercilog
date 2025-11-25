#!/usr/bin/env python3
"""
Script de nettoyage pour supprimer les mots de passe en clair de la base de données
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def cleanup_passwords():
    # MongoDB connection
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔒 Début du nettoyage des mots de passe en clair...")
    
    # Compter les documents avant nettoyage
    total_users = await db.users.count_documents({})
    users_with_plain_password = await db.users.count_documents({"plain_password": {"$exists": True}})
    users_with_password = await db.users.count_documents({"password": {"$exists": True}})
    
    print(f"📊 Utilisateurs totaux : {total_users}")
    print(f"📊 Utilisateurs avec 'plain_password' : {users_with_plain_password}")
    print(f"📊 Utilisateurs avec 'password' : {users_with_password}")
    
    # Supprimer les champs plain_password et password de tous les utilisateurs
    result = await db.users.update_many(
        {},
        {"$unset": {"plain_password": "", "password": ""}}
    )
    
    print(f"✅ Nettoyage terminé !")
    print(f"✅ {result.modified_count} documents mis à jour")
    
    # Vérification finale
    remaining_plain = await db.users.count_documents({"plain_password": {"$exists": True}})
    remaining_pass = await db.users.count_documents({"password": {"$exists": True}})
    
    print(f"✅ Vérification : {remaining_plain} documents avec 'plain_password' restants")
    print(f"✅ Vérification : {remaining_pass} documents avec 'password' restants")
    
    if remaining_plain == 0 and remaining_pass == 0:
        print("🎉 Base de données sécurisée ! Tous les mots de passe en clair ont été supprimés.")
    else:
        print("⚠️  Attention : certains mots de passe en clair n'ont pas été supprimés")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(cleanup_passwords())
