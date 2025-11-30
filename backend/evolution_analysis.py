# ---------------------------------------------------------
# Algorithme d'analyse d'évolution des compétences
# Pour TerciForm - Conforme aux exigences Qualiopi
# ---------------------------------------------------------

def categoriser_score(score):
    """
    Transforme un score (%) en niveau qualitatif simple.
    """
    if score is None:
        return "non évalué"
    if score < 20:
        return "pas bon"              # Non acquis
    elif score <= 50:
        return "moyen"                # En cours d'acquisition
    else:
        return "bon"                  # Acquis


def analyser_evolution_globale(t1, t2, t3):
    """
    Analyse l'évolution globale entre les trois tests.
    Retourne :
    - tendance (mot clé)
    - phrase courte lisible
    - couleur (pour l'interface)
    """
    n1 = categoriser_score(t1)
    n2 = categoriser_score(t2)
    n3 = categoriser_score(t3)

    evolution = (n1, n2, n3)

    # Cas principaux
    if evolution in [
        ("pas bon", "moyen", "bon"),
        ("pas bon", "moyen", "moyen"),
        ("moyen", "bon", "bon"),
    ]:
        tendance = "progression"
        phrase = "L'apprenant est en progression globale sur le parcours."
        couleur = "vert"

    elif evolution in [
        ("pas bon", "pas bon", "moyen"),
        ("pas bon", "pas bon", "pas bon"),
        ("pas bon", "moyen", "pas bon"),
        ("moyen", "moyen", "moyen"),
    ]:
        tendance = "progression légère ou stagnation"
        phrase = "L'apprenant progresse légèrement ou reste sur un niveau stable."
        couleur = "jaune"

    elif evolution in [
        ("pas bon", "moyen", "pas bon"),
        ("moyen", "bon", "moyen"),
        ("moyen", "bon", "pas bon"),
    ]:
        tendance = "courbe en cloche"
        phrase = "L'apprenant a progressé en milieu de parcours mais n'a pas stabilisé ses acquis."
        couleur = "jaune"

    elif evolution in [
        ("bon", "moyen", "pas bon"),
        ("bon", "bon", "moyen"),
        ("bon", "moyen", "moyen"),
        ("moyen", "moyen", "pas bon"),
    ]:
        tendance = "régression"
        phrase = "L'apprenant est en régression par rapport à son niveau initial."
        couleur = "rouge"
    else:
        tendance = "évolution mixte"
        phrase = "L'évolution de l'apprenant est irrégulière, à analyser au cas par cas."
        couleur = "gris"

    return {
        "niveau_t1": n1,
        "niveau_t2": n2,
        "niveau_t3": n3,
        "tendance": tendance,
        "phrase_tendance": phrase,
        "couleur": couleur,
    }


def analyser_resultat_final(t3):
    """
    Analyse le résultat du test final (T3).
    Retourne :
    - niveau_final (pas bon / moyen / bon)
    - phrase simple
    """
    niveau_final = categoriser_score(t3)

    if niveau_final == "pas bon":
        phrase = "Le niveau final reste insuffisant sur ce parcours."
    elif niveau_final == "moyen":
        phrase = "Le niveau final est en cours d'acquisition : les bases sont présentes mais encore fragiles."
    elif niveau_final == "bon":
        phrase = "Le niveau final est satisfaisant : les objectifs du parcours sont globalement atteints."
    else:
        phrase = "Le niveau final n'a pas pu être évalué."

    return {
        "niveau_final": niveau_final,
        "phrase_resultat": phrase
    }


def analyser_themes(themes):
    """
    Classe les thèmes en :
    - acquis
    - en cours d'acquisition
    - non acquis
    Et propose une liste simple pour chaque catégorie.
    """
    acquis = []
    en_cours = []
    non_acquis = []

    for theme in themes:
        nom = theme.get("nom")
        score = theme.get("score_t3")
        niveau = categoriser_score(score)

        if niveau == "bon":
            acquis.append(nom)
        elif niveau == "moyen":
            en_cours.append(nom)
        elif niveau == "pas bon":
            non_acquis.append(nom)

    return {
        "themes_acquis": acquis,
        "themes_en_cours": en_cours,
        "themes_non_acquis": non_acquis,
    }


