# TerciForm - Plateforme Éducative

## Énoncé du problème original
Plateforme de gestion de formation pour TerciForm avec suivi des élèves, gestion des séances, facturation, questionnaires qualité (Qualiopi), et administration des formateurs.

## Personas utilisateurs
- **Administrateur/Professeur** : Gestion complète des élèves, séances, formateurs, clients, rapports qualité
- **Élève** : Accès au portail, émargement, questionnaires, ressources pédagogiques
- **Gestionnaire** : Accès filtré aux données de son centre (séances, élèves, formateurs)

## Exigences principales

### Fonctionnalités implémentées
- [x] Authentification JWT (admin/élève/gestionnaire)
- [x] Gestion des élèves (CRUD, archivage)
- [x] Gestion des séances avec émargement
- [x] Planning interactif avec filtres par centre
- [x] Facturation et export PDF
- [x] Questionnaires qualité Q1/Q2/Q3
- [x] Bilan des Tests (T1/T2/T3)
- [x] Bilan Qualité avec rapports
- [x] **Gestion des Formateurs** (13/01/2026)
- [x] **CRM Clients** (17/01/2026) - CRUD complet avec photos
- [x] **Portail Gestionnaire** (17/01/2026) - Dashboard multi-tenant
- [x] Notifications par email (Resend)
- [x] Visioconférence Jitsi Meet

### Stack technique
- **Backend** : FastAPI + Python 3.11
- **Frontend** : React + TailwindCSS + shadcn/ui
- **Base de données** : MongoDB
- **Emails** : Gmail SMTP / Resend

## Changelog

### 17 Janvier 2026 (mise à jour)
- **AMÉLIORATION MAJEURE** : Dashboard Gestionnaire complet
  - SÉANCES : Affichage des séances de production en lecture seule (stats, émargements, détails)
  - ÉLÈVES : CRUD complet (création, modification, suppression, recherche, historique, planning)
  - ÉLÈVES ARCHIVÉS : Accès aux élèves historisés avec restauration
  - FORMATEURS : Vue identique à production sans modification (planning accessible)
  - Endpoints API gestionnaire étendus : archived-students, CRUD students, archive/restore

- **AJOUT** : Système CRM Clients complet
  - API CRUD `/api/clients` (GET, POST, PUT, DELETE)
  - Upload photo logo client
  - Création automatique comptes gestionnaire/responsable
  - Email de bienvenue avec mot de passe
  - UI unifiée avec les autres onglets

- **AJOUT** : Portail Gestionnaire Multi-tenant
  - Nouveau rôle `gestionnaire` dans le système d'authentification
  - Dashboard dédié `/gestionnaire` avec 3 onglets :
    - SÉANCES : Planning mensuel filtré par client
    - ÉLÈVES : Liste des élèves du centre
    - FORMATEURS : Cartes des formateurs
  - Endpoints filtrés : `/api/gestionnaire/sessions`, `/students`, `/formateurs`, `/client`
  - Background couleur dynamique selon l'onglet actif

- **FIX** : Bug "Maximum update depth exceeded" dans GestionnaireDashboard.js
  - Cause : useEffect avec mauvaises dépendances causant une boucle infinie
  - Solution : Utilisation des props (user, onLogout) depuis App.js

- **FIX** : Photos clients/formateurs non affichées
  - Cause : Proxy bloquant les fichiers statiques
  - Solution : Endpoints API dédiés `/api/clients/{id}/photo` et `/api/formateurs/{id}/photo`

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
- [ ] Historique client complet avec logs d'activité
- [ ] Onglet "Facturation" dans le dialog Actions client
- [ ] Notifications SMS (nécessite choix du provider)
- [ ] Refactoring TeacherDashboard.js (>6000 lignes)
- [ ] Refactoring server.py (fichier monolithique)
- [ ] Test email demande de salle

### P2 - Normal
- [ ] Upload/téléchargement ressources fichiers
- [ ] Mémoire des derniers templates utilisés
- [ ] Analyse pédagogique ParcoursEleveModal

### P3 - Amélioration
- [ ] Interface CRUD templates quiz
- [ ] Optimisation performances

## Credentials de test
- Admin : `terciform@gmail.com` / `Geldwen1982*+`
- Gestionnaire : `gestionnaire-test@terciform.com` / `TestGestionnaire2026!`
- Élève : `espoirfinition@gmail.com` / `ghis456`

## Intégrations 3rd party
- **Jitsi Meet** : Visioconférence
- **Gmail SMTP** : Envoi emails
- **Resend** : Emails transactionnels

## Architecture

### Backend API Endpoints (Gestionnaire)
```
GET  /api/gestionnaire/client    - Infos du client associé
GET  /api/gestionnaire/students  - Élèves filtrés par client_id
GET  /api/gestionnaire/sessions  - Séances filtrées par client_id
GET  /api/gestionnaire/formateurs - Liste des formateurs
```

### Frontend Routes
```
/login          - Page de connexion
/teacher        - Dashboard Admin/Professeur
/gestionnaire   - Dashboard Gestionnaire (nouveau)
/student        - Dashboard Élève
```
