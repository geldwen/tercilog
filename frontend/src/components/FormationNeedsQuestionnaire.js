import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FormationNeedsQuestionnaire({ open, onClose, studentId, parcours = "Anglais" }) {
  // Déterminer si c'est un parcours Excel ou autre
  const isExcel = parcours === "Excel";
  const isInformatique = parcours === "Informatique";
  const isBureautique = parcours === "Bureautique";
  
  // Labels dynamiques selon le parcours
  const getParcoursLabel = () => {
    switch(parcours) {
      case "Excel": return "Excel";
      case "Informatique": return "l'informatique";
      case "Bureautique": return "la bureautique";
      case "Management": return "le management";
      default: return "l'anglais";
    }
  };

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
              <Label>Avez-vous déjà suivi une formation sur {getParcoursLabel()} ? *</Label>
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
              <Label>Dans quel cadre utiliserez-vous {getParcoursLabel()} ? *</Label>
              <div className="space-y-2">
                {isExcel || isBureautique || isInformatique ? (
                  // Options pour Excel/Bureautique/Informatique
                  ['Travail quotidien', 'Reporting et analyse', 'Gestion de données', 'Automatisation de tâches'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.cadre_utilisation.includes(option)}
                        onChange={() => toggleCheckbox('cadre_utilisation', option)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))
                ) : (
                  // Options pour Anglais/Management
                  ['Travail quotidien', 'Communication client', 'Réunions', 'Voyages'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.cadre_utilisation.includes(option)}
                        onChange={() => toggleCheckbox('cadre_utilisation', option)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))
                )}
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
                {isExcel || isBureautique ? (
                  // Objectifs Excel/Bureautique
                  [
                    'Maîtriser les formules de base',
                    'Créer des graphiques professionnels',
                    'Utiliser les tableaux croisés dynamiques',
                    'Automatiser des tâches (macros)'
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
                  ))
                ) : isInformatique ? (
                  // Objectifs Informatique
                  [
                    'Maîtriser les bases de l\'informatique',
                    'Naviguer efficacement sur Internet',
                    'Gérer mes fichiers et dossiers',
                    'Comprendre la sécurité informatique'
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
                  ))
                ) : (
                  // Objectifs Anglais/Management
                  [
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
                  ))
                )}
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
            <h3 className="text-lg font-bold text-gray-900">
              3. Niveau et compétences {isExcel || isBureautique || isInformatique ? 'techniques' : 'linguistiques'} (auto-évaluation)
            </h3>
            
            <div className="grid grid-cols-4 gap-2">
              <div className="font-bold">Compétence</div>
              <div className="font-bold text-center">Faible</div>
              <div className="font-bold text-center">Moyen</div>
              <div className="font-bold text-center">Bon</div>
            </div>

            {isExcel || isBureautique ? (
              // Compétences Excel/Bureautique
              [
                { key: 'comprehension_orale', label: 'Saisie et mise en forme' },
                { key: 'expression_orale', label: 'Formules et calculs' },
                { key: 'comprehension_ecrite', label: 'Graphiques' },
                { key: 'expression_ecrite', label: 'Analyse de données' }
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
              ))
            ) : (
              // Compétences linguistiques (Anglais)
              [
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
              ))
            )}
          </div>

          {/* 4. BESOINS PROFESSIONNELS */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">4. Besoins professionnels et attentes spécifiques</h3>
            
            <div className="space-y-2">
              <Label>Dans votre fonction actuelle, quelles sont les situations professionnelles où {getParcoursLabel()} est nécessaire ou pourrait le devenir ?</Label>
              <textarea
                value={formData.situations_anglais_necessaire}
                onChange={(e) => updateField('situations_anglais_necessaire', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>

            {/* Section difficultés - uniquement pour les parcours linguistiques (pas Excel/Bureautique/Informatique) */}
            {!isExcel && !isBureautique && !isInformatique && (
              <div className="space-y-2">
                <Label>Quelles difficultés rencontrez-vous actuellement ?</Label>
                <div className="space-y-2">
                  {[
                    'Manque de vocabulaire',
                    'Difficultés à comprendre',
                    'Blocage à l\'oral',
                    'Grammaire',
                    'Prononciation'
                  ].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.difficultes.includes(option)}
                        onChange={() => toggleCheckbox('difficultes', option)}
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4" disabled />
                    <Input
                      value={formData.difficultes_autre}
                      onChange={(e) => updateField('difficultes_autre', e.target.value)}
                      placeholder="Autre (précisez)"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Souhaitez-vous insister sur un type de contenu particulier ?</Label>
              <textarea
                value={formData.contenu_particulier}
                onChange={(e) => updateField('contenu_particulier', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>

            <div className="space-y-2">
              <Label>Souhaitez-vous passer une certification ?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="certification"
                    value="Oui"
                    checked={formData.certification_souhaitee === 'Oui'}
                    onChange={(e) => updateField('certification_souhaitee', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Oui</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="certification"
                    value="Non"
                    checked={formData.certification_souhaitee === 'Non'}
                    onChange={(e) => updateField('certification_souhaitee', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Non</span>
                </label>
              </div>
              {formData.certification_souhaitee === 'Oui' && (
                <Input
                  value={formData.certification_laquelle}
                  onChange={(e) => updateField('certification_laquelle', e.target.value)}
                  placeholder="Si oui, laquelle ?"
                  className="mt-2"
                />
              )}
            </div>
          </div>

          {/* 5. CONTRAINTES ET CONDITIONS */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">5. Contraintes et conditions de suivi</h3>
            
            <div className="space-y-2">
              <Label>Disponibilités et rythme souhaité</Label>
              <div className="space-y-2">
                {['Intensif', 'Étendu', 'Flexible'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.rythme_souhaite.includes(option)}
                      onChange={() => toggleCheckbox('rythme_souhaite', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Format préféré</Label>
              <div className="space-y-2">
                {['Présentiel', 'Distanciel', 'Hybride'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.format_prefere.includes(option)}
                      onChange={() => toggleCheckbox('format_prefere', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Avez-vous des contraintes particulières (horaires, déplacements, matériel, etc.) ?</Label>
              <textarea
                value={formData.contraintes_particulieres}
                onChange={(e) => updateField('contraintes_particulieres', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>
          </div>

          {/* 6. SITUATION DE HANDICAP */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">6. Situation de handicap et besoins d'adaptation</h3>
            
            <div className="space-y-2">
              <Label>Êtes-vous en situation de handicap ou rencontrez-vous une difficulté particulière pouvant impacter votre apprentissage ?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="handicap"
                    value="Oui"
                    checked={formData.situation_handicap === 'Oui'}
                    onChange={(e) => updateField('situation_handicap', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Oui</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="handicap"
                    value="Non"
                    checked={formData.situation_handicap === 'Non'}
                    onChange={(e) => updateField('situation_handicap', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Non</span>
                </label>
              </div>
            </div>

            {formData.situation_handicap === 'Oui' && (
              <>
                <div className="space-y-2">
                  <Label>Souhaitez-vous un accompagnement spécifique pendant la formation ?</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="accompagnement"
                        value="Oui"
                        checked={formData.accompagnement_specifique === 'Oui'}
                        onChange={(e) => updateField('accompagnement_specifique', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>Oui</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="accompagnement"
                        value="Non"
                        checked={formData.accompagnement_specifique === 'Non'}
                        onChange={(e) => updateField('accompagnement_specifique', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>Non</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Avez-vous besoin d'un matériel ou outil particulier ?</Label>
                  <div className="space-y-2">
                    {['Ordinateur adapté', 'Casque audio', 'Logiciel spécifique'].map(option => (
                      <label key={option} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.materiel_particulier.includes(option)}
                          onChange={() => toggleCheckbox('materiel_particulier', option)}
                          className="w-4 h-4"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="w-4 h-4" disabled />
                      <Input
                        value={formData.materiel_autre}
                        onChange={(e) => updateField('materiel_autre', e.target.value)}
                        placeholder="Autre (précisez)"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Souhaitez-vous un aménagement particulier du rythme ou de l'organisation ?</Label>
                  <div className="space-y-2">
                    {['Séances plus courtes', 'Pauses plus fréquentes', 'Séances individuelles'].map(option => (
                      <label key={option} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.amenagement_rythme.includes(option)}
                          onChange={() => toggleCheckbox('amenagement_rythme', option)}
                          className="w-4 h-4"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="w-4 h-4" disabled />
                      <Input
                        value={formData.amenagement_autre}
                        onChange={(e) => updateField('amenagement_autre', e.target.value)}
                        placeholder="Autre (précisez)"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

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
