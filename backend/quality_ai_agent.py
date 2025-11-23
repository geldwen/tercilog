"""
Agent IA responsable de la qualité
Analyse les questionnaires Q1, Q2, Q3 pour calculer :
- Score de progression
- Score de satisfaction  
- Difficultés rencontrées
"""

def calculate_quality_scores(q1_data, q2_data, q3_data):
    """
    Calcule les scores de qualité basés sur les réponses à échelle
    
    Returns:
        dict: {
            'score_ressenti_progression': int (0-100),
            'score_satisfaction': int (0-100),
            'difficulties': list[str],
            'mastered_skills': list[str]
        }
    """
    
    # === SCORE DE RESSENTI DE PROGRESSION (0-100) ===
    # Basé sur Q2 (mi-parcours) et Q3 (fin)
    progression_points = []
    
    # Q2 - Progression
    if q2_data:
        prog_q2 = q2_data.get('progression', '')
        prog_mapping = {
            'Beaucoup': 100,
            'Moyennement': 60,
            'Un peu': 30,
            'Pas du tout': 0
        }
        if prog_q2 in prog_mapping:
            progression_points.append(prog_mapping[prog_q2])
    
    # Q3 - Progression globale
    if q3_data:
        prog_global = q3_data.get('progression_globale', '')
        prog_mapping = {
            'Beaucoup': 100,
            'Moyennement': 60,
            'Un peu': 30,
            'Pas du tout': 0
        }
        if prog_global in prog_mapping:
            progression_points.append(prog_mapping[prog_global])
        
        # Q3 - Progressions spécifiques (Word, Excel, PowerPoint, etc.)
        specific_progs = [
            q3_data.get('progression_word', ''),
            q3_data.get('progression_excel', ''),
            q3_data.get('progression_powerpoint', ''),
            q3_data.get('progression_messagerie', ''),
            q3_data.get('progression_fichiers', '')
        ]
        
        specific_mapping = {
            'Forte': 100,
            'Moyenne': 60,
            'Faible': 30,
            'Aucune': 0
        }
        
        for prog in specific_progs:
            if prog in specific_mapping:
                progression_points.append(specific_mapping[prog])
        
        # Q3 - Objectifs atteints
        objectifs = q3_data.get('objectifs_atteints', '')
        obj_mapping = {
            'Totalement': 100,
            'En grande partie': 75,
            'Partiellement': 50,
            'Pas du tout': 0
        }
        if objectifs in obj_mapping:
            progression_points.append(obj_mapping[objectifs])
    
    score_progression = round(sum(progression_points) / len(progression_points)) if progression_points else 0
    
    # === SCORE DE SATISFACTION (0-100) ===
    # Basé principalement sur Q3
    satisfaction_points = []
    
    if q2_data:
        # Q2 - Correspondance avec la demande
        corresp = q2_data.get('correspondance_demande', '')
        corresp_mapping = {
            'Oui totalement': 100,
            'Plutôt oui': 75,
            'Plutôt non': 25,
            'Non pas du tout': 0
        }
        if corresp in corresp_mapping:
            satisfaction_points.append(corresp_mapping[corresp])
        
        # Q2 - Rythme
        rythme = q2_data.get('rythme', '')
        rythme_mapping = {
            'Adapté': 100,
            'Trop rapide': 50,
            'Trop lent': 50
        }
        if rythme in rythme_mapping:
            satisfaction_points.append(rythme_mapping[rythme])
    
    if q3_data:
        # Q3 - Évaluation globale de la formation
        eval_form = q3_data.get('evaluation_formation', '')
        eval_mapping = {
            'Très satisfaisante': 100,
            'Satisfaisante': 75,
            'Moyennement satisfaisante': 50,
            'Peu satisfaisante': 25,
            'Pas satisfaisante': 0
        }
        if eval_form in eval_mapping:
            satisfaction_points.append(eval_mapping[eval_form])
        
        # Q3 - Contenu adapté
        contenu = q3_data.get('contenu_adapte', '')
        contenu_mapping = {
            'Oui totalement': 100,
            'Plutôt oui': 75,
            'Plutôt non': 25,
            'Non pas du tout': 0
        }
        if contenu in contenu_mapping:
            satisfaction_points.append(contenu_mapping[contenu])
        
        # Q3 - Rythme de formation
        rythme_form = q3_data.get('rythme_formation', '')
        rythme_form_mapping = {
            'Adapté': 100,
            'Trop rapide': 50,
            'Trop lent': 50
        }
        if rythme_form in rythme_form_mapping:
            satisfaction_points.append(rythme_form_mapping[rythme_form])
        
        # Q3 - Pédagogie formateur
        pedagoie = q3_data.get('pedagogie_formateur', '')
        pedagoie_mapping = {
            'Excellente': 100,
            'Bonne': 80,
            'Moyenne': 50,
            'Insuffisante': 20
        }
        if pedagoie in pedagoie_mapping:
            satisfaction_points.append(pedagoie_mapping[pedagoie])
        
        # Q3 - Recommandation
        recomm = q3_data.get('recommandation', '')
        recomm_mapping = {
            'Oui': 100,
            'Peut-être': 50,
            'Non': 0
        }
        if recomm in recomm_mapping:
            satisfaction_points.append(recomm_mapping[recomm])
    
    score_satisfaction = round(sum(satisfaction_points) / len(satisfaction_points)) if satisfaction_points else 0
    
    # === DIFFICULTÉS RENCONTRÉES ===
    difficulties = []
    
    # Q2 - Difficultés à mi-parcours
    if q2_data and q2_data.get('rencontre_difficultes') == 'Oui':
        diff_fields = [
            ('difficultes_mise_en_page', 'Mise en page'),
            ('difficultes_formules', 'Formules Excel'),
            ('difficultes_filtres', 'Filtres et tableaux'),
            ('difficultes_diaporama', 'Création de diaporamas'),
            ('difficultes_mails', 'Gestion mails'),
            ('difficultes_fichiers', 'Organisation fichiers')
        ]
        
        for field, label in diff_fields:
            if q2_data.get(field) == True or q2_data.get(field) == 'Oui':
                difficulties.append(label)
        
        # Difficulté "autre"
        diff_autre = q2_data.get('difficultes_autre', '')
        if diff_autre and diff_autre.strip():
            difficulties.append(diff_autre.strip())
    
    # Q3 - Points à approfondir
    if q3_data:
        point_approfondir = q3_data.get('point_approfondir', '')
        if point_approfondir and point_approfondir.strip():
            # Ajouter seulement si ce n'est pas déjà dans les difficultés
            if point_approfondir.strip() not in difficulties:
                difficulties.append(f"À approfondir: {point_approfondir.strip()}")
    
    # Limiter à 5 difficultés maximum
    difficulties = difficulties[:5]
    
    # === ÉLÉMENTS MAÎTRISÉS ===
    mastered_skills = []
    
    # Q3 - Progressions spécifiques fortes (priorité)
    if q3_data:
        prog_skills = []
        if q3_data.get('progression_word') == 'Forte':
            prog_skills.append('Word')
        if q3_data.get('progression_excel') == 'Forte':
            prog_skills.append('Excel')
        if q3_data.get('progression_powerpoint') == 'Forte':
            prog_skills.append('PowerPoint')
        if q3_data.get('progression_messagerie') == 'Forte':
            prog_skills.append('Messagerie')
        if q3_data.get('progression_fichiers') == 'Forte':
            prog_skills.append('Gestion de fichiers')
        
        mastered_skills.extend(prog_skills)
    
    # Q3 - Progressions moyennes (si pas assez de fortes)
    if q3_data and len(mastered_skills) < 3:
        if q3_data.get('progression_word') == 'Moyenne' and 'Word' not in mastered_skills:
            mastered_skills.append('Word (niveau moyen)')
        if q3_data.get('progression_excel') == 'Moyenne' and 'Excel' not in mastered_skills:
            mastered_skills.append('Excel (niveau moyen)')
        if q3_data.get('progression_powerpoint') == 'Moyenne' and 'PowerPoint' not in mastered_skills:
            mastered_skills.append('PowerPoint (niveau moyen)')
    
    # Q3 - Objectifs atteints
    if q3_data and len(mastered_skills) < 3:
        objectifs = q3_data.get('objectifs_atteints', '')
        if objectifs in ['Totalement', 'En grande partie']:
            mastered_skills.append('Objectifs atteints')
    
    # Limiter à 5 éléments maîtrisés maximum
    mastered_skills = list(dict.fromkeys(mastered_skills))[:5]  # Dédupliquer en gardant l'ordre
    
    return {
        'score_ressenti_progression': score_progression,
        'score_satisfaction': score_satisfaction,
        'difficulties': difficulties,
        'mastered_skills': mastered_skills
    }
