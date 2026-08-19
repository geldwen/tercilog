import os
import sys
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("BREVO_API_KEY", "")  # mode dev : pas d'envoi réel


@pytest_asyncio.fixture
async def app_client():
    from mongomock_motor import AsyncMongoMockClient
    import database

    fake_client = AsyncMongoMockClient()
    fake_db = fake_client["terciform_test"]
    database.set_db_for_tests(fake_db)

    import importlib
    import server
    importlib.reload(server)  # s'assure que server.py utilise bien get_db() dynamiquement

    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=server.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
