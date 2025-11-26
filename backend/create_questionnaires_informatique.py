"""
Script pour créer les 3 questionnaires du parcours Informatique
Q1 - Questionnaire d'entrée
Q2 - Questionnaire mi-parcours
Q3 - Questionnaire fin de formation
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from uuid import uuid4

async def create_informatique_questionnaires():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['test_database']
    
    print("🗑️  SUPPRESSION des anciens questionnaires Informatique...")
    
    # Supprimer tous les questionnaires pour le parcours Informatique
    result = await db.questionnaire_templates.delete_many({'parcours': 'Informatique'})
    print(f"✅ {result.deleted_count} anciens questionnaires supprimés")
    
    # Q1 - Questionnaire d'entrée
    q1 = {
        "id": str(uuid4()),
        "title": "Q1 – Questionnaire d'entrée informatique – Besoins et identification",
        "parcours": "Informatique",
        "type": "Q1",
        "sections": [
            {
                "title": "Identification / Situation professionnelle",
                "fields": [
                    {
                        "id": "type_situation",
                        "label": "Type de situation",
                        "type": "radio",
                        "required": True,
                        "options": ["En fonction", "En recherche d'emploi", "En reconversion"]
                    },
                    {
                        "id": "poste_occupe",
                        "label": "Poste occupé :",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "anciennete",
                        "label": "Ancienneté dans le poste :",
                        "type": "text",
                        "required": False
                    }
                ]
            },
            {
                "title": "Motivation et objectifs",
                "fields": [
                    {
                        "id": "formation_anterieure",
                        "label": "Avez-vous déjà suivi une formation en informatique ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui", "Non"]
                    },
                    {
                        "id": "raison_formation",
                        "label": "Pourquoi souhaitez-vous suivre cette formation ?",
                        "type": "textarea",
                        "required": True
                    },
                    {
                        "id": "cadre_utilisation",
                        "label": "Dans quel cadre utiliserez-vous vos compétences informatiques ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Travail quotidien", "Communication interne", "Gestion administrative", "Usage personnel", "Autre (à préciser)"]
                    },
                    {
                        "id": "objectifs_principaux",
                        "label": "Quels sont vos objectifs principaux ?",
                        "type": "checkbox",
                        "required": True,
                        "options": ["Être plus à l'aise avec Windows", "Gérer fichiers/dossiers", "Utiliser Internet", "Utiliser les outils bureautiques de base", "Assurer son autonomie numérique"]
                    },
                    {
                        "id": "attentes_fin_formation",
                        "label": "Qu'attendez-vous concrètement à la fin de la formation ?",
                        "type": "textarea",
                        "required": True
                    }
                ]
            },
            {
                "title": "Niveau et compétences informatiques (auto-évaluation)",
                "fields": [
                    {
                        "id": "windows",
                        "label": "Utilisation de Windows",
                        "type": "radio",
                        "required": True,
                        "options": ["Faible", "Moyen", "Bon"]
                    },
                    {
                        "id": "fichiers_dossiers",
                        "label": "Gestion des fichiers et dossiers",
                        "type": "radio",
                        "required": True,
                        "options": ["Faible", "Moyen", "Bon"]
                    },
                    {
                        "id": "navigation_internet",
                        "label": "Navigation Internet",
                        "type": "radio",
                        "required": True,
                        "options": ["Faible", "Moyen", "Bon"]
                    },
                    {
                        "id": "clavier_souris",
                        "label": "Utilisation clavier/souris",
                        "type": "radio",
                        "required": True,
                        "options": ["Faible", "Moyen", "Bon"]
                    }
                ]
            },
            {
                "title": "Besoins professionnels et attentes spécifiques",
                "fields": [
                    {
                        "id": "situations_informatique",
                        "label": "Dans votre fonction actuelle, quelles sont les situations où l'informatique est nécessaire ?",
                        "type": "textarea",
                        "required": True
                    },
                    {
                        "id": "difficultes_actuelles",
                        "label": "Quelles difficultés rencontrez-vous actuellement ?",
                        "type": "checkbox",
                        "required": False,
                        "options": ["Organisation des fichiers", "Navigation Internet", "Utilisation de Windows", "Manipulation souris/clavier", "Compréhension des messages Windows", "Autre"]
                    },
                    {
                        "id": "contenu_particulier",
                        "label": "Souhaitez-vous insister sur un type de contenu particulier ?",
                        "type": "textarea",
                        "required": False
                    },
                    {
                        "id": "certification",
                        "label": "Souhaitez-vous passer une certification informatique ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui", "Non"]
                    }
                ]
            },
            {
                "title": "Contraintes et conditions de suivi",
                "fields": [
                    {
                        "id": "rythme_souhaite",
                        "label": "Disponibilités et rythme souhaité :",
                        "type": "radio",
                        "required": False,
                        "options": ["Intensif", "Étendu", "Flexible"]
                    },
                    {
                        "id": "format_prefere",
                        "label": "Format préféré :",
                        "type": "radio",
                        "required": False,
                        "options": ["Présentiel", "Distanciel", "Hybride"]
                    },
                    {
                        "id": "contraintes_particulieres",
                        "label": "Avez-vous des contraintes particulières ? (horaires, déplacements, matériel…)",
                        "type": "textarea",
                        "required": True
                    }
                ]
            },
            {
                "title": "Situation de handicap et besoins d'adaptation",
                "fields": [
                    {
                        "id": "handicap",
                        "label": "Êtes-vous en situation de handicap ou rencontrez-vous une difficulté pouvant impacter votre apprentissage ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui", "Non"]
                    }
                ]
            },
            {
                "title": "Validation",
                "fields": [
                    {
                        "id": "signature",
                        "label": "Signature du stagiaire (horodatée)",
                        "type": "signature",
                        "required": True
                    }
                ]
            }
        ]
    }
    
    # Q2 - Questionnaire mi-parcours
    q2 = {
        "id": str(uuid4()),
        "title": "Q2 – Questionnaire mi-parcours – Informatique",
        "parcours": "Informatique",
        "type": "Q2",
        "sections": [
            {
                "title": "Informations générales",
                "fields": [
                    {
                        "id": "nom_prenom",
                        "label": "Nom et prénom",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "date_suivi",
                        "label": "Date du suivi",
                        "type": "date",
                        "required": False
                    },
                    {
                        "id": "formateur_referent",
                        "label": "Formateur référent",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "mode_formation",
                        "label": "Mode de formation :",
                        "type": "radio",
                        "required": False,
                        "options": ["Présentiel", "Distanciel", "Hybride"]
                    }
                ]
            },
            {
                "title": "Ressenti sur le déroulement de la formation",
                "fields": [
                    {
                        "id": "attentes_repondues",
                        "label": "La formation répond-elle à vos attentes jusqu'à présent ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]
                    },
                    {
                        "id": "rythme_duree",
                        "label": "Le rythme et la durée des séances vous conviennent-ils ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]
                    },
                    {
                        "id": "supports_methodes",
                        "label": "Les supports et méthodes utilisés facilitent-ils votre apprentissage ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui tout à fait", "Assez", "Peu", "Pas du tout"]
                    }
                ]
            },
            {
                "title": "Progression et besoins complémentaires",
                "fields": [
                    {
                        "id": "plus_appris",
                        "label": "Qu'avez-vous le plus appris depuis le début ?",
                        "type": "textarea",
                        "required": True
                    },
                    {
                        "id": "difficultes_actuelles",
                        "label": "Rencontrez-vous actuellement des difficultés particulières ?",
                        "type": "checkbox",
                        "required": False,
                        "options": ["Organisation des fichiers", "Navigation Internet", "Manipulation Windows", "Compréhension des messages", "Utilisation souris/clavier", "Autre"]
                    },
                    {
                        "id": "approfondir",
                        "label": "Souhaitez-vous approfondir certains points d'ici la fin de la formation ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui", "Non"]
                    },
                    {
                        "id": "points_approfondir",
                        "label": "Si oui, lesquels ?",
                        "type": "textarea",
                        "required": False
                    },
                    {
                        "id": "suggestions",
                        "label": "Avez-vous des suggestions pour améliorer la formation ?",
                        "type": "textarea",
                        "required": True
                    }
                ]
            },
            {
                "title": "Suivi et adaptation (à compléter par le formateur)",
                "fields": [
                    {
                        "id": "zone_formateur",
                        "label": "Zone réservée formateur :",
                        "type": "textarea",
                        "required": False
                    }
                ]
            },
            {
                "title": "Validation",
                "fields": [
                    {
                        "id": "signature",
                        "label": "Signature du stagiaire (horodatée)",
                        "type": "signature",
                        "required": True
                    }
                ]
            }
        ]
    }
    
    # Q3 - Questionnaire fin de formation
    q3 = {
        "id": str(uuid4()),
        "title": "Q3 – Questionnaire fin de formation – Informatique",
        "parcours": "Informatique",
        "type": "Q3",
        "sections": [
            {
                "title": "Informations générales",
                "fields": [
                    {
                        "id": "nom_prenom",
                        "label": "Nom et prénom",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "date",
                        "label": "Date",
                        "type": "date",
                        "required": False
                    },
                    {
                        "id": "formateur_referent",
                        "label": "Formateur référent",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "duree_totale",
                        "label": "Durée totale suivie",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "mode_formation",
                        "label": "Mode de formation :",
                        "type": "radio",
                        "required": False,
                        "options": ["Présentiel", "Distanciel", "Hybride"]
                    }
                ]
            },
            {
                "title": "Évaluation de vos acquis",
                "fields": [
                    {
                        "id": "progression",
                        "label": "Pensez-vous avoir progressé depuis le début de la formation ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui, beaucoup", "Oui, un peu", "Peu", "Pas du tout"]
                    },
                    {
                        "id": "domaines_amelioration",
                        "label": "Dans quels domaines avez-vous constaté le plus d'amélioration ?",
                        "type": "checkbox",
                        "required": True,
                        "options": ["Utilisation de Windows", "Gestion fichiers/dossiers", "Navigation Internet", "Utilisation souris/clavier"]
                    },
                    {
                        "id": "aise_ordinateur",
                        "label": "Vous sentez-vous plus à l'aise pour utiliser l'ordinateur ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]
                    },
                    {
                        "id": "points_renforcer",
                        "label": "Quels points souhaitez-vous encore renforcer ?",
                        "type": "textarea",
                        "required": False
                    },
                    {
                        "id": "objectifs_atteints",
                        "label": "Avez-vous atteint les objectifs fixés ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui totalement", "Partiellement", "Non encore", "Non du tout"]
                    }
                ]
            },
            {
                "title": "Appréciation de la formation",
                "fields": [
                    {
                        "id": "contenu_adapte",
                        "label": "Le contenu et les supports ont-ils été adaptés à vos besoins ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]
                    },
                    {
                        "id": "rythme_duree",
                        "label": "Le rythme et la durée de la formation vous ont-ils convenu ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]
                    },
                    {
                        "id": "formateur_attentes",
                        "label": "Le formateur a-t-il répondu à vos attentes ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]
                    },
                    {
                        "id": "evaluation_globale",
                        "label": "Comment évalueriez-vous globalement la formation ?",
                        "type": "radio",
                        "required": True,
                        "options": ["⭐ Excellent", "⭐ Bon", "⭐ Moyen", "⭐ Insatisfaisant"]
                    },
                    {
                        "id": "recommandation",
                        "label": "Recommanderiez-vous cette formation ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui", "Non", "Peut-être"]
                    }
                ]
            },
            {
                "title": "Perspectives et suite du parcours",
                "fields": [
                    {
                        "id": "utilisation_competences",
                        "label": "Comment comptez-vous utiliser vos compétences informatiques ?",
                        "type": "textarea",
                        "required": True
                    },
                    {
                        "id": "formation_complementaire",
                        "label": "Souhaitez-vous poursuivre avec une formation complémentaire ?",
                        "type": "radio",
                        "required": True,
                        "options": ["Oui", "Non"]
                    }
                ]
            },
            {
                "title": "Validation",
                "fields": [
                    {
                        "id": "signature",
                        "label": "Signature du stagiaire (horodatée)",
                        "type": "signature",
                        "required": True
                    }
                ]
            }
        ]
    }
    
    # Insérer les 3 questionnaires
    print("\n🚀 CRÉATION des nouveaux questionnaires Informatique...")
    
    await db.questionnaire_templates.insert_one(q1)
    print(f"✅ Q1 créé : {q1['title']}")
    
    await db.questionnaire_templates.insert_one(q2)
    print(f"✅ Q2 créé : {q2['title']}")
    
    await db.questionnaire_templates.insert_one(q3)
    print(f"✅ Q3 créé : {q3['title']}")
    
    print("\n✨ Création terminée avec succès !")
    
    # Vérification
    all_q = await db.questionnaire_templates.find({'parcours': 'Informatique'}, {'_id': 0, 'title': 1}).to_list(10)
    print(f"\n🔍 Questionnaires Informatique dans la base :")
    for q in all_q:
        print(f"  ✓ {q['title']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_informatique_questionnaires())
