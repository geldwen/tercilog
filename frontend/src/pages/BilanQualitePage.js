import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Eye, Mail, FileText, Edit3, X, Check, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// Configuration des parcours
const PARCOURS_CONFIG = {
  "Anglais": {
    bgLight: "#FFE4F0",
    textColor: "#DB2777",
    borderColor: "#F472B6"
  },
  "Informatique": {
    bgLight: "#F3E8FF",
    textColor: "#9333EA",
    borderColor: "#C084FC"
  },
  "Excel": {
    bgLight: "#DCFCE7",
    textColor: "#16A34A",
    borderColor: "#4ADE80"
  }
};

const PARCOURS_TABS = Object.keys(PARCOURS_CONFIG);

// Labels des questionnaires (avec descriptions pour clarté)
const QUESTIONNAIRE_LABELS = {
  "Q1": "Questionnaire d'entrée (Besoins)",
  "Q2": "Questionnaire mi-parcours",
  "Q3": "Questionnaire de fin"
};

// Labels courts pour les colonnes du tableau
const QUESTIONNAIRE_SHORT_LABELS = {
  "Q1": "Q1 (Besoins)",
  "Q2": "Q2 (Mi-parcours)",
  "Q3": "Q3 (Fin de formation)"
};

// ============================================================================
// COMPOSANT SIGNATURE PAD (Canvas pour signature manuelle)
// ============================================================================
const SignaturePad = ({ onChange, initialValue = null }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(!!initialValue);

  // Initialiser le canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Charger signature initiale si présente
    if (initialValue) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = initialValue;
    }
  }, [initialValue]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoords(e);
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoords(e);
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);
    
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={520}
        height={140}
        className="border border-gray-300 rounded-lg w-full cursor-crosshair bg-white"
        style={{ touchAction: 'none' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="mt-2 flex items-center justify-between">
        <button 
          type="button" 
          onClick={clearSignature}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Effacer
        </button>
        {hasSignature && (
          <span className="text-xs text-green-600">✓ Signature présente</span>
        )}
      </div>
    </div>
  );
};

