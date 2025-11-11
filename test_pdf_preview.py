#!/usr/bin/env python3
"""
Simple test script for PDF preview endpoint
"""

import sys
sys.path.append('/app')

from backend_test import TerciFormTester

def main():
    tester = TerciFormTester()
    
    # Check if the method exists
    if hasattr(tester, 'test_pdf_preview_endpoint'):
        print("✅ Method test_pdf_preview_endpoint found")
        success = tester.test_pdf_preview_endpoint()
        if success:
            print("✅ PDF Preview test completed successfully")
        else:
            print("❌ PDF Preview test failed")
    else:
        print("❌ Method test_pdf_preview_endpoint not found")
        print("Available methods:")
        methods = [method for method in dir(tester) if method.startswith('test_')]
        for method in methods:
            print(f"  - {method}")

if __name__ == "__main__":
    main()