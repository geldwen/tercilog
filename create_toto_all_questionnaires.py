#!/usr/bin/env python3
"""
Script pour créer les questionnaires 2 et 3 pour l'élève Toto
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

# Ajout du chemin backend pour l'import
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

async def main():
    print("🔧 Connexion à MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.tercilog
    
    # Récupérer l'ID de Toto
    toto = await db.users.find_one({"email": "toto@test.com"}, {"_id": 0})
    if not toto:
        print("❌ Élève Toto non trouvé ! Veuillez d'abord créer Toto.")
        return
    
    student_id = toto['id']
    print(f"✅ Élève Toto trouvé (ID: {student_id})")
    
    # 1. Créer le questionnaire à mi-parcours
    print("\n📋 Création du questionnaire à mi-parcours...")
    
    mid_course_data = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        
        # 1. Informations générales
        "nom_prenom": "Toto Test",
        "date_suivi": "2025-03-15",
        "formateur_referent": "Jean Ghizzo",
        "mode_formation": ["Distanciel"],
        
        # 2. Ressenti
        "formation_attentes": "Tout à fait",
        "rythme_duree": "Plutôt oui",
        "supports_methodes": "Oui tout à fait",
        
        # 3. Progression
        "apprentissages": "J'ai beaucoup amélioré ma compréhension orale et mon vocabulaire professionnel",
        "difficultes": "J'ai encore quelques difficultés avec la prononciation de certains mots techniques",
        "approfondir": "Oui",
        "approfondir_details": "Pratique de l'oral et prononciation",
        "suggestions": "Plus d'exercices de conversation simulée serait super",
        
        # 4. Suivi formateur
        "observation_formateur": "",
        "ajustements": "",
        "decision": [],
        
        "submitted_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    }
    
    existing_mid = await db.mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if existing_mid:
        await db.mid_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": mid_course_data}
        )
        print(f"   ✅ Questionnaire à mi-parcours mis à jour")
    else:
        await db.mid_course_questionnaires.insert_one(mid_course_data)
        print(f"   ✅ Questionnaire à mi-parcours créé")
    
    # 2. Créer le questionnaire de fin de formation
    print("\n📋 Création du questionnaire de fin de formation...")
    
    end_course_data = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        
        # 1. Informations générales
        "nom_prenom": "Toto Test",
        "date": "2025-06-30",
        "formateur_referent": "Jean Ghizzo",
        "duree_totale": "30 heures",
        "mode_formation": ["Distanciel"],
        
        # 2. Évaluation des acquis
        "progression": "Oui, beaucoup",
        "domaines_amelioration": ["Compréhension orale", "Expression orale", "Expression écrite"],
        "domaines_autre": "",
        "aise_professionnel": "Tout à fait",
        "points_renforcer": "La grammaire avancée et l'expression d'idées complexes",
        "objectifs_atteints": "Oui totalement",
        
        # 3. Appréciation
        "contenu_adapte": "Tout à fait",
        "rythme_duree": "Oui tout à fait",
        "formateur_satisfaisant": "Tout à fait",
        "evaluation_globale": "⭐ Excellent",
        "recommandation": "Oui",
        
        # 4. Perspectives
        "utilisation_competences": "Je vais utiliser l'anglais quotidiennement dans mes échanges avec les clients internationaux et participer activement aux réunions en anglais",
        "formation_complementaire": "Oui",
        "formation_complementaire_details": "Anglais professionnel avancé pour préparer le TOEIC",
        
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing_end = await db.end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if existing_end:
        await db.end_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": end_course_data}
        )
        print(f"   ✅ Questionnaire de fin de formation mis à jour")
    else:
        await db.end_course_questionnaires.insert_one(end_course_data)
        print(f"   ✅ Questionnaire de fin de formation créé")
    
    print("\n" + "="*80)
    print("🎉 QUESTIONNAIRES 2 ET 3 CRÉÉS POUR TOTO !")
    print("="*80)
    print(f"\n✅ Les 3 questionnaires sont maintenant disponibles pour Toto:")
    print(f"   1️⃣  Questionnaire de besoins en formation (déjà créé)")
    print(f"   2️⃣  Questionnaire à mi-parcours (créé à l'instant)")
    print(f"   3️⃣  Questionnaire de fin de formation (créé à l'instant)")
    print(f"\n💡 Pour tester:")
    print(f"   1. Connectez-vous en tant que professeur (prof@test.com / prof123)")
    print(f"   2. Ouvrez 'Parcours élève' de Toto Test")
    print(f"   3. Allez dans 'Documents bénéficiaires'")
    print(f"   4. Vous verrez les 3 questionnaires avec leurs boutons")
    print(f"\n💡 Côté élève:")
    print(f"   1. Connectez-vous en tant que Toto (toto@test.com / toto123)")
    print(f"   2. Dans 'Mes besoins en formation', les 3 boutons sont maintenant VERTS")
    print(f"   3. Avec la mention '✓ Validé' (non modifiables)")
    print("="*80 + "\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
