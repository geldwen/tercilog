#!/usr/bin/env python3
"""Script pour créer le test T3 (fin de formation) bureautique"""
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
    
    # Questions converties au bon format
    questions_data = [
        {"q": "Dans un document Word, quel raccourci permet de sélectionner tout le texte ?", "choices": ["Ctrl + A", "Ctrl + S", "Ctrl + E", "Ctrl + Maj + A", "Ctrl + T"], "correct": "A"},
        {"q": "Dans Excel, quelle formule permet de calculer la moyenne d'une plage de cellules ?", "choices": ["=MOYENNE()", "=SOMME()", "=MOY()", "=AVG()", "=MOYEN()"], "correct": "A"},
        {"q": "Quel est l'usage principal de PowerPoint ?", "choices": ["Créer des présentations", "Créer une base de données", "Écrire du code", "Éditer des fichiers audio", "Gérer un calendrier"], "correct": "A"},
        {"q": "Dans Excel, que fait la poignée de recopie ?", "choices": ["Recopie une formule", "Supprime des données", "Ajoute un graphique", "Crée une macro", "Réalise un tri automatique"], "correct": "A"},
        {"q": "Quel format permet de conserver la mise en forme d'un document ?", "choices": ["PDF", "TXT", "CSV", "HTML", "RTF"], "correct": "A"},
        {"q": "Dans Word, comment insère-t-on un saut de page ?", "choices": ["Ctrl + Entrée", "Ctrl + P", "Ctrl + M", "Alt + Entrée", "Shift + Entrée"], "correct": "A"},
        {"q": "Dans Excel, quel symbole commence une formule ?", "choices": ["=", "+", "-", "/", "%"], "correct": "A"},
        {"q": "Quel onglet PowerPoint permet d'ajouter une nouvelle diapositive ?", "choices": ["Accueil", "Insertion", "Création", "Animations", "Transition"], "correct": "A"},
        {"q": "Dans Excel, que permet un tableau croisé dynamique ?", "choices": ["Analyser des données", "Insérer des images", "Fusionner des cellules", "Créer une macro", "Exporter en PDF"], "correct": "A"},
        {"q": "Dans Word, comment justifier un paragraphe ?", "choices": ["Ctrl + J", "Ctrl + G", "Ctrl + D", "Ctrl + Q", "Ctrl + R"], "correct": "A"},
        {"q": "Un fichier .xlsx est un fichier :", "choices": ["Excel", "Word", "PowerPoint", "Access", "Publisher"], "correct": "A"},
        {"q": "Quel est le raccourci pour enregistrer un document ?", "choices": ["Ctrl + S", "Ctrl + A", "Ctrl + F", "Ctrl + N", "Ctrl + E"], "correct": "A"},
        {"q": "Dans PowerPoint, comment passe-t-on en mode diaporama ?", "choices": ["F5", "F2", "F9", "Shift + F5", "Ctrl + F5"], "correct": "A"},
        {"q": "Que permet la fonction =SI() dans Excel ?", "choices": ["Créer une condition", "Créer une moyenne", "Formater une cellule", "Générer un graphique", "Créer un tri"], "correct": "A"},
        {"q": "Dans Word, comment afficher les caractères invisibles ?", "choices": ["En cliquant ¶", "Ctrl + H", "Ctrl + Maj + P", "Ctrl + Alt + I", "Alt + Maj + C"], "correct": "A"},
        {"q": "Dans Excel, que signifie #DIV/0 ?", "choices": ["Division par zéro", "Erreur de formule", "Cellule vide", "Référence manquante", "Valeur non valide"], "correct": "A"},
        {"q": "Quel outil permet de vérifier l'orthographe dans Word ?", "choices": ["Correcteur", "Format", "Affichage", "Insertion", "Révision automatique"], "correct": "A"},
        {"q": "Dans PowerPoint, comment insérer un graphique ?", "choices": ["Insertion → Graphique", "Accueil → Zone de texte", "Création → Effets", "Animations → Ajouter", "Affichage → Graphique"], "correct": "A"},
        {"q": "Quel type de fichier correspond à un modèle Word ?", "choices": ["DOTX", "DOC", "PDF", "XLSX", "PPTX"], "correct": "A"},
        {"q": "Quel outil Excel permet de trier des données ?", "choices": ["Trier/Filtrer", "Mise en forme", "Graphiques", "Impression", "Affichage"], "correct": "A"},
        {"q": "Dans Word, à quoi sert un style ?", "choices": ["Appliquer une mise en forme cohérente", "Ajouter un tableau", "Créer une formule", "Ajouter une diapositive", "Créer un hyperlien"], "correct": "A"},
        {"q": "Quel est le raccourci pour copier ?", "choices": ["Ctrl + C", "Ctrl + V", "Ctrl + X", "Ctrl + B", "Ctrl + U"], "correct": "A"},
        {"q": "Quel est le raccourci pour coller ?", "choices": ["Ctrl + V", "Ctrl + C", "Ctrl + X", "Ctrl + Z", "Ctrl + Shift + V"], "correct": "A"},
        {"q": "Dans PowerPoint, comment dupliquer une diapositive ?", "choices": ["Ctrl + D", "Ctrl + C puis Ctrl + V", "Shift + D", "Ctrl + Alt + D", "F4"], "correct": "A"},
        {"q": "Quel outil Excel permet d'insérer rapidement un graphique ?", "choices": ["Alt + F1", "Ctrl + G", "F9", "Shift + F2", "Alt + Shift + G"], "correct": "A"},
        {"q": "Dans Word, comment insérer un tableau ?", "choices": ["Insertion → Tableau", "Accueil → Styles", "Affichage → Grille", "Révision → Ajouter", "Dessin → Forme"], "correct": "A"},
        {"q": "Dans Excel, comment figer une ligne ?", "choices": ["Affichage → Figer les volets", "Accueil → Fusionner", "Données → Valider", "Insertion → Lignes", "Mise en page → Figer"], "correct": "A"},
        {"q": "Quel format de fichier correspond à une présentation PowerPoint ?", "choices": ["PPTX", "PPTM", "PPT", "PDF", "KEY"], "correct": "A"},
        {"q": "À quoi sert la mise en forme conditionnelle dans Excel ?", "choices": ["Mettre en évidence des valeurs", "Créer une macro", "Fusionner des cellules", "Créer un graphique", "Importer un fichier"], "correct": "A"},
        {"q": "Dans Word, que permet un en-tête ?", "choices": ["Afficher un élément sur chaque page", "Créer une zone de texte", "Insérer une image", "Ajouter un tableau", "Modifier l'arrière-plan"], "correct": "A"},
    ]
    
    # Créer la structure des sections
    sections = []
    current_section_questions = []
    section_titles = ["Bureautique – Compétences générales (Q1-Q10)", "Excel et calculs (Q11-Q20)", "Word et PowerPoint (Q21-Q30)"]
    
    for i, qdata in enumerate(questions_data):
        q_num = i + 1
        current_section_questions.append({
            "id": f"Q{q_num}",
            "text": qdata["q"],
            "type": "multiple_choice",
            "multipleAllowed": False,
            "choices": [{"key": chr(65+j), "label": choice} for j, choice in enumerate(qdata["choices"])],
            "correctAnswers": [qdata["correct"]],
            "points": 1
        })
        
        # Créer une section tous les 10 questions
        if (i + 1) % 10 == 0 or i == len(questions_data) - 1:
            section_idx = len(sections)
            sections.append({
                "id": f"section_{section_idx + 1}",
                "title": section_titles[section_idx] if section_idx < len(section_titles) else f"Section {section_idx + 1}",
                "description": f"Questions {section_idx * 10 + 1} à {min((section_idx + 1) * 10, len(questions_data))}",
                "questions": current_section_questions
            })
            current_section_questions = []
    
    test_data = {
        "id": "test-bureautique-fin-v1",
        "template_name": "T3 - Test de fin de formation",
        "parcours": "Bureautique",
        "title": "Test Final Bureautique – T3",
        "description": "Évaluation finale des compétences bureautiques. Ce test comporte 30 questions avec 5 choix possibles.",
        "sections": sections,
        "scoring": {
            "totalPoints": 30,
            "levels": [
                {"min": 0, "max": 12, "label": "Acquis insuffisants"},
                {"min": 13, "max": 22, "label": "Bon niveau final"},
                {"min": 23, "max": 30, "label": "Excellent niveau – maîtrise complète"}
            ]
        }
    }
    
    # Insérer ou mettre à jour
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
    print(f"   - 30 questions")
    print(f"   - {test_data['scoring']['totalPoints']} points au total")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_test())
