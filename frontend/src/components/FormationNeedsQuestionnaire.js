import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FormationNeedsQuestionnaire({ open, onClose, studentId }) {
  const [formData, setFormData] = useState({
    // 1. Identification
    situation_professionnelle: [],
    si_en_fonction: '',
    poste_occupe: '',
    anciennete: '',
    
    // 2. Motivation et objectifs
    formation_anglais_anterieure: '',
    formation_details: '',
    raison_formation: '',
    cadre_utilisation: [],
    cadre_autre: '',
    objectifs_principaux: [],
    attentes_fin_formation: '',
    
    // 3. Niveau et compétences (auto-évaluation)
    comprehension_orale: '',
    expression_orale: '',
    comprehension_ecrite: '',
    expression_ecrite: '',
    
    // 4. Besoins professionnels
    situations_anglais_necessaire: '',
    difficultes: [],
    difficultes_autre: '',
    contenu_particulier: '',
    certification_souhaitee: '',
    certification_laquelle: '',
    
    // 5. Contraintes et conditions
    rythme_souhaite: [],
    format_prefere: [],
    contraintes_particulieres: '',
    
    // 6. Situation de handicap
    situation_handicap: '',
    accompagnement_specifique: '',
    materiel_particulier: [],
    materiel_autre: '',
    amenagement_rythme: [],
    amenagement_autre: ''
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
        `${API}/students/${studentId}/formation-needs`,
        {
          ...formData,
          signature,
          submitted_at: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      toast.success("Questionnaire soumis avec succès !");
      onClose();
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#8B5A2B]">
            Mes besoins en formation - Questionnaire
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. IDENTIFICATION */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">1. Identification</h3>
            
            <div className="space-y-2">
              <Label>Situation professionnelle *</Label>
              <div className="space-y-2">
                {['En fonction', 'En recherche d\'emploi', 'En reconversion'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.situation_professionnelle.includes(option)}
                      onChange={() => toggleCheckbox('situation_professionnelle', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.situation_professionnelle.includes('En fonction') && (
              <div className="space-y-2">
                <Label>Si en fonction, précisez :</Label>
                <Input
                  value={formData.si_en_fonction}
                  onChange={(e) => updateField('si_en_fonction', e.target.value)}
                  placeholder="Détails..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poste occupé</Label>
                <Input
                  value={formData.poste_occupe}
                  onChange={(e) => updateField('poste_occupe', e.target.value)}
                  placeholder="Votre poste"
                />
              </div>
              <div className="space-y-2">
                <Label>Ancienneté dans le poste</Label>
                <Input
                  value={formData.anciennete}
                  onChange={(e) => updateField('anciennete', e.target.value)}
                  placeholder="Ex: 2 ans"
                />
              </div>
            </div>
          </div>

          {/* 2. MOTIVATION ET OBJECTIFS */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">2. Motivation et objectifs</h3>
            
            <div className="space-y-2">
              <Label>Avez-vous déjà suivi une formation d'anglais ? *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="formation_anterieure"
                    value="Oui"
                    checked={formData.formation_anglais_anterieure === 'Oui'}
                    onChange={(e) => updateField('formation_anglais_anterieure', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Oui</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="formation_anterieure"
                    value="Non"
                    checked={formData.formation_anglais_anterieure === 'Non'}
                    onChange={(e) => updateField('formation_anglais_anterieure', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Non</span>
                </label>
              </div>
              {formData.formation_anglais_anterieure === 'Oui' && (
                <Input
                  value={formData.formation_details}
                  onChange={(e) => updateField('formation_details', e.target.value)}
                  placeholder="Si oui, laquelle et quand ?"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Pourquoi souhaitez-vous suivre cette formation ? *</Label>
              <textarea
                value={formData.raison_formation}
                onChange={(e) => updateField('raison_formation', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Dans quel cadre utiliserez-vous l'anglais ? *</Label>
              <div className="space-y-2">
                {['Travail quotidien', 'Communication client', 'Réunions', 'Voyages'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.cadre_utilisation.includes(option)}
                      onChange={() => toggleCheckbox('cadre_utilisation', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" disabled />
                  <Input
                    value={formData.cadre_autre}
                    onChange={(e) => updateField('cadre_autre', e.target.value)}
                    placeholder="Autre (précisez)"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quels sont vos objectifs principaux ? *</Label>
              <div className="space-y-2">
                {[
                  'Gagner en aisance à l\'oral',
                  'Améliorer la compréhension',
                  'Rédiger des e-mails',
                  'Préparer un examen (TOEIC, Bright, etc.)'
                ].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.objectifs_principaux.includes(option)}
                      onChange={() => toggleCheckbox('objectifs_principaux', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Qu'attendez-vous concrètement à la fin de la formation ? *</Label>
              <textarea
                value={formData.attentes_fin_formation}
                onChange={(e) => updateField('attentes_fin_formation', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
                required
              />
            </div>
          </div>

          {/* 3. NIVEAU ET COMPÉTENCES */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">3. Niveau et compétences linguistiques (auto-évaluation)</h3>
            
            <div className="grid grid-cols-4 gap-2">
              <div className="font-bold">Compétence</div>
              <div className="font-bold text-center">Faible</div>
              <div className="font-bold text-center">Moyen</div>
              <div className="font-bold text-center">Bon</div>
            </div>

            {[
              { key: 'comprehension_orale', label: 'Compréhension orale' },
              { key: 'expression_orale', label: 'Expression orale' },
              { key: 'comprehension_ecrite', label: 'Compréhension écrite' },
              { key: 'expression_ecrite', label: 'Expression écrite' }
            ].map(({ key, label }) => (
              <div key={key} className="grid grid-cols-4 gap-2 items-center">
                <div>{label}</div>
                {['Faible', 'Moyen', 'Bon'].map(level => (
                  <div key={level} className="flex justify-center">
                    <input
                      type="radio"
                      name={key}
                      value={level}
                      checked={formData[key] === level}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="w-4 h-4"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Suite des sections... (je vais les ajouter dans la prochaine itération pour ne pas dépasser la limite) */}

          {/* SIGNATURE ET SOUMISSION */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <h3 className="text-lg font-bold text-gray-900">7. Validation</h3>
            
            <div className="space-y-2">
              <Label>Signature * (horodatée)</Label>
              <SignaturePad onSave={setSignature} />
            </div>

            <p className="text-sm text-gray-600 italic">
              Je certifie l'exactitude des données et transmets mes informations à TerciForm
            </p>

            <Button
              type="submit"
              disabled={submitting || !signature}
              className="w-full py-6 text-lg font-bold bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
            >
              {submitting ? 'Soumission en cours...' : 'Soumettre mon questionnaire'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
