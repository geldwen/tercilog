"""
Script d'initialisation des templates de questionnaires par parcours
À exécuter une seule fois pour mettre en place le système
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime

async def init_templates():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'test_database')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("INITIALISATION SYSTÈME TEMPLATES QUESTIONNAIRES")
    print("=" * 60)
    
    # 1. Créer les templates pour chaque parcours
    print("\n1️⃣ CRÉATION DES TEMPLATES PAR PARCOURS")
    print("-" * 60)
    
    # Vérifier si templates existent déjà
    existing = await db.questionnaire_templates.count_documents({})
    if existing > 0:
        print(f"⚠️ {existing} templates déjà existants. Suppression...")
        await db.questionnaire_templates.delete_many({})
    
    templates = [
        # ANGLAIS
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Anglais",
            "type": "Q1",
            "title": "Questionnaire de besoin en formation - Anglais",
            "description": "Questionnaire initial pour identifier les besoins en formation linguistique anglaise",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Anglais",
            "type": "Q2",
            "title": "Questionnaire à mi-parcours - Anglais",
            "description": "Évaluation intermédiaire de la formation d'anglais",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Anglais",
            "type": "Q3",
            "title": "Questionnaire de fin de formation - Anglais",
            "description": "Bilan final et satisfaction de la formation d'anglais",
            "created_at": datetime.utcnow().isoformat()
        },
        
        # BUREAUTIQUE
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Bureautique",
            "type": "Q1",
            "title": "Questionnaire de besoin en formation - Bureautique",
            "description": "Questionnaire initial pour identifier les besoins en formation bureautique",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Bureautique",
            "type": "Q2",
            "title": "Questionnaire à mi-parcours - Bureautique",
            "description": "Évaluation intermédiaire de la formation bureautique",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Bureautique",
            "type": "Q3",
            "title": "Questionnaire de fin de formation - Bureautique",
            "description": "Bilan final et satisfaction de la formation bureautique",
            "created_at": datetime.utcnow().isoformat()
        },
        
        # MANAGEMENT
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Management",
            "type": "Q1",
            "title": "Questionnaire de besoin en formation - Management",
            "description": "Questionnaire initial pour identifier les besoins en formation management",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Management",
            "type": "Q2",
            "title": "Questionnaire à mi-parcours - Management",
            "description": "Évaluation intermédiaire de la formation management",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "parcours_name": "Management",
            "type": "Q3",
            "title": "Questionnaire de fin de formation - Management",
            "description": "Bilan final et satisfaction de la formation management",
            "created_at": datetime.utcnow().isoformat()
        }
    ]
    
    await db.questionnaire_templates.insert_many(templates)
    print(f"✅ {len(templates)} templates créés")
    
    # Afficher par parcours
    parcours_list = list(set([t["parcours_name"] for t in templates]))
    for parcours in parcours_list:
        count = len([t for t in templates if t["parcours_name"] == parcours])
        print(f"   - {parcours}: {count} questionnaires (Q1, Q2, Q3)")
    
    # 2. Mettre à jour les élèves existants pour normaliser le champ "matiere"
    print("\n2️⃣ NORMALISATION DU CHAMP 'matiere' DES ÉLÈVES")
    print("-" * 60)
    
    students = await db.users.find({"role": "student"}, {"_id": 0}).to_list(length=None)
    print(f"Total élèves: {len(students)}")
    
    for student in students:
        matiere = student.get("matiere", "Non spécifié")
        if matiere not in parcours_list and matiere != "Non spécifié":
            # Essayer de mapper vers un parcours existant
            if "anglais" in matiere.lower():
                new_matiere = "Anglais"
            elif "bureau" in matiere.lower():
                new_matiere = "Bureautique"
            elif "manage" in matiere.lower():
                new_matiere = "Management"
            else:
                new_matiere = "Anglais"  # Par défaut
            
            await db.users.update_one(
                {"id": student.get("id")},
                {"$set": {"matiere": new_matiere}}
            )
            print(f"   ✅ {student.get('name')}: '{matiere}' → '{new_matiere}'")
    
    print("\n" + "=" * 60)
    print("✅ INITIALISATION TERMINÉE")
    print("=" * 60)
    print("\n📝 PROCHAINES ÉTAPES:")
    print("   1. Les nouveaux élèves créés recevront automatiquement")
    print("      leurs Q1/Q2/Q3 selon leur parcours")
    print("   2. Les élèves existants gardent leurs questionnaires actuels")
    print("   3. Vous pouvez créer de nouveaux parcours en ajoutant")
    print("      3 templates (Q1, Q2, Q3) dans questionnaire_templates")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(init_templates())
