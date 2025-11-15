#!/usr/bin/env python3
"""
Script pour créer des FAUX questionnaires 2 et 3 pour Toto (pour test)
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

async def main():
    print("🔧 Connexion à MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.tercilog
    
    # Récupérer Toto
    toto = await db.users.find_one({"email": "toto@test.com"}, {"_id": 0})
    if not toto:
        print("❌ Toto non trouvé !")
        return
    
    student_id = toto['id']
    print(f"✅ Toto trouvé : {student_id}")
    
    # SUPPRIMER les anciens questionnaires d'abord
    print("\n🗑️  Suppression des anciens questionnaires...")
    await db.mid_course_questionnaires.delete_many({"student_id": student_id})
    await db.end_course_questionnaires.delete_many({"student_id": student_id})
    print("✅ Anciens questionnaires supprimés")
    
    # QUESTIONNAIRE 2 - Mi-parcours
    print("\n📝 Création du questionnaire 2 (mi-parcours)...")
    q2_data = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "nom_prenom": "Toto Test",
        "date_suivi": "2025-03-15",
        "formateur_referent": "Jean Ghizzo",
        "mode_formation": ["Distanciel"],
        "formation_attentes": "Tout à fait",
        "rythme_duree": "Plutôt oui",
        "supports_methodes": "Oui tout à fait",
        "apprentissages": "J'ai beaucoup progressé en compréhension orale",
        "difficultes": "Encore des soucis avec la prononciation",
        "approfondir": "Oui",
        "approfondir_details": "Plus d'exercices de conversation",
        "suggestions": "Très bien comme ça !",
        "observation_formateur": "",
        "ajustements": "",
        "decision": [],
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.mid_course_questionnaires.insert_one(q2_data)
    print(f"✅ Questionnaire 2 créé !")
    
    # QUESTIONNAIRE 3 - Fin de formation
    print("\n📝 Création du questionnaire 3 (fin de formation)...")
    q3_data = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "nom_prenom": "Toto Test",
        "date": "2025-06-30",
        "formateur_referent": "Jean Ghizzo",
        "duree_totale": "30 heures",
        "mode_formation": ["Distanciel"],
        "progression": "Oui, beaucoup",
        "domaines_amelioration": ["Compréhension orale", "Expression orale"],
        "domaines_autre": "",
        "aise_professionnel": "Tout à fait",
        "points_renforcer": "La grammaire avancée",
        "objectifs_atteints": "Oui totalement",
        "contenu_adapte": "Tout à fait",
        "rythme_duree": "Oui tout à fait",
        "formateur_satisfaisant": "Tout à fait",
        "evaluation_globale": "⭐ Excellent",
        "recommandation": "Oui",
        "utilisation_competences": "Dans mon travail quotidien avec clients internationaux",
        "formation_complementaire": "Oui",
        "formation_complementaire_details": "Préparation TOEIC",
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.end_course_questionnaires.insert_one(q3_data)
    print(f"✅ Questionnaire 3 créé !")
    
    print("\n" + "="*80)
    print("🎉 QUESTIONNAIRES 2 ET 3 CRÉÉS AVEC SUCCÈS POUR TOTO !")
    print("="*80)
    print(f"\nID Toto : {student_id}")
    print(f"\n✅ Questionnaire 2 (mi-parcours) : CRÉÉ")
    print(f"✅ Questionnaire 3 (fin de formation) : CRÉÉ")
    print(f"\n💡 Pour vérifier :")
    print(f"   1. Connectez-vous en tant que professeur (prof@test.com / prof123)")
    print(f"   2. Allez dans 'Parcours élève' de Toto")
    print(f"   3. Onglet 'Documents bénéficiaires'")
    print(f"   4. Vous devriez voir 3 questionnaires")
    print("="*80 + "\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
