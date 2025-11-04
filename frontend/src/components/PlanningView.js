import { useState } from 'react';
import { Calendar } from 'lucide-react';

const MONTHS = [
  { name: 'Octobre 2025', value: '2025-10', days: 31, startDay: 3 }, // 1er oct = mercredi
  { name: 'Novembre 2025', value: '2025-11', days: 30, startDay: 6 }, // 1er nov = samedi
  { name: 'Décembre 2025', value: '2025-12', days: 31, startDay: 1 }, // 1er déc = lundi
];

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8h à 21h

export default function PlanningView({ sessions }) {
  const [activeMonth, setActiveMonth] = useState(MONTHS[1].value); // Novembre par défaut

  const currentMonth = MONTHS.find(m => m.value === activeMonth);

  // Générer les jours du mois avec leur jour de semaine
  const generateMonthDays = () => {
    const days = [];
    const [year, month] = activeMonth.split('-');
    
    for (let day = 1; day <= currentMonth.days; day++) {
      const date = new Date(year, parseInt(month) - 1, day);
      const dayOfWeek = (date.getDay() + 6) % 7; // 0 = Lun, 6 = Dim
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

  // Filtrer les sessions du mois actif
  const monthSessions = sessions.filter(session => {
    return session.date && session.date.startsWith(activeMonth);
  });

  // Grouper les sessions par date
  const sessionsByDate = {};
  monthSessions.forEach(session => {
    if (!sessionsByDate[session.date]) {
      sessionsByDate[session.date] = [];
    }
    sessionsByDate[session.date].push(session);
  });

  // Calculer la position et hauteur d'une session
  const getSessionPosition = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = (startHour - 8) * 60 + startMin;
    const endMinutes = (endHour - 8) * 60 + endMin;
    const totalMinutes = 13 * 60; // 8h à 21h = 13h
    
    const top = (startMinutes / totalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / totalMinutes) * 100;
    
    return { top: `${top}%`, height: `${height}%` };
  };

  // Détecter les chevauchements et calculer les offsets
  const calculateOverlaps = (dateSessions) => {
    const sorted = [...dateSessions].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const positions = [];
    
    sorted.forEach((session, index) => {
      let offset = 0;
      const [startHour, startMin] = session.start_time.split(':').map(Number);
      const [endHour, endMin] = session.end_time.split(':').map(Number);
      const start = startHour * 60 + startMin;
      const end = endHour * 60 + endMin;
      
      // Vérifier les chevauchements avec les sessions précédentes
      for (let i = 0; i < index; i++) {
        const prev = sorted[i];
        const [prevStartH, prevStartM] = prev.start_time.split(':').map(Number);
        const [prevEndH, prevEndM] = prev.end_time.split(':').map(Number);
        const prevStart = prevStartH * 60 + prevStartM;
        const prevEnd = prevEndH * 60 + prevEndM;
        
        // Chevauchement si start < prevEnd et end > prevStart
        if (start < prevEnd && end > prevStart) {
          offset = positions[i].offset + 1;
        }
      }
      
      positions.push({ session, offset, width: 100 / (offset + 1) });
    });
    
    return positions;
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
                ? 'bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {month.name}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Séance réservée</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded"></div>
          <span>Libre</span>
        </div>
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
                  className="border-b text-xs text-gray-600 flex items-start justify-center pt-1"
                  style={{ height: '60px' }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Colonnes des jours */}
            {monthDays.map(({ day, date, dayName }) => {
              const daySessions = sessionsByDate[date] || [];
              const sessionsWithPositions = calculateOverlaps(daySessions);
              
              return (
                <div key={date} className="border-r" style={{ minWidth: '120px', width: '120px' }}>
                  {/* En-tête jour */}
                  <div className="h-12 border-b bg-gray-100 flex flex-col items-center justify-center text-xs font-semibold">
                    <span className="text-gray-500">{dayName}</span>
                    <span className="text-gray-800">{String(day).padStart(2, '0')}/{activeMonth.split('-')[1]}</span>
                  </div>

                  {/* Grille horaire */}
                  <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                    {/* Lignes horaires */}
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className="absolute w-full border-b bg-green-50"
                        style={{ top: `${((hour - 8) * 60)}px`, height: '60px' }}
                      ></div>
                    ))}

                    {/* Bandeaux de séances */}
                    {sessionsWithPositions.map(({ session, offset, width }, idx) => {
                      const pos = getSessionPosition(session.start_time, session.end_time);
                      return (
                        <div
                          key={session.id || idx}
                          className="absolute rounded-md text-xs px-2 py-1 shadow-sm overflow-hidden bg-blue-500 text-white"
                          style={{
                            top: pos.top,
                            height: pos.height,
                            left: `${offset * (100 / (sessionsWithPositions.length + 1))}%`,
                            width: `${width}%`,
                            minHeight: '30px'
                          }}
                          title={`${session.subject} - ${session.student_name} (${session.start_time}-${session.end_time})`}
                        >
                          <div className="font-semibold truncate">{session.subject}</div>
                          <div className="truncate text-[10px]">{session.student_name}</div>
                          <div className="text-[10px]">{session.start_time}–{session.end_time}</div>
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
    </div>
  );
}
