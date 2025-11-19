import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { LineChart, FileDown, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function BilanTests() {
  const navigate = useNavigate();
  
  // Supprimer l'erreur ResizeObserver qui est un avertissement non critique
  useEffect(() => {
    const resizeObserverErrHandler = (e) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        const resizeObserverErr = e;
        if (resizeObserverErr) {
          e.stopImmediatePropagation();
        }
      }
    };
    window.addEventListener('error', resizeObserverErrHandler);
    return () => window.removeEventListener('error', resizeObserverErrHandler);
  }, []);
  const [periode, setPeriode] = useState('mois');
  const [mois, setMois] = useState('11');
  const [annee, setAnnee] = useState('2025');
  const [parcours, setParcours] = useState('tous');
  const [matiere, setMatiere] = useState('toutes');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        periode,
        mois,
        annee,
        parcours,
        matiere,
      });

      const response = await axios.get(`${API}/bilan-tests?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      setData(response.data);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      toast.info('Génération du PDF en cours...');

      const params = new URLSearchParams({
        periode,
        mois,
        annee,
        parcours,
        matiere,
      });

      const response = await axios.get(`${API}/bilan-tests-pdf?${params.toString()}`, {
        headers: getAuthHeaders(),
        responseType: 'blob',
      });

      // Télécharger le PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bilan_Tests_${parcours}_${mois}_${annee}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF téléchargé avec succès!');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const formatPourcent = (n) =>
    n === null || Number.isNaN(n) ? '—' : `${n.toFixed(2)}%`;

  const couleurScore = (n) => {
    if (n === null) return '';
    if (n >= 70) return 'text-green-700 font-semibold';
    if (n >= 40) return 'text-yellow-700 font-semibold';
    return 'text-red-700 font-semibold';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header avec bouton retour */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/teacher')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au tableau de bord
            </Button>
            
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <LineChart className="h-8 w-8 text-purple-700" />
              Bilan des tests
            </h1>
          </div>

          <Button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className="bg-purple-700 hover:bg-purple-800 text-white flex items-center gap-2"
          >
            {exportingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Générer le bilan tests (PDF)
              </>
            )}
          </Button>
        </div>

        {/* Filtres */}
        <Card className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Période */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Période</span>
              <div className="flex gap-2">
                <Select value={periode} onValueChange={setPeriode}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mois">Mois</SelectItem>
                    <SelectItem value="annee">Année</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={mois}
                  onValueChange={setMois}
                  disabled={periode !== 'mois'}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">janvier</SelectItem>
                    <SelectItem value="2">février</SelectItem>
                    <SelectItem value="3">mars</SelectItem>
                    <SelectItem value="4">avril</SelectItem>
                    <SelectItem value="5">mai</SelectItem>
                    <SelectItem value="6">juin</SelectItem>
                    <SelectItem value="7">juillet</SelectItem>
                    <SelectItem value="8">août</SelectItem>
                    <SelectItem value="9">septembre</SelectItem>
                    <SelectItem value="10">octobre</SelectItem>
                    <SelectItem value="11">novembre</SelectItem>
                    <SelectItem value="12">décembre</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={annee} onValueChange={setAnnee}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Parcours */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Parcours</span>
              <Select value={parcours} onValueChange={setParcours}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="bureautique">Bureautique</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="anglais">Anglais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Matière */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Matière</span>
              <Select value={matiere} onValueChange={setMatiere}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes</SelectItem>
                  <SelectItem value="bureautique">Bureautique</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="anglais">Anglais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={fetchData} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                'Rafraîchir'
              )}
            </Button>
          </div>
        </Card>

        {/* Indicateurs clés */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 space-y-2">
            <p className="text-xs uppercase text-gray-500 font-medium">
              Évaluations réalisées
            </p>
            <p className="text-3xl font-bold text-purple-700">
              {data ? data.nbEvaluations : '--'}
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <p className="text-xs uppercase text-gray-500 font-medium">
              Progression moyenne T1 → T3
            </p>
            <p
              className={`text-3xl font-bold ${
                data && data.progressionMoyenne >= 0
                  ? 'text-green-700'
                  : 'text-red-700'
              }`}
            >
              {data ? `${data.progressionMoyenne.toFixed(1)} pts` : '--'}
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <p className="text-xs uppercase text-gray-500 font-medium">
              Taux d'acquisition final
            </p>
            <p className="text-3xl font-bold text-purple-700">
              {data ? formatPourcent(data.tauxAcquisition) : '--'}
            </p>
          </Card>

          <Card className="p-6 space-y-2">
            <p className="text-xs uppercase text-gray-500 font-medium">
              % en difficulté
            </p>
            <p className="text-3xl font-bold text-orange-600">
              {data ? formatPourcent(data.tauxDifficulte) : '--'}
            </p>
          </Card>
        </div>

        {/* Tableau détaillé */}
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-purple-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Élève</th>
                <th className="px-4 py-3 text-left font-semibold">Parcours</th>
                <th className="px-4 py-3 text-left font-semibold">Matière</th>
                <th className="px-4 py-3 text-right font-semibold">T1</th>
                <th className="px-4 py-3 text-right font-semibold">T2</th>
                <th className="px-4 py-3 text-right font-semibold">T3</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Progression
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Niveau final
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Difficultés
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Remédiation
                </th>
                <th className="px-4 py-3 text-left font-semibold">Rapport</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows?.length ? (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{row.eleve}</td>
                    <td className="px-4 py-3 capitalize">{row.parcours}</td>
                    <td className="px-4 py-3 capitalize">{row.matiere}</td>
                    <td
                      className={`px-4 py-3 text-right ${couleurScore(
                        row.t1
                      )}`}
                    >
                      {formatPourcent(row.t1)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${couleurScore(
                        row.t2
                      )}`}
                    >
                      {formatPourcent(row.t2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${couleurScore(
                        row.t3
                      )}`}
                    >
                      {formatPourcent(row.t3)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.progression === null
                        ? '—'
                        : `${row.progression > 0 ? '+' : ''}${row.progression.toFixed(
                            1
                          )} pts`}
                    </td>
                    <td className="px-4 py-3">{row.niveauFinal}</td>
                    <td className="px-4 py-3">
                      {row.difficultePrincipale ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.remediation ? (
                        <span className="text-orange-600 font-semibold">
                          Oui
                        </span>
                      ) : (
                        'Non'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.rapportUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await axios.get(
                                row.rapportUrl,
                                {
                                  headers: getAuthHeaders(),
                                  responseType: 'blob',
                                }
                              );
                              const url = window.URL.createObjectURL(
                                new Blob([response.data])
                              );
                              window.open(url, '_blank');
                            } catch (error) {
                              toast.error('Erreur lors de l\'ouverture du rapport');
                            }
                          }}
                        >
                          Ouvrir
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-gray-500"
                    colSpan={11}
                  >
                    {loading
                      ? 'Chargement...'
                      : 'Aucun test trouvé pour les filtres sélectionnés.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
