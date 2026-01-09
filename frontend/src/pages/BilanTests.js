import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Eye, Mail, FileText, X, CheckCircle, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const API = process.env.REACT_APP_BACKEND_URL || "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// Configuration des parcours (identique à BilanQualité)
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

// Labels des tests
const TEST_LABELS = {
  "T1": "Test de positionnement",
  "T2": "Test intermédiaire",
  "T3": "Test final"
};

const TEST_SHORT_LABELS = {
  "T1": "T1 (Positionnement)",
  "T2": "T2 (Intermédiaire)",
  "T3": "T3 (Final)"
};

// Fonction utilitaire pour arrondir les pourcentages (pas de virgule)
const roundScore = (score) => {
  if (score === null || score === undefined) return null;
  return Math.round(score);
};

// ============================================================================
// Modal de consultation des résultats
// ============================================================================
const TestResultModal = ({ isOpen, onClose, studentName, testType, testData }) => {
  if (!isOpen) return null;
  
  const score = testData?.score;
  const maxScore = testData?.max_score || 100;
  const percentage = score !== null && score !== undefined ? Math.round((score / maxScore) * 100) : null;
  const submittedAt = testData?.submitted_at || testData?.date;
  
  // Déterminer le niveau
  const getLevel = (pct) => {
    if (pct >= 80) return { label: "Excellent", color: "green", emoji: "🌟" };
    if (pct >= 60) return { label: "Bon", color: "blue", emoji: "👍" };
    if (pct >= 40) return { label: "À renforcer", color: "orange", emoji: "📈" };
    return { label: "À travailler", color: "red", emoji: "📚" };
  };
  
  const level = percentage !== null ? getLevel(percentage) : null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Résultat {testType} — {studentName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Score principal */}
          <div className="text-center">
            {percentage !== null ? (
              <>
                <div className="text-6xl font-bold mb-2" style={{ color: level?.color === 'green' ? '#22c55e' : level?.color === 'blue' ? '#3b82f6' : level?.color === 'orange' ? '#f97316' : '#ef4444' }}>
                  {percentage}%
                </div>
                <div className="flex items-center justify-center gap-2 text-lg">
                  <span>{level?.emoji}</span>
                  <span className="font-semibold">{level?.label}</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Score : {score} / {maxScore} points
                </p>
              </>
            ) : (
              <div className="text-gray-500 py-8">
                <p className="text-lg">Résultat non disponible</p>
              </div>
            )}
          </div>
          
          {/* Détails */}
          {testData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Type de test :</span>
                <span className="font-medium">{TEST_LABELS[testType]}</span>
              </div>
              {submittedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date de passage :</span>
                  <span className="font-medium">
                    {new Date(submittedAt).toLocaleDateString('fr-FR', { 
                      day: '2-digit', month: 'long', year: 'numeric' 
                    })}
                  </span>
                </div>
              )}
              {testData.duration && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Durée :</span>
                  <span className="font-medium">{testData.duration} min</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Composant principal BilanTests
// ============================================================================
export default function BilanTests() {
  const navigate = useNavigate();
  
  // State
  const [activeParcours, setActiveParcours] = useState("Anglais");
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [relanceLoading, setRelanceLoading] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  
  // Couleurs du parcours actif
  const parcoursColors = PARCOURS_CONFIG[activeParcours];
  
  // Charger les données
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Récupérer tous les élèves
      const studentsRes = await axios.get(`${API}/api/students`, { headers: getAuthHeaders() });
      const students = studentsRes.data || [];
      
      // Récupérer tous les tests
      const testsRes = await axios.get(`${API}/api/tests/all`, { headers: getAuthHeaders() });
      const testsData = testsRes.data?.students || [];
      
      // Créer une map des tests par nom d'élève
      const testsByStudent = {};
      testsData.forEach(item => {
        testsByStudent[item.student_name] = item.tests || [];
      });
      
      // Construire les données formatées
      const formattedData = students.map(student => {
        const studentTests = testsByStudent[student.name] || [];
        
        // Identifier T1, T2, T3 par type ou position
        const t1 = studentTests.find(t => t.type === 'T1' || t.type === 'positionnement' || t.name?.toLowerCase().includes('positionnement'));
        const t2 = studentTests.find(t => t.type === 'T2' || t.type === 'intermediaire' || t.name?.toLowerCase().includes('intermédiaire'));
        const t3 = studentTests.find(t => t.type === 'T3' || t.type === 'final' || t.name?.toLowerCase().includes('final'));
        
        // Si pas trouvé par type, utiliser l'ordre chronologique
        const sortedTests = studentTests.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        
        return {
          id: student.id,
          nom: student.name + (student.last_name ? ` ${student.last_name}` : ''),
          email: student.email,
          parcours: student.parcours || 'Anglais',
          t1: t1 || sortedTests[0] || null,
          t2: t2 || sortedTests[1] || null,
          t3: t3 || sortedTests[2] || null
        };
      });
      
      setData(formattedData);
    } catch (error) {
      console.error("Erreur chargement données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Filtrer par parcours
  const lignes = useMemo(() => {
    return data.filter(e => e.parcours === activeParcours);
  }, [data, activeParcours]);
  
  // Compteurs
  const compteurs = useMemo(() => {
    const t1Soumis = lignes.filter(e => e.t1?.score !== null && e.t1?.score !== undefined).length;
    const t2Soumis = lignes.filter(e => e.t2?.score !== null && e.t2?.score !== undefined).length;
    const t3Soumis = lignes.filter(e => e.t3?.score !== null && e.t3?.score !== undefined).length;
    
    // Calculer moyennes (arrondies)
    const calcMoyenne = (testKey) => {
      const tests = lignes.filter(e => e[testKey]?.score !== null && e[testKey]?.score !== undefined);
      if (tests.length === 0) return null;
      const sum = tests.reduce((acc, e) => acc + (e[testKey].score || 0), 0);
      return roundScore(sum / tests.length);
    };
    
    return {
      t1: { soumis: t1Soumis, enAttente: lignes.length - t1Soumis, moyenne: calcMoyenne('t1') },
      t2: { soumis: t2Soumis, enAttente: lignes.length - t2Soumis, moyenne: calcMoyenne('t2') },
      t3: { soumis: t3Soumis, enAttente: lignes.length - t3Soumis, moyenne: calcMoyenne('t3') },
      nbEleves: lignes.length
    };
  }, [lignes]);
  
  // Progression moyenne (T3 - T1) - arrondie
  const progressionGlobale = useMemo(() => {
    const elevesAvecT1etT3 = lignes.filter(e => 
      e.t1?.score !== null && e.t1?.score !== undefined &&
      e.t3?.score !== null && e.t3?.score !== undefined
    );
    if (elevesAvecT1etT3.length === 0) return null;
    
    const totalProgression = elevesAvecT1etT3.reduce((acc, e) => {
      return acc + ((e.t3.score || 0) - (e.t1.score || 0));
    }, 0);
    
    return roundScore(totalProgression / elevesAvecT1etT3.length);
  }, [lignes]);
  
  // Relancer un apprenant
  const handleRelance = async (eleve, testType) => {
    setRelanceLoading(`${eleve.id}-${testType}`);
    try {
      await axios.post(`${API}/api/teachers/relance-test`, {
        student_id: eleve.id,
        test_type: testType,
        student_email: eleve.email,
        student_name: eleve.nom
      }, { headers: getAuthHeaders() });
      toast.success(`Relance envoyée à ${eleve.nom}`);
    } catch (error) {
      toast.error("Erreur lors de l'envoi de la relance");
    } finally {
      setRelanceLoading(null);
    }
  };
  
  // Voir résultat
  const handleVoir = (eleve, testType, testData) => {
    setSelectedTest({ studentName: eleve.nom, testType, testData });
  };
  
  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(14);
    doc.text(`Bilan des Tests — ${activeParcours} — ${annee}`, 40, 40);
    doc.setFontSize(11);
    doc.text(`Parcours : ${activeParcours}`, 40, 70);
    doc.text(`Apprenants : ${compteurs.nbEleves}`, 40, 90);
    
    if (progressionGlobale !== null) {
      doc.text(`Progression moyenne : ${progressionGlobale > 0 ? '+' : ''}${progressionGlobale}%`, 40, 110);
    }
    
    const rows = lignes.map((e) => {
      const getScoreDisplay = (test) => {
        if (!test || test.score === null || test.score === undefined) return "En attente";
        return `${test.score}%`;
      };
      
      // Calculer progression individuelle
      let progression = "-";
      if (e.t1?.score !== null && e.t1?.score !== undefined && e.t3?.score !== null && e.t3?.score !== undefined) {
        const diff = (e.t3.score || 0) - (e.t1.score || 0);
        progression = diff > 0 ? `+${diff}%` : `${diff}%`;
      }
      
      return [
        e.nom,
        getScoreDisplay(e.t1),
        getScoreDisplay(e.t2),
        getScoreDisplay(e.t3),
        progression
      ];
    });
    
    autoTable(doc, {
      startY: 130,
      head: [["Apprenant", "T1 (Position.)", "T2 (Interm.)", "T3 (Final)", "Résultat"]],
      body: rows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [147, 51, 234] }, // Violet
    });
    
    doc.save(`Bilan_Tests_${activeParcours}_${annee}.pdf`);
    toast.success("PDF exporté avec succès");
  };
  
  // Calculer progression individuelle (arrondie)
  const getProgression = (eleve) => {
    if (!eleve.t1?.score || !eleve.t3?.score) return null;
    return roundScore((eleve.t3.score || 0) - (eleve.t1.score || 0));
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
            <h1 className="text-3xl font-bold text-gray-900">📈 Bilan des Tests</h1>
          </div>
        </div>
        
        {/* Onglets parcours */}
        <div className="mb-6 flex border-b border-gray-200">
          {PARCOURS_TABS.map((parcours) => {
            const colors = PARCOURS_CONFIG[parcours];
            const isActive = activeParcours === parcours;
            return (
              <button
                key={parcours}
                onClick={() => setActiveParcours(parcours)}
                className={`px-6 py-3 text-base font-semibold rounded-t-lg mr-1 transition-colors ${
                  isActive ? "border-b-4" : "text-gray-500 hover:bg-gray-50"
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
        
        {/* Filtre année + Export */}
        <Card className="mb-6">
          <CardContent className="pt-6 flex justify-between items-end">
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
            <Button 
              onClick={exportPDF} 
              className="bg-purple-600 hover:bg-purple-700 text-white" 
              disabled={loading || lignes.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />PDF
            </Button>
          </CardContent>
        </Card>
        
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : (
          <>
            {/* Bandeau titre parcours */}
            <div 
              className="mb-6 p-4 rounded-lg border-2" 
              style={{ backgroundColor: parcoursColors.bgLight, borderColor: parcoursColors.borderColor }}
            >
              <h2 className="text-2xl font-bold" style={{ color: parcoursColors.textColor }}>
                Parcours {activeParcours}
              </h2>
              <p className="text-gray-600 mt-1">
                {compteurs.nbEleves} apprenant{compteurs.nbEleves > 1 ? "s" : ""} — {annee}
                {progressionGlobale !== null && (
                  <span className={`ml-4 font-semibold ${progressionGlobale >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {progressionGlobale >= 0 ? '📈' : '📉'} Progression moyenne : {progressionGlobale > 0 ? '+' : ''}{progressionGlobale}%
                  </span>
                )}
              </p>
            </div>
            
            {/* Cartes T1/T2/T3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {["t1", "t2", "t3"].map((t, idx) => {
                const colors = ["blue", "orange", "purple"][idx];
                const labels = ["T1 - Positionnement", "T2 - Intermédiaire", "T3 - Final"];
                const bgColors = ["bg-blue-50", "bg-orange-50", "bg-purple-50"][idx];
                const borderColors = ["border-blue-200", "border-orange-200", "border-purple-200"][idx];
                const textColors = ["text-blue-800", "text-orange-800", "text-purple-800"][idx];
                
                return (
                  <Card key={t} className={`border-2 ${borderColors} ${bgColors}`}>
                    <CardContent className="pt-6 text-center">
                      <h3 className={`text-sm font-semibold ${textColors} mb-4`}>{labels[idx]}</h3>
                      <div className="flex justify-center gap-8">
                        <div>
                          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                            <span className="text-white font-bold text-xl">{compteurs[t].soumis}</span>
                          </div>
                          <span className="text-sm text-green-700 font-medium">Passé</span>
                        </div>
                        <div>
                          <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-2 shadow-md">
                            <span className="text-white font-bold text-xl">{compteurs[t].enAttente}</span>
                          </div>
                          <span className="text-sm text-red-700 font-medium">En attente</span>
                        </div>
                      </div>
                      {compteurs[t].moyenne !== null && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <span className="text-sm text-gray-600">Moyenne : </span>
                          <span className={`font-bold ${textColors}`}>{compteurs[t].moyenne}%</span>
                        </div>
                      )}
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
                        <th className="text-center font-semibold px-4 py-3">
                          <div className="text-sm">T1</div>
                          <div className="text-[10px] font-normal text-gray-500">(Positionnement)</div>
                        </th>
                        <th className="text-center font-semibold px-4 py-3">
                          <div className="text-sm">T2</div>
                          <div className="text-[10px] font-normal text-gray-500">(Intermédiaire)</div>
                        </th>
                        <th className="text-center font-semibold px-4 py-3">
                          <div className="text-sm">T3</div>
                          <div className="text-[10px] font-normal text-gray-500">(Final)</div>
                        </th>
                        <th className="text-center font-semibold px-4 py-3 w-40">Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-500">
                            Aucun apprenant pour ce parcours.
                          </td>
                        </tr>
                      ) : (
                        lignes.map((e) => {
                          const progression = getProgression(e);
                          
                          return (
                            <tr key={e.id} className="border-t hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{e.nom}</td>
                              
                              {/* T1, T2, T3 */}
                              {["T1", "T2", "T3"].map((testType) => {
                                const testData = e[testType.toLowerCase()];
                                const hasScore = testData?.score !== null && testData?.score !== undefined;
                                const displayScore = hasScore ? roundScore(testData.score) : null;
                                
                                return (
                                  <td key={testType} className="px-4 py-3 text-center">
                                    {hasScore ? (
                                      <button 
                                        onClick={() => handleVoir(e, testType, testData)}
                                        className="inline-flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                                      >
                                        <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                                          <span className="text-white font-bold text-lg">{displayScore}%</span>
                                        </div>
                                        <span className="text-xs text-green-700 font-medium">Voir</span>
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => handleRelance(e, testType)}
                                        disabled={relanceLoading === `${e.id}-${testType}`}
                                        className="inline-flex flex-col items-center gap-1 hover:opacity-80 disabled:opacity-50 transition-opacity"
                                      >
                                        <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-md">
                                          <Mail className="w-5 h-5 text-white" />
                                        </div>
                                        <span className="text-xs text-red-700 font-medium">
                                          {relanceLoading === `${e.id}-${testType}` ? "..." : "Relancer"}
                                        </span>
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                              
                              {/* Résultat (progression) */}
                              <td className="px-4 py-3 text-center">
                                {progression !== null ? (
                                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                                    progression > 0 
                                      ? 'bg-green-100 text-green-800' 
                                      : progression < 0 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {progression > 0 ? (
                                      <TrendingUp className="w-4 h-4" />
                                    ) : progression < 0 ? (
                                      <TrendingDown className="w-4 h-4" />
                                    ) : (
                                      <Minus className="w-4 h-4" />
                                    )}
                                    {progression > 0 ? '+' : ''}{progression}%
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Modal résultat */}
      <TestResultModal
        isOpen={!!selectedTest}
        onClose={() => setSelectedTest(null)}
        studentName={selectedTest?.studentName}
        testType={selectedTest?.testType}
        testData={selectedTest?.testData}
      />
    </div>
  );
}
