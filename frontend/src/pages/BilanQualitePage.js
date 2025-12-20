import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Eye, Mail, FileText, Edit3, X, Check, AlertCircle, CheckCircle } from "lucide-react";
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
  }
};

const PARCOURS_TABS = Object.keys(PARCOURS_CONFIG);

// Labels des questionnaires
const QUESTIONNAIRE_LABELS = {
  "Q1": "Questionnaire d'entrée (Besoins)",
  "Q2": "Questionnaire mi-parcours",
  "Q3": "Questionnaire de fin"
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

  const parcoursColors = PARCOURS_CONFIG[activeParcours] || PARCOURS_CONFIG["Anglais"];

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
    setActionModal({ eleve, qType, qData, needStatus });
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
            <h1 className="text-3xl font-bold text-gray-900">Bilan Qualité Qualiopi</h1>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                        <th className="text-center font-semibold px-4 py-3">Q1</th>
                        <th className="text-center font-semibold px-4 py-3">Q2</th>
                        <th className="text-center font-semibold px-4 py-3">Q3</th>
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
                              return (
                                <td key={qType} className="px-4 py-3 text-center">
                                  {submitted ? (
                                    <button onClick={() => handleVoir(e, qType, qData)} 
                                      className="inline-flex items-center gap-1 text-green-700 hover:opacity-80">
                                      <span className="w-5 h-5 rounded-full bg-green-500 inline-flex items-center justify-center">
                                        <Eye className="w-3 h-3 text-white" />
                                      </span>
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
// COLONNE ACTIONS FORMATEUR (3 lignes fixes Q1/Q2/Q3)
// ============================================================================
const ActionsFormateurColumn = ({ eleve, needStatus, onVoir, onDefinirAction }) => {
  const qTypes = ["Q1", "Q2", "Q3"];
  
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
        
        // Si action déjà définie
        if (status?.action_defined && status?.action) {
          return (
            <div key={qType} className="flex items-start gap-2 py-1 px-2 bg-gray-100 rounded text-xs">
              <span className="font-medium w-8 text-gray-700">{qType}</span>
              <div className="flex-1">
                {status.action.has_need ? (
                  <div className="text-orange-700">
                    <p className="font-medium">✅ Action définie</p>
                    <p className="text-gray-600 truncate" title={status.action.final_text}>
                      {status.action.final_text?.substring(0, 50)}...
                    </p>
                  </div>
                ) : (
                  <p className="text-green-700">✅ Aucun besoin - Dispositif maintenu</p>
                )}
              </div>
              <button onClick={() => onVoir(eleve, qType, qData)} className="text-blue-600 hover:underline">
                <Eye className="w-3 h-3" />
              </button>
            </div>
          );
        }
        
        // Soumis mais pas encore analysé/traité
        const hasNeed = status?.has_need;
        
        if (hasNeed) {
          // 🟠 ORANGE - Action requise
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
          // 🟢 VERT - Aucun besoin (mais doit être validé)
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
    </div>
  );
};

// ============================================================================
// MODAL CONSULTATION QUESTIONNAIRE
// ============================================================================
const QuestionnaireModal = ({ questionnaire, onClose, formatDate }) => {
  const { eleve, type, data, submittedAt } = questionnaire;
  
  const fieldLabels = {
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
  };

  const ignoredFields = ['submitted', 'submitted_at', 'student_id', 'id', '_id', 'signature', 'signature_data', 'signed_at'];

  const getResponses = () => {
    if (!data) return [];
    const responses = [];
    Object.entries(data).forEach(([key, value]) => {
      if (ignoredFields.includes(key)) return;
      if (value === null || value === undefined || value === "") return;
      if (key === 'answers' && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => {
          if (v) responses.push({ label: fieldLabels[k] || k.replace(/_/g, ' '), value: String(v) });
        });
      } else {
        responses.push({ label: fieldLabels[key] || key.replace(/_/g, ' '), value: Array.isArray(value) ? value.join(", ") : String(value) });
      }
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

        <div className="p-4 bg-gray-100 border-t flex justify-end">
          <Button onClick={onClose} variant="outline">Fermer</Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DÉFINIR ACTION (Phase 2 - Simplifié)
// ============================================================================
const DefinirActionModal = ({ eleve, qType, qData, needStatus, onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [finalText, setFinalText] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasNeed, setHasNeed] = useState(needStatus?.has_need || false);
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  // Charger l'analyse
  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const response = await axios.post(
          `${API}/api/teachers/questionnaire-action/analyze`,
          { questionnaire_data: qData },
          { headers: getAuthHeaders() }
        );
        setAnalysis(response.data);
        setHasNeed(response.data.has_need);
        setFinalText(response.data.pre_filled_text || "");
        // Pré-sélectionner la première action suggérée
        if (response.data.suggested_actions?.length > 0) {
          setSelectedAction(response.data.suggested_actions[0]);
        }
      } catch (error) {
        console.error("Erreur analyse:", error);
        toast.error("Erreur lors de l'analyse");
      } finally {
        setLoading(false);
      }
    };
    loadAnalysis();
  }, [qData]);

  // Mettre à jour le texte quand l'action change
  useEffect(() => {
    if (selectedAction) {
      setFinalText(`L'apprenant a exprimé un besoin de ${selectedAction.keyword}.\nAction mise en place : ${selectedAction.label}`);
    }
  }, [selectedAction]);

  // Enregistrer
  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/teachers/questionnaire-action/save`, {
        student_id: eleve.id,
        student_name: eleve.nom,
        questionnaire_type: qType,
        selected_keywords: selectedAction ? [selectedAction.keyword] : [],
        selected_actions: selectedAction ? [selectedAction.label] : [],
        final_text: finalText,
        has_need: hasNeed && selectedAction !== null
      }, { headers: getAuthHeaders() });
      onSave();
    } catch (error) {
      console.error("Erreur enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Valider "Aucun besoin"
  const handleValiderAucunBesoin = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/teachers/questionnaire-action/save`, {
        student_id: eleve.id,
        student_name: eleve.nom,
        questionnaire_type: qType,
        selected_keywords: [],
        selected_actions: [],
        final_text: "Analyse effectuée. Aucun besoin particulier. Le dispositif est maintenu.",
        has_need: false
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

  const detectedKeywords = analysis?.detected_keywords || [];
  const suggestedActions = analysis?.suggested_actions || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden my-4">
        {/* Header orange */}
        <div className="bg-orange-500 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Définir une action — {qType}</h2>
            <p className="text-orange-100 text-sm">{eleve.nom}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-orange-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {/* Cas: Aucun besoin détecté */}
          {!hasNeed ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-700">Aucun besoin particulier détecté</p>
                  <p className="text-sm text-green-600 mt-1">Vous pouvez valider le maintien du dispositif.</p>
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
              {/* Section 1: Mots-clés détectés */}
              <div className="mb-5">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Mots-clés détectés</h3>
                <div className="flex flex-wrap gap-2">
                  {detectedKeywords.length > 0 ? (
                    detectedKeywords.map((kw) => (
                      <span key={kw} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm italic">Aucun mot-clé détecté automatiquement</span>
                  )}
                </div>
                
                {/* Option pour voir tous les mots-clés */}
                <button 
                  onClick={() => setShowAllKeywords(!showAllKeywords)}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  {showAllKeywords ? "▲ Masquer tous les mots-clés" : "▼ Afficher tous les mots-clés disponibles"}
                </button>

                {showAllKeywords && analysis?.all_keywords && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    {Object.entries(analysis.all_keywords).map(([category, keywords]) => (
                      <div key={category} className="mb-2 last:mb-0">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{category.replace(/_/g, ' ')}</p>
                        <div className="flex flex-wrap gap-1">
                          {keywords.map((kw) => (
                            <span key={kw} className={`px-2 py-0.5 rounded text-xs ${
                              detectedKeywords.includes(kw) 
                                ? "bg-blue-100 text-blue-700 font-medium" 
                                : "bg-gray-200 text-gray-600"
                            }`}>
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Actions suggérées (max 3, radio buttons) */}
              <div className="mb-5">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Choisir une action</h3>
                <div className="space-y-2">
                  {suggestedActions.slice(0, 3).map((action, idx) => (
                    <label key={idx} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedAction?.keyword === action.keyword 
                        ? "border-orange-400 bg-orange-50" 
                        : "border-gray-200 hover:bg-gray-50"
                    }`}>
                      <input 
                        type="radio" 
                        name="action" 
                        checked={selectedAction?.keyword === action.keyword}
                        onChange={() => setSelectedAction(action)}
                        className="mt-1 text-orange-500 focus:ring-orange-500"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{action.keyword}</p>
                        <p className="text-sm text-gray-600">{action.label}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 3: Compte-rendu */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Compte-rendu formateur</h3>
                <p className="text-xs text-gray-500 mb-2">Ce texte sera enregistré comme trace Qualiopi. Vous pouvez le modifier.</p>
                <textarea 
                  value={finalText}
                  onChange={(e) => setFinalText(e.target.value)}
                  className="w-full border rounded-lg p-3 h-24 text-sm"
                  placeholder="Décrivez l'action pédagogique mise en place..."
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {hasNeed && (
          <div className="p-4 bg-gray-100 border-t flex justify-between items-center">
            <p className="text-xs text-gray-500">Le formateur reste décisionnaire.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !selectedAction}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? "Enregistrement..." : "Définir"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BilanQualitePage;
