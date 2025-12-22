import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function EndCourseQuestionnaire({ open, onClose, studentId }) {
  const [formData, setFormData] = useState({
    // ===== BLOCK A : Bilan pédagogique de fin de formation =====
    nom_prenom: '',
    date: '',
    formateur_referent: '',
    duree_totale: '',
    mode_formation: [],
    // Évaluation des acquis
    progression: '',
    domaines_amelioration: [],
    aise_professionnel: '',
    points_renforcer: '',
    objectifs_atteints: '',
    
    // ===== BLOCK B : Appréciation & satisfaction =====
    contenu_adapte: '',
    rythme_duree: '',
    formateur_satisfaisant: '',
    evaluation_globale: '', // 4, 3, 2, 1 étoiles
    recommandation: '',
    utilisation_competences: '',
    formation_complementaire: '',
    avis_formation: ''
  });

  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCheckbox = (field, value) => {
    setFormData(prev => {
      const current = prev[field] || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
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
        `${API}/students/${studentId}/end-course-questionnaire`,
        {
          ...formData,
          // Convertir evaluation_globale en nombre pour le stockage
          overallRating: parseInt(formData.evaluation_globale) || null,
          signature,
          submitted_at: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      toast.success("Questionnaire de fin de formation soumis avec succès !");
      onClose();
    } catch (error) {
      console.error("Error submitting end-course questionnaire:", error);
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
    { value: '4', label: '⭐⭐⭐⭐ Excellent', stars: 4 },
    { value: '3', label: '⭐⭐⭐ Bon', stars: 3 },
    { value: '2', label: '⭐⭐ Moyen', stars: 2 },
    { value: '1', label: '⭐ Insatisfaisant', stars: 1 }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1E3A5F]">
            Q3 – Questionnaire de fin de formation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* ============================================================
              BLOCK A : Bilan pédagogique de fin de formation
          ============================================================ */}
          <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h2 className="text-xl font-bold text-blue-800 mb-4">📘 BLOC A — Bilan pédagogique de fin de formation</h2>
            
            {/* 1. INFORMATIONS GÉNÉRALES */}
            <div className="space-y-4 p-4 bg-white rounded-lg mb-4">
              <h3 className="text-lg font-bold text-gray-900">📋 1. Informations générales</h3>
              
              <div className="space-y-2">
                <Label>Nom et prénom</Label>
                <Input
                  value={formData.nom_prenom}
                  onChange={(e) => updateField('nom_prenom', e.target.value)}
                  placeholder="Votre nom et prénom"
                />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Formateur référent</Label>
                <Input
                  value={formData.formateur_referent}
                  onChange={(e) => updateField('formateur_referent', e.target.value)}
                  placeholder="Nom du formateur"
                />
              </div>

              <div className="space-y-2">
                <Label>Durée totale suivie</Label>
                <Input
                  value={formData.duree_totale}
                  onChange={(e) => updateField('duree_totale', e.target.value)}
                  placeholder="Ex: 30 heures"
                />
              </div>

              <div className="space-y-2">
                <Label>Mode de formation</Label>
                <div className="space-y-2">
                  {['Présentiel', 'Distanciel', 'Hybride'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.mode_formation.includes(option)}
                        onChange={() => toggleCheckbox('mode_formation', option)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. ÉVALUATION DES ACQUIS */}
            <div className="space-y-4 p-4 bg-white rounded-lg">
              <h3 className="text-lg font-bold text-gray-900">🎯 2. Évaluation de vos acquis</h3>
              
              <div className="space-y-2">
                <Label>Pensez-vous avoir progressé depuis le début de la formation ? *</Label>
                <div className="space-y-2">
                  {['Oui, beaucoup', 'Oui, un peu', 'Peu', 'Pas du tout'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="progression"
                        value={option}
                        checked={formData.progression === option}
                        onChange={(e) => updateField('progression', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dans quels domaines avez-vous constaté le plus d'amélioration ? *</Label>
                <div className="space-y-2">
                  {['Compréhension orale', 'Expression orale', 'Compréhension écrite', 'Expression écrite'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.domaines_amelioration.includes(option)}
                        onChange={() => toggleCheckbox('domaines_amelioration', option)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vous sentez-vous plus à l'aise pour utiliser l'anglais dans votre environnement professionnel ? *</Label>
                <div className="space-y-2">
                  {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aise_professionnel"
                        value={option}
                        checked={formData.aise_professionnel === option}
                        onChange={(e) => updateField('aise_professionnel', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quels points souhaitez-vous encore renforcer ?</Label>
                <textarea
                  value={formData.points_renforcer}
                  onChange={(e) => updateField('points_renforcer', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Votre réponse..."
                />
              </div>

              <div className="space-y-2">
                <Label>Avez-vous atteint les objectifs fixés en début de formation ? *</Label>
                <div className="space-y-2">
                  {['Oui totalement', 'Partiellement', 'Non encore', 'Non du tout'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="objectifs_atteints"
                        value={option}
                        checked={formData.objectifs_atteints === option}
                        onChange={(e) => updateField('objectifs_atteints', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================
              BLOCK B : Appréciation & satisfaction
          ============================================================ */}
          <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
            <h2 className="text-xl font-bold text-amber-800 mb-4">📝 BLOC B — Appréciation & satisfaction</h2>
            
            <div className="space-y-4 p-4 bg-white rounded-lg">
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

            {/* Avis libre */}
            <div className="space-y-4 p-4 bg-white rounded-lg mt-4">
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
          </div>

          {/* SIGNATURE ET SOUMISSION */}
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border-2 border-green-300">
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
              {submitting ? 'Soumission en cours...' : 'Soumettre le questionnaire de fin de formation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
