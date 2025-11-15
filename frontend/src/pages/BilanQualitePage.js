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
            mois: filtres.mois,
            annee: filtres.annee,
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
  }, [filtres.periodeType, filtres.mois, filtres.annee]);

  // Filtrage côté client par matière
  const lignes = useMemo(
    () => data.filter((e) => filtres.matiere === "Toutes" || e.matiere === filtres.matiere),
    [data, filtres.matiere]
  );

  // Agrégation des KPIs
  const agreg = useMemo(() => {
    const eligibles = lignes.filter(
      (e) => e.questionnaires.q3Statut === "VERT" && e.questionnaires.reponseFin
    );
    const N = eligibles.length;
    const scores = eligibles.map((e) => scoreProgression(e.questionnaires.reponseFin));
    const avgProg = N ? Math.round(scores.reduce((a, b) => a + b, 0) / N) : 0;

    const satisfactions = eligibles.map((e) => {
      try {
        const evalGlobale = parseInt(e.questionnaires.reponseFin?.evaluation_globale || 0);
        return (evalGlobale / 5) * 100;
      } catch {
        return 0;
      }
    });
    const avgSat = N ? Math.round(satisfactions.reduce((a, b) => a + b, 0) / N) : 0;

    const nbPos = eligibles.filter((e) => {
      const prog = e.questionnaires.reponseFin?.progression_globale || "";
      return prog === "Très satisfaisante" || prog === "Satisfaisante";
    }).length;
    const posPct = N ? Math.round((nbPos * 100) / N) : 0;
    const negPct = 100 - posPct;

    // Difficultés top 3
    const freq = new Map();
    eligibles.forEach((e) => {
      const difficultes = e.questionnaires.reponseFin?.difficultes || "";
      if (difficultes) {
        const tags = difficultes.split(",").map((d) => d.trim());
        tags.forEach((d) => freq.set(d, (freq.get(d) || 0) + 1));
      }
    });
    const top3 = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    // Complétion (Q1+Q2+Q3 soumis)
    const nbComplets = lignes.filter(
      (e) =>
        e.questionnaires.q1Statut === "VERT" &&
        e.questionnaires.q2Statut === "VERT" &&
        e.questionnaires.q3Statut === "VERT"
    ).length;
    const completionPct = lignes.length ? Math.round((nbComplets * 100) / lignes.length) : 0;

    return {
      nbEleves: N,
      avgProg,
      avgSat,
      posPct,
      negPct,
      top3,
      completionPct,
      couleur: COULEUR_FROM_SCORE(avgProg),
    };
  }, [lignes]);

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    const title = `Rapport Qualité — ${periodeLabel} — ${filtres.matiere}`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    doc.setFontSize(11);
    doc.text(`Élèves évalués : ${agreg.nbEleves}`, 40, 70);
    doc.text(`Progression moyenne : ${agreg.avgProg}/100 (${agreg.couleur.lib})`, 40, 90);
    doc.text(`Satisfaction moyenne : ${agreg.avgSat}/100`, 40, 110);
    doc.text(`Ressenti : ${agreg.posPct}% positifs / ${agreg.negPct}% négatifs`, 40, 130);
    doc.text(`Complétion (Q1+Q2+Q3) : ${agreg.completionPct}%`, 40, 150);
    doc.text(`Difficultés récurrentes : ${agreg.top3.join(", ") || "—"}`, 40, 170);

    // Tableau par élève
    const rows = lignes.map((e) => {
      const q = e.questionnaires;
      const rf = q.reponseFin;
      const score = rf ? scoreProgression(rf) : "-";
      const sat = rf ? `${Math.round((parseInt(rf.evaluation_globale || 0) / 5) * 100)}` : "-";
      const diff = rf ? (rf.difficultes || "—") : "—";
      return [
        e.nom,
        e.matiere,
        q.q1Statut === "VERT" ? "✓" : "✗",
        q.q2Statut === "VERT" ? "✓" : "✗",
        q.q3Statut === "VERT" ? "✓" : "✗",
        String(score),
        String(sat),
        diff,
      ];
    });

    autoTable(doc, {
      startY: 200,
      head: [["Élève", "Matière", "Q1", "Q2", "Q3", "Score prog.", "Satisfaction", "Difficultés"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4 },
      theme: "striped",
      headStyles: { fillColor: [43, 138, 62] },
    });

    doc.save(`Rapport_Qualite_${filtres.matiere}_${filtres.annee || filtres.mois}.pdf`);
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
                <div className="flex gap-2">
                  <select
                    value={filtres.periodeType}
                    onChange={(e) =>
                      setFiltres((s) => ({
                        ...s,
                        periodeType: e.target.value,
                        mois: e.target.value === "Mois" ? new Date().toISOString().slice(0, 7) : s.mois,
                        annee: e.target.value === "AnneeComplete" ? String(new Date().getFullYear()) : s.annee,
                      }))
                    }
                    className="border rounded-md px-3 py-2"
                  >
                    <option value="Mois">Mois</option>
                    <option value="AnneeComplete">Année complète</option>
                  </select>

                  {filtres.periodeType === "Mois" ? (
                    <input
                      type="month"
                      value={filtres.mois}
                      onChange={(e) => setFiltres((s) => ({ ...s, mois: e.target.value }))}
                      className="border rounded-md px-3 py-2"
                    />
                  ) : (
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      value={filtres.annee}
                      onChange={(e) => setFiltres((s) => ({ ...s, annee: e.target.value }))}
                      className="border rounded-md px-3 py-2 w-28"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Matière</label>
                <select
                  value={filtres.matiere}
                  onChange={(e) => setFiltres((s) => ({ ...s, matiere: e.target.value }))}
                  className="border rounded-md px-3 py-2"
                >
                  {matieres.map((m) => (
                    <option key={m} value={m}>
                      {m}
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
              <KpiCard title="Élèves évalués" value={String(agreg.nbEleves)} />
              <KpiCard
                title="Progression moyenne"
                value={`${agreg.avgProg}/100`}
                color={agreg.couleur.hex}
                subtitle={agreg.couleur.lib}
              />
              <KpiCard title="Satisfaction moyenne" value={`${agreg.avgSat}/100`} />
              <KpiCard title="Ressenti positif" value={`${agreg.posPct}%`} />
              <KpiCard title="Ressenti négatif" value={`${agreg.negPct}%`} />
              <KpiCard title="Complétion Q1+Q2+Q3" value={`${agreg.completionPct}%`} />
            </div>

            {/* Difficultés récurrentes */}
            {agreg.top3.length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">🎯 Difficultés récurrentes (Top 3)</h3>
                  <div className="flex gap-2 flex-wrap">
                    {agreg.top3.map((diff, i) => (
                      <span key={i} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                        {diff}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tableau */}
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Élève</Th>
                        <Th>Matière</Th>
                        <Th>Q1</Th>
                        <Th>Q2</Th>
                        <Th>Q3</Th>
                        <Th>Score progression</Th>
                        <Th>Satisfaction</Th>
                        <Th>Difficultés</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            Aucune donnée disponible pour cette période et cette matière
                          </td>
                        </tr>
                      ) : (
                        lignes.map((e) => {
                          const q = e.questionnaires;
                          const rf = q.reponseFin;
                          const score = rf ? scoreProgression(rf) : undefined;
                          const sat = rf
                            ? Math.round((parseInt(rf.evaluation_globale || 0) / 5) * 100)
                            : undefined;
                          return (
                            <tr key={e.id} className="border-t hover:bg-gray-50">
                              <Td>{e.nom}</Td>
                              <Td>{e.matiere}</Td>
                              <Td>{dot(q.q1Statut)}</Td>
                              <Td>{dot(q.q2Statut)}</Td>
                              <Td>{dot(q.q3Statut)}</Td>
                              <Td>{score !== undefined ? `${score}/100` : "—"}</Td>
                              <Td>{sat !== undefined ? `${sat}/100` : "—"}</Td>
                              <Td className="max-w-xs truncate">{rf?.difficultes || "—"}</Td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Légende */}
                <div className="mt-4 text-sm text-gray-600 flex gap-6 border-t pt-4">
                  <span>{dot("VERT")} soumis par l'élève</span>
                  <span>{dot("ROUGE")} en attente d'envoi</span>
                  <span className="italic">Règle : si Q2 est rouge, Q3 est forcément rouge (progressif).</span>
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
      <i style={style} /> {ok ? "Vert" : "Rouge"}
    </span>
  );
}

export default BilanQualitePage;
