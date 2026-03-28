"""
Test suite for Pedagogical Resources feature
Tests: GET resources, unlock/lock by admin, case-insensitive parcours matching
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "terciform@gmail.com"
ADMIN_PASSWORD = "Geldwen1982*+"
STUDENT_EXCEL_EMAIL = "test.excel@test.com"
STUDENT_EXCEL_PASSWORD = "Excel2024!"
STUDENT_EXCEL_ID = "2419b94d-085a-426f-9f33-0be54fc3f61f"
INFORMATIQUE_STUDENT_ID = "38dc68f9-409c-40c1-a346-7af2fc4cb15f"


class TestPedagogicalResourcesAPI:
    """Tests for pedagogical resources endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EXCEL_EMAIL,
            "password": STUDENT_EXCEL_PASSWORD
        })
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Admin auth headers"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def student_headers(self, student_token):
        """Student auth headers"""
        return {"Authorization": f"Bearer {student_token}", "Content-Type": "application/json"}
    
    # ============ GET PEDAGOGICAL RESOURCES TESTS ============
    
    def test_get_resources_excel_student_returns_has_resources_true(self, student_headers):
        """Excel student should see has_resources: true with supports and evaluations"""
        response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources",
            headers=student_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify has_resources is True
        assert data.get("has_resources") == True, f"Expected has_resources=True, got {data}"
        
        # Verify supports exist
        assert "supports" in data, "Missing 'supports' key"
        assert len(data["supports"]) > 0, "No supports returned"
        
        # Verify evaluations exist
        assert "evaluations" in data, "Missing 'evaluations' key"
        assert len(data["evaluations"]) > 0, "No evaluations returned"
        
        print(f"✅ Excel student has {len(data['supports'])} supports and {len(data['evaluations'])} evaluations")
    
    def test_get_resources_admin_can_view_student_resources(self, admin_headers):
        """Admin should be able to view any student's pedagogical resources"""
        response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("has_resources") == True
        print("✅ Admin can view student pedagogical resources")
    
    def test_get_resources_informatique_student_returns_resources(self, admin_headers):
        """Informatique student should also get Excel resources (case-insensitive matching)"""
        response = requests.get(
            f"{BASE_URL}/api/students/{INFORMATIQUE_STUDENT_ID}/pedagogical-resources",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should match 'informatique' keyword and return Excel resources
        assert data.get("has_resources") == True, f"Expected has_resources=True for Informatique student, got {data}"
        print(f"✅ Informatique student has resources: {data.get('has_resources')}")
    
    def test_get_resources_nonexistent_student_returns_404(self, admin_headers):
        """Non-existent student should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/students/nonexistent-student-id/pedagogical-resources",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent student returns 404")
    
    def test_get_resources_unauthenticated_returns_401_or_403(self):
        """Unauthenticated request should return 401 or 403"""
        response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources"
        )
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"✅ Unauthenticated request returns {response.status_code}")
    
    def test_get_resources_student_cannot_view_other_student(self, student_headers):
        """Student should not be able to view another student's resources"""
        response = requests.get(
            f"{BASE_URL}/api/students/{INFORMATIQUE_STUDENT_ID}/pedagogical-resources",
            headers=student_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Student cannot view other student's resources")
    
    # ============ UNLOCK RESOURCE TESTS ============
    
    def test_unlock_resource_admin_can_unlock(self, admin_headers):
        """Admin (teacher) can unlock a resource for a student"""
        resource_id = "excel-eval-1"  # First evaluation
        
        response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/unlock",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to unlock: {response.text}"
        data = response.json()
        
        # Should return success message
        assert "message" in data
        assert data.get("unlocked") == True or data.get("already_unlocked") == True
        print(f"✅ Admin unlocked resource: {data.get('message')}")
    
    def test_unlock_resource_already_unlocked(self, admin_headers):
        """Unlocking already unlocked resource should return already_unlocked"""
        resource_id = "excel-eval-1"
        
        response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/unlock",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("already_unlocked") == True or data.get("unlocked") == True
        print("✅ Already unlocked resource handled correctly")
    
    def test_unlock_resource_student_cannot_unlock(self, student_headers):
        """Student should not be able to unlock resources"""
        resource_id = "excel-eval-2"
        
        response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/unlock",
            headers=student_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Student cannot unlock resources")
    
    def test_unlock_nonexistent_resource_returns_404(self, admin_headers):
        """Unlocking non-existent resource should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/nonexistent-resource/unlock",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent resource returns 404")
    
    # ============ LOCK RESOURCE TESTS ============
    
    def test_lock_resource_admin_can_lock(self, admin_headers):
        """Admin (teacher) can lock a resource for a student"""
        resource_id = "excel-eval-1"
        
        response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/lock",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to lock: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert data.get("locked") == True or data.get("already_locked") == True
        print(f"✅ Admin locked resource: {data.get('message')}")
    
    def test_lock_resource_student_cannot_lock(self, student_headers):
        """Student should not be able to lock resources"""
        resource_id = "excel-eval-1"
        
        response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/lock",
            headers=student_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Student cannot lock resources")
    
    # ============ VERIFY UNLOCK STATUS IN GET ============
    
    def test_unlock_then_verify_in_get(self, admin_headers):
        """Unlock a resource and verify it shows as unlocked in GET"""
        resource_id = "excel-module-35h"  # Support resource
        
        # First unlock
        unlock_response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/unlock",
            headers=admin_headers
        )
        assert unlock_response.status_code == 200
        
        # Then GET and verify
        get_response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources",
            headers=admin_headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Find the support resource
        support = next((s for s in data.get("supports", []) if s["id"] == resource_id), None)
        assert support is not None, f"Support {resource_id} not found"
        assert support.get("unlocked") == True, f"Expected unlocked=True, got {support}"
        assert support.get("unlocked_at") is not None, "Missing unlocked_at timestamp"
        
        print(f"✅ Resource shows as unlocked with timestamp: {support.get('unlocked_at')}")
    
    def test_lock_then_verify_in_get(self, admin_headers):
        """Lock a resource and verify it shows as locked in GET"""
        resource_id = "excel-module-35h"
        
        # First lock
        lock_response = requests.post(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/lock",
            headers=admin_headers
        )
        assert lock_response.status_code == 200
        
        # Then GET and verify
        get_response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources",
            headers=admin_headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Find the support resource
        support = next((s for s in data.get("supports", []) if s["id"] == resource_id), None)
        assert support is not None
        assert support.get("unlocked") == False, f"Expected unlocked=False, got {support}"
        
        print("✅ Resource shows as locked after locking")
    
    # ============ DOWNLOAD TESTS ============
    
    def test_download_locked_resource_student_returns_403(self, student_headers):
        """Student cannot download locked resource"""
        resource_id = "excel-eval-2"  # Should be locked
        
        response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/download",
            headers=student_headers
        )
        # Should be 403 if locked, or 200/404 if unlocked/file missing
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"
        print(f"✅ Download locked resource returns {response.status_code}")
    
    def test_download_admin_can_always_download(self, admin_headers):
        """Admin can download any resource regardless of lock status"""
        resource_id = "excel-eval-1"
        
        response = requests.get(
            f"{BASE_URL}/api/students/{STUDENT_EXCEL_ID}/pedagogical-resources/{resource_id}/download",
            headers=admin_headers
        )
        # Should be 200 (file exists) or 404 (file not found on server)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"✅ Admin download returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
