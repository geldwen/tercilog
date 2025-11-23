import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
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

const COULEUR_FROM_SCORE = (score) => {
  if (score >= 76) return { lib: "Bleu", hex: "#1F4E79" };
  if (score >= 51) return { lib: "Vert", hex: "#2B8A3E" };
  if (score >= 26) return { lib: "Orange", hex: "#E67700" };
  return { lib: "Rouge", hex: "#C92A2A" };
};

const scoreProgression = (reponseFin) => {
  if (!reponseFin) return 0;
  
  // Mapper les valeurs textuelles aux scores
  let progression = 0;
  const progVal = reponseFin.progression_globale || "";
  if (progVal === "Très satisfaisante") progression = 100;
  else if (progVal === "Satisfaisante") progression = 75;
  else if (progVal === "Moyenne") progression = 50;
  else if (progVal === "Insuffisante") progression = 25;
  
  let objectifs = 0;
  const objVal = reponseFin.objectifs_atteints || "";
  if (objVal === "Oui") objectifs = 100;
  else if (objVal === "Partiellement") objectifs = 66;
  else if (objVal === "Non") objectifs = 0;
  
  let satisfaction = 0;
  try {
    const evalGlobale = parseInt(reponseFin.evaluation_globale || 0);
    satisfaction = (evalGlobale / 5) * 100;
  } catch (e) {
    satisfaction = 0;
  }
  
  let recommander = 0;
  const recVal = reponseFin.recommandation || "";
  if (recVal === "Oui") recommander = 100;
  else if (recVal === "Peut-être") recommander = 50;
  
  return Math.round(progression * 0.4 + objectifs * 0.3 + satisfaction * 0.2 + recommander * 0.1);
};

const corrigerStatuts = (questionnaires) => {
  // Règle : si Q2 rouge, alors Q3 doit être rouge
  const q2Rouge = questionnaires.q2Statut === "ROUGE";
  return {
    ...questionnaires,
    q3Statut: q2Rouge ? "ROUGE" : questionnaires.q3Statut,
  };
};

