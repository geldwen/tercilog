"""
Script pour créer les 3 questionnaires pour l'étudiant Toto Test
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
import uuid

async def create_questionnaires():
    mongo_url = os.environ.get('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['tercilog']
    
    # ID de l'étudiant Toto Test
    student_id = "7db42079-64bc-45c0-b2c5-deea98af3f1f"
    
    print(f"Création des questionnaires pour Toto Test (ID: {student_id})")
    
    # 1) Questionnaire de besoin en formation
    formation_needs = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "situation_professionnelle": "Employé",
        "poste": "Développeur Web Junior",
        "anciennete": "2 ans",
        "formation_anglais_anterieure": "Oui",
        "raison_formation": "Améliorer mes compétences en anglais technique pour mieux communiquer avec les clients internationaux",
        "objectifs_principaux": "Améliorer mon expression orale et ma compréhension de documents techniques en anglais",
        "comprehension_orale": "Moyen",
        "expression_orale": "Faible",
        "comprehension_ecrite": "Bon",
        "expression_ecrite": "Moyen",
        "situations_professionnelles": "Réunions avec clients anglophones, Lecture de documentation technique",
        "difficultes_rencontrees": "Difficulté à m'exprimer spontanément en réunion",
        "certification_souhaitee": "TOEIC",
        "rythme_souhaite": "2 séances par semaine",
        "format_prefere": "Cours individuels",
        "contraintes_particulieres": "Disponible en soirée uniquement",
        "situation_handicap": "Non",
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    # Vérifier si le questionnaire existe déjà
    existing_q1 = await db.formation_needs_questionnaires.find_one({"student_id": student_id})
    if existing_q1:
        print("✓ Questionnaire 1 (Besoin en formation) existe déjà")
    else:
        await db.formation_needs_questionnaires.insert_one(formation_needs)
        print("✓ Questionnaire 1 (Besoin en formation) créé")
    
    # 2) Questionnaire à mi-parcours
    mid_course = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "nom_complet": "Toto Test",
        "date_questionnaire": "2025-11-13",
        "nom_formateur": "Prof Test",
        "mode_formation": "Présentiel",
        "attentes_respectees": "Oui",
        "attentes_commentaire": "Les cours correspondent bien à mes attentes, bon rythme et supports clairs",
        "rythme_adapte": "Oui",
        "supports_adaptes": "Oui",
        "apprentissages": "J'ai appris du vocabulaire technique et amélioré ma compréhension orale",
        "difficultes": "Parfois difficile de trouver les mots justes en conversation spontanée",
        "approfondir": "Expressions idiomatiques et conversation professionnelle",
        "suggestions": "Plus d'exercices de mise en situation réelle",
        "observation_formateur": "Élève motivé et assidu, bonne progression",
        "ajustements_formateur": "Ajouter plus d'exercices de conversation",
        "decision_formateur": "Continuer",
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    # Vérifier si le questionnaire existe déjà
    existing_q2 = await db.mid_course_questionnaires.find_one({"student_id": student_id})
    if existing_q2:
        print("✓ Questionnaire 2 (Mi-parcours) existe déjà")
    else:
        await db.mid_course_questionnaires.insert_one(mid_course)
        print("✓ Questionnaire 2 (Mi-parcours) créé")
    
    # 3) Questionnaire de fin de formation
    end_course = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "nom_complet": "Toto Test",
        "date_questionnaire": "2025-11-13",
        "nom_formateur": "Prof Test",
        "duree_formation": "30 heures",
        "mode_formation": "Présentiel",
        "progression_globale": "Très satisfaisante",
        "domaines_amelioration": "Expression orale, Compréhension en contexte professionnel, Vocabulaire technique",
        "aise_professionnel": "Oui",
        "points_renforcer": "Aucun, je me sens bien préparé",
        "objectifs_atteints": "Oui",
        "contenu_adapte": "Oui",
        "rythme_satisfaisant": "Oui",
        "appreciation_formateur": "Excellent formateur, pédagogue et patient",
        "evaluation_globale": "5",
        "recommandation": "Oui",
        "utilisation_competences": "Oui, dès maintenant dans mon travail quotidien",
        "formation_complementaire": "Peut-être une formation avancée en anglais des affaires dans quelques mois",
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    # Vérifier si le questionnaire existe déjà
    existing_q3 = await db.end_course_questionnaires.find_one({"student_id": student_id})
    if existing_q3:
        print("✓ Questionnaire 3 (Fin de formation) existe déjà")
    else:
        await db.end_course_questionnaires.insert_one(end_course)
        print("✓ Questionnaire 3 (Fin de formation) créé")
    
    print("\n✅ Tous les questionnaires pour Toto Test ont été créés/vérifiés")
    print("Les questionnaires sont maintenant visibles dans l'interface professeur")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_questionnaires())
