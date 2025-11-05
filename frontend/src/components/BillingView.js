import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTHS = [
  { name: 'Octobre 2025', value: '2025-10' },
  { name: 'Novembre 2025', value: '2025-11' },
  { name: 'Décembre 2025', value: '2025-12' },
];

export default function BillingView({ sessions, onSessionsUpdate }) {
  const [activeMonth, setActiveMonth] = useState(MONTHS[1].value);
  const [editingHourlyRate, setEditingHourlyRate] = useState({});

  // Fonction pour déterminer le tarif automatiquement
  const calculateHourlyRate = (session) => {
    if (session.hourly_rate !== undefined && session.hourly_rate !== null) {
      return session.hourly_rate;
    }

    // Normaliser le sujet (retirer accents, minuscules)
    const normalizeText = (text) => {
      return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    const subject = normalizeText(session.subject);
    // "test" ou "positionnement" ou "équivalence" = TOUJOURS 20€/h
    const isTest = subject.includes('test');
    const isPositionnement = subject.includes('positionnement');
    const isEquivalence = subject.includes('equivalence');

    const isSpecial = isTest || isPositionnement || isEquivalence;
    return isSpecial ? 20 : 40;
  };

  // Enrichir les sessions avec hourly_rate et amount
  const enrichedSessions = useMemo(() => {
    return sessions.map(s => {
      const hourlyRate = calculateHourlyRate(s);
      const amount = Math.round(s.duration_hours * hourlyRate * 100) / 100;
      return {
        ...s,
        hourly_rate: hourlyRate,
        amount: amount
      };
    });
  }, [sessions]);

  // Filtrer par mois
  const monthSessions = enrichedSessions.filter(s => 
    s.date && s.date.startsWith(activeMonth)
  );

  // Calculer total du mois
  const monthTotal = monthSessions.reduce((sum, s) => sum + (s.amount || 0), 0);

  // Formater devise
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(value);
  };

  // Formater date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, parseInt(m) - 1, d);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return `${days[date.getDay()]} ${d}/${m}/${y}`;
  };

  // Mettre à jour le hourly_rate
  const handleUpdateHourlyRate = async (sessionId, newRate) => {
    try {
      await axios.put(`${API}/sessions/${sessionId}`, {
        hourly_rate: parseFloat(newRate)
      });
      toast.success('Tarif mis à jour !');
      if (onSessionsUpdate) {
        onSessionsUpdate();
      }
      setEditingHourlyRate({});
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Élève', 'Matière', 'Centre', 'Durée (h)', 'Coût horaire (€)', 'Montant (€)', 'Statut', 'Type'];
    const rows = monthSessions.map(s => [
      s.date,
      s.student_name,
      s.subject,
      s.organism || '-',
      s.duration_hours,
      s.hourly_rate,
      s.amount,
      s.signature_status === 'signed' ? 'Émargée' : s.status === 'confirmed' ? 'Confirmée' : 'En attente',
      s.meeting_link ? 'Distanciel' : 'Présentiel'
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';')),
      '',
      `Total ${MONTHS.find(m => m.value === activeMonth)?.name};;;;;${monthTotal.toFixed(2)}`
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `facturation_${activeMonth}.csv`;
    link.click();
    toast.success('Export CSV réussi !');
  };

  return (
    <div className="space-y-4">
      {/* Onglets mensuels */}
      <div className="flex gap-2 border-b pb-2">
        {MONTHS.map(month => (
          <button
            key={month.value}
            onClick={() => setActiveMonth(month.value)}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              activeMonth === month.value
                ? 'bg-pink-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {month.name}
          </button>
        ))}
      </div>

      {/* Résumé et export */}
      <div className="flex items-center justify-between bg-pink-50 p-4 rounded-lg border border-pink-200">
        <div>
          <p className="text-sm text-gray-600">Total {MONTHS.find(m => m.value === activeMonth)?.name}</p>
          <p className="text-3xl font-bold text-pink-700">{formatCurrency(monthTotal)}</p>
          <p className="text-sm text-gray-500 mt-1">{monthSessions.length} séance(s)</p>
        </div>
        <Button onClick={exportCSV} className="bg-pink-600 hover:bg-pink-700">
          <Download size={16} className="mr-2" />
          Exporter CSV
        </Button>
      </div>

      {/* Tableau */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Élève</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Matière</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Centre</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Durée (h)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Coût horaire (€)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Montant (€)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthSessions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    Aucune séance pour ce mois
                  </td>
                </tr>
              ) : (
                monthSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDate(session.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {session.student_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {session.subject}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {session.organism || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {session.duration_hours.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {editingHourlyRate[session.id] !== undefined ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            value={editingHourlyRate[session.id]}
                            onChange={(e) => setEditingHourlyRate({
                              ...editingHourlyRate,
                              [session.id]: e.target.value
                            })}
                            className="w-20 h-8 text-sm"
                            onBlur={() => {
                              if (editingHourlyRate[session.id] !== session.hourly_rate) {
                                handleUpdateHourlyRate(session.id, editingHourlyRate[session.id]);
                              } else {
                                setEditingHourlyRate({});
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateHourlyRate(session.id, editingHourlyRate[session.id]);
                              } else if (e.key === 'Escape') {
                                setEditingHourlyRate({});
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span
                          onClick={() => setEditingHourlyRate({ [session.id]: session.hourly_rate })}
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                        >
                          {session.hourly_rate.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(session.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {session.signature_status === 'signed' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Émargée
                        </span>
                      ) : session.status === 'confirmed' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Confirmée
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {session.modality === 'presentiel' ? 'Présentiel' : 'Distanciel'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {monthSessions.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    Total du mois
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-pink-700">
                    {formatCurrency(monthTotal)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
