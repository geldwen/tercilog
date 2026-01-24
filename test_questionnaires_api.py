import requests
import json

# URL backend
API = "https://terciform-edu-1.preview.emergentagent.com/api"

# 1. Login professeur
print("🔐 Connexion professeur...")
login_response = requests.post(f"{API}/auth/login", json={
    "email": "prof@test.com",
    "password": "prof123"
})
token = login_response.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print("✅ Connecté\n")

# 2. ID de Toto
toto_id = "7db42079-64bc-45c0-b2c5-deea98af3f1f"

# 3. Tester les 3 endpoints
print("="*60)
print("TEST DES 3 QUESTIONNAIRES POUR TOTO")
print("="*60)

# Q1
print("\n📋 Q1 (formation-needs):")
r1 = requests.get(f"{API}/students/{toto_id}/formation-needs", headers=headers)
q1_data = r1.json()
print(f"   Existe: {q1_data.get('exists', False)}")
if q1_data.get('exists'):
    print(f"   Soumis: {q1_data['questionnaire'].get('submitted_at', 'N/A')[:19]}")

# Q2
print("\n📋 Q2 (mid-course):")
r2 = requests.get(f"{API}/students/{toto_id}/mid-course-questionnaire", headers=headers)
q2_data = r2.json()
print(f"   Existe: {q2_data.get('exists', False)}")
if q2_data.get('exists'):
    print(f"   Soumis: {q2_data['questionnaire'].get('submitted_at', 'N/A')[:19]}")

# Q3
print("\n📋 Q3 (end-course):")
r3 = requests.get(f"{API}/students/{toto_id}/end-course-questionnaire", headers=headers)
q3_data = r3.json()
print(f"   Existe: {q3_data.get('exists', False)}")
if q3_data.get('exists'):
    print(f"   Soumis: {q3_data['questionnaire'].get('submitted_at', 'N/A')[:19]}")

print("\n" + "="*60)
print(f"TOTAL: {sum([q1_data.get('exists', False), q2_data.get('exists', False), q3_data.get('exists', False)])} questionnaires")
print("="*60)
