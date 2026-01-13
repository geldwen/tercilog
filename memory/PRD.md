# TerciForm - Plateforme Éducative

## Énoncé du problème original
Plateforme de gestion de formation pour TerciForm avec suivi des élèves, gestion des séances, facturation, questionnaires qualité (Qualiopi), et administration des formateurs.

## Personas utilisateurs
- **Administrateur/Professeur** : Gestion complète des élèves, séances, formateurs, rapports qualité
- **Élève** : Accès au portail, émargement, questionnaires, ressources pédagogiques

## Exigences principales

### Fonctionnalités implémentées
- [x] Authentification JWT (admin/élève)
- [x] Gestion des élèves (CRUD, archivage)
- [x] Gestion des séances avec émargement
- [x] Planning interactif avec filtres par centre
- [x] Facturation et export PDF
- [x] Questionnaires qualité Q1/Q2/Q3
- [x] Bilan des Tests (T1/T2/T3)
- [x] Bilan Qualité avec rapports
- [x] **Gestion des Formateurs** (13/01/2026)
- [x] Notifications par email (Resend)
- [x] Visioconférence Jitsi Meet

### Stack technique
- **Backend** : FastAPI + Python 3.11
- **Frontend** : React + TailwindCSS + shadcn/ui
- **Base de données** : MongoDB
- **Emails** : Gmail SMTP / Resend

## Changelog

### 13 Janvier 2026
- **AJOUT** : Système complet de gestion des Formateurs
  - API CRUD `/api/formateurs` (GET, POST, PATCH, DELETE)
  - Upload de fichiers (photo, CV, diplômes)
  - Modal de création avec tous les champs
  - Fiches formateurs avec affichage détaillé
  - Tests automatisés (9/9 passés)

### Sessions précédentes
- Archivage des élèves ("Sorties de parcours")
- Refonte du "Bilan des Tests"
- Filtres planning par centre
- Corrections timezone Europe/Paris
- Standardisation templates email Terciform

## Backlog priorisé

### P0 - Critique
- Aucun item critique en attente

### P1 - Important
- [ ] Notifications SMS (nécessite choix du provider)
- [ ] Refactoring TeacherDashboard.js (>4500 lignes)
- [ ] Intégration rapport analyse pédagogique

### P2 - Normal
- [ ] Upload/téléchargement ressources fichiers
- [ ] Mémoire des derniers templates utilisés

### P3 - Amélioration
- [ ] Interface CRUD templates quiz
- [ ] Optimisation performances

## Credentials de test
- Admin : `terciform@gmail.com` / `Geldwen1982*+`
- Élève : `espoirfinition@gmail.com` / `ghis456`

## Intégrations 3rd party
- **Jitsi Meet** : Visioconférence
- **Gmail SMTP** : Envoi emails
- **Resend** : Emails transactionnels