def proposer_remediation(themes_analysis, parcours):
    """
    Propose des actions concrètes :
    - pour l'apprenant
    - pour TerciForm (dispositif)
    en fonction des thèmes non acquis / en cours.
    """
    non_acquis = themes_analysis["themes_non_acquis"]
    en_cours = themes_analysis["themes_en_cours"]

    actions_apprenant = []
    actions_organisme = []

    # Remédiation par défaut selon les difficultés
    if non_acquis:
        actions_apprenant.append(
            "Revoir les bases sur : " + ", ".join(non_acquis) + "."
        )
        actions_organisme.append(
            "Proposer des exercices guidés et pas à pas sur les thèmes non acquis."
        )

    if en_cours:
        actions_apprenant.append(
            "Consolider les compétences en cours d'acquisition sur : " + ", ".join(en_cours) + "."
        )
        actions_organisme.append(
            "Prévoir des mises en pratique supplémentaires et des QCM formatifs sur les thèmes en cours d'acquisition."
        )

    # Adapter légèrement selon le parcours
    parcours_lower = parcours.lower()
    if parcours_lower == "informatique":
        actions_organisme.append(
            "Favoriser des situations réelles de manipulation sur poste (projets courts, cas pratiques)."
        )
    elif parcours_lower == "bureautique":
        actions_organisme.append(
            "Mettre en place des ateliers courts sur les outils bureautiques les plus utilisés en entreprise."
        )
    elif parcours_lower == "management":
        actions_organisme.append(
            "Proposer des mises en situation ou jeux de rôle pour ancrer les compétences managériales."
        )

    if not actions_apprenant:
        actions_apprenant.append("Aucune remédiation particulière n'est nécessaire à ce stade.")
    if not actions_organisme:
        actions_organisme.append("Aucune action complémentaire particulière n'est requise pour TerciForm.")

    return {
        "actions_apprenant": actions_apprenant,
        "actions_organisme": actions_organisme,
    }


