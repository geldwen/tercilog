import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getPlanningEvents, savePlanningEvent, deletePlanningEvent, getCenterColors, setCenterColor, getCenterColor, PREDEFINED_COLORS } from '@/utils/planningStore';

const MONTHS = [
  { name: 'Octobre 2025', value: '2025-10', days: 31, startDay: 3 },
  { name: 'Novembre 2025', value: '2025-11', days: 30, startDay: 6 },
  { name: 'Décembre 2025', value: '2025-12', days: 31, startDay: 1 },
];

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

export default function PlanningView({ sessions }) {
  const [activeMonth, setActiveMonth] = useState(MONTHS[1].value);
  const [planningEvents, setPlanningEvents] = useState([]);
  const [centerColors, setCenterColorsState] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [modalData, setModalData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    center: '',
    subject: '',
    modality: 'distanciel',
    color: '#3B82F6'
  });
  const [selectedCenter, setSelectedCenter] = useState('');

  useEffect(() => {
    setPlanningEvents(getPlanningEvents());
    setCenterColorsState(getCenterColors());
  }, []);

  const currentMonth = MONTHS.find(m => m.value === activeMonth);

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
      type: 'session',
      center: s.organism || 'Séance',
      color: getCenterColor(s.organism || '')
    })),
    ...planningEvents.filter(e => e.date && e.date.startsWith(activeMonth)).map(e => ({
      ...e,
      type: 'planning',
      student_name: e.center
    }))
  ];

  // Grouper par date et dédupliquer
  const eventsByDate = {};
  const seen = new Set();
  
  allEvents.forEach(event => {
    const key = `${event.id}_${event.date}_${event.start_time}`;
    if (seen.has(key)) return;
    seen.add(key);
    
    if (!eventsByDate[event.date]) {
      eventsByDate[event.date] = [];
    }
    eventsByDate[event.date].push(event);
  });

  // Calculer position exacte (alignement parfait)
  const getEventPosition = (startTime, endTime) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    // Minutes depuis 8h
    const startMinutes = Math.max(0, (startH - 8) * 60 + startM);
    const endMinutes = Math.min(13 * 60, (endH - 8) * 60 + endM); // Max 21h
    
    const totalMinutes = 13 * 60; // 8h-21h
    
    const top = (startMinutes / totalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / totalMinutes) * 100;
    
    return { top: `${top}%`, height: `${Math.max(height, 5)}%` };
  };

  // Gérer les chevauchements
  const calculateOverlaps = (dateEvents) => {
    const sorted = [...dateEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const positions = [];
    
    sorted.forEach((event, index) => {
      let offset = 0;
      const [startH, startM] = event.start_time.split(':').map(Number);
      const [endH, endM] = event.end_time.split(':').map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      
      for (let i = 0; i < index; i++) {
        const prev = sorted[i];
        const [prevStartH, prevStartM] = prev.start_time.split(':').map(Number);
        const [prevEndH, prevEndM] = prev.end_time.split(':').map(Number);
        const prevStart = prevStartH * 60 + prevStartM;
        const prevEnd = prevEndH * 60 + prevEndM;
        
        if (start < prevEnd && end > prevStart) {
          offset = Math.max(offset, positions[i].offset + 1);
        }
      }
      
      positions.push({ event, offset });
    });
    
    return positions;
  };

  // Ouvrir modal de création
  const handleCellClick = (date, hour) => {
    setModalData({
      date,
      start_time: `${String(hour).padStart(2, '0')}:00`,
      end_time: `${String(hour + 1).padStart(2, '0')}:00`,
      center: '',
      subject: '',
      modality: 'distanciel',
      color: '#3B82F6'
    });
    setShowModal(true);
  };

  // Sauvegarder événement
  const handleSaveEvent = () => {
    if (!modalData.center || !modalData.subject) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    // Vérifier si le centre a une couleur
    if (!centerColors[modalData.center]) {
      setSelectedCenter(modalData.center);
      setShowColorPicker(true);
      return;
    }

    const event = {
      ...modalData,
      color: getCenterColor(modalData.center)
    };
    
    savePlanningEvent(event);
    setPlanningEvents(getPlanningEvents());
    setShowModal(false);
    toast.success('Bloc planning créé !');
  };

  // Choisir couleur pour un centre
  const handleColorSelect = (color) => {
    setCenterColor(selectedCenter, color);
    setCenterColorsState(getCenterColors());
    
    const event = {
      ...modalData,
      color
    };
    
    savePlanningEvent(event);
    setPlanningEvents(getPlanningEvents());
    setShowColorPicker(false);
    setShowModal(false);
    toast.success('Bloc planning créé avec couleur !');
  };

  // Obtenir liste unique des centres
  const uniqueCenters = [...new Set([
    ...sessions.map(s => s.organism).filter(Boolean),
    ...planningEvents.map(e => e.center).filter(Boolean)
  ])];

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
          <span>Séance Emergent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
          <span>Libre</span>
        </div>
        {uniqueCenters.map(center => (
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
                  style={{ height: '60px' }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Colonnes des jours */}
            {monthDays.map(({ day, date, dayName }) => {
              const dayEvents = eventsByDate[date] || [];
              const eventsWithPositions = calculateOverlaps(dayEvents);
              const maxOffset = Math.max(0, ...eventsWithPositions.map(e => e.offset));
              
              return (
                <div key={date} className="border-r" style={{ minWidth: '140px', width: '140px' }}>
                  {/* En-tête jour */}
                  <div className="h-12 border-b bg-gray-100 flex flex-col items-center justify-center text-xs font-semibold">
                    <span className="text-gray-500">{dayName}</span>
                    <span className="text-gray-800">{String(day).padStart(2, '0')}/{activeMonth.split('-')[1]}</span>
                  </div>

                  {/* Grille horaire */}
                  <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                    {/* Lignes horaires cliquables */}
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className="absolute w-full border-b bg-green-50 hover:bg-green-100 cursor-pointer transition-colors"
                        style={{ top: `${(hour - 8) * 60}px`, height: '60px' }}
                        onClick={() => handleCellClick(date, hour)}
                      ></div>
                    ))}

                    {/* Bandeaux d'événements */}
                    {eventsWithPositions.map(({ event, offset }, idx) => {
                      const pos = getEventPosition(event.start_time, event.end_time);
                      const width = maxOffset > 0 ? 100 / (maxOffset + 1) : 100;
                      
                      return (
                        <div
                          key={event.id || idx}
                          className="absolute rounded-md text-sm md:text-base font-medium leading-tight shadow-sm overflow-hidden px-2 py-1 md:px-3 md:py-2"
                          style={{
                            top: pos.top,
                            height: pos.height,
                            left: `${offset * width}%`,
                            width: `${width}%`,
                            minHeight: '40px',
                            backgroundColor: event.color || '#3B82F6',
                            color: 'white'
                          }}
                          title={`${event.subject || event.subject} - ${event.student_name || event.center} (${event.start_time}-${event.end_time})`}
                        >
                          <div className="font-semibold truncate overflow-hidden text-ellipsis whitespace-nowrap">
                            {event.subject}
                          </div>
                          <div className="text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap">
                            {event.student_name || event.center}
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
              <Label>Organisme / Centre</Label>
              <Input 
                value={modalData.center} 
                onChange={(e) => setModalData({...modalData, center: e.target.value})} 
                placeholder="Ex: Zepartner"
              />
            </div>
            <div>
              <Label>Matière / Intitulé</Label>
              <Input 
                value={modalData.subject} 
                onChange={(e) => setModalData({...modalData, subject: e.target.value})} 
                placeholder="Ex: Anglais professionnel"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={modalData.modality} onValueChange={(val) => setModalData({...modalData, modality: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distanciel">Distanciel</SelectItem>
                  <SelectItem value="presentiel">Présentiel</SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  );
}
