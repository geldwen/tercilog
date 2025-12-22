import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SatisfactionQuestionnaire({ open, onClose, studentId }) {
  const [formData, setFormData] = useState({
    // 3. Appréciation de la formation
    contenu_adapte: '',
    rythme_duree: '',
    formateur_satisfaisant: '',
    evaluation_globale: '',
    recommandation: '',
    
    // 4. Perspectives
    utilisation_competences: '',
    formation_complementaire: '',
    
    // Avis libre
    avis_formation: ''
  });

  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!signature) {
      toast.error("Veuillez signer le questionnaire");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/students/${studentId}/satisfaction-questionnaire`,
        {
          ...formData,
          signature,
          submitted_at: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      toast.success("Questionnaire de satisfaction soumis avec succès !");
      onClose();
    } catch (error) {
      console.error("Error submitting satisfaction questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  // Horodatage actuel
  const currentTimestamp = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Options d'évaluation avec étoiles
  const evaluationOptions = [
    { value: 'Excellent', label: '⭐⭐⭐⭐ Excellent', stars: 4 },
    { value: 'Bon', label: '⭐⭐⭐ Bon', stars: 3 },
    { value: 'Moyen', label: '⭐⭐ Moyen', stars: 2 },
    { value: 'Insatisfaisant', label: '⭐ Insatisfaisant', stars: 1 }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1E3A5F]">
            Q4 – Questionnaire de satisfaction de formation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 3. APPRÉCIATION DE LA FORMATION */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">💬 3. Appréciation de la formation</h3>
            
            <div className="space-y-2">
              <Label>Le contenu et les supports ont-ils été adaptés à vos besoins ? *</Label>
              <div className="space-y-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="contenu_adapte"
                      value={option}
                      checked={formData.contenu_adapte === option}
                      onChange={(e) => updateField('contenu_adapte', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Le rythme et la durée de la formation vous ont-ils convenu ? *</Label>
              <div className="space-y-2">
                {['Oui tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rythme_duree"
                      value={option}
                      checked={formData.rythme_duree === option}
                      onChange={(e) => updateField('rythme_duree', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Le formateur a-t-il répondu à vos attentes (écoute, pédagogie, disponibilité) ? *</Label>
              <div className="space-y-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formateur_satisfaisant"
                      value={option}
                      checked={formData.formateur_satisfaisant === option}
                      onChange={(e) => updateField('formateur_satisfaisant', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comment évalueriez-vous globalement la formation ? *</Label>
              <div className="space-y-2">
                {evaluationOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
                    <input
                      type="radio"
                      name="evaluation_globale"
                      value={option.value}
                      checked={formData.evaluation_globale === option.value}
                      onChange={(e) => updateField('evaluation_globale', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-lg">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recommanderiez-vous cette formation à d'autres personnes ? *</Label>
              <div className="flex gap-4">
                {['Oui', 'Non', 'Peut-être'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="recommandation"
                      value={option}
                      checked={formData.recommandation === option}
                      onChange={(e) => updateField('recommandation', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 4. PERSPECTIVES */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">🧩 4. Perspectives et suite du parcours</h3>
            
            <div className="space-y-2">
              <Label>Comment comptez-vous utiliser vos nouvelles compétences ?</Label>
              <textarea
                value={formData.utilisation_competences}
                onChange={(e) => updateField('utilisation_competences', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>

            <div className="space-y-2">
              <Label>Souhaitez-vous poursuivre avec une formation complémentaire ?</Label>
              <div className="flex gap-4">
                {['Oui', 'Non'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formation_complementaire"
                      value={option}
                      checked={formData.formation_complementaire === option}
                      onChange={(e) => updateField('formation_complementaire', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* AVIS LIBRE */}
          <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
            <h3 className="text-lg font-bold text-gray-900">💭 Laissez votre avis sur la formation</h3>
            
            <div className="space-y-2">
              <Label>Votre avis (commentaires, suggestions, remarques...)</Label>
              <textarea
                value={formData.avis_formation}
                onChange={(e) => updateField('avis_formation', e.target.value)}
                rows={5}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Partagez librement votre ressenti sur la formation, ce qui vous a plu, ce qui pourrait être amélioré..."
              />
            </div>
          </div>

          {/* SIGNATURE ET SOUMISSION */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <h3 className="text-lg font-bold text-gray-900">✍️ Validation</h3>
            
            <div className="text-sm text-gray-600 bg-white p-3 rounded border">
              <strong>Horodatage :</strong> {currentTimestamp}
            </div>
            
            <div className="space-y-2">
              <Label>Signature du stagiaire * (horodatée)</Label>
              <SignaturePad onSave={setSignature} />
            </div>

            <Button
              type="submit"
              disabled={submitting || !signature}
              className="w-full py-6 text-lg font-bold bg-[#1E3A5F] hover:bg-[#152d4a] text-white"
            >
              {submitting ? 'Soumission en cours...' : 'Soumettre le questionnaire de satisfaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