const BilanQualitePage = () => {
  const navigate = useNavigate();
  const [parcours, setParcours] = useState(["Toutes", "Anglais", "Management", "Bureautique"]);
  const [filtres, setFiltres] = useState({
    periodeType: "mois",
    moisIndex: new Date().getMonth(), // 0-11
    annee: new Date().getFullYear(),
    parcours: "Toutes",
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [parcoursFilter, setParcoursFilter] = useState("Toutes"); // Filtre pour difficultés/éléments maîtrisés

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
            parcours: filtres.parcours,
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
  }, [filtres.periodeType, filtres.moisIndex, filtres.annee, filtres.parcours]);

  // Pas de filtrage côté client, le backend fait tout
  const lignes = useMemo(() => data, [data]);
  
  // Difficultés et éléments maîtrisés filtrés par parcours
  const { filteredTop3, filteredTop3Mastered } = useMemo(() => {
    const eligibles = lignes.filter(
      (e) => e.q1?.submitted && e.q2?.submitted && e.q3?.submitted
    );
    
    // Filtrer par parcours sélectionné
    const filtered = parcoursFilter === "Toutes" 
      ? eligibles 
      : eligibles.filter(e => e.parcours === parcoursFilter);
    
    // Difficultés top 3
    const freq = new Map();
    filtered.forEach((e) => {
      const difficulties = e.q3?.difficulties || [];
      difficulties.forEach((d) => freq.set(d, (freq.get(d) || 0) + 1));
    });
    const filteredTop3 = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    
    // Éléments maîtrisés top 3
    const freqMastered = new Map();
    filtered.forEach((e) => {
      const mastered = e.q3?.mastered_skills || [];
      mastered.forEach((m) => freqMastered.set(m, (freqMastered.get(m) || 0) + 1));
    });
    const filteredTop3Mastered = Array.from(freqMastered.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    
    return { filteredTop3, filteredTop3Mastered };
  }, [lignes, parcoursFilter]);

  // Calcul de la progression moyenne par mois
  const progressionParMois = useMemo(() => {
    const annee = filtres.annee;
    const moisDebut = annee === 2025 ? 10 : 0; // Nov = 10 pour 2025, sinon 0 (janvier)
    const moisFin = 11; // Décembre
    
    const result = [];
    
    for (let mois = moisDebut; mois <= moisFin; mois++) {
      const debutMois = new Date(annee, mois, 1);
      const finMois = new Date(annee, mois + 1, 0, 23, 59, 59);
      
      // Filtrer les élèves qui ont soumis Q3 dans ce mois
      const elevesDuMois = lignes.filter((e) => {
        if (!e.q3?.submitted || !e.q3?.submitted_at) return false;
        
        try {
          const dateQ3 = new Date(e.q3.submitted_at);
          return dateQ3 >= debutMois && dateQ3 <= finMois;
        } catch {
          return false;
        }
      });
      
      // Calculer la moyenne pour ce mois
      const scores = elevesDuMois.map(e => e.q3?.score_ressenti_progression || 0);
      const moyenne = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
        : null;
      
      result.push({
        mois: MOIS_FR[mois],
        moyenne: moyenne,
        nbEleves: elevesDuMois.length
      });
    }
    
    return result;
  }, [lignes, filtres.annee]);

  // Agrégation des KPIs
  const agreg = useMemo(() => {
    // Retour élève = Q1 ET Q2 ET Q3 soumis
    const eligibles = lignes.filter(
      (e) => e.q1?.submitted && e.q2?.submitted && e.q3?.submitted
    );
    const N = eligibles.length;
    // Scores de ressenti de progression (calculés côté backend)
    const scores = eligibles.map((e) => e.q3?.score_ressenti_progression || 0);
    const avgProg = N ? Math.round(scores.reduce((a, b) => a + b, 0) / N) : 0;

    // Scores de satisfaction (calculés côté backend)
    const satisfactions = eligibles.map((e) => e.q3?.score_satisfaction || 0);
    const avgSat = N ? Math.round(satisfactions.reduce((a, b) => a + b, 0) / N) : 0;

    // Ressenti positif si score >= 51
    const nbPos = eligibles.filter((e) => (e.q3?.score_ressenti_progression || 0) >= 51).length;
    const posPct = N ? Math.round((nbPos * 100) / N) : 0;
    const negPct = N ? 100 - posPct : 0;

    // Difficultés top 3
    const freq = new Map();
    eligibles.forEach((e) => {
      const difficulties = e.q3?.difficulties || [];
      difficulties.forEach((d) => freq.set(d, (freq.get(d) || 0) + 1));
    });
    const top3 = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    
    // Éléments maîtrisés top 3
    const freqMastered = new Map();
    eligibles.forEach((e) => {
      const mastered = e.q3?.mastered_skills || [];
      mastered.forEach((m) => freqMastered.set(m, (freqMastered.get(m) || 0) + 1));
    });
    const top3Mastered = Array.from(freqMastered.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    // Complétion (ratio questionnaires soumis / total)
    let nbSoumis = 0;
    let nbTotal = 0;
    lignes.forEach((e) => {
      if (e.q1?.submitted) nbSoumis++;
      if (e.q2?.submitted) nbSoumis++;
      if (e.q3?.submitted) nbSoumis++;
      nbTotal += 3; // Chaque élève a 3 questionnaires (Q1, Q2, Q3)
    });
    const completionPct = nbTotal > 0 ? Math.round((nbSoumis * 100) / nbTotal) : 0;

    // Calcul pour la bulle "Retours élèves"
    const nbEnAttente = nbTotal - nbSoumis;

    return {
      nbEleves: N,
      avgProg,
      avgSat,
      posPct,
      negPct,
      top3,
      top3Mastered,
      completionPct,
      nbSoumis,
      nbEnAttente,
      couleur: COULEUR_FROM_SCORE(avgProg),
    };
  }, [lignes]);

  // Supprimer un élève du rapport
  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Voulez-vous vraiment retirer "${studentName}" du rapport qualité ?`)) {
      return;
    }

    try {
      setDeleting(studentId);
      await axios.delete(`${API}/api/teachers/qualite-report/${studentId}`, {
        headers: getAuthHeaders(),
      });
      
      toast.success(`${studentName} a été retiré du rapport`);
      
      // Recharger les données
      setData((prev) => prev.filter((e) => e.id !== studentId));
    } catch (error) {
      console.error("Erreur suppression élève:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    const title = `Rapport Qualité — ${periodeLabel} — ${filtres.parcours}`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    doc.setFontSize(11);
    doc.text(`Retours élèves (Q1+Q2+Q3 complets) : ${agreg.nbEleves}`, 40, 70);
    doc.text(`Progression moyenne : ${agreg.avgProg}/100 (${agreg.couleur.lib})`, 40, 90);
    doc.text(`Satisfaction moyenne : ${agreg.avgSat}/100`, 40, 110);
    doc.text(`Ressenti global : ${agreg.posPct}% positifs / ${agreg.negPct}% négatifs`, 40, 130);
    doc.text(`Complétion (Q1+Q2+Q3) : ${agreg.completionPct}%`, 40, 150);
    doc.text(`Difficultés récurrentes : ${agreg.top3.join(", ") || "—"}`, 40, 170);

    // Tableau par élève
    const rows = lignes.map((e) => {
      const score = e.q3?.score_progression !== null && e.q3?.score_progression !== undefined ? e.q3.score_progression : "-";
      const sat = e.q3?.score_satisfaction !== null && e.q3?.score_satisfaction !== undefined ? e.q3.score_satisfaction : "-";
      const diff = e.q3?.difficulties?.join(", ") || "—";
      return [
        e.nom,
        e.parcours,
        e.q1?.submitted ? "✓" : "✗",
        e.q2?.submitted ? "✓" : "✗",
        e.q3?.submitted ? "✓" : "✗",
        String(score),
        String(sat),
        diff,
      ];
    });

    autoTable(doc, {
      startY: 200,
      head: [["Élève", "Parcours", "Q1", "Q2", "Q3", "Score prog.", "Satisfaction", "Difficultés"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4 },
      theme: "striped",
      headStyles: { fillColor: [43, 138, 62] },
      columnStyles: {
        7: { cellWidth: 120 } // Difficultés column wider
      }
    });

    doc.save(`Rapport_Qualite_${filtres.parcours}_${filtres.annee}_${MOIS_FR[filtres.moisIndex] || ""}.pdf`);
    toast.success("Rapport PDF généré avec succès !");
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
            <h1 className="text-3xl font-bold text-gray-900">Bilan Qualité</h1>
          </div>
        </div>

        {/* Filtres */}
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

              <div>
                <label className="block text-sm font-medium mb-2">Parcours</label>
                <select
                  value={filtres.parcours}
                  onChange={(e) => setFiltres((s) => ({ ...s, parcours: e.target.value }))}
                  className="border rounded-md px-3 py-2"
                >
                  {parcours.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={exportPDF}
                className="bg-[#2B8A3E] hover:bg-[#237A32] text-white"
                disabled={loading || lignes.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Générer le rapport Qualité (PDF)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {loading ? (
          <div className="text-center py-12">Chargement des données...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Retours élèves avec 2 compteurs et complétion */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600 mb-3">Retours élèves (questionnaires)</div>
                  <div className="flex gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-green-700 mb-1">Soumis</div>
                      <div className="text-3xl font-bold text-green-600">{agreg.nbSoumis}</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-700 mb-1">En attente</div>
                      <div className="text-3xl font-bold text-red-600">{agreg.nbEnAttente}</div>
                    </div>
                  </div>
                  <div className="text-center pt-2 border-t">
                    <div className="text-sm text-gray-500">Complétion</div>
                    <div className="text-2xl font-bold text-blue-600">{agreg.completionPct}%</div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Progression moyenne avec graphique */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600 mb-1">Progression moyenne (ressenti)</div>
                  <div className="text-3xl font-bold mb-3" style={{ color: agreg.couleur.hex }}>
                    {agreg.avgProg}/100
                  </div>
                  
                  {/* Mini graphique par mois */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-gray-600 mb-2">Évolution {filtres.annee}</div>
                    <div className="relative h-16">
                      <svg width="100%" height="100%" className="overflow-visible">
                        {/* Ligne de base */}
                        <line x1="0" y1="60" x2="100%" y2="60" stroke="#e5e7eb" strokeWidth="1" />
                        
                        {/* Courbe de progression */}
                        {progressionParMois.length > 1 && (
                          <polyline
                            points={progressionParMois
                              .map((m, i) => {
                                const x = (i / (progressionParMois.length - 1)) * 100;
                                const y = m.moyenne !== null ? 60 - (m.moyenne * 0.5) : null;
                                return y !== null ? `${x},${y}` : null;
                              })
                              .filter(p => p !== null)
                              .join(' ')}
                            fill="none"
                            stroke={agreg.couleur.hex}
                            strokeWidth="2"
                          />
                        )}
                        
                        {/* Points */}
                        {progressionParMois.map((m, i) => {
                          if (m.moyenne === null) return null;
                          const x = (i / (progressionParMois.length - 1)) * 100;
                          const y = 60 - (m.moyenne * 0.5);
                          return (
                            <circle
                              key={i}
                              cx={`${x}%`}
                              cy={y}
                              r="3"
                              fill={agreg.couleur.hex}
                            />
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      {progressionParMois.map((m, i) => (
                        <span key={i} className="truncate">{m.mois.substring(0, 3)}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Satisfaction parcours élève avec graphique */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600 mb-1">Satisfaction parcours élève (moyenne)</div>
                  <div className="text-3xl font-bold mb-3">
                    {agreg.avgSat}/100
                  </div>
                  
                  {/* Mini graphique par mois */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-gray-600 mb-2">Évolution {filtres.annee}</div>
                    <div className="relative h-16">
                      <svg width="100%" height="100%" className="overflow-visible">
                        {/* Ligne de base */}
                        <line x1="0" y1="60" x2="100%" y2="60" stroke="#e5e7eb" strokeWidth="1" />
                        
                        {/* Courbe de satisfaction */}
                        {satisfactionParMois.length > 1 && (
                          <polyline
                            points={satisfactionParMois
                              .map((m, i) => {
                                const x = (i / (satisfactionParMois.length - 1)) * 100;
                                const y = m.moyenne !== null ? 60 - (m.moyenne * 0.5) : null;
                                return y !== null ? `${x},${y}` : null;
                              })
                              .filter(p => p !== null)
                              .join(' ')}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2"
                          />
                        )}
                        
                        {/* Points */}
                        {satisfactionParMois.map((m, i) => {
                          if (m.moyenne === null) return null;
                          const x = (i / (satisfactionParMois.length - 1)) * 100;
                          const y = 60 - (m.moyenne * 0.5);
                          return (
                            <circle
                              key={i}
                              cx={`${x}%`}
                              cy={y}
                              r="3"
                              fill="#2563eb"
                            />
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      {satisfactionParMois.map((m, i) => (
                        <span key={i} className="truncate">{m.mois.substring(0, 3)}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Barre de progression pour le ressenti global */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600 mb-1">Ressenti global</div>
                  <div className="w-full h-3 rounded bg-gray-200 overflow-hidden flex">
                    <div style={{ width: `${agreg.posPct}%`, height: "100%", background: "#2B8A3E" }} />
                    <div style={{ width: `${agreg.negPct}%`, height: "100%", background: "#C92A2A" }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {agreg.posPct}% positifs / {agreg.negPct}% négatifs
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtre par parcours pour les bandeaux */}
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm font-medium">Filtrer par parcours :</label>
              <select
                value={parcoursFilter}
                onChange={(e) => setParcoursFilter(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                {parcours.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Bandeaux : Éléments maîtrisés et Difficultés (inversé) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Éléments maîtrisés */}
              <Card className="border-green-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    Éléments maîtrisés (Top 3)
                  </h3>
                  {filteredTop3Mastered.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {filteredTop3Mastered.map((skill, i) => (
                        <span key={i} className="px-3 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucun élément maîtrisé pour ce parcours</p>
                  )}
                </CardContent>
              </Card>

              {/* Difficultés récurrentes */}
              <Card className="border-orange-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    Difficultés récurrentes (Top 3)
                  </h3>
                  {filteredTop3.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {filteredTop3.map((diff, i) => (
                        <span key={i} className="px-3 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                          {diff}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucune difficulté récurrente pour ce parcours</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tableau */}
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Élève</Th>
                        <Th>Parcours</Th>
                        <Th>Q1</Th>
                        <Th>Q2</Th>
                        <Th>Q3</Th>
                        <Th>Ressenti progression</Th>
                        <Th>Satisfaction</Th>
                        <Th>Difficultés</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-gray-500">
                            Aucun élève trouvé. Veuillez vérifier que vos élèves ont bien un professeur assigné.
                          </td>
                        </tr>
                      ) : (
                        lignes.map((e) => {
                          const score = e.q3?.score_ressenti_progression;
                          const sat = e.q3?.score_satisfaction;
                          const diff = e.q3?.difficulties?.join(", ") || "";
                          
                          return (
                            <tr key={e.id} className="border-t hover:bg-gray-50">
                              <Td>{e.nom}</Td>
                              <Td>{e.parcours}</Td>
                              <Td>{dot(e.q1?.submitted ? "VERT" : "ROUGE")}</Td>
                              <Td>{dot(e.q2?.submitted ? "VERT" : "ROUGE")}</Td>
                              <Td>{dot(e.q3?.submitted ? "VERT" : "ROUGE")}</Td>
                              <Td>{score !== null && score !== undefined ? `${score}/100` : "—"}</Td>
                              <Td>{sat !== null && sat !== undefined ? `${sat}/100` : "—"}</Td>
                              <Td className="max-w-xs truncate">{diff || "—"}</Td>
                              <Td>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteStudent(e.id, e.nom)}
                                  disabled={deleting === e.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {deleting === e.id ? "..." : "🗑️"}
                                </Button>
                              </Td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Légende enrichie */}
                <div className="mt-4 text-xs text-gray-500 border-t pt-4 space-y-1">
                  <div className="flex gap-4 items-center">
                    <span>{dot("VERT")} par l'élève</span>
                    <span>·</span>
                    <span>{dot("ROUGE")} d'envoi</span>
                  </div>
                  <div>
                    <strong>Q1</strong> = besoin · <strong>Q2</strong> = mi-parcours · <strong>Q3</strong> = fin (progressif)
                  </div>
                  <div className="italic">
                    Règle : si Q2 est en attente, Q3 est forcément en attente (progressif).
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

// Composants UI
const Th = ({ children }) => <th className="text-left font-semibold px-4 py-3">{children}</th>;
const Td = ({ children }) => <td className="px-4 py-3 align-top">{children}</td>;

const KpiCard = ({ title, value, subtitle, color }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-3xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </CardContent>
  </Card>
);

function dot(stat) {
  const ok = stat === "VERT";
  const style = {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: ok ? "#1DB954" : "#E03131",
    verticalAlign: "middle",
    marginRight: 6,
  };
  return (
    <span>
      <i style={style} /> {ok ? "Soumis" : "En attente"}
    </span>
  );
}

export default BilanQualitePage;