const BilanQualitePage = () => {
  const navigate = useNavigate();
  const [activeParcours, setActiveParcours] = useState("Anglais");
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [relanceLoading, setRelanceLoading] = useState(null);
  const [needStatuses, setNeedStatuses] = useState({});
  const [emailModalData, setEmailModalData] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);

  const parcoursColors = PARCOURS_CONFIG[activeParcours] || PARCOURS_CONFIG["Anglais"];

  // Fonction pour télécharger le PDF d'un questionnaire
  const handleDownloadQuestionnairePDF = async (questionnaire) => {
    try {
      const response = await axios.post(`${API}/api/questionnaires/generate-pdf`, {
        student_name: questionnaire.eleve,
        questionnaire_type: questionnaire.type,
        data: questionnaire.data,
        submitted_at: questionnaire.submittedAt,
        parcours: activeParcours
      }, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${questionnaire.type}_${questionnaire.eleve.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      toast.error('Erreur lors du téléchargement du PDF');
    }
  };

  // Fonction pour ouvrir le modal d'envoi email
  const handleSendQuestionnaireEmail = (questionnaire) => {
    setEmailModalData(questionnaire);
    setEmailInput('');
  };

  // Fonction pour envoyer l'email
  const handleConfirmSendEmail = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }
    
    setSending(true);
    try {
      await axios.post(`${API}/api/questionnaires/send-email`, {
        student_name: emailModalData.eleve,
        questionnaire_type: emailModalData.type,
        data: emailModalData.data,
        submitted_at: emailModalData.submittedAt,
        parcours: activeParcours,
        recipient_email: emailInput
      }, {
        headers: getAuthHeaders()
      });
      
      toast.success(`Questionnaire envoyé à ${emailInput}`);
      setEmailModalData(null);
    } catch (error) {
      console.error('Erreur envoi email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    } finally {
      setSending(false);
    }
  };

  // Charger les données
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API}/api/teachers/qualite-report`, {
          headers: getAuthHeaders(),
          params: { periodeType: "annee", annee, parcours: activeParcours },
        });
        setData(response.data);
      } catch (error) {
        console.error("Erreur chargement:", error);
        toast.error("Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [annee, activeParcours]);

  // Charger les statuts de besoin pour chaque élève
  const loadNeedStatuses = useCallback(async (studentIds) => {
    const statuses = {};
    for (const studentId of studentIds) {
      try {
        const response = await axios.get(
          `${API}/api/teachers/questionnaire-need-status/${studentId}`,
          { headers: getAuthHeaders() }
        );
        statuses[studentId] = response.data;
      } catch (error) {
        console.error(`Erreur statut ${studentId}:`, error);
      }
    }
    setNeedStatuses(statuses);
  }, []);

  useEffect(() => {
    const studentIds = data.filter(e => e.parcours === activeParcours).map(e => e.id);
    if (studentIds.length > 0) {
      loadNeedStatuses(studentIds);
    }
  }, [data, activeParcours, loadNeedStatuses]);

  // Filtrer par parcours
  const lignes = useMemo(() => {
    return data.filter(e => e.parcours === activeParcours);
  }, [data, activeParcours]);

  // Compteurs
  const compteurs = useMemo(() => {
    const q1Soumis = lignes.filter(e => e.q1?.submitted).length;
    const q2Soumis = lignes.filter(e => e.q2?.submitted).length;
    const q3Soumis = lignes.filter(e => e.q3?.submitted).length;
    return {
      q1: { soumis: q1Soumis, enAttente: lignes.length - q1Soumis },
      q2: { soumis: q2Soumis, enAttente: lignes.length - q2Soumis },
      q3: { soumis: q3Soumis, enAttente: lignes.length - q3Soumis },
      nbEleves: lignes.length
    };
  }, [lignes]);

  // Relancer un apprenant
  const handleRelance = async (eleve, qType) => {
    setRelanceLoading(`${eleve.id}-${qType}`);
    try {
      await axios.post(`${API}/api/teachers/relance-questionnaire`, {
        student_id: eleve.id,
        questionnaire: qType,
        student_email: eleve.email,
        student_name: eleve.nom
      }, { headers: getAuthHeaders() });
      toast.success(`Relance envoyée à ${eleve.nom}`);
    } catch (error) {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setRelanceLoading(null);
    }
  };

  // Ouvrir modal consultation
  const handleVoir = (eleve, qType, qData) => {
    setSelectedQuestionnaire({ eleve: eleve.nom, eleveId: eleve.id, type: qType, data: qData });
  };

  // Ouvrir modal définir action
  const handleDefinirAction = (eleve, qType, qData, needStatus) => {
    setActionModal({ eleve, qType, qData, needStatus, parcours: activeParcours });
  };

  // Callback après enregistrement action
  const onActionSaved = async () => {
    setActionModal(null);
    // Recharger les statuts
    const studentIds = lignes.map(e => e.id);
    await loadNeedStatuses(studentIds);
    toast.success("Action enregistrée avec succès");
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(14);
    doc.text(`Rapport Qualité Qualiopi — ${activeParcours} — ${annee}`, 40, 40);
    doc.setFontSize(11);
    doc.text(`Parcours : ${activeParcours}`, 40, 70);
    doc.text(`Apprenants : ${compteurs.nbEleves}`, 40, 90);

    const rows = lignes.map((e) => [
      e.nom,
      e.q1?.submitted ? "Soumis" : "En attente",
      e.q2?.submitted ? "Soumis" : "En attente",
      e.q3?.submitted ? "Soumis" : "En attente",
    ]);

    autoTable(doc, {
      startY: 120,
      head: [["Apprenant", "Q1", "Q2", "Q3"]],
      body: rows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [43, 138, 62] },
    });

    doc.save(`Rapport_Qualite_${activeParcours}_${annee}.pdf`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { 
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return "—"; }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />Retour
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Bilan Qualité</h1>
          </div>
        </div>

        {/* Onglets */}
        <div className="mb-6 flex border-b border-gray-200">
          {PARCOURS_TABS.map((parcours) => {
            const colors = PARCOURS_CONFIG[parcours];
            const isActive = activeParcours === parcours;
            return (
              <button
                key={parcours}
                onClick={() => setActiveParcours(parcours)}
                className={`px-6 py-3 text-base font-semibold rounded-t-lg mr-1 ${isActive ? "border-b-4" : "text-gray-500 hover:bg-gray-50"}`}
                style={isActive ? { backgroundColor: colors.bgLight, color: colors.textColor, borderBottomColor: colors.textColor } : {}}
              >
                {parcours}
              </button>
            );
          })}
        </div>

        {/* Filtre année */}
        <Card className="mb-6">
          <CardContent className="pt-6 flex justify-between items-end">
            <div>
              <label className="block text-sm font-medium mb-2">Année</label>
              <input type="number" className="border rounded-md px-3 py-2 w-32" min={2020} max={2100}
                value={annee} onChange={(e) => setAnnee(Number(e.target.value))} />
            </div>
            <Button onClick={exportPDF} className="bg-[#2B8A3E] hover:bg-[#237A32] text-white" disabled={loading || lignes.length === 0}>
              <Download className="w-4 h-4 mr-2" />PDF
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : (
          <>
            {/* Titre parcours */}
            <div className="mb-6 p-4 rounded-lg border-2" style={{ backgroundColor: parcoursColors.bgLight, borderColor: parcoursColors.borderColor }}>
              <h2 className="text-2xl font-bold" style={{ color: parcoursColors.textColor }}>Parcours {activeParcours}</h2>
              <p className="text-gray-600 mt-1">{compteurs.nbEleves} apprenant{compteurs.nbEleves > 1 ? "s" : ""} — {annee}</p>
            </div>

            {/* Cartes Q1/Q2/Q3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {["q1", "q2", "q3"].map((q, idx) => {
                const colors = ["blue", "orange", "purple"][idx];
                const labels = ["Q1 - Besoins", "Q2 - Mi-parcours", "Q3 - Fin"];
                return (
                  <Card key={q} className={`border-2 border-${colors}-200`}>
                    <CardContent className="pt-6 text-center">
                      <h3 className={`text-sm font-semibold text-${colors}-800 mb-4`}>{labels[idx]}</h3>
                      <div className="flex justify-center gap-8">
                        <div>
                          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                            <span className="text-white font-bold text-xl">{compteurs[q].soumis}</span>
                          </div>
                          <span className="text-sm text-green-700 font-medium">Soumis</span>
                        </div>
                        <div>
                          <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                            <span className="text-white font-bold text-xl">{compteurs[q].enAttente}</span>
                          </div>
                          <span className="text-sm text-red-700 font-medium">En attente</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Bandeau Progression Moyenne */}
            {(() => {
              // Calculer les moyennes de progression et satisfaction
              const q3Completed = lignes.filter(e => e.q3?.submitted && e.q3?.score_ressenti_progression != null);
              const avgProgression = q3Completed.length > 0 
                ? Math.round(q3Completed.reduce((sum, e) => sum + (e.q3?.score_ressenti_progression || 0), 0) / q3Completed.length)
                : null;
              const avgSatisfaction = q3Completed.length > 0 
                ? Math.round(q3Completed.reduce((sum, e) => sum + (e.q3?.score_satisfaction || 0), 0) / q3Completed.length)
                : null;
              const avgStars = q3Completed.filter(e => e.q3?.overallStars).length > 0
                ? (q3Completed.filter(e => e.q3?.overallStars).reduce((sum, e) => sum + (e.q3?.overallStars || 0), 0) / q3Completed.filter(e => e.q3?.overallStars).length).toFixed(1)
                : null;
              
              if (q3Completed.length === 0) return null;
              
              return (
                <Card className="mb-6 border-2" style={{ borderColor: parcoursColors.borderColor, backgroundColor: `${parcoursColors.bgLight}50` }}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-center gap-8">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600 mb-1">Progression Moyenne</p>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                            style={{ backgroundColor: avgProgression >= 70 ? '#22C55E' : avgProgression >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {avgProgression}%
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600 mb-1">Satisfaction Moyenne</p>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                            style={{ backgroundColor: avgSatisfaction >= 70 ? '#22C55E' : avgSatisfaction >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {avgSatisfaction}%
                          </div>
                        </div>
                      </div>
                      {avgStars && (
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-600 mb-1">Note Moyenne</p>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-2xl font-bold" style={{ color: parcoursColors.textColor }}>{avgStars}</span>
                            <span className="text-yellow-500 text-2xl">★</span>
                            <span className="text-gray-400 text-sm">/5</span>
                          </div>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600 mb-1">Parcours Complétés</p>
                        <p className="text-2xl font-bold" style={{ color: parcoursColors.textColor }}>{q3Completed.length} / {lignes.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Tableau */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: parcoursColors.textColor }}>
                  Suivi par apprenant — {activeParcours}
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Apprenant</th>
                        <th className="text-center font-semibold px-4 py-3">
                          <div className="text-sm">Q1</div>
                          <div className="text-[10px] font-normal text-gray-500">(Besoins)</div>
                        </th>
                        <th className="text-center font-semibold px-4 py-3">
                          <div className="text-sm">Q2</div>
                          <div className="text-[10px] font-normal text-gray-500">(Mi-parcours)</div>
                        </th>
                        <th className="text-center font-semibold px-4 py-3">
                          <div className="text-sm">Q3</div>
                          <div className="text-[10px] font-normal text-gray-500">(Fin de formation)</div>
                        </th>
                        <th className="text-left font-semibold px-4 py-3 w-96">Actions formateur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-500">Aucun apprenant.</td></tr>
                      ) : (
                        lignes.map((e) => (
                          <tr key={e.id} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{e.nom}</td>
                            {["Q1", "Q2", "Q3"].map((qType) => {
                              const qData = e[qType.toLowerCase()];
                              const submitted = qData?.submitted;
                              
                              // Pour Q3: afficher les étoiles si soumis
                              const isQ3 = qType === "Q3";
                              const q3Stars = isQ3 && submitted ? qData?.overallStars : null;
                              
                              // Helper pour afficher les étoiles avec label
                              const renderStars = (stars) => {
                                const labels = { 4: "Excellent", 3: "Bon", 2: "Moyen", 1: "Insatisfaisant" };
                                const starsDisplay = "⭐".repeat(stars || 0);
                                return (
                                  <div className="flex flex-col items-center">
                                    <span className="text-sm">{starsDisplay}</span>
                                    <span className="text-[10px] text-gray-500">{labels[stars] || ""}</span>
                                  </div>
                                );
                              };
                              
                              return (
                                <td key={qType} className="px-4 py-3 text-center">
                                  {submitted ? (
                                    <button onClick={() => handleVoir(e, qType, qData)} 
                                      className="inline-flex flex-col items-center gap-1 text-green-700 hover:opacity-80">
                                      {/* Pour Q3: Afficher les étoiles si disponibles */}
                                      {isQ3 && q3Stars ? (
                                        renderStars(q3Stars)
                                      ) : (
                                        <span className="w-5 h-5 rounded-full bg-green-500 inline-flex items-center justify-center">
                                          <Eye className="w-3 h-3 text-white" />
                                        </span>
                                      )}
                                      <span className="text-xs">Soumis</span>
                                    </button>
                                  ) : (
                                    <button onClick={() => handleRelance(e, qType)}
                                      disabled={relanceLoading === `${e.id}-${qType}`}
                                      className="inline-flex items-center gap-1 text-red-700 hover:opacity-80 disabled:opacity-50">
                                      <span className="w-5 h-5 rounded-full bg-red-500 inline-flex items-center justify-center">
                                        <Mail className="w-3 h-3 text-white" />
                                      </span>
                                      <span className="text-xs">{relanceLoading === `${e.id}-${qType}` ? "..." : "Relancer"}</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3">
                              <ActionsFormateurColumn 
                                eleve={e}
                                needStatus={needStatuses[e.id]}
                                onVoir={handleVoir}
                                onDefinirAction={handleDefinirAction}
                                onRefresh={() => loadNeedStatuses(lignes.map(el => el.id))}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modal consultation */}
      {selectedQuestionnaire && (
        <QuestionnaireModal questionnaire={selectedQuestionnaire} onClose={() => setSelectedQuestionnaire(null)} formatDate={formatDate} />
      )}

      {/* Modal définir action */}
      {actionModal && (
        <DefinirActionModal {...actionModal} onClose={() => setActionModal(null)} onSave={onActionSaved} />
      )}
    </div>
  );
};

// ============================================================================
// UTILITAIRES POUR LA NORMALISATION DES MOTS-CLÉS (Phase 2 Simplifié)
// ============================================================================
const KEYWORD_NORMALIZER = {
  distanciel: "adaptation du format",
  présentiel: "adaptation du format",
  presentiel: "adaptation du format",
  hybride: "adaptation du format",
  planning: "flexibilité / organisation",
  disponibilite: "flexibilité / organisation",
  disponibilité: "flexibilité / organisation",
  rythme: "aménagement du rythme",
};

const normalizeKeywords = (raw) => {
  const out = raw
    .map(k => k.trim().toLowerCase())
    .filter(Boolean)
    .map(k => KEYWORD_NORMALIZER[k] || k);
  return [...new Set(out)];
};

/** Convertit des mots-clés internes en phrase "Besoin du bénéficiaire" */
const buildBesoinSentence = (keywords) => {
  const ks = normalizeKeywords(keywords);
  const groups = [];

  const oralSet = new Set(["oral", "aisance à l'oral", "expression orale"]);
  const compOraleSet = new Set(["compréhension orale"]);
  const vocabSet = new Set(["vocabulaire", "vocabulaire professionnel"]);
  const gramSet = new Set(["grammaire"]);
  const pronSet = new Set(["prononciation"]);
  const ecritSet = new Set(["expression écrite", "compréhension écrite"]);
  const orgaSet = new Set(["adaptation du format", "flexibilité / organisation", "aménagement du rythme"]);

  const has = (s) => ks.some(k => s.has(k));

  if (has(oralSet)) groups.push("renforcer la pratique orale");
  if (has(compOraleSet)) groups.push("améliorer la compréhension orale");
  if (has(vocabSet)) groups.push("développer le vocabulaire");
  if (has(gramSet)) groups.push("revoir des points de grammaire");
  if (has(pronSet)) groups.push("travailler la prononciation");
  if (has(ecritSet)) groups.push("consolider les compétences à l'écrit");
  if (has(orgaSet)) groups.push("adapter l'organisation / le format");

  if (groups.length === 0) {
    return "Le bénéficiaire a exprimé un besoin d'adaptation pédagogique.";
  }

  return `Le bénéficiaire a exprimé un besoin de : ${groups.join(", ")}.`;
};

/** Construit le compte-rendu formateur par défaut */
const buildDefaultCompteRendu = (keywords, actions) => {
  const besoin = buildBesoinSentence(keywords);
  const actionsTxt = actions.length
    ? `Actions mises en place par le formateur : ${actions.map(a => a.label).join(" ; ")}.`
    : "Actions mises en place par le formateur : à préciser.";
  return `${besoin}\n${actionsTxt}`;
};

const formatActionDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) + " à " + date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', minute: '2-digit' 
    });
  } catch { return ""; }
};

// ============================================================================
// COLONNE ACTIONS FORMATEUR (3 lignes fixes Q1/Q2/Q3) - Badge bleu avec timestamp
// ============================================================================
const ActionsFormateurColumn = ({ eleve, needStatus, onVoir, onDefinirAction, onRefresh }) => {
  const [detailModal, setDetailModal] = useState(null);
  const qTypes = ["Q1", "Q2", "Q3"];
  
  // Callback après suppression d'action
  const handleActionDeleted = () => {
    setDetailModal(null);
    if (onRefresh) onRefresh();
  };
  
  return (
    <div className="space-y-2">
      {qTypes.map((qType) => {
        const qData = eleve[qType.toLowerCase()];
        const submitted = qData?.submitted;
        const status = needStatus?.[qType];
        
        // Si non soumis, ligne grisée
        if (!submitted) {
          return (
            <div key={qType} className="flex items-center gap-2 py-1 px-2 bg-gray-50 rounded text-gray-400 text-xs">
              <span className="font-medium w-8">{qType}</span>
              <span className="italic">En attente de soumission</span>
            </div>
          );
        }
        
        // Si action déjà définie - Badge bleu avec timestamp uniquement
        if (status?.action_defined && status?.action) {
          const action = status.action;
          const dateAction = formatActionDate(action.created_at);
          
          if (action.has_need) {
            return (
              <div key={qType} className="flex items-center gap-2 py-1.5 px-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                <div className="flex-1">
                  <p className="font-semibold text-blue-800">{qType} — Action définie</p>
                  <p className="text-blue-600 text-[11px]">{dateAction}</p>
                </div>
                <button 
                  onClick={() => setDetailModal({ qType, action, eleve })}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
                  title="Voir le détail"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            );
          } else {
            return (
              <div key={qType} className="flex items-center gap-2 py-1.5 px-3 bg-green-50 border border-green-200 rounded-lg text-xs">
                <div className="flex-1">
                  <p className="font-semibold text-green-800">{qType} — Aucun besoin</p>
                  <p className="text-green-600 text-[11px]">{dateAction}</p>
                </div>
                <button 
                  onClick={() => onVoir(eleve, qType, qData)} 
                  className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full transition-colors"
                  title="Voir le détail"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            );
          }
        }
        
        // Soumis mais pas encore analysé/traité
        const hasNeed = status?.has_need;
        
        if (hasNeed) {
          return (
            <div key={qType} className="flex items-center gap-2 py-1 px-2 bg-orange-50 border border-orange-200 rounded text-xs">
              <span className="font-medium w-8 text-orange-700">{qType}</span>
              <div className="flex-1">
                <p className="text-orange-700 font-medium">Action à définir</p>
              </div>
              <Button size="sm"
                onClick={() => onDefinirAction(eleve, qType, qData, status)}
                className="bg-orange-500 hover:bg-orange-600 text-white h-6 px-2 text-xs">
                <Edit3 className="w-3 h-3 mr-1" />Définir
              </Button>
            </div>
          );
        } else {
          return (
            <div key={qType} className="flex items-center gap-2 py-1 px-2 bg-green-50 border border-green-200 rounded text-xs">
              <span className="font-medium w-8 text-green-700">{qType}</span>
              <div className="flex-1">
                <p className="text-green-700">Analyse effectuée. Aucun besoin particulier.</p>
                <p className="text-green-600 text-[10px]">Le dispositif est maintenu.</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onVoir(eleve, qType, qData)} className="text-blue-600 hover:underline" title="Voir">
                  <Eye className="w-3 h-3" />
                </button>
                <Button size="sm" variant="ghost" 
                  onClick={() => onDefinirAction(eleve, qType, qData, status)}
                  className="text-green-600 hover:bg-green-100 h-6 px-1" title="Valider">
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        }
      })}
      
      {/* Modal détail de l'action */}
      {detailModal && (
        <ActionDetailModal 
          action={detailModal.action} 
          qType={detailModal.qType}
          eleve={detailModal.eleve}
          onClose={() => setDetailModal(null)}
          onDelete={handleActionDeleted}
        />
      )}
    </div>
  );
};

// ============================================================================
// MODAL DÉTAIL DE L'ACTION (avec signature affichée)
// Affiche: 1) Besoin du bénéficiaire 2) Actions mises en place 3) Compte-rendu 4) Signature
// ============================================================================
const ActionDetailModal = ({ action, qType, eleve, onClose, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  
  // Récupérer les textes (nouveau format ou générer depuis ancien)
  const besoinText = action.besoin_text || buildBesoinSentence(action.mots_cles || action.selected_keywords || []);
  const actionsText = action.actions_text || (
    (action.actions || action.selected_actions || []).length > 0
      ? `Actions mises en place par le formateur : ${(action.actions || action.selected_actions || []).join(" ; ")}.`
      : "Actions mises en place par le formateur : à préciser."
  );
  const compteRendu = action.compte_rendu_final || action.final_text || "";
  
  // Signature
  const signatureImage = action.signature_image;
  const signedAt = action.signed_at;
  const signedBy = action.signed_by || action.created_by || action.teacher_name;
  
  const formatSignatureDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch { return ""; }
  };
  
  // Supprimer l'action pour la recréer avec signature
  const handleDelete = async () => {
    if (!window.confirm("Supprimer cette action pour la recréer avec signature ?")) return;
    
    setDeleting(true);
    try {
      await axios.delete(
        `${API}/api/teachers/questionnaire-action/${eleve.id}/${qType}`,
        { headers: getAuthHeaders() }
      );
      toast.success("Action supprimée. Vous pouvez maintenant la recréer avec signature.");
      if (onDelete) onDelete();
      onClose();
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header bleu */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold">Détail de l&apos;action — {qType}</h2>
            <p className="text-blue-100 text-sm">{eleve.nom}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-700 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Besoin du bénéficiaire */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Besoin du bénéficiaire</p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-gray-800">
              {besoinText}
            </div>
          </div>
          
          {/* Actions mises en place */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Actions mises en place par le formateur</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                {(action.actions || action.selected_actions || []).map((a, i) => (
                  <li key={i}>{typeof a === 'object' ? a.label : a}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Compte-rendu formateur */}
          {compteRendu && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Compte-rendu formateur</p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border">
                {compteRendu}
              </div>
            </div>
          )}
          
          {/* Signature formateur */}
          {signatureImage && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Signature formateur</p>
              <div className="bg-white border rounded-lg p-3">
                <img 
                  src={signatureImage} 
                  alt="Signature formateur" 
                  className="max-h-24 mx-auto"
                />
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <p>Signé le : <span className="font-medium">{formatSignatureDate(signedAt)}</span></p>
                <p>Par : <span className="font-medium">{signedBy}</span></p>
              </div>
            </div>
          )}
          
          {/* Métadonnées (si pas de signature) */}
          {!signatureImage && (
            <div className="border-t pt-4 text-xs text-gray-500">
              <p>Créé par : <span className="font-medium text-gray-700">{action.created_by || action.teacher_name}</span></p>
              <p>Date : <span className="font-medium text-gray-700">{formatActionDate(action.created_at)}</span></p>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-100 border-t flex justify-between items-center rounded-b-xl">
          {/* Bouton supprimer pour recréer avec signature (si pas de signature) */}
          {!signatureImage && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
            >
              {deleting ? "Suppression..." : "🗑️ Supprimer pour recréer avec signature"}
            </button>
          )}
          {signatureImage && <div />}
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL CONSULTATION QUESTIONNAIRE
// ============================================================================
const QuestionnaireModal = ({ questionnaire, onClose, formatDate }) => {
  const { eleve, type, data, submittedAt } = questionnaire;
  
  const fieldLabels = {
    // Labels généraux
    niveau_initial: "Niveau initial",
    objectifs: "Objectifs",
    attentes: "Attentes",
    besoins_specifiques: "Besoins spécifiques",
    progression_ressentie: "Progression ressentie",
    satisfaction_accompagnement: "Satisfaction",
    points_positifs: "Points positifs",
    points_ameliorer: "Points à améliorer",
    difficultes_rencontrees: "Difficultés",
    commentaires: "Commentaires",
    objectifs_atteints: "Objectifs atteints",
    qualite_formation: "Qualité formation",
    recommandation: "Recommandation",
    suggestions: "Suggestions",
    // Labels Informatique/Bureautique
    bases_usage: "Bases et usage de l'ordinateur",
    navigation_internet: "Navigation internet et recherche",
    messagerie: "Messagerie électronique",
    traitement_texte: "Traitement de texte (Word)",
    tableur: "Tableur (Excel)",
    presentations: "Présentations (PowerPoint)",
    stockage_cloud: "Stockage cloud et collaboration",
    securite: "Sécurité informatique",
    confiance: "Confiance avec l'informatique",
    autonomie: "Niveau d'autonomie",
    formation_souhaitee: "Formation souhaitée",
    disponibilites: "Disponibilités",
    materiel_disponible: "Matériel disponible",
    experience_informatique: "Expérience informatique",
    niveau_word: "Niveau Word",
    niveau_excel: "Niveau Excel",
    niveau_powerpoint: "Niveau PowerPoint",
    niveau_internet: "Niveau Internet",
    niveau_messagerie: "Niveau Messagerie",
    satisfaction_globale: "Satisfaction globale",
    apports_formation: "Apports de la formation",
    difficultes: "Difficultés rencontrées",
    remarques: "Remarques",
    overall_stars: "Note globale",
    stars: "Étoiles",
  };

  const ignoredFields = ['submitted', 'submitted_at', 'student_id', 'id', '_id', 'signature', 'signature_data', 'signed_at', 'responses', 'parcours'];

  const getResponses = () => {
    if (!data) return [];
    const responses = [];
    
    // Si les données ont un champ 'answers', traiter ce champ d'abord
    const dataToProcess = data.answers ? { ...data.answers, ...data } : data;
    
    const processValue = (key, value, depth = 0) => {
      // Protection contre récursion infinie
      if (depth > 3) return;
      
      // Ignorer certains champs
      if (ignoredFields.includes(key.toLowerCase())) return;
      // Ignorer 'answers' car on l'a déjà traité
      if (key === 'answers') return;
      if (value === null || value === undefined || value === "") return;
      
      // Ignorer les signatures (base64)
      if (typeof value === 'string' && value.startsWith('data:image')) return;
      
      // Si c'est un objet imbriqué (mais pas un array), le parcourir récursivement
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([k, v]) => {
          processValue(k, v, depth + 1);
        });
        return;
      }
      
      // Formater la valeur
      let displayValue;
      if (Array.isArray(value)) {
        displayValue = value.join(", ");
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'Oui' : 'Non';
      } else if (typeof value === 'number') {
        // Pour les notes/étoiles
        if (key.includes('stars') || key.includes('rating') || key.includes('note') || key.includes('overall')) {
          displayValue = `${value}/5 ⭐`;
        } else {
          displayValue = String(value);
        }
      } else {
        displayValue = String(value);
      }
      
      const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      responses.push({ label, value: displayValue });
    };
    
    Object.entries(dataToProcess).forEach(([key, value]) => {
      processValue(key, value, 0);
    });
    
    return responses;
  };

  const responses = getResponses();
  const signatureData = data?.signature || data?.signature_data;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-green-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">{type} - {QUESTIONNAIRE_LABELS[type]}</h2>
            <p className="text-green-100 text-sm">{eleve}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-700 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="px-6 py-3 bg-green-50 border-b">
          <p className="text-sm text-green-800">📅 Soumis le <strong>{formatDate(data?.submitted_at)}</strong></p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {responses.length > 0 ? (
            <div className="space-y-3">
              {responses.map((item, i) => (
                <div key={i} className="border-b border-gray-100 pb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">{item.label}</p>
                  <p className="text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune réponse disponible.</p>
          )}
        </div>

        {signatureData && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Signature</h3>
            {signatureData.startsWith('data:image') ? (
              <img src={signatureData} alt="Signature" className="max-h-20 border rounded" />
            ) : (
              <p className="text-gray-500 italic">Signature enregistrée</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{eleve}</p>
          </div>
        )}

        <div className="p-4 bg-gray-100 border-t flex justify-between">
          <div className="flex gap-2">
            <Button 
              onClick={() => handleDownloadQuestionnairePDF(questionnaire)} 
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Télécharger PDF
            </Button>
            <Button 
              onClick={() => handleSendQuestionnaireEmail(questionnaire)} 
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Mail className="w-4 h-4 mr-1" />
              Envoyer par email
            </Button>
          </div>
          <Button onClick={onClose} variant="outline">Fermer</Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DÉFINIR ACTION (Phase 2 avec Signature manuelle)
// Pour Q3: utilise l'endpoint /api/ai/q3/suggest pour analyser le Block B
// ============================================================================
const DefinirActionModal = ({ eleve, qType, qData, needStatus, onClose, onSave, parcours = "Anglais" }) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);
  const [finalText, setFinalText] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasNeed, setHasNeed] = useState(needStatus?.has_need || false);
  const [signatureData, setSignatureData] = useState(null);
  const [signatureError, setSignatureError] = useState(false);
  const [q3Stars, setQ3Stars] = useState(null);

  // Charger l'analyse - endpoint différent pour Q3 (Block B satisfaction)
  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        let response;
        
        if (qType === "Q3") {
          // Pour Q3: utiliser l'endpoint AI spécifique qui analyse le Block B
          response = await axios.post(
            `${API}/api/ai/q3/suggest`,
            { q3_data: qData },
            { headers: getAuthHeaders() }
          );
          
          setAnalysis(response.data);
          setHasNeed(response.data.has_need);
          setQ3Stars(response.data.overall_stars);
          
          // Pré-cocher les actions suggérées (max 2 par défaut)
          const suggested = response.data.suggested_actions || [];
          const preSelectedActions = suggested.slice(0, 2);
          setSelectedActions(preSelectedActions);
          
          // Pour Q3, les keywords sont les "detected_issues"
          setSelectedKeywords(response.data.detected_issues || []);
          
          // Pré-remplir le texte
          if (response.data.report_draft) {
            setFinalText(response.data.report_draft);
          }
        } else {
          // Pour Q1/Q2: utiliser l'endpoint standard
          response = await axios.post(
            `${API}/api/teachers/questionnaire-action/analyze`,
            { questionnaire_data: qData, parcours: parcours },
            { headers: getAuthHeaders() }
          );
          
          setAnalysis(response.data);
          setHasNeed(response.data.has_need);
          
          // Pré-sélectionner les mots-clés détectés (normalisés)
          const detected = response.data.detected_keywords || [];
          const normalized = normalizeKeywords(detected);
          setSelectedKeywords(normalized);
          
          // Pré-cocher les actions suggérées (max 2 par défaut)
          const suggested = response.data.suggested_actions || [];
          const preSelectedActions = suggested
            .filter(a => a.id !== "autre")
            .slice(0, 2);
          setSelectedActions(preSelectedActions);
        }
      } catch (error) {
        console.error("Erreur analyse:", error);
        toast.error("Erreur lors de l'analyse");
      } finally {
        setLoading(false);
      }
    };
    loadAnalysis();
  }, [qData, parcours, qType]);

  // Auto-générer le compte-rendu quand les sélections changent
  useEffect(() => {
    if (selectedKeywords.length === 0) {
      setFinalText("");
      return;
    }
    
    const text = buildDefaultCompteRendu(selectedKeywords, selectedActions);
    setFinalText(text);
  }, [selectedKeywords, selectedActions]);

  // Toggle action (checkbox)
  const toggleAction = (action) => {
    setSelectedActions(prev => {
      const exists = prev.find(a => a.id === action.id);
      if (exists) {
        return prev.filter(a => a.id !== action.id);
      } else {
        if (prev.length >= 3) {
          toast.error("Maximum 3 besoins sélectionnables");
          return prev;
        }
        return [...prev, action];
      }
    });
  };

  // Enregistrer avec signature
  const handleSave = async () => {
    // Validation: au moins une action
    if (selectedActions.length === 0) {
      toast.error("Veuillez sélectionner au moins un besoin");
      return;
    }
    
    // Validation: signature obligatoire
    if (!signatureData) {
      setSignatureError(true);
      toast.error("Signature requise pour valider la trace Qualiopi.");
      return;
    }
    
    // Construire les textes pour stockage
    const besoinText = buildBesoinSentence(selectedKeywords);
    const actionsText = `Actions mises en place par le formateur : ${selectedActions.map(a => a.label).join(" ; ")}.`;
    
    setSaving(true);
    try {
      await axios.post(`${API}/api/teachers/questionnaire-action/save`, {
        student_id: eleve.id,
        student_name: eleve.nom,
        questionnaire_type: qType,
        questionnaire_id: qData?.id,
        keywords_internal: selectedKeywords,
        mots_cles: selectedKeywords,
        actions: selectedActions.map(a => ({ key: a.id, label: a.label })),
        besoin_text: besoinText,
        actions_text: actionsText,
        compte_rendu_final: finalText,
        has_need: true,
        // ============ SIGNATURE ============
        signature_image: signatureData,
        signed_at: new Date().toISOString(),
        signed_by: localStorage.getItem("userName") || "Formateur"
      }, { headers: getAuthHeaders() });
      onSave();
    } catch (error) {
      console.error("Erreur enregistrement:", error);
      const msg = error.response?.data?.detail || "Erreur lors de l'enregistrement";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Valider "Aucun besoin" (pas de signature requise)
  const handleValiderAucunBesoin = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/teachers/questionnaire-action/save`, {
        student_id: eleve.id,
        student_name: eleve.nom,
        questionnaire_type: qType,
        questionnaire_id: qData?.id,
        keywords_internal: [],
        mots_cles: [],
        actions: [],
        besoin_text: "Aucun besoin particulier identifié.",
        actions_text: "Le dispositif est maintenu en l'état.",
        compte_rendu_final: "Analyse effectuée. Aucun besoin particulier. Le dispositif est maintenu.",
        has_need: false,
        // Pas de signature requise pour "aucun besoin"
        signature_image: null,
        signed_at: null,
        signed_by: null
      }, { headers: getAuthHeaders() });
      onSave();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">Analyse en cours...</div>
      </div>
    );
  }

  // Keywords are kept internal (for suggestions), but NOT displayed
  const allActions = analysis?.suggested_actions?.filter(a => a.id !== "autre") || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden my-4">
        {/* Header orange */}
        <div className="bg-orange-500 text-white p-4 flex justify-between items-center rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold">Définir une action — {qType}</h2>
            <p className="text-orange-100 text-sm">{eleve.nom}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-orange-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {/* Pour Q3: Afficher les étoiles d'évaluation globale */}
          {qType === "Q3" && q3Stars && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 font-medium text-sm">Évaluation globale de la formation :</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{"⭐".repeat(q3Stars)}</span>
                  <span className="text-amber-700 text-sm font-medium">
                    {q3Stars === 4 ? "Excellent" : q3Stars === 3 ? "Bon" : q3Stars === 2 ? "Moyen" : "Insatisfaisant"}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Cas: Aucun besoin détecté */}
          {!hasNeed ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-700">Aucun besoin particulier détecté</p>
                  <p className="text-sm text-green-600 mt-1">
                    {qType === "Q3" 
                      ? "L'apprenant est globalement satisfait. Vous pouvez valider le maintien du dispositif."
                      : "Vous pouvez valider le maintien du dispositif."}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleValiderAucunBesoin} disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white w-full">
                  <Check className="w-4 h-4 mr-2" />
                  {saving ? "Enregistrement..." : "Valider : Dispositif maintenu"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Message simple - adapté pour Q3 */}
              <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-700 font-medium text-sm">
                  {qType === "Q3" 
                    ? "Des points d'amélioration ont été identifiés dans les réponses de satisfaction (Block B)."
                    : "Un ou plusieurs besoins ont été identifiés dans la réponse de l'apprenant."}
                </p>
              </div>

              {/* Section: Besoins du bénéficiaire / Points d'amélioration Q3 */}
              <div className="mb-5">
                <h3 className="font-bold text-gray-900 mb-3 text-base">
                  {qType === "Q3" ? "Actions correctives suggérées" : "Besoins du bénéficiaire"} 
                  <span className="text-gray-400 text-sm font-normal"> (max 3)</span>
                </h3>
                <div className="space-y-2">
                  {allActions.slice(0, 6).map((action, idx) => {
                    const isSelected = selectedActions.find(a => a.id === action.id);
                    const isDisabled = !isSelected && selectedActions.length >= 3;
                    return (
                      <label key={idx} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? "border-orange-400 bg-orange-50" 
                          : isDisabled 
                            ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                            : "border-gray-200 hover:bg-gray-50"
                      }`}>
                        <input 
                          type="checkbox" 
                          checked={!!isSelected}
                          disabled={isDisabled}
                          onChange={() => toggleAction(action)}
                          className="mt-1 rounded text-orange-500 focus:ring-orange-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{action.label}</p>
                          {action.description && <p className="text-sm text-gray-500">{action.description}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">{selectedActions.length}/3 sélectionnés</p>
              </div>

              {/* Section: Compte-rendu formateur */}
              <div className="mb-5">
                <h3 className="font-bold text-gray-900 mb-3 text-base">Compte-rendu formateur</h3>
                <p className="text-xs text-gray-500 mb-2">Ce texte est généré automatiquement. Vous pouvez le modifier avant validation.</p>
                <textarea 
                  value={finalText}
                  onChange={(e) => setFinalText(e.target.value)}
                  className="w-full border rounded-lg p-3 h-28 text-sm"
                  placeholder="Le compte-rendu sera généré automatiquement..."
                />
              </div>

              {/* Section: Signature formateur (OBLIGATOIRE) */}
              <div className={`mb-4 p-4 rounded-lg border-2 ${signatureError && !signatureData ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <h3 className="font-bold text-gray-900 mb-3 text-base">
                  Signature formateur <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-gray-500 mb-3">Signature manuscrite obligatoire pour validation Qualiopi.</p>
                
                <SignaturePad 
                  onChange={(data) => {
                    setSignatureData(data);
                    setSignatureError(false);
                  }} 
                />
                
                {signatureData && (
                  <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                    <span>Signé le :</span>
                    <span className="font-medium">{new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="mx-2">|</span>
                    <span>Par :</span>
                    <span className="font-medium">{localStorage.getItem("userName") || "Formateur"}</span>
                  </div>
                )}
                
                {signatureError && !signatureData && (
                  <p className="mt-2 text-sm text-red-600 font-medium">
                    Signature requise pour valider la trace Qualiopi.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {hasNeed && (
          <div className="p-4 bg-gray-100 border-t rounded-b-xl">
            {/* Messages d'aide pour activer le bouton */}
            {(selectedActions.length === 0 || !signatureData) && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <p className="font-medium">Pour valider, veuillez :</p>
                <ul className="list-disc ml-5 mt-1">
                  {selectedActions.length === 0 && <li>Sélectionner au moins un besoin ci-dessus</li>}
                  {!signatureData && <li>Apposer votre signature dans le cadre prévu</li>}
                </ul>
              </div>
            )}
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Le formateur reste décisionnaire.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || selectedActions.length === 0 || !signatureData}
                  className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : "Signer et Valider"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BilanQualitePage;
