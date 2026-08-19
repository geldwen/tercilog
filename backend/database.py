"""
Connexion MongoDB (Motor, async).
En local/tests, MONGO_URL peut pointer vers mongomock-motor (voir conftest.py des tests).
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "terciform")

_client = None
_db = None


def get_client():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[DB_NAME]
    return _db


def set_db_for_tests(fake_db):
    """Permet aux tests d'injecter une base mongomock-motor sans passer par l'env."""
    global _db
    _db = fake_db
