"""
Test de bout en bout des flux principaux de TerciLog v2, sur une base MongoDB simulée
(mongomock-motor) puisque le vrai cluster Atlas n'est pas joignable depuis cet environnement.
Couvre : inscription formatrice, création élève, planning, document à signer (+ signature +
certificat), ressource (+ consultation), export Qualiopi.
"""
import pytest


@pytest.mark.asyncio
async def test_full_flow(app_client):
    client = app_client

    # 1) Créer le compte formatrice
    res = await client.post("/api/auth/register", json={
        "name": "Jo Ghizzo", "email": "jo@example.com", "password": "SuperSecret123!", "role": "teacher"
    })
    assert res.status_code == 200, res.text

    # 2) Login formatrice
    res = await client.post("/api/auth/login", json={"email": "jo@example.com", "password": "SuperSecret123!"})
    assert res.status_code == 200, res.text
    teacher_token = res.json()["access_token"]
    theaders = {"Authorization": f"Bearer {teacher_token}"}

    # 3) Créer un élève (déclenche un email de bienvenue en mode dev -> no-op silencieux)
    res = await client.post("/api/students", json={
        "name": "Élève Test", "email": "eleve@example.com", "password": "EleveSecret123!",
        "role": "student", "company": "ACME SARL", "parcours": "Bureautique"
    }, headers=theaders)
    assert res.status_code == 200, res.text
    student_id = res.json()["id"]

    # 4) Login élève
    res = await client.post("/api/auth/login", json={"email": "eleve@example.com", "password": "EleveSecret123!"})
    assert res.status_code == 200, res.text
    student_token = res.json()["access_token"]
    sheaders = {"Authorization": f"Bearer {student_token}"}

    # 5) Créer un événement de planning (séance)
    res = await client.post("/api/planning", json={
        "type": "session", "title": "Séance Bureautique #1", "event_date": "2026-09-01",
        "start_time": "09:00:00", "end_time": "11:00:00", "student_id": student_id,
        "modality": "presentiel",
    }, headers=theaders)
    assert res.status_code == 200, res.text
    event_id = res.json()["id"]

    # 6) L'élève voit bien son planning
    res = await client.get("/api/planning", headers=sheaders)
    assert res.status_code == 200
    assert len(res.json()) == 1

    # 7) Créer un document à signer (émargement), assigné à l'élève
    res = await client.post("/api/documents", data={
        "title": "Émargement séance 1", "category": "emargement",
        "student_ids": student_id, "planning_event_id": event_id,
    }, headers=theaders)
    assert res.status_code == 200, res.text
    document_id = res.json()["id"]

    # 8) L'élève voit le document assigné
    res = await client.get("/api/documents", headers=sheaders)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["assignments"][0]["status"] == "sent"

    # 9) L'élève signe le document
    fake_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    res = await client.post(f"/api/documents/{document_id}/sign", json={
        "signature_data": fake_signature,
    }, headers=sheaders)
    assert res.status_code == 200, res.text

    # 10) Le certificat de signature se génère (PDF)
    res = await client.get(f"/api/documents/{document_id}/certificate?student_id={student_id}", headers=theaders)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 500  # un vrai PDF, pas une réponse vide

    # 11) Créer une ressource (consultation seule, pas de signature)
    res = await client.post("/api/resources", data={
        "title": "Support de cours - Module 1", "student_ids": student_id,
    }, headers=theaders)
    assert res.status_code == 200, res.text
    resource_id = res.json()["id"]

    res = await client.get("/api/resources", headers=sheaders)
    assert res.status_code == 200
    assert len(res.json()) == 1

    # 12) Export Qualiopi par élève -> PDF valide
    res = await client.get(f"/api/export/qualiopi/student/{student_id}", headers=theaders)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 500

    # 13) Export Qualiopi par société -> PDF valide
    res = await client.get("/api/export/qualiopi/company/ACME SARL", headers=theaders)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"

    # 14) Un élève ne peut pas accéder aux routes réservées à la formatrice
    res = await client.get("/api/students", headers=sheaders)
    assert res.status_code == 403

    # 15) Un élève ne peut pas signer un document qui n'est pas le sien
    res = await client.post("/api/students", json={
        "name": "Autre Élève", "email": "autre@example.com", "password": "AutreSecret123!",
        "role": "student",
    }, headers=theaders)
    assert res.status_code == 200
    res = await client.post("/api/auth/login", json={"email": "autre@example.com", "password": "AutreSecret123!"})
    other_token = res.json()["access_token"]
    res = await client.post(f"/api/documents/{document_id}/sign", json={"signature_data": fake_signature},
                             headers={"Authorization": f"Bearer {other_token}"})
    assert res.status_code == 403
