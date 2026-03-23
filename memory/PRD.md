# TerciForm - Educational Platform PRD

## Original Problem Statement
Build a comprehensive educational platform called "TerciForm" with:
- CRM system for managing clients
- Multi-tenant "Gestionnaire" (Client Manager) portal
- Admin dashboard for teachers/trainers

## Architecture
- **Frontend**: React with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

## What's Been Implemented

### Core Features (Complete)
- ✅ User authentication (JWT-based)
- ✅ Admin/Teacher dashboard (`TeacherDashboard.js`)
- ✅ Student management (CRUD)
- ✅ Session scheduling and management
- ✅ Client (organization) management
- ✅ Formateur (trainer) management
- ✅ Email notifications via Gmail SMTP
- ✅ Video conferencing integration (Jitsi Meet)
- ✅ Automatic session reminders (15 min before)
- ✅ Quality reports with AI analysis
- ✅ PDF generation for student records
- ✅ Quiz/questionnaire system
- ✅ **Meeting Scheduling with Jitsi** (NEW - March 2026)
  - Admin can create/modify/delete meetings
  - Multi-client invitations
  - Clients receive email invitations
  - Accept/Refuse meeting responses
  - Automatic 15-minute reminders
  - Jitsi room URLs auto-generated

### Gestionnaire Dashboard (Complete)
- ✅ Manager-specific view filtered by center/client_id
- ✅ Read-only view of students for their center
- ✅ Read-only view of sessions for their center
- ✅ Ability to create new students for their center
- ✅ UI harmonized with admin dashboard style
- ✅ **Multi-manager support** - multiple contacts per client
- ✅ **Absence marking** - round "A" button to mark students as absent
- ✅ **PDF export with signatures** - direct download with manual signature images
- ✅ **PDF export includes upcoming sessions** - shows both completed and scheduled sessions
- ✅ **Multi-date room reservation** - select multiple dates in one request
- ✅ **Dynamic remaining hours calculation** - total_hours minus signed session hours
- ✅ **Session search module** - search by student name, month, and hour
- ✅ **Simplified sessions view** - today's sessions + 2 weeks upcoming only
- ✅ **Purple round PDF button** - "Télécharger planning élève PDF"
- ✅ **Exit filters** - Years 2025, 2026, 2027 and all 12 months

### Recent Updates (Jan 2026)
- ✅ Added "absent" button (round) for each session in student history
- ✅ Toggle absent/present status with visual feedback (red for absent)
- ✅ Display "Élève absent de la séance" text in session history
- ✅ Updated PDF export to include absence status
- ✅ Updated PDF export to include actual signature images (not just "Signé")
- ✅ Fixed PDF direct download (no print dialog)
- ✅ Added `is_absent` and `absent_marked_at` fields to Session model
- ✅ Added `/api/sessions/{session_id}/mark-absent` endpoint
- ✅ Added `import base64` to fix signature rendering in backend PDF
- ✅ Redesigned SÉANCES tab with search module and 2-week view
- ✅ Changed PDF button to purple round button
- ✅ Fixed exit filters to show 2025, 2026, 2027 and all months
- ✅ Dynamic calculation of remaining hours (total - signed)

## Pending Issues
| Issue | Priority | Status |
|-------|----------|--------|
| Production deployment not serving latest frontend build | P0 | BLOCKER - Contact Emergent support |
| Djibril Kante should be historized | P1 | Check production data |
| Isleme Baghouz shows wrong hours | P1 | Check production data |
| User volker@zepartner.com cannot login | P2 | Not Started |
| Trainer documents disappear on edit | P2 | Not Started |
| Refactor TeacherDashboard.js (>7000 lines) | P2 | Not Started |
| Refactor server.py (>14000 lines) | P2 | Not Started |
| Jitsi instability on public server | P3 | Reverted to meet.jit.si |

