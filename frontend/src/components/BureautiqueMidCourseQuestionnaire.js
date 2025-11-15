import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import axios from "axios";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";

const API = process.env.REACT_APP_BACKEND_URL || "";

const BureautiqueMidCourseQuestionnaire = ({ open, onClose, studentId }) => {
  const sigCanvas = useRef(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    nom_prenom: "",
    
    // Ressenti global
    ressenti_global: "",
    correspondance_demande: "",
    rythme: "",
    format_convient: "",
    
    // Progression
    progression: "",
    outils_progres: [],
    outils_progres_autre: "",
    exemple_tache: "",
    
    // Difficultés
    rencontre_difficultes: "",
    difficultes_mise_en_page: false,
    difficultes_formules: false,
    difficultes_filtres: false,
    difficultes_diaporama: false,
    difficultes_mails: false,
    difficultes_fichiers: false,
    difficultes_autre: "",
    point_approfondir: "",
    
    // Ajustements
    suggestion_ralentir: false,
    suggestion_accelerer: false,
    suggestion_exercices: false,
    suggestion_explications: false,
    suggestion_plus_temps_word: false,
    suggestion_plus_temps_excel: false,
    suggestion_plus_temps_powerpoint: false,
    suggestion_plus_temps_autre: "",
    suggestion_autre: "",
    accompagnement_suffisant: "",
    
    signature: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sigCanvas.current.isEmpty()) {
      formData.signature = sigCanvas.current.toDataURL();
    }
    
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/students/${studentId}/bureautique-mid-course-questionnaire`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Questionnaire Bureautique à mi-parcours soumis !");
      onClose();
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    }
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            🧭 Q2 – Bureautique<br/>
            <span className="text-lg font-normal">Questionnaire de suivi à mi-parcours</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1) Identification */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">1) Identification</h3>
            
            <div>
              <Label>Nom et prénom</Label>
              <Input value={formData.nom_prenom} onChange={(e) => setFormData({...formData, nom_prenom: e.target.value})} required />
            </div>

            <div>
              <Label>Date</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
            </div>
          </div>

          {/* 2) Ressenti global */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">2) Ressenti global à mi-parcours</h3>
            
            <div>
              <Label>Comment ressentez-vous la formation pour l'instant ?</Label>
              <select 
                value={formData.ressenti_global} 
                onChange={(e) => setFormData({...formData, ressenti_global: e.target.value})}
                className="w-full p-2 border rounded mt-2"
                required
              >
                <option value="">Sélectionner</option>
                <option value="Pas du tout satisfaisant">Pas du tout satisfaisant</option>
                <option value="Peu satisfaisant">Peu satisfaisant</option>
                <option value="Plutôt satisfaisant">Plutôt satisfaisant</option>
                <option value="Satisfaisant">Satisfaisant</option>
                <option value="Très satisfaisant">Très satisfaisant</option>
              </select>
            </div>

            <div>
              <Label>La formation correspond-elle à ce que vous aviez demandé au départ ?</Label>
              <select 
                value={formData.correspondance_demande} 
                onChange={(e) => setFormData({...formData, correspondance_demande: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Pas du tout">Pas du tout</option>
                <option value="Plutôt non">Plutôt non</option>
                <option value="Plutôt oui">Plutôt oui</option>
                <option value="Tout à fait">Tout à fait</option>
              </select>
            </div>

            <div>
              <Label>Le rythme de la formation vous convient-il ?</Label>
              <select 
                value={formData.rythme} 
                onChange={(e) => setFormData({...formData, rythme: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Trop lent">Trop lent</option>
                <option value="Adapté">Adapté</option>
                <option value="Trop rapide">Trop rapide</option>
              </select>
            </div>

            <div>
              <Label>Le format (présentiel/distanciel/hybride) vous convient-il ?</Label>
              <select 
                value={formData.format_convient} 
                onChange={(e) => setFormData({...formData, format_convient: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Oui tout à fait">Oui tout à fait</option>
                <option value="Oui mais avec des difficultés">Oui mais avec des difficultés</option>
                <option value="Non, peu adapté">Non, peu adapté</option>
              </select>
            </div>
          </div>

          {/* 3) Progression */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">3) Progression perçue</h3>
            
            <div>
              <Label>Pensez-vous avoir progressé depuis le début de la formation en bureautique ?</Label>
              <select 
                value={formData.progression} 
                onChange={(e) => setFormData({...formData, progression: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Pas du tout">Pas du tout</option>
                <option value="Un peu">Un peu</option>
                <option value="Moyennement">Moyennement</option>
                <option value="Beaucoup">Beaucoup</option>
                <option value="Énormément">Énormément</option>
              </select>
            </div>

            <div>
              <Label>Sur quels outils sentez-vous le plus de progrès ?</Label>
              <div className="space-y-2 mt-2">
                {['Word', 'Excel', 'PowerPoint', 'Messagerie / agenda', 'Organisation de fichiers'].map(outil => (
                  <label key={outil} className="flex items-center gap-2">
                    <Checkbox 
                      checked={formData.outils_progres.includes(outil)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({...formData, outils_progres: [...formData.outils_progres, outil]});
                        } else {
                          setFormData({...formData, outils_progres: formData.outils_progres.filter(o => o !== outil)});
                        }
                      }}
                    />
                    <span>{outil}</span>
                  </label>
                ))}
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.outils_progres_autre} onChange={(e) => setFormData({...formData, outils_progres_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Donnez un exemple concret d'une tâche que vous faites mieux qu'avant :</Label>
              <Textarea 
                rows={3}
                value={formData.exemple_tache} 
                onChange={(e) => setFormData({...formData, exemple_tache: e.target.value})}
                placeholder="Réponse libre..."
              />
            </div>
          </div>

          {/* 4) Difficultés */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">4) Difficultés actuelles</h3>
            
            <div>
              <Label>Rencontrez-vous encore des difficultés ?</Label>
              <select 
                value={formData.rencontre_difficultes} 
                onChange={(e) => setFormData({...formData, rencontre_difficultes: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>

            {formData.rencontre_difficultes === "Oui" && (
              <>
                <div>
                  <Label>Si oui, lesquelles ?</Label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.difficultes_mise_en_page} onCheckedChange={(checked) => setFormData({...formData, difficultes_mise_en_page: checked})} />
                      <span>Mettre en page un document</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.difficultes_formules} onCheckedChange={(checked) => setFormData({...formData, difficultes_formules: checked})} />
                      <span>Créer / utiliser des formules Excel</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.difficultes_filtres} onCheckedChange={(checked) => setFormData({...formData, difficultes_filtres: checked})} />
                      <span>Utiliser les filtres / tris / graphiques</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.difficultes_diaporama} onCheckedChange={(checked) => setFormData({...formData, difficultes_diaporama: checked})} />
                      <span>Construire un diaporama cohérent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.difficultes_mails} onCheckedChange={(checked) => setFormData({...formData, difficultes_mails: checked})} />
                      <span>Gérer mes mails (dossiers, règles, tri)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.difficultes_fichiers} onCheckedChange={(checked) => setFormData({...formData, difficultes_fichiers: checked})} />
                      <span>Organiser mes fichiers</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span>Autre :</span>
                      <Input value={formData.difficultes_autre} onChange={(e) => setFormData({...formData, difficultes_autre: e.target.value})} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <Label>Y a-t-il un point sur lequel vous aimeriez passer plus de temps d'ici la fin de la formation ?</Label>
              <Textarea 
                rows={3}
                value={formData.point_approfondir} 
                onChange={(e) => setFormData({...formData, point_approfondir: e.target.value})}
                placeholder="Réponse libre..."
              />
            </div>
          </div>

          {/* 5) Ajustements */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">5) Ajustements souhaités</h3>
            
            <div>
              <Label>Avez-vous des suggestions pour améliorer la suite de votre parcours ?</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.suggestion_ralentir} onCheckedChange={(checked) => setFormData({...formData, suggestion_ralentir: checked})} />
                  <span>Ralentir le rythme</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.suggestion_accelerer} onCheckedChange={(checked) => setFormData({...formData, suggestion_accelerer: checked})} />
                  <span>Accélérer le rythme</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.suggestion_exercices} onCheckedChange={(checked) => setFormData({...formData, suggestion_exercices: checked})} />
                  <span>Plus d'exercices pratiques</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.suggestion_explications} onCheckedChange={(checked) => setFormData({...formData, suggestion_explications: checked})} />
                  <span>Plus d'explications pas à pas</span>
                </label>
                
                <div className="ml-6 space-y-2">
                  <Label className="text-sm">Plus de temps sur un logiciel en particulier :</Label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={formData.suggestion_plus_temps_word} onCheckedChange={(checked) => setFormData({...formData, suggestion_plus_temps_word: checked})} />
                    <span>Word</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={formData.suggestion_plus_temps_excel} onCheckedChange={(checked) => setFormData({...formData, suggestion_plus_temps_excel: checked})} />
                    <span>Excel</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={formData.suggestion_plus_temps_powerpoint} onCheckedChange={(checked) => setFormData({...formData, suggestion_plus_temps_powerpoint: checked})} />
                    <span>PowerPoint</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span>Autre :</span>
                    <Input value={formData.suggestion_plus_temps_autre} onChange={(e) => setFormData({...formData, suggestion_plus_temps_autre: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span>Autre suggestion :</span>
                  <Input value={formData.suggestion_autre} onChange={(e) => setFormData({...formData, suggestion_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Vous sentez-vous suffisamment accompagné ?</Label>
              <select 
                value={formData.accompagnement_suffisant} 
                onChange={(e) => setFormData({...formData, accompagnement_suffisant: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Oui">Oui</option>
                <option value="Plutôt oui">Plutôt oui</option>
                <option value="Plutôt non">Plutôt non</option>
                <option value="Non">Non</option>
              </select>
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">Signature stagiaire</h3>
            <div className="border-2 border-gray-300 rounded">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: "w-full h-40 touch-none",
                  style: { touchAction: "none" }
                }}
                onTouchStart={(e) => e.preventDefault()}
              />
            </div>
            <Button type="button" variant="outline" onClick={clearSignature}>
              Effacer la signature
            </Button>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1 bg-[#8B5A2B] hover:bg-[#6d4522] text-white">
              Soumettre le questionnaire
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BureautiqueMidCourseQuestionnaire;
