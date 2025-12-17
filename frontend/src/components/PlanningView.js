import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, Lock, Users, Copy, MoreVertical, Edit } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import axios from 'axios';
import { getPlanningEvents, savePlanningEvent, deletePlanningEvent, getCenterColors, setCenterColor, getCenterColor, PREDEFINED_COLORS } from '@/utils/planningStore';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8h à 21h
const HOUR_HEIGHT_PX = 60; // Hauteur d'une ligne horaire en px
const PX_PER_MIN = HOUR_HEIGHT_PX / 60; // pixels par minute : 1px/min

export default function PlanningView({ sessions, onSessionsUpdate }) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(currentDate.getMonth() + 1);
  
  // Calculer activeMonth à partir de l'année et du mois sélectionnés
  const activeMonth = useMemo(() => {
    const monthStr = selectedMonthNum.toString().padStart(2, '0');
    return `${selectedYear}-${monthStr}`;
  }, [selectedYear, selectedMonthNum]);

  // Calculer les jours du mois sélectionné
  const currentMonth = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonthNum, 0).getDate();
    const firstDayOfMonth = new Date(selectedYear, selectedMonthNum - 1, 1).getDay();
    const startDay = (firstDayOfMonth + 6) % 7; // Convertir dimanche=0 en lundi=0
    return {
      name: `${MONTH_NAMES.find(m => m.num === selectedMonthNum)?.label} ${selectedYear}`,
      value: activeMonth,
      days: daysInMonth,
      startDay: startDay
    };
  }, [selectedYear, selectedMonthNum, activeMonth]);

  const [planningEvents, setPlanningEvents] = useState([]);
  const [centerColors, setCenterColorsState] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [eventToDuplicate, setEventToDuplicate] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [duplicateData, setDuplicateData] = useState({
    date: '',
    start_time: '',
    end_time: ''
  });
  const [modalData, setModalData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    center: '',
    subject: '',
    title: '',
    modality: 'distanciel',
    color: '#3B82F6',
    hourly_rate: ''
  });
  const [selectedCenter, setSelectedCenter] = useState('');

  useEffect(() => {
    const loadPlanningData = async () => {
      try {
        const events = await getPlanningEvents();
        setPlanningEvents(events);
        setCenterColorsState(getCenterColors());
      } catch (error) {
        console.error('Error loading planning events:', error);
        toast.error('Erreur lors du chargement du planning');
      }
    };
    loadPlanningData();
  }, []);

  const generateMonthDays = () => {
    const days = [];
    const [year, month] = activeMonth.split('-');
    
    for (let day = 1; day <= currentMonth.days; day++) {
      const date = new Date(year, parseInt(month) - 1, day);
      const dayOfWeek = (date.getDay() + 6) % 7;
      days.push({
        day,
        dayOfWeek,
        date: `${year}-${month}-${String(day).padStart(2, '0')}`,
        dayName: DAYS_FR[dayOfWeek]
      });
    }
    return days;
  };

  const monthDays = generateMonthDays();

  // Combiner séances API + événements planning
  const allEvents = [
    ...sessions.filter(s => s.date && s.date.startsWith(activeMonth)).map(s => ({
      ...s,
      origin: 'emergent',
      title: s.subject,
      center: s.organism || 'Séance',
      participant: s.student_name,
      color: getCenterColor(s.organism || '')
    })),
    ...planningEvents.filter(e => e.date && e.date.startsWith(activeMonth)).map(e => ({
      ...e,
      origin: 'local',
      participant: e.center,
      // Utiliser la couleur sauvegardée dans l'événement
      // (elle contient déjà la bonne couleur choisie lors de la création)
      color: e.color || '#3B82F6'
    }))
  ];

  // FUSION DES PARTICIPANTS : Grouper par clé unique
  const groupEventsByKey = (events) => {
    const groups = new Map();
    
    events.forEach(event => {
      // Clé = session_id (Emergent) ou date|start|end|subject|center
      const groupKey = event.session_id || event.id || 
        `${event.date}|${event.start_time}|${event.end_time}|${event.subject || event.title}|${event.center || ''}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          ...event,
          participants: [],
          groupKey
        });
      }
      
      const group = groups.get(groupKey);
      if (event.participant) {
        group.participants.push(event.participant);
      }
    });
    
    return Array.from(groups.values());
  };

  // Grouper par date et fusionner participants
  const eventsByDate = {};
  allEvents.forEach(event => {
    if (!eventsByDate[event.date]) {
      eventsByDate[event.date] = [];
    }
    eventsByDate[event.date].push(event);
  });

  // Appliquer le grouping sur chaque jour
  Object.keys(eventsByDate).forEach(date => {
    eventsByDate[date] = groupEventsByKey(eventsByDate[date]);
  });

  // Calcul position PARFAIT avec PX_PER_MIN
  const getEventPosition = (startTime, endTime) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    // Minutes depuis 08:00
    const startMinutesSince08h = Math.max(0, (startH - 8) * 60 + startM);
    const endMinutesSince08h = Math.min(13 * 60, (endH - 8) * 60 + endM);
    
    // Calcul en pixels
    const topPx = Math.round(startMinutesSince08h * PX_PER_MIN);
    const heightPx = Math.round((endMinutesSince08h - startMinutesSince08h) * PX_PER_MIN);
    
    return { 
      top: `${topPx}px`, 
      height: `${Math.max(heightPx, 30)}px` // minimum 30px de hauteur
    };
  };

  // Algorithme de lanes pour chevauchements (sweep line)
  const calculateLanes = (dateEvents) => {
    const sorted = [...dateEvents].sort((a, b) => {
      const cmp = a.start_time.localeCompare(b.start_time);
      return cmp !== 0 ? cmp : a.end_time.localeCompare(b.end_time);
    });
    
    const lanes = [];
    const eventLanes = [];
    
    sorted.forEach(event => {
      const [startH, startM] = event.start_time.split(':').map(Number);
      const start = startH * 60 + startM;
      
      // Trouver le premier lane disponible
      let laneIndex = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= start) {
          laneIndex = i;
          break;
        }
      }
      
      // Si aucun lane disponible, créer un nouveau
      if (laneIndex === -1) {
        laneIndex = lanes.length;
        lanes.push(0);
      }
      
      // Mettre à jour la fin du lane
      const [endH, endM] = event.end_time.split(':').map(Number);
      const end = endH * 60 + endM;
      lanes[laneIndex] = end;
      
      eventLanes.push({ event, laneIndex });
    });
    
    const maxLanes = lanes.length;
    return { eventLanes, maxLanes };
  };

  // Ouvrir modal de création
  const handleCellClick = (date, hour) => {
    setCurrentEvent(null); // Réinitialiser l'événement en cours
    setModalData({
      date,
      start_time: `${String(hour).padStart(2, '0')}:00`,
      end_time: `${String(hour + 1).padStart(2, '0')}:00`,
      center: '',
      subject: '',
      title: '',
      modality: 'distanciel',
      color: '#3B82F6'
    });
    setShowModal(true);
  };

  // Sauvegarder événement
  const handleSaveEvent = async () => {
    if (!modalData.center || !modalData.title) {
      toast.error('Veuillez remplir les champs requis (Intitulé et Centre)');
      return;
    }

    // Zepartner est toujours bleu, pas de sélection de couleur
    if (modalData.center === 'Zepartner' || centerColors[modalData.center]) {
      const event = {
        ...modalData,
        color: getCenterColor(modalData.center),
        organism: modalData.center
      };
      
      // Si on édite un événement existant, conserver son ID
      if (currentEvent) {
        event.id = currentEvent.id;
      }
      
      try {
        await savePlanningEvent(event);
        const updatedEvents = await getPlanningEvents();
        setPlanningEvents(updatedEvents);
        setShowModal(false);
        setCurrentEvent(null);
        toast.success(currentEvent ? 'Bloc planning modifié !' : 'Bloc planning créé !');
      } catch (error) {
        console.error('Error saving event:', error);
        toast.error('Erreur lors de la sauvegarde');
      }
      return;
    }

    // Demander une couleur pour un nouveau centre
    setSelectedCenter(modalData.center);
    setShowColorPicker(true);
  };

  // Choisir couleur pour un centre
  const handleColorSelect = async (color) => {
    setCenterColor(selectedCenter, color);
    setCenterColorsState(getCenterColors());
    
    const event = {
      ...modalData,
      color,
      organism: selectedCenter
    };
    
    // Si on édite un événement existant, conserver son ID
    if (currentEvent) {
      event.id = currentEvent.id;
    }
    
    try {
      await savePlanningEvent(event);
      const updatedEvents = await getPlanningEvents();
      setPlanningEvents(updatedEvents);
      setShowColorPicker(false);
      setShowModal(false);
      setCurrentEvent(null);
      toast.success(currentEvent ? 'Bloc planning modifié avec couleur !' : 'Bloc planning créé avec couleur !');
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  // Ouvrir dialogue de suppression
  const handleDeleteClick = (event, e) => {
    e.stopPropagation();
    setEventToDelete(event);
    setShowDeleteDialog(true);
  };

  // Confirmer suppression
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;

    try {
      if (eventToDelete.origin === 'local') {
        // Supprimer de MongoDB
        await deletePlanningEvent(eventToDelete.id);
        const updatedEvents = await getPlanningEvents();
        setPlanningEvents(updatedEvents);
        toast.success('Bloc planning supprimé !');
      } else if (eventToDelete.origin === 'emergent') {
        // Appeler l'API de suppression
        await axios.delete(`${API}/sessions/${eventToDelete.id}`);
        toast.success('Séance supprimée !');
        // Recharger les sessions
        if (onSessionsUpdate) {
          onSessionsUpdate();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    } finally {
      setShowDeleteDialog(false);
      setEventToDelete(null);
    }
  };

  // Ouvrir dialogue de duplication
  const handleDuplicateClick = (event, e) => {
    e.stopPropagation();
    
    // Calculer le jour suivant
    const currentDate = new Date(event.date);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDay = currentDate.toISOString().split('T')[0];
    
    setEventToDuplicate(event);
    setDuplicateData({
      date: nextDay,
      start_time: event.start_time,
      end_time: event.end_time
    });
    setShowDuplicateDialog(true);
  };

  // Confirmer duplication
  const handleConfirmDuplicate = async () => {
    if (!eventToDuplicate) return;

    try {
      if (eventToDuplicate.origin === 'emergent') {
        // Dupliquer via API
        const sessionData = {
          subject: eventToDuplicate.subject,
          date: duplicateData.date,
          start_time: duplicateData.start_time,
          end_time: duplicateData.end_time,
          student_id: eventToDuplicate.student_id,
          validation_deadline_hours: 48,
          meeting_link: eventToDuplicate.meeting_link || '',
          organism: eventToDuplicate.organism || eventToDuplicate.center || '',
          hourly_rate: eventToDuplicate.hourly_rate || 40,
          modality: eventToDuplicate.modality || 'distanciel'
        };
        
        await axios.post(`${API}/sessions`, sessionData);
        toast.success('Séance dupliquée !');
        
        if (onSessionsUpdate) {
          onSessionsUpdate();
        }
      } else {
        // Dupliquer en local (MongoDB)
        const newEvent = {
          title: eventToDuplicate.title,
          center: eventToDuplicate.center,
          color: eventToDuplicate.color,
          organism: eventToDuplicate.organism || eventToDuplicate.center || '',
          date: duplicateData.date,
          start_time: duplicateData.start_time,
          end_time: duplicateData.end_time
        };
        
        await savePlanningEvent(newEvent);
        const updatedEvents = await getPlanningEvents();
        setPlanningEvents(updatedEvents);
        toast.success('Bloc planning dupliqué !');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la duplication');
    } finally {
      setShowDuplicateDialog(false);
      setEventToDuplicate(null);
    }
  };

  // Obtenir liste unique des centres
  const uniqueCenters = [...new Set([
    ...sessions.map(s => s.organism).filter(Boolean),
    ...planningEvents.map(e => e.center).filter(Boolean)
  ])];

  return (
    <div className="space-y-4 planning-root">
      {/* Onglets mensuels */}
      <div className="flex gap-2 border-b pb-2">
        {MONTHS.map(month => (
          <button
            key={month.value}
            onClick={() => setActiveMonth(month.value)}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              activeMonth === month.value
                ? 'bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {month.name}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Zepartner</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
          <span>Libre</span>
        </div>
        {uniqueCenters.filter(c => c !== 'Zepartner').map(center => (
          <div key={center} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded" 
              style={{ backgroundColor: getCenterColor(center) }}
            ></div>
            <span className="text-xs">{center}</span>
          </div>
        ))}
      </div>

      {/* Calendrier */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full">
            {/* Colonne des heures */}
            <div className="sticky left-0 z-10 bg-gray-50 border-r" style={{ width: '60px' }}>
              <div className="h-12 border-b bg-gray-100"></div>
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="border-b text-xs text-gray-600 flex items-start justify-center pt-1 font-medium"
                  style={{ height: `${HOUR_HEIGHT_PX}px` }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Colonnes des jours */}
            {monthDays.map(({ day, date, dayName }) => {
              const dayEvents = eventsByDate[date] || [];
              const { eventLanes, maxLanes } = calculateLanes(dayEvents);
              
              return (
                <div key={date} className="border-r" style={{ minWidth: '140px', width: '140px' }}>
                  {/* En-tête jour */}
                  <div className="h-12 border-b bg-gray-100 flex flex-col items-center justify-center text-xs font-semibold">
                    <span className="text-gray-500">{dayName}</span>
                    <span className="text-gray-800">{String(day).padStart(2, '0')}/{activeMonth.split('-')[1]}</span>
                  </div>

                  {/* Grille horaire */}
                  <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT_PX}px`, position: 'relative' }}>
                    {/* Lignes horaires cliquables */}
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className="absolute w-full border-b bg-green-50 hover:bg-green-100 cursor-pointer transition-colors"
                        style={{ top: `${(hour - 8) * HOUR_HEIGHT_PX}px`, height: `${HOUR_HEIGHT_PX}px` }}
                        onClick={() => handleCellClick(date, hour)}
                      ></div>
                    ))}

                    {/* Bandeaux d'événements avec lanes */}
                    {eventLanes.map(({ event, laneIndex }, idx) => {
                      const pos = getEventPosition(event.start_time, event.end_time);
                      const laneWidth = 100 / maxLanes;
                      const textSize = maxLanes >= 3 ? 'text-xs' : 'text-sm md:text-base';
                      
                      // Affichage participants
                      const participantsList = event.participants || [];
                      const displayParticipants = participantsList.length > 0 
                        ? participantsList.slice(0, 2).join(', ') + 
                          (participantsList.length > 2 ? ` (+${participantsList.length - 2})` : '')
                        : event.participant || event.student_name || event.center;
                      
                      return (
                        <div
                          key={event.groupKey || event.id || idx}
                          className={`absolute rounded-md ${textSize} font-medium leading-tight shadow-sm overflow-hidden px-2 py-1 md:px-3 md:py-2 group`}
                          style={{
                            top: pos.top,
                            height: pos.height,
                            left: `calc(${laneIndex * laneWidth}% + 3px)`,
                            width: `calc(${laneWidth}% - 6px)`,
                            minHeight: '40px',
                            backgroundColor: event.color || '#3B82F6',
                            color: 'white',
                            position: 'absolute'
                          }}
                          title={`${event.title || event.subject}\n${displayParticipants}\n${event.start_time}-${event.end_time}${participantsList.length > 0 ? '\n\nParticipants: ' + participantsList.join(', ') : ''}`}
                        >
                          {/* Menu contextuel */}
                          <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded bg-black/30 hover:bg-black/50 text-white"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.origin === 'local') {
                                      setCurrentEvent(event);
                                      setModalData({
                                        date: event.date,
                                        start_time: event.start_time,
                                        end_time: event.end_time,
                                        center: event.center || event.organism,
                                        subject: event.subject || '',
                                        title: event.title,
                                        modality: event.modality || 'distanciel',
                                        color: event.color || '#3B82F6'
                                      });
                                      setShowModal(true);
                                    } else {
                                      toast.error('Les séances Emergent ne peuvent pas être modifiées ici');
                                    }
                                  }}
                                  className="text-blue-600"
                                >
                                  <Edit size={14} className="mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => handleDuplicateClick(event, e)}>
                                  <Copy size={14} className="mr-2" />
                                  Dupliquer
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => handleDeleteClick(event, e)}
                                  className="text-red-600"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Icône verrou pour Emergent */}
                          {event.origin === 'emergent' && (
                            <div className="absolute top-1.5 left-1.5 z-10" title="Séance Emergent">
                              <Lock size={12} className="text-white/70" />
                            </div>
                          )}

                          {/* Icône participants multiples */}
                          {participantsList.length > 1 && (
                            <div className="absolute top-1.5 left-7 z-10" title={`${participantsList.length} participants`}>
                              <Users size={12} className="text-white/70" />
                            </div>
                          )}

                          {/* Contenu */}
                          <div className="font-semibold truncate overflow-hidden text-ellipsis whitespace-nowrap">
                            {event.title || event.subject}
                          </div>
                          <div className="text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap">
                            {displayParticipants}
                          </div>
                          <div className="text-xs">
                            {event.start_time}–{event.end_time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal création événement */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un bloc planning</DialogTitle>
            <DialogDescription>Cet événement est visible uniquement dans le planning</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Intitulé / Formation *</Label>
              <Input 
                value={modalData.title} 
                onChange={(e) => setModalData({...modalData, title: e.target.value})} 
                placeholder="Anglais professionnel, Bureautique Excel..."
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={modalData.date} onChange={(e) => setModalData({...modalData, date: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Heure début</Label>
                <Input type="time" value={modalData.start_time} onChange={(e) => setModalData({...modalData, start_time: e.target.value})} />
              </div>
              <div>
                <Label>Heure fin</Label>
                <Input type="time" value={modalData.end_time} onChange={(e) => setModalData({...modalData, end_time: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Organisme / Centre *</Label>
              <Input 
                value={modalData.center} 
                onChange={(e) => setModalData({...modalData, center: e.target.value})} 
                placeholder="Ex: Zepartner"
              />
            </div>
            <div>
              <Label>Matière</Label>
              <Input 
                value={modalData.subject} 
                onChange={(e) => setModalData({...modalData, subject: e.target.value})} 
                placeholder="Ex: Anglais, Bureautique..."
              />
            </div>
            <div>
              <Label>Type</Label>
              <select 
                value={modalData.modality} 
                onChange={(e) => setModalData({...modalData, modality: e.target.value})}
                className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="distanciel">Distanciel</option>
                <option value="presentiel">Présentiel</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleSaveEvent} style={{backgroundColor: '#0D2040'}}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal sélection couleur */}
      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir une couleur pour {selectedCenter}</DialogTitle>
            <DialogDescription>Cette couleur sera réutilisée pour tous les événements de ce centre</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-5 gap-3">
              {PREDEFINED_COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => handleColorSelect(color.value)}
                  className="w-12 h-12 rounded-md cursor-pointer ring-1 ring-gray-300 hover:ring-2 hover:ring-black/50 transition-all"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                ></button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal confirmation suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette séance ?</DialogTitle>
            <DialogDescription>
              {eventToDelete && (
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Intitulé :</strong> {eventToDelete.title || eventToDelete.subject}</p>
                  <p><strong>Date :</strong> {eventToDelete.date}</p>
                  <p><strong>Créneau :</strong> {eventToDelete.start_time} - {eventToDelete.end_time}</p>
                  <p><strong>Centre :</strong> {eventToDelete.center || eventToDelete.organism || '-'}</p>
                  {eventToDelete.participants && eventToDelete.participants.length > 0 && (
                    <p><strong>Participants :</strong> {eventToDelete.participants.join(', ')}</p>
                  )}
                  {eventToDelete.origin === 'emergent' && (
                    <p className="text-orange-600 font-medium mt-2">⚠️ Attention : Cette séance Emergent sera supprimée définitivement !</p>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button onClick={handleConfirmDelete} style={{backgroundColor: '#dc2626'}}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal duplication */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dupliquer la séance</DialogTitle>
            <DialogDescription>
              Choisissez la nouvelle date et horaire pour la copie
            </DialogDescription>
          </DialogHeader>
          {eventToDuplicate && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                <p className="text-sm font-medium text-blue-900">{eventToDuplicate.title || eventToDuplicate.subject}</p>
                <p className="text-xs text-blue-700 mt-1">
                  Centre : {eventToDuplicate.center || eventToDuplicate.organism || '-'}
                </p>
              </div>
              
              <div>
                <Label>Nouvelle date</Label>
                <Input 
                  type="date" 
                  value={duplicateData.date} 
                  onChange={(e) => setDuplicateData({...duplicateData, date: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Heure début</Label>
                  <Input 
                    type="time" 
                    value={duplicateData.start_time} 
                    onChange={(e) => setDuplicateData({...duplicateData, start_time: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Heure fin</Label>
                  <Input 
                    type="time" 
                    value={duplicateData.end_time} 
                    onChange={(e) => setDuplicateData({...duplicateData, end_time: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>Annuler</Button>
            <Button onClick={handleConfirmDuplicate} className="bg-blue-600 hover:bg-blue-700">
              <Copy size={16} className="mr-2" />
              Créer la séance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
