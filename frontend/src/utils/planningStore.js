// Store pour les événements planning et les couleurs des centres
// Version avec sauvegarde dans MongoDB via API backend

import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STORAGE_KEYS = {
  CENTER_COLORS: 'terciform_center_colors',
  PLANNING_EVENTS: 'terciform_planning_events' // Gardé pour migration
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

// Fonction pour obtenir les headers d'authentification
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
};

// ========== ÉVÉNEMENTS PLANNING (MongoDB via API) ==========

// Récupérer tous les événements de planning depuis l'API
export const getPlanningEvents = async () => {
  try {
    const response = await axios.get(`${API}/planning/events`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error loading planning events from API:', error);
    // Fallback: essayer de charger depuis localStorage pour migration
    try {
      const localData = localStorage.getItem(STORAGE_KEYS.PLANNING_EVENTS);
      if (localData) {
        const events = JSON.parse(localData);
        console.log('Found events in localStorage, will migrate to MongoDB');
        return events;
      }
    } catch (localError) {
      console.error('Error loading from localStorage:', localError);
    }
    return [];
  }
};

// Sauvegarder un événement de planning (créer ou mettre à jour)
export const savePlanningEvent = async (event) => {
  try {
    if (event.id && !event.id.startsWith('planning_')) {
      // Événement existant (avec ID MongoDB) - mise à jour
      const response = await axios.put(
        `${API}/planning/events/${event.id}`,
        {
          title: event.title,
          date: event.date,
          start_time: event.start_time,
          end_time: event.end_time,
          organism: event.organism || ''
        },
        { headers: getAuthHeaders() }
      );
      return response.data;
    } else {
      // Nouvel événement - création
      const response = await axios.post(
        `${API}/planning/events`,
        {
          title: event.title,
          date: event.date,
          start_time: event.start_time,
          end_time: event.end_time,
          organism: event.organism || ''
        },
        { headers: getAuthHeaders() }
      );
      return response.data;
    }
  } catch (error) {
    console.error('Error saving planning event:', error);
    throw error;
  }
};

// Supprimer un événement de planning
export const deletePlanningEvent = async (eventId) => {
  try {
    await axios.delete(`${API}/planning/events/${eventId}`, {
      headers: getAuthHeaders()
    });
  } catch (error) {
    console.error('Error deleting planning event:', error);
    throw error;
  }
};

// Fonction de migration des événements localStorage → MongoDB
export const migratePlanningEventsToMongoDB = async () => {
  try {
    const localData = localStorage.getItem(STORAGE_KEYS.PLANNING_EVENTS);
    if (!localData) {
      console.log('No events in localStorage to migrate');
      return { migrated: 0 };
    }

    const localEvents = JSON.parse(localData);
    if (localEvents.length === 0) {
      console.log('No events to migrate');
      return { migrated: 0 };
    }

    console.log(`Migrating ${localEvents.length} events from localStorage to MongoDB...`);
    
    let migrated = 0;
    for (const event of localEvents) {
      try {
        await savePlanningEvent(event);
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate event ${event.id}:`, error);
      }
    }

    // Une fois la migration réussie, effacer le localStorage
    if (migrated > 0) {
      localStorage.removeItem(STORAGE_KEYS.PLANNING_EVENTS);
      console.log(`Migration complete: ${migrated} events migrated and localStorage cleared`);
    }

    return { migrated };
  } catch (error) {
    console.error('Error during migration:', error);
    return { migrated: 0, error };
  }
};

// ========== COULEURS DES CENTRES (localStorage) ==========

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
  // Zepartner est toujours bleu (verrouillé) - insensible à la casse
  if (center && center.trim().toLowerCase() === 'zepartner') {
    return '#3B82F6';
  }
  
  const colors = getCenterColors();
  return colors[center] || '#3B82F6'; // Bleu par défaut
};
