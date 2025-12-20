import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Eye, Bell, X } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

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
  const [filtres, setFiltres] = useState({
    periodeType: "mois",
    moisIndex: new Date().getMonth(),
    annee: new Date().getFullYear(),
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [relanceLoading, setRelanceLoading] = useState(null);

  const parcoursColors = PARCOURS_CONFIG[activeParcours] || PARCOURS_CONFIG["Anglais"];

  const periodeLabel =
    filtres.periodeType === "mois"
      ? `${MOIS_FR[filtres.moisIndex]} ${filtres.annee}`
      : `Année ${filtres.annee}`;

  // Charger les données
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API}/api/teachers/qualite-report`, {
          headers: getAuthHeaders(),
          params: {
            periodeType: filtres.periodeType,
            moisIndex: filtres.moisIndex,
            annee: filtres.annee,
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
  }, [filtres.periodeType, filtres.moisIndex, filtres.annee, activeParcours]);

  // Filtrer par parcours actif
  const lignes = useMemo(() => {
    return data.filter(e => e.parcours === activeParcours);
  }, [data, activeParcours]);

  // Compteurs simples par questionnaire (sans TOTAL)
  const compteurs = useMemo(() => {
    const q1Soumis = lignes.filter(e => e.q1?.submitted).length;
    const q1EnAttente = lignes.length - q1Soumis;
    
    const q2Soumis = lignes.filter(e => e.q2?.submitted).length;
    const q2EnAttente = lignes.length - q2Soumis;
    
    const q3Soumis = lignes.filter(e => e.q3?.submitted).length;
    const q3EnAttente = lignes.length - q3Soumis;
    
    return {
      q1: { soumis: q1Soumis, enAttente: q1EnAttente },
      q2: { soumis: q2Soumis, enAttente: q2EnAttente },
      q3: { soumis: q3Soumis, enAttente: q3EnAttente },
      nbEleves: lignes.length
    };
  }, [lignes]);

  // Déterminer l'action prioritaire pour un apprenant
  const getActionPrioritaire = (eleve) => {
    // Priorité : Q1 > Q2 > Q3 (dans l'ordre du parcours)
    if (!eleve.q1?.submitted) return { type: "relancer", questionnaire: "Q1", label: "Relancer Q1" };
    if (!eleve.q2?.submitted) return { type: "relancer", questionnaire: "Q2", label: "Relancer Q2" };
    if (!eleve.q3?.submitted) return { type: "relancer", questionnaire: "Q3", label: "Relancer Q3" };
    // Tous soumis - proposer de voir le dernier
    return { type: "voir", questionnaire: "Q3", label: "Voir Q3" };
  };

  // Relancer un apprenant pour un questionnaire
  const handleRelance = async (eleve, questionnaire) => {
    const key = `${eleve.id}-${questionnaire}`;
    setRelanceLoading(key);
    
    try {
      await axios.post(`${API}/api/teachers/relance-questionnaire`, {
        student_id: eleve.id,
        questionnaire: questionnaire,
        student_email: eleve.email,
        student_name: eleve.nom
      }, {
        headers: getAuthHeaders()
      });
      
      toast.success(`Relance envoyée à ${eleve.nom} pour ${questionnaire}`);
    } catch (error) {
      console.error("Erreur relance:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de l'envoi de la relance");
    } finally {
      setRelanceLoading(null);
    }
  };

  // Voir un questionnaire soumis
  const handleVoirQuestionnaire = (eleve, questionnaire, questionnaireData) => {
    setSelectedQuestionnaire({
      eleve: eleve.nom,
      type: questionnaire,
      data: questionnaireData,
      submittedAt: questionnaireData?.submitted_at
    });
  };

  // Export PDF simplifié
  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    const title = `Rapport Qualité Qualiopi — ${activeParcours} — ${periodeLabel}`;
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

    doc.save(`Rapport_Qualite_${activeParcours}_${filtres.annee}_${MOIS_FR[filtres.moisIndex] || ""}.pdf`);
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

        {/* Filtres période */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">Période</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={filtres.periodeType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setFiltres((s) =>
                        t === "mois"
                          ? { ...s, periodeType: "mois", moisIndex: new Date().getMonth(), annee: new Date().getFullYear() }
                          : { ...s, periodeType: "annee", annee: new Date().getFullYear() }
                      );
                    }}
                    className="border rounded-md px-3 py-2"
                  >
                    <option value="mois">Mois</option>
                    <option value="annee">Année complète</option>
                  </select>

                  {filtres.periodeType === "mois" ? (
                    <>
                      <select
                        value={filtres.moisIndex}
                        onChange={(e) => setFiltres((s) => ({ ...s, moisIndex: Number(e.target.value) }))}
                        className="border rounded-md px-3 py-2"
                      >
                        {MOIS_FR.map((m, i) => (
                          <option key={m} value={i}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="border rounded-md px-3 py-2 w-28"
                        min={2020}
                        max={2100}
                        value={filtres.annee}
                        onChange={(e) => setFiltres((s) => ({ ...s, annee: Number(e.target.value) }))}
                      />
                    </>
                  ) : (
                    <input
                      type="number"
                      className="border rounded-md px-3 py-2 w-28"
                      min={2020}
                      max={2100}
                      value={filtres.annee}
                      onChange={(e) => setFiltres((s) => ({ ...s, annee: Number(e.target.value) }))}
                    />
                  )}
                </div>
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
                {compteurs.nbEleves} apprenant{compteurs.nbEleves > 1 ? 's' : ''} inscrit{compteurs.nbEleves > 1 ? 's' : ''}
              </p>
            </div>

            {/* Phrase explicative */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Information :</strong> Les questionnaires sont disponibles dès le début de la formation. 
                <br />« <span className="text-green-700 font-medium">Soumis</span> » signifie que l&apos;apprenant a répondu au questionnaire.
              </p>
            </div>

            {/* Tableau de bord simplifié - 3 cartes seulement (sans TOTAL) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Q1 - Besoins */}
              <Card className="border-2 border-blue-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-blue-800 mb-1">Q1 - Questionnaire d'entrée</h3>
                    <p className="text-xs text-gray-500 mb-4">(Besoins)</p>
                    <div className="flex justify-center gap-8">
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
                  </div>
                </CardContent>
              </Card>

              {/* Q2 - Mi-parcours */}
              <Card className="border-2 border-orange-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-orange-800 mb-1">Q2 - Questionnaire mi-parcours</h3>
                    <p className="text-xs text-gray-500 mb-4">(Suivi)</p>
                    <div className="flex justify-center gap-8">
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
                  </div>
                </CardContent>
              </Card>

              {/* Q3 - Fin */}
              <Card className="border-2 border-purple-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-purple-800 mb-1">Q3 - Questionnaire de fin</h3>
                    <p className="text-xs text-gray-500 mb-4">(Satisfaction)</p>
                    <div className="flex justify-center gap-8">
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
                        <th className="text-center font-semibold px-4 py-3">Actions</th>
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
                          const actionPrioritaire = getActionPrioritaire(e);
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
                              <td className="px-4 py-3 text-center">
                                {actionPrioritaire.type === "relancer" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRelance(e, actionPrioritaire.questionnaire)}
                                    disabled={relanceLoading === `${e.id}-${actionPrioritaire.questionnaire}`}
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                  >
                                    <Bell className="w-4 h-4 mr-1" />
                                    {relanceLoading === `${e.id}-${actionPrioritaire.questionnaire}` 
                                      ? "Envoi..." 
                                      : actionPrioritaire.label}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVoirQuestionnaire(e, "Q3", e.q3)}
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    Voir Q3
                                  </Button>
                                )}
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
                      <span className="text-gray-600">Soumis par l&apos;apprenant (cliquez pour voir)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
                      <span className="text-gray-600">En attente</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    <strong>Q1</strong> = Questionnaire d'entrée (besoins) · 
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
          title="Cliquez pour voir la réponse"
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
                👁️ Voir la réponse
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

// Modal pour afficher le questionnaire en lecture seule
const QuestionnaireModal = ({ questionnaire, onClose, formatDate }) => {
  const { eleve, type, data, submittedAt } = questionnaire;
  
  // Labels des questionnaires
  const questionnaireLabels = {
    "Q1": "Questionnaire d'entrée (Besoins)",
    "Q2": "Questionnaire mi-parcours (Suivi)",
    "Q3": "Questionnaire de fin (Satisfaction)"
  };

  // Labels lisibles pour les champs
  const fieldLabels = {
    // Q1 - Besoins
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
    
    // Q2 - Mi-parcours
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
    
    // Q3 - Fin
    objectifs_atteints: "Objectifs atteints",
    progression_globale: "Progression globale",
    qualite_formation: "Qualité de la formation",
    qualite_formateur: "Qualité du formateur",
    recommandation: "Recommanderiez-vous ?",
    points_forts: "Points forts",
    suggestions: "Suggestions d&apos;amélioration",
    temoignage: "Témoignage",
    evaluation_globale: "Évaluation globale",
    acquis_formation: "Acquis de la formation",
    
    // Champs génériques
    answers: "Réponses",
    reponses: "Réponses",
  };

  // Champs à ignorer (métadonnées)
  const ignoredFields = [
    'submitted', 'submitted_at', 'student_id', 'id', '_id', 
    'created_at', 'updated_at', 'score_ressenti_progression',
    'score_satisfaction', 'difficulties', 'mastered_skills'
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
      // Si c'est un objet avec des réponses imbriquées
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
    
    // Parcourir toutes les clés du data
    Object.entries(data).forEach(([key, value]) => {
      // Ignorer les champs de métadonnées
      if (ignoredFields.includes(key)) return;
      
      // Ignorer les valeurs vides
      if (value === null || value === undefined || value === "" || 
          (Array.isArray(value) && value.length === 0)) return;
      
      // Si c'est le champ "answers" (pour Informatique), déplier son contenu
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
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
                  <p className="text-gray-800">{item.value || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Aucune réponse disponible pour ce questionnaire.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <Button onClick={onClose} variant="outline">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BilanQualitePage;
