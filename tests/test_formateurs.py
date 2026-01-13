"""
Test suite for Formateurs (Trainers) CRUD API endpoints
Tests: GET /api/formateurs, POST /api/formateurs, GET /api/formateurs/{id}, PUT /api/formateurs/{id}, DELETE /api/formateurs/{id}
"""
import pytest
import requests
import os
import json
import uuid

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "terciform@gmail.com"
TEST_PASSWORD = "Geldwen1982*+"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_FORMATEUR_"


class TestFormateursCRUD:
    """Test suite for Formateurs CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - authenticate before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Authenticate
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code} - {login_response.text}")
        
        token = login_response.json().get("access_token")
        if not token:
            pytest.skip("No access token received")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
        
        # Store created formateur IDs for cleanup
        self.created_formateur_ids = []
        
        yield
        
        # Cleanup: Delete all test-created formateurs
        for formateur_id in self.created_formateur_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/formateurs/{formateur_id}")
            except:
                pass
    
    def test_01_authentication_works(self):
        """Test that authentication is working"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth check failed: {response.text}"
        data = response.json()
        assert "email" in data
        assert data["role"] == "teacher"
        print(f"✅ Authenticated as: {data['email']}")
    
    def test_02_get_formateurs_list(self):
        """Test GET /api/formateurs - List all formateurs"""
        response = self.session.get(f"{BASE_URL}/api/formateurs")
        
        assert response.status_code == 200, f"GET /api/formateurs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/formateurs returned {len(data)} formateurs")
    
    def test_03_create_formateur_basic(self):
        """Test POST /api/formateurs - Create a new formateur with basic fields"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Use multipart/form-data for creation
        form_data = {
            'nom': f'{TEST_PREFIX}Nom_{unique_id}',
            'prenom': f'{TEST_PREFIX}Prenom_{unique_id}',
            'email': f'test_{unique_id}@testformateur.com',
            'telephone': '0612345678',
            'societe': 'Test Company',
            'siret': '12345678901234',
            'nda': '11751234575',
            'matieres': json.dumps(['Anglais', 'Management'])
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"POST /api/formateurs failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["nom"] == form_data['nom'], "Nom should match"
        assert data["prenom"] == form_data['prenom'], "Prenom should match"
        assert data["email"] == form_data['email'], "Email should match"
        assert data["telephone"] == form_data['telephone'], "Telephone should match"
        assert data["societe"] == form_data['societe'], "Societe should match"
        assert data["siret"] == form_data['siret'], "SIRET should match"
        assert data["nda"] == form_data['nda'], "NDA should match"
        assert data["matieres"] == ['Anglais', 'Management'], "Matieres should match"
        
        self.created_formateur_ids.append(data["id"])
        print(f"✅ Created formateur: {data['prenom']} {data['nom']} (ID: {data['id']})")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/formateurs/{data['id']}")
        assert get_response.status_code == 200, f"GET formateur by ID failed: {get_response.text}"
        
        fetched_data = get_response.json()
        assert fetched_data["id"] == data["id"], "Fetched ID should match"
        assert fetched_data["email"] == form_data['email'], "Fetched email should match"
        print(f"✅ Verified formateur persistence via GET")
    
    def test_04_create_formateur_duplicate_email(self):
        """Test POST /api/formateurs - Should reject duplicate email"""
        unique_id = str(uuid.uuid4())[:8]
        email = f'duplicate_{unique_id}@testformateur.com'
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create first formateur
        form_data1 = {
            'nom': f'{TEST_PREFIX}First',
            'prenom': 'First',
            'email': email,
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data1,
            headers=headers
        )
        
        assert response1.status_code == 200, f"First creation failed: {response1.text}"
        self.created_formateur_ids.append(response1.json()["id"])
        
        # Try to create second formateur with same email
        form_data2 = {
            'nom': f'{TEST_PREFIX}Second',
            'prenom': 'Second',
            'email': email,
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data2,
            headers=headers
        )
        
        assert response2.status_code == 400, f"Should reject duplicate email, got: {response2.status_code}"
        assert "existe déjà" in response2.json().get("detail", "").lower() or "already" in response2.json().get("detail", "").lower()
        print(f"✅ Duplicate email correctly rejected")
    
    def test_05_get_formateur_by_id(self):
        """Test GET /api/formateurs/{id} - Get a specific formateur"""
        # First create a formateur
        unique_id = str(uuid.uuid4())[:8]
        headers = {"Authorization": f"Bearer {self.token}"}
        
        form_data = {
            'nom': f'{TEST_PREFIX}GetById',
            'prenom': 'GetById',
            'email': f'getbyid_{unique_id}@testformateur.com',
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        formateur_id = create_response.json()["id"]
        self.created_formateur_ids.append(formateur_id)
        
        # Get by ID
        get_response = self.session.get(f"{BASE_URL}/api/formateurs/{formateur_id}")
        
        assert get_response.status_code == 200, f"GET by ID failed: {get_response.text}"
        data = get_response.json()
        assert data["id"] == formateur_id
        assert data["nom"] == form_data['nom']
        assert data["prenom"] == form_data['prenom']
        assert data["email"] == form_data['email']
        print(f"✅ GET /api/formateurs/{formateur_id} returned correct data")
    
    def test_06_get_formateur_not_found(self):
        """Test GET /api/formateurs/{id} - Should return 404 for non-existent ID"""
        fake_id = str(uuid.uuid4())
        
        response = self.session.get(f"{BASE_URL}/api/formateurs/{fake_id}")
        
        assert response.status_code == 404, f"Should return 404, got: {response.status_code}"
        print(f"✅ GET non-existent formateur correctly returns 404")
    
    def test_07_update_formateur(self):
        """Test PUT /api/formateurs/{id} - Update a formateur"""
        # First create a formateur
        unique_id = str(uuid.uuid4())[:8]
        headers = {"Authorization": f"Bearer {self.token}"}
        
        form_data = {
            'nom': f'{TEST_PREFIX}ToUpdate',
            'prenom': 'ToUpdate',
            'email': f'toupdate_{unique_id}@testformateur.com',
            'telephone': '0600000000',
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        formateur_id = create_response.json()["id"]
        self.created_formateur_ids.append(formateur_id)
        
        # Update the formateur
        update_data = {
            'nom': f'{TEST_PREFIX}Updated',
            'telephone': '0699999999',
            'societe': 'Updated Company',
            'matieres': json.dumps(['Informatique', 'Bureautique'])
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/formateurs/{formateur_id}",
            data=update_data,
            headers=headers
        )
        
        assert update_response.status_code == 200, f"PUT failed: {update_response.text}"
        
        updated_data = update_response.json()
        assert updated_data["nom"] == update_data['nom'], "Nom should be updated"
        assert updated_data["telephone"] == update_data['telephone'], "Telephone should be updated"
        assert updated_data["societe"] == update_data['societe'], "Societe should be updated"
        assert updated_data["matieres"] == ['Informatique', 'Bureautique'], "Matieres should be updated"
        # Unchanged fields should remain
        assert updated_data["prenom"] == form_data['prenom'], "Prenom should remain unchanged"
        assert updated_data["email"] == form_data['email'], "Email should remain unchanged"
        
        print(f"✅ PUT /api/formateurs/{formateur_id} updated correctly")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/formateurs/{formateur_id}")
        assert get_response.status_code == 200
        fetched_data = get_response.json()
        assert fetched_data["nom"] == update_data['nom'], "Update should be persisted"
        print(f"✅ Update persistence verified via GET")
    
    def test_08_update_formateur_not_found(self):
        """Test PUT /api/formateurs/{id} - Should return 404 for non-existent ID"""
        fake_id = str(uuid.uuid4())
        headers = {"Authorization": f"Bearer {self.token}"}
        
        update_data = {'nom': 'ShouldFail'}
        
        response = requests.put(
            f"{BASE_URL}/api/formateurs/{fake_id}",
            data=update_data,
            headers=headers
        )
        
        assert response.status_code == 404, f"Should return 404, got: {response.status_code}"
        print(f"✅ PUT non-existent formateur correctly returns 404")
    
    def test_09_delete_formateur(self):
        """Test DELETE /api/formateurs/{id} - Delete a formateur"""
        # First create a formateur
        unique_id = str(uuid.uuid4())[:8]
        headers = {"Authorization": f"Bearer {self.token}"}
        
        form_data = {
            'nom': f'{TEST_PREFIX}ToDelete',
            'prenom': 'ToDelete',
            'email': f'todelete_{unique_id}@testformateur.com',
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/formateurs",
            data=form_data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        formateur_id = create_response.json()["id"]
        # Don't add to cleanup list since we're deleting it
        
        # Delete the formateur
        delete_response = self.session.delete(f"{BASE_URL}/api/formateurs/{formateur_id}")
        
        assert delete_response.status_code in [200, 204], f"DELETE failed: {delete_response.text}"
        print(f"✅ DELETE /api/formateurs/{formateur_id} succeeded")
        
        # Verify deletion with GET
        get_response = self.session.get(f"{BASE_URL}/api/formateurs/{formateur_id}")
        assert get_response.status_code == 404, "Deleted formateur should return 404"
        print(f"✅ Deletion verified - formateur no longer exists")
    
    def test_10_delete_formateur_not_found(self):
        """Test DELETE /api/formateurs/{id} - Should return 404 for non-existent ID"""
        fake_id = str(uuid.uuid4())
        
        response = self.session.delete(f"{BASE_URL}/api/formateurs/{fake_id}")
        
        assert response.status_code == 404, f"Should return 404, got: {response.status_code}"
        print(f"✅ DELETE non-existent formateur correctly returns 404")
    
    def test_11_get_existing_formateur(self):
        """Test GET /api/formateurs/{id} - Get the existing test formateur"""
        # Use the ID provided in the test request
        existing_id = "970d7951-ed4e-4389-aa6c-9314f7105f17"
        
        response = self.session.get(f"{BASE_URL}/api/formateurs/{existing_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found existing formateur: {data.get('prenom', '')} {data.get('nom', '')} (ID: {existing_id})")
            assert "id" in data
            assert "nom" in data
            assert "prenom" in data
            assert "email" in data
        elif response.status_code == 404:
            print(f"⚠️ Existing formateur {existing_id} not found (may have been deleted)")
            pytest.skip("Existing test formateur not found")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


class TestFormateursAccessControl:
    """Test access control for formateurs endpoints"""
    
    def test_unauthorized_access_get_list(self):
        """Test GET /api/formateurs without authentication"""
        response = requests.get(f"{BASE_URL}/api/formateurs")
        assert response.status_code in [401, 403], f"Should require auth, got: {response.status_code}"
        print(f"✅ GET /api/formateurs correctly requires authentication")
    
    def test_unauthorized_access_create(self):
        """Test POST /api/formateurs without authentication"""
        form_data = {
            'nom': 'Unauthorized',
            'prenom': 'Test',
            'email': 'unauthorized@test.com',
        }
        response = requests.post(f"{BASE_URL}/api/formateurs", data=form_data)
        assert response.status_code in [401, 403], f"Should require auth, got: {response.status_code}"
        print(f"✅ POST /api/formateurs correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
