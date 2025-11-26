"""
Script pour créer les 3 tests du parcours "Informatique débutant"
T1 - Test de positionnement
T2 - Test à mi-parcours  
T3 - Test de fin de parcours
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def create_informatique_tests():
    # Connexion MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # T1 - Test de positionnement
    t1_questions = [
        {"id": "Q1", "text": "Si vous voulez déplacer un objet à l'écran avec la souris, que faites-vous ?", "choices": ["Je clique et je maintiens en déplaçant la souris", "Je tape au clavier", "Je tourne l'écran", "Je clique deux fois rapidement"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q2", "text": "Pour ouvrir un dossier sur le bureau, vous devez :", "choices": ["Faire un double clic gauche", "Faire un clic droit", "Taper son nom au clavier", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q3", "text": "Si le texte à l'écran est trop petit, que pouvez-vous faire ?", "choices": ["Éteindre l'ordinateur", "Zoomer (Ctrl + + ou pince sur écran tactile)", "Changer d'ordinateur", "Appuyer sur Échap"], "correctAnswers": ["B"], "multipleAllowed": False, "points": 1},
        {"id": "Q4", "text": "Pour écrire un e-mail, il faut d'abord :", "choices": ["Ouvrir une boîte mail (Gmail, Outlook, etc.)", "Brancher une clé USB", "Aller sur YouTube", "Allumer l'imprimante"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q5", "text": "Comment envoyer un e-mail ?", "choices": ["Cliquer sur \"Envoyer\"", "Éteindre l'ordinateur", "Débrancher la souris", "Appuyer sur la touche Entrée"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q6", "text": "Pour supprimer un mot dans un texte, vous utilisez :", "choices": ["La touche Suppr ou Retour arrière", "La touche Espace", "Le clic droit", "L'imprimante"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q7", "text": "Vous souhaitez rechercher une recette sur Internet. Que faites-vous ?", "choices": ["J'ouvre un navigateur et je tape ma recherche", "Je tape au hasard sur le clavier", "Je clique sur Imprimer", "Je redémarre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q8", "text": "Pour regarder vos photos sur l'ordinateur, vous devez :", "choices": ["Ouvrir le dossier Images ou Photos", "Ouvrir Word", "Envoyer un e-mail", "Allumer l'imprimante"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q9", "text": "Une fenêtre apparaît et demande une mise à jour officielle. Que faire ?", "choices": ["Lire, vérifier et accepter si cela vient du système", "Cliquer partout", "Ignorer toujours", "Éteindre l'ordinateur brutalement"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q10", "text": "Vous voulez agrandir une photo sur tablette :", "choices": ["Pincer les doigts en s'écartant", "Appuyer fort", "Cliquer droit", "Secouer la tablette"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q11", "text": "Pour sélectionner un texte :", "choices": ["Cliquer et glisser sur le texte", "Cliquer droit", "Appuyer sur Échap", "Allumer l'imprimante"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q12", "text": "Pour copier un texte sélectionné :", "choices": ["Ctrl + C (ou Cmd + C)", "Ctrl + P", "Espace", "Entrée"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q13", "text": "Pour coller :", "choices": ["Ctrl + V (ou Cmd + V)", "Ctrl + S", "Retour arrière", "Échap"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q14", "text": "Si vous voyez un message disant \"Vous avez gagné un iPhone\", il faut :", "choices": ["Ne pas cliquer, fermer la fenêtre", "Donner ses informations", "Téléphoner au numéro indiqué", "Télécharger le fichier joint"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q15", "text": "Pour imprimer un document :", "choices": ["Cliquer sur Fichier → Imprimer", "Fermer le document", "Éteindre l'imprimante", "Appuyer sur Inser"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q16", "text": "Que signifie Wi-Fi dans la maison ?", "choices": ["Connexion sans fil à Internet", "Une imprimante", "Une télévision", "Une prise électrique"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q17", "text": "Si la souris ne fonctionne pas :", "choices": ["Vérifier si elle est bien branchée ou chargée", "Acheter un nouvel ordinateur", "Cliquer plus fort", "Secouer l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q18", "text": "Pour regarder une vidéo YouTube :", "choices": ["Ouvrir un navigateur et chercher YouTube", "Allumer l'imprimante", "Installer Word", "Ouvrir la calculatrice"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q19", "text": "Pour déplacer une photo dans un dossier :", "choices": ["Glisser-déposer", "Imprimer", "Double clic droit", "Appuyer sur Pause"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q20", "text": "Pour créer un nouveau document :", "choices": ["Cliquer sur Nouveau dans le logiciel", "Éteindre l'ordinateur", "Cliquer droit sur la souris", "Appuyer sur Verr Maj"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q21", "text": "Vous devez fermer un programme :", "choices": ["Cliquer sur la croix en haut", "Cliquer sur Imprimer", "Éteindre l'ordinateur", "Appuyer sur Suppr"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q22", "text": "Pour répondre à un e-mail :", "choices": ["Cliquer sur \"Répondre\"", "Écrire un nouveau message depuis zéro", "Imprimer", "Effacer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q23", "text": "Si vous recevez un e-mail d'une banque inconnue :", "choices": ["Ne pas répondre, ne pas cliquer", "Envoyer ses informations", "Appeler le numéro", "Télécharger les pièces jointes"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q24", "text": "Vous souhaitez augmenter le son :", "choices": ["Utiliser les boutons volume", "Cliquer droit", "Appuyer sur Tab", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q25", "text": "Pour éteindre correctement l'ordinateur :", "choices": ["Menu → Arrêter", "Débrancher", "Appuyer sur Esc", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q26", "text": "Un clavier permet :", "choices": ["D'écrire du texte", "De regarder la télévision", "De prendre des photos", "De régler la température"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q27", "text": "Pour retourner au début d'une page :", "choices": ["Faire défiler vers le haut", "Éteindre", "Copier", "Coller"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q28", "text": "Que faire si vous avez un doute en informatique ?", "choices": ["Demander de l'aide ou vérifier", "Cliquer au hasard", "Télécharger tout", "Donner ses mots de passe"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q29", "text": "Pour brancher une clé USB :", "choices": ["L'insérer dans un port USB", "La poser sur l'ordinateur", "La brancher sur l'écran", "L'imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q30", "text": "À quoi sert la barre de recherche Google ?", "choices": ["Trouver des informations", "Éteindre l'ordinateur", "Installer la souris", "Imprimer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1}
    ]
    
    # T2 - Test à mi-parcours
    t2_questions = [
        {"id": "Q1", "text": "Vous recevez un e-mail avec une pièce jointe nommée \"facture.pdf\". Que devez-vous faire pour la lire ?", "choices": ["Éteindre l'ordinateur", "Cliquer sur la pièce jointe pour l'ouvrir", "Cliquer sur \"Répondre\"", "Supprimer votre boîte mail"], "correctAnswers": ["B"], "multipleAllowed": False, "points": 1},
        {"id": "Q2", "text": "Vous devez envoyer un document à votre médecin par e-mail. Que faites-vous ?", "choices": ["Écrire le message, puis joindre le fichier avant de cliquer sur \"Envoyer\"", "Envoyer le message sans pièce jointe", "Imprimer le document et le poser sur l'écran", "Éteindre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q3", "text": "Vous voulez renommer un fichier \"photo1\" en \"anniversaire_2024\". Quelle action est correcte ?", "choices": ["Clic droit → Renommer", "Clic droit → Supprimer", "Double clic → Imprimer", "Frapper le clavier au hasard"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q4", "text": "Votre écran d'ordinateur vous semble trop sombre. Que faites-vous en premier ?", "choices": ["Régler la luminosité avec les boutons ou dans les paramètres", "Acheter un nouvel écran", "Éteindre l'ordinateur", "Imprimer la page"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q5", "text": "Sur une tablette, vous voulez faire défiler une page vers le bas :", "choices": ["Glisser le doigt de bas en haut", "Taper fort sur l'écran", "Appuyer sur le bouton d'alimentation", "Secouer la tablette"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q6", "text": "Vous devez remplir un formulaire en ligne (nom, prénom, adresse). Que faites-vous ?", "choices": ["Cliquer dans chaque case et taper les informations au clavier", "Écrire sur l'écran avec un stylo", "Imprimer la page et la garder", "Fermer le navigateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q7", "text": "Si une case avec une petite flèche vers le bas apparaît dans un formulaire (menu déroulant), vous devez :", "choices": ["Cliquer sur la flèche pour voir les options", "Éteindre l'ordinateur", "Cliquer sur Imprimer", "Appuyer sur Entrée sans rien lire"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q8", "text": "Vous êtes sur une page Internet qui ne répond plus. Que pouvez-vous essayer d'abord ?", "choices": ["Cliquer sur \"Actualiser / Recharger\" la page", "Débrancher l'ordinateur", "Cliquer partout très vite", "Supprimer l'historique sans raison"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q9", "text": "Sur votre smartphone, vous souhaitez couper le son des appels :", "choices": ["Utiliser le bouton volume ou le mode silencieux", "Éteindre la box Internet", "Éteindre la lumière", "Retirer la carte SIM sans réfléchir"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q10", "text": "Pour se connecter au Wi-Fi chez vous, vous devez :", "choices": ["Sélectionner le nom du réseau et entrer le mot de passe Wi-Fi", "Cliquer sur Imprimer", "Allumer l'imprimante", "Éteindre le téléphone"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q11", "text": "Votre dossier \"Photos\" contient beaucoup d'images. Pour mieux organiser :", "choices": ["Créer des sous-dossiers (famille, vacances, etc.)", "Tout supprimer", "Déplacer tout sur le bureau au hasard", "Imprimer toutes les photos"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q12", "text": "Vous souhaitez envoyer plusieurs photos dans un seul e-mail :", "choices": ["Joindre plusieurs fichiers en même temps avant de cliquer sur \"Envoyer\"", "Envoyer un e-mail par photo", "Mettre les photos sur le clavier", "Coller les photos sur l'écran"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q13", "text": "Vous regardez une vidéo et le son est trop faible :", "choices": ["Vérifier et augmenter le volume sur la vidéo et sur l'ordinateur", "Éteindre l'écran", "Éteindre la box", "Changer la police d'écriture"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q14", "text": "Sur un site officiel, on vous demande de créer un compte avec un mot de passe. Que faites-vous ?", "choices": ["Choisir un mot de passe que vous n'utilisez pas partout ailleurs", "Utiliser \"123456\" pour faire simple", "Utiliser votre prénom uniquement", "Ne pas mettre de mot de passe"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q15", "text": "Vous remarquez une petite icône en forme de cadenas près de l'adresse du site :", "choices": ["Le site utilise une connexion sécurisée", "Le site est un virus", "Le site est toujours faux", "Le site ne fonctionne pas"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q16", "text": "Vous avez oublié un mot de passe sur un site sérieux :", "choices": ["Utiliser la fonction \"Mot de passe oublié\"", "Fermer l'ordinateur pour toujours", "Écrire à tous vos contacts", "Taper au hasard jusqu'à ce que ça passe"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q17", "text": "Sur une visioconférence (ex : rendez-vous avec un proche), vous ne l'entendez pas :", "choices": ["Vérifier le micro, le son et si les haut-parleurs ne sont pas coupés", "Éteindre la box", "Reposer le téléphone", "Supprimer le logiciel"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q18", "text": "Pour prendre une photo avec votre smartphone :", "choices": ["Ouvrir l'application \"Appareil photo\" et appuyer sur le bouton photo", "Appuyer sur le bouton volume", "Éteindre le téléphone", "Cliquer sur paramètres"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q19", "text": "Vous voulez envoyer une photo par messagerie (WhatsApp, SMS, etc.) :", "choices": ["Ouvrir la conversation → icône pièce jointe ou photo → choisir la photo", "Appuyer sur le bouton d'alimentation", "Écrire la description seulement", "Imprimer la photo"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q20", "text": "Si une mise à jour apparaît sur votre smartphone (provenant du système) :", "choices": ["La lire et l'installer quand possible", "Télécharger tout ce qui apparaît sans lire", "Donner votre carte bancaire", "Ignorer toutes les mises à jour à vie"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q21", "text": "Vous voulez appeler un contact enregistré sur votre smartphone :", "choices": ["Ouvrir l'application Téléphone, puis \"Contacts\" et sélectionner la personne", "Taper un numéro au hasard", "Ouvrir les paramètres", "Ouvrir YouTube"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q22", "text": "Un ami vous envoie un lien par e-mail pour une \"offre exceptionnelle\" que vous ne connaissez pas :", "choices": ["Se méfier et ne pas cliquer directement", "Donner vos coordonnées bancaires", "Transmettre à tout votre carnet d'adresses", "Cliquer et télécharger tout"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q23", "text": "Vous voulez retrouver un e-mail ancien dans votre boîte :", "choices": ["Utiliser la barre de recherche (mot-clé, nom de la personne)", "Supprimer tous vos e-mails", "Réinstaller l'ordinateur", "Imprimer toute la boîte mail"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q24", "text": "Sur une page assez longue, vous voulez rechercher un mot précis (ordinateur avec clavier) :", "choices": ["Utiliser Ctrl + F (ou Cmd + F) pour chercher dans la page", "Éteindre l'ordinateur", "Cliquer sur Imprimer", "Augmenter la luminosité"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q25", "text": "Vous devez envoyer un document administratif signé par e-mail, mais vous n'avez qu'une version papier :", "choices": ["Le prendre en photo ou le scanner, puis joindre l'image ou le PDF à l'e-mail", "L'envoyer par la poste uniquement", "Le poser sur l'écran", "Le réécrire entièrement au clavier sans le signer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q26", "text": "Pour libérer de la place sur le téléphone :", "choices": ["Supprimer les photos/vidéos inutiles ou anciennes après sauvegarde", "Supprimer au hasard des applications essentielles", "Éteindre le téléphone", "Effacer les contacts"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q27", "text": "Vous êtes sur un site de vente en ligne connu. Avant de commander, vous vérifiez :", "choices": ["Le nom du site, le cadenas, les conditions et les frais", "Que les couleurs sont jolies", "Que le prix est le plus bas du monde", "Que le site demande votre code PIN par e-mail"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q28", "text": "Votre imprimante n'imprime pas. Premier réflexe :", "choices": ["Vérifier si elle est bien allumée et connectée (câble ou Wi-Fi)", "Acheter immédiatement une imprimante neuve", "Effacer tous les documents", "Éteindre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q29", "text": "Vous avez plusieurs fenêtres ouvertes sur l'ordinateur. Pour passer de l'une à l'autre :", "choices": ["Cliquer sur l'icône correspondante dans la barre des tâches", "Éteindre l'écran", "Appuyer sur Verr Maj", "Débrancher la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q30", "text": "Vous avez un doute sur une manipulation :", "choices": ["Prendre le temps de lire, demander de l'aide ou vérifier avant de cliquer", "Cliquer partout très vite", "Donner vos codes à quelqu'un", "Forcer l'arrêt de l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1}
    ]
    
    # T3 - Test de fin de parcours
    t3_questions = [
        {"id": "Q1", "text": "Vous devez envoyer un dossier complet (plusieurs documents) pour une démarche en ligne :", "choices": ["Rassembler les fichiers dans un même dossier et/ou tous les joindre dans un seul e-mail", "Envoyer un e-mail vide", "Envoyer une seule pièce jointe non demandée", "Tout imprimer et ne rien envoyer"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q2", "text": "Vous devez vous connecter à un espace personnel sur un site officiel :", "choices": ["Entrer votre identifiant et votre mot de passe sur le site officiel", "Donner votre mot de passe par téléphone", "Cliquer sur un lien d'un e-mail suspect", "Utiliser l'identifiant d'un ami"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q3", "text": "Vous recevez un e-mail qui vous demande de \"confirmer vos informations bancaires\" en cliquant sur un lien douteux :", "choices": ["Ne pas cliquer, supprimer ou signaler l'e-mail", "Cliquer et remplir le formulaire", "Répondre avec vos informations", "Transmettre à tous vos contacts"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q4", "text": "Pour vérifier qu'un site est bien officiel :", "choices": ["Vérifier l'adresse (URL), le cadenas, et passer par les favoris ou une recherche officielle", "Se fier uniquement au logo", "Se fier au premier lien de n'importe quel e-mail", "Regarder uniquement les couleurs"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q5", "text": "Vous souhaitez sauvegarder vos photos pour ne pas les perdre :", "choices": ["Les copier sur une clé USB, un disque externe ou dans le cloud", "Les garder uniquement sur le téléphone", "Les envoyer par SMS et les effacer", "Les imprimer puis supprimer les fichiers"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q6", "text": "Vous voulez transférer des photos d'un smartphone à un ordinateur sans câble :", "choices": ["Utiliser un service cloud ou s'envoyer les photos par e-mail/messagerie", "Coller le téléphone sur l'écran", "Imprimer les photos", "Mettre le téléphone dans l'unité centrale"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q7", "text": "Sur une visioconférence, vous voulez couper votre micro :", "choices": ["Cliquer sur l'icône \"micro\" pour le désactiver", "Éteindre la box", "Baisser la luminosité", "Écrire dans le chat \"chut\""], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q8", "text": "Vous voulez partager votre écran avec un proche pour qu'il vous aide :", "choices": ["Utiliser la fonction \"Partager l'écran\" de l'outil de visioconférence", "Pointer la caméra vers l'écran", "Faire une photo de l'écran à chaque fois", "Imprimer la page"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q9", "text": "Vous installez une nouvelle application sur votre smartphone (depuis le magasin officiel) :", "choices": ["Vérifier les avis, la note, le nombre de téléchargements avant d'installer", "Installer tout ce qui apparaît", "Donner vos coordonnées bancaires sans réfléchir", "Installer seulement si le logo est joli"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q10", "text": "Vous avez beaucoup d'e-mails. Pour gagner du temps :", "choices": ["Utiliser les dossiers, les filtres ou les étiquettes pour classer", "Tout laisser dans la boîte de réception", "Supprimer tous les e-mails sans les lire", "N'ouvrir plus jamais la messagerie"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q11", "text": "Sur un traitement de texte, vous voulez mettre un titre en gras :", "choices": ["Sélectionner le texte et cliquer sur le bouton \"G\" ou utiliser le menu \"Gras\"", "Appuyer plus fort sur le clavier", "Taper le mot en majuscule uniquement", "Éteindre l'ordinateur"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q12", "text": "Vous devez envoyer un document en PDF plutôt qu'en format modifiable :", "choices": ["Exporter ou enregistrer le document en PDF avant de l'envoyer", "Envoyer le document tel quel, sans rien vérifier", "Prendre une photo de l'écran", "Imprimer le document"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q13", "text": "Vous voulez rechercher une ancienne facture dans votre ordinateur :", "choices": ["Utiliser la fonction de recherche du système (nom de fichier ou mot-clé)", "Ouvrir tous les fichiers un par un", "Tout imprimer", "Supprimer des dossiers au hasard"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q14", "text": "Vous voyez un message \"espace de stockage presque plein\" sur votre téléphone :", "choices": ["Supprimer des fichiers inutiles (photos, vidéos, applis non utilisées) après les avoir sauvegardés", "Ignorer le message", "Éteindre le téléphone", "Supprimer tous vos contacts"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q15", "text": "Vous utilisez un mot de passe pour un site important. Quel comportement est le plus sûr ?", "choices": ["Ne pas le noter en clair, utiliser un carnet discret ou un gestionnaire, et ne pas le partager", "Le donner à vos proches", "Le mettre sur un post-it sur l'écran", "Utiliser \"azerty\" partout"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q16", "text": "Vous recevez un SMS qui prétend venir d'un service de colis avec un lien bizarre :", "choices": ["Se méfier, ne pas cliquer, vérifier directement sur le site ou l'application officielle", "Cliquer et donner ses informations", "Répondre avec vos coordonnées bancaires", "Transférer à tous vos contacts"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q17", "text": "Pour limiter les risques sur Internet, on peut :", "choices": ["Mettre à jour régulièrement ses appareils et logiciels", "Désactiver toutes les mises à jour", "Utiliser toujours le même mot de passe", "Cliquer sur toutes les publicités"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q18", "text": "Vous utilisez un service de stockage en ligne (cloud). Quel est l'avantage principal ?", "choices": ["Accéder à vos fichiers depuis plusieurs appareils, avec une connexion Internet", "Ne plus jamais sauvegarder", "Rendre vos fichiers publics automatiquement", "Augmenter le poids de vos fichiers"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q19", "text": "Votre ordinateur est très lent au démarrage :", "choices": ["Vérifier les programmes qui se lancent au démarrage et en désactiver certains si nécessaire", "Appuyer très fort sur les touches", "Éteindre et rallumer en boucle", "Supprimer tous vos documents"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q20", "text": "Vous voulez vérifier que l'expéditeur d'un e-mail est bien la personne ou l'organisme indiqué :", "choices": ["Regarder attentivement l'adresse e-mail complète, pas seulement le nom affiché", "Se fier uniquement au logo", "Se fier à l'objet du message", "Ne jamais vérifier"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q21", "text": "Vous devez remplir un formulaire en ligne et joindre un justificatif de domicile :", "choices": ["Préparer le fichier (scan ou photo lisible) et le joindre dans la zone prévue", "Écrire \"je n'ai pas de justificatif\"", "Envoyer un texte au hasard", "Envoyer une photo de vacances"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q22", "text": "Pour se déconnecter correctement d'un site (ex : banque, service administratif) :", "choices": ["Cliquer sur \"Déconnexion\" ou \"Se déconnecter\"", "Fermer juste l'onglet", "Éteindre l'écran seulement", "Débrancher la box"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q23", "text": "Vous devez participer à un rendez-vous en visioconférence médical :", "choices": ["Vérifier l'heure, le lien, la connexion Internet, le son et la caméra à l'avance", "Attendre l'heure sans rien préparer", "Ne pas lire les consignes", "Essayer de se connecter avec un lien d'un vieux e-mail"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q24", "text": "Vous recevez plusieurs notifications sur votre smartphone :", "choices": ["Les ouvrir quand on a le temps, désactiver celles qui sont inutiles dans les paramètres", "Tout ignorer à vie", "Cliquer sur tout sans lire", "Éteindre le téléphone"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q25", "text": "Vous changez de téléphone et voulez garder vos contacts :", "choices": ["Utiliser une sauvegarde (compte, copie carte SIM, export/import des contacts)", "Tout retaper à la main sans sauvegarde", "Tout perdre", "Noter les numéros sur un post-it seulement"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q26", "text": "Vous voulez faire une capture d'écran (screenshot) sur ordinateur :", "choices": ["Utiliser la touche ou l'outil de capture fourni par le système", "Prendre une photo de l'écran avec un autre appareil uniquement", "Imprimer l'écran", "Secouer la souris"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q27", "text": "Vous remarquez que le contenu d'un e-mail est dans une langue que vous ne comprenez pas, avec un lien suspect :", "choices": ["Ne pas cliquer, supprimer le message", "Cliquer pour essayer de comprendre", "Répondre avec vos données personnelles", "Le transférer à tous"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q28", "text": "Pour mettre à jour une application sur smartphone :", "choices": ["Passer par le magasin officiel (Play Store, App Store) et lancer les mises à jour", "Télécharger depuis un site inconnu", "Cliquer sur n'importe quel lien dans un SMS", "Appuyer plus fort sur l'icône"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q29", "text": "Vous utilisez régulièrement un service en ligne (banque, santé, retraite). Pour y accéder plus facilement et en sécurité :", "choices": ["Créer un favori dans le navigateur pour éviter les faux liens", "Cliquer sur tous les liens reçus par SMS", "Taper une adresse approximative", "Passer par n'importe quel moteur de recherche sans vérifier"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1},
        {"id": "Q30", "text": "Globalement, en cas de doute devant un message, une demande ou un site Internet :", "choices": ["Prendre le temps de vérifier, demander conseil, ne pas se précipiter", "Cliquer le plus vite possible", "Donner immédiatement ses codes", "Tout fermer sans réfléchir ni demander d'aide"], "correctAnswers": ["A"], "multipleAllowed": False, "points": 1}
    ]
    
    # Créer les 3 templates de test
    test_templates = [
        {
            "id": "test-informatique-debutant-t1-v1",
            "template_name": "T1 – Test de positionnement pratique informatique – Seniors débutants",
            "title": "T1 – Test de positionnement pratique informatique – Seniors débutants",
            "parcours": "Informatique débutant",
            "sections": [
                {
                    "title": "Test de positionnement",
                    "questions": t1_questions
                }
            ]
        },
        {
            "id": "test-informatique-debutant-t2-v1",
            "template_name": "T2 – Test à mi-parcours pratique informatique – Seniors",
            "title": "T2 – Test à mi-parcours pratique informatique – Seniors",
            "parcours": "Informatique débutant",
            "sections": [
                {
                    "title": "Test à mi-parcours",
                    "questions": t2_questions
                }
            ]
        },
        {
            "id": "test-informatique-debutant-t3-v1",
            "template_name": "T3 – Test de fin de parcours pratique informatique – Seniors",
            "title": "T3 – Test de fin de parcours pratique informatique – Seniors",
            "parcours": "Informatique débutant",
            "sections": [
                {
                    "title": "Test de fin de parcours",
                    "questions": t3_questions
                }
            ]
        }
    ]
    
    # Insérer dans la base de données
    print("🚀 Création des tests pour le parcours 'Informatique débutant'...")
    
    for template in test_templates:
        # Vérifier si le template existe déjà
        existing = await db.test_templates.find_one({"id": template["id"]}, {"_id": 0})
        if existing:
            print(f"⚠️  Le test '{template['template_name']}' existe déjà. Mise à jour...")
            await db.test_templates.replace_one({"id": template["id"]}, template)
        else:
            print(f"✅ Création du test '{template['template_name']}'...")
            await db.test_templates.insert_one(template)
    
    print("\n✅ Tous les tests ont été créés avec succès !")
    print(f"\n📊 Résumé :")
    print(f"  - T1 (Positionnement) : {len(t1_questions)} questions")
    print(f"  - T2 (Mi-parcours) : {len(t2_questions)} questions")
    print(f"  - T3 (Fin de parcours) : {len(t3_questions)} questions")
    print(f"  - Total : {len(t1_questions) + len(t2_questions) + len(t3_questions)} questions")
    
    # Vérifier que les tests sont bien dans la DB
    print("\n🔍 Vérification des tests créés...")
    all_tests = await db.test_templates.find({"parcours": "Informatique débutant"}, {"_id": 0}).to_list(10)
    for test in all_tests:
        print(f"  ✓ {test['template_name']} (ID: {test['id']})")
    
    client.close()
    print("\n✨ Script terminé avec succès !")

if __name__ == "__main__":
    asyncio.run(create_informatique_tests())
