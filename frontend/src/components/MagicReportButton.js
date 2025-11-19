import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2, Download } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export default function MagicReportButton({ studentId, studentName }) {
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    
    try {
      const response = await axios.get(
        `${API}/api/students/${studentId}/magic-report`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob' // Important pour recevoir le PDF
        }
      );
      
      // Créer un lien de téléchargement
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-evolution-${studentName || 'eleve'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Rapport généré et téléchargé!');
    } catch (error) {
      console.error('Erreur génération rapport:', error);
      if (error.response?.status === 400) {
        toast.error('Les 3 tests doivent être complétés pour générer le rapport');
      } else {
        toast.error('Erreur lors de la génération du rapport');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <Button
        onClick={generateReport}
        disabled={loading}
        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Génération du rapport…
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5" />
            📊 Générer le rapport d'évolution
          </>
        )}
      </Button>
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        Rapport PDF avec analyse des 3 tests (T1, T2, T3)
      </p>
    </div>
  );
}
