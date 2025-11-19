#!/usr/bin/env python3
"""Script pour créer le test T2 (mi-parcours) bureautique"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def seed_test():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    test_data = {
        "id": "test-bureautique-mi-parcours-v1",
        "template_name": "T2 - Test à mi parcours",
        "parcours": "Bureautique",
        "title": "Test d'évaluation intermédiaire – Bureautique",
        "description": "Évaluation des compétences intermédiaires acquises depuis le début de la formation.",
        "sections": [
            {
                "id": "word_inter",
                "title": "Word – Niveau intermédiaire",
                "description": "Questions sur les fonctionnalités intermédiaires de Word",
                "questions": [
                    {
                        "id": "Q1",
                        "text": "Quelle action permet de modifier tous les titres Titre 1 du document en même temps ?",
                        "type": "multiple_choice",
                        "multipleAllowed": False,
                        "choices": [
                            {"key": "A", "label": "Modifier manuellement chaque titre"},
                            {"key": "B", "label": "Modifier le style Titre 1"},
                            {"key": "C", "label": "Changer la police par défaut"},
                            {"key": "D", "label": "Appliquer un thème"},
                            {"key": "E", "label": "Utiliser le mode plan"}
                        ],
                        "correctAnswers": ["B"],
                        "points": 1
                    },
                    {
                        "id": "Q2",
                        "text": "Quels éléments sont modifiables dans le masque des diapositives Word ?",
                        "type": "multiple_choice",
                        "multipleAllowed": True,
                        "choices": [
                            {"key": "A", "label": "La police"},
                            {"key": "B", "label": "Les marges du document"},
                            {"key": "C", "label": "Les couleurs du thème"},
                            {"key": "D", "label": "Les styles de paragraphes"},
                            {"key": "E", "label": "La taille des pages"}
                        ],
                        "correctAnswers": ["A", "C", "D"],
                        "points": 1
                    },
                    {
                        "id": "Q3",
                        "text": "Quelle option est indispensable pour insérer un sommaire dynamique ?",
                        "multipleAllowed": False,
                        "type": "multiple_choice",
                        "choices": [
                            {"key": "A", "label": "Styles de titres"},
                            {"key": "B", "label": "Sauts de section"},
                            {"key": "C", "label": "Numérotation des pages"},
                            {"key": "D", "label": "Pied de page actif"},
                            {"key": "E", "label": "Mise en forme avancée"}
                        ],
                        "correctAnswers": ["A"],
                        "points": 1
                    },
                    {
                        "id": "Q4",
                        "text": "Quel type de saut permet de changer l'orientation d'une page ?",
                        "type": "multiple_choice",
                        "multipleAllowed": False,
                        "choices": [
                            {"key": "A", "label": "Saut de ligne"},
                            {"key": "B", "label": "Saut de page simple"},
                            {"key": "C", "label": "Saut de section"},
                            {"key": "D", "label": "Retour chariot"},
                            {"key": "E", "label": "Saut automatique"}
                        ],
                        "correctAnswers": ["C"],
                        "points": 1
                    }
                ]
            },
            {
                "id": "excel_inter",
                "title": "Excel – Niveau intermédiaire",
                "description": "Questions sur les fonctionnalités intermédiaires d'Excel",
                "questions": [
                    {
                        "id": "Q9",
                        "text": "Que renvoie la formule =MOYENNE(A1:A10) ?",
                        "type": "multiple_choice",
                        "multipleAllowed": False,
                        "choices": [
                            {"key": "A", "label": "La somme des valeurs"},
                            {"key": "B", "label": "La moyenne des valeurs"},
                            {"key": "C", "label": "Le nombre de cellules non vides"},
                            {"key": "D", "label": "La valeur maximale"},
                            {"key": "E", "label": "La première valeur"}
                        ],
                        "correctAnswers": ["B"],
                        "points": 1
                    },
                    {
                        "id": "Q10",
                        "text": "La mise en forme conditionnelle permet de :",
                        "multipleAllowed": False,
                        "type": "multiple_choice",
                        "choices": [
                            {"key": "A", "label": "Créer un graphique"},
                            {"key": "B", "label": "Modifier automatiquement la couleur selon une condition"},
                            {"key": "C", "label": "Insérer une image"},
                            {"key": "D", "label": "Protéger une feuille"},
                            {"key": "E", "label": "Créer une nouvelle formule"}
                        ],
                        "correctAnswers": ["B"],
                        "points": 1
                    }
                ]
            },
            {
                "id": "ppt_inter",
                "title": "PowerPoint – Niveau intermédiaire",
                "description": "Questions sur les fonctionnalités intermédiaires de PowerPoint",
                "questions": [
                    {
                        "id": "Q24",
                        "text": "Le masque des diapositives permet de :",
                        "type": "multiple_choice",
                        "multipleAllowed": False,
                        "choices": [
                            {"key": "A", "label": "Changer la mise en page globale"},
                            {"key": "B", "label": "Insérer un tableau"},
                            {"key": "C", "label": "Modifier une seule diapositive"},
                            {"key": "D", "label": "Créer une animation"},
                            {"key": "E", "label": "Créer un graphique"}
                        ],
                        "correctAnswers": ["A"],
                        "points": 1
                    }
                ]
            }
        ],
        "scoring": {
            "totalPoints": 7,
            "levels": [
                {"min": 0, "max": 3, "label": "Acquis insuffisants"},
                {"min": 4, "max": 5, "label": "Bon niveau intermédiaire"},
                {"min": 6, "max": 7, "label": "Très bon niveau – progression forte"}
            ]
        }
    }
    
    # Vérifier si le test existe déjà
    existing = await db.test_templates.find_one({"id": test_data["id"]})
    
    if existing:
        print("⚠️  Le test existe déjà, mise à jour...")
        await db.test_templates.replace_one({"id": test_data["id"]}, test_data)
        print(f"✅ Test mis à jour: {test_data['template_name']}")
    else:
        await db.test_templates.insert_one(test_data)
        print(f"✅ Test créé: {test_data['template_name']}")
    
    print(f"\n📊 Détails:")
    print(f"   - {len(test_data['sections'])} sections")
    total_questions = sum(len(s['questions']) for s in test_data['sections'])
    print(f"   - {total_questions} questions")
    print(f"   - {test_data['scoring']['totalPoints']} points au total")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_test())
