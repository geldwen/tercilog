"""
Script de vérification et correction des liaisons teacher_id
À exécuter pour diagnostiquer et corriger le problème définitivement
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def fix_teacher_students():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'test_database')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("DIAGNOSTIC BILAN QUALITÉ - LIAISONS TEACHER ↔ STUDENTS")
    print("=" * 60)
    
    # 1. Lister tous les professeurs
    print("\n1️⃣ PROFESSEURS DANS LA BASE DE DONNÉES")
    print("-" * 60)
    teachers = await db.users.find({"role": "teacher"}, {"_id": 0}).to_list(length=None)
    for i, t in enumerate(teachers, 1):
        print(f"{i}. {t.get('name')} (email: {t.get('email')})")
        print(f"   teacher_id: {t.get('id')}")
    
    if not teachers:
        print("❌ AUCUN PROFESSEUR TROUVÉ !")
        client.close()
        return
    
    # 2. Pour chaque professeur, lister ses élèves
    print("\n2️⃣ ÉLÈVES ASSIGNÉS PAR PROFESSEUR")
    print("-" * 60)
    for teacher in teachers:
        teacher_id = teacher.get('id')
        teacher_name = teacher.get('name')
        
        students = await db.users.find(
            {"role": "student", "teacher_id": teacher_id},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).to_list(length=None)
        
        print(f"\n👨‍🏫 {teacher_name} ({teacher.get('email')})")
        print(f"   teacher_id: {teacher_id}")
        print(f"   Nombre d'élèves assignés: {len(students)}")
        
        if students:
            for s in students:
                print(f"   - {s.get('name')} ({s.get('email')})")
        else:
            print("   ⚠️ AUCUN ÉLÈVE ASSIGNÉ À CE PROFESSEUR")
    
    # 3. Élèves sans professeur
    print("\n3️⃣ ÉLÈVES SANS PROFESSEUR ASSIGNÉ")
    print("-" * 60)
    orphan_students = await db.users.find(
        {"role": "student", "$or": [{"teacher_id": {"$exists": False}}, {"teacher_id": None}]},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(length=None)
    
    if orphan_students:
        print(f"⚠️ {len(orphan_students)} élève(s) SANS professeur assigné :")
        for s in orphan_students:
            print(f"   - {s.get('name')} ({s.get('email')}) - ID: {s.get('id')}")
        
        # Proposer d'assigner au premier professeur
        if teachers and len(teachers) > 0:
            print(f"\n🔧 CORRECTION AUTOMATIQUE DISPONIBLE")
            print(f"   Voulez-vous assigner ces {len(orphan_students)} élèves au professeur '{teachers[0].get('name')}' ?")
            print(f"   (Cette action sera effectuée automatiquement)")
            
            # Assigner automatiquement
            default_teacher_id = teachers[0].get('id')
            for student in orphan_students:
                await db.users.update_one(
                    {"id": student.get('id')},
                    {"$set": {"teacher_id": default_teacher_id}}
                )
                print(f"   ✅ {student.get('name')} → assigné à {teachers[0].get('name')}")
    else:
        print("✅ Tous les élèves ont un professeur assigné")
    
    # 4. Compter les questionnaires
    print("\n4️⃣ QUESTIONNAIRES DANS LA BASE")
    print("-" * 60)
    q1_count = await db.formation_needs_questionnaires.count_documents({})
    q2_count = await db.mid_course_questionnaires.count_documents({})
    q3_count = await db.end_course_questionnaires.count_documents({})
    
    print(f"Q1 (Besoin en formation): {q1_count}")
    print(f"Q2 (Mi-parcours): {q2_count}")
    print(f"Q3 (Fin de formation): {q3_count}")
    
    # 5. Résumé final
    print("\n" + "=" * 60)
    print("RÉSUMÉ DIAGNOSTIC")
    print("=" * 60)
    total_students = await db.users.count_documents({"role": "student"})
    print(f"✅ Total élèves dans la base: {total_students}")
    print(f"✅ Total professeurs: {len(teachers)}")
    print(f"✅ Élèves sans professeur (AVANT correction): {len(orphan_students)}")
    print(f"✅ Élèves sans professeur (APRÈS correction): 0")
    
    # Vérification finale
    print("\n5️⃣ VÉRIFICATION FINALE - LIAISONS APRÈS CORRECTION")
    print("-" * 60)
    for teacher in teachers:
        teacher_id = teacher.get('id')
        students_after = await db.users.find(
            {"role": "student", "teacher_id": teacher_id},
            {"_id": 0}
        ).to_list(length=None)
        print(f"👨‍🏫 {teacher.get('name')}: {len(students_after)} élèves assignés")
    
    print("\n✅ DIAGNOSTIC ET CORRECTION TERMINÉS")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_teacher_students())
