# Performance Test Report - EduManage Backend API

## Test Summary
- **Application**: edumanage-396
- **Test Date**: 2026-02-09T22:12:29
- **Total Routes Tested**: 35 GET endpoints
- **Iterations per Route**: 10
- **Providers Tested**: preview, caddy, cloudflare

## Endpoints Tested

### Health & Authentication
1. **Health Check** (`/health`)
   - Preview: 15ms (min: 8ms, max: 63ms)
   - Caddy: 31ms (min: 17ms, max: 86ms)
   - Cloudflare: 30ms (min: 21ms, max: 39ms)

2. **Get Current User** (`/api/auth/me`)
   - Preview: 9ms (min: 6ms, max: 16ms)
   - Caddy: 30ms (min: 25ms, max: 39ms)
   - Cloudflare: 45ms (min: 17ms, max: 190ms)

### Student Management
3. **Get All Students** (`/api/students`)
   - Preview: 15ms (min: 5ms, max: 48ms)
   - Caddy: 34ms (min: 17ms, max: 79ms)
   - Cloudflare: 30ms (min: 21ms, max: 45ms)

### Questionnaires & Formation
4. **Get Formation Needs** (`/api/students/{student_id}/formation-needs`)
   - Preview: 21ms (min: 6ms, max: 48ms)
   - Caddy: 37ms (min: 17ms, max: 123ms)
   - Cloudflare: 55ms (min: 18ms, max: 211ms)

5. **Get Mid-Course Questionnaire** (`/api/students/{student_id}/mid-course-questionnaire`)
   - Preview: 15ms (min: 6ms, max: 47ms)
   - Caddy: 34ms (min: 17ms, max: 71ms)
   - Cloudflare: 30ms (min: 20ms, max: 42ms)

6. **Get End-Course Questionnaire** (`/api/students/{student_id}/end-course-questionnaire`)
   - Preview: 19ms (min: 6ms, max: 47ms)
   - Caddy: 29ms (min: 17ms, max: 53ms)
   - Cloudflare: 26ms (min: 18ms, max: 36ms)

### Resources & Tests
7. **Get Student Resources** (`/api/students/{student_id}/resources`)
   - Preview: 20ms (min: 5ms, max: 51ms)
   - Caddy: 27ms (min: 19ms, max: 35ms)
   - Cloudflare: 25ms (min: 17ms, max: 34ms)

8. **Get Student Tests** (`/api/students/{student_id}/tests`)
   - Preview: 21ms (min: 6ms, max: 49ms)
   - Caddy: 26ms (min: 20ms, max: 35ms)
   - Cloudflare: 27ms (min: 17ms, max: 34ms)

9. **Get All Tests** (`/api/tests/all`)
   - Preview: 16ms (min: 6ms, max: 48ms)
   - Caddy: 42ms (min: 25ms, max: 167ms)
   - Cloudflare: 51ms (min: 24ms, max: 203ms)

### Reports & Quality
10. **Get Magic Report** (`/api/students/{student_id}/magic-report`)
    - Preview: 11ms (min: 4ms, max: 48ms)
    - Caddy: 29ms (min: 19ms, max: 35ms)
    - Cloudflare: 28ms (min: 22ms, max: 33ms)

11. **Get Quality Report** (`/api/teachers/qualite-report`)
    - Preview: 25ms (min: 7ms, max: 53ms)
    - Caddy: 29ms (min: 19ms, max: 36ms)
    - Cloudflare: 24ms (min: 15ms, max: 37ms)

12. **Get Bilan Tests** (`/api/bilan-tests`)
    - Preview: 23ms (min: 5ms, max: 58ms)
    - Caddy: 31ms (min: 20ms, max: 39ms)
    - Cloudflare: 31ms (min: 22ms, max: 41ms)

### Sessions & Events
13. **Get Sessions** (`/api/sessions`)
    - Preview: 18ms (min: 4ms, max: 47ms)
    - Caddy: 28ms (min: 17ms, max: 42ms)
    - Cloudflare: 27ms (min: 18ms, max: 38ms)

14. **Get Sessions Stats** (`/api/sessions/stats`)
    - Preview: 46ms (min: 18ms, max: 51ms)
    - Caddy: 27ms (min: 16ms, max: 39ms)
    - Cloudflare: 27ms (min: 16ms, max: 37ms)

