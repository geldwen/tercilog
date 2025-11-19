#!/usr/bin/env python3
"""Script pour mettre à jour le test T2 avec la version complète (30 questions)"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def update_test():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    test_data = {
        "id": "test-bureautique-mi-parcours-v1",
        "template_name": "T2 - Test à mi parcours",
        "parcours": "Bureautique",
        "title": "Test d'évaluation intermédiaire – Bureautique",
        "description": "Évaluation des compétences bureautiques de niveau intermédiaire.",
        "sections": [
            {
                "id": "word_inter",
                "title": "Word – Niveau intermédiaire",
                "description": "Questions sur les fonctionnalités intermédiaires de Word",
                "questions": [
                    {"id": "Q1", "text": "Quelle action permet de modifier tous les titres Titre 1 du document en même temps ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Modifier manuellement chaque titre"}, {"key": "B", "label": "Modifier le style Titre 1"}, {"key": "C", "label": "Changer la police par défaut"}, {"key": "D", "label": "Appliquer un thème"}, {"key": "E", "label": "Utiliser le mode plan"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q2", "text": "Quels éléments peuvent être modifiés dans le modèle Normal.dotm ?", "type": "multiple_choice", "multipleAllowed": True, "choices": [{"key": "A", "label": "Styles"}, {"key": "B", "label": "Mises en forme automatiques"}, {"key": "C", "label": "Polices par défaut"}, {"key": "D", "label": "Raccourcis clavier"}, {"key": "E", "label": "Taille des marges"}], "correctAnswers": ["A", "B", "C"], "points": 1},
                    {"id": "Q3", "text": "Quel type de saut permet d'avoir deux orientations différentes dans un même document ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Saut de ligne"}, {"key": "B", "label": "Saut de page simple"}, {"key": "C", "label": "Saut de section"}, {"key": "D", "label": "Retour chariot"}, {"key": "E", "label": "Saut automatique"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q4", "text": "Quel outil permet de comparer deux versions d'un même document Word ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Inspecteur de document"}, {"key": "B", "label": "Suivi des modifications"}, {"key": "C", "label": "Comparer"}, {"key": "D", "label": "Contrôle de compatibilité"}, {"key": "E", "label": "Mode lecture"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q5", "text": "Quels éléments peuvent être insérés automatiquement via les QuickParts ?", "type": "multiple_choice", "multipleAllowed": True, "choices": [{"key": "A", "label": "Champs"}, {"key": "B", "label": "Éléments de document"}, {"key": "C", "label": "Numérotations automatiques"}, {"key": "D", "label": "Tables des illustrations"}, {"key": "E", "label": "Infos auteur"}], "correctAnswers": ["A", "B", "E"], "points": 1},
                    {"id": "Q6", "text": "Quel outil est essentiel pour créer une table des illustrations automatique ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Styles"}, {"key": "B", "label": "Légendes"}, {"key": "C", "label": "Modèles"}, {"key": "D", "label": "Notes de bas de page"}, {"key": "E", "label": "Signets"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q7", "text": "Quel est l'intérêt principal du mode plan ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Créer des tableaux"}, {"key": "B", "label": "Réorganiser les titres et sous-titres"}, {"key": "C", "label": "Changer les polices"}, {"key": "D", "label": "Afficher deux pages côte à côte"}, {"key": "E", "label": "Modifier la mise en forme automatique"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q8", "text": "Quel format d'enregistrement permet de conserver les commentaires et modifications ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": ".docx"}, {"key": "B", "label": ".pdf"}, {"key": "C", "label": ".txt"}, {"key": "D", "label": ".rtf"}, {"key": "E", "label": ".xml"}], "correctAnswers": ["A"], "points": 1}
                ]
            },
            {
                "id": "excel_inter",
                "title": "Excel – Niveau intermédiaire",
                "description": "Questions sur les fonctionnalités intermédiaires d'Excel",
                "questions": [
                    {"id": "Q9", "text": "La formule =NBVAL(A1:A10) permet de :", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Compter toutes les cellules"}, {"key": "B", "label": "Compter les cellules contenant une valeur"}, {"key": "C", "label": "Compter les cellules vides"}, {"key": "D", "label": "Compter les cellules contenant du texte"}, {"key": "E", "label": "Compter les cellules contenant un nombre"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q10", "text": "Quel est le rôle de la fonction RECHERCHEV ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Chercher une valeur verticale dans un tableau"}, {"key": "B", "label": "Chercher une valeur horizontale"}, {"key": "C", "label": "Chercher une valeur unique dans deux feuilles"}, {"key": "D", "label": "Chercher une cellule vide"}, {"key": "E", "label": "Copier une formule"}], "correctAnswers": ["A"], "points": 1},
                    {"id": "Q11", "text": "La mise en forme conditionnelle permet de :", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Créer un graphique"}, {"key": "B", "label": "Changer la couleur selon une condition"}, {"key": "C", "label": "Ajouter des commentaires"}, {"key": "D", "label": "Fusionner des cellules"}, {"key": "E", "label": "Créer un tableau croisé dynamique"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q12", "text": "Un tableau croisé dynamique sert à :", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Créer un planning"}, {"key": "B", "label": "Synthétiser et analyser des données"}, {"key": "C", "label": "Importer des données externes"}, {"key": "D", "label": "Créer un graphique simple"}, {"key": "E", "label": "Protéger une feuille"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q13", "text": "Quelle formule calcule la valeur maximale dans une plage ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "=SOMME()"}, {"key": "B", "label": "=MAX()"}, {"key": "C", "label": "=NB()"}, {"key": "D", "label": "=SI()"}, {"key": "E", "label": "=VALEUR()"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q14", "text": "Quelle fonction permet d'arrondir un nombre au supérieur ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "ARRONDI"}, {"key": "B", "label": "PLANCHER"}, {"key": "C", "label": "PLAFOND"}, {"key": "D", "label": "NBVAL"}, {"key": "E", "label": "FRACTION"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q15", "text": "Quelle option permet de verrouiller une cellule dans une formule (A$1) ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "F4"}, {"key": "B", "label": "Ctrl + Shift"}, {"key": "C", "label": "Alt + Entrée"}, {"key": "D", "label": "Shift + F2"}, {"key": "E", "label": "Ctrl + L"}], "correctAnswers": ["A"], "points": 1},
                    {"id": "Q16", "text": "Quel menu permet de protéger une feuille Excel ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Insertion"}, {"key": "B", "label": "Mise en page"}, {"key": "C", "label": "Révision"}, {"key": "D", "label": "Affichage"}, {"key": "E", "label": "Données"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q17", "text": "Quel format permet de conserver macros et automatisations ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": ".xlsx"}, {"key": "B", "label": ".xlsm"}, {"key": "C", "label": ".csv"}, {"key": "D", "label": ".txt"}, {"key": "E", "label": ".xml"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q18", "text": "Quel graphique est le plus adapté pour suivre une évolution dans le temps ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Secteurs"}, {"key": "B", "label": "Histogramme"}, {"key": "C", "label": "Courbes"}, {"key": "D", "label": "Radar"}, {"key": "E", "label": "Bulles"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q19", "text": "Quelle fonction permet de tester une condition ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "=MAX()"}, {"key": "B", "label": "=SI()"}, {"key": "C", "label": "=MOYENNE()"}, {"key": "D", "label": "=VALEUR()"}, {"key": "E", "label": "=NB()"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q20", "text": "Quel bouton permet de filtrer un tableau ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Données > Filtrer"}, {"key": "B", "label": "Accueil > Trier"}, {"key": "C", "label": "Mise en page > Masquer"}, {"key": "D", "label": "Affichage > Figer les volets"}, {"key": "E", "label": "Insertion > Tableau"}], "correctAnswers": ["A"], "points": 1},
                    {"id": "Q21", "text": "Quelle formule permet de lier le contenu de deux cellules A1 et B1 ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "=A1+B1"}, {"key": "B", "label": "=A1&B1"}, {"key": "C", "label": "=SOMME(A1:B1)"}, {"key": "D", "label": "=LIER(A1;B1)"}, {"key": "E", "label": "=FUSION(A1;B1)"}], "correctAnswers": ["B"], "points": 1}
                ]
            },
            {
                "id": "ppt_inter",
                "title": "PowerPoint – Niveau intermédiaire",
                "description": "Questions sur les fonctionnalités intermédiaires de PowerPoint",
                "questions": [
                    {"id": "Q22", "text": "À quoi sert le masque des diapositives ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Changer la mise en page globale"}, {"key": "B", "label": "Modifier une seule diapositive"}, {"key": "C", "label": "Insérer un tableau"}, {"key": "D", "label": "Créer une animation"}, {"key": "E", "label": "Ajouter une transition sonore"}], "correctAnswers": ["A"], "points": 1},
                    {"id": "Q23", "text": "Qu'est-ce qu'un thème dans PowerPoint ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Un modèle pré-rempli"}, {"key": "B", "label": "Un ensemble de couleurs, polices et effets"}, {"key": "C", "label": "Une image d'arrière-plan"}, {"key": "D", "label": "Une animation complexe"}, {"key": "E", "label": "Une extension du logiciel"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q24", "text": "Quel type de fichier conserve les animations et transitions ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": ".pptx"}, {"key": "B", "label": ".pdf"}, {"key": "C", "label": ".jpg"}, {"key": "D", "label": ".txt"}, {"key": "E", "label": ".bmp"}], "correctAnswers": ["A"], "points": 1},
                    {"id": "Q25", "text": "Quelle option permet d'appliquer la même transition à toutes les diapositives ?", "multipleAllowed": False, "type": "multiple_choice", "choices": [{"key": "A", "label": "Accueil > Appliquer tout"}, {"key": "B", "label": "Insertion > Séries"}, {"key": "C", "label": "Transitions > Appliquer partout"}, {"key": "D", "label": "Création > Appliquer"}, {"key": "E", "label": "Outils > Globale"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q26", "text": "Comment insérer rapidement un tableau dans une diapositive ?", "multipleAllowed": False, "type": "multiple_choice", "choices": [{"key": "A", "label": "Ctrl + T"}, {"key": "B", "label": "Insertion > Tableau"}, {"key": "C", "label": "Création > Tableau rapide"}, {"key": "D", "label": "Accueil > Graphique"}, {"key": "E", "label": "Accueil > Disposition"}], "correctAnswers": ["B"], "points": 1},
                    {"id": "Q27", "text": "Quel outil permet d'aligner plusieurs objets entre eux ?", "multipleAllowed": False, "type": "multiple_choice", "choices": [{"key": "A", "label": "Position"}, {"key": "B", "label": "Ajuster"}, {"key": "C", "label": "Aligner"}, {"key": "D", "label": "Disposition"}, {"key": "E", "label": "Ancrage"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q28", "text": "À quoi sert le volet Animation ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Voir la liste des animations et leur ordre"}, {"key": "B", "label": "Changer la couleur du texte"}, {"key": "C", "label": "Modifier la transition de la diapositive"}, {"key": "D", "label": "Insérer des images"}, {"key": "E", "label": "Créer des sommaires automatiques"}], "correctAnswers": ["A"], "points": 1},
                    {"id": "Q29", "text": "Quelle option permet de dupliquer rapidement une diapositive ?", "multipleAllowed": False, "type": "multiple_choice", "choices": [{"key": "A", "label": "Ctrl + N"}, {"key": "B", "label": "Ctrl + C / Ctrl + V"}, {"key": "C", "label": "Ctrl + D"}, {"key": "D", "label": "Alt + D"}, {"key": "E", "label": "Shift + P"}], "correctAnswers": ["C"], "points": 1},
                    {"id": "Q30", "text": "Quel bouton permet de réorganiser les diapositives en mode global ?", "type": "multiple_choice", "multipleAllowed": False, "choices": [{"key": "A", "label": "Affichage > Trieuse de diapositives"}, {"key": "B", "label": "Accueil > Disposition"}, {"key": "C", "label": "Création > Disposition globale"}, {"key": "D", "label": "Fichier > Réorganiser"}, {"key": "E", "label": "Outils > Aperçu"}], "correctAnswers": ["A"], "points": 1}
                ]
            }
        ],
        "scoring": {
            "totalPoints": 30,
            "levels": [
                {"min": 0, "max": 12, "label": "Acquis insuffisants"},
                {"min": 13, "max": 22, "label": "Bon niveau intermédiaire"},
                {"min": 23, "max": 30, "label": "Très bon niveau – progression forte"}
            ]
        }
    }
    
    # Remplacer le test existant
    result = await db.test_templates.replace_one(
        {"id": "test-bureautique-mi-parcours-v1"},
        test_data
    )
    
    if result.modified_count > 0:
        print(f"✅ Test T2 mis à jour avec succès!")
    else:
        print(f"⚠️  Aucune modification (peut-être identique)")
    
    print(f"\n📊 Nouveau contenu:")
    print(f"   - {len(test_data['sections'])} sections")
    total_questions = sum(len(s['questions']) for s in test_data['sections'])
    print(f"   - {total_questions} questions (Word: 8, Excel: 13, PowerPoint: 9)")
    print(f"   - {test_data['scoring']['totalPoints']} points au total")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_test())
