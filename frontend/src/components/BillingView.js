import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import axios from 'axios';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // Normaliser un sujet
  const normalizeText = (text) => {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase();
  };

  // Fonction pour déterminer le tarif automatiquement
  const inferHourlyRate = (subject) => {
    const keywords20 = [
      'test de positionnement',
      'test positionnement',
      'test position',
      'test posi',
      'positionnement initial',
      'positionnement',
      'equivalence'
    ];

    const normalized = normalizeText(subject);
    const isSpecial = keywords20.some(keyword => normalizeText(keyword).split(' ').every(word => normalized.includes(word)));
    return isSpecial ? 20 : 40;
  };

  // Appliquer la suggestion de tarif
  const applySuggestedRate = async (sessionId, subject) => {
    const suggestedRate = inferHourlyRate(subject);
    try {
      await axios.put(`${API}/sessions/${sessionId}`, {
        hourly_rate: suggestedRate,
        hourly_rate_source: 'auto'
      });
      toast.success(`Tarif appliqué : ${suggestedRate}€/h`);
      if (onSessionsUpdate) {
        onSessionsUpdate();
      }
    } catch (error) {
      toast.error('Erreur lors de l\'application du tarif');
    }
  };

  // Enrichir les sessions avec hourly_rate et amount
  const enrichedSessions = useMemo(() => {
    return sessions.map(s => {
      // Utiliser hourly_rate de l'API si présent, sinon null (affichera badge)
      const hourlyRate = (s.hourly_rate !== undefined && s.hourly_rate !== null && s.hourly_rate > 0) 
        ? s.hourly_rate 
        : null;
      
      const amount = hourlyRate ? Math.round(s.duration_hours * hourlyRate * 100) / 100 : 0;
      
      return {
        ...s,
        hourly_rate: hourlyRate,
        hourly_rate_source: s.hourly_rate_source || 'auto',
        amount: amount
      };
    });
  }, [sessions]);

  // Filtrer par mois et trier par date/heure croissante
  const monthSessions = enrichedSessions
    .filter(s => s.date && s.date.startsWith(activeMonth))
    .sort((a, b) => {
      // Tri par date puis par heure de début
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

  // Grouper les séances par jour
  const sessionsByDay = monthSessions.reduce((acc, session) => {
    if (!acc[session.date]) {
      acc[session.date] = [];
    }
    acc[session.date].push(session);
    return acc;
  }, {});

  // Calculer total du mois (montant et heures)
  const monthTotal = monthSessions.reduce((sum, s) => sum + (s.amount || 0), 0);
  const monthTotalHours = monthSessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0);

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
      s.organism || 'Zepartner', // Par défaut Zepartner si vide (séances bleues)
      s.duration_hours,
      s.hourly_rate,
      s.amount,
      s.signature_status === 'signed' ? 'Émargée' : s.status === 'confirmed' ? 'Confirmée' : 'En attente',
      s.modality === 'presentiel' ? 'Présentiel' : 'Distanciel'
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

  // Formater date avec horaires pour PDF (format européen + horaires)
  const formatDateWithTime = (session) => {
    if (!session.date) return '';
    const [y, m, d] = session.date.split('-');
    const date = new Date(y, parseInt(m) - 1, d);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dayName = days[date.getDay()];
    const timeRange = `${session.start_time || ''}–${session.end_time || ''}`;
    return `${dayName} ${d}/${m}/${y}\n${timeRange}`;
  };

  // Export PDF avec logo TerciForm
  const exportPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const monthName = MONTHS.find(m => m.value === activeMonth)?.name || activeMonth;
      
      // Logo TerciForm (en-tête gauche) - charger en base64
      const logoUrl = '/logo_terciform.png';
      let logoLoaded = false;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = () => {
            try {
              // Créer un canvas temporaire pour convertir en base64
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              doc.addImage(dataUrl, 'PNG', 14, 10, 35, 15); // Largeur ~35mm
              logoLoaded = true;
              resolve();
            } catch (e) {
              console.warn('Erreur conversion logo:', e);
              resolve(); // Continue sans logo
            }
          };
          img.onerror = () => {
            console.warn('Logo non chargé');
            resolve(); // Continue sans logo
          };
          img.src = logoUrl;
          setTimeout(() => resolve(), 2000); // Timeout après 2s
        });
      } catch (e) {
        console.warn('Logo non chargé:', e);
      }
      
      // Titre (à droite du logo)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`Facturation — ${monthName}`, 55, 20);
      
      // Tableau - filtrer et trier les sessions avec prix
      const sessionsWithPrice = monthSessions
        .filter(s => s.hourly_rate !== null && s.hourly_rate > 0)
        .sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return (a.start_time || '').localeCompare(b.start_time || '');
        });
      
      const headers = [['Date\nHoraire', 'Élève', 'Matière', 'Centre', 'Durée\n(h)', 'Tarif/h\n(€)', 'Montant\n(€)', 'Statut', 'Type']];
      const rows = sessionsWithPrice.map(s => [
        formatDateWithTime(s),
        s.student_name || '-',
        s.subject || '-',
        s.organism || 'Zepartner', // Par défaut Zepartner si vide (séances bleues)
        (s.duration_hours || 0).toFixed(1),
        (s.hourly_rate || 0).toFixed(0),
        (s.amount || 0).toFixed(2),
        s.signature_status === 'signed' ? 'Émargée' : s.status === 'confirmed' ? 'Confirmée' : 'Attente',
        s.modality === 'presentiel' ? 'Prés.' : 'Dist.'
      ]);
      
      // Total seulement des sessions avec prix
      const totalWithPrice = sessionsWithPrice.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalHoursWithPrice = sessionsWithPrice.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
      
      doc.autoTable({
        head: headers,
        body: rows,
        startY: 32,
        margin: { left: 14, right: 14 },
        styles: { 
          fontSize: 8, 
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [30, 58, 95], // Bleu TerciForm
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Date + Horaire
          1: { cellWidth: 35 }, // Élève
          2: { cellWidth: 40 }, // Matière
          3: { cellWidth: 30 }, // Centre
          4: { halign: 'center', cellWidth: 15 }, // Durée
          5: { halign: 'right', cellWidth: 18 }, // Tarif/h
          6: { halign: 'right', cellWidth: 20 }, // Montant
          7: { halign: 'center', cellWidth: 20 }, // Statut
          8: { halign: 'center', cellWidth: 15 }  // Type
        },
        footStyles: { 
          fillColor: [232, 240, 247], 
          textColor: 0, 
          fontStyle: 'bold',
          fontSize: 9
        },
        foot: [[
          { content: `TOTAL ${monthName.toUpperCase()}`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalHoursWithPrice.toFixed(1)} h`, styles: { halign: 'center', fontStyle: 'bold' } },
          '',
          { content: `${totalWithPrice.toFixed(2)} €`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, fillColor: [30, 58, 95], textColor: 255 } },
          '', ''
        ]],
        didDrawPage: function(data) {
          // Numéro de page en bas à droite
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(128);
          doc.text(`Page ${data.pageNumber} / ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        }
      });
      
      // Note si des sessions sans prix
      const sessionsWithoutPrice = monthSessions.filter(s => !s.hourly_rate || s.hourly_rate === 0);
      if (sessionsWithoutPrice.length > 0) {
        const finalY = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(9);
        doc.setTextColor(220, 38, 38); // Rouge
        doc.text(`⚠️ ${sessionsWithoutPrice.length} séance(s) sans tarif horaire non incluse(s) dans ce total`, 14, finalY);
      }
      
      doc.save(`facturation_${activeMonth}.pdf`);
      toast.success('Export PDF réussi !');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      console.error('Stack trace:', error.stack);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
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
          <p className="text-sm text-gray-500 mt-1">
            {monthSessions.length} séance(s) • {monthTotalHours.toFixed(2)}h
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-pink-600 hover:bg-pink-700">
              <Download size={16} className="mr-2" />
              Exporter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV}>
              <FileSpreadsheet size={16} className="mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF}>
              <FileText size={16} className="mr-2" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <tbody className="bg-white">
              {monthSessions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    Aucune séance pour ce mois
                  </td>
                </tr>
              ) : (
                Object.keys(sessionsByDay).sort().map((date) => {
                  const daySessions = sessionsByDay[date];
                  const dayTotal = daySessions.reduce((sum, s) => sum + (s.amount || 0), 0);
                  const dayHours = daySessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
                  
                  return (
                    <React.Fragment key={date}>
                      {/* Ligne principale du jour */}
                      <tr className="bg-blue-50 border-t-2 border-blue-200">
                        <td className="px-4 py-3 text-sm font-bold text-blue-900" rowSpan={daySessions.length + 1}>
                          {formatDate(date)}
                        </td>
                        <td colSpan="3" className="px-4 py-2 text-xs font-semibold text-blue-800">
                          {daySessions.length} séance(s) • Détails ci-dessous
                        </td>
                        <td className="px-4 py-2 text-sm font-bold text-blue-900 text-right">
                          {dayHours.toFixed(2)} h
                        </td>
                        <td className="px-4 py-2 text-sm text-blue-800 text-right">-</td>
                        <td className="px-4 py-2 text-sm font-bold text-blue-900 text-right">
                          {formatCurrency(dayTotal)}
                        </td>
                        <td colSpan="2" className="px-4 py-2"></td>
                      </tr>
                      
                      {/* Détails des séances du jour */}
                      {daySessions.map((session, idx) => (
                        <tr key={session.id} className={`hover:bg-gray-50 ${idx === daySessions.length - 1 ? 'border-b-2 border-gray-300' : ''}`}>
                          <td className="px-4 py-2 pl-8 text-xs text-gray-600">
                            ⏰ {session.start_time}–{session.end_time}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {session.student_name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {session.subject}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {session.organism || 'Zepartner'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">
                            {session.duration_hours.toFixed(2)} h
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {session.hourly_rate === null ? (
                              <div className="flex items-center gap-2 justify-end">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Prix manquant
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => applySuggestedRate(session.id, session.subject)}
                                  className="text-xs h-6 bg-blue-600 hover:bg-blue-700"
                                >
                                  Suggérer
                                </Button>
                              </div>
                            ) : editingHourlyRate[session.id] !== undefined ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={editingHourlyRate[session.id]}
                                  onChange={(e) => setEditingHourlyRate({
                                    ...editingHourlyRate,
                                    [session.id]: e.target.value
                                  })}
                                  className="w-20 h-7 text-sm"
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
                                {session.hourly_rate.toFixed(2)} €
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                            {formatCurrency(session.amount)}
                          </td>
                          <td className="px-4 py-2 text-xs">
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
                                Attente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            {session.modality === 'presentiel' ? 'Prés.' : 'Dist.'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {monthSessions.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="4" className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    Total du mois
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-pink-700">
                    {monthTotalHours.toFixed(2)} h
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    -
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
