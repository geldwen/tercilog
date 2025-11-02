"""
Migration script to add confirmation_status and confirmation_at to existing sessions
Safe migration that preserves all existing data
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL')

async def migrate_sessions():
    """Migrate existing sessions to add confirmation_status"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.tercilog
    
    print("Starting migration...")
    
    # Get all sessions
    sessions = await db.sessions.find({}, {"_id": 0}).to_list(10000)
    print(f"Found {len(sessions)} sessions to migrate")
    
    updated_count = 0
    
    for session in sessions:
        session_id = session.get('id')
        
        # Skip if already has confirmation_status
        if 'confirmation_status' in session:
            continue
        
        # Determine confirmation_status based on current state
        now = datetime.now(timezone.utc)
        
        try:
            # Parse session end time
            date_str = session.get('date', '')
            end_time_str = session.get('end_time', '')
            
            if date_str and end_time_str:
                session_end = datetime.strptime(f"{date_str} {end_time_str}", '%Y-%m-%d %H:%M')
                session_end = session_end.replace(tzinfo=timezone.utc)
            else:
                session_end = None
        except:
            session_end = None
        
        # Migration logic
        update_data = {}
        
        # If session ended AND student signed → confirmed
        if session_end and session_end < now and session.get('signature_status') == 'signed':
            update_data['confirmation_status'] = 'confirmed'
            # Use signed_at as confirmation_at fallback
            update_data['confirmation_at'] = session.get('signed_at', now.isoformat())
        # If session is confirmed by teacher → pending (student needs to confirm)
        elif session.get('status') == 'confirmed':
            update_data['confirmation_status'] = 'pending'
            update_data['confirmation_at'] = None
        else:
            # Default: pending
            update_data['confirmation_status'] = 'pending'
            update_data['confirmation_at'] = None
        
        # Update session
        await db.sessions.update_one(
            {"id": session_id},
            {"$set": update_data}
        )
        updated_count += 1
    
    print(f"Migration complete! Updated {updated_count} sessions")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_sessions())
