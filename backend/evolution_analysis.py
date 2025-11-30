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


def generate_evolution_report(
    nom_apprenant,
    parcours,
    t1, t2, t3,
    themes,
    date_rapport,
    horodatage
):
    """
    Génération du rapport d'évolution complet.
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

    # 4) Remédiation
    remed = proposer_remediation(themes_analysis, parcours)

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
        "plan_actions": remed
    }

    # 6) Construction du texte du rapport
    lignes = []

    lignes.append(f"Rapport d'évolution des compétences")
    lignes.append(f"Apprenant : {nom_apprenant}")
    lignes.append(f"Parcours : {parcours}")
    lignes.append(f"Date du rapport : {date_rapport}")
    lignes.append(f"Horodatage : {horodatage}")
    lignes.append("")

    # Résultats bruts
    lignes.append("1. Résultats des évaluations")
    lignes.append(f"- T1 (positionnement) : {t1}% → {evo['niveau_t1']}")
    lignes.append(f"- T2 (mi-parcours) : {t2}% → {evo['niveau_t2']}")
    lignes.append(f"- T3 (fin de parcours) : {t3}% → {evo['niveau_t3']}")
    lignes.append("")

    # Évolution globale
    lignes.append("2. Évolution globale")
    lignes.append(f"Tendance générale : {evo['tendance']} ({evo['couleur']})")
    lignes.append(evo["phrase_tendance"])
    lignes.append("")

    # Résultat final
    lignes.append("3. Résultat final")
    lignes.append(res["phrase_resultat"])
    lignes.append("")

    # Ce que l'apprenant sait
    lignes.append("4. Ce que l'apprenant sait")
    if themes_analysis["themes_acquis"]:
        lignes.append("Compétences acquises : " + ", ".join(themes_analysis["themes_acquis"]) + ".")
    else:
        lignes.append("Aucune compétence n'est clairement acquise à ce stade.")
    lignes.append("")

    lignes.append("5. Ce que l'apprenant ne maîtrise pas encore")
    if themes_analysis["themes_non_acquis"]:
        lignes.append("Thèmes non acquis : " + ", ".join(themes_analysis["themes_non_acquis"]) + ".")
    else:
        lignes.append("Aucun thème n'est identifié comme totalement non acquis.")
    lignes.append("")

    lignes.append("6. Compétences à consolider")
    if themes_analysis["themes_en_cours"]:
        lignes.append("Compétences en cours d'acquisition : " + ", ".join(themes_analysis["themes_en_cours"]) + ".")
    else:
        lignes.append("Aucune compétence intermédiaire particulière n'est identifiée.")
    lignes.append("")

    # Remédiations
    lignes.append("7. Plan d'actions et remédiation")
    lignes.append("Pour l'apprenant :")
    for a in remed["actions_apprenant"]:
        lignes.append(f"- {a}")
    lignes.append("")
    lignes.append("Pour TerciForm :")
    for a in remed["actions_organisme"]:
        lignes.append(f"- {a}")
    lignes.append("")

    rapport["texte_complet"] = "\n".join(lignes)

    return rapport, None
