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

### Deployment (Fixed - Dec 2025)
- ✅ Added `/health` endpoint for Kubernetes readiness probes

## Pending Issues
| Issue | Priority | Status |
|-------|----------|--------|
| Test GestionnaireDashboard UI | P0 | Not Started |
| Communication tab implementation | P1 | Blocked (awaiting specs) |
| Refactor TeacherDashboard.js | P1 | Not Started |
| Refactor server.py | P1 | Not Started |
| Welcome email password verification | P2 | User verification pending |
| Q2 data mismatch in quality report | P2 | User verification pending |

## Upcoming Tasks
1. Implement "Communication" tab in manager dashboard
2. "Fidélité" (Loyalty) program implementation
3. Refactor monolithic files

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
- **Manager**: `ghizzo.formations@gmail.com` / `Ghizzo2026`

## 3rd Party Integrations
- Jitsi Meet (video conferencing)
- Gmail SMTP (transactional emails)

## Changelog
- **Dec 2025**: Redesigned GestionnaireDashboard with colored backgrounds (violet/green/orange/pink)
- **Dec 2025**: Replaced "Communication" tab with "Formateurs" tab showing trainers for the center
- **Dec 2025**: Added `/api/gestionnaire/formateurs` endpoint
- **Dec 2025**: Added "Fidélité" (Loyalty) tab placeholder to GestionnaireDashboard
- **Dec 2025**: Created test gestionnaire account (gestionnaire.test@terciform.com / Test2024!)
- **Dec 2025**: Fixed deployment issue - added `/health` endpoint
- **Dec 2025**: Rebuilt simplified GestionnaireDashboard from scratch
- **Dec 2025**: Fixed formateur email notification bug

## Test Credentials
- **Admin**: `terciform@gmail.com` / `Geldwen1982*+`
- **Manager (existing)**: `ghizzo.formations@gmail.com` / `Ghizzo2026`
- **Manager (test)**: `gestionnaire.test@terciform.com` / `Test2024!` (Centre: Iscod)
