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

### Gestionnaire Dashboard (Simplified - Complete)
- ✅ Manager-specific view filtered by center/client_id
- ✅ Read-only view of students for their center
- ✅ Read-only view of sessions for their center
- ✅ Ability to create new students for their center
- ✅ UI harmonized with admin dashboard style
- ✅ **Multi-manager support** - multiple contacts per client
- ✅ **Absence marking** - round "A" button to mark students as absent
- ✅ **PDF export with signatures** - direct download with manual signature images
- ✅ **Multi-date room reservation** - select multiple dates in one request

### Recent Updates (Jan 2026)
- ✅ Added "absent" button (round) for each session in student history
- ✅ Toggle absent/present status with visual feedback (red for absent)
- ✅ Display "Élève absent de la séance" text in session history
- ✅ Updated PDF export to include absence status
- ✅ Updated PDF export to include actual signature images (not just "Signé")
- ✅ Fixed PDF direct download (no print dialog)
- ✅ Added `is_absent` and `absent_marked_at` fields to Session model
- ✅ Added `/api/sessions/{session_id}/mark-absent` endpoint

### Deployment (Fixed - Dec 2025)
- ✅ Added `/health` endpoint for Kubernetes readiness probes

## Pending Issues
| Issue | Priority | Status |
|-------|----------|--------|
| Remaining hours incorrect for some students | P1 | Not Started |
| User volker@zepartner.com cannot login | P1 | Not Started |
| Trainer documents disappear on edit | P2 | Not Started |
| Refactor TeacherDashboard.js | P2 | Not Started |
| Refactor server.py | P2 | Not Started |

## Upcoming Tasks
1. Investigate remaining hours calculation for "Isleme BAGOUZ"
2. Fix volker@zepartner.com login issue
3. Fix trainer documents disappearing on profile edit
4. "Fidélité" (Loyalty) program implementation
5. Refactor monolithic files

## Future/Backlog
- SMS notifications
- FILE type resource uploads/downloads
- Full CRUD interface for quiz templates
- Database query optimization (pagination)

## Technical Debt
- `TeacherDashboard.js`: >6000 lines, needs component extraction
- `server.py`: Monolith, needs router separation
- MongoDB queries with high limits (`.to_list(10000)`)

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
- **Jan 2026**: Added "absent" button functionality to mark students absent from sessions
- **Jan 2026**: Updated PDF export to show actual signature images instead of "Signé" text
- **Jan 2026**: Fixed PDF export to use direct download instead of print dialog
- **Jan 2026**: Added `is_absent` and `absent_marked_at` fields to Session model
- **Dec 2025**: Added "Sorties de parcours" collapsible banner in Students tab
- **Dec 2025**: Added year filter and name search for course completions
- **Dec 2025**: Added formateur assignment when creating a client
- **Dec 2025**: Multi-manager support for clients
- **Dec 2025**: Multi-date room reservation feature
- **Dec 2025**: Enhanced GestionnaireDashboard with colored backgrounds
- **Dec 2025**: Fixed deployment issue - added `/health` endpoint
