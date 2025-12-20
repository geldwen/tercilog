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

// Parcours disponibles (priorité Anglais et Informatique)
const PARCOURS_TABS = ["Anglais", "Informatique"];

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
  const [deleting, setDeleting] = useState(null);

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

  // Compteurs simples par questionnaire
  const compteurs = useMemo(() => {
    const q1Soumis = lignes.filter(e => e.q1?.submitted).length;
    const q1NonSoumis = lignes.length - q1Soumis;
    
    const q2Soumis = lignes.filter(e => e.q2?.submitted).length;
    const q2NonSoumis = lignes.length - q2Soumis;
    
    const q3Soumis = lignes.filter(e => e.q3?.submitted).length;
    const q3NonSoumis = lignes.length - q3Soumis;
    
    const totalSoumis = q1Soumis + q2Soumis + q3Soumis;
    const totalNonSoumis = q1NonSoumis + q2NonSoumis + q3NonSoumis;
    
    return {
      q1: { soumis: q1Soumis, nonSoumis: q1NonSoumis },
      q2: { soumis: q2Soumis, nonSoumis: q2NonSoumis },
      q3: { soumis: q3Soumis, nonSoumis: q3NonSoumis },
      total: { soumis: totalSoumis, nonSoumis: totalNonSoumis },
      nbEleves: lignes.length
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
      setData((prev) => prev.filter((e) => e.id !== studentId));
    } catch (error) {
      console.error("Erreur suppression élève:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
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
    doc.text(`Q1 (Besoins) : ${compteurs.q1.soumis} soumis / ${compteurs.q1.nonSoumis} en attente`, 40, 120);
    doc.text(`Q2 (Mi-parcours) : ${compteurs.q2.soumis} soumis / ${compteurs.q2.nonSoumis} en attente`, 40, 140);
    doc.text(`Q3 (Fin) : ${compteurs.q3.soumis} soumis / ${compteurs.q3.nonSoumis} en attente`, 40, 160);

    // Tableau par élève simplifié
    const rows = lignes.map((e) => [
      e.nom,
      e.q1?.submitted ? "✓ Soumis" : "✗ Non soumis",
      e.q2?.submitted ? "✓ Soumis" : "✗ Non soumis",
      e.q3?.submitted ? "✓ Soumis" : "✗ Non soumis",
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

        {/* Onglets Parcours */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            {PARCOURS_TABS.map((parcours) => (
              <button
                key={parcours}
                onClick={() => setActiveParcours(parcours)}
                className={`px-6 py-3 text-base font-semibold border-b-3 transition-all ${
                  activeParcours === parcours
                    ? "border-b-4 border-green-600 text-green-700 bg-green-50"
                    : "border-b-4 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {parcours}
              </button>
            ))}
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
            {/* Titre parcours avec compteur élèves */}
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#E8F5E9' }}>
              <h2 className="text-2xl font-bold" style={{ color: '#2B8A3E' }}>
                Parcours {activeParcours}
              </h2>
              <p className="text-gray-600 mt-1">
                {compteurs.nbEleves} apprenant{compteurs.nbEleves > 1 ? 's' : ''} inscrit{compteurs.nbEleves > 1 ? 's' : ''}
              </p>
            </div>

            {/* Tableau de bord simplifié - Compteurs par questionnaire */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* Q1 - Besoins */}
              <Card className="border-2 border-blue-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-blue-800 mb-3">Q1 - Questionnaire d'entrée</h3>
                    <p className="text-xs text-gray-500 mb-4">(Besoins)</p>
                    <div className="flex justify-center gap-6">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.q1.soumis}</span>
                        </div>
                        <span className="text-xs text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.q1.nonSoumis}</span>
                        </div>
                        <span className="text-xs text-red-700 font-medium">Non soumis</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Q2 - Mi-parcours */}
              <Card className="border-2 border-orange-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-orange-800 mb-3">Q2 - Questionnaire mi-parcours</h3>
                    <p className="text-xs text-gray-500 mb-4">(Suivi)</p>
                    <div className="flex justify-center gap-6">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.q2.soumis}</span>
                        </div>
                        <span className="text-xs text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.q2.nonSoumis}</span>
                        </div>
                        <span className="text-xs text-red-700 font-medium">Non soumis</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Q3 - Fin */}
              <Card className="border-2 border-purple-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-purple-800 mb-3">Q3 - Questionnaire de fin</h3>
                    <p className="text-xs text-gray-500 mb-4">(Satisfaction)</p>
                    <div className="flex justify-center gap-6">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.q3.soumis}</span>
                        </div>
                        <span className="text-xs text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.q3.nonSoumis}</span>
                        </div>
                        <span className="text-xs text-red-700 font-medium">Non soumis</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total */}
              <Card className="border-2 border-gray-300 bg-gray-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">TOTAL</h3>
                    <p className="text-xs text-gray-500 mb-4">(Tous questionnaires)</p>
                    <div className="flex justify-center gap-6">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.total.soumis}</span>
                        </div>
                        <span className="text-xs text-green-700 font-medium">Soumis</span>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-1">
                          <span className="text-white font-bold text-lg">{compteurs.total.nonSoumis}</span>
                        </div>
                        <span className="text-xs text-red-700 font-medium">Non soumis</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tableau simplifié par apprenant */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: '#2B8A3E' }}>
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
                        lignes.map((e) => (
                          <tr key={e.id} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{e.nom}</td>
                            <td className="px-4 py-3 text-center">
                              <StatusDot submitted={e.q1?.submitted} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusDot submitted={e.q2?.submitted} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusDot submitted={e.q3?.submitted} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStudent(e.id, e.nom)}
                                disabled={deleting === e.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {deleting === e.id ? "..." : "🗑️"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Légende simplifiée */}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex gap-6 items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>
                      <span className="text-gray-600">Soumis par l'apprenant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
                      <span className="text-gray-600">Non soumis (en attente)</span>
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
    </div>
  );
};

// Composant pastille de statut
const StatusDot = ({ submitted }) => {
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>
        <span className="text-green-700 text-xs font-medium">Soumis</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
      <span className="text-red-700 text-xs font-medium">Non soumis</span>
    </span>
  );
};

export default BilanQualitePage;
