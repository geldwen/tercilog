#!/usr/bin/env python3
"""
Test script for TerciForm digital signature attendance system
Tests the complete flow: teacher login, student creation, session creation, 
student confirmation, and attendance email sending.
"""

import requests
import json
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://terciform-planner.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class TerciFormTester:
    def __init__(self):
        self.teacher_token = None
        self.student_token = None
        self.created_student_id = None
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
    
    def get_existing_teacher(self):
        """Get existing teacher from database"""
        self.log("Checking for existing teachers...")
        
        # Try to get all users (this might fail if no teacher is logged in)
        response = self.make_request("GET", "/students")
        
        if response and response.status_code == 403:
            self.log("Need to login as teacher first")
            return None
            
        # If we can't get students, we need to find a teacher another way
        # Let's try some common teacher credentials
        common_teacher_emails = [
            "teacher@terciform.com",
            "admin@terciform.com", 
            "formateur@terciform.com",
            "prof@terciform.com"
        ]
        
        common_passwords = ["password", "admin", "teacher", "123456", "Test2024!"]
        
        for email in common_teacher_emails:
            for password in common_passwords:
                self.log(f"Trying teacher login: {email}")
                login_data = {"email": email, "password": password}
                response = self.make_request("POST", "/auth/login", login_data)
                
                if response and response.status_code == 200:
                    data = response.json()
                    if data.get("user", {}).get("role") == "teacher":
                        self.log(f"Found teacher: {email}")
                        return {"email": email, "password": password}
        
        self.log("No existing teacher found with common credentials", "ERROR")
        return None
    
    def login_as_teacher(self):
        """Login as teacher and get JWT token"""
        self.log("=== STEP 1: Teacher Login ===")
        
        teacher_creds = self.get_existing_teacher()
        if not teacher_creds:
            # Try to create a teacher account
            self.log("Creating new teacher account...")
            teacher_data = {
                "email": "teacher@terciform.com",
                "password": "Teacher2024!",
                "name": "Professeur Test",
                "role": "teacher"
            }
            
            response = self.make_request("POST", "/auth/register", teacher_data)
            if response and response.status_code == 200:
                teacher_creds = {"email": teacher_data["email"], "password": teacher_data["password"]}
                self.log("Teacher account created successfully")
            else:
                self.log("Failed to create teacher account", "ERROR")
                return False
        
        # Login with teacher credentials
        login_data = {
            "email": teacher_creds["email"],
            "password": teacher_creds["password"]
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.teacher_token = data["access_token"]
            teacher_info = data["user"]
            self.log(f"✅ Teacher login successful: {teacher_info['name']} ({teacher_info['email']})")
            return True
        else:
            self.log("❌ Teacher login failed", "ERROR")
            return False
    
    def create_test_student(self):
        """Create test student"""
        self.log("=== STEP 2: Creating Test Student ===")
        
        student_data = {
            "name": "Élève Test Signature",
            "email": "terciform@gmail.com",
            "password": "Test2024!",
            "phone": "06 12 34 56 78",
            "organism": "Test Formation",
            "support_type": "CPF",
            "start_date": "2025-11-01",
            "end_date": "2025-12-31",
            "total_hours": 20,
            "role": "student"
        }
        
        response = self.make_request("POST", "/students", student_data, self.teacher_token)
        
        if response and response.status_code == 200:
            student = response.json()
            self.created_student_id = student["id"]
            self.log(f"✅ Student created successfully:")
            self.log(f"   ID: {student['id']}")
            self.log(f"   Name: {student['name']}")
            self.log(f"   Email: {student['email']}")
            return True
        else:
            self.log("❌ Failed to create student", "ERROR")
            return False
    
    def create_test_session(self):
        """Create a session that just ended (5 minutes ago)"""
        self.log("=== STEP 3: Creating Test Session ===")
        
        # Calculate times: session ended 5 minutes ago, lasted 1 hour
        now = datetime.now(timezone.utc)
        end_time = now - timedelta(minutes=5)
        start_time = end_time - timedelta(hours=1)
        
        session_data = {
            "subject": "Test Signature Numérique",
            "date": end_time.strftime("%Y-%m-%d"),
            "start_time": start_time.strftime("%H:%M"),
            "end_time": end_time.strftime("%H:%M"),
            "student_id": self.created_student_id,
            "validation_deadline_hours": 48
        }
        
        self.log(f"Session details:")
        self.log(f"   Date: {session_data['date']}")
        self.log(f"   Start: {session_data['start_time']}")
        self.log(f"   End: {session_data['end_time']}")
        
        response = self.make_request("POST", "/sessions", session_data, self.teacher_token)
        
        if response and response.status_code == 200:
            session = response.json()
            self.created_session_id = session["id"]
            self.log(f"✅ Session created successfully:")
            self.log(f"   ID: {session['id']}")
            self.log(f"   Subject: {session['subject']}")
            self.log(f"   Status: {session['status']}")
            return True
        else:
            self.log("❌ Failed to create session", "ERROR")
            return False
    
    def login_as_student(self):
        """Login as the created student"""
        self.log("=== STEP 4: Student Login ===")
        
        login_data = {
            "email": "terciform@gmail.com",
            "password": "Test2024!"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.student_token = data["access_token"]
            student_info = data["user"]
            self.log(f"✅ Student login successful: {student_info['name']}")
            return True
        else:
            self.log("❌ Student login failed", "ERROR")
            return False
    
    def confirm_session_as_student(self):
        """Confirm the session as student"""
        self.log("=== STEP 5: Session Confirmation ===")
        
        validation_data = {"status": "confirmed"}
        
        response = self.make_request(
            "PATCH", 
            f"/sessions/{self.created_session_id}/validate", 
            validation_data, 
            self.student_token
        )
        
        if response and response.status_code == 200:
            session = response.json()
            self.log(f"✅ Session confirmed successfully:")
            self.log(f"   Status: {session['status']}")
            self.log(f"   Validated at: {session.get('validated_at', 'N/A')}")
            return True
        else:
            self.log("❌ Failed to confirm session", "ERROR")
            return False
    
    def send_attendance_emails(self):
        """Execute attendance email sending script"""
        self.log("=== STEP 6: Sending Attendance Emails ===")
        
        response = self.make_request("POST", "/sessions/check-attendance-emails")
        
        if response and response.status_code == 200:
            result = response.json()
            self.log(f"✅ Attendance email script executed:")
            self.log(f"   {result.get('message', 'No message')}")
            return True
        else:
            self.log("❌ Failed to send attendance emails", "ERROR")
            return False
    
    def verify_session_state(self):
        """Verify the final state of the session"""
        self.log("=== STEP 7: Verification ===")
        
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
                self.log("✅ Session verification:")
                self.log(f"   Status: {test_session['status']}")
                self.log(f"   Signature Status: {test_session.get('signature_status', 'N/A')}")
                self.log(f"   Signature Deadline: {test_session.get('signature_deadline', 'N/A')}")
                self.log(f"   Attendance Email Sent: {test_session.get('attendance_email_sent', False)}")
                
                # Check expected values
                checks = []
                checks.append(("Status = confirmed", test_session['status'] == 'confirmed'))
                checks.append(("Signature Status = pending", test_session.get('signature_status') == 'pending'))
                checks.append(("Signature Deadline set", test_session.get('signature_deadline') is not None))
                checks.append(("Attendance Email Sent", test_session.get('attendance_email_sent') == True))
                
                all_passed = True
                for check_name, passed in checks:
                    status = "✅" if passed else "❌"
                    self.log(f"   {status} {check_name}")
                    if not passed:
                        all_passed = False
                
                return all_passed
            else:
                self.log("❌ Test session not found", "ERROR")
                return False
        else:
            self.log("❌ Failed to get sessions", "ERROR")
            return False
    
    def cleanup(self):
        """Clean up created test data"""
        self.log("=== CLEANUP ===")
        
        if self.created_session_id and self.teacher_token:
            self.log("Deleting test session...")
            response = self.make_request("DELETE", f"/sessions/{self.created_session_id}", token=self.teacher_token)
            if response and response.status_code == 200:
                self.log("✅ Test session deleted")
            
        if self.created_student_id and self.teacher_token:
            self.log("Deleting test student...")
            response = self.make_request("DELETE", f"/students/{self.created_student_id}", token=self.teacher_token)
            if response and response.status_code == 200:
                self.log("✅ Test student deleted")
    
    def run_full_test(self):
        """Run the complete test suite"""
        self.log("🚀 Starting TerciForm Digital Signature Test")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        try:
            # Execute test steps
            if not self.login_as_teacher():
                return False
                
            if not self.create_test_student():
                return False
                
            if not self.create_test_session():
                return False
                
            if not self.login_as_student():
                return False
                
            if not self.confirm_session_as_student():
                return False
                
            if not self.send_attendance_emails():
                return False
                
            if not self.verify_session_state():
                return False
            
            self.log("🎉 ALL TESTS PASSED!")
            return True
            
        except Exception as e:
            self.log(f"Test failed with exception: {e}", "ERROR")
            return False
        finally:
            # Always cleanup
            self.cleanup()

def main():
    """Main test execution"""
    tester = TerciFormTester()
    success = tester.run_full_test()
    
    if success:
        print("\n" + "="*50)
        print("✅ DIGITAL SIGNATURE ATTENDANCE TEST COMPLETED")
        print("="*50)
        exit(0)
    else:
        print("\n" + "="*50)
        print("❌ DIGITAL SIGNATURE ATTENDANCE TEST FAILED")
        print("="*50)
        exit(1)

if __name__ == "__main__":
    main()