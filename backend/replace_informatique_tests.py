"""
Script pour REMPLACER complètement les tests du parcours Informatique
Supprime les anciens et crée les nouveaux définitifs
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent if '__file__' in globals() else Path('.')
load_dotenv(ROOT_DIR / '.env')

async def replace_informatique_tests():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['test_database']
    
    print("🗑️  SUPPRESSION des anciens tests Informatique...")
    
    # Supprimer TOUS les tests liés au parcours Informatique
    result = await db.test_templates.delete_many({
        '$or': [
            {'parcours': 'Informatique'},
            {'id': {'$regex': 'informatique'}},
            {'template_name': {'$regex': 'informatique', '$options': 'i'}}
        ]
    })
    
    print(f"✅ {result.deleted_count} anciens tests supprimés")
    
    # T1 - Test de positionnement
    t1_questions = [
        {"id": "Q1", "text": "Pour déplacer la souris :", "choices": ["Faire glisser la souris sur le tapis", "Appuyer sur le clavier", "Tourner l'écran", "Secouer l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q2", "text": "Pour cliquer sur un élément :", "choices": ["Appuyer sur le bouton gauche de la souris", "Appuyer sur Échap", "Secouer la souris", "Appuyer sur la touche Espace"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q3", "text": "Pour ouvrir un dossier sur le bureau :", "choices": ["Double clic gauche", "Clic droit", "Appuyer sur Imprimer", "Éteindre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q4", "text": "Une icône sur le bureau représente :", "choices": ["Un accès à un fichier ou programme", "Une décoration", "Une publicité", "Le Wi-Fi"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q5", "text": "Pour déplacer une fenêtre :", "choices": ["Cliquer sur la barre du haut et glisser", "Appuyer sur Verr Maj", "Cliquer sur la croix", "Tourner la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q6", "text": "Le bouton \"croix\" en haut d'une fenêtre sert à :", "choices": ["Fermer la fenêtre", "Réduire", "Agrandir", "Éteindre l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q7", "text": "Pour réduire une fenêtre :", "choices": ["Cliquer sur \"_\"", "Cliquer sur la croix", "Éteindre l'ordinateur", "Appuyer sur Entrée"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q8", "text": "Pour afficher le bureau rapidement :", "choices": ["Windows + D", "Cliquer sur corbeille", "Appuyer sur Verr Num", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q9", "text": "La barre des tâches sert à :", "choices": ["Voir les programmes ouverts et lancés", "Ranger des fichiers", "Installer Windows", "Régler le chauffage"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q10", "text": "Pour ouvrir l'Explorateur de fichiers :", "choices": ["Cliquer sur l'icône dossier", "Cliquer sur Wi-Fi", "Appuyer sur Échap", "Cliquer sur l'heure"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q11", "text": "Un fichier est :", "choices": ["Un document enregistré dans l'ordinateur", "Une souris", "Un programme externe", "Un bouton du clavier"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q12", "text": "Un dossier sert à :", "choices": ["Ranger des fichiers", "Éteindre Windows", "Augmenter le son", "Installer des jeux"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q13", "text": "Pour créer un dossier :", "choices": ["Clic droit → Nouveau → Dossier", "Appuyer sur Échap", "Cliquer sur Imprimer", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q14", "text": "Pour renommer un fichier :", "choices": ["Clic droit → Renommer", "Clic droit → Supprimer", "Double clic", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q15", "text": "La corbeille sert à :", "choices": ["Stocker temporairement les fichiers supprimés", "Installer Windows", "Ranger des câbles", "Mettre des photos"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q16", "text": "Pour restaurer un fichier supprimé :", "choices": ["Corbeille → Restaurer", "Imprimer", "Éteindre", "Appuyer sur Tab"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q17", "text": "Pour supprimer un fichier :", "choices": ["Clic droit → Supprimer", "Clic droit → Renommer", "Cliquer sur le son", "Appuyer sur Ctrl"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q18", "text": "Pour sélectionner un fichier :", "choices": ["Cliquer dessus une fois", "Double clic", "Clic droit", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q19", "text": "Pour sélectionner plusieurs fichiers :", "choices": ["Maintenir Ctrl et cliquer", "Double clic", "Appuyer sur Verr Maj", "Cliquer sur la croix"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q20", "text": "Pour déplacer un fichier :", "choices": ["Glisser-déposer dans un autre dossier", "Imprimer", "Éteindre", "Cliquer droit seulement"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q21", "text": "Si le son est trop fort :", "choices": ["Cliquer sur l'icône haut-parleur et baisser", "Éteindre l'écran", "Cliquer sur corbeille", "Appuyer sur Tab"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q22", "text": "Si l'écran est trop sombre :", "choices": ["Régler la luminosité", "Éteindre l'ordinateur", "Supprimer Windows", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q23", "text": "Pour vider la corbeille :", "choices": ["Clic droit → Vider la corbeille", "Supprimer Windows", "Appuyer sur Échap", "Débrancher l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q24", "text": "Une notification Windows est :", "choices": ["Un message d'information du système", "Une publicité papier", "Une carte postale", "Une photo"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q25", "text": "Si l'ordinateur ne répond plus :", "choices": ["Attendre ou fermer les programmes", "Cliquer partout", "Débrancher immédiatement", "Secouer la souris fort"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q26", "text": "Si la souris ne fonctionne pas :", "choices": ["Vérifier branchement ou pile", "Supprimer Windows", "Imprimer", "Changer l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q27", "text": "Le bouton Windows ouvre :", "choices": ["Le menu Démarrer", "La corbeille", "Le Wi-Fi", "L'imprimante"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q28", "text": "Pour éteindre correctement l'ordinateur :", "choices": ["Menu Démarrer → Arrêter", "Débrancher", "Appuyer sur Échap", "Appuyer sur Verr Num"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q29", "text": "Pour verrouiller l'ordinateur :", "choices": ["Windows + L", "Imprimer", "Supprimer dossier", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q30", "text": "En cas de doute :", "choices": ["Lire ou demander avant de cliquer", "Cliquer vite", "Débrancher", "Supprimer des fichiers au hasard"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1}
    ]
    
    # T2 - Test mi-parcours
    t2_questions = [
        {"id": "Q1", "text": "Pour ouvrir le menu Démarrer :", "choices": ["Cliquer sur le bouton Windows", "Cliquer sur la corbeille", "Cliquer sur l'heure", "Appuyer sur Échap"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q2", "text": "Pour lancer un programme installé :", "choices": ["Cliquer sur son icône dans le menu Démarrer ou la barre des tâches", "Appuyer sur Verr Num", "Cliquer sur la corbeille", "Éteindre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q3", "text": "Pour agrandir une fenêtre :", "choices": ["Cliquer sur le carré en haut à droite", "Cliquer sur la croix", "Appuyer sur Imprimer", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q4", "text": "Pour organiser les fichiers dans un dossier :", "choices": ["Utiliser l'Explorateur de fichiers", "Changer le fond d'écran", "Ouvrir le Wi-Fi", "Cliquer sur l'heure"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q5", "text": "Pour copier un fichier :", "choices": ["Clic droit → Copier", "Clic droit → Supprimer", "Réduire la fenêtre", "Éteindre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q6", "text": "Pour coller un fichier :", "choices": ["Clic droit → Coller", "Double clic", "Appuyer sur Verr Maj", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q7", "text": "Pour rechercher un programme dans Windows :", "choices": ["Utiliser la barre de recherche du menu Démarrer", "Cliquer sur la corbeille", "Appuyer sur Échap", "Mettre le son"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q8", "text": "Si une fenêtre cache une autre fenêtre :", "choices": ["Cliquer sur son icône dans la barre des tâches", "Éteindre l'écran", "Appuyer sur Tab", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q9", "text": "Pour afficher deux fenêtres côte à côte :", "choices": ["Glisser une fenêtre sur un bord de l'écran", "Cliquer sur corbeille", "Imprimer", "Appuyer sur Verr Maj"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q10", "text": "Pour régler le volume :", "choices": ["Cliquer sur l'icône haut-parleur", "Cliquer sur Wi-Fi", "Cliquer sur l'heure", "Clic droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q11", "text": "Pour régler la luminosité :", "choices": ["Paramètres → Système → Affichage", "Cliquer sur la corbeille", "Réduire une fenêtre", "Appuyer sur Verr Num"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q12", "text": "Une mise à jour Windows sert à :", "choices": ["Améliorer la sécurité et corriger des problèmes", "Ajouter de la publicité", "Supprimer vos fichiers", "Installer des jeux"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q13", "text": "Pour ouvrir Internet :", "choices": ["Ouvrir un navigateur (Edge, Chrome, Firefox…)", "Ouvrir la corbeille", "Cliquer sur Échap", "Cliquer sur l'heure"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q14", "text": "Dans un navigateur, la barre d'adresse sert à :", "choices": ["Saisir l'adresse d'un site", "Augmenter le son", "Installer Windows", "Ranger des fichiers"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q15", "text": "Pour rechercher une information simple sur Internet :", "choices": ["Taper des mots dans un moteur de recherche", "Cliquer partout", "Imprimer la page", "Fermer l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q16", "text": "Pour cliquer sur un lien Internet :", "choices": ["Cliquer une fois dessus", "Double cliquer", "Cliquer droit", "Appuyer sur Verr Maj"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q17", "text": "Pour revenir en arrière dans un navigateur :", "choices": ["Cliquer sur la flèche ←", "Cliquer sur la croix", "Cliquer sur Wi-Fi", "Appuyer sur Suppr"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q18", "text": "Pour fermer un onglet Internet :", "choices": ["Cliquer sur le \"X\" de l'onglet", "Éteindre l'ordinateur", "Cliquer droit", "Changer le fond d'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q19", "text": "Pour scroller (descendre une page) :", "choices": ["Faire rouler la molette de la souris", "Appuyer sur Verr Maj", "Imprimer", "Secouer l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q20", "text": "Si une page Internet ne charge pas :", "choices": ["Actualiser la page", "Débrancher l'ordinateur", "Supprimer Windows", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q21", "text": "Pour fermer un programme Windows :", "choices": ["Cliquer sur la croix", "Cliquer sur Wi-Fi", "Appuyer sur Verr Num", "Clic droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q22", "text": "Pour savoir si vous êtes connecté à Internet :", "choices": ["Regarder l'icône réseau", "Cliquer sur Imprimer", "Changer le fond d'écran", "Appuyer sur Tab"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q23", "text": "Une publicité sur Internet disant \"vous avez gagné\" :", "choices": ["Ne pas cliquer", "Cliquer", "Envoyer ses informations", "Imprimer la page"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q24", "text": "Pour agrandir une page Internet :", "choices": ["Ctrl + molette", "Cliquer droit", "Appuyer sur Échap", "Mettre en veille"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q25", "text": "Une icône en forme de cadenas dans un navigateur indique :", "choices": ["Une connexion sécurisée", "Une imprimante", "Un virus", "Le son"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q26", "text": "Pour rechercher un fichier dans Windows :", "choices": ["Utiliser la barre de recherche de l'Explorateur", "Imprimer", "Réduire la fenêtre", "Mettre le son"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q27", "text": "Pour vider la corbeille :", "choices": ["Clic droit → Vider la corbeille", "Supprimer Windows", "Appuyer sur Échap", "Débrancher l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q28", "text": "Pour déplacer un fichier :", "choices": ["Glisser-déposer", "Imprimer", "Cliquer droit sans bouger", "Éteindre"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q29", "text": "Pour savoir combien d'espace disque reste :", "choices": ["Explorateur → Ce PC → Disque", "Cliquer sur l'heure", "Cliquer sur le son", "Réduire"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q30", "text": "En cas de doute sur Internet :", "choices": ["Lire ou demander avant de cliquer", "Cliquer vite", "Tout fermer brutalement", "Supprimer des fichiers"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1}
    ]
    
    # T3 - Test fin de parcours
    t3_questions = [
        {"id": "Q1", "text": "Pour organiser vos documents dans Windows :", "choices": ["Créer des dossiers et sous-dossiers", "Tout laisser sur le bureau", "Imprimer", "Supprimer au hasard"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q2", "text": "Pour déplacer un dossier complet :", "choices": ["Glisser-déposer", "Cliquer droit sans rien faire", "Éteindre", "Appuyer sur Verr Maj"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q3", "text": "Pour renommer un dossier :", "choices": ["Clic droit → Renommer", "Imprimer", "Supprimer", "Appuyer sur Tab"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q4", "text": "Pour savoir la taille d'un fichier :", "choices": ["Clic droit → Propriétés", "Cliquer sur le son", "Appuyer sur Verr Num", "Réduire la fenêtre"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q5", "text": "Pour ouvrir un site Internet connu :", "choices": ["Taper son adresse ou utiliser un favori", "Cliquer sur une publicité", "Cliquer au hasard", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q6", "text": "Si un site affiche trop de texte :", "choices": ["Faire descendre la page avec la molette", "Éteindre", "Supprimer", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q7", "text": "Pour revenir à la page précédente :", "choices": ["Flèche ← du navigateur", "Imprimer", "Réduire", "Mettre en veille"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q8", "text": "Pour fermer complètement Internet :", "choices": ["Fermer la fenêtre du navigateur", "Cliquer droit", "Appuyer sur Verr Num", "Cliquer sur le son"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q9", "text": "Pour accéder aux paramètres système :", "choices": ["Démarrer → Paramètres", "Corbeille", "Imprimer", "Éteindre brutalement"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q10", "text": "Une mise à jour Windows importante :", "choices": ["Permet d'améliorer la sécurité", "Est dangereuse", "Supprime vos fichiers", "Installe des jeux"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q11", "text": "Pour vérifier l'espace disque :", "choices": ["Ce PC → Disque", "Corbeille", "Son", "Horloge"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q12", "text": "Pour récupérer un fichier supprimé récemment :", "choices": ["Corbeille → Restaurer", "Appuyer sur Tab", "Imprimer", "Supprimer Windows"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q13", "text": "Pour réduire un programme :", "choices": ["Cliquer sur \"_\"", "Cliquer sur croix", "Appuyer sur Échap", "Secouer l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q14", "text": "Pour ouvrir plusieurs sites :", "choices": ["Utiliser plusieurs onglets", "Tout fermer", "Débrancher Internet", "Cliquer sur le son"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q15", "text": "Pour fermer un onglet :", "choices": ["Cliquer sur le X de l'onglet", "Appuyer sur Verr Num", "Imprimer", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q16", "text": "Pour épingler un programme dans la barre des tâches :", "choices": ["Clic droit → Épingler", "Supprimer", "Éteindre", "Réduire"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q17", "text": "Pour gérer le Wi-Fi dans Windows :", "choices": ["Icône réseau → choisir un réseau", "Cliquer sur horloge", "Cliquer sur corbeille", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q18", "text": "Si l'ordinateur est lent :", "choices": ["Fermer programmes inutiles", "Cliquer partout", "Débrancher", "Supprimer fichiers système"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q19", "text": "Une notification disant \"votre PC a besoin d'une mise à jour\" :", "choices": ["Lire avant d'accepter", "Ignorer toujours", "Cliquer partout", "Éteindre"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q20", "text": "Pour agrandir l'affichage :", "choices": ["Paramètres → Affichage ou Ctrl + +", "Supprimer", "Débrancher", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q21", "text": "Pour retrouver un fichier rapidement :", "choices": ["Recherche Windows", "Imprimer", "Faire défiler tout", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q22", "text": "Pour déplacer plusieurs fichiers :", "choices": ["Ctrl + clic puis glisser", "Double clic", "Éteindre", "Mettre en veille"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q23", "text": "Pour vider la corbeille :", "choices": ["Clic droit → Vider", "Supprimer Windows", "Appuyer sur Tab", "Effacer bureau"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q24", "text": "Pour ouvrir un favori Internet :", "choices": ["Cliquer sur le favori enregistré", "Taper au hasard", "Cliquer sur publicité", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q25", "text": "Pour vérifier l'heure :", "choices": ["Cliquer sur l'horloge", "Cliquer sur Wi-Fi", "Cliquer sur corbeille", "Appuyer sur Verr Num"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q26", "text": "Pour mettre l'ordinateur en veille :", "choices": ["Menu Démarrer → Veille", "Débrancher", "Supprimer fichiers", "Cliquer droit"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q27", "text": "Pour sécuriser un minimum la navigation :", "choices": ["Cliquer seulement sur des sites connus", "Cliquer partout", "Télécharger tout", "Donner ses infos"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q28", "text": "Pour fermer une fenêtre :", "choices": ["Cliquer sur la croix", "Réduire", "Cliquer droit", "Appuyer sur Tab"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q29", "text": "Un site qui demande des informations personnelles sans raison :", "choices": ["Quitter la page", "Donner tout", "Imprimer", "Rester"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q30", "text": "En cas de doute avec Windows ou Internet :", "choices": ["Lire, demander, vérifier avant d'agir", "Cliquer rapidement", "Tout supprimer", "Débrancher brutalement"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1}
    ]
    
    # Créer les 3 nouveaux templates
    new_templates = [
        {
            "id": "test-informatique-t1-v2",
            "template_name": "T1 – Test de positionnement informatique",
            "title": "T1 – Test de positionnement informatique",
            "parcours": "Informatique",
            "sections": [{"title": "Test de positionnement", "questions": t1_questions}]
        },
        {
            "id": "test-informatique-t2-v2",
            "template_name": "T2 – Test mi parcours informatique",
            "title": "T2 – Test mi parcours informatique",
            "parcours": "Informatique",
            "sections": [{"title": "Test mi parcours", "questions": t2_questions}]
        },
        {
            "id": "test-informatique-t3-v2",
            "template_name": "T3 – Test fin de parcours Informatique",
            "title": "T3 – Test fin de parcours Informatique",
            "parcours": "Informatique",
            "sections": [{"title": "Test fin de parcours", "questions": t3_questions}]
        }
    ]
    
    print("\n🚀 CRÉATION des nouveaux tests Informatique...")
    
    for template in new_templates:
        await db.test_templates.insert_one(template)
        print(f"✅ Créé : {template['template_name']} (ID: {template['id']})")
    
    print(f"\n✨ Remplacement terminé avec succès !")
    print(f"   Total : 90 questions (30 par test)")
    
    # Vérification finale
    all_tests = await db.test_templates.find({'parcours': 'Informatique'}, {'_id': 0, 'template_name': 1, 'id': 1}).to_list(10)
    print(f"\n🔍 Tests finaux dans la base :")
    for t in all_tests:
        print(f"  ✓ {t['template_name']} (ID: {t['id']})")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(replace_informatique_tests())