def generer_analyse_pedagogique_detaillee(t1, t2, t3, themes_analysis, parcours):
    """
    Génère une analyse pédagogique professionnelle et détaillée
    """
    points_forts = []
    points_faibles = []
    axes_amelioration = []
    solutions = []
    
    # Analyser les scores pour identifier les points forts
    if t2 > t1 and t2 >= 20:
        points_forts.append(f"Acquis partiels sur T2 ({t2:.2f}%) à capitaliser")
        points_forts.append("Bases identifiées pour structurer l'apprentissage")
    
    if t3 > 50:
        points_forts.append(f"Niveau final satisfaisant ({t3:.2f}%)")
        points_forts.append("Objectifs du parcours globalement atteints")
    
    if t1 >= 20 and t1 <= 50:
        points_forts.append(f"Socle de départ identifié sur T1 ({t1:.2f}%)")
    
    if themes_analysis["themes_acquis"]:
        points_forts.append(f"Compétences maîtrisées: {', '.join(themes_analysis['themes_acquis'])}")
    
    if not points_forts:
        points_forts.append("Motivation et engagement dans le parcours")
        points_forts.append("Potentiel d'évolution identifié")
    
    # Analyser les points faibles
    if t1 < 20:
        points_faibles.append(f"T1 ({t1:.2f}%) insuffisant")
    
    if t3 < 20:
        points_faibles.append(f"T3 ({t3:.2f}%) insuffisant")
    elif t3 < 50:
        points_faibles.append(f"T3 ({t3:.2f}%) en cours d'acquisition, nécessite consolidation")
    
    if abs(t1 - t3) < 5:
        points_faibles.append("Faible progression entre T1 et T3")
    
    if t2 > t3 and (t2 - t3) > 10:
        points_faibles.append("Régression entre T2 et T3, manque de stabilisation des acquis")
    
    if themes_analysis["themes_non_acquis"]:
        points_faibles.append(f"Lacunes identifiées: {', '.join(themes_analysis['themes_non_acquis'])}")
    
    if t1 < 50 and t2 < 50 and t3 < 50:
        points_faibles.append("Hétérogénéité des compétences et manque d'automatisation")
    
    # Axes d'amélioration détaillés selon le parcours
    if parcours.lower() == "informatique":
        if t3 < 50:
            axes_amelioration.append("Consolider les fondamentaux: navigation système, gestion de fichiers, configuration de base")
            axes_amelioration.append("Renforcer les fonctions standard: manipulation interface, raccourcis clavier, organisation des données")
            axes_amelioration.append("Initier progressivement: sécurité informatique, maintenance préventive, résolution de problèmes courants")
        else:
            axes_amelioration.append("Approfondir les compétences techniques avancées")
            axes_amelioration.append("Développer l'autonomie sur les outils professionnels")
    
    elif parcours.lower() == "bureautique":
        if t3 < 50:
            axes_amelioration.append("Consolider les fondamentaux: navigation, gestion de fichiers, mise en forme de base, raccourcis")
            axes_amelioration.append("Renforcer les fonctions standard: traitement de texte, tableur, présentation; tableaux, mises en page, formules basiques")
            axes_amelioration.append("Initier progressivement les fonctions avancées pertinentes: styles/modèles, outils de révision, automatisation simple")
        else:
            axes_amelioration.append("Perfectionner les outils avancés: publipostage, tableaux croisés dynamiques, macros")
            axes_amelioration.append("Optimiser la productivité avec les fonctionnalités professionnelles")
    
    elif parcours.lower() == "management":
        if t3 < 50:
            axes_amelioration.append("Consolider les fondamentaux: communication, organisation, délégation de base")
            axes_amelioration.append("Renforcer les compétences relationnelles: écoute active, feedback constructif, gestion de conflits")
            axes_amelioration.append("Initier progressivement: leadership situationnel, animation d'équipe, conduite de réunion")
        else:
            axes_amelioration.append("Développer le leadership stratégique et la vision d'équipe")
            axes_amelioration.append("Perfectionner la gestion de projets complexes")
    
    if not axes_amelioration:
        axes_amelioration.append("Maintenir les acquis par une pratique régulière")
        axes_amelioration.append("Approfondir les compétences spécifiques au contexte professionnel")
    
    # Solutions proposées détaillées
    solutions.append("Parcours individualisé en micro-modules + pratique guidée")
    solutions.append("Tutorat court et feedback immédiat")
    solutions.append("QCM de contrôle continu")
    solutions.append("Exercices contextualisés en situation de travail")
    solutions.append("Suivi hebdomadaire via indicateurs (réussite, temps, erreurs-types)")
    
    if t3 < 20:
        solutions.append("Reprise complète des fondamentaux avec supports pédagogiques adaptés")
        solutions.append("Séances de remédiation ciblées sur les lacunes prioritaires")
    elif t3 < 50:
        solutions.append("Consolidation des acquis partiels avec exercices progressifs")
        solutions.append("Mise en situation professionnelle pour ancrer les compétences")
    
    # Conclusion personnalisée
    if t3 >= 50:
        conclusion = "Objectifs du parcours atteints. Poursuite recommandée vers un niveau avancé avec pratique régulière pour maintenir et approfondir les acquis."
    elif t3 >= 20:
        conclusion = "Progression atteignable à court terme avec accompagnement structuré et entraînement régulier, priorisant la consolidation des bases puis le développement progressif."
    else:
        conclusion = "Nécessité d'un accompagnement renforcé avec reprise des fondamentaux. Progression possible à moyen terme avec un dispositif adapté et un suivi rapproché."
    
    return {
        "points_forts": points_forts,
        "points_faibles": points_faibles,
        "axes_amelioration": axes_amelioration,
        "solutions": solutions,
        "conclusion": conclusion
    }


