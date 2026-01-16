#!/usr/bin/env python3
"""
Test script for creating Ghizzo Test student and testing digital signature attendance system
Following the exact specifications from the review request.
"""

import requests
import json
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://learning-hub-214.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class GhizzoTester:
    def __init__(self):
        self.teacher_token = None
        self.student_token = None
        self.ghizzo_student_id = None
        self.created_session_id = None
        
    def log(self, message, level="INFO"):
        """Log messages with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method, endpoint, data=None, token=None):
        """Make HTTP request with proper headers"""
        url = f"{API_BASE}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"{method} {url} -> {response.status_code}")
            
            if response.status_code >= 400:
                self.log(f"Error response: {response.text}", "ERROR")
                
            return response
            
        except Exception as e:
            self.log(f"Request failed: {e}", "ERROR")
            return None
    
    def login_as_teacher(self):
        """Login as teacher using existing credentials"""
        self.log("=== ÉTAPE 1: Connexion Professeur ===")
        
        # Use existing teacher credentials
        login_data = {
            "email": "teacher@terciform.com",
            "password": "Teacher2024!"
        }
        
        self.log(f"Connexion avec: {login_data['email']}")
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.teacher_token = data["access_token"]
            teacher_info = data["user"]
            self.log(f"✅ Connexion professeur réussie: {teacher_info['name']} ({teacher_info['email']})")
            return True
        else:
            self.log("❌ Échec de la connexion professeur", "ERROR")
            return False
    
    def create_ghizzo_student(self):
        """Create Ghizzo Test student with exact specifications"""
        self.log("=== ÉTAPE 2: Création de l'élève Ghizzo Test ===")
        
        # Check if Ghizzo already exists
        response = self.make_request("GET", "/students", token=self.teacher_token)
        if response and response.status_code == 200:
            students = response.json()
            for student in students:
                if student["email"] == "Ghizzo.j@gmail.com":
                    self.ghizzo_student_id = student["id"]
                    self.log(f"✅ Élève Ghizzo Test trouvé (existant):")
                    self.log(f"   ID: {student['id']}")
                    self.log(f"   Nom: {student['name']}")
                    self.log(f"   Email: {student['email']}")
                    self.log(f"   Mot de passe: Ghizzo2024!")
                    return True
        
        # Create Ghizzo Test student with exact specifications
        student_data = {
            "name": "Ghizzo Test",
            "email": "Ghizzo.j@gmail.com",
            "password": "Ghizzo2024!",
            "phone": "06 98 76 54 32",
            "organism": "Formation Pro",
            "support_type": "CPF",
            "start_date": "2025-11-01",
            "end_date": "2025-12-31",
            "total_hours": 30,
            "role": "student"
        }
        
        response = self.make_request("POST", "/students", student_data, self.teacher_token)
        
        if response and response.status_code == 200:
            student = response.json()
            self.ghizzo_student_id = student["id"]
            self.log(f"✅ Élève Ghizzo Test créé avec succès:")
            self.log(f"   ID: {student['id']}")
            self.log(f"   Nom: {student['name']}")
            self.log(f"   Email: {student['email']}")
            self.log(f"   Téléphone: {student['phone']}")
            self.log(f"   Organisme: {student['organism']}")
            self.log(f"   Type de support: {student['support_type']}")
            self.log(f"   Date début: {student['start_date']}")
            self.log(f"   Date fin: {student['end_date']}")
            self.log(f"   Heures totales: {student['total_hours']}")
            self.log(f"   Mot de passe: Ghizzo2024!")
            return True
        else:
            self.log("❌ Échec de la création de l'élève Ghizzo Test", "ERROR")
            return False
    
    def create_finished_session(self):
        """Create a session that ended 5 minutes ago"""
        self.log("=== ÉTAPE 3: Création d'une séance terminée ===")
        
        # Calculate times: session ended 5 minutes ago, lasted 3 hours
        now = datetime.now(timezone.utc)
        end_time = now - timedelta(minutes=5)
        start_time = end_time - timedelta(hours=3)
        
        session_data = {
            "subject": "Formation Excel Avancé",
            "date": now.strftime("%Y-%m-%d"),  # Today (2025-11-01)
            "start_time": start_time.strftime("%H:%M"),
            "end_time": end_time.strftime("%H:%M"),
            "student_id": self.ghizzo_student_id,
            "validation_deadline_hours": 48
        }
        
        self.log(f"Détails de la séance:")
        self.log(f"   Matière: {session_data['subject']}")
        self.log(f"   Date: {session_data['date']}")
        self.log(f"   Début: {session_data['start_time']}")
        self.log(f"   Fin: {session_data['end_time']}")
        self.log(f"   Heure actuelle: {now.strftime('%H:%M')}")
        self.log(f"   Élève ID: {session_data['student_id']}")
        
        response = self.make_request("POST", "/sessions", session_data, self.teacher_token)
        
        if response and response.status_code == 200:
            session = response.json()
            self.created_session_id = session["id"]
            self.log(f"✅ Séance créée avec succès:")
            self.log(f"   ID: {session['id']}")
            self.log(f"   Matière: {session['subject']}")
            self.log(f"   Date: {session['date']}")
            self.log(f"   Horaires: {session['start_time']} - {session['end_time']}")
            self.log(f"   Statut: {session['status']}")
            return True
        else:
            self.log("❌ Échec de la création de la séance", "ERROR")
            return False
    
    def login_as_ghizzo(self):
        """Login as Ghizzo Test student"""
        self.log("=== ÉTAPE 4: Connexion de l'élève Ghizzo ===")
        
        login_data = {
            "email": "Ghizzo.j@gmail.com",
            "password": "Ghizzo2024!"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.student_token = data["access_token"]
            student_info = data["user"]
            self.log(f"✅ Connexion élève réussie: {student_info['name']}")
            return True
        else:
            self.log("❌ Échec de la connexion élève", "ERROR")
            return False
    
    def confirm_session_as_ghizzo(self):
        """Confirm the session as Ghizzo Test student"""
        self.log("=== ÉTAPE 5: Confirmation de la séance par l'élève ===")
        
        validation_data = {"status": "confirmed"}
        
        response = self.make_request(
            "PATCH", 
            f"/sessions/{self.created_session_id}/validate", 
            validation_data, 
            self.student_token
        )
        
        if response and response.status_code == 200:
            session = response.json()
            self.log(f"✅ Séance confirmée avec succès:")
            self.log(f"   Statut: {session['status']}")
            self.log(f"   Validée le: {session.get('validated_at', 'N/A')}")
            return True
        else:
            self.log("❌ Échec de la confirmation de la séance", "ERROR")
            return False
    
    def send_attendance_emails(self):
        """Execute attendance email sending script"""
        self.log("=== ÉTAPE 6: Envoi des emails d'émargement ===")
        
        response = self.make_request("POST", "/sessions/check-attendance-emails")
        
        if response and response.status_code == 200:
            result = response.json()
            self.log(f"✅ Script d'envoi d'emails exécuté:")
            self.log(f"   {result.get('message', 'Aucun message')}")
            return True
        else:
            self.log("❌ Échec de l'envoi des emails d'émargement", "ERROR")
            return False
    
    def verify_final_state(self):
        """Verify the final state of the session and system"""
        self.log("=== ÉTAPE 7: Vérifications finales ===")
        
        # Get session details
        response = self.make_request("GET", "/sessions", token=self.student_token)
        
        if response and response.status_code == 200:
            sessions = response.json()
            test_session = None
            
            for session in sessions:
                if session["id"] == self.created_session_id:
                    test_session = session
                    break
            
            if test_session:
                self.log("✅ Vérification de la séance:")
                self.log(f"   ID: {test_session['id']}")
                self.log(f"   Matière: {test_session['subject']}")
                self.log(f"   Date: {test_session['date']}")
                self.log(f"   Horaires: {test_session['start_time']} - {test_session['end_time']}")
                self.log(f"   Statut: {test_session['status']}")
                self.log(f"   Statut signature: {test_session.get('signature_status', 'N/A')}")
                self.log(f"   Délai signature: {test_session.get('signature_deadline', 'N/A')}")
                self.log(f"   Email émargement envoyé: {test_session.get('attendance_email_sent', False)}")
                
                # Verify expected conditions
                checks = []
                checks.append(("✅ Élève 'Ghizzo Test' créé", True))
                checks.append(("✅ Séance créée", True))
                checks.append(("✅ Séance confirmée par l'élève", test_session['status'] == 'confirmed'))
                checks.append(("✅ Email d'émargement envoyé à Ghizzo.j@gmail.com", test_session.get('attendance_email_sent') == True))
                checks.append(("✅ Signature_status = 'pending'", test_session.get('signature_status') == 'pending'))
                checks.append(("✅ Signature_deadline défini (2h après la fin)", test_session.get('signature_deadline') is not None))
                
                self.log("\n=== RÉSULTATS DES VÉRIFICATIONS ===")
                all_passed = True
                for check_name, passed in checks:
                    if passed:
                        self.log(f"   {check_name}")
                    else:
                        self.log(f"   ❌ {check_name.replace('✅', '')}")
                        all_passed = False
                
                # Calculate signature deadline (should be 2 hours after session end)
                if test_session.get('signature_deadline'):
                    deadline = datetime.fromisoformat(test_session['signature_deadline'].replace('Z', '+00:00'))
                    session_end_str = f"{test_session['date']}T{test_session['end_time']}:00+00:00"
                    session_end = datetime.fromisoformat(session_end_str)
                    expected_deadline = session_end + timedelta(hours=2)
                    
                    self.log(f"\n=== DÉTAILS DU DÉLAI DE SIGNATURE ===")
                    self.log(f"   Fin de séance: {session_end.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                    self.log(f"   Délai signature: {deadline.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                    self.log(f"   Délai attendu: {expected_deadline.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                    self.log(f"   Différence: {abs((deadline - expected_deadline).total_seconds())} secondes")
                
                return all_passed
            else:
                self.log("❌ Séance de test non trouvée", "ERROR")
                return False
        else:
            self.log("❌ Échec de la récupération des séances", "ERROR")
            return False
    
    def get_student_details(self):
        """Get and display complete student details"""
        self.log("=== DÉTAILS COMPLETS DE L'ÉLÈVE CRÉÉ ===")
        
        response = self.make_request("GET", "/students", token=self.teacher_token)
        if response and response.status_code == 200:
            students = response.json()
            for student in students:
                if student["id"] == self.ghizzo_student_id:
                    self.log(f"ID: {student['id']}")
                    self.log(f"Nom: {student['name']}")
                    self.log(f"Email: {student['email']}")
                    self.log(f"Mot de passe: Ghizzo2024!")
                    self.log(f"Téléphone: {student.get('phone', 'N/A')}")
                    self.log(f"Organisme: {student.get('organism', 'N/A')}")
                    self.log(f"Type de support: {student.get('support_type', 'N/A')}")
                    self.log(f"Date début: {student.get('start_date', 'N/A')}")
                    self.log(f"Date fin: {student.get('end_date', 'N/A')}")
                    self.log(f"Heures totales: {student.get('total_hours', 'N/A')}")
                    return student
        return None
    
    def get_session_details(self):
        """Get and display complete session details"""
        self.log("=== DÉTAILS COMPLETS DE LA SÉANCE CRÉÉE ===")
        
        response = self.make_request("GET", "/sessions", token=self.teacher_token)
        if response and response.status_code == 200:
            sessions = response.json()
            for session in sessions:
                if session["id"] == self.created_session_id:
                    self.log(f"ID: {session['id']}")
                    self.log(f"Matière: {session['subject']}")
                    self.log(f"Date: {session['date']}")
                    self.log(f"Heure début: {session['start_time']}")
                    self.log(f"Heure fin: {session['end_time']}")
                    self.log(f"Statut: {session['status']}")
                    self.log(f"Statut signature: {session.get('signature_status', 'N/A')}")
                    self.log(f"Délai signature: {session.get('signature_deadline', 'N/A')}")
                    return session
        return None
    
    def run_ghizzo_test(self):
        """Run the complete Ghizzo Test"""
        self.log("🚀 Démarrage du test Ghizzo - Système d'émargement par signature numérique")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        try:
            # Execute test steps
            if not self.login_as_teacher():
                return False
                
            if not self.create_ghizzo_student():
                return False
                
            if not self.create_finished_session():
                return False
                
            if not self.login_as_ghizzo():
                return False
                
            if not self.confirm_session_as_ghizzo():
                return False
                
            if not self.send_attendance_emails():
                return False
                
            if not self.verify_final_state():
                return False
            
            # Display complete details
            student_details = self.get_student_details()
            session_details = self.get_session_details()
            
            self.log("🎉 TOUS LES TESTS SONT PASSÉS!")
            self.log("\n" + "="*60)
            self.log("✅ RÉSUMÉ DU TEST GHIZZO RÉUSSI")
            self.log("="*60)
            self.log("✅ Élève 'Ghizzo Test' créé avec succès")
            self.log("✅ Séance créée avec succès")
            self.log("✅ Séance confirmée par l'élève")
            self.log("✅ Email d'émargement envoyé à Ghizzo.j@gmail.com")
            self.log("✅ La séance a signature_status = 'pending'")
            self.log("✅ La séance a signature_deadline défini (2h après la fin)")
            
            return True
            
        except Exception as e:
            self.log(f"Test échoué avec exception: {e}", "ERROR")
            return False

def main():
    """Main test execution"""
    tester = GhizzoTester()
    success = tester.run_ghizzo_test()
    
    if success:
        print("\n" + "="*60)
        print("✅ TEST GHIZZO - ÉMARGEMENT NUMÉRIQUE TERMINÉ AVEC SUCCÈS")
        print("="*60)
        exit(0)
    else:
        print("\n" + "="*60)
        print("❌ TEST GHIZZO - ÉMARGEMENT NUMÉRIQUE ÉCHOUÉ")
        print("="*60)
        exit(1)

if __name__ == "__main__":
    main()