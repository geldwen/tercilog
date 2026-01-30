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
| Djibril Kante should be historized | P1 | Check production data |
| Isleme Baghouz shows wrong hours | P1 | Check production data |
| Trainer documents disappear on edit | P2 | Not Started |
| Refactor TeacherDashboard.js | P2 | Not Started |
| Refactor server.py | P2 | Not Started |

## Key Files
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/pages/TeacherDashboard.js` - Admin dashboard
- `/app/frontend/src/pages/GestionnaireDashboard.js` - Manager dashboard
- `/app/frontend/src/App.js` - Router configuration

## Test Credentials
- **Admin**: `terciform@gmail.com` / `Geldwen1982*+`
- **Manager (Zepartner)**: `mounarezgui.pro@gmail.com` / `zepart648`

## 3rd Party Integrations
- Jitsi Meet (video conferencing)
- Gmail SMTP (transactional emails)
- jsPDF / jsPDF-AutoTable (client-side PDF generation)

## Changelog
- **Jan 30, 2026**: Redesigned SÉANCES tab with search module and 2-week upcoming view
- **Jan 30, 2026**: Changed PDF button to purple round "Télécharger planning élève PDF"
- **Jan 30, 2026**: Fixed exit filters to show 2025-2027 and all months
- **Jan 30, 2026**: Dynamic calculation of remaining hours
- **Jan 30, 2026**: PDF export now includes upcoming/scheduled sessions
- **Jan 30, 2026**: Fixed signature images in PDF (added import base64)
- **Jan 2026**: Added "absent" button functionality
- **Dec 2025**: Multi-manager support for clients
