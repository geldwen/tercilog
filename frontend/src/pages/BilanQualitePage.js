import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Eye, Mail, FileText, Edit3, X } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// Configuration des parcours avec leurs couleurs
const PARCOURS_CONFIG = {
  "Anglais": {
    bgLight: "#FFE4F0",
    bgMedium: "#FBD5E8",
    textColor: "#DB2777",
    borderColor: "#F472B6"
  },
  "Informatique": {
    bgLight: "#F3E8FF",
    bgMedium: "#E9D5FF",
    textColor: "#9333EA",
    borderColor: "#C084FC"
  }
};

const PARCOURS_TABS = Object.keys(PARCOURS_CONFIG);

const BilanQualitePage = () => {
  const navigate = useNavigate();
  const [activeParcours, setActiveParcours] = useState("Anglais");
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [relanceLoading, setRelanceLoading] = useState(null);

  const parcoursColors = PARCOURS_CONFIG[activeParcours] || PARCOURS_CONFIG["Anglais"];

  // Charger les données
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API}/api/teachers/qualite-report`, {
          headers: getAuthHeaders(),
          params: {
            periodeType: "annee",
            annee: annee,
            parcours: activeParcours,
          },
        });
        setData(response.data);
      } catch (error) {
        console.error("Erreur chargement rapport qualité:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [annee, activeParcours]);

  // Filtrer par parcours actif
  const lignes = useMemo(() => {
    return data.filter(e => e.parcours === activeParcours);
  }, [data, activeParcours]);

  // Compteurs simples par questionnaire
  const compteurs = useMemo(() => {
    const q1Soumis = lignes.filter(e => e.q1?.submitted).length;
    const q1EnAttente = lignes.length - q1Soumis;
    
    const q2Soumis = lignes.filter(e => e.q2?.submitted).length;
    const q2EnAttente = lignes.length - q2Soumis;
    
    const q3Soumis = lignes.filter(e => e.q3?.submitted).length;
    const q3EnAttente = lignes.length - q3Soumis;
    
    // Listes des élèves en attente pour chaque questionnaire
    const q1EnAttenteList = lignes.filter(e => !e.q1?.submitted);
    const q2EnAttenteList = lignes.filter(e => !e.q2?.submitted);
    const q3EnAttenteList = lignes.filter(e => !e.q3?.submitted);
    
    return {
      q1: { soumis: q1Soumis, enAttente: q1EnAttente, enAttenteList: q1EnAttenteList },
      q2: { soumis: q2Soumis, enAttente: q2EnAttente, enAttenteList: q2EnAttenteList },
      q3: { soumis: q3Soumis, enAttente: q3EnAttente, enAttenteList: q3EnAttenteList },
      nbEleves: lignes.length
    };
  }, [lignes]);

  // Relancer TOUS les apprenants en attente pour un questionnaire
  const handleRelanceMasse = async (questionnaireType, enAttenteList) => {
    if (enAttenteList.length === 0) {
      toast.info("Aucun apprenant en attente pour ce questionnaire");
      return;
    }
    
    const confirm = window.confirm(
      `Envoyer une relance à ${enAttenteList.length} apprenant(s) pour ${questionnaireType} ?`
    );
    if (!confirm) return;
    
    setRelanceLoading(questionnaireType);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const eleve of enAttenteList) {
      try {
        await axios.post(`${API}/api/teachers/relance-questionnaire`, {
          student_id: eleve.id,
          questionnaire: questionnaireType,
          student_email: eleve.email,
          student_name: eleve.nom
        }, {
          headers: getAuthHeaders()
        });
        successCount++;
      } catch (error) {
        console.error(`Erreur relance ${eleve.nom}:`, error);
        errorCount++;
      }
    }
    
    setRelanceLoading(null);
    
    if (successCount > 0) {
      toast.success(`${successCount} relance(s) envoyée(s) avec succès`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de l'envoi`);
    }
  };

  // Voir un questionnaire soumis
  const handleVoirQuestionnaire = (eleve, questionnaire, questionnaireData) => {
    setSelectedQuestionnaire({
      eleve: eleve.nom,
      eleveId: eleve.id,
      type: questionnaire,
      data: questionnaireData,
      submittedAt: questionnaireData?.submitted_at
    });
  };

  // Export PDF simplifié
  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    const title = `Rapport Qualité Qualiopi — ${activeParcours} — ${annee}`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    doc.setFontSize(11);
    doc.text(`Parcours : ${activeParcours}`, 40, 70);
    doc.text(`Nombre d'apprenants : ${compteurs.nbEleves}`, 40, 90);
    doc.text(`Q1 (Besoins) : ${compteurs.q1.soumis} soumis / ${compteurs.q1.enAttente} en attente`, 40, 120);
    doc.text(`Q2 (Mi-parcours) : ${compteurs.q2.soumis} soumis / ${compteurs.q2.enAttente} en attente`, 40, 140);
    doc.text(`Q3 (Fin) : ${compteurs.q3.soumis} soumis / ${compteurs.q3.enAttente} en attente`, 40, 160);

    const rows = lignes.map((e) => [
      e.nom,
      e.q1?.submitted ? "✓ Soumis" : "En attente",
      e.q2?.submitted ? "✓ Soumis" : "En attente",
      e.q3?.submitted ? "✓ Soumis" : "En attente",
    ]);

    autoTable(doc, {
      startY: 190,
      head: [["Apprenant", "Q1 - Besoins", "Q2 - Mi-parcours", "Q3 - Fin"]],
      body: rows,
      styles: { fontSize: 10, cellPadding: 6 },
      theme: "striped",
      headStyles: { fillColor: [43, 138, 62] },
    });

    doc.save(`Rapport_Qualite_${activeParcours}_${annee}.pdf`);
    toast.success("Rapport PDF généré avec succès !");
  };

  // Formater la date
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "—";
    }
  };

  // Déterminer les actions Qualiopi disponibles pour un apprenant
  const getActionsQualiopi = (eleve) => {
    const actions = [];
    
    // Actions "Consulter" pour chaque questionnaire soumis
    if (eleve.q1?.submitted) {
      actions.push({ type: "voir", label: "Q1", data: eleve.q1 });
    }
    if (eleve.q2?.submitted) {
      actions.push({ type: "voir", label: "Q2", data: eleve.q2 });
    }
    if (eleve.q3?.submitted) {
      actions.push({ type: "voir", label: "Q3", data: eleve.q3 });
    }
    
    return actions;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Bilan Qualité Qualiopi</h1>
          </div>
        </div>

        {/* Onglets Parcours avec couleurs */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            {PARCOURS_TABS.map((parcours) => {
              const colors = PARCOURS_CONFIG[parcours];
              const isActive = activeParcours === parcours;
              return (
                <button
                  key={parcours}
                  onClick={() => setActiveParcours(parcours)}
                  className={`px-6 py-3 text-base font-semibold transition-all rounded-t-lg mr-1 ${
                    isActive
                      ? "border-b-4"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                  style={isActive ? {
                    backgroundColor: colors.bgLight,
                    color: colors.textColor,
                    borderBottomColor: colors.textColor
                  } : {}}
                >
                  {parcours}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtre année uniquement */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">Année</label>
                <input
                  type="number"
                  className="border rounded-md px-3 py-2 w-32"
                  min={2020}
                  max={2100}
                  value={annee}
                  onChange={(e) => setAnnee(Number(e.target.value))}
                />
              </div>

              <div className="ml-auto">
                <Button
                  onClick={exportPDF}
                  className="bg-[#2B8A3E] hover:bg-[#237A32] text-white"
                  disabled={loading || lignes.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenu principal */}
        {loading ? (
          <div className="text-center py-12">Chargement des données...</div>
        ) : (
          <>
            {/* Titre parcours avec couleur */}
            <div 
              className="mb-6 p-4 rounded-lg border-2"
              style={{ 
                backgroundColor: parcoursColors.bgLight,
                borderColor: parcoursColors.borderColor
              }}
            >
              <h2 className="text-2xl font-bold" style={{ color: parcoursColors.textColor }}>
                Parcours {activeParcours}
              </h2>
              <p className="text-gray-600 mt-1">
                {compteurs.nbEleves} apprenant{compteurs.nbEleves > 1 ? "s" : ""} inscrit{compteurs.nbEleves > 1 ? "s" : ""} — Année {annee}
              </p>
            </div>

            {/* Phrase explicative */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Information :</strong> Les questionnaires sont disponibles dès le début de la formation. 
                <br />« <span className="text-green-700 font-medium">Soumis</span> » signifie que l&apos;apprenant a répondu au questionnaire.
              </p>
            </div>

            {/* Tableau de bord - 3 cartes avec bouton Relancer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Q1 - Besoins */}
              <Card className="border-2 border-blue-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-blue-800 mb-1">Q1 - Questionnaire d&apos;entrée</h3>
                    <p className="text-xs text-gray-500 mb-4">(Besoins)</p>
                    <div className="flex justify-center gap-8 mb-4">
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                          <span className="text-white font-bold text-xl">{compteurs.q1.soumis}</span>
                        </div>
                        <span className="text-sm text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                          <span className="text-white font-bold text-xl">{compteurs.q1.enAttente}</span>
                        </div>
                        <span className="text-sm text-red-700 font-medium">En attente</span>
                      </div>
                    </div>
                    {/* Bouton Relancer */}
                    {compteurs.q1.enAttente > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRelanceMasse("Q1", compteurs.q1.enAttenteList)}
                        disabled={relanceLoading === "Q1"}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50 w-full"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        {relanceLoading === "Q1" ? "Envoi..." : `📧 Relancer ${compteurs.q1.enAttente} apprenant(s)`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Q2 - Mi-parcours */}
              <Card className="border-2 border-orange-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-orange-800 mb-1">Q2 - Questionnaire mi-parcours</h3>
                    <p className="text-xs text-gray-500 mb-4">(Suivi)</p>
                    <div className="flex justify-center gap-8 mb-4">
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                          <span className="text-white font-bold text-xl">{compteurs.q2.soumis}</span>
                        </div>
                        <span className="text-sm text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                          <span className="text-white font-bold text-xl">{compteurs.q2.enAttente}</span>
                        </div>
                        <span className="text-sm text-red-700 font-medium">En attente</span>
                      </div>
                    </div>
                    {/* Bouton Relancer */}
                    {compteurs.q2.enAttente > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRelanceMasse("Q2", compteurs.q2.enAttenteList)}
                        disabled={relanceLoading === "Q2"}
                        className="text-orange-600 border-orange-300 hover:bg-orange-50 w-full"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        {relanceLoading === "Q2" ? "Envoi..." : `📧 Relancer ${compteurs.q2.enAttente} apprenant(s)`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Q3 - Fin */}
              <Card className="border-2 border-purple-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-purple-800 mb-1">Q3 - Questionnaire de fin</h3>
                    <p className="text-xs text-gray-500 mb-4">(Satisfaction)</p>
                    <div className="flex justify-center gap-8 mb-4">
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                          <span className="text-white font-bold text-xl">{compteurs.q3.soumis}</span>
                        </div>
                        <span className="text-sm text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                          <span className="text-white font-bold text-xl">{compteurs.q3.enAttente}</span>
                        </div>
                        <span className="text-sm text-red-700 font-medium">En attente</span>
                      </div>
                    </div>
                    {/* Bouton Relancer */}
                    {compteurs.q3.enAttente > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRelanceMasse("Q3", compteurs.q3.enAttenteList)}
                        disabled={relanceLoading === "Q3"}
                        className="text-purple-600 border-purple-300 hover:bg-purple-50 w-full"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        {relanceLoading === "Q3" ? "Envoi..." : `📧 Relancer ${compteurs.q3.enAttente} apprenant(s)`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tableau simplifié par apprenant */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-2" style={{ color: parcoursColors.textColor }}>
                  Suivi par apprenant — {activeParcours}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Preuve de diffusion et de complétion des questionnaires Qualiopi
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Apprenant</th>
                        <th className="text-center font-semibold px-4 py-3">Q1 - Besoins</th>
                        <th className="text-center font-semibold px-4 py-3">Q2 - Mi-parcours</th>
                        <th className="text-center font-semibold px-4 py-3">Q3 - Fin</th>
                        <th className="text-center font-semibold px-4 py-3">Actions Qualiopi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-500">
                            Aucun apprenant trouvé pour le parcours {activeParcours}.
                          </td>
                        </tr>
                      ) : (
                        lignes.map((e) => {
                          const actionsQualiopi = getActionsQualiopi(e);
                          return (
                            <tr key={e.id} className="border-t hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{e.nom}</td>
                              <td className="px-4 py-3 text-center">
                                <StatusDot 
                                  submitted={e.q1?.submitted} 
                                  submittedAt={e.q1?.submitted_at}
                                  studentName={e.nom}
                                  onView={() => handleVoirQuestionnaire(e, "Q1", e.q1)}
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <StatusDot 
                                  submitted={e.q2?.submitted} 
                                  submittedAt={e.q2?.submitted_at}
                                  studentName={e.nom}
                                  onView={() => handleVoirQuestionnaire(e, "Q2", e.q2)}
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <StatusDot 
                                  submitted={e.q3?.submitted} 
                                  submittedAt={e.q3?.submitted_at}
                                  studentName={e.nom}
                                  onView={() => handleVoirQuestionnaire(e, "Q3", e.q3)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {actionsQualiopi.length > 0 ? (
                                    actionsQualiopi.map((action, idx) => (
                                      <Button
                                        key={idx}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleVoirQuestionnaire(e, action.label, action.data)}
                                        className="text-green-600 hover:bg-green-50 px-2 py-1 h-auto"
                                        title={`Consulter ${action.label}`}
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        {action.label}
                                      </Button>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 text-xs">Aucun questionnaire soumis</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Légende simplifiée */}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex gap-6 items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>
                      <span className="text-gray-600">Soumis par l&apos;apprenant (cliquez pour consulter)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
                      <span className="text-gray-600">En attente</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    <strong>Q1</strong> = Questionnaire d&apos;entrée (besoins) · 
                    <strong> Q2</strong> = Questionnaire mi-parcours · 
                    <strong> Q3</strong> = Questionnaire de fin de formation
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modal de visualisation du questionnaire */}
      {selectedQuestionnaire && (
        <QuestionnaireModal
          questionnaire={selectedQuestionnaire}
          onClose={() => setSelectedQuestionnaire(null)}
          formatDate={formatDate}
        />
      )}
    </div>
  );
};

// Composant pastille de statut avec tooltip et clic
const StatusDot = ({ submitted, submittedAt, studentName, onView }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "—";
    }
  };

  if (submitted) {
    return (
      <div className="relative inline-block">
        <button
          onClick={onView}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          title="Cliquez pour consulter"
        >
          <span className="w-5 h-5 rounded-full bg-green-500 inline-flex items-center justify-center shadow-sm">
            <Eye className="w-3 h-3 text-white" />
          </span>
          <span className="text-green-700 text-xs font-medium">Soumis</span>
        </button>
        
        {/* Tooltip au survol */}
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
            <div className="text-xs">
              <p className="font-semibold text-gray-800 mb-1">{studentName}</p>
              <p className="text-gray-600 mb-2">
                📅 Soumis le {formatDate(submittedAt)}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="w-full text-center py-1.5 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors"
              >
                👁️ Consulter le questionnaire
              </button>
            </div>
            {/* Flèche du tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-white"></div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-5 h-5 rounded-full bg-red-500 inline-block shadow-sm"></span>
      <span className="text-red-700 text-xs font-medium">En attente</span>
    </span>
  );
};

// Modal pour afficher le questionnaire en lecture seule avec signature
const QuestionnaireModal = ({ questionnaire, onClose, formatDate }) => {
  const { eleve, eleveId, type, data, submittedAt } = questionnaire;
  
  // Labels des questionnaires
  const questionnaireLabels = {
    "Q1": "Questionnaire d'entrée (Besoins)",
    "Q2": "Questionnaire mi-parcours (Suivi)",
    "Q3": "Questionnaire de fin (Satisfaction)"
  };

  // Labels lisibles pour les champs
  const fieldLabels = {
    niveau_initial: "Niveau initial estimé",
    objectifs: "Objectifs de formation",
    disponibilites: "Disponibilités",
    besoins_specifiques: "Besoins spécifiques",
    attentes: "Attentes",
    contraintes: "Contraintes",
    motivation: "Motivation",
    experience_anterieure: "Expérience antérieure",
    contexte_professionnel: "Contexte professionnel",
    frequence_utilisation: "Fréquence d'utilisation",
    domaines_prioritaires: "Domaines prioritaires",
    progression_ressentie: "Progression ressentie",
    satisfaction_accompagnement: "Satisfaction accompagnement",
    points_positifs: "Points positifs",
    points_ameliorer: "Points à améliorer",
    difficultes_rencontrees: "Difficultés rencontrées",
    besoins_complementaires: "Besoins complémentaires",
    commentaires: "Commentaires",
    rythme_formation: "Rythme de la formation",
    qualite_supports: "Qualité des supports",
    relation_formateur: "Relation avec le formateur",
    objectifs_atteints: "Objectifs atteints",
    progression_globale: "Progression globale",
    qualite_formation: "Qualité de la formation",
    qualite_formateur: "Qualité du formateur",
    recommandation: "Recommanderiez-vous ?",
    points_forts: "Points forts",
    suggestions: "Suggestions d'amélioration",
    temoignage: "Témoignage",
    evaluation_globale: "Évaluation globale",
    acquis_formation: "Acquis de la formation",
    answers: "Réponses",
    reponses: "Réponses",
  };

  // Champs à ignorer
  const ignoredFields = [
    'submitted', 'submitted_at', 'student_id', 'id', '_id', 
    'created_at', 'updated_at', 'score_ressenti_progression',
    'score_satisfaction', 'difficulties', 'mastered_skills',
    'signature', 'signature_data', 'signed_at'
  ];

  // Formater une valeur pour l'affichage
  const formatValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === 'boolean') return value ? "Oui" : "Non";
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(", ");
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .filter(([k, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `${fieldLabels[k] || k.replace(/_/g, ' ')}: ${formatValue(v)}`);
      return entries.length > 0 ? entries.join("\n") : "—";
    }
    return String(value);
  };

  // Extraire les réponses du questionnaire
  const getResponses = () => {
    if (!data) return [];
    
    const responses = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (ignoredFields.includes(key)) return;
      if (value === null || value === undefined || value === "" || 
          (Array.isArray(value) && value.length === 0)) return;
      
      if (key === 'answers' && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([ansKey, ansValue]) => {
          if (ansValue !== null && ansValue !== undefined && ansValue !== "") {
            responses.push({
              label: fieldLabels[ansKey] || ansKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              value: formatValue(ansValue)
            });
          }
        });
      } else {
        responses.push({
          label: fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: formatValue(value)
        });
      }
    });
    
    return responses;
  };

  const responses = getResponses();
  
  // Récupérer la signature
  const signatureData = data?.signature || data?.signature_data;
  const signedAt = data?.signed_at || data?.submitted_at;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{type} - {questionnaireLabels[type]}</h2>
            <p className="text-green-100 text-sm">{eleve}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info soumission */}
        <div className="px-6 py-3 bg-green-50 border-b border-green-100">
          <p className="text-sm text-green-800">
            📅 Soumis le <strong>{formatDate(submittedAt)}</strong>
          </p>
        </div>

        {/* Contenu */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {responses.length > 0 ? (
            <div className="space-y-4">
              {responses.map((item, index) => (
                <div key={index} className="border-b border-gray-100 pb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {item.label}
                  </p>
                  <p className="text-gray-800 whitespace-pre-line">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Aucune réponse disponible pour ce questionnaire.
            </p>
          )}
        </div>

        {/* Section Signature Qualiopi */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Signature de l'apprenant
          </h3>
          
          {signatureData ? (
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              {/* Affichage de la signature visuelle */}
              <div className="flex flex-col items-center">
                {/* Image de signature */}
                {signatureData.startsWith('data:image') ? (
                  <img 
                    src={signatureData} 
                    alt="Signature de l'apprenant"
                    className="max-w-full h-auto max-h-24 border border-gray-300 rounded bg-white"
                  />
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                    <p className="text-gray-500 italic text-center">Signature enregistrée</p>
                  </div>
                )}
                
                {/* Nom et date */}
                <div className="mt-3 text-center">
                  <p className="font-semibold text-gray-800">{eleve}</p>
                  <p className="text-xs text-gray-500">
                    Signé le {formatDate(signedAt)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-yellow-700 text-sm">
                ⚠️ Aucune signature enregistrée pour ce questionnaire
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-100 border-t flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Document conforme aux exigences Qualiopi
          </p>
          <Button onClick={onClose} variant="outline">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BilanQualitePage;
