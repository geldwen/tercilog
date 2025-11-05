// Store local pour les événements planning et les couleurs des centres
const STORAGE_KEYS = {
  PLANNING_EVENTS: 'terciform_planning_events',
  CENTER_COLORS: 'terciform_center_colors'
};

// Couleurs prédéfinies
export const PREDEFINED_COLORS = [
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Vert', value: '#22C55E' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Prune', value: '#A855F7' },
  { name: 'Violet foncé', value: '#7C3AED' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Jaune', value: '#EAB308' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Gris', value: '#6B7280' },
  { name: 'Marron', value: '#92400E' }
];

// Événements planning
export const getPlanningEvents = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PLANNING_EVENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading planning events:', error);
    return [];
  }
};

export const savePlanningEvent = (event) => {
  const events = getPlanningEvents();
  const newEvent = {
    ...event,
    id: event.id || `planning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  events.push(newEvent);
  localStorage.setItem(STORAGE_KEYS.PLANNING_EVENTS, JSON.stringify(events));
  return newEvent;
};

export const deletePlanningEvent = (eventId) => {
  const events = getPlanningEvents();
  const filtered = events.filter(e => e.id !== eventId);
  localStorage.setItem(STORAGE_KEYS.PLANNING_EVENTS, JSON.stringify(filtered));
};

// Couleurs des centres
export const getCenterColors = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CENTER_COLORS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading center colors:', error);
    return {};
  }
};

export const setCenterColor = (center, color) => {
  const colors = getCenterColors();
  colors[center] = color;
  localStorage.setItem(STORAGE_KEYS.CENTER_COLORS, JSON.stringify(colors));
};

export const getCenterColor = (center) => {
  // Zepartner est toujours bleu (verrouillé)
  if (center === 'Zepartner') {
    return '#3B82F6';
  }
  
  const colors = getCenterColors();
  return colors[center] || '#3B82F6'; // Bleu par défaut
};
