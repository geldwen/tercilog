"""
Envoi d'emails via l'API HTTP de Brevo (ex-Sendinblue) — remplace le SMTP Gmail qui était
bloqué de façon intermittente par Render en gratuit. Une API HTTPS traverse le même
réseau sortant que n'importe quel appel `requests`, donc pas de blocage attendu.

IMPORTANT : la clé BREVO_API_KEY doit être ajoutée directement dans les variables
d'environnement de Render par Jo — jamais partagée dans le chat.

Si BREVO_API_KEY n'est pas configurée (ex: en local/dev), les fonctions ne font rien
d'autre que logger un avertissement — l'appli ne plante jamais faute d'email.
"""
import os
import logging
import requests

logger = logging.getLogger("email_service")

BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "no-reply@terciform.fr")
SENDER_NAME = os.environ.get("SENDER_NAME", "TerciForm")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://tercilog.vercel.app")


def _send(to_email: str, to_name: str, subject: str, html_content: str) -> bool:
    if not BREVO_API_KEY:
        logger.warning("BREVO_API_KEY absente — email non envoyé (mode dev) : %s -> %s", subject, to_email)
        return False
    try:
        resp = requests.post(
            BREVO_API_URL,
            headers={
                "accept": "application/json",
                "api-key": BREVO_API_KEY,
                "content-type": "application/json",
            },
            json={
                "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject,
                "htmlContent": html_content,
            },
            timeout=8,
        )
        if resp.status_code >= 300:
            logger.warning("Brevo a refusé l'email (%s) : %s", resp.status_code, resp.text[:300])
            return False
        return True
    except Exception as e:
        logger.error("Erreur d'envoi Brevo : %s", e)
        return False


def send_welcome_email(to_email: str, name: str, temp_password: str) -> bool:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1e2a4a">Bienvenue sur TerciForm, {name} !</h2>
      <p>Ton espace personnel de formation est prêt. Tu peux t'y connecter dès maintenant :</p>
      <p><b>Email :</b> {to_email}<br><b>Mot de passe temporaire :</b> {temp_password}</p>
      <p><a href="{FRONTEND_URL}" style="background:#1e2a4a;color:#fff;padding:10px 18px;
         border-radius:6px;text-decoration:none;display:inline-block">Accéder à mon espace</a></p>
      <p style="color:#888;font-size:12px">Nous te conseillons de changer ce mot de passe après ta première connexion.</p>
    </div>
    """
    return _send(to_email, name, "Bienvenue sur TerciForm", html)


def send_session_reminder_email(to_email: str, name: str, session_title: str, event_date: str, start_time: str) -> bool:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1e2a4a">Rappel de séance</h2>
      <p>Bonjour {name},</p>
      <p>Ta séance <b>{session_title}</b> commence le <b>{event_date}</b> à <b>{start_time}</b>.</p>
      <p><a href="{FRONTEND_URL}" style="background:#1e2a4a;color:#fff;padding:10px 18px;
         border-radius:6px;text-decoration:none;display:inline-block">Voir mon planning</a></p>
    </div>
    """
    return _send(to_email, name, f"Rappel : {session_title}", html)


def send_document_to_sign_email(to_email: str, name: str, document_title: str) -> bool:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1e2a4a">Un document t'attend</h2>
      <p>Bonjour {name},</p>
      <p>Merci de consulter et signer : <b>{document_title}</b>.</p>
      <p><a href="{FRONTEND_URL}" style="background:#1e2a4a;color:#fff;padding:10px 18px;
         border-radius:6px;text-decoration:none;display:inline-block">Consulter et signer</a></p>
    </div>
    """
    return _send(to_email, name, f"Document à signer : {document_title}", html)
