# TerciForm - Educational Platform PRD

## Original Problem Statement
Build a comprehensive educational platform called "TerciForm" with:
- CRM system for managing clients
- Multi-tenant "Gestionnaire" (Client Manager) portal
- Admin dashboard for teachers/trainers
- Student dashboard with document signing, tests, and pedagogical resources

## Architecture
- **Frontend**: React with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

## What's Been Implemented

### Core Features (Complete)
- User authentication (JWT-based)
- Admin/Teacher dashboard (`TeacherDashboard.js`)
- Student management (CRUD)
- Session scheduling and management
- Client (organization) management
- Formateur (trainer) management
- Email notifications via Gmail SMTP
- Video conferencing integration (Jitsi Meet)
- Automatic session reminders (15 min before)
- Quality reports with AI analysis
- PDF generation for student records
- Quiz/questionnaire system
- Meeting Scheduling with Jitsi
- Gestionnaire Dashboard (multi-manager, absence marking, PDF export)
- Client Dashboard (société type)
- Professional PDF branding (logo, footer, SIRET/NDA)
- Pedagogical resources lock/unlock (Excel + Anglais)
- Programme/Contrat de formation with electronic signature
- Bulk teacher signature utility
- Grammar resources for Anglais students
- Interactive Vocabulary Challenge + Extra Video
- Emergent Object Store integration (boto3)

### Recent Updates (April 2026)
- **Welcome email updated** — New professional content with document list, credentials block, and TerciForm footer with SIRET/NDA
- **Hourly rate 0€ unblocked** — Session creation/editing now accepts 0€ as valid rate, quick 0€ button added alongside 20€/40€
- **Excel-specific documents** — "Programme de formation Excel TerciForm" and "Fiche produit formation Excel TerciForm" added to student dashboard (Excel parcours only)
- **Livret d'accueil V2** — Updated file for all parcours
- New endpoints: `GET /api/documents/programme-excel`, `GET /api/documents/fiche-produit-excel`

## Pending Issues
| Issue | Priority | Status |
|-------|----------|--------|
| Trainer documents disappear on edit | P2 | Not Started |
| User volker@zepartner.com cannot login | P3 | Not Started |
| Bilan Qualité "Informatique" data missing | P3 | Not Started |
| Refactor server.py (>17000 lines) | P0 | Not Started |
| Refactor TeacherDashboard.js (>8000 lines) | P0 | Not Started |

## Upcoming Tasks
- Complete Object Store migration (update server.py to serve files from S3, delete local heavy files)
- Optimize vocabulary_challenge.html (4.1MB → separate inline data)

## Future Tasks (Backlog)
- P1: Billing/Facturation module
- P2: Automatic end-of-training certificate generation
- P3: Loyalty program
- P4: SMS notifications
- P5: Dynamic FILE type resource uploads

## Key Files
- `/app/backend/server.py` - Main backend (MONOLITH >17000 lines)
- `/app/backend/object_store.py` - Emergent Object Store wrapper
- `/app/frontend/src/pages/TeacherDashboard.js` - Admin dashboard (MONOLITH >8000 lines)
- `/app/frontend/src/pages/StudentDashboard.js` - Student dashboard
- `/app/frontend/src/pages/GestionnaireDashboard.js` - Manager dashboard
- `/app/frontend/src/pages/ClientDashboard.js` - Client dashboard
- `/app/frontend/src/components/BulkTeacherSign.js` - Bulk signature utility
- `/app/frontend/src/components/GrammaireAnglais.js` - Grammar resources

## Test Credentials
See `/app/memory/test_credentials.md`

## 3rd Party Integrations
- Jitsi Meet (video conferencing)
- Gmail SMTP (transactional emails)
- Emergent Object Store (S3 via boto3)
- jsPDF / jsPDF-AutoTable (client-side PDF)
