#!/usr/bin/env python3
"""
Script pour créer les tests T1, T2, T3 pour le parcours "Informatique débutant"
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# T1 - Test de positionnement
T1_QUESTIONS = [
    {"question": "Si vous voulez déplacer un objet à l'écran avec la souris, que faites-vous ?", "options": ["Je clique et je maintiens en déplaçant la souris", "Je tape au clavier", "Je tourne l'écran", "Je clique deux fois rapidement"], "correct": 0},
    {"question": "Pour ouvrir un dossier sur le bureau, vous devez :", "options": ["Faire un double clic gauche", "Faire un clic droit", "Taper son nom au clavier", "Secouer la souris"], "correct": 0},
    {"question": "Si le texte à l'écran est trop petit, que pouvez-vous faire ?", "options": ["Éteindre l'ordinateur", "Zoomer (Ctrl + + ou pince sur écran tactile)", "Changer d'ordinateur", "Appuyer sur Échap"], "correct": 1},
    {"question": "Pour écrire un e-mail, il faut d'abord :", "options": ["Ouvrir une boîte mail (Gmail, Outlook, etc.)", "Brancher une clé USB", "Aller sur YouTube", "Allumer l'imprimante"], "correct": 0},
    {"question": "Comment envoyer un e-mail ?", "options": ["Cliquer sur \"Envoyer\"", "Éteindre l'ordinateur", "Débrancher la souris", "Appuyer sur la touche Entrée"], "correct": 0},
    {"question": "Pour supprimer un mot dans un texte, vous utilisez :", "options": ["La touche Suppr ou Retour arrière", "La touche Espace", "Le clic droit", "L'imprimante"], "correct": 0},
    {"question": "Vous souhaitez rechercher une recette sur Internet. Que faites-vous ?", "options": ["J'ouvre un navigateur et je tape ma recherche", "Je tape au hasard sur le clavier", "Je clique sur Imprimer", "Je redémarre l'ordinateur"], "correct": 0},
    {"question": "Pour regarder vos photos sur l'ordinateur, vous devez :", "options": ["Ouvrir le dossier Images ou Photos", "Ouvrir Word", "Envoyer un e-mail", "Allumer l'imprimante"], "correct": 0},
    {"question": "Une fenêtre apparaît et demande une mise à jour officielle. Que faire ?", "options": ["Lire, vérifier et accepter si cela vient du système", "Cliquer partout", "Ignorer toujours", "Éteindre l'ordinateur brutalement"], "correct": 0},
    {"question": "Vous voulez agrandir une photo sur tablette :", "options": ["Pincer les doigts en s'écartant", "Appuyer fort", "Cliquer droit", "Secouer la tablette"], "correct": 0},
    {"question": "Pour sélectionner un texte :", "options": ["Cliquer et glisser sur le texte", "Cliquer droit", "Appuyer sur Échap", "Allumer l'imprimante"], "correct": 0},
    {"question": "Pour copier un texte sélectionné :", "options": ["Ctrl + C (ou Cmd + C)", "Ctrl + P", "Espace", "Entrée"], "correct": 0},
    {"question": "Pour coller :", "options": ["Ctrl + V (ou Cmd + V)", "Ctrl + S", "Retour arrière", "Échap"], "correct": 0},
    {"question": "Si vous voyez un message disant \"Vous avez gagné un iPhone\", il faut :", "options": ["Ne pas cliquer, fermer la fenêtre", "Donner ses informations", "Téléphoner au numéro indiqué", "Télécharger le fichier joint"], "correct": 0},
    {"question": "Pour imprimer un document :", "options": ["Cliquer sur Fichier → Imprimer", "Fermer le document", "Éteindre l'imprimante", "Appuyer sur Inser"], "correct": 0},
    {"question": "Que signifie Wi-Fi dans la maison ?", "options": ["Connexion sans fil à Internet", "Une imprimante", "Une télévision", "Une prise électrique"], "correct": 0},
    {"question": "Si la souris ne fonctionne pas :", "options": ["Vérifier si elle est bien branchée ou chargée", "Acheter un nouvel ordinateur", "Cliquer plus fort", "Secouer l'écran"], "correct": 0},
    {"question": "Pour regarder une vidéo YouTube :", "options": ["Ouvrir un navigateur et chercher YouTube", "Allumer l'imprimante", "Installer Word", "Ouvrir la calculatrice"], "correct": 0},
    {"question": "Pour déplacer une photo dans un dossier :", "options": ["Glisser-déposer", "Imprimer", "Double clic droit", "Appuyer sur Pause"], "correct": 0},
    {"question": "Pour créer un nouveau document :", "options": ["Cliquer sur Nouveau dans le logiciel", "Éteindre l'ordinateur", "Cliquer droit sur la souris", "Appuyer sur Verr Maj"], "correct": 0},
    {"question": "Vous devez fermer un programme :", "options": ["Cliquer sur la croix en haut", "Cliquer sur Imprimer", "Éteindre l'ordinateur", "Appuyer sur Suppr"], "correct": 0},
    {"question": "Pour répondre à un e-mail :", "options": ["Cliquer sur \"Répondre\"", "Écrire un nouveau message depuis zéro", "Imprimer", "Effacer"], "correct": 0},
    {"question": "Si vous recevez un e-mail d'une banque inconnue :", "options": ["Ne pas répondre, ne pas cliquer", "Envoyer ses informations", "Appeler le numéro", "Télécharger les pièces jointes"], "correct": 0},
    {"question": "Vous souhaitez augmenter le son :", "options": ["Utiliser les boutons volume", "Cliquer droit", "Appuyer sur Tab", "Imprimer"], "correct": 0},
    {"question": "Pour éteindre correctement l'ordinateur :", "options": ["Menu → Arrêter", "Débrancher", "Appuyer sur Esc", "Secouer la souris"], "correct": 0},
    {"question": "Vous voulez enregistrer votre travail :", "options": ["Fichier → Enregistrer ou Ctrl + S", "Fermer le document", "Appuyer sur Échap", "Cliquer droit"], "correct": 0},
    {"question": "Pour revenir en arrière sur une page Internet :", "options": ["Cliquer sur la flèche retour", "Éteindre l'ordinateur", "Appuyer sur Suppr", "Débrancher la souris"], "correct": 0},
    {"question": "Vous voulez voir toutes les applications installées sur smartphone :", "options": ["Ouvrir le tiroir d'applications", "Éteindre le téléphone", "Appuyer sur le volume", "Retirer la batterie"], "correct": 0},
    {"question": "Pour recharger votre smartphone :", "options": ["Brancher le câble de chargement", "Le mettre au soleil", "Le secouer", "Supprimer des photos"], "correct": 0},
    {"question": "Si vous ne savez pas comment faire quelque chose :", "options": ["Demander de l'aide ou chercher un tutoriel", "Cliquer au hasard", "Tout supprimer", "Éteindre définitivement"], "correct": 0}
]

# T2 - Test à mi-parcours
T2_QUESTIONS = [
    {"question": "Vous recevez un e-mail avec une pièce jointe nommée \"facture.pdf\". Que devez-vous faire pour la lire ?", "options": ["Éteindre l'ordinateur", "Cliquer sur la pièce jointe pour l'ouvrir", "Cliquer sur \"Répondre\"", "Supprimer votre boîte mail"], "correct": 1},
    {"question": "Vous devez envoyer un document à votre médecin par e-mail. Que faites-vous ?", "options": ["Écrire le message, puis joindre le fichier avant de cliquer sur \"Envoyer\"", "Envoyer le message sans pièce jointe", "Imprimer le document et le poser sur l'écran", "Éteindre l'ordinateur"], "correct": 0},
    {"question": "Vous voulez renommer un fichier \"photo1\" en \"anniversaire_2024\". Quelle action est correcte ?", "options": ["Clic droit → Renommer", "Clic droit → Supprimer", "Double clic → Imprimer", "Frapper le clavier au hasard"], "correct": 0},
    {"question": "Votre écran d'ordinateur vous semble trop sombre. Que faites-vous en premier ?", "options": ["Régler la luminosité avec les boutons ou dans les paramètres", "Acheter un nouvel écran", "Éteindre l'ordinateur", "Imprimer la page"], "correct": 0},
    {"question": "Sur une tablette, vous voulez faire défiler une page vers le bas :", "options": ["Glisser le doigt de bas en haut", "Taper fort sur l'écran", "Appuyer sur le bouton d'alimentation", "Secouer la tablette"], "correct": 0},
    {"question": "Vous devez remplir un formulaire en ligne (nom, prénom, adresse). Que faites-vous ?", "options": ["Cliquer dans chaque case et taper les informations au clavier", "Écrire sur l'écran avec un stylo", "Imprimer la page et la garder", "Fermer le navigateur"], "correct": 0},
    {"question": "Si une case avec une petite flèche vers le bas apparaît dans un formulaire (menu déroulant), vous devez :", "options": ["Cliquer sur la flèche pour voir les options", "Éteindre l'ordinateur", "Cliquer sur Imprimer", "Appuyer sur Entrée sans rien lire"], "correct": 0},
    {"question": "Vous êtes sur une page Internet qui ne répond plus. Que pouvez-vous essayer d'abord ?", "options": ["Cliquer sur \"Actualiser / Recharger\" la page", "Débrancher l'ordinateur", "Cliquer partout très vite", "Supprimer l'historique sans raison"], "correct": 0},
    {"question": "Sur votre smartphone, vous souhaitez couper le son des appels :", "options": ["Utiliser le bouton volume ou le mode silencieux", "Éteindre la box Internet", "Éteindre la lumière", "Retirer la carte SIM sans réfléchir"], "correct": 0},
    {"question": "Pour se connecter au Wi-Fi chez vous, vous devez :", "options": ["Sélectionner le nom du réseau et entrer le mot de passe Wi-Fi", "Cliquer sur Imprimer", "Allumer l'imprimante", "Éteindre le téléphone"], "correct": 0},
    {"question": "Votre dossier \"Photos\" contient beaucoup d'images. Pour mieux organiser :", "options": ["Créer des sous-dossiers (famille, vacances, etc.)", "Tout supprimer", "Déplacer tout sur le bureau au hasard", "Imprimer toutes les photos"], "correct": 0},
    {"question": "Vous souhaitez envoyer plusieurs photos dans un seul e-mail :", "options": ["Joindre plusieurs fichiers en même temps avant de cliquer sur \"Envoyer\"", "Envoyer un e-mail par photo", "Mettre les photos sur le clavier", "Coller les photos sur l'écran"], "correct": 0},
    {"question": "Vous regardez une vidéo et le son est trop faible :", "options": ["Vérifier et augmenter le volume sur la vidéo et sur l'ordinateur", "Éteindre l'écran", "Éteindre la box", "Changer la police d'écriture"], "correct": 0},
    {"question": "Sur un site officiel, on vous demande de créer un compte avec un mot de passe. Que faites-vous ?", "options": ["Choisir un mot de passe que vous n'utilisez pas partout ailleurs", "Utiliser \"123456\" pour faire simple", "Utiliser votre prénom uniquement", "Ne pas mettre de mot de passe"], "correct": 0},
    {"question": "Vous remarquez une petite icône en forme de cadenas près de l'adresse du site :", "options": ["Le site utilise une connexion sécurisée", "Le site est un virus", "Le site est toujours faux", "Le site ne fonctionne pas"], "correct": 0},
    {"question": "Vous avez oublié un mot de passe sur un site sérieux :", "options": ["Utiliser la fonction \"Mot de passe oublié\"", "Fermer l'ordinateur pour toujours", "Écrire à tous vos contacts", "Taper au hasard jusqu'à ce que ça passe"], "correct": 0},
    {"question": "Sur une visioconférence (ex : rendez-vous avec un proche), vous ne l'entendez pas :", "options": ["Vérifier le micro, le son et si les haut-parleurs ne sont pas coupés", "Éteindre la box", "Reposer le téléphone", "Supprimer le logiciel"], "correct": 0},
    {"question": "Pour prendre une photo avec votre smartphone :", "options": ["Ouvrir l'application \"Appareil photo\" et appuyer sur le bouton photo", "Appuyer sur le bouton volume", "Éteindre le téléphone", "Cliquer sur paramètres"], "correct": 0},
    {"question": "Vous voulez envoyer une photo par messagerie (WhatsApp, SMS, etc.) :", "options": ["Ouvrir la conversation → icône pièce jointe ou photo → choisir la photo", "Appuyer sur le bouton d'alimentation", "Écrire la description seulement", "Imprimer la photo"], "correct": 0},
    {"question": "Si une mise à jour apparaît sur votre smartphone (provenant du système) :", "options": ["La lire et l'installer quand possible", "Télécharger tout ce qui apparaît sans lire", "Donner votre carte bancaire", "Ignorer toutes les mises à jour à vie"], "correct": 0},
    {"question": "Vous voulez appeler un contact enregistré sur votre smartphone :", "options": ["Ouvrir l'application Téléphone, puis \"Contacts\" et sélectionner la personne", "Taper un numéro au hasard", "Ouvrir les paramètres", "Ouvrir YouTube"], "correct": 0},
    {"question": "Un ami vous envoie un lien par e-mail pour une \"offre exceptionnelle\" que vous ne connaissez pas :", "options": ["Se méfier et ne pas cliquer directement", "Donner vos coordonnées bancaires", "Transmettre à tout votre carnet d'adresses", "Cliquer et télécharger tout"], "correct": 0},
    {"question": "Vous voulez retrouver un e-mail ancien dans votre boîte :", "options": ["Utiliser la barre de recherche (mot-clé, nom de la personne)", "Supprimer tous vos e-mails", "Réinstaller l'ordinateur", "Imprimer toute la boîte mail"], "correct": 0},
    {"question": "Sur une page assez longue, vous voulez rechercher un mot précis (ordinateur avec clavier) :", "options": ["Utiliser Ctrl + F (ou Cmd + F) pour chercher dans la page", "Éteindre l'ordinateur", "Cliquer sur Imprimer", "Augmenter la luminosité"], "correct": 0},
    {"question": "Vous devez envoyer un document administratif signé par e-mail, mais vous n'avez qu'une version papier :", "options": ["Le prendre en photo ou le scanner, puis joindre l'image ou le PDF à l'e-mail", "L'envoyer par la poste uniquement", "Le poser sur l'écran", "Le réécrire entièrement au clavier sans le signer"], "correct": 0},
    {"question": "Pour libérer de la place sur le téléphone :", "options": ["Supprimer les photos/vidéos inutiles ou anciennes après sauvegarde", "Supprimer au hasard des applications essentielles", "Éteindre le téléphone", "Effacer les contacts"], "correct": 0},
    {"question": "Vous êtes sur un site de vente en ligne connu. Avant de commander, vous vérifiez :", "options": ["Le nom du site, le cadenas, les conditions et les frais", "Que les couleurs sont jolies", "Que le prix est le plus bas du monde", "Que le site demande votre code PIN par e-mail"], "correct": 0},
    {"question": "Votre imprimante n'imprime pas. Premier réflexe :", "options": ["Vérifier si elle est bien allumée et connectée (câble ou Wi-Fi)", "Acheter immédiatement une imprimante neuve", "Effacer tous les documents", "Éteindre l'ordinateur"], "correct": 0},
    {"question": "Vous avez plusieurs fenêtres ouvertes sur l'ordinateur. Pour passer de l'une à l'autre :", "options": ["Cliquer sur l'icône correspondante dans la barre des tâches", "Éteindre l'écran", "Appuyer sur Verr Maj", "Débrancher la souris"], "correct": 0},
    {"question": "Vous avez un doute sur une manipulation :", "options": ["Prendre le temps de lire, demander de l'aide ou vérifier avant de cliquer", "Cliquer partout très vite", "Donner vos codes à quelqu'un", "Forcer l'arrêt de l'ordinateur"], "correct": 0}
]

# T2 - Test à mi-parcours (30 questions)
T2_QUESTIONS = [
    {"question": "Vous recevez un e-mail avec une pièce jointe nommée \"facture.pdf\". Que devez-vous faire pour la lire ?", "options": ["Éteindre l'ordinateur", "Cliquer sur la pièce jointe pour l'ouvrir", "Cliquer sur \"Répondre\"", "Supprimer votre boîte mail"], "correct": 1},
    {"question": "Vous devez envoyer un document à votre médecin par e-mail. Que faites-vous ?", "options": ["Écrire le message, puis joindre le fichier avant de cliquer sur \"Envoyer\"", "Envoyer le message sans pièce jointe", "Imprimer le document et le poser sur l'écran", "Éteindre l'ordinateur"], "correct": 0},
    {"question": "Vous voulez renommer un fichier \"photo1\" en \"anniversaire_2024\". Quelle action est correcte ?", "options": ["Clic droit → Renommer", "Clic droit → Supprimer", "Double clic → Imprimer", "Frapper le clavier au hasard"], "correct": 0},
    {"question": "Votre écran d'ordinateur vous semble trop sombre. Que faites-vous en premier ?", "options": ["Régler la luminosité avec les boutons ou dans les paramètres", "Acheter un nouvel écran", "Éteindre l'ordinateur", "Imprimer la page"], "correct": 0},
    {"question": "Sur une tablette, vous voulez faire défiler une page vers le bas :", "options": ["Glisser le doigt de bas en haut", "Taper fort sur l'écran", "Appuyer sur le bouton d'alimentation", "Secouer la tablette"], "correct": 0},
    {"question": "Vous devez remplir un formulaire en ligne (nom, prénom, adresse). Que faites-vous ?", "options": ["Cliquer dans chaque case et taper les informations au clavier", "Écrire sur l'écran avec un stylo", "Imprimer la page et la garder", "Fermer le navigateur"], "correct": 0},
    {"question": "Si une case avec une petite flèche vers le bas apparaît dans un formulaire (menu déroulant), vous devez :", "options": ["Cliquer sur la flèche pour voir les options", "Éteindre l'ordinateur", "Cliquer sur Imprimer", "Appuyer sur Entrée sans rien lire"], "correct": 0},
    {"question": "Vous êtes sur une page Internet qui ne répond plus. Que pouvez-vous essayer d'abord ?", "options": ["Cliquer sur \"Actualiser / Recharger\" la page", "Débrancher l'ordinateur", "Cliquer partout très vite", "Supprimer l'historique sans raison"], "correct": 0},
    {"question": "Sur votre smartphone, vous souhaitez couper le son des appels :", "options": ["Utiliser le bouton volume ou le mode silencieux", "Éteindre la box Internet", "Éteindre la lumière", "Retirer la carte SIM sans réfléchir"], "correct": 0},
    {"question": "Pour se connecter au Wi-Fi chez vous, vous devez :", "options": ["Sélectionner le nom du réseau et entrer le mot de passe Wi-Fi", "Cliquer sur Imprimer", "Allumer l'imprimante", "Éteindre le téléphone"], "correct": 0},
    {"question": "Votre dossier \"Photos\" contient beaucoup d'images. Pour mieux organiser :", "options": ["Créer des sous-dossiers (famille, vacances, etc.)", "Tout supprimer", "Déplacer tout sur le bureau au hasard", "Imprimer toutes les photos"], "correct": 0},
    {"question": "Vous souhaitez envoyer plusieurs photos dans un seul e-mail :", "options": ["Joindre plusieurs fichiers en même temps avant de cliquer sur \"Envoyer\"", "Envoyer un e-mail par photo", "Mettre les photos sur le clavier", "Coller les photos sur l'écran"], "correct": 0},
    {"question": "Vous regardez une vidéo et le son est trop faible :", "options": ["Vérifier et augmenter le volume sur la vidéo et sur l'ordinateur", "Éteindre l'écran", "Éteindre la box", "Changer la police d'écriture"], "correct": 0},
    {"question": "Sur un site officiel, on vous demande de créer un compte avec un mot de passe. Que faites-vous ?", "options": ["Choisir un mot de passe que vous n'utilisez pas partout ailleurs", "Utiliser \"123456\" pour faire simple", "Utiliser votre prénom uniquement", "Ne pas mettre de mot de passe"], "correct": 0},
    {"question": "Vous remarquez une petite icône en forme de cadenas près de l'adresse du site :", "options": ["Le site utilise une connexion sécurisée", "Le site est un virus", "Le site est toujours faux", "Le site ne fonctionne pas"], "correct": 0},
    {"question": "Vous avez oublié un mot de passe sur un site sérieux :", "options": ["Utiliser la fonction \"Mot de passe oublié\"", "Fermer l'ordinateur pour toujours", "Écrire à tous vos contacts", "Taper au hasard jusqu'à ce que ça passe"], "correct": 0},
    {"question": "Sur une visioconférence (ex : rendez-vous avec un proche), vous ne l'entendez pas :", "options": ["Vérifier le micro, le son et si les haut-parleurs ne sont pas coupés", "Éteindre la box", "Reposer le téléphone", "Supprimer le logiciel"], "correct": 0},
    {"question": "Pour prendre une photo avec votre smartphone :", "options": ["Ouvrir l'application \"Appareil photo\" et appuyer sur le bouton photo", "Appuyer sur le bouton volume", "Éteindre le téléphone", "Cliquer sur paramètres"], "correct": 0},
    {"question": "Vous voulez envoyer une photo par messagerie (WhatsApp, SMS, etc.) :", "options": ["Ouvrir la conversation → icône pièce jointe ou photo → choisir la photo", "Appuyer sur le bouton d'alimentation", "Écrire la description seulement", "Imprimer la photo"], "correct": 0},
    {"question": "Si une mise à jour apparaît sur votre smartphone (provenant du système) :", "options": ["La lire et l'installer quand possible", "Télécharger tout ce qui apparaît sans lire", "Donner votre carte bancaire", "Ignorer toutes les mises à jour à vie"], "correct": 0},
    {"question": "Vous voulez appeler un contact enregistré sur votre smartphone :", "options": ["Ouvrir l'application Téléphone, puis \"Contacts\" et sélectionner la personne", "Taper un numéro au hasard", "Ouvrir les paramètres", "Ouvrir YouTube"], "correct": 0},
    {"question": "Un ami vous envoie un lien par e-mail pour une \"offre exceptionnelle\" que vous ne connaissez pas :", "options": ["Se méfier et ne pas cliquer directement", "Donner vos coordonnées bancaires", "Transmettre à tout votre carnet d'adresses", "Cliquer et télécharger tout"], "correct": 0},
    {"question": "Vous voulez retrouver un e-mail ancien dans votre boîte :", "options": ["Utiliser la barre de recherche (mot-clé, nom de la personne)", "Supprimer tous vos e-mails", "Réinstaller l'ordinateur", "Imprimer toute la boîte mail"], "correct": 0},
    {"question": "Sur une page assez longue, vous voulez rechercher un mot précis (ordinateur avec clavier) :", "options": ["Utiliser Ctrl + F (ou Cmd + F) pour chercher dans la page", "Éteindre l'ordinateur", "Cliquer sur Imprimer", "Augmenter la luminosité"], "correct": 0},
    {"question": "Vous devez envoyer un document administratif signé par e-mail, mais vous n'avez qu'une version papier :", "options": ["Le prendre en photo ou le scanner, puis joindre l'image ou le PDF à l'e-mail", "L'envoyer par la poste uniquement", "Le poser sur l'écran", "Le réécrire entièrement au clavier sans le signer"], "correct": 0},
    {"question": "Pour libérer de la place sur le téléphone :", "options": ["Supprimer les photos/vidéos inutiles ou anciennes après sauvegarde", "Supprimer au hasard des applications essentielles", "Éteindre le téléphone", "Effacer les contacts"], "correct": 0},
    {"question": "Vous êtes sur un site de vente en ligne connu. Avant de commander, vous vérifiez :", "options": ["Le nom du site, le cadenas, les conditions et les frais", "Que les couleurs sont jolies", "Que le prix est le plus bas du monde", "Que le site demande votre code PIN par e-mail"], "correct": 0},
    {"question": "Votre imprimante n'imprime pas. Premier réflexe :", "options": ["Vérifier si elle est bien allumée et connectée (câble ou Wi-Fi)", "Acheter immédiatement une imprimante neuve", "Effacer tous les documents", "Éteindre l'ordinateur"], "correct": 0},
    {"question": "Vous avez plusieurs fenêtres ouvertes sur l'ordinateur. Pour passer de l'une à l'autre :", "options": ["Cliquer sur l'icône correspondante dans la barre des tâches", "Éteindre l'écran", "Appuyer sur Verr Maj", "Débrancher la souris"], "correct": 0},
    {"question": "Vous avez un doute sur une manipulation :", "options": ["Prendre le temps de lire, demander de l'aide ou vérifier avant de cliquer", "Cliquer partout très vite", "Donner vos codes à quelqu'un", "Forcer l'arrêt de l'ordinateur"], "correct": 0}
]

# T3 - Test de fin de parcours (30 questions)
T3_QUESTIONS = [
    {"question": "Vous devez envoyer un dossier complet (plusieurs documents) pour une démarche en ligne :", "options": ["Rassembler les fichiers dans un même dossier et/ou tous les joindre dans un seul e-mail", "Envoyer un e-mail vide", "Envoyer une seule pièce jointe non demandée", "Tout imprimer et ne rien envoyer"], "correct": 0},
    {"question": "Vous devez vous connecter à un espace personnel sur un site officiel :", "options": ["Entrer votre identifiant et votre mot de passe sur le site officiel", "Donner votre mot de passe par téléphone", "Cliquer sur un lien d'un e-mail suspect", "Utiliser l'identifiant d'un ami"], "correct": 0},
    {"question": "Vous recevez un e-mail qui vous demande de \"confirmer vos informations bancaires\" en cliquant sur un lien douteux :", "options": ["Ne pas cliquer, supprimer ou signaler l'e-mail", "Cliquer et remplir le formulaire", "Répondre avec vos informations", "Transmettre à tous vos contacts"], "correct": 0},
    {"question": "Pour vérifier qu'un site est bien officiel :", "options": ["Vérifier l'adresse (URL), le cadenas, et passer par les favoris ou une recherche officielle", "Se fier uniquement au logo", "Se fier au premier lien de n'importe quel e-mail", "Regarder uniquement les couleurs"], "correct": 0},
    {"question": "Vous souhaitez sauvegarder vos photos pour ne pas les perdre :", "options": ["Les copier sur une clé USB, un disque externe ou dans le cloud", "Les garder uniquement sur le téléphone", "Les envoyer par SMS et les effacer", "Les imprimer puis supprimer les fichiers"], "correct": 0},
    {"question": "Vous voulez transférer des photos d'un smartphone à un ordinateur sans câble :", "options": ["Utiliser un service cloud ou s'envoyer les photos par e-mail/messagerie", "Coller le téléphone sur l'écran", "Imprimer les photos", "Mettre le téléphone dans l'unité centrale"], "correct": 0},
    {"question": "Sur une visioconférence, vous voulez couper votre micro :", "options": ["Cliquer sur l'icône \"micro\" pour le désactiver", "Éteindre la box", "Baisser la luminosité", "Écrire dans le chat \"chut\""], "correct": 0},
    {"question": "Vous voulez partager votre écran avec un proche pour qu'il vous aide :", "options": ["Utiliser la fonction \"Partager l'écran\" de l'outil de visioconférence", "Pointer la caméra vers l'écran", "Faire une photo de l'écran à chaque fois", "Imprimer la page"], "correct": 0},
    {"question": "Vous installez une nouvelle application sur votre smartphone (depuis le magasin officiel) :", "options": ["Vérifier les avis, la note, le nombre de téléchargements avant d'installer", "Installer tout ce qui apparaît", "Donner vos coordonnées bancaires sans réfléchir", "Installer seulement si le logo est joli"], "correct": 0},
    {"question": "Vous avez beaucoup d'e-mails. Pour gagner du temps :", "options": ["Utiliser les dossiers, les filtres ou les étiquettes pour classer", "Tout laisser dans la boîte de réception", "Supprimer tous les e-mails sans les lire", "N'ouvrir plus jamais la messagerie"], "correct": 0},
    {"question": "Sur un traitement de texte, vous voulez mettre un titre en gras :", "options": ["Sélectionner le texte et cliquer sur le bouton \"G\" ou utiliser le menu \"Gras\"", "Appuyer plus fort sur le clavier", "Taper le mot en majuscule uniquement", "Éteindre l'ordinateur"], "correct": 0},
    {"question": "Vous devez envoyer un document en PDF plutôt qu'en format modifiable :", "options": ["Exporter ou enregistrer le document en PDF avant de l'envoyer", "Envoyer le document tel quel, sans rien vérifier", "Prendre une photo de l'écran", "Imprimer le document"], "correct": 0},
    {"question": "Vous voulez rechercher une ancienne facture dans votre ordinateur :", "options": ["Utiliser la fonction de recherche du système (nom de fichier ou mot-clé)", "Ouvrir tous les fichiers un par un", "Tout imprimer", "Supprimer des dossiers au hasard"], "correct": 0},
    {"question": "Vous voyez un message \"espace de stockage presque plein\" sur votre téléphone :", "options": ["Supprimer des fichiers inutiles (photos, vidéos, applis non utilisées) après les avoir sauvegardés", "Ignorer le message", "Éteindre le téléphone", "Supprimer tous vos contacts"], "correct": 0},
    {"question": "Vous utilisez un mot de passe pour un site important. Quel comportement est le plus sûr ?", "options": ["Ne pas le noter en clair, utiliser un carnet discret ou un gestionnaire, et ne pas le partager", "Le donner à vos proches", "Le mettre sur un post-it sur l'écran", "Utiliser \"azerty\" partout"], "correct": 0},
    {"question": "Vous recevez un SMS qui prétend venir d'un service de colis avec un lien bizarre :", "options": ["Se méfier, ne pas cliquer, vérifier directement sur le site ou l'application officielle", "Cliquer et donner ses informations", "Répondre avec vos coordonnées bancaires", "Transférer à tous vos contacts"], "correct": 0},
    {"question": "Pour limiter les risques sur Internet, on peut :", "options": ["Mettre à jour régulièrement ses appareils et logiciels", "Désactiver toutes les mises à jour", "Utiliser toujours le même mot de passe", "Cliquer sur toutes les publicités"], "correct": 0},
    {"question": "Vous utilisez un service de stockage en ligne (cloud). Quel est l'avantage principal ?", "options": ["Accéder à vos fichiers depuis plusieurs appareils, avec une connexion Internet", "Ne plus jamais sauvegarder", "Rendre vos fichiers publics automatiquement", "Augmenter le poids de vos fichiers"], "correct": 0},
    {"question": "Votre ordinateur est très lent au démarrage :", "options": ["Vérifier les programmes qui se lancent au démarrage et en désactiver certains si nécessaire", "Appuyer très fort sur les touches", "Éteindre et rallumer en boucle", "Supprimer tous vos documents"], "correct": 0},
    {"question": "Vous voulez vérifier que l'expéditeur d'un e-mail est bien la personne ou l'organisme indiqué :", "options": ["Regarder attentivement l'adresse e-mail complète, pas seulement le nom affiché", "Se fier uniquement au logo", "Se fier à l'objet du message", "Ne jamais vérifier"], "correct": 0},
    {"question": "Vous devez remplir un formulaire en ligne et joindre un justificatif de domicile :", "options": ["Préparer le fichier (scan ou photo lisible) et le joindre dans la zone prévue", "Écrire \"je n'ai pas de justificatif\"", "Envoyer un texte au hasard", "Envoyer une photo de vacances"], "correct": 0},
    {"question": "Pour se déconnecter correctement d'un site (ex : banque, service administratif) :", "options": ["Cliquer sur \"Déconnexion\" ou \"Se déconnecter\"", "Fermer juste l'onglet", "Éteindre l'écran seulement", "Débrancher la box"], "correct": 0},
    {"question": "Vous devez participer à un rendez-vous en visioconférence médical :", "options": ["Vérifier l'heure, le lien, la connexion Internet, le son et la caméra à l'avance", "Attendre l'heure sans rien préparer", "Ne pas lire les consignes", "Essayer de se connecter avec un lien d'un vieux e-mail"], "correct": 0},
    {"question": "Vous recevez plusieurs notifications sur votre smartphone :", "options": ["Les ouvrir quand on a le temps, désactiver celles qui sont inutiles dans les paramètres", "Tout ignorer à vie", "Cliquer sur tout sans lire", "Éteindre le téléphone"], "correct": 0},
    {"question": "Vous changez de téléphone et voulez garder vos contacts :", "options": ["Utiliser une sauvegarde (compte, copie carte SIM, export/import des contacts)", "Tout retaper à la main sans sauvegarde", "Tout perdre", "Noter les numéros sur un post-it seulement"], "correct": 0},
    {"question": "Vous voulez faire une capture d'écran (screenshot) sur ordinateur :", "options": ["Utiliser la touche ou l'outil de capture fourni par le système", "Prendre une photo de l'écran avec un autre appareil uniquement", "Imprimer l'écran", "Secouer la souris"], "correct": 0},
    {"question": "Vous remarquez que le contenu d'un e-mail est dans une langue que vous ne comprenez pas, avec un lien suspect :", "options": ["Ne pas cliquer, supprimer le message", "Cliquer pour essayer de comprendre", "Répondre avec vos données personnelles", "Le transférer à tous"], "correct": 0},
    {"question": "Pour mettre à jour une application sur smartphone :", "options": ["Passer par le magasin officiel (Play Store, App Store) et lancer les mises à jour", "Télécharger depuis un site inconnu", "Cliquer sur n'importe quel lien dans un SMS", "Appuyer plus fort sur l'icône"], "correct": 0},
    {"question": "Vous utilisez régulièrement un service en ligne (banque, santé, retraite). Pour y accéder plus facilement et en sécurité :", "options": ["Créer un favori dans le navigateur pour éviter les faux liens", "Cliquer sur tous les liens reçus par SMS", "Taper une adresse approximative", "Passer par n'importe quel moteur de recherche sans vérifier"], "correct": 0},
    {"question": "Vous devez modifier une photo (recadrer, luminosité) avant de l'envoyer :", "options": ["Utiliser une application de retouche photo simple sur smartphone ou ordinateur", "L'envoyer telle quelle sans regarder", "L'imprimer et la redessiner", "La supprimer"], "correct": 0},
    {"question": "Globalement, en cas de doute devant un message, une demande ou un site Internet :", "options": ["Prendre le temps de vérifier, demander conseil, ne pas se précipiter", "Cliquer le plus vite possible", "Donner immédiatement ses codes", "Tout fermer sans réfléchir ni demander d'aide"], "correct": 0}
]

async def create_tests():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔄 Création des tests Informatique débutant...")
    
    # T1 - Test de positionnement
    t1_template = {
        "id": "informatique_debutant_t1",
        "name": "T1 – Test de positionnement pratique informatique – Seniors débutants",
        "parcours": "Informatique débutant",
        "type": "positionnement",
        "questions": T1_QUESTIONS
    }
    
    # T2 - Test à mi-parcours
    t2_template = {
        "id": "informatique_debutant_t2",
        "name": "T2 – Test à mi-parcours pratique informatique – Seniors",
        "parcours": "Informatique débutant",
        "type": "mi-parcours",
        "questions": T2_QUESTIONS
    }
    
    # T3 - Test de fin de parcours
    t3_template = {
        "id": "informatique_debutant_t3",
        "name": "T3 – Test de fin de parcours pratique informatique – Seniors",
        "parcours": "Informatique débutant",
        "type": "fin",
        "questions": T3_QUESTIONS
    }
    
    # Supprimer les anciens templates si existants
    await db.quiz_templates.delete_many({"parcours": "Informatique débutant"})
    
    # Insérer les nouveaux templates
    await db.quiz_templates.insert_one(t1_template)
    await db.quiz_templates.insert_one(t2_template)
    await db.quiz_templates.insert_one(t3_template)
    
    print(f"✅ T1 créé : {len(T1_QUESTIONS)} questions")
    print(f"✅ T2 créé : {len(T2_QUESTIONS)} questions")
    print(f"✅ T3 créé : {len(T3_QUESTIONS)} questions")
    print(f"✅ Tests pour 'Informatique débutant' créés avec succès !")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_tests())