def generate_evolution_report(
    nom_apprenant,
    parcours,
    t1, t2, t3,
    themes,
    date_rapport,
    horodatage
):
    """
    Génération du rapport d'évolution complet PROFESSIONNEL.
    NE S'APPLIQUE PAS au parcours 'anglais'
    """
    if parcours.lower() == "anglais":
        return None, "L'algorithme d'analyse d'évolution n'est pas appliqué au parcours d'anglais."

    # 1) Evolution globale
    evo = analyser_evolution_globale(t1, t2, t3)

    # 2) Résultat final
    res = analyser_resultat_final(t3)

    # 3) Analyse thèmes
    themes_analysis = analyser_themes(themes)

    # 4) Analyse pédagogique détaillée (NOUVEAU)
    analyse_pedagogique = generer_analyse_pedagogique_detaillee(t1, t2, t3, themes_analysis, parcours)

    # 5) Construction du rapport structuré
    rapport = {
        "apprenant": nom_apprenant,
        "parcours": parcours,
        "date_rapport": date_rapport,
        "horodatage": horodatage,
        "scores": {
            "t1": {"score": t1, "niveau": evo['niveau_t1']},
            "t2": {"score": t2, "niveau": evo['niveau_t2']},
            "t3": {"score": t3, "niveau": evo['niveau_t3']},
        },
        "evolution_globale": {
            "tendance": evo['tendance'],
            "phrase": evo['phrase_tendance'],
            "couleur": evo['couleur']
        },
        "resultat_final": {
            "niveau": res['niveau_final'],
            "phrase": res['phrase_resultat']
        },
        "analyse_themes": themes_analysis,
        "analyse_pedagogique": analyse_pedagogique
    }

    # 6) Construction du texte du rapport PROFESSIONNEL
    lignes = []

    lignes.append("═" * 80)
    lignes.append("RAPPORT D'ÉVOLUTION DES COMPÉTENCES")
    lignes.append("═" * 80)
    lignes.append("")
    lignes.append(f"Apprenant : {nom_apprenant}")
    lignes.append(f"Parcours : {parcours}")
    lignes.append(f"Date du rapport : {date_rapport}")
    lignes.append(f"Horodatage : {horodatage}")
    lignes.append("")
    lignes.append("─" * 80)
    
    # Section 1: Résultats des évaluations
    lignes.append("")
    lignes.append("1. RÉSULTATS DES ÉVALUATIONS")
    lignes.append("")
    lignes.append(f"   • T1 (Test de positionnement)  : {t1:.2f}% → Niveau: {evo['niveau_t1'].upper()}")
    lignes.append(f"   • T2 (Évaluation mi-parcours)  : {t2:.2f}% → Niveau: {evo['niveau_t2'].upper()}")
    lignes.append(f"   • T3 (Évaluation finale)       : {t3:.2f}% → Niveau: {evo['niveau_t3'].upper()}")
    lignes.append("")
    lignes.append(f"   Tendance générale : {evo['tendance'].upper()} ({evo['couleur']})")
    lignes.append(f"   {evo['phrase_tendance']}")
    lignes.append("")
    lignes.append("─" * 80)
    
    # Section 2: Résultat final
    lignes.append("")
    lignes.append("2. RÉSULTAT FINAL")
    lignes.append("")
    lignes.append(f"   {res['phrase_resultat']}")
    lignes.append("")
    lignes.append("─" * 80)
    
    # Section 3: Analyse pédagogique détaillée
    lignes.append("")
    lignes.append("3. ANALYSE PÉDAGOGIQUE")
    lignes.append("")
    
    lignes.append("   ▸ Points forts:")
    for i, pf in enumerate(analyse_pedagogique["points_forts"], 1):
        lignes.append(f"     {i}. {pf}")
    lignes.append("")
    
    lignes.append("   ▸ Points faibles:")
    for i, pf in enumerate(analyse_pedagogique["points_faibles"], 1):
        lignes.append(f"     {i}. {pf}")
    lignes.append("")
    
    lignes.append("   ▸ Axes d'amélioration:")
    for i, axe in enumerate(analyse_pedagogique["axes_amelioration"], 1):
        lignes.append(f"     {i}. {axe}")
    lignes.append("")
    lignes.append("─" * 80)
    
    # Section 4: Solutions proposées
    lignes.append("")
    lignes.append("4. SOLUTIONS PROPOSÉES")
    lignes.append("")
    lignes.append("   Dispositif pédagogique recommandé:")
    for i, sol in enumerate(analyse_pedagogique["solutions"], 1):
        lignes.append(f"     • {sol}")
    lignes.append("")
    lignes.append("─" * 80)
    
    # Section 5: Conclusion
    lignes.append("")
    lignes.append("5. CONCLUSION")
    lignes.append("")
    lignes.append(f"   {analyse_pedagogique['conclusion']}")
    lignes.append("")
    lignes.append("═" * 80)
    lignes.append("")
    lignes.append("Rapport généré automatiquement par TerciForm")
    lignes.append(f"Conforme aux exigences de suivi pédagogique et traçabilité Qualiopi")
    lignes.append("")

    rapport["texte_complet"] = "\n".join(lignes)

    return rapport, None
