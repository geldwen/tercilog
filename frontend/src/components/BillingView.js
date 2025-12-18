import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import axios from 'axios';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPlanningEvents, getCenterColor } from '@/utils/planningStore';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Couleur par défaut pour Zepartner
const ZEPARTNER_COLOR = '#3B82F6'; // Bleu

// Liste des années (2025 à 2030)
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

// Liste des mois
const MONTH_NAMES = [
  { num: 1, label: 'Janvier' },
  { num: 2, label: 'Février' },
  { num: 3, label: 'Mars' },
  { num: 4, label: 'Avril' },
  { num: 5, label: 'Mai' },
  { num: 6, label: 'Juin' },
  { num: 7, label: 'Juillet' },
  { num: 8, label: 'Août' },
  { num: 9, label: 'Septembre' },
  { num: 10, label: 'Octobre' },
  { num: 11, label: 'Novembre' },
  { num: 12, label: 'Décembre' }
];

// Calculer la durée en heures entre deux horaires
const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH + endM/60) - (startH + startM/60);
};

export default function BillingView({ sessions, onSessionsUpdate }) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(currentDate.getMonth() + 1);
  const [editingHourlyRate, setEditingHourlyRate] = useState({});
  const [planningEvents, setPlanningEvents] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState('all'); // 'all' = tous les centres

  // Charger les événements du planning
  useEffect(() => {
    const loadPlanningEvents = async () => {
      try {
        const events = await getPlanningEvents();
        setPlanningEvents(events);
      } catch (error) {
        console.error('Error loading planning events:', error);
      }
    };
    loadPlanningEvents();
  }, []);

  // Calculer activeMonth à partir de l'année et du mois sélectionnés
  const activeMonth = useMemo(() => {
    const monthStr = selectedMonthNum.toString().padStart(2, '0');
    return `${selectedYear}-${monthStr}`;
  }, [selectedYear, selectedMonthNum]);

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
    // Sessions Zepartner (existantes)
    const zepartnerSessions = sessions.map(s => {
      const hourlyRate = (s.hourly_rate !== undefined && s.hourly_rate !== null && s.hourly_rate > 0) 
        ? s.hourly_rate 
        : null;
      
      const amount = hourlyRate ? Math.round(s.duration_hours * hourlyRate * 100) / 100 : 0;
      
      return {
        ...s,
        hourly_rate: hourlyRate,
        hourly_rate_source: s.hourly_rate_source || 'auto',
        amount: amount,
        source: 'session' // Pour identifier la source
      };
    });

    // Événements du planning (SFA, autres centres...)
    const planningSessionsConverted = planningEvents
      .filter(e => e.hourly_rate && e.hourly_rate > 0) // Seulement ceux avec un tarif
      .map(e => {
        const duration = calculateDuration(e.start_time, e.end_time);
        const amount = Math.round(duration * e.hourly_rate * 100) / 100;
        const organism = (e.organism || 'Autre').trim(); // Normaliser le nom
        
        return {
          id: e.id,
          date: e.date,
          start_time: e.start_time,
          end_time: e.end_time,
          duration_hours: duration,
          student_name: e.title, // Utiliser le titre comme "nom"
          subject: e.subject || e.title,
          organism: organism,
          center: organism,
          hourly_rate: e.hourly_rate,
          hourly_rate_source: 'manual',
          amount: amount,
          modality: e.modality || 'distanciel',
          source: 'planning', // Pour identifier la source
          color: e.color // Garder la couleur de l'événement
        };
      });

    return [...zepartnerSessions, ...planningSessionsConverted];
  }, [sessions, planningEvents]);

  // Liste des centres uniques pour le filtre
  const uniqueCenters = useMemo(() => {
    const centers = new Set();
    enrichedSessions.forEach(s => {
      let center = (s.organism || s.center || '').trim();
      if (!center || center === 'Non défini' || center === '') {
        center = 'Zepartner';
      }
      centers.add(center);
    });
    return Array.from(centers).sort();
  }, [enrichedSessions]);

  // Filtrer par mois et trier par date/heure croissante
  const monthSessions = useMemo(() => {
    return enrichedSessions
      .filter(s => s.date && s.date.startsWith(activeMonth))
      .filter(s => {
        if (selectedCenter === 'all') return true;
        let center = (s.organism || s.center || '').trim();
        if (!center || center === 'Non défini' || center === '') {
          center = 'Zepartner';
        }
        return center === selectedCenter;
      })
      .sort((a, b) => {
        // Tri par date puis par heure de début
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
  }, [enrichedSessions, activeMonth, selectedCenter]);

  // Sessions du mois SANS filtre centre (pour le récapitulatif global)
  const allMonthSessions = useMemo(() => {
    return enrichedSessions
      .filter(s => s.date && s.date.startsWith(activeMonth))
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
  }, [enrichedSessions, activeMonth]);

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

  // Calculer totaux par centre/organisme
  const totalsByCenter = useMemo(() => {
    const byCenter = {};
    monthSessions.forEach(s => {
      // Normaliser le nom du centre (trim les espaces)
      let center = (s.organism || s.center || '').trim();
      
      // Si pas de centre ou "Non défini", c'est Zepartner
      if (!center || center === 'Non défini' || center === '') {
        center = 'Zepartner';
      }
      
      if (!byCenter[center]) {
        // Obtenir la couleur du centre
        let color;
        if (center === 'Zepartner') {
          color = ZEPARTNER_COLOR;
        } else if (s.color) {
          // Utiliser la couleur de l'événement si disponible
          color = s.color;
        } else {
          color = getCenterColor(center);
        }
        byCenter[center] = { amount: 0, hours: 0, sessions: 0, color };
      }
      byCenter[center].amount += (s.amount || 0);
      byCenter[center].hours += (s.duration_hours || 0);
      byCenter[center].sessions += 1;
    });
    // Trier par montant décroissant
    return Object.entries(byCenter)
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([name, data]) => ({ name, ...data }));
  }, [monthSessions]);

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
      `Total ${MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} ${selectedYear};;;;;${monthTotal.toFixed(2)}`
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
      
      const monthName = `${MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} ${selectedYear}`;
      
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
      {/* Filtres Année et Mois */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Année :</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-pink-700"
          >
            {YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Mois :</label>
          <select
            value={selectedMonthNum}
            onChange={(e) => setSelectedMonthNum(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-pink-700"
          >
            {MONTH_NAMES.map(m => (
              <option key={m.num} value={m.num}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-500">
          Période : <span className="font-medium text-pink-700">{MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</span>
        </div>
      </div>

      {/* Résumé global par centre */}
      {totalsByCenter.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 Récapitulatif par Centre - {MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {totalsByCenter.map(center => (
              <div 
                key={center.name} 
                className="p-3 rounded-lg shadow-sm border-2"
                style={{ 
                  borderColor: center.color,
                  backgroundColor: `${center.color}15` // 15 = opacity ~10%
                }}
              >
                <p className="text-xs font-bold truncate" style={{ color: center.color }} title={center.name}>{center.name}</p>
                <p className="text-xl font-bold" style={{ color: center.color }}>{formatCurrency(center.amount)}</p>
                <p className="text-xs text-gray-500">{center.sessions} séance(s) • {center.hours.toFixed(1)}h</p>
              </div>
            ))}
          </div>
          {/* Total global en noir avec écriture blanche */}
          <div className="mt-3 pt-3 flex justify-between items-center bg-gray-900 text-white p-4 rounded-lg -mx-4 -mb-4">
            <span className="text-sm font-bold uppercase">TOTAL GLOBAL - {MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</span>
            <span className="text-2xl font-bold">{formatCurrency(monthTotal)}</span>
          </div>
        </div>
      )}

      {/* Résumé et export */}
      <div className="flex items-center justify-between bg-pink-50 p-4 rounded-lg border border-pink-200">
        <div>
          <p className="text-sm text-gray-600">Total {MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</p>
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
