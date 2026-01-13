"""
Test suite for Formateurs (Trainers) management API
Tests: GET /api/formateurs, POST /api/formateurs, PATCH /api/formateurs/{id}, DELETE /api/formateurs/{id}
"""
import pytest
import requests
import os
import json
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "terciform@gmail.com"
ADMIN_PASSWORD = "Geldwen1982*+"


class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "teacher", "User is not a teacher"
        print(f"✅ Login successful for {ADMIN_EMAIL}")
        return data["access_token"]


class TestFormateurs:
    """Formateurs CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Authentication failed - skipping formateurs tests")
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_formateurs_list(self):
        """Test GET /api/formateurs - List all formateurs"""
        response = requests.get(f"{BASE_URL}/api/formateurs", headers=self.headers)
        assert response.status_code == 200, f"GET formateurs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/formateurs returned {len(data)} formateurs")
        return data
    
    def test_create_formateur_minimal(self):
        """Test POST /api/formateurs - Create formateur with required fields only"""
        # Use multipart/form-data as the API expects
        form_data = {
            "nom": "TEST_Dupont",
            "prenom": "TEST_Jean",
            "email": f"test_formateur_{os.urandom(4).hex()}@test.com",
            "societe": "",
            "telephone": "",
            "siret": "",
            "nda": "",
            "matieres": json.dumps([])
        }
        
        response = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Create formateur failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "No id in response"
        assert data["nom"] == "TEST_Dupont", "Nom mismatch"
        assert data["prenom"] == "TEST_Jean", "Prenom mismatch"
        assert "email" in data, "No email in response"
        
        print(f"✅ Created formateur: {data['prenom']} {data['nom']} (ID: {data['id']})")
        
        # Cleanup: Delete the test formateur
        delete_response = requests.delete(
            f"{BASE_URL}/api/formateurs/{data['id']}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Cleanup failed: {delete_response.text}"
        print(f"✅ Cleaned up test formateur")
        
        return data
    
    def test_create_formateur_full(self):
        """Test POST /api/formateurs - Create formateur with all fields"""
        form_data = {
            "nom": "TEST_Martin",
            "prenom": "TEST_Marie",
            "email": f"test_formateur_full_{os.urandom(4).hex()}@test.com",
            "societe": "Formation Pro SARL",
            "telephone": "06 12 34 56 78",
            "siret": "123 456 789 00012",
            "nda": "11 75 12345 67",
            "matieres": json.dumps(["Anglais", "Management", "Bureautique"])
        }
        
        response = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Create formateur failed: {response.text}"
        data = response.json()
        
        # Verify all fields
        assert data["nom"] == "TEST_Martin"
        assert data["prenom"] == "TEST_Marie"
        assert data["societe"] == "Formation Pro SARL"
        assert data["telephone"] == "06 12 34 56 78"
        assert data["siret"] == "123 456 789 00012"
        assert data["nda"] == "11 75 12345 67"
        assert data["matieres"] == ["Anglais", "Management", "Bureautique"]
        
        print(f"✅ Created full formateur: {data['prenom']} {data['nom']}")
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/formateurs/{data['id']}",
            headers=self.headers
        )
        assert get_response.status_code == 200, f"GET formateur failed: {get_response.text}"
        fetched = get_response.json()
        assert fetched["nom"] == "TEST_Martin"
        assert fetched["matieres"] == ["Anglais", "Management", "Bureautique"]
        print(f"✅ Verified formateur persistence via GET")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/formateurs/{data['id']}", headers=self.headers)
        return data
    
    def test_create_formateur_duplicate_email(self):
        """Test POST /api/formateurs - Duplicate email should fail"""
        email = f"test_dup_{os.urandom(4).hex()}@test.com"
        
        # Create first formateur
        form_data = {
            "nom": "TEST_First",
            "prenom": "TEST_User",
            "email": email,
            "matieres": json.dumps([])
        }
        response1 = requests.post(f"{BASE_URL}/api/formateurs", data=form_data, headers=self.headers)
        assert response1.status_code == 200
        formateur_id = response1.json()["id"]
        
        # Try to create second with same email
        form_data2 = {
            "nom": "TEST_Second",
            "prenom": "TEST_User",
            "email": email,
            "matieres": json.dumps([])
        }
        response2 = requests.post(f"{BASE_URL}/api/formateurs", data=form_data2, headers=self.headers)
        assert response2.status_code == 400, "Should reject duplicate email"
        print(f"✅ Duplicate email correctly rejected")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/formateurs/{formateur_id}", headers=self.headers)
    
    def test_update_formateur(self):
        """Test PATCH /api/formateurs/{id} - Update formateur"""
        # Create a formateur first
        form_data = {
            "nom": "TEST_ToUpdate",
            "prenom": "TEST_Original",
            "email": f"test_update_{os.urandom(4).hex()}@test.com",
            "matieres": json.dumps(["Anglais"])
        }
        create_response = requests.post(f"{BASE_URL}/api/formateurs", data=form_data, headers=self.headers)
        assert create_response.status_code == 200
        formateur_id = create_response.json()["id"]
        
        # Update the formateur
        update_data = {
            "nom": "TEST_Updated",
            "telephone": "07 98 76 54 32",
            "matieres": json.dumps(["Anglais", "Espagnol"])
        }
        update_response = requests.patch(
            f"{BASE_URL}/api/formateurs/{formateur_id}",
            data=update_data,
            headers=self.headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated = update_response.json()
        
        assert updated["nom"] == "TEST_Updated"
        assert updated["telephone"] == "07 98 76 54 32"
        assert updated["matieres"] == ["Anglais", "Espagnol"]
        print(f"✅ Updated formateur successfully")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/formateurs/{formateur_id}", headers=self.headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["nom"] == "TEST_Updated"
        print(f"✅ Verified update persistence")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/formateurs/{formateur_id}", headers=self.headers)
    
    def test_delete_formateur(self):
        """Test DELETE /api/formateurs/{id} - Delete formateur"""
        # Create a formateur first
        form_data = {
            "nom": "TEST_ToDelete",
            "prenom": "TEST_Delete",
            "email": f"test_delete_{os.urandom(4).hex()}@test.com",
            "matieres": json.dumps([])
        }
        create_response = requests.post(f"{BASE_URL}/api/formateurs", data=form_data, headers=self.headers)
        assert create_response.status_code == 200
        formateur_id = create_response.json()["id"]
        
        # Delete the formateur
        delete_response = requests.delete(
            f"{BASE_URL}/api/formateurs/{formateur_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✅ Deleted formateur successfully")
        
        # Verify deletion - should return 404
        get_response = requests.get(f"{BASE_URL}/api/formateurs/{formateur_id}", headers=self.headers)
        assert get_response.status_code == 404, "Formateur should not exist after deletion"
        print(f"✅ Verified formateur no longer exists")
    
    def test_get_formateur_not_found(self):
        """Test GET /api/formateurs/{id} - Non-existent formateur"""
        response = requests.get(
            f"{BASE_URL}/api/formateurs/non-existent-id-12345",
            headers=self.headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent formateur"
        print(f"✅ Correctly returns 404 for non-existent formateur")
    
    def test_unauthorized_access(self):
        """Test API without authentication"""
        response = requests.get(f"{BASE_URL}/api/formateurs")
        assert response.status_code in [401, 403], "Should reject unauthenticated request"
        print(f"✅ Correctly rejects unauthenticated request")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