## Key Files
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/pages/TeacherDashboard.js` - Admin dashboard
- `/app/frontend/src/pages/GestionnaireDashboard.js` - Manager dashboard (organisme_formation)
- `/app/frontend/src/pages/ClientDashboard.js` - Client dashboard (société)
- `/app/frontend/src/components/MeetingManager.js` - Admin meeting management component **NEW**
- `/app/frontend/src/components/MeetingTab.js` - Client/Manager meeting view component **NEW**
- `/app/frontend/src/App.js` - Router configuration (with GestionnaireWrapper)

## Test Credentials
- **Admin**: `terciform@gmail.com` / `Geldwen1982*+`
- **Manager (Zepartner)**: `mounarezgui.pro@gmail.com` / `zepart648`
- **Client (societe)**: `gestionnaire@testsociete.com` / `TestSociete2024!`

## 3rd Party Integrations
- Jitsi Meet (video conferencing)
- Gmail SMTP (transactional emails)
- jsPDF / jsPDF-AutoTable (client-side PDF generation)

## Changelog
- **March 23, 2026**: Fixed critical Bilan Qualité issues for Informatique/Excel
  - Fixed questionnaire responses display: `answers` field now properly extracted and displayed in QuestionnaireModal
  - Added "Progression Moyenne" KPI banner showing: avg progression %, satisfaction %, star rating, and completion count
  - Backend `detect_need_in_questionnaire` now correctly processes data in `answers` field
  - Moved "Réunions" from main admin tabs to client card badges (with Salles, Matériel, Supports, etc.)
- **March 10, 2026**: Added signature buttons for past sessions without signatures
  - Past sessions now show "Envoyer émargement élève" (orange) button if student signature is missing
  - Past sessions now show "Émargement prof" (violet) button if teacher signature is missing
  - Allows recovery of missed signatures on historical sessions
- **March 5, 2026**: Fixed critical bug where session price (hourly_rate) was not saved
  - Bug was in `/sessions/{session_id}/times` endpoint - hourly_rate was calculated but not persisted to database
  - Also improved `/sessions/{session_id}` endpoint to recalculate duration_hours when times change
  - Both endpoints now correctly save hourly_rate, hourly_rate_source, duration_hours and amount
- **March 3, 2026**: Completed Meeting Scheduling Feature with Jitsi Integration
  - Added RÉUNIONS tab to TeacherDashboard (admin), GestionnaireDashboard, and ClientDashboard
  - Created MeetingManager.js - Admin UI for creating/modifying/deleting meetings
  - Created MeetingTab.js - Client/Manager UI for viewing and responding to invitations
  - Backend APIs: POST/GET/PUT/DELETE /api/meetings, POST /api/meetings/{id}/respond
  - Automatic Jitsi room URL generation
  - Email notifications on invitation and response
  - 15-minute reminder scheduler (apscheduler)
  - Fixed ClientDashboard tab value mismatch (eleves vs participants)
- **Feb 22, 2026**: Created `ClientDashboard.js` - new dashboard for "société" type clients
  - Renamed "élèves" to "participants" throughout the UI
  - Removed "DOCUMENTS" tab (not needed for sociétés)
  - Removed "Salles", "Organisation", "Accueil" from Échanges categories
  - Header shows "Espace Client" instead of "Espace Gestion"
- **Feb 22, 2026**: Added client type distinction in backend
  - Added `client_type` field to `/api/clients` POST endpoint (organisme_formation | societe)
  - `client_type` is stored in clients collection
- **Feb 22, 2026**: Added `GestionnaireWrapper` in App.js
  - Automatically routes "société" clients to ClientDashboard
  - Routes "organisme_formation" clients to GestionnaireDashboard
- **Feb 14, 2026**: Removed "Absent" button from student cards (Fiche élève) - now managed via checkboxes in daily sessions
- **Feb 14, 2026**: Removed "Attente élève/formateur" badges from Séances du jour - only show signatures when signed
- **Feb 14, 2026**: Added green checkbox (present) and red checkbox (absent) next to subject in Séances du jour
- **Feb 14, 2026**: Session list now shows only current date to end of month (e.g., Feb 14-28) - use search for past/future
- **Feb 14, 2026**: Past sessions (search results) show signatures, hide action buttons (Renvoyer/Modifier/Supprimer)
- **Feb 14, 2026**: Emargement buttons stacked vertically with full text "Émargement élève" / "Émargement professeur"
- **Feb 13, 2026**: Removed duplicate year/month filter banner above "Heures totales" (search module below is sufficient)
- **Feb 13, 2026**: Added email notification to managers when documents are uploaded (`send_document_notification_to_gestionnaires`)
- **Feb 13, 2026**: Added "DOCUMENTS" tab in manager dashboard to view/download all student documents
- **Feb 13, 2026**: Upcoming sessions simplified: removed emargement buttons/status, shows only "Renvoyer/Modifier/Supprimer" buttons
- **Feb 13, 2026**: Jitsi "Rejoindre la visio" button moved to "Séances du jour" header (allows joining all remote students at once)
- **Feb 13, 2026**: Session display: only show upcoming sessions and today - past sessions (including current month) are archived
- **Feb 13, 2026**: "Séances du jour" redesigned - buttons aligned right, more opaque colors (bg-orange-200, bg-purple-200)
- **Feb 13, 2026**: Added orange refresh button (RefreshCw icon) to "Heures restantes du mois" card
- **Feb 13, 2026**: Complete redesign of "Séances du jour" section with signature/timestamp display and pending status badges
- **Feb 13, 2026**: Integrated search module with filters: year, month, day, student name (replaces blue search button)
- **Feb 13, 2026**: Auto-archiving past sessions - only show upcoming and current month sessions by default
- **Feb 13, 2026**: Removed useless pen button from today's sessions
- **Feb 13, 2026**: Added direct "Émargement élève" and "Émargement professeur" buttons for today's sessions only
- **Feb 13, 2026**: Removed signing options from dropdown menu for today's sessions (available via direct buttons)
- **Feb 13, 2026**: Created `/api/teachers/relance-test` endpoint for test reminders
- **Feb 13, 2026**: Moved "Recalculer heures" button inside "Heures totales du mois" card
- **Feb 2026**: Excel course path created with 6 templates (T1, T2, T3, Q1, Q2, Q3)
- **Feb 2026**: "Init Excel" button added for production data seeding
- **Feb 2026**: Fixed session duration calculation bug
- **Jan 30, 2026**: Redesigned SÉANCES tab with search module and 2-week upcoming view
- **Jan 30, 2026**: Changed PDF button to purple round "Télécharger planning élève PDF"
- **Jan 30, 2026**: Fixed exit filters to show 2025-2027 and all months
- **Jan 30, 2026**: Dynamic calculation of remaining hours
- **Jan 30, 2026**: PDF export now includes upcoming/scheduled sessions
- **Jan 30, 2026**: Fixed signature images in PDF (added import base64)
- **Jan 2026**: Added "absent" button functionality
- **Dec 2025**: Multi-manager support for clients