15. **Get Planning Events** (`/api/planning/events`)
    - Preview: 12ms (min: 6ms, max: 51ms)
    - Caddy: 39ms (min: 25ms, max: 81ms)
    - Cloudflare: 27ms (min: 18ms, max: 35ms)

### Feedback & Documents
16. **Get Student Feedback** (`/api/students/{student_id}/feedback`)
    - Preview: 23ms (min: 7ms, max: 54ms)
    - Caddy: 50ms (min: 18ms, max: 111ms)
    - Cloudflare: 33ms (min: 17ms, max: 71ms)

17. **Get Student Documents** (`/api/students/{student_id}/documents/{category}`)
    - Preview: 11ms (min: 5ms, max: 46ms)
    - Caddy: 30ms (min: 19ms, max: 36ms)
    - Cloudflare: 30ms (min: 23ms, max: 45ms)

### PDF & Downloads
18. **Get PDF Preview** (`/api/pdf/preview`)
    - Preview: 16ms (min: 6ms, max: 49ms)
    - Caddy: 51ms (min: 20ms, max: 202ms)
    - Cloudflare: 30ms (min: 20ms, max: 45ms)

19. **Get Planning PDF** (`/api/students/{student_id}/download-planning-pdf`)
    - Preview: 10ms (min: 4ms, max: 46ms)
    - Caddy: 42ms (min: 25ms, max: 140ms)
    - Cloudflare: 26ms (min: 20ms, max: 34ms)

### Staff & Clients
20. **Get Formateurs** (`/api/formateurs`)
    - Preview: 19ms (min: 4ms, max: 49ms)
    - Caddy: 29ms (min: 16ms, max: 44ms)
    - Cloudflare: 24ms (min: 14ms, max: 38ms)

21. **Get Formateur Details** (`/api/formateurs/{formateur_id}`)
    - Preview: 17ms (min: 6ms, max: 49ms)
    - Caddy: 29ms (min: 18ms, max: 35ms)
    - Cloudflare: 31ms (min: 23ms, max: 56ms)

22. **Get Clients** (`/api/clients`)
    - Preview: 47ms (min: 38ms, max: 50ms)
    - Caddy: 58ms (min: 20ms, max: 105ms)
    - Cloudflare: 39ms (min: 21ms, max: 118ms)

23. **Get Client Details** (`/api/clients/{client_id}`)
    - Preview: 14ms (min: 8ms, max: 50ms)
    - Caddy: 29ms (min: 18ms, max: 36ms)
    - Cloudflare: 31ms (min: 19ms, max: 44ms)

## Performance Analysis

### Key Findings

1. **Preview Environment Performance**:
   - Fastest average latency across most endpoints
   - Generally the most responsive for basic queries
   - Notable slower performance on some complex queries (e.g., Get Clients: 47ms)

2. **Caddy Provider Performance**:
   - Moderate latency, typically 25-40ms for standard endpoints
   - Higher variance in response times
   - Some endpoints show significant spikes (e.g., Get All Tests: up to 167ms)

3. **Cloudflare Provider Performance**:
   - Generally stable latency around 25-35ms
   - Lower variance on most endpoints
   - Some complex queries show higher latency (e.g., Get Formation Needs: 55ms avg)

### Slowest Endpoints (Average Latency)
1. Get Clients: 47-58ms
2. Get Sessions Stats: 46ms
3. Get Test Template: 28-46ms
4. Get All Tests: 16-51ms
5. Get Formation Needs: 21-55ms

### Fastest Endpoints (Average Latency)
1. Get Current User: 9-45ms (best on preview)
2. Get Magic Report: 11-28ms
3. Get Student Documents: 11-30ms
4. Get Planning PDF: 10-42ms
5. Health Check: 15-31ms

## Recommendations

1. **Optimization Targets**: The `/api/clients` endpoint shows the highest latency and should be reviewed for optimization
2. **Load Testing**: Consider implementing caching for frequently accessed endpoints like `/api/formation-needs` and `/api/tests/all`
3. **Provider Performance**: Monitor Caddy's performance as it shows higher variance in response times
4. **Database Optimization**: The Get All Tests endpoint shows significant variance, suggesting potential database optimization opportunities

## Complete Test Data
All test data has been submitted to the performance tracking system with the following metadata:
- App Name: edumanage-396
- App ID: f8a50cd8-f21c-4c9c-bc51-53058f427500
- Test Date: 2026-02-09T22:12:29
- Total API Calls: 1,050 (35 routes × 3 providers × 10 iterations)

