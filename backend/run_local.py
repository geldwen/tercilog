"""
Lance le backend en local avec une base MongoDB simulée (mongomock-motor), pour tester
l'intégration front <-> back sans dépendre du vrai cluster Atlas (inaccessible depuis ce
bac à sable). Usage : python run_local.py
"""
import os
os.environ.setdefault("SECRET_KEY", "local-dev-secret")
os.environ.setdefault("CORS_ORIGINS", "*")

import asyncio
from mongomock_motor import AsyncMongoMockClient
import database

fake_client = AsyncMongoMockClient()
database.set_db_for_tests(fake_client["terciform_local"])

import uvicorn
import server  # noqa: E402  (doit être importé après le patch de la db)

if __name__ == "__main__":
    uvicorn.run(server.app, host="0.0.0.0", port=8000, log_level="info")
