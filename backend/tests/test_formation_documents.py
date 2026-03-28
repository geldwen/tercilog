"""
Test suite for Programme de Formation & Contrat de Formation endpoints
Tests: GET /api/documents/programme, GET /api/documents/contrat, 
       POST /api/students/{id}/sign-document, GET /api/students/{id}/formation-signatures
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
STUDENT_EMAIL = "test.excel@test.com"
STUDENT_PASSWORD = "Excel2024!"
STUDENT_ID = "2419b94d-085a-426f-9f33-0be54fc3f61f"

ADMIN_EMAIL = "terciform@gmail.com"
ADMIN_PASSWORD = "Geldwen1982*+"


@pytest.fixture(scope="function")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="function")
def student_token(api_client):
    """Get student authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Student authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="function")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def reset_student_signatures(api_client, admin_token):
    """Reset student signatures before tests"""
    # Use MongoDB to reset signatures - we'll do this via a direct API call if available
    # For now, we'll just proceed with tests
    yield
    # Cleanup after tests if needed


class TestDocumentDownload:
    """Tests for document download endpoints"""
    
    def test_get_programme_returns_200_and_pdf(self, api_client, student_token):
        """GET /api/documents/programme returns 200 and a PDF"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/programme",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.headers.get("content-type") == "application/pdf", f"Expected PDF, got {response.headers.get('content-type')}"
        assert len(response.content) > 0, "PDF content should not be empty"
        print(f"✓ Programme PDF downloaded successfully, size: {len(response.content)} bytes")
    
    def test_get_contrat_returns_200_and_pdf(self, api_client, student_token):
        """GET /api/documents/contrat returns 200 and a PDF"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/contrat",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.headers.get("content-type") == "application/pdf", f"Expected PDF, got {response.headers.get('content-type')}"
        assert len(response.content) > 0, "PDF content should not be empty"
        print(f"✓ Contrat PDF downloaded successfully, size: {len(response.content)} bytes")
    
    def test_get_programme_unauthenticated_returns_401(self, api_client):
        """GET /api/documents/programme without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/documents/programme")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated access to programme correctly rejected")
    
    def test_get_contrat_unauthenticated_returns_401(self, api_client):
        """GET /api/documents/contrat without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/documents/contrat")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated access to contrat correctly rejected")


class TestFormationSignatures:
    """Tests for formation signatures endpoint"""
    
    def test_get_formation_signatures_returns_200(self, api_client, student_token):
        """GET /api/students/{id}/formation-signatures returns programme and contrat signature status"""
        response = api_client.get(
            f"{BASE_URL}/api/students/{STUDENT_ID}/formation-signatures",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "programme" in data, "Response should contain 'programme' key"
        assert "contrat" in data, "Response should contain 'contrat' key"
        assert "signed" in data["programme"], "Programme should have 'signed' field"
        assert "signed" in data["contrat"], "Contrat should have 'signed' field"
        print(f"✓ Formation signatures retrieved: programme={data['programme']}, contrat={data['contrat']}")
    
    def test_get_formation_signatures_unauthenticated_returns_401(self, api_client):
        """GET /api/students/{id}/formation-signatures without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/students/{STUDENT_ID}/formation-signatures")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated access to formation signatures correctly rejected")
    
    def test_get_formation_signatures_admin_can_view(self, api_client, admin_token):
        """Admin can view any student's formation signatures"""
        response = api_client.get(
            f"{BASE_URL}/api/students/{STUDENT_ID}/formation-signatures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "programme" in data and "contrat" in data
        print("✓ Admin can view student formation signatures")


class TestSignDocument:
    """Tests for document signing endpoint"""
    
    def test_sign_programme_success(self, api_client, student_token):
        """POST /api/students/{id}/sign-document with document_type='programme' saves signature successfully"""
        response = api_client.post(
            f"{BASE_URL}/api/students/{STUDENT_ID}/sign-document",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "document_type": "programme",
                "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "accepted_checkbox": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "signed_at" in data, "Response should contain signed_at timestamp"
        print(f"✓ Programme signed successfully at {data.get('signed_at')}")
    
    def test_sign_contrat_success(self, api_client, student_token):
        """POST /api/students/{id}/sign-document with document_type='contrat' saves signature successfully"""
        response = api_client.post(
            f"{BASE_URL}/api/students/{STUDENT_ID}/sign-document",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "document_type": "contrat",
                "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "accepted_checkbox": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "signed_at" in data, "Response should contain signed_at timestamp"
        print(f"✓ Contrat signed successfully at {data.get('signed_at')}")
    
    def test_sign_invalid_document_type_returns_400(self, api_client, student_token):
        """POST /api/students/{id}/sign-document with invalid document_type returns 400"""
        response = api_client.post(
            f"{BASE_URL}/api/students/{STUDENT_ID}/sign-document",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "document_type": "invalid_type",
                "signature": "data:image/png;base64,test",
                "accepted_checkbox": True
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid document type correctly rejected with 400")
    
    def test_sign_document_unauthenticated_returns_401(self, api_client):
        """POST /api/students/{id}/sign-document without auth returns 401"""
        response = api_client.post(
            f"{BASE_URL}/api/students/{STUDENT_ID}/sign-document",
            json={
                "document_type": "programme",
                "signature": "data:image/png;base64,test",
                "accepted_checkbox": True
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated sign request correctly rejected")
    
    def test_verify_signatures_persisted(self, api_client, student_token):
        """Verify that signatures are persisted after signing"""
        response = api_client.get(
            f"{BASE_URL}/api/students/{STUDENT_ID}/formation-signatures",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["programme"]["signed"] == True, "Programme should be marked as signed"
        assert data["contrat"]["signed"] == True, "Contrat should be marked as signed"
        assert data["programme"]["signed_at"] is not None, "Programme should have signed_at timestamp"
        assert data["contrat"]["signed_at"] is not None, "Contrat should have signed_at timestamp"
        print(f"✓ Signatures verified as persisted: programme signed at {data['programme']['signed_at']}, contrat signed at {data['contrat']['signed_at']}")


class TestSignDocumentEdgeCases:
    """Edge case tests for document signing"""
    
    def test_sign_nonexistent_student_returns_404(self, api_client, admin_token):
        """POST /api/students/{invalid_id}/sign-document returns 404"""
        response = api_client.post(
            f"{BASE_URL}/api/students/nonexistent-student-id/sign-document",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "document_type": "programme",
                "signature": "data:image/png;base64,test",
                "accepted_checkbox": True
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Nonexistent student correctly returns 404")
    
    def test_get_signatures_nonexistent_student_returns_404(self, api_client, admin_token):
        """GET /api/students/{invalid_id}/formation-signatures returns 404"""
        response = api_client.get(
            f"{BASE_URL}/api/students/nonexistent-student-id/formation-signatures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Nonexistent student signatures correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
