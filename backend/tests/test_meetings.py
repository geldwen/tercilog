"""
Test suite for Meeting API endpoints
Tests: GET /api/meetings, POST /api/meetings, POST /api/meetings/{id}/respond, PUT /api/meetings/{id}, DELETE /api/meetings/{id}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "terciform@gmail.com"
ADMIN_PASSWORD = "Geldwen1982*+"
GESTIONNAIRE_EMAIL = "mounarezgui.pro@gmail.com"
GESTIONNAIRE_PASSWORD = "zepart648"
CLIENT_EMAIL = "gestionnaire@testsociete.com"
CLIENT_PASSWORD = "TestSociete2024!"


class TestMeetingAPIs:
    """Meeting API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in admin login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def gestionnaire_token(self):
        """Get gestionnaire authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": GESTIONNAIRE_EMAIL,
            "password": GESTIONNAIRE_PASSWORD
        })
        assert response.status_code == 200, f"Gestionnaire login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in gestionnaire login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def client_token(self):
        """Get client (societe) authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200, f"Client login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in client login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth token"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def gestionnaire_headers(self, gestionnaire_token):
        """Headers with gestionnaire auth token"""
        return {
            "Authorization": f"Bearer {gestionnaire_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def client_headers(self, client_token):
        """Headers with client auth token"""
        return {
            "Authorization": f"Bearer {client_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def clients_list(self, admin_headers):
        """Get list of clients for meeting creation"""
        response = requests.get(f"{BASE_URL}/api/clients", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get clients: {response.text}"
        return response.json()
    
    # ========== Authentication Tests ==========
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "teacher"
        print(f"✓ Admin login successful - role: {data['user']['role']}")
    
    def test_gestionnaire_login(self):
        """Test gestionnaire can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": GESTIONNAIRE_EMAIL,
            "password": GESTIONNAIRE_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "gestionnaire"
        print(f"✓ Gestionnaire login successful - role: {data['user']['role']}")
    
    def test_client_login(self):
        """Test client (societe) can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        # Client type societe should have gestionnaire role
        print(f"✓ Client login successful - role: {data['user']['role']}")
    
    # ========== GET /api/meetings Tests ==========
    
    def test_get_meetings_admin(self, admin_headers):
        """Test admin can get meetings list"""
        response = requests.get(f"{BASE_URL}/api/meetings", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin GET /api/meetings - returned {len(data)} meetings")
    
    def test_get_meetings_gestionnaire(self, gestionnaire_headers):
        """Test gestionnaire can get meetings list"""
        response = requests.get(f"{BASE_URL}/api/meetings", headers=gestionnaire_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Gestionnaire GET /api/meetings - returned {len(data)} meetings")
    
    def test_get_meetings_client(self, client_headers):
        """Test client can get meetings list"""
        response = requests.get(f"{BASE_URL}/api/meetings", headers=client_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Client GET /api/meetings - returned {len(data)} meetings")
    
    def test_get_meetings_unauthenticated(self):
        """Test unauthenticated request is rejected"""
        response = requests.get(f"{BASE_URL}/api/meetings")
        assert response.status_code in [401, 403]
        print(f"✓ Unauthenticated GET /api/meetings rejected with {response.status_code}")
    
    # ========== POST /api/meetings Tests ==========
    
    def test_create_meeting_admin(self, admin_headers, clients_list):
        """Test admin can create a meeting"""
        # Get first client ID for invitation
        if not clients_list:
            pytest.skip("No clients available for meeting creation")
        
        client_id = clients_list[0]["id"]
        
        meeting_data = {
            "title": f"TEST_Meeting_{uuid.uuid4().hex[:8]}",
            "description": "Test meeting created by pytest",
            "date": "2026-03-15",
            "start_time": "10:00",
            "end_time": "11:00",
            "client_ids": [client_id]
        }
        
        response = requests.post(f"{BASE_URL}/api/meetings", json=meeting_data, headers=admin_headers)
        assert response.status_code == 200, f"Create meeting failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["title"] == meeting_data["title"]
        assert data["date"] == meeting_data["date"]
        assert data["start_time"] == meeting_data["start_time"]
        assert data["end_time"] == meeting_data["end_time"]
        assert "jitsi_room" in data
        assert len(data.get("clients", [])) > 0
        
        print(f"✓ Admin created meeting: {data['title']} with Jitsi room: {data['jitsi_room']}")
        
        # Store meeting ID for cleanup
        self.__class__.created_meeting_id = data["id"]
        return data
    
    def test_create_meeting_gestionnaire_forbidden(self, gestionnaire_headers, clients_list):
        """Test gestionnaire cannot create meetings (403)"""
        if not clients_list:
            pytest.skip("No clients available")
        
        meeting_data = {
            "title": "TEST_Forbidden_Meeting",
            "description": "This should fail",
            "date": "2026-03-15",
            "start_time": "10:00",
            "end_time": "11:00",
            "client_ids": [clients_list[0]["id"]]
        }
        
        response = requests.post(f"{BASE_URL}/api/meetings", json=meeting_data, headers=gestionnaire_headers)
        assert response.status_code == 403
        print(f"✓ Gestionnaire correctly forbidden from creating meetings (403)")
    
    def test_create_meeting_missing_fields(self, admin_headers, clients_list):
        """Test meeting creation with missing required fields"""
        if not clients_list:
            pytest.skip("No clients available")
        
        # Missing title
        meeting_data = {
            "description": "Test",
            "date": "2026-03-15",
            "start_time": "10:00",
            "end_time": "11:00",
            "client_ids": [clients_list[0]["id"]]
        }
        
        response = requests.post(f"{BASE_URL}/api/meetings", json=meeting_data, headers=admin_headers)
        assert response.status_code == 422  # Validation error
        print(f"✓ Missing fields correctly rejected with 422")
    
    # ========== PUT /api/meetings/{id} Tests ==========
    
    def test_update_meeting_admin(self, admin_headers):
        """Test admin can update their meeting"""
        meeting_id = getattr(self.__class__, 'created_meeting_id', None)
        if not meeting_id:
            pytest.skip("No meeting created to update")
        
        update_data = {
            "title": "TEST_Updated_Meeting_Title",
            "description": "Updated description"
        }
        
        response = requests.put(f"{BASE_URL}/api/meetings/{meeting_id}", json=update_data, headers=admin_headers)
        assert response.status_code == 200, f"Update meeting failed: {response.text}"
        
        data = response.json()
        assert data["title"] == update_data["title"]
        assert data["description"] == update_data["description"]
        
        print(f"✓ Admin updated meeting title to: {data['title']}")
    
    def test_update_meeting_gestionnaire_forbidden(self, gestionnaire_headers):
        """Test gestionnaire cannot update meetings"""
        meeting_id = getattr(self.__class__, 'created_meeting_id', None)
        if not meeting_id:
            pytest.skip("No meeting created to update")
        
        update_data = {"title": "Forbidden Update"}
        
        response = requests.put(f"{BASE_URL}/api/meetings/{meeting_id}", json=update_data, headers=gestionnaire_headers)
        assert response.status_code == 403
        print(f"✓ Gestionnaire correctly forbidden from updating meetings (403)")
    
    # ========== POST /api/meetings/{id}/respond Tests ==========
    
    def test_respond_meeting_admin_forbidden(self, admin_headers):
        """Test admin cannot respond to meeting invitations"""
        meeting_id = getattr(self.__class__, 'created_meeting_id', None)
        if not meeting_id:
            pytest.skip("No meeting created to respond to")
        
        response = requests.post(
            f"{BASE_URL}/api/meetings/{meeting_id}/respond",
            json={"accepted": True},
            headers=admin_headers
        )
        assert response.status_code == 403
        print(f"✓ Admin correctly forbidden from responding to invitations (403)")
    
    # ========== GET /api/meetings/{id} Tests ==========
    
    def test_get_single_meeting_admin(self, admin_headers):
        """Test admin can get a specific meeting"""
        meeting_id = getattr(self.__class__, 'created_meeting_id', None)
        if not meeting_id:
            pytest.skip("No meeting created to get")
        
        response = requests.get(f"{BASE_URL}/api/meetings/{meeting_id}", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == meeting_id
        print(f"✓ Admin GET /api/meetings/{meeting_id} successful")
    
    def test_get_nonexistent_meeting(self, admin_headers):
        """Test getting non-existent meeting returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/meetings/{fake_id}", headers=admin_headers)
        assert response.status_code == 404
        print(f"✓ Non-existent meeting correctly returns 404")
    
    # ========== DELETE /api/meetings/{id} Tests ==========
    
    def test_delete_meeting_gestionnaire_forbidden(self, gestionnaire_headers):
        """Test gestionnaire cannot delete meetings"""
        meeting_id = getattr(self.__class__, 'created_meeting_id', None)
        if not meeting_id:
            pytest.skip("No meeting created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/meetings/{meeting_id}", headers=gestionnaire_headers)
        assert response.status_code == 403
        print(f"✓ Gestionnaire correctly forbidden from deleting meetings (403)")
    
    def test_delete_meeting_admin(self, admin_headers):
        """Test admin can delete their meeting (cleanup)"""
        meeting_id = getattr(self.__class__, 'created_meeting_id', None)
        if not meeting_id:
            pytest.skip("No meeting created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/meetings/{meeting_id}", headers=admin_headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/meetings/{meeting_id}", headers=admin_headers)
        assert get_response.status_code == 404
        
        print(f"✓ Admin deleted meeting {meeting_id} successfully")
    
    def test_delete_nonexistent_meeting(self, admin_headers):
        """Test deleting non-existent meeting returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/meetings/{fake_id}", headers=admin_headers)
        assert response.status_code == 404
        print(f"✓ Delete non-existent meeting correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
