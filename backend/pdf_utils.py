"""
Génération de PDF avec reportlab : certificat de signature (preuve horodatée) et
export Qualiopi (par élève / par société). En-tête et pied de page TerciForm.

Le template exact de l'export Qualiopi sera affiné une fois que Jo aura fourni la liste
précise des documents fixes/variables — cette version fournit déjà une base exploitable
(sessions, documents signés, horodatage) pour ne pas bloquer sur ce détail.
"""
import base64
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

BRAND_COLOR = colors.HexColor("#1e2a4a")


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BRAND_COLOR)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(2 * cm, A4[1] - 1.3 * cm, "TerciForm")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.3 * cm, "Document de suivi Qualiopi")
    canvas.drawString(2 * cm, 1 * cm, f"Généré le {datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')}")
    canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"Page {doc.page}")
    canvas.setStrokeColor(BRAND_COLOR)
    canvas.line(2 * cm, A4[1] - 1.6 * cm, A4[0] - 2 * cm, A4[1] - 1.6 * cm)
    canvas.restoreState()


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleBrand", fontSize=18, textColor=BRAND_COLOR,
                               spaceAfter=14, alignment=TA_CENTER, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="SectionTitle", fontSize=13, textColor=BRAND_COLOR,
                               spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold"))
    return styles


def generate_signature_certificate(document_title: str, student_name: str, student_email: str,
                                    signed_at: datetime, signed_ip: str, signature_data_url: str = None) -> bytes:
    """PDF de preuve pour UNE signature (horodatage, identité, IP, image de signature)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2.2 * cm, bottomMargin=2 * cm)
    styles = _styles()
    story = [
        Paragraph("Certificat de signature électronique", styles["TitleBrand"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>Document :</b> {document_title}", styles["Normal"]),
        Paragraph(f"<b>Signé par :</b> {student_name} ({student_email})", styles["Normal"]),
        Paragraph(f"<b>Horodatage :</b> {signed_at.strftime('%d/%m/%Y à %H:%M:%S UTC')}", styles["Normal"]),
        Paragraph(f"<b>Adresse IP :</b> {signed_ip or 'non disponible'}", styles["Normal"]),
        Spacer(1, 0.8 * cm),
    ]
    if signature_data_url and signature_data_url.startswith("data:image"):
        try:
            header, b64data = signature_data_url.split(",", 1)
            img_bytes = base64.b64decode(b64data)
            img = Image(io.BytesIO(img_bytes), width=6 * cm, height=3 * cm)
            story.append(Paragraph("<b>Signature :</b>", styles["Normal"]))
            story.append(img)
        except Exception:
            pass
    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


def generate_qualiopi_export(student_name: str, student_email: str, company: str,
                              parcours: str, documents: list, sessions: list) -> bytes:
    """
    Export de suivi Qualiopi pour UN élève : documents signés + séances (émargements).
    `documents` : liste de dicts {title, category, status, signed_at}
    `sessions`  : liste de dicts {title, event_date, start_time, end_time, modality, signed}
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2.2 * cm, bottomMargin=2 * cm)
    styles = _styles()
    story = [
        Paragraph("Export de suivi Qualiopi", styles["TitleBrand"]),
        Paragraph(f"<b>Élève :</b> {student_name} ({student_email})", styles["Normal"]),
        Paragraph(f"<b>Société / organisme :</b> {company or 'N/A'}", styles["Normal"]),
        Paragraph(f"<b>Parcours :</b> {parcours or 'N/A'}", styles["Normal"]),
    ]

    story.append(Paragraph("Documents administratifs et émargements", styles["SectionTitle"]))
    if documents:
        data = [["Titre", "Catégorie", "Statut", "Signé le"]]
        for d in documents:
            data.append([
                d.get("title", ""),
                d.get("category", ""),
                "Signé" if d.get("status") == "signed" else "En attente",
                d.get("signed_at").strftime("%d/%m/%Y %H:%M") if d.get("signed_at") else "-",
            ])
        table = Table(data, colWidths=[6 * cm, 3.5 * cm, 3 * cm, 3.5 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f6fa")]),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("Aucun document.", styles["Normal"]))

    story.append(Paragraph("Séances de formation", styles["SectionTitle"]))
    if sessions:
        data = [["Titre", "Date", "Horaire", "Modalité", "Émargé"]]
        for s in sessions:
            data.append([
                s.get("title", ""),
                s.get("event_date", ""),
                f"{s.get('start_time', '')} - {s.get('end_time', '')}",
                s.get("modality", ""),
                "Oui" if s.get("signed") else "Non",
            ])
        table = Table(data, colWidths=[5 * cm, 2.5 * cm, 3 * cm, 3 * cm, 2 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f6fa")]),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("Aucune séance.", styles["Normal"]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()
