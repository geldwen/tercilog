# Endpoints pour les questionnaires Bureautique (Q1, Q2, Q3)
# À intégrer dans server.py

# =====================================================
# QUESTIONNAIRE 1 - BUREAUTIQUE - BESOINS EN FORMATION
# =====================================================

@api_router.post("/students/{student_id}/bureautique-formation-needs")
async def submit_bureautique_formation_needs(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire des besoins en formation - Bureautique"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Ajouter l'ID et la date
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Vérifier si un questionnaire existe déjà
    existing = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        # Mettre à jour
        await db.bureautique_formation_needs_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Bureautique formation needs questionnaire updated for student {student_id}")
    else:
        # Créer
        await db.bureautique_formation_needs_questionnaires.insert_one(questionnaire)
        logger.info(f"Bureautique formation needs questionnaire submitted for student {student_id}")
    
    return {"message": "Questionnaire Bureautique soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-formation-needs")
async def get_bureautique_formation_needs(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire des besoins en formation - Bureautique"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-formation-needs/pdf")
async def get_bureautique_formation_needs_pdf(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Générer et télécharger le PDF du questionnaire Bureautique Q1"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    student = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    questionnaire = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    # Générer le PDF
    pdf_bytes = generate_bureautique_formation_needs_pdf(student, questionnaire)
    
    # Retourner le PDF
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Q1_Bureautique_BesoinsFormation_{student['name'].replace(' ', '_')}.pdf"}
    )


@api_router.post("/students/{student_id}/bureautique-formation-needs/send-email")
async def send_bureautique_formation_needs_email(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le questionnaire Bureautique Q1 par email"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Récupérer l'élève et le questionnaire
    student = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    questionnaire = await db.bureautique_formation_needs_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    # Générer le PDF
    pdf_bytes = generate_bureautique_formation_needs_pdf(student, questionnaire)
    
    # Envoyer l'email
    try:
        to_emails = data.get('to', [])
        if isinstance(to_emails, str):
            to_emails = [to_emails]
        
        subject = data.get('subject', 'Questionnaire de besoins en formation - Bureautique')
        body = data.get('message', f"Veuillez trouver ci-joint le questionnaire de besoins en formation Bureautique de {student['name']}.")
        
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_PASSWORD')
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        # Corps du message
        msg.attach(MIMEText(body, 'plain'))
        
        # Attacher le PDF
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename=Q1_Bureautique_{student["name"].replace(" ", "_")}.pdf')
        msg.attach(part)
        
        # Envoyer
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Bureautique formation needs questionnaire emailed to {to_emails} for student {student_id}")
        return {"message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Error sending bureautique formation needs email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


# =====================================================
# QUESTIONNAIRE 2 - BUREAUTIQUE - MI-PARCOURS
# =====================================================

@api_router.post("/students/{student_id}/bureautique-mid-course-questionnaire")
async def submit_bureautique_mid_course_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire à mi-parcours - Bureautique"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        await db.bureautique_mid_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Bureautique mid-course questionnaire updated for student {student_id}")
    else:
        await db.bureautique_mid_course_questionnaires.insert_one(questionnaire)
        logger.info(f"Bureautique mid-course questionnaire submitted for student {student_id}")
    
    return {"message": "Questionnaire Bureautique à mi-parcours soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-mid-course-questionnaire")
async def get_bureautique_mid_course_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire à mi-parcours - Bureautique"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-mid-course-questionnaire/pdf")
async def get_bureautique_mid_course_questionnaire_pdf(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Générer et télécharger le PDF du questionnaire Bureautique Q2"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    student = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    questionnaire = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    pdf_bytes = generate_bureautique_mid_course_questionnaire_pdf(student, questionnaire)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Q2_Bureautique_MiParcours_{student['name'].replace(' ', '_')}.pdf"}
    )


@api_router.post("/students/{student_id}/bureautique-mid-course-questionnaire/send-email")
async def send_bureautique_mid_course_questionnaire_email(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le questionnaire Bureautique Q2 par email"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    student = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    questionnaire = await db.bureautique_mid_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    pdf_bytes = generate_bureautique_mid_course_questionnaire_pdf(student, questionnaire)
    
    try:
        to_emails = data.get('to', [])
        if isinstance(to_emails, str):
            to_emails = [to_emails]
        
        subject = data.get('subject', 'Questionnaire à mi-parcours - Bureautique')
        body = data.get('message', f"Veuillez trouver ci-joint le questionnaire à mi-parcours Bureautique de {student['name']}.")
        
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_PASSWORD')
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename=Q2_Bureautique_{student["name"].replace(" ", "_")}.pdf')
        msg.attach(part)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Bureautique mid-course questionnaire emailed to {to_emails} for student {student_id}")
        return {"message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Error sending bureautique mid-course email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


# =====================================================
# QUESTIONNAIRE 3 - BUREAUTIQUE - FIN DE FORMATION
# =====================================================

@api_router.post("/students/{student_id}/bureautique-end-course-questionnaire")
async def submit_bureautique_end_course_questionnaire(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Soumettre le questionnaire de fin de formation - Bureautique"""
    if current_user.role != "student" or current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "parcours": "Bureautique",
        **data,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if existing:
        await db.bureautique_end_course_questionnaires.update_one(
            {"student_id": student_id},
            {"$set": questionnaire}
        )
        logger.info(f"Bureautique end-course questionnaire updated for student {student_id}")
    else:
        await db.bureautique_end_course_questionnaires.insert_one(questionnaire)
        logger.info(f"Bureautique end-course questionnaire submitted for student {student_id}")
    
    return {"message": "Questionnaire Bureautique de fin de formation soumis avec succès", "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-end-course-questionnaire")
async def get_bureautique_end_course_questionnaire(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupérer le questionnaire de fin de formation - Bureautique"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    questionnaire = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    
    if not questionnaire:
        return {"exists": False}
    
    return {"exists": True, "questionnaire": questionnaire}


@api_router.get("/students/{student_id}/bureautique-end-course-questionnaire/pdf")
async def get_bureautique_end_course_questionnaire_pdf(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Générer et télécharger le PDF du questionnaire Bureautique Q3"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    student = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    questionnaire = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    pdf_bytes = generate_bureautique_end_course_questionnaire_pdf(student, questionnaire)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Q3_Bureautique_FinFormation_{student['name'].replace(' ', '_')}.pdf"}
    )


@api_router.post("/students/{student_id}/bureautique-end-course-questionnaire/send-email")
async def send_bureautique_end_course_questionnaire_email(
    student_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Envoyer le questionnaire Bureautique Q3 par email"""
    if current_user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    student = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    questionnaire = await db.bureautique_end_course_questionnaires.find_one({"student_id": student_id}, {"_id": 0})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    pdf_bytes = generate_bureautique_end_course_questionnaire_pdf(student, questionnaire)
    
    try:
        to_emails = data.get('to', [])
        if isinstance(to_emails, str):
            to_emails = [to_emails]
        
        subject = data.get('subject', 'Questionnaire de fin de formation - Bureautique')
        body = data.get('message', f"Veuillez trouver ci-joint le questionnaire de fin de formation Bureautique de {student['name']}.")
        
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_PASSWORD')
        
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename=Q3_Bureautique_{student["name"].replace(" ", "_")}.pdf')
        msg.attach(part)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Bureautique end-course questionnaire emailed to {to_emails} for student {student_id}")
        return {"message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Error sending bureautique end-course email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")
