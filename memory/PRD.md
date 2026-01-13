# Terciform - Plateforme Éducative

## Description du Projet
Plateforme de gestion de formations professionnelles avec suivi des séances, des étudiants, des questionnaires de qualité et des formateurs. Conforme aux exigences Qualiopi.

## Fonctionnalités Principales

### ✅ Implémentées
1. **Authentification** - Login/Logout pour enseignants et étudiants
2. **Gestion des Séances** - CRUD complet, émargement, signatures
3. **Gestion des Étudiants** - Création, modification, archivage, historique
4. **Planning** - Vue calendrier avec filtres par centre
5. **Facturation** - Suivi des heures et facturation
6. **Bilan Qualité** - Rapports Q1/Q2/Q3 par parcours
7. **Bilan Tests** - Rapports T1/T2/T3 avec statistiques
8. **Questionnaires** - Système de questionnaires pour les étudiants
9. **Notifications Email** - Templates Terciform standardisés
10. **Gestion des Formateurs** (✅ NOUVEAU - 13 Jan 2026)
    - CRUD complet (GET, POST, PUT, DELETE /api/formateurs)
    - Upload de fichiers (photo, CV, diplômes)
    - Fiches identifiantes avec toutes les informations
    - Dialog de création avec validation

### 🔴 À Corriger (Bugs Critiques)
1. **Email de bienvenue** - Le mot de passe n'est pas inclus dans l'email
2. **Q2 English Data** - Les soumissions Q2 Anglais ne s'affichent pas correctement dans Bilan Qualité
3. **Filtre Planning en Production** - Nécessite script de correction de données `organism`
4. **Emails automatiques d'émargement** - Ne s'envoient pas de manière fiable

### 🟡 À Venir (P2-P3)
1. Refactoriser `TeacherDashboard.js` (fichier trop volumineux)
2. Intégration SMS
3. Analyse pédagogique complète
4. Dropdowns de tests dynamiques

### 🟢 Backlog (P4+)
1. Upload/téléchargement de ressources fichiers
2. Fonction "mémoire" pour les templates
3. Interface CRUD pour templates de quiz

## Architecture Technique

### Backend (FastAPI)
- `/app/backend/server.py` - API principale
- `/app/backend/check_attendance.py` - Service d'émargement automatique
- `/app/backend/static/formateurs/` - Fichiers uploadés des formateurs

### Frontend (React)
- `/app/frontend/src/pages/TeacherDashboard.js` - Dashboard principal
- `/app/frontend/src/components/PlanningView.js` - Vue planning
- `/app/frontend/src/components/BillingView.js` - Vue facturation

### Base de Données (MongoDB)
Collections principales:
- `users` - Enseignants et étudiants
- `sessions` - Séances de formation
- `formateurs` - Formateurs (NOUVEAU)
- `questionnaires` - Soumissions de questionnaires
- `student_activities` - Historique des actions

## Identifiants de Test
- **Admin/Teacher**: terciform@gmail.com / Geldwen1982*+
- **Étudiant**: espoirfinition@gmail.com / ghis456

## Changelog Récent

### 13 Janvier 2026
- ✅ Implémentation complète de la gestion des formateurs
  - Backend: 5 endpoints CRUD avec support multipart/form-data
  - Frontend: Dialog de création, fiches identifiantes
  - Tests: 13 tests automatisés passés (100%)
