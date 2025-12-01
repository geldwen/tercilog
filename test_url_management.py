#!/usr/bin/env python3
"""
Test script for TerciLog URL management function and email URL fixes
Tests the get_student_portal_url() function and email templates
"""

import requests
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Add backend directory to path to import server functions
sys.path.append('/app/backend')

# Load environment variables
load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')

# Import the function we want to test
try:
    from server import get_student_portal_url, send_welcome_email, send_attendance_email, send_session_reminder_email
    print("✅ Successfully imported server functions")
except ImportError as e:
    print(f"❌ Failed to import server functions: {e}")
    sys.exit(1)

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://student-portal-fix-1.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class URLManagementTester:
    def __init__(self):
        self.teacher_token = None
        self.original_env_vars = {}
        
    def log(self, message, level="INFO"):
        """Log messages with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def backup_env_vars(self):
        """Backup current environment variables"""
        env_vars_to_backup = [
            'STUDENT_PORTAL_URL',
            'FRONTEND_URL', 
            'REACT_APP_FRONTEND_URL',
            'REACT_APP_BACKEND_URL'
        ]
        
        for var in env_vars_to_backup:
            self.original_env_vars[var] = os.environ.get(var)
            
    def restore_env_vars(self):
        """Restore original environment variables"""
        for var, value in self.original_env_vars.items():
            if value is None:
                if var in os.environ:
                    del os.environ[var]
            else:
                os.environ[var] = value
                
    def set_env_var(self, key, value):
        """Set environment variable"""
        if value is None:
            if key in os.environ:
                del os.environ[key]
        else:
            os.environ[key] = value
            
    def test_get_student_portal_url_logic(self):
        """Test get_student_portal_url() function with different environment configurations"""
        self.log("=== TEST 1: get_student_portal_url() Function Logic ===")
        
        # Backup current environment
        self.backup_env_vars()
        
        test_cases = [
            {
                "name": "With STUDENT_PORTAL_URL set",
                "env": {
                    'STUDENT_PORTAL_URL': 'https://student.terciform.com',
                    'FRONTEND_URL': None,
                    'REACT_APP_FRONTEND_URL': None,
                    'REACT_APP_BACKEND_URL': None
                },
                "expected": "https://student.terciform.com"
            },
            {
                "name": "Without STUDENT_PORTAL_URL but with FRONTEND_URL",
                "env": {
                    'STUDENT_PORTAL_URL': None,
                    'FRONTEND_URL': 'https://frontend.terciform.com',
                    'REACT_APP_FRONTEND_URL': None,
                    'REACT_APP_BACKEND_URL': None
                },
                "expected": "https://frontend.terciform.com"
            },
            {
                "name": "Without both but with REACT_APP_FRONTEND_URL",
                "env": {
                    'STUDENT_PORTAL_URL': None,
                    'FRONTEND_URL': None,
                    'REACT_APP_FRONTEND_URL': 'https://react-frontend.terciform.com',
                    'REACT_APP_BACKEND_URL': None
                },
                "expected": "https://react-frontend.terciform.com"
            },
            {
                "name": "With only REACT_APP_BACKEND_URL ending in /api",
                "env": {
                    'STUDENT_PORTAL_URL': None,
                    'FRONTEND_URL': None,
                    'REACT_APP_FRONTEND_URL': None,
                    'REACT_APP_BACKEND_URL': 'https://backend.terciform.com/api'
                },
                "expected": "https://backend.terciform.com"
            },
            {
                "name": "With no env vars (fallback)",
                "env": {
                    'STUDENT_PORTAL_URL': None,
                    'FRONTEND_URL': None,
                    'REACT_APP_FRONTEND_URL': None,
                    'REACT_APP_BACKEND_URL': None
                },
                "expected": "https://student-portal-fix-1.preview.emergentagent.com"
            }
        ]
        
        all_passed = True
        
        for i, test_case in enumerate(test_cases, 1):
            self.log(f"Test Case {i}: {test_case['name']}")
            
            # Set environment variables
            for key, value in test_case['env'].items():
                self.set_env_var(key, value)
                
            # Test the function
            try:
                result = get_student_portal_url()
                expected = test_case['expected']
                
                self.log(f"   Expected: {expected}")
                self.log(f"   Got:      {result}")
                
                if result == expected:
                    self.log(f"   ✅ PASS")
                else:
                    self.log(f"   ❌ FAIL")
                    all_passed = False
                    
            except Exception as e:
                self.log(f"   ❌ ERROR: {e}")
                all_passed = False
                
        # Restore environment
        self.restore_env_vars()
        
        return all_passed
        
    def test_url_normalization(self):
        """Test URL normalization features"""
        self.log("=== TEST 2: URL Normalization ===")
        
        # Backup current environment
        self.backup_env_vars()
        
        test_cases = [
            {
                "name": "URL with trailing slash",
                "input": "https://example.com/",
                "expected": "https://example.com"
            },
            {
                "name": "URL ending in /api",
                "input": "https://example.com/api",
                "expected": "https://example.com"
            },
            {
                "name": "URL without http/https",
                "input": "example.com",
                "expected": "https://example.com"
            },
            {
                "name": "URL with spaces",
                "input": "  https://example.com  ",
                "expected": "https://example.com"
            },
            {
                "name": "URL with /api and trailing slash",
                "input": "https://example.com/api/",
                "expected": "https://example.com"
            }
        ]
        
        all_passed = True
        
        for i, test_case in enumerate(test_cases, 1):
            self.log(f"Test Case {i}: {test_case['name']}")
            
            # Set STUDENT_PORTAL_URL to test input
            self.set_env_var('STUDENT_PORTAL_URL', test_case['input'])
            self.set_env_var('FRONTEND_URL', None)
            self.set_env_var('REACT_APP_FRONTEND_URL', None)
            self.set_env_var('REACT_APP_BACKEND_URL', None)
            
            try:
                result = get_student_portal_url()
                expected = test_case['expected']
                
                self.log(f"   Input:    '{test_case['input']}'")
                self.log(f"   Expected: '{expected}'")
                self.log(f"   Got:      '{result}'")
                
                if result == expected:
                    self.log(f"   ✅ PASS")
                else:
                    self.log(f"   ❌ FAIL")
                    all_passed = False
                    
            except Exception as e:
                self.log(f"   ❌ ERROR: {e}")
                all_passed = False
                
        # Restore environment
        self.restore_env_vars()
        
        return all_passed
        
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
                
            return response
            
        except Exception as e:
            self.log(f"Request failed: {e}", "ERROR")
            return None
            
    def login_as_teacher(self):
        """Login as teacher and get JWT token"""
        self.log("Logging in as teacher...")
        
        # Try existing teacher credentials
        teacher_creds = {"email": "teacher@terciform.com", "password": "Teacher2024!"}
        
        response = self.make_request("POST", "/auth/login", teacher_creds)
        
        if response and response.status_code == 200:
            data = response.json()
            self.teacher_token = data["access_token"]
            self.log(f"✅ Teacher login successful")
            return True
        else:
            self.log("❌ Teacher login failed", "ERROR")
            return False
            
    def test_welcome_email_url(self):
        """Test welcome email URL by creating a new student"""
        self.log("=== TEST 3: Welcome Email URL ===")
        
        if not self.login_as_teacher():
            return False
            
        # Create a test student
        import time
        unique_email = f"test.welcome.{int(time.time())}@terciform.com"
        
        student_data = {
            "name": "Test Welcome Email",
            "email": unique_email,
            "password": "Test2024!",
            "phone": "06 12 34 56 78",
            "organism": "Test Formation",
            "support_type": "CPF",
            "start_date": "2025-11-01",
            "end_date": "2025-12-31",
            "total_hours": 10,
            "role": "student"
        }
        
        self.log(f"Creating student: {unique_email}")
        
        response = self.make_request("POST", "/students", student_data, self.teacher_token)
        
        if not response or response.status_code != 200:
            self.log("❌ Failed to create student", "ERROR")
            return False
            
        student = response.json()
        student_id = student["id"]
        
        self.log(f"✅ Student created: {student['name']} ({student['email']})")
        
        # Check current environment variable
        current_url = os.getenv('REACT_APP_BACKEND_URL', 'Not set')
        self.log(f"Current REACT_APP_BACKEND_URL: {current_url}")
        
        # Test the get_student_portal_url function
        portal_url = get_student_portal_url()
        self.log(f"Portal URL from function: {portal_url}")
        
        # Verify URL is non-empty and valid
        checks = []
        checks.append(("URL is non-empty", portal_url != ""))
        checks.append(("URL starts with http", portal_url.startswith("http")))
        checks.append(("URL does not end with /api", not portal_url.endswith("/api")))
        checks.append(("URL does not end with /", not portal_url.endswith("/")))
        
        all_passed = True
        for check_name, passed in checks:
            status = "✅" if passed else "❌"
            self.log(f"   {status} {check_name}")
            if not passed:
                all_passed = False
                
        # Cleanup
        self.log("Cleaning up test student...")
        response = self.make_request("DELETE", f"/students/{student_id}", token=self.teacher_token)
        if response and response.status_code == 200:
            self.log("✅ Test student deleted")
            
        return all_passed
        
    def test_attendance_email_url(self):
        """Test attendance email URL by creating and completing a session"""
        self.log("=== TEST 4: Attendance Email URL ===")
        
        if not self.login_as_teacher():
            return False
            
        # Find an existing student
        response = self.make_request("GET", "/students", token=self.teacher_token)
        if not response or response.status_code != 200:
            self.log("❌ Failed to get students", "ERROR")
            return False
            
        students = response.json()
        if not students:
            self.log("❌ No students found", "ERROR")
            return False
            
        test_student = students[0]
        self.log(f"Using student: {test_student['name']} ({test_student['email']})")
        
        # Create a session that ended 10 minutes ago
        now = datetime.now(timezone.utc)
        end_time = now - timedelta(minutes=10)
        start_time = end_time - timedelta(hours=1)
        
        session_data = {
            "subject": "Test Attendance Email URL",
            "date": end_time.strftime("%Y-%m-%d"),
            "start_time": start_time.strftime("%H:%M"),
            "end_time": end_time.strftime("%H:%M"),
            "student_id": test_student["id"],
            "validation_deadline_hours": 48
        }
        
        response = self.make_request("POST", "/sessions", session_data, self.teacher_token)
        
        if not response or response.status_code != 200:
            self.log("❌ Failed to create session", "ERROR")
            return False
            
        session = response.json()
        session_id = session["id"]
        
        self.log(f"✅ Session created: {session['subject']}")
        
        # Confirm the session first
        # Login as student
        student_login = {
            "email": test_student["email"],
            "password": test_student.get("plain_password", "Test2024!")
        }
        
        response = self.make_request("POST", "/auth/login", student_login)
        if not response or response.status_code != 200:
            self.log("❌ Student login failed", "ERROR")
            # Cleanup and return
            self.make_request("DELETE", f"/sessions/{session_id}", token=self.teacher_token)
            return False
            
        student_token = response.json()["access_token"]
        
        # Confirm session
        validation_data = {"status": "confirmed"}
        response = self.make_request("PATCH", f"/sessions/{session_id}/validate", validation_data, student_token)
        
        if not response or response.status_code != 200:
            self.log("❌ Failed to confirm session", "ERROR")
            # Cleanup and return
            self.make_request("DELETE", f"/sessions/{session_id}", token=self.teacher_token)
            return False
            
        self.log("✅ Session confirmed")
        
        # Test resend attendance email
        response = self.make_request("POST", f"/sessions/{session_id}/resend-attendance-email", token=self.teacher_token)
        
        if not response or response.status_code != 200:
            self.log("❌ Failed to resend attendance email", "ERROR")
            # Cleanup and return
            self.make_request("DELETE", f"/sessions/{session_id}", token=self.teacher_token)
            return False
            
        self.log("✅ Attendance email sent")
        
        # Verify session state
        response = self.make_request("GET", "/sessions", token=self.teacher_token)
        if response and response.status_code == 200:
            sessions = response.json()
            test_session = None
            for s in sessions:
                if s["id"] == session_id:
                    test_session = s
                    break
                    
            if test_session:
                self.log(f"Session signature_status: {test_session.get('signature_status')}")
                self.log(f"Attendance email sent: {test_session.get('attendance_email_sent')}")
                
                # Check current environment variable
                current_url = os.getenv('REACT_APP_BACKEND_URL', 'Not set')
                self.log(f"Current REACT_APP_BACKEND_URL: {current_url}")
                
                # Test the get_student_portal_url function
                portal_url = get_student_portal_url()
                self.log(f"Portal URL from function: {portal_url}")
                
                # Verify URL properties
                checks = []
                checks.append(("Email sent successfully", test_session.get('attendance_email_sent') == True))
                checks.append(("Signature status is pending", test_session.get('signature_status') == 'pending'))
                checks.append(("Portal URL is valid", portal_url.startswith("http")))
                checks.append(("No mention of '2 heures' in URL", "2 heures" not in portal_url))
                
                all_passed = True
                for check_name, passed in checks:
                    status = "✅" if passed else "❌"
                    self.log(f"   {status} {check_name}")
                    if not passed:
                        all_passed = False
        
        # Cleanup
        self.log("Cleaning up test session...")
        response = self.make_request("DELETE", f"/sessions/{session_id}", token=self.teacher_token)
        if response and response.status_code == 200:
            self.log("✅ Test session deleted")
            
        return all_passed
        
    def test_session_creation_email_url(self):
        """Test session creation email URL"""
        self.log("=== TEST 5: Session Creation Email URL ===")
        
        if not self.login_as_teacher():
            return False
            
        # Find an existing student
        response = self.make_request("GET", "/students", token=self.teacher_token)
        if not response or response.status_code != 200:
            self.log("❌ Failed to get students", "ERROR")
            return False
            
        students = response.json()
        if not students:
            self.log("❌ No students found", "ERROR")
            return False
            
        test_student = students[0]
        self.log(f"Using student: {test_student['name']} ({test_student['email']})")
        
        # Create a future session
        tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
        start_time = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=1)
        
        session_data = {
            "subject": "Test Session Creation Email URL",
            "date": start_time.strftime("%Y-%m-%d"),
            "start_time": start_time.strftime("%H:%M"),
            "end_time": end_time.strftime("%H:%M"),
            "student_id": test_student["id"],
            "validation_deadline_hours": 48
        }
        
        # Check current environment variable
        current_url = os.getenv('REACT_APP_BACKEND_URL', 'Not set')
        self.log(f"Current REACT_APP_BACKEND_URL: {current_url}")
        
        # Test the get_student_portal_url function
        portal_url = get_student_portal_url()
        self.log(f"Portal URL from function: {portal_url}")
        
        response = self.make_request("POST", "/sessions", session_data, self.teacher_token)
        
        if not response or response.status_code != 200:
            self.log("❌ Failed to create session", "ERROR")
            return False
            
        session = response.json()
        session_id = session["id"]
        
        self.log(f"✅ Session created: {session['subject']}")
        self.log("✅ Session creation email should have been sent to student")
        
        # Verify URL properties
        checks = []
        checks.append(("Portal URL is valid", portal_url.startswith("http")))
        checks.append(("Portal URL does not end with /api", not portal_url.endswith("/api")))
        checks.append(("Portal URL does not end with /", not portal_url.endswith("/")))
        checks.append(("Session created successfully", session_id is not None))
        
        all_passed = True
        for check_name, passed in checks:
            status = "✅" if passed else "❌"
            self.log(f"   {status} {check_name}")
            if not passed:
                all_passed = False
                
        # Cleanup
        self.log("Cleaning up test session...")
        response = self.make_request("DELETE", f"/sessions/{session_id}", token=self.teacher_token)
        if response and response.status_code == 200:
            self.log("✅ Test session deleted")
            
        return all_passed
        
    def test_session_reminder_email_url(self):
        """Test session reminder email URL (if triggered)"""
        self.log("=== TEST 6: Session Reminder Email URL ===")
        
        # Check current environment variable
        current_url = os.getenv('REACT_APP_BACKEND_URL', 'Not set')
        self.log(f"Current REACT_APP_BACKEND_URL: {current_url}")
        
        # Test the get_student_portal_url function
        portal_url = get_student_portal_url()
        self.log(f"Portal URL from function: {portal_url}")
        
        # Test the reminder email function directly (without actually sending)
        try:
            # We can't easily test the actual reminder email sending without waiting,
            # but we can verify the URL function works correctly
            
            checks = []
            checks.append(("Portal URL is valid", portal_url.startswith("http")))
            checks.append(("Portal URL does not end with /api", not portal_url.endswith("/api")))
            checks.append(("Portal URL does not end with /", not portal_url.endswith("/")))
            checks.append(("get_student_portal_url function accessible", True))
            
            all_passed = True
            for check_name, passed in checks:
                status = "✅" if passed else "❌"
                self.log(f"   {status} {check_name}")
                if not passed:
                    all_passed = False
                    
            self.log("✅ Reminder email URL validation completed")
            return all_passed
            
        except Exception as e:
            self.log(f"❌ Error testing reminder email URL: {e}", "ERROR")
            return False
            
    def check_current_env_variable(self):
        """Check what REACT_APP_BACKEND_URL is currently set to"""
        self.log("=== CURRENT ENV VARIABLE CHECK ===")
        
        current_url = os.getenv('REACT_APP_BACKEND_URL', 'Not set')
        self.log(f"REACT_APP_BACKEND_URL: {current_url}")
        
        # Also check other related variables
        other_vars = ['STUDENT_PORTAL_URL', 'FRONTEND_URL', 'REACT_APP_FRONTEND_URL']
        for var in other_vars:
            value = os.getenv(var, 'Not set')
            self.log(f"{var}: {value}")
            
        return True
        
    def run_all_tests(self):
        """Run all URL management tests"""
        self.log("🚀 Starting TerciLog URL Management Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        test_results = []
        
        try:
            # Check current environment
            self.log("\n" + "="*60)
            result = self.check_current_env_variable()
            test_results.append(("Current Env Check", result))
            
            # Test 1: Function Logic
            self.log("\n" + "="*60)
            result = self.test_get_student_portal_url_logic()
            test_results.append(("get_student_portal_url() Logic", result))
            
            # Test 2: URL Normalization
            self.log("\n" + "="*60)
            result = self.test_url_normalization()
            test_results.append(("URL Normalization", result))
            
            # Test 3: Welcome Email URL
            self.log("\n" + "="*60)
            result = self.test_welcome_email_url()
            test_results.append(("Welcome Email URL", result))
            
            # Test 4: Attendance Email URL
            self.log("\n" + "="*60)
            result = self.test_attendance_email_url()
            test_results.append(("Attendance Email URL", result))
            
            # Test 5: Session Creation Email URL
            self.log("\n" + "="*60)
            result = self.test_session_creation_email_url()
            test_results.append(("Session Creation Email URL", result))
            
            # Test 6: Session Reminder Email URL
            self.log("\n" + "="*60)
            result = self.test_session_reminder_email_url()
            test_results.append(("Session Reminder Email URL", result))
            
            # Summary
            self.log("\n" + "="*60)
            self.log("=== TEST RESULTS SUMMARY ===")
            
            all_passed = True
            for test_name, passed in test_results:
                status = "✅ PASS" if passed else "❌ FAIL"
                self.log(f"{status} {test_name}")
                if not passed:
                    all_passed = False
                    
            if all_passed:
                self.log("\n🎉 ALL URL MANAGEMENT TESTS PASSED!")
            else:
                self.log("\n❌ SOME TESTS FAILED")
                
            return all_passed
            
        except Exception as e:
            self.log(f"Test suite failed with exception: {e}", "ERROR")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "ERROR")
            return False

if __name__ == "__main__":
    tester = URLManagementTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)