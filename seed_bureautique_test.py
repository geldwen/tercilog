#!/usr/bin/env python3
"""Script pour créer le test de positionnement Bureautique dans MongoDB"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

test_data = {
    "id": "test-bureautique-positionnement-v1",
    "template_name": "Test bureautique débutant",
    "parcours": "Bureautique",
    "category": "TEST_PARCOURS",
    "sub_type": "POSITIONNEMENT",
    "title": "Test d'entrée en bureautique – Diagnostic de vos acquis",
    "description": "Ce test permet d'évaluer vos acquis en bureautique (Word, Excel, PowerPoint). Il ne s'agit pas d'un examen, mais d'un diagnostic pour adapter la formation à votre niveau. Répondez honnêtement, sans stress.",
    "sections": [
        {
            "id": "word",
            "title": "Section 1 – Word",
            "description": "Questions sur les bases de Word (mise en forme, styles, mise en page…).",
            "questions": [
                {
                    "id": "Q1",
                    "text": "Dans Word, quels outils sont les plus adaptés pour appliquer rapidement la même mise en forme à plusieurs titres d'un document ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "Modifier manuellement la police, la taille et la couleur de chaque titre"},
                        {"key": "B", "label": "Utiliser les styles de titre (Titre 1, Titre 2, Titre 3…)"},
                        {"key": "C", "label": "Utiliser le Pinceau de mise en forme"},
                        {"key": "D", "label": "Modifier la police par le menu Fichier > Options"},
                        {"key": "E", "label": "Insérer un tableau autour du texte"}
                    ],
                    "correctAnswers": ["B", "C"],
                    "points": 1
                },
                {
                    "id": "Q2",
                    "text": "Que faut-il utiliser pour commencer un nouveau chapitre en haut d'une nouvelle page, sans appuyer plusieurs fois sur Entrée ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Changer la taille des marges"},
                        {"key": "B", "label": "Insérer un saut de page"},
                        {"key": "C", "label": "Insérer un saut de section continu"},
                        {"key": "D", "label": "Ajouter un retour à la ligne"},
                        {"key": "E", "label": "Modifier l'orientation en paysage"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q3",
                    "text": "Pour que Word génère automatiquement une table des matières, il faut :",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Mettre les titres en gras"},
                        {"key": "B", "label": "Appliquer des styles de titre (Titre 1, Titre 2, etc.)"},
                        {"key": "C", "label": "Numéroter manuellement les pages"},
                        {"key": "D", "label": "Insérer des signets dans le texte"},
                        {"key": "E", "label": "Centrer tous les titres"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q4",
                    "text": "Quels outils de Word peuvent vous aider à corriger l'orthographe et/ou la grammaire ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "Le correcteur automatique (soulignement rouge / bleu)"},
                        {"key": "B", "label": "La fonction « Grammaire et orthographe »"},
                        {"key": "C", "label": "Le surlignage manuel"},
                        {"key": "D", "label": "La fonction « Recherche »"},
                        {"key": "E", "label": "Le dictionnaire des synonymes"}
                    ],
                    "correctAnswers": ["A", "B"],
                    "points": 1
                },
                {
                    "id": "Q5",
                    "text": "Dans quel onglet trouve-t-on principalement les options de marges, orientation de la page (portrait/paysage) et taille du papier ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Accueil"},
                        {"key": "B", "label": "Insertion"},
                        {"key": "C", "label": "Mise en page (ou Disposition)"},
                        {"key": "D", "label": "Révision"},
                        {"key": "E", "label": "Affichage"}
                    ],
                    "correctAnswers": ["C"],
                    "points": 1
                },
                {
                    "id": "Q6",
                    "text": "Vous voulez présenter une liste numérotée. Quel outil utilisez-vous ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Interligne"},
                        {"key": "B", "label": "Bordures de page"},
                        {"key": "C", "label": "Alignement du texte"},
                        {"key": "D", "label": "Listes à puces et numérotation"},
                        {"key": "E", "label": "Styles rapides"}
                    ],
                    "correctAnswers": ["D"],
                    "points": 1
                },
                {
                    "id": "Q7",
                    "text": "Après avoir inséré une image dans Word, quels réglages vous permettent de contrôler sa position par rapport au texte ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "Habillage du texte (Aligner, Rapproché, Derrière le texte…)"},
                        {"key": "B", "label": "Alignement (gauche, centré, droite)"},
                        {"key": "C", "label": "Orientation de la page"},
                        {"key": "D", "label": "Thème du document"},
                        {"key": "E", "label": "Correction automatique"}
                    ],
                    "correctAnswers": ["A", "B"],
                    "points": 1
                },
                {
                    "id": "Q8",
                    "text": "Que peut-on insérer dans un en-tête ou un pied de page ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "Numéro de page"},
                        {"key": "B", "label": "Date et heure"},
                        {"key": "C", "label": "Nom du fichier"},
                        {"key": "D", "label": "Graphique Excel"},
                        {"key": "E", "label": "Adresse e-mail automatiquement mise à jour"}
                    ],
                    "correctAnswers": ["A", "B", "C"],
                    "points": 1
                },
                {
                    "id": "Q9",
                    "text": "Pourquoi utilise-t-on un modèle (template) dans Word ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Pour empêcher toute modification du document"},
                        {"key": "B", "label": "Pour avoir une mise en page prête à l'emploi et cohérente"},
                        {"key": "C", "label": "Pour compresser automatiquement les images"},
                        {"key": "D", "label": "Pour créer un document non imprimable"},
                        {"key": "E", "label": "Pour effacer tous les styles du document"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                }
            ]
        },
        {
            "id": "excel",
            "title": "Section 2 – Excel",
            "description": "Questions sur les bases d'Excel (formules, tri, filtres, mise en forme, graphiques…).",
            "questions": [
                {
                    "id": "Q10",
                    "text": "Quelles actions peut-on réaliser dans Excel ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "Saisir des chiffres et des textes"},
                        {"key": "B", "label": "Faire des calculs automatiques"},
                        {"key": "C", "label": "Créer des graphiques"},
                        {"key": "D", "label": "Gérer plusieurs feuilles dans un même fichier"},
                        {"key": "E", "label": "Créer des diaporamas de présentation"}
                    ],
                    "correctAnswers": ["A", "B", "C", "D"],
                    "points": 1
                },
                {
                    "id": "Q11",
                    "text": "Quelle formule additionne simplement les cellules A1 et A2 ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "=A1+A2"},
                        {"key": "B", "label": "=SOMME(A1+A2)"},
                        {"key": "C", "label": "SOMME(A1:A2)"},
                        {"key": "D", "label": "=A1:A2"},
                        {"key": "E", "label": "=PLUS(A1;A2)"}
                    ],
                    "correctAnswers": ["A"],
                    "points": 1
                },
                {
                    "id": "Q12",
                    "text": "Vous voulez calculer la somme de A1 à A10. Quelle formule est correcte ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "=SOMME(A1;A10)"},
                        {"key": "B", "label": "=SOMME(A1:A10)"},
                        {"key": "C", "label": "=A1+A10"},
                        {"key": "D", "label": "=SOMME(A1-A10)"},
                        {"key": "E", "label": "=SOMME(A1;A2;A3)"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q13",
                    "text": "Si vous tapez « Lundi » dans une cellule, puis tirez la poignée de recopie vers le bas, que se passe-t-il ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "« Lundi » se répète partout"},
                        {"key": "B", "label": "Les nombres se remplissent de 1 à 10"},
                        {"key": "C", "label": "Excel continue avec « Mardi, Mercredi, … »"},
                        {"key": "D", "label": "Excel propose une formule automatique"},
                        {"key": "E", "label": "La cellule se vide"}
                    ],
                    "correctAnswers": ["C"],
                    "points": 1
                },
                {
                    "id": "Q14",
                    "text": "Dans la formule = $A$1*B1, que signifient les signes « $ » autour de A1 ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "La cellule A1 est une référence absolue (fixée)"},
                        {"key": "B", "label": "La cellule B1 est toujours égale à A1"},
                        {"key": "C", "label": "La référence à A1 ne change pas si on recopie la formule"},
                        {"key": "D", "label": "La formule est incorrecte"},
                        {"key": "E", "label": "La cellule A1 est protégée par mot de passe"}
                    ],
                    "correctAnswers": ["A", "C"],
                    "points": 1
                },
                {
                    "id": "Q15",
                    "text": "Comment trier une colonne du plus petit au plus grand ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Accueil > Copier"},
                        {"key": "B", "label": "Données > Trier du plus petit au plus grand"},
                        {"key": "C", "label": "Mise en page > Orientation"},
                        {"key": "D", "label": "Formules > Gérer les noms"},
                        {"key": "E", "label": "Insertion > Graphique"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q16",
                    "text": "À quoi sert un filtre automatique sur une liste de données ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "À supprimer définitivement les lignes"},
                        {"key": "B", "label": "À cacher temporairement certaines lignes selon des critères"},
                        {"key": "C", "label": "À imprimer seulement la première page"},
                        {"key": "D", "label": "À changer la couleur des cellules"},
                        {"key": "E", "label": "À créer une nouvelle feuille automatiquement"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q17",
                    "text": "La mise en forme conditionnelle permet de :",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Faire la somme de plusieurs colonnes"},
                        {"key": "B", "label": "Mettre certaines cellules en couleur selon un critère (ex : >100)"},
                        {"key": "C", "label": "Protéger la feuille"},
                        {"key": "D", "label": "Changer l'orientation de la page"},
                        {"key": "E", "label": "Insérer un graphique"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q18",
                    "text": "Vous voulez afficher « OK » si la cellule C2 est supérieure à 10, sinon « NON ». Quelle formule est correcte ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "=SI(C2>10;\"OK\";\"NON\")"},
                        {"key": "B", "label": "=SI(C2>10:\"OK\":\"NON\")"},
                        {"key": "C", "label": "=SI(\"C2>10\";\"OK\";\"NON\")"},
                        {"key": "D", "label": "=SI(C2<10;\"OK\";\"NON\")"},
                        {"key": "E", "label": "=SI(C2>10;\"NON\";\"OK\")"}
                    ],
                    "correctAnswers": ["A"],
                    "points": 1
                },
                {
                    "id": "Q19",
                    "text": "Comment faire référence à la cellule A1 de la feuille « Janvier » ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "=A1!Janvier"},
                        {"key": "B", "label": "=JANVIER(A1)"},
                        {"key": "C", "label": "=FeuilleJanvier.A1"},
                        {"key": "D", "label": "=Janvier!A1"},
                        {"key": "E", "label": "=A1:Janvier"}
                    ],
                    "correctAnswers": ["D"],
                    "points": 1
                },
                {
                    "id": "Q20",
                    "text": "Figer les volets sert principalement à :",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Empêcher la modification d'une cellule"},
                        {"key": "B", "label": "Garder visibles les titres de colonnes ou lignes quand on fait défiler"},
                        {"key": "C", "label": "Bloquer la souris"},
                        {"key": "D", "label": "Protéger la feuille"},
                        {"key": "E", "label": "Empêcher l'impression"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q21",
                    "text": "Pour afficher des valeurs en euros avec deux décimales, quel format utiliser ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Format texte"},
                        {"key": "B", "label": "Format standard"},
                        {"key": "C", "label": "Format monétaire"},
                        {"key": "D", "label": "Format pourcentage"},
                        {"key": "E", "label": "Format date"}
                    ],
                    "correctAnswers": ["C"],
                    "points": 1
                },
                {
                    "id": "Q22",
                    "text": "Que signifie en général l'erreur « #DIV/0! » dans une cellule Excel ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Formule trop longue"},
                        {"key": "B", "label": "Division par 0 ou par une cellule vide"},
                        {"key": "C", "label": "Fichier corrompu"},
                        {"key": "D", "label": "Problème de police de caractères"},
                        {"key": "E", "label": "Formule sans signe ="}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q23",
                    "text": "Quel type de graphique est le plus adapté pour visualiser l'évolution d'un chiffre mois par mois (janvier, février, mars…) ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Camembert (secteur)"},
                        {"key": "B", "label": "Histogramme / colonnes"},
                        {"key": "C", "label": "Graphique en courbes"},
                        {"key": "D", "label": "Nuage de points"},
                        {"key": "E", "label": "Graphique en anneaux"}
                    ],
                    "correctAnswers": ["C"],
                    "points": 1
                }
            ]
        },
        {
            "id": "powerpoint",
            "title": "Section 3 – PowerPoint",
            "description": "Questions sur les bases de PowerPoint et les bonnes pratiques de présentation.",
            "questions": [
                {
                    "id": "Q24",
                    "text": "À quoi sert principalement PowerPoint ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Faire des calculs comptables"},
                        {"key": "B", "label": "Créer des présentations avec des diapositives"},
                        {"key": "C", "label": "Envoyer des mails"},
                        {"key": "D", "label": "Gérer une base de données"},
                        {"key": "E", "label": "Retoucher des photos"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q25",
                    "text": "Le masque des diapositives permet de :",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Modifier seulement la première diapositive"},
                        {"key": "B", "label": "Modifier la mise en page commune à plusieurs diapositives"},
                        {"key": "C", "label": "Corriger l'orthographe"},
                        {"key": "D", "label": "Changer la langue de PowerPoint"},
                        {"key": "E", "label": "Créer automatiquement un graphique"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q26",
                    "text": "Quelle phrase décrit correctement la différence entre une transition et une animation ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Une transition concerne le passage d'une diapositive à l'autre"},
                        {"key": "B", "label": "Une animation concerne le passage d'une présentation à l'autre"},
                        {"key": "C", "label": "Les transitions ne fonctionnent qu'en mode édition"},
                        {"key": "D", "label": "Les animations ne concernent que le texte"},
                        {"key": "E", "label": "Transitions et animations sont exactement la même chose"}
                    ],
                    "correctAnswers": ["A"],
                    "points": 1
                },
                {
                    "id": "Q27",
                    "text": "Quelles sont de bonnes pratiques pour une présentation PowerPoint claire ?",
                    "type": "multiple_choice",
                    "multipleAllowed": True,
                    "choices": [
                        {"key": "A", "label": "Utiliser une mise en page cohérente sur tout le diaporama"},
                        {"key": "B", "label": "Limiter le texte et utiliser des mots-clés"},
                        {"key": "C", "label": "Varier les polices, couleurs et effets à chaque diapositive"},
                        {"key": "D", "label": "Utiliser des titres explicites pour chaque diapositive"},
                        {"key": "E", "label": "Mettre exactement le même texte que votre discours oral"}
                    ],
                    "correctAnswers": ["A", "B", "D"],
                    "points": 1
                },
                {
                    "id": "Q28",
                    "text": "Quel raccourci clavier permet de lancer le diaporama depuis la première diapositive ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "F2"},
                        {"key": "B", "label": "F5"},
                        {"key": "C", "label": "Ctrl + D"},
                        {"key": "D", "label": "Alt + Tab"},
                        {"key": "E", "label": "Ctrl + P"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                }
            ]
        },
        {
            "id": "general",
            "title": "Section 4 – Bureautique générale",
            "description": "Questions générales sur l'organisation des fichiers et la sauvegarde.",
            "questions": [
                {
                    "id": "Q29",
                    "text": "Quelle est une bonne pratique pour organiser vos fichiers bureautiques ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Tout enregistrer sur le Bureau"},
                        {"key": "B", "label": "Créer des dossiers par thème ou par projet"},
                        {"key": "C", "label": "Ne jamais renommer les fichiers"},
                        {"key": "D", "label": "Enregistrer tous les fichiers sur une seule clé USB"},
                        {"key": "E", "label": "Supprimer régulièrement les fichiers sans tri"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                },
                {
                    "id": "Q30",
                    "text": "Quelle affirmation est la plus correcte concernant les sauvegardes de vos documents ?",
                    "type": "multiple_choice",
                    "multipleAllowed": False,
                    "choices": [
                        {"key": "A", "label": "Une seule copie sur l'ordinateur suffit"},
                        {"key": "B", "label": "Il est préférable d'avoir une copie locale et une copie dans le cloud"},
                        {"key": "C", "label": "Sauvegarder une fois par an est suffisant"},
                        {"key": "D", "label": "Les fichiers ne peuvent jamais être perdus"},
                        {"key": "E", "label": "Les sauvegardes ne servent qu'aux informaticiens"}
                    ],
                    "correctAnswers": ["B"],
                    "points": 1
                }
            ]
        }
    ],
    "scoring": {
        "totalPoints": 30,
        "levels": [
            {
                "min": 0,
                "max": 12,
                "label": "Niveau débutant",
                "description": "Les bases sont à consolider. La formation vous aidera à prendre confiance sur Word, Excel et PowerPoint."
            },
            {
                "min": 13,
                "max": 21,
                "label": "Niveau intermédiaire",
                "description": "Vous avez déjà des acquis. La formation pourra approfondir les fonctionnalités et sécuriser vos pratiques."
            },
            {
                "min": 22,
                "max": 30,
                "label": "Niveau confirmé",
                "description": "Vous êtes déjà à l'aise en bureautique. La formation pourra se concentrer sur des cas pratiques avancés."
            }
        ]
    }
}

async def seed_test():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Vérifier si le test existe déjà
    existing = await db.test_templates.find_one({"id": test_data["id"]})
    
    if existing:
        print(f"⚠️  Le test existe déjà, mise à jour...")
        await db.test_templates.update_one(
            {"id": test_data["id"]},
            {"$set": test_data}
        )
        print(f"✅ Test mis à jour: {test_data['template_name']}")
    else:
        await db.test_templates.insert_one(test_data)
        print(f"✅ Test créé: {test_data['template_name']}")
    
    print(f"\n📋 Détails:")
    print(f"   - {len(test_data['sections'])} sections")
    total_questions = sum(len(s['questions']) for s in test_data['sections'])
    print(f"   - {total_questions} questions")
    print(f"   - {test_data['scoring']['totalPoints']} points au total")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_test())
