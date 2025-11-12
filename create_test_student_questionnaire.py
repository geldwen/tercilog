#!/usr/bin/env python3
"""
Script pour créer un élève de test nommé "Toto" et soumettre un questionnaire de formation
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

# Ajout du chemin backend pour l'import
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import bcrypt

load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

async def main():
    print("🔧 Connexion à MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.tercilog
    
    # 1. Créer l'élève "Toto"
    print("\n📝 Création de l'élève Toto...")
    
    student_id = str(uuid.uuid4())
    hashed_password = bcrypt.hashpw("toto123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    student_data = {
        "id": student_id,
        "name": "Toto Test",
        "email": "toto@test.com",
        "password": hashed_password,
        "role": "student",
        "phone": "0612345678",
        "organism": "TerciForm",
        "support_type": "CPF",
        "session_type": "distanciel",
        "start_date": "2025-01-15",
        "end_date": "2025-06-30",
        "total_hours": 30.0,
        "credit_hours": 30.0,
        "welcome_email_sent": False
    }
    
    # Vérifier si l'élève existe déjà
    existing = await db.users.find_one({"email": "toto@test.com"}, {"_id": 0})
    if existing:
        print(f"   ℹ️  L'élève Toto existe déjà (ID: {existing['id']})")
        student_id = existing['id']
    else:
        await db.users.insert_one(student_data)
        print(f"   ✅ Élève Toto créé avec succès (ID: {student_id})")
        print(f"   📧 Email: toto@test.com")
        print(f"   🔒 Mot de passe: toto123")
    
    # 2. Soumettre le questionnaire de formation
    print("\n📋 Soumission du questionnaire de besoins en formation...")
    
    questionnaire_data = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        
        # 1. Identification
        "situation_professionnelle": ["En fonction"],
        "si_en_fonction": "Salarié dans une entreprise privée",
        "poste_occupe": "Assistant commercial",
        "anciennete": "3 ans",
        
        # 2. Motivation et objectifs
        "formation_anglais_anterieure": "Oui",
        "formation_details": "Cours d'anglais au lycée et 1 stage intensif en 2020",
        "raison_formation": "Je souhaite améliorer mon anglais professionnel pour pouvoir communiquer avec nos clients internationaux et participer aux réunions en anglais",
        "cadre_utilisation": ["Travail quotidien", "Communication client", "Réunions"],
        "cadre_autre": "",
        "objectifs_principaux": ["Gagner en aisance à l'oral", "Améliorer la compréhension", "Rédiger des e-mails"],
        "attentes_fin_formation": "Être capable de tenir une conversation professionnelle fluide en anglais et rédiger des emails sans fautes",
        
        # 3. Niveau et compétences
        "comprehension_orale": "Moyen",
        "expression_orale": "Faible",
        "comprehension_ecrite": "Bon",
        "expression_ecrite": "Moyen",
        
        # 4. Besoins professionnels
        "situations_anglais_necessaire": "Répondre aux emails des clients étrangers, participer aux conf calls hebdomadaires avec l'équipe internationale, présenter nos produits lors de salons",
        "difficultes": ["Manque de vocabulaire", "Blocage à l'oral", "Prononciation"],
        "difficultes_autre": "",
        "contenu_particulier": "Vocabulaire commercial et technique de notre secteur (technologie et logiciels)",
        "certification_souhaitee": "Oui",
        "certification_laquelle": "TOEIC",
        
        # 5. Contraintes et conditions
        "rythme_souhaite": ["Flexible"],
        "format_prefere": ["Distanciel"],
        "contraintes_particulieres": "Disponibilité principalement en soirée après 18h et le samedi matin",
        
        # 6. Situation de handicap
        "situation_handicap": "Non",
        "accompagnement_specifique": "",
        "materiel_particulier": [],
        "materiel_autre": "",
        "amenagement_rythme": [],
        "amenagement_autre": "",
        
        # Signature et date
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Vérifier si un questionnaire existe déjà pour cet élève
    existing_q = await db.formation_needs.find_one({"student_id": student_id}, {"_id": 0})
    if existing_q:
        await db.formation_needs.update_one(
            {"student_id": student_id},
            {"$set": questionnaire_data}
        )
        print(f"   ✅ Questionnaire mis à jour pour Toto")
    else:
        await db.formation_needs.insert_one(questionnaire_data)
        print(f"   ✅ Questionnaire créé pour Toto")
    
    print("\n" + "="*80)
    print("🎉 ÉLÈVE DE TEST CRÉÉ AVEC SUCCÈS !")
    print("="*80)
    print(f"\n📊 Informations de connexion:")
    print(f"   Email: toto@test.com")
    print(f"   Mot de passe: toto123")
    print(f"   ID: {student_id}")
    print(f"\n✅ Le questionnaire a été soumis et est maintenant visible dans l'onglet")
    print(f"   'Documents bénéficiaires' du parcours élève de Toto.")
    print("\n💡 Pour tester:")
    print("   1. Connectez-vous en tant que professeur")
    print("   2. Cliquez sur 'Parcours élève' pour l'élève Toto")
    print("   3. Allez dans l'onglet 'Documents bénéficiaires'")
    print("   4. Vous verrez le questionnaire avec les réponses en rose")
    print("="*80 + "\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
