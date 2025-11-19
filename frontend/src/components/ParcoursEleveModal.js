import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Download, Trash2, FileText, Image as ImageIcon, FileSpreadsheet, Loader2, Mail, Send, Wand2, SendHorizonal, Eye } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fonction utilitaire pour obtenir les headers avec token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
};


// Section complète des rapports magiques avec 3 boutons
function MagicReportSection({ studentId, studentName }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");

  // Générer et Télécharger
  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      toast.info("Génération du rapport en cours...");

      const response = await axios.get(
        `${API}/students/${studentId}/magic-report`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rapport_Evolution_${studentName.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Rapport téléchargé avec succès!");
    } catch (error) {
      console.error("Erreur:", error);
      if (error.response?.status === 400) {
        toast.error("Les 3 tests doivent être complétés");
      } else {
        toast.error("Erreur lors de la génération");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Générer et Visualiser
  const handleView = async () => {
    try {
      setIsViewMode(true);
      toast.info("Ouverture du rapport...");

      const response = await axios.get(
        `${API}/students/${studentId}/magic-report`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      window.open(url, '_blank');
      
      toast.success("Rapport ouvert dans un nouvel onglet");
    } catch (error) {
      console.error("Erreur:", error);
      if (error.response?.status === 400) {
        toast.error("Les 3 tests doivent être complétés");
      } else {
        toast.error("Erreur lors de l'ouverture");
      }
    } finally {
      setIsViewMode(false);
    }
  };

  // Envoyer par email
  const handleSendEmail = async () => {
    if (!emailRecipient || !emailRecipient.includes('@')) {
      toast.error("Veuillez saisir une adresse email valide");
      return;
    }

    try {
      setIsSending(true);
      toast.info("Envoi du rapport en cours...");

      const response = await axios.post(
        `${API}/students/${studentId}/send-report`,
        { email: emailRecipient },
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        toast.success("Rapport envoyé avec succès!");
        setShowEmailModal(false);
        setEmailRecipient("");
      }
    } catch (error) {
      console.error("Erreur:", error);
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || "Les 3 tests doivent être complétés");
      } else if (error.response?.status === 500) {
        toast.error("Erreur d'envoi - Vérifiez la configuration SMTP");
      } else {
        toast.error("Erreur lors de l'envoi");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="mt-8 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch">
          {/* Bouton 1: Télécharger */}
          <Button
            onClick={handleDownload}
            disabled={isGenerating}
            className="bg-gradient-to-r from-[#5f44ff] to-[#7c3aed] hover:from-[#4f35e6] hover:to-[#6b29d4] text-white font-semibold py-3 px-5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Télécharger le rapport</span>
              </>
            )}
          </Button>

          {/* Bouton 2: Visualiser */}
          <Button
            onClick={handleView}
            disabled={isViewMode}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            size="lg"
          >
            {isViewMode ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Ouverture...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Visualiser le rapport</span>
              </>
            )}
          </Button>

          {/* Bouton 3: Envoyer par email */}
          <Button
            onClick={() => setShowEmailModal(true)}
            className="bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white font-semibold py-3 px-5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
            size="lg"
          >
            <SendHorizonal className="w-5 h-5" />
            <span>Envoyer par email</span>
          </Button>
        </div>
      </div>

      {/* Modal pour saisir l'email */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#5f44ff]">
              Envoyer le rapport par email
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-recipient" className="text-sm font-medium">
                Email du destinataire
              </Label>
              <Input
                id="email-recipient"
                type="email"
                placeholder="exemple@entreprise.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Le rapport sera envoyé à cette adresse avec le PDF en pièce jointe
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailModal(false);
                setEmailRecipient("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSending || !emailRecipient}
              className="bg-[#5f44ff] hover:bg-[#4f35e6] text-white"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                "Envoyer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


// Composant pour afficher TOUS les tests interactifs soumis (toutes catégories)
function InteractiveTestsDisplaySection({ studentId }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testTemplate, setTestTemplate] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadTests();
  }, [studentId]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API}/students/${studentId}/resources`,
        { headers: getAuthHeaders() }
      );
      
      // Filtrer TOUS les tests soumis
      const allTests = response.data.resources.filter(
        r => r.category === 'TEST_PARCOURS' && r.status === 'SOUMIS'
      );
      
      console.log('[InteractiveTestsDisplaySection] Tests trouvés:', allTests);
      setTests(allTests);
    } catch (error) {
      console.error("[InteractiveTestsDisplaySection] Error loading tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTest = async (test) => {
    try {
      const templateId = test.template_id || 'test-bureautique-positionnement-v1';
      const templateResponse = await axios.get(
        `${API}/test-templates/${templateId}`,
        { headers: getAuthHeaders() }
      );
      setTestTemplate(templateResponse.data);
      setSelectedTest(test);
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading test template:", error);
      toast.error("Erreur lors du chargement du test");
    }
  };

  // Fonction pour obtenir la mention selon le score
  const getMention = (score) => {
    if (score < 30) {
      return { label: 'Non acquis', color: 'bg-red-100 text-red-800 border-red-300' };
    } else if (score < 60) {
      return { label: 'En cours d\'acquisitions', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    } else {
      return { label: 'Acquis', color: 'bg-green-100 text-green-800 border-green-300' };
    }
  };

  if (loading) {
    return <div className="mt-6 p-4 bg-blue-100 border-2 border-blue-500">
      <p className="font-bold">⏳ Chargement des tests...</p>
    </div>;
  }

  if (tests.length === 0) {
    return <div className="mt-6 p-4 bg-yellow-100 border-2 border-yellow-500">
      <p className="font-bold">⚠️ Aucun test soumis trouvé pour cet élève</p>
      <p className="text-sm">StudentId: {studentId}</p>
    </div>;
  }

  return (
    <>
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Tests de parcours soumis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map(test => {
            const mention = getMention(test.score);
            return (
              <div key={test.id} className={`p-6 border-2 rounded-xl ${mention.color}`}>
                {/* Score en gros au centre */}
                <div className="text-center mb-4">
                  <div className="text-6xl font-bold mb-2">{test.score}%</div>
                  <div className={`inline-block px-4 py-2 rounded-full font-semibold text-lg ${mention.color}`}>
                    {mention.label}
                  </div>
                </div>
                
                {/* Informations du test */}
                <div className="text-center mb-4">
                  <p className="font-bold text-gray-900 text-lg mb-1">{test.template_name}</p>
                  <p className="text-sm text-gray-600">
                    Complété le {new Date(test.submitted_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                
                {/* Boutons */}
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => handleViewTest(test)}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Visualiser les résultats
                  </Button>
                  <Button
                    onClick={() => toast.info("Fonction d'envoi par email en cours de développement")}
                    size="sm"
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Envoyer
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de consultation du test avec correction */}
      {showDetailModal && selectedTest && testTemplate && (
        <TestCorrectionModal
          test={selectedTest}
          template={testTemplate}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTest(null);
            setTestTemplate(null);
          }}
        />
      )}
    </>
  );
}

// Composant pour afficher les tests interactifs soumis
function InteractiveTestsDisplay({ studentId, subType }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testTemplate, setTestTemplate] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadTests();
  }, [studentId, subType]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API}/students/${studentId}/resources`,
        { headers: getAuthHeaders() }
      );
      
      console.log('[InteractiveTestsDisplay] API response:', response.data);
      console.log('[InteractiveTestsDisplay] Filtering for subType:', subType);
      
      // Filtrer les tests par sub_type
      const filteredTests = response.data.resources.filter(
        r => r.category === 'TEST_PARCOURS' && r.sub_type === subType && r.status === 'SOUMIS'
      );
      
      console.log('[InteractiveTestsDisplay] Filtered tests:', filteredTests);
      setTests(filteredTests);
    } catch (error) {
      console.error("[InteractiveTestsDisplay] Error loading tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTest = async (test) => {
    try {
      // Charger le template du test pour avoir les bonnes réponses en utilisant template_id
      const templateId = test.template_id || 'test-bureautique-positionnement-v1';
      const templateResponse = await axios.get(
        `${API}/test-templates/${templateId}`,
        { headers: getAuthHeaders() }
      );
      setTestTemplate(templateResponse.data);
      setSelectedTest(test);
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading test template:", error);
      toast.error("Erreur lors du chargement du test");
    }
  };

  // Toujours afficher quelque chose pour déboguer
  if (loading) {
    return <div className="text-xs text-gray-500">Chargement des tests interactifs...</div>;
  }

  if (tests.length === 0) {
    return <div className="text-xs text-gray-500">Aucun test interactif soumis (subType: {subType})</div>;
  }

  // Fonction pour obtenir la mention selon le score
  const getMention = (score) => {
    if (score < 30) {
      return { label: 'Non acquis', color: 'bg-red-100 text-red-800 border-red-300' };
    } else if (score < 60) {
      return { label: 'En cours d\'acquisitions', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    } else {
      return { label: 'Acquis', color: 'bg-green-100 text-green-800 border-green-300' };
    }
  };

  return (
    <>
      <div className="mt-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Tests interactifs soumis:</h4>
        {tests.map(test => {
          const mention = getMention(test.score);
          return (
            <div key={test.id} className={`p-6 border-2 rounded-xl ${mention.color}`}>
              {/* Score en gros au centre */}
              <div className="text-center mb-4">
                <div className="text-6xl font-bold mb-2">{test.score}%</div>
                <div className={`inline-block px-4 py-2 rounded-full font-semibold text-lg ${mention.color}`}>
                  {mention.label}
                </div>
              </div>
              
              {/* Informations du test */}
              <div className="text-center mb-4">
                <p className="font-bold text-gray-900 text-lg mb-1">{test.template_name}</p>
                <p className="text-sm text-gray-600">
                  Complété le {new Date(test.submitted_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              
              {/* Boutons */}
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => handleViewTest(test)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Visualiser les résultats
                </Button>
                <Button
                  onClick={() => toast.info("Fonction d'envoi par email en cours de développement")}
                  size="sm"
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Envoyer
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de consultation du test avec correction */}
      {showDetailModal && selectedTest && testTemplate && (
        <TestCorrectionModal
          test={selectedTest}
          template={testTemplate}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTest(null);
            setTestTemplate(null);
          }}
        />
      )}
    </>
  );
}

// Modal pour afficher la correction d'un test
function TestCorrectionModal({ test, template, onClose }) {
  const studentAnswers = test.student_answers || {};
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-indigo-600">
            {template.title} - Correction
          </DialogTitle>
          <div className="flex gap-4 text-sm text-gray-600 mt-2">
            <span>Test: {test.template_name}</span>
            <span>Score: <span className="font-bold text-green-600">{test.score}%</span></span>
            <span>Soumis le: {new Date(test.submitted_at).toLocaleDateString('fr-FR')}</span>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {template.sections.map((section, sIdx) => (
            <div key={section.id} className="border-b pb-4">
              <h3 className="text-lg font-bold text-gray-800 mb-3">{section.title}</h3>
              
              {section.questions.map((question, qIdx) => {
                const questionNumber = template.sections
                  .slice(0, sIdx)
                  .reduce((sum, s) => sum + s.questions.length, 0) + qIdx + 1;
                
                // Récupérer les réponses de l'élève pour cette question
                const studentAnswer = studentAnswers[question.id] || [];
                const studentAnswerArray = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
                const correctAnswers = question.correctAnswers || [];
                
                // Vérifier si la réponse est correcte
                const isQuestionCorrect = 
                  studentAnswerArray.length === correctAnswers.length &&
                  studentAnswerArray.every(a => correctAnswers.includes(a));
                
                return (
                  <div key={question.id} className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900 flex-1">
                        Question {questionNumber}: {question.text}
                      </p>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isQuestionCorrect 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {isQuestionCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </div>
                    </div>
                    
                    <div className="space-y-1 ml-4">
                      {question.choices.map(choice => {
                        const isCorrect = correctAnswers.includes(choice.key);
                        const wasSelected = studentAnswerArray.includes(choice.key);
                        
                        // Déterminer le style
                        let bgClass = 'bg-white border border-gray-200';
                        let textClass = 'text-gray-700';
                        let icon = '';
                        
                        if (isCorrect && wasSelected) {
                          // Bonne réponse sélectionnée
                          bgClass = 'bg-green-100 border-2 border-green-500';
                          textClass = 'text-green-800 font-semibold';
                          icon = ' ✓';
                        } else if (isCorrect && !wasSelected) {
                          // Bonne réponse non sélectionnée
                          bgClass = 'bg-green-50 border border-green-300';
                          textClass = 'text-green-700';
                          icon = ' ✓ (non sélectionnée)';
                        } else if (!isCorrect && wasSelected) {
                          // Mauvaise réponse sélectionnée
                          bgClass = 'bg-red-100 border-2 border-red-500';
                          textClass = 'text-red-800 font-semibold';
                          icon = ' ✗';
                        }
                        
                        return (
                          <div key={choice.key} className={`p-2 rounded ${bgClass}`}>
                            <span className={textClass}>
                              {choice.key}. {choice.label}{icon}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose} variant="outline">
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Composant pour une section d'upload avec note GLOBALE par catégorie
function UploadSectionWithNote({ studentId, category, title, buttonText, showNote = false, onOpenEmailModal, subType = null }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryNote, setCategoryNote] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteValidatedAt, setNoteValidatedAt] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadDocuments();
    if (showNote) {
      loadCategoryNote();
    }
  }, [studentId, category]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/students/${studentId}/documents/${category}`, {
        headers: getAuthHeaders()
      });
      setDocuments(response.data);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryNote = async () => {
    try {
      const response = await axios.get(`${API}/students/${studentId}/category-notes/${category}`, {
        headers: getAuthHeaders()
      });
      if (response.data.note) {
        setCategoryNote(response.data.note);
        setNoteInput(response.data.note);
        setNoteValidatedAt(response.data.validated_at || '');
      }
    } catch (error) {
      console.error("Error loading category note:", error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    // Vérifier les types (PDF/PNG/JPG/DOCX)
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const invalidFiles = files.filter(f => !allowedTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error("Seuls les fichiers PDF, PNG, JPG et DOCX sont autorisés");
      return;
    }

    // Vérifier la taille (10 Mo max par fichier)
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error("La taille maximale par fichier est de 10 Mo");
      return;
    }

    try {
      setUploading(true);
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('token');
        await axios.post(`${API}/students/${studentId}/documents/upload?category=${category}`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      
      toast.success(`${files.length} fichier(s) téléversé(s) avec succès`);
      loadDocuments();
      e.target.value = '';
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const response = await axios.get(
        `${API}/students/${studentId}/documents/download/${documentId}`,
        { 
          responseType: 'blob',
          headers: getAuthHeaders()
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Document téléchargé");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleDelete = async (documentId, filename) => {
    if (!window.confirm(`Supprimer "${filename}" ?`)) return;
    
    try {
      await axios.delete(`${API}/students/${studentId}/documents/${documentId}`, {
        headers: getAuthHeaders()
      });
      toast.success("Document supprimé");
      loadDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSaveCategoryNote = async () => {
    if (!noteInput.trim()) {
      toast.error("Veuillez saisir une note");
      return;
    }
    
    try {
      setSavingNote(true);
      await axios.put(`${API}/students/${studentId}/category-notes/${category}`,
        { note: noteInput },
        { headers: getAuthHeaders() }
      );
      setCategoryNote(noteInput);
      toast.success("Note validée et enregistrée");
      loadCategoryNote(); // Recharger pour avoir validated_at
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingNote(false);
    }
  };

  // Fonction simplifiée - on appelle juste le callback parent
  const handleOpenEmailModal = () => {
    if (onOpenEmailModal) {
      onOpenEmailModal(category, studentId);
    }
  };

  const getFileIcon = (mime) => {
    if (mime?.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (mime?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mime?.includes('word')) return <FileSpreadsheet className="w-5 h-5 text-blue-600" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-br from-[#8B5A2B] via-[#7A4F26] to-[#6B4522] text-white flex items-center justify-between">
        <h4 className="font-semibold text-lg">{title}</h4>
        {showNote && (
          <Button
            onClick={handleOpenEmailModal}
            size="sm"
            className="bg-white text-[#8B5A2B] hover:bg-gray-100 font-semibold"
          >
            <Mail className="w-4 h-4 mr-2" />
            Transmettre
          </Button>
        )}
      </div>

      {/* Zone d'upload */}
      <Card className="border-2 border-dashed border-[#8B5A2B]/30 bg-[#F8F1EC]">
        <CardContent className="pt-6">
          <label className="cursor-pointer block">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {uploading ? (
                <Loader2 className="w-10 h-10 text-[#8B5A2B] animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-[#8B5A2B]" />
              )}
              <p className="text-sm font-medium text-[#8B5A2B] text-center">
                {uploading ? "Téléversement en cours..." : buttonText}
              </p>
              <p className="text-xs text-gray-600">
                PDF, PNG, JPG, DOCX • 10 Mo max/fichier
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Liste des documents */}
      {loading ? (
        <div className="text-center py-6 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Chargement...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Aucun document téléversé
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-[#8B5A2B]/20 hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {getFileIcon(doc.mime)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate text-sm">{doc.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                      <p className="text-xs text-gray-400 italic mt-1">
                        📅 Téléversé le {formatDateTime(doc.uploaded_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleDownload(doc.id, doc.filename)}
                      size="sm"
                      className="bg-[#8B5A2B] text-white hover:bg-[#7A4F26]"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      size="sm"
                      variant="outline"
                      className="text-[#8B5A2B] border-[#8B5A2B]/30 hover:bg-[#F8F1EC]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Note/Niveau global pour la catégorie (seulement pour les tests/évaluations) */}
      {showNote && (
        <Card className="border-2 border-[#8B5A2B]/40 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-800">
                  Niveau ou note obtenue
                </Label>
                {categoryNote && (
                  <span className="text-xs text-gray-500">
                    Dernière validation enregistrée
                  </span>
                )}
              </div>
              
              {categoryNote ? (
                <div className="p-4 bg-white rounded-lg border-2 border-[#8B5A2B] shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Note validée :</p>
                      <p className="text-2xl font-bold text-[#8B5A2B]">{categoryNote}</p>
                      {noteValidatedAt && (
                        <p className="text-xs text-gray-400 italic mt-2">
                          ✓ Validée le {formatDateTime(noteValidatedAt)}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        setCategoryNote('');
                        setNoteInput('');
                      }}
                      size="sm"
                      variant="outline"
                      className="text-[#8B5A2B] border-[#8B5A2B]/30"
                    >
                      Modifier
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input 
                    placeholder="Ex: B2, 15/20, Acquis, 85%..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="border-[#8B5A2B]/40 focus:border-[#8B5A2B] text-base font-medium"
                  />
                  <Button
                    onClick={handleSaveCategoryNote}
                    disabled={savingNote || !noteInput.trim()}
                    className="w-full bg-[#8B5A2B] hover:bg-[#7A4F26] text-white font-semibold"
                  >
                    {savingNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validation en cours...
                      </>
                    ) : (
                      '✓ Valider cette note'
                    )}
                  </Button>
                </div>
              )}
              
              <p className="text-xs text-gray-500 italic">
                Cette note représente le niveau global obtenu pour cette catégorie et permet de suivre l'évolution de l'élève.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// Composant pour afficher les questionnaires bénéficiaires
function BeneficiaryDocumentsTab({ studentId, studentName, student }) {
  const [formationNeedsQ, setFormationNeedsQ] = useState(null);
  const [midCourseQ, setMidCourseQ] = useState(null);
  const [endCourseQ, setEndCourseQ] = useState(null);
  const [studentResources, setStudentResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (student && studentId) {
      loadQuestionnaires();
      loadStudentResources();
    }
  }, [studentId, student]);

  const loadQuestionnaires = async () => {
    try {
      setLoading(true);
      
      // Déterminer les endpoints selon le parcours de l'élève
      const isBureautique = student?.parcours === "Bureautique";
      const q1Endpoint = isBureautique ? 'bureautique-formation-needs' : 'formation-needs';
      const q2Endpoint = isBureautique ? 'bureautique-mid-course-questionnaire' : 'mid-course-questionnaire';
      const q3Endpoint = isBureautique ? 'bureautique-end-course-questionnaire' : 'end-course-questionnaire';
      
      // Charger le questionnaire de besoins en formation
      const formationNeedsResponse = await axios.get(
        `${API}/students/${studentId}/${q1Endpoint}`,
        { headers: getAuthHeaders() }
      );
      if (formationNeedsResponse.data.exists) {
        setFormationNeedsQ(formationNeedsResponse.data.questionnaire);
      }
      
      // Charger le questionnaire à mi-parcours
      const midCourseResponse = await axios.get(
        `${API}/students/${studentId}/${q2Endpoint}`,
        { headers: getAuthHeaders() }
      );
      if (midCourseResponse.data.exists) {
        setMidCourseQ(midCourseResponse.data.questionnaire);
      }
      
      // Charger le questionnaire de fin de formation
      const endCourseResponse = await axios.get(
        `${API}/students/${studentId}/${q3Endpoint}`,
        { headers: getAuthHeaders() }
      );
      if (endCourseResponse.data.exists) {
        setEndCourseQ(endCourseResponse.data.questionnaire);
      }
      
    } catch (error) {
      console.error("Error loading questionnaires:", error);
      toast.error("Erreur lors du chargement des questionnaires");
    } finally {
      setLoading(false);
    }
  };

  const loadStudentResources = async () => {
    try {
      const response = await axios.get(
        `${API}/students/${studentId}/resources`,
        { headers: getAuthHeaders() }
      );
      setStudentResources(response.data.resources || []);
    } catch (error) {
      console.error("Error loading student resources:", error);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderAnswer = (value) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '—';
    }
    return value || '—';
  };

  // Helper pour déterminer les endpoints selon le parcours
  const getQuestionnaireEndpoint = (type) => {
    const isBureautique = student?.parcours === "Bureautique";
    
    if (type === 'formation-needs') {
      return isBureautique ? 'bureautique-formation-needs' : 'formation-needs';
    } else if (type === 'mid-course') {
      return isBureautique ? 'bureautique-mid-course-questionnaire' : 'mid-course-questionnaire';
    } else if (type === 'end-course') {
      return isBureautique ? 'bureautique-end-course-questionnaire' : 'end-course-questionnaire';
    }
    return '';
  };

  const handleDownloadQuestionnaire = async (type) => {
    try {
      setDownloading(true);
      const baseEndpoint = getQuestionnaireEndpoint(type);
      let endpoint = `/students/${studentId}/${baseEndpoint}/pdf`;
      let filename = '';
      
      if (type === 'formation-needs') {
        filename = `Questionnaire_BesoinFormation_${studentName.replace(/\s+/g, '_')}.pdf`;
      } else if (type === 'mid-course') {
        filename = `Questionnaire_MiParcours_${studentName.replace(/\s+/g, '_')}.pdf`;
      } else if (type === 'end-course') {
        filename = `Questionnaire_FinFormation_${studentName.replace(/\s+/g, '_')}.pdf`;
      }
      
      const response = await axios.get(
        `${API}${endpoint}`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const pdfUrl = window.URL.createObjectURL(pdfBlob);
      
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(pdfUrl);
      toast.success("PDF téléchargé avec succès !");
    } catch (error) {
      console.error("Error downloading questionnaire:", error);
      toast.error("Erreur lors du téléchargement du PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleEmailQuestionnaire = (type) => {
    setSelectedType(type);
    setEmailTo('');
    let title = '';
    
    if (type === 'formation-needs') {
      title = 'Questionnaire de besoins en formation';
    } else if (type === 'mid-course') {
      title = 'Questionnaire à mi-parcours';
    } else if (type === 'end-course') {
      title = 'Questionnaire de fin de formation';
    }
    
    setEmailSubject(`${title} - ${studentName}`);
    setEmailBody(`Bonjour,\n\nVeuillez trouver ci-joint le ${title.toLowerCase()} de ${studentName}.\n\nCordialement,`);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast.error("Veuillez saisir au moins un destinataire");
      return;
    }
    
    try {
      setSending(true);
      const baseEndpoint = getQuestionnaireEndpoint(selectedType);
      let endpoint = `/students/${studentId}/${baseEndpoint}/send-email`;
      
      await axios.post(
        `${API}${endpoint}`,
        {
          to: emailTo,
          subject: emailSubject,
          body: emailBody
        },
        {
          headers: getAuthHeaders()
        }
      );
      
      toast.success(`Email envoyé avec succès à ${emailTo} !`);
      setShowEmailModal(false);
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
      setSelectedType(null);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de l'envoi de l'email");
    } finally {
      setSending(false);
    }
  };

  const handleGenerateBilan = async () => {
    try {
      setDownloading(true);
      
      const response = await axios.post(
        `${API}/students/${studentId}/generate-bilan`,
        {},
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const pdfUrl = window.URL.createObjectURL(pdfBlob);
      
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Bilan_Eleve_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(pdfUrl);
      toast.success("✅ Bilan Élève généré avec succès !");
    } catch (error) {
      console.error("Error generating bilan:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de la génération du bilan");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#8B5A2B]" />
        <p className="text-gray-600">Chargement des questionnaires...</p>
      </div>
    );
  }

  if (!formationNeedsQ && !midCourseQ && !endCourseQ && studentResources.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-600 text-lg">Aucun document soumis pour le moment</p>
        <p className="text-gray-500 text-sm mt-2">L'élève n'a pas encore rempli de questionnaires ni complété de tests</p>
      </div>
    );
  }

  // Vue détaillée du questionnaire
  if (selectedQuestionnaire) {
    const q = selectedQuestionnaire;
    
    // Déterminer le titre selon le type
    let title = "1) Questionnaire de besoin en formation";
    if (selectedType === 'mid-course') {
      title = "2) Questionnaire à mi-parcours";
    } else if (selectedType === 'end-course') {
      title = "3) Questionnaire de fin de formation";
    }
    
    return (
      <div className="space-y-6">
        {/* Header avec bouton retour */}
        <div className="flex items-center justify-between bg-gradient-to-br from-[#8B5A2B] via-[#7A4F26] to-[#6B4522] text-white p-4 rounded-lg">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-sm opacity-90 mt-1">
              Soumis le {formatDateTime(q.submitted_at)} par {studentName}
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedQuestionnaire(null);
              setSelectedType(null);
            }}
            className="bg-white text-[#8B5A2B] hover:bg-gray-100"
          >
            ← Retour
          </Button>
        </div>
        
        <style>{`
          .questionnaire-checkbox:checked {
            background-color: #DB2777;
            border-color: #DB2777;
          }
          .questionnaire-radio:checked {
            background-color: #DB2777;
            border-color: #DB2777;
          }
        `}</style>
        
        {/* Afficher le contenu selon le type ET le parcours */}
        {selectedType === 'formation-needs' && (
          student?.parcours === "Bureautique" 
            ? renderBureautiqueFormationNeedsDetail(q)
            : renderFormationNeedsDetail(q)
        )}
        {selectedType === 'mid-course' && (
          student?.parcours === "Bureautique"
            ? renderBureautiqueMidCourseDetail(q)
            : renderMidCourseDetail(q)
        )}
        {selectedType === 'end-course' && (
          student?.parcours === "Bureautique"
            ? renderBureautiqueEndCourseDetail(q)
            : renderEndCourseDetail(q)
        )}
      </div>
    );
  }
  
  // Fonction pour rendre le questionnaire 1 (besoins en formation)
  function renderFormationNeedsDetail(q) {
    return (
    <div className="space-y-6">
      {/* Contenu du questionnaire avec format original */}
          {/* Section 1: Identification */}
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                1. Identification
              </h4>
              
              <div className="space-y-2">
                <Label className="text-gray-900">Situation professionnelle *</Label>
                <div className="space-y-2">
                  {['En fonction', 'En recherche d\'emploi', 'En reconversion'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.situation_professionnelle?.includes(option)}
                        readOnly
                        className="w-4 h-4 questionnaire-checkbox"
                      />
                      <span className={q.situation_professionnelle?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {q.si_en_fonction && (
                <div className="space-y-2">
                  <Label className="text-gray-900">Si en fonction, précisez :</Label>
                  <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.si_en_fonction}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-900">Poste occupé</Label>
                  <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.poste_occupe || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-900">Ancienneté dans le poste</Label>
                  <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.anciennete || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Motivation et objectifs */}
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                2. Motivation et objectifs
              </h4>
              
              <div className="space-y-2">
                <Label className="text-gray-900">Avez-vous déjà suivi une formation d'anglais ? *</Label>
                <div className="flex gap-4">
                  {['Oui', 'Non'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.formation_anglais_anterieure === option}
                        readOnly
                        className="w-4 h-4 questionnaire-radio"
                      />
                      <span className={q.formation_anglais_anterieure === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
                {q.formation_details && (
                  <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 mt-2">{q.formation_details}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Pourquoi souhaitez-vous suivre cette formation ? *</Label>
                <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.raison_formation || '—'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Dans quel cadre utiliserez-vous l'anglais ? *</Label>
                <div className="space-y-2">
                  {['Travail quotidien', 'Communication client', 'Réunions', 'Voyages'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.cadre_utilisation?.includes(option)}
                        readOnly
                        className="w-4 h-4 questionnaire-checkbox"
                      />
                      <span className={q.cadre_utilisation?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                  {q.cadre_autre && (
                    <p className="text-pink-700 font-semibold bg-white p-2 rounded-md border-2 border-pink-200 ml-6">Autre : {q.cadre_autre}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Quels sont vos objectifs principaux ? *</Label>
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
                        checked={q.objectifs_principaux?.includes(option)}
                        readOnly
                        className="w-4 h-4 questionnaire-checkbox"
                      />
                      <span className={q.objectifs_principaux?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Qu'attendez-vous concrètement à la fin de la formation ? *</Label>
                <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.attentes_fin_formation || '—'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Niveau et compétences */}
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                3. Niveau et compétences linguistiques (auto-évaluation)
              </h4>
              
              <div className="grid grid-cols-4 gap-2">
                <div className="font-bold text-gray-900">Compétence</div>
                <div className="font-bold text-center text-gray-900">Faible</div>
                <div className="font-bold text-center text-gray-900">Moyen</div>
                <div className="font-bold text-center text-gray-900">Bon</div>
              </div>

              {[
                { key: 'comprehension_orale', label: 'Compréhension orale' },
                { key: 'expression_orale', label: 'Expression orale' },
                { key: 'comprehension_ecrite', label: 'Compréhension écrite' },
                { key: 'expression_ecrite', label: 'Expression écrite' }
              ].map(({ key, label }) => (
                <div key={key} className="grid grid-cols-4 gap-2 items-center bg-white p-2 rounded-md">
                  <div className="text-gray-900">{label}</div>
                  {['Faible', 'Moyen', 'Bon'].map(level => (
                    <div key={level} className="flex justify-center">
                      <input
                        type="radio"
                        checked={q[key] === level}
                        readOnly
                        className="w-4 h-4 questionnaire-radio"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 4: Besoins professionnels */}
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                4. Besoins professionnels et attentes spécifiques
              </h4>
              
              <div className="space-y-2">
                <Label className="text-gray-900">Dans votre fonction actuelle, quelles sont les situations professionnelles où l'anglais est nécessaire ou pourrait le devenir ?</Label>
                <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.situations_anglais_necessaire || '—'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Quelles difficultés rencontrez-vous actuellement ?</Label>
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
                        checked={q.difficultes?.includes(option)}
                        readOnly
                        className="w-4 h-4 questionnaire-checkbox"
                      />
                      <span className={q.difficultes?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                  {q.difficultes_autre && (
                    <p className="text-pink-700 font-semibold bg-white p-2 rounded-md border-2 border-pink-200 ml-6">Autre : {q.difficultes_autre}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Souhaitez-vous insister sur un type de contenu particulier ?</Label>
                <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.contenu_particulier || '—'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Souhaitez-vous passer une certification ?</Label>
                <div className="flex gap-4">
                  {['Oui', 'Non'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.certification_souhaitee === option}
                        readOnly
                        className="w-4 h-4 questionnaire-radio"
                      />
                      <span className={q.certification_souhaitee === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
                {q.certification_laquelle && (
                  <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 mt-2">{q.certification_laquelle}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Contraintes et conditions */}
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                5. Contraintes et conditions de suivi
              </h4>
              
              <div className="space-y-2">
                <Label className="text-gray-900">Disponibilités et rythme souhaité</Label>
                <div className="space-y-2">
                  {['Intensif', 'Étendu', 'Flexible'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.rythme_souhaite?.includes(option)}
                        readOnly
                        className="w-4 h-4 questionnaire-checkbox"
                      />
                      <span className={q.rythme_souhaite?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Format préféré</Label>
                <div className="space-y-2">
                  {['Présentiel', 'Distanciel', 'Hybride'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.format_prefere?.includes(option)}
                        readOnly
                        className="w-4 h-4 questionnaire-checkbox"
                      />
                      <span className={q.format_prefere?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900">Avez-vous des contraintes particulières (horaires, déplacements, matériel, etc.) ?</Label>
                <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.contraintes_particulieres || '—'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Situation de handicap */}
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                6. Situation de handicap et besoins d'adaptation
              </h4>
              
              <div className="space-y-2">
                <Label className="text-gray-900">Êtes-vous en situation de handicap ou rencontrez-vous une difficulté particulière pouvant impacter votre apprentissage ?</Label>
                <div className="flex gap-4">
                  {['Oui', 'Non'].map(option => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.situation_handicap === option}
                        readOnly
                        className="w-4 h-4 questionnaire-radio"
                      />
                      <span className={q.situation_handicap === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {q.situation_handicap === 'Oui' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-gray-900">Souhaitez-vous un accompagnement spécifique pendant la formation ?</Label>
                    <div className="flex gap-4">
                      {['Oui', 'Non'].map(option => (
                        <label key={option} className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={q.accompagnement_specifique === option}
                            readOnly
                            className="w-4 h-4 questionnaire-radio"
                          />
                          <span className={q.accompagnement_specifique === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-900">Avez-vous besoin d'un matériel ou outil particulier ?</Label>
                    <div className="space-y-2">
                      {['Ordinateur adapté', 'Casque audio', 'Logiciel spécifique'].map(option => (
                        <label key={option} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={q.materiel_particulier?.includes(option)}
                            readOnly
                            className="w-4 h-4 questionnaire-checkbox"
                          />
                          <span className={q.materiel_particulier?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                        </label>
                      ))}
                      {q.materiel_autre && (
                        <p className="text-pink-700 font-semibold bg-white p-2 rounded-md border-2 border-pink-200 ml-6">Autre : {q.materiel_autre}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-900">Souhaitez-vous un aménagement particulier du rythme ou de l'organisation ?</Label>
                    <div className="space-y-2">
                      {['Séances plus courtes', 'Pauses plus fréquentes', 'Séances individuelles'].map(option => (
                        <label key={option} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={q.amenagement_rythme?.includes(option)}
                            readOnly
                            className="w-4 h-4 questionnaire-checkbox"
                          />
                          <span className={q.amenagement_rythme?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                        </label>
                      ))}
                      {q.amenagement_autre && (
                        <p className="text-pink-700 font-semibold bg-white p-2 rounded-md border-2 border-pink-200 ml-6">Autre : {q.amenagement_autre}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Signature */}
          {q.signature && (
            <Card className="border-2 border-blue-300 bg-blue-50">
              <CardContent className="pt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">7. Validation</h4>
                <Label className="text-gray-900">Signature * (horodatée)</Label>
                <div className="bg-white p-4 rounded-lg border-2 border-gray-300 mt-2">
                  <img 
                    src={q.signature} 
                    alt="Signature" 
                    className="max-h-32 mx-auto"
                  />
                </div>
                <p className="text-sm text-gray-600 italic mt-3">
                  Je certifie l'exactitude des données et transmets mes informations à TerciForm
                </p>
                <p className="text-sm text-gray-600 italic mt-2 text-center font-semibold">
                  ✓ Signé le {formatDateTime(q.submitted_at)}
                </p>
              </CardContent>
            </Card>
          )}
    </div>
    );
  }
  
  // Fonction pour rendre le questionnaire 2 (mi-parcours)
  function renderMidCourseDetail(q) {
    return (
    <div className="space-y-6">
      {/* Section 1: Informations générales */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            1. Informations générales
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">Nom et prénom :</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.nom_prenom || '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Date du suivi :</Label>
              <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.date_suivi || '—'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Formateur référent :</Label>
              <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.formateur_referent || '—'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Mode de formation :</Label>
            <div className="space-y-2">
              {['Présentiel', 'Distanciel', 'Hybride'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="checkbox" checked={q.mode_formation?.includes(option)} readOnly className="w-4 h-4 questionnaire-checkbox" />
                  <span className={q.mode_formation?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Ressenti */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            💬 2. Ressenti sur le déroulement de la formation
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">La formation répond-elle à vos attentes ?</Label>
            <div className="space-y-2">
              {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.formation_attentes === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.formation_attentes === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Le rythme et la durée des séances vous conviennent-ils ?</Label>
            <div className="space-y-2">
              {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.rythme_duree === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.rythme_duree === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Les supports et méthodes facilitent-ils votre apprentissage ?</Label>
            <div className="space-y-2">
              {['Oui tout à fait', 'Assez', 'Peu', 'Pas du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.supports_methodes === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.supports_methodes === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Progression */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            🎯 3. Progression et besoins complémentaires
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">Qu'avez-vous le plus appris ou amélioré ?</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.apprentissages || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Rencontrez-vous des difficultés particulières ?</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.difficultes || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Souhaitez-vous approfondir certains points ?</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">
              {q.approfondir || '—'} {q.approfondir_details && `- ${q.approfondir_details}`}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Suggestions pour améliorer la formation :</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.suggestions || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      {q.signature && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="pt-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4">✍️ 5. Validation</h4>
            <Label className="text-gray-900">Signature du stagiaire (horodatée)</Label>
            <div className="bg-white p-4 rounded-lg border-2 border-gray-300 mt-2">
              <img src={q.signature} alt="Signature" className="max-h-32 mx-auto" />
            </div>
            <p className="text-sm text-gray-600 italic mt-2 text-center font-semibold">
              ✓ Signé le {formatDateTime(q.submitted_at)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    );
  }

  // Fonction pour rendre le questionnaire 3 (fin de formation)
  function renderEndCourseDetail(q) {
    return (
    <div className="space-y-6">
      {/* Section 1: Informations générales */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            1. Informations générales
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">Nom et prénom :</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.nom_prenom || '—'}</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Date :</Label>
              <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.date || '—'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Formateur :</Label>
              <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.formateur_referent || '—'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Durée totale :</Label>
              <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">{q.duree_totale || '—'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Mode de formation :</Label>
            <div className="space-y-2">
              {['Présentiel', 'Distanciel', 'Hybride'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="checkbox" checked={q.mode_formation?.includes(option)} readOnly className="w-4 h-4 questionnaire-checkbox" />
                  <span className={q.mode_formation?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Évaluation */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            🎯 2. Évaluation de vos acquis
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">Pensez-vous avoir progressé ?</Label>
            <div className="space-y-2">
              {['Oui, beaucoup', 'Oui, un peu', 'Peu', 'Pas du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.progression === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.progression === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Domaines d'amélioration :</Label>
            <div className="space-y-2">
              {['Compréhension orale', 'Expression orale', 'Compréhension écrite', 'Expression écrite'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="checkbox" checked={q.domaines_amelioration?.includes(option)} readOnly className="w-4 h-4 questionnaire-checkbox" />
                  <span className={q.domaines_amelioration?.includes(option) ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Plus à l'aise professionnellement ?</Label>
            <div className="space-y-2">
              {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.aise_professionnel === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.aise_professionnel === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Points à renforcer :</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.points_renforcer || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Objectifs atteints ?</Label>
            <div className="space-y-2">
              {['Oui totalement', 'Partiellement', 'Non encore', 'Non du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.objectifs_atteints === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.objectifs_atteints === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Appréciation */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            💬 3. Appréciation de la formation
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">Contenu adapté ?</Label>
            <div className="space-y-2">
              {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.contenu_adapte === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.contenu_adapte === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Évaluation globale :</Label>
            <div className="space-y-2">
              {['⭐ Excellent', '⭐ Bon', '⭐ Moyen', '⭐ Insatisfaisant'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.evaluation_globale === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.evaluation_globale === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Recommandation :</Label>
            <div className="flex gap-4">
              {['Oui', 'Non', 'Peut-être'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" checked={q.recommandation === option} readOnly className="w-4 h-4 questionnaire-radio" />
                  <span className={q.recommandation === option ? 'text-pink-700 font-semibold' : ''}>{option}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Perspectives */}
      <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
            🧩 4. Perspectives et suite du parcours
          </h4>
          <div className="space-y-2">
            <Label className="text-gray-900">Utilisation des nouvelles compétences :</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.utilisation_competences || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-900">Formation complémentaire ?</Label>
            <p className="text-pink-700 font-semibold bg-white p-3 rounded-md border-2 border-pink-200">
              {q.formation_complementaire || '—'} {q.formation_complementaire_details && `- ${q.formation_complementaire_details}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      {q.signature && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="pt-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4">✍️ 5. Validation</h4>
            <Label className="text-gray-900">Signature du stagiaire (horodatée)</Label>
            <div className="bg-white p-4 rounded-lg border-2 border-gray-300 mt-2">
              <img src={q.signature} alt="Signature" className="max-h-32 mx-auto" />
            </div>
            <p className="text-sm text-gray-600 italic mt-2 text-center font-semibold">
              ✓ Signé le {formatDateTime(q.submitted_at)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    );
  }

  // ============================================================================
  // FONCTIONS DE RENDU POUR QUESTIONNAIRES BUREAUTIQUE
  // ============================================================================
  
  function renderBureautiqueFormationNeedsDetail(q) {
    return (
      <div className="space-y-6">
        {/* Section 1: Identification */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              1. Identification
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-900">Date</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.date || '—'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Nom et prénom</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.nom_prenom || '—'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900">Parcours - Niveau</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.parcours_niveau || '—'}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900">Situation professionnelle</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.situation_professionnelle || '—'}</p>
            </div>

            {q.poste_actuel && (
              <div className="space-y-2">
                <Label className="text-gray-900">Intitulé du poste</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.poste_actuel}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-900">Contexte de travail principal</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">
                {q.contexte_travail || '—'} {q.contexte_travail_autre && `(${q.contexte_travail_autre})`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Contexte et objectifs */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              2. Contexte et objectifs de la formation
            </h4>
            
            <div className="space-y-2">
              <Label className="text-gray-900">Dans quel cadre avez-vous besoin de la bureautique ?</Label>
              <div className="space-y-2">
                {[
                  {key: 'besoin_rediger', label: 'Rédiger des documents'},
                  {key: 'besoin_tableaux', label: 'Faire des tableaux et calculs'},
                  {key: 'besoin_presentations', label: 'Faire des présentations'},
                  {key: 'besoin_messagerie', label: 'Gérer messagerie et agenda'},
                  {key: 'besoin_collaborer', label: 'Collaborer à distance'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.besoin_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.besoin_autre}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900">Pourquoi souhaitez-vous suivre cette formation ?</Label>
              <div className="space-y-2">
                {[
                  {key: 'raison_autonomie', label: 'Gagner en autonomie'},
                  {key: 'raison_temps', label: 'Gagner du temps'},
                  {key: 'raison_employeur', label: 'Demande de l\'employeur'},
                  {key: 'raison_evolution', label: 'Préparer une évolution'},
                  {key: 'raison_certification', label: 'Obtenir une certification'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.raison_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.raison_autre}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900">Objectifs principaux</Label>
              <div className="space-y-2">
                {[
                  {key: 'objectif_word', label: 'Mieux maîtriser Word'},
                  {key: 'objectif_excel', label: 'Mieux maîtriser Excel'},
                  {key: 'objectif_powerpoint', label: 'Mieux maîtriser PowerPoint'},
                  {key: 'objectif_mail', label: 'Organiser boîte mail et agenda'},
                  {key: 'objectif_fichiers', label: 'Mieux gérer les fichiers'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.objectif_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.objectif_autre}</p>
                )}
              </div>
            </div>

            {q.attentes_fin_formation && (
              <div className="space-y-2">
                <Label className="text-gray-900">Qu'attendez-vous à la fin de la formation ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.attentes_fin_formation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Auto-évaluation */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              3. Auto-évaluation des compétences bureautiques
            </h4>
            
            <div className="space-y-2">
              <Label className="text-gray-900">Outils utilisés actuellement</Label>
              <div className="space-y-2">
                {[
                  {key: 'outils_word', label: 'Word ou équivalent'},
                  {key: 'outils_excel', label: 'Excel ou équivalent'},
                  {key: 'outils_powerpoint', label: 'PowerPoint ou équivalent'},
                  {key: 'outils_outlook', label: 'Outlook ou messagerie'},
                  {key: 'outils_visio', label: 'Outils de visioconférence'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.outils_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.outils_autre}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-900 font-semibold">Niveau perçu (1 à 5)</Label>
              {[
                {key: 'niveau_word', label: 'Word'},
                {key: 'niveau_excel', label: 'Excel'},
                {key: 'niveau_powerpoint', label: 'PowerPoint'},
                {key: 'niveau_messagerie', label: 'Messagerie / agenda'},
                {key: 'niveau_fichiers', label: 'Gestion de fichiers'}
              ].map(({key, label}) => q[key] && (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-900">{label}:</span>
                  <span className="text-pink-700 font-bold text-lg bg-pink-50 px-4 py-2 rounded-md border-2 border-pink-200">{q[key]}/5</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Difficultés */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              4. Difficultés rencontrées
            </h4>
            
            <div className="space-y-2">
              <Label className="text-gray-900">Principales difficultés</Label>
              <div className="space-y-2">
                {[
                  {key: 'difficulte_temps', label: 'Je perds du temps à chercher des fonctions'},
                  {key: 'difficulte_mise_en_page', label: 'Mise en page des documents'},
                  {key: 'difficulte_formules', label: 'Formules dans les tableaux'},
                  {key: 'difficulte_graphiques', label: 'Graphiques'},
                  {key: 'difficulte_presentation', label: 'Présentations claires'},
                  {key: 'difficulte_mail', label: 'Organisation boîte mail'},
                  {key: 'difficulte_fichiers', label: 'Gestion des fichiers'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.difficulte_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.difficulte_autre}</p>
                )}
              </div>
            </div>

            {q.taches_precises && (
              <div className="space-y-2">
                <Label className="text-gray-900">Tâches à savoir faire</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.taches_precises}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Contraintes */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              5. Contraintes et modalités de formation
            </h4>
            
            {q.disponibilites && (
              <div className="space-y-2">
                <Label className="text-gray-900">Rythme souhaité</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.disponibilites}</p>
              </div>
            )}

            {q.format_prefere && (
              <div className="space-y-2">
                <Label className="text-gray-900">Format préféré</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.format_prefere}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-900">Matériel à disposition</Label>
              <div className="space-y-2">
                {[
                  {key: 'materiel_ordi_perso', label: 'Ordinateur personnel'},
                  {key: 'materiel_ordi_pro', label: 'Ordinateur professionnel'},
                  {key: 'materiel_internet', label: 'Connexion internet stable'},
                  {key: 'materiel_casque', label: 'Casque / micro'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.materiel_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.materiel_autre}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Handicap */}
        {q.handicap === "Oui" && (
          <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
                6. Situation de handicap et besoins spécifiques
              </h4>
              
              {q.handicap_details && (
                <div className="space-y-2">
                  <Label className="text-gray-900">Précisions</Label>
                  <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.handicap_details}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-gray-900">Aménagements souhaités</Label>
                <div className="space-y-2">
                  {[
                    {key: 'amenagement_temps', label: 'Temps supplémentaire'},
                    {key: 'amenagement_pauses', label: 'Pauses plus fréquentes'},
                    {key: 'amenagement_support', label: 'Support écrit adapté'},
                    {key: 'amenagement_visuelles', label: 'Explications visuelles'}
                  ].map(({key, label}) => (
                    <label key={key} className="flex items-center gap-2">
                      <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                      <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                    </label>
                  ))}
                  {q.amenagement_autre && (
                    <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.amenagement_autre}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        {q.signature && (
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="pt-6">
              <h4 className="text-lg font-bold text-gray-900 mb-4">✍️ Signature</h4>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-300 mt-2">
                <img src={q.signature} alt="Signature" className="max-h-32 mx-auto" />
              </div>
              <p className="text-sm text-gray-600 italic mt-2 text-center font-semibold">
                ✓ Signé le {formatDateTime(q.submitted_at)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderBureautiqueMidCourseDetail(q) {
    return (
      <div className="space-y-6">
        {/* Section 1: Identification */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              1. Identification
            </h4>
            <div className="space-y-2">
              <Label className="text-gray-900">Nom et prénom</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.nom_prenom || '—'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Date</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.date || '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Ressenti global */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              2. Ressenti global à mi-parcours
            </h4>
            {q.ressenti_global && (
              <div className="space-y-2">
                <Label className="text-gray-900">Comment ressentez-vous la formation ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.ressenti_global}</p>
              </div>
            )}
            {q.correspondance_demande && (
              <div className="space-y-2">
                <Label className="text-gray-900">Correspond à votre demande ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.correspondance_demande}</p>
              </div>
            )}
            {q.rythme && (
              <div className="space-y-2">
                <Label className="text-gray-900">Le rythme vous convient ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.rythme}</p>
              </div>
            )}
            {q.format_convient && (
              <div className="space-y-2">
                <Label className="text-gray-900">Le format vous convient ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.format_convient}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Progression */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              3. Progression perçue
            </h4>
            {q.progression && (
              <div className="space-y-2">
                <Label className="text-gray-900">Avez-vous progressé ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.progression}</p>
              </div>
            )}
            {q.outils_progres && q.outils_progres.length > 0 && (
              <div className="space-y-2">
                <Label className="text-gray-900">Outils sur lesquels vous progressez</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.outils_progres.join(', ')}</p>
              </div>
            )}
            {q.outils_progres_autre && (
              <div className="space-y-2">
                <Label className="text-gray-900">Autre outil</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.outils_progres_autre}</p>
              </div>
            )}
            {q.exemple_tache && (
              <div className="space-y-2">
                <Label className="text-gray-900">Exemple de tâche mieux maîtrisée</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.exemple_tache}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Difficultés */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              4. Difficultés actuelles
            </h4>
            {q.rencontre_difficultes && (
              <div className="space-y-2">
                <Label className="text-gray-900">Rencontrez-vous des difficultés ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.rencontre_difficultes}</p>
              </div>
            )}
            {q.rencontre_difficultes === "Oui" && (
              <div className="space-y-2">
                <Label className="text-gray-900">Lesquelles ?</Label>
                <div className="space-y-2">
                  {[
                    {key: 'difficultes_mise_en_page', label: 'Mise en page'},
                    {key: 'difficultes_formules', label: 'Formules Excel'},
                    {key: 'difficultes_filtres', label: 'Filtres / tris / graphiques'},
                    {key: 'difficultes_diaporama', label: 'Diaporama cohérent'},
                    {key: 'difficultes_mails', label: 'Gestion des mails'},
                    {key: 'difficultes_fichiers', label: 'Organisation des fichiers'}
                  ].map(({key, label}) => (
                    <label key={key} className="flex items-center gap-2">
                      <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                      <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                    </label>
                  ))}
                  {q.difficultes_autre && (
                    <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.difficultes_autre}</p>
                  )}
                </div>
              </div>
            )}
            {q.point_approfondir && (
              <div className="space-y-2">
                <Label className="text-gray-900">Point à approfondir</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.point_approfondir}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Ajustements */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              5. Ajustements souhaités
            </h4>
            <div className="space-y-2">
              <Label className="text-gray-900">Suggestions</Label>
              <div className="space-y-2">
                {[
                  {key: 'suggestion_ralentir', label: 'Ralentir le rythme'},
                  {key: 'suggestion_accelerer', label: 'Accélérer le rythme'},
                  {key: 'suggestion_exercices', label: 'Plus d\'exercices pratiques'},
                  {key: 'suggestion_explications', label: 'Plus d\'explications'},
                  {key: 'suggestion_plus_temps_word', label: 'Plus de temps sur Word'},
                  {key: 'suggestion_plus_temps_excel', label: 'Plus de temps sur Excel'},
                  {key: 'suggestion_plus_temps_powerpoint', label: 'Plus de temps sur PowerPoint'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.suggestion_plus_temps_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre logiciel: {q.suggestion_plus_temps_autre}</p>
                )}
                {q.suggestion_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre suggestion: {q.suggestion_autre}</p>
                )}
              </div>
            </div>
            {q.accompagnement_suffisant && (
              <div className="space-y-2">
                <Label className="text-gray-900">Accompagnement suffisant ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.accompagnement_suffisant}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signature */}
        {q.signature && (
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="pt-6">
              <h4 className="text-lg font-bold text-gray-900 mb-4">✍️ Signature</h4>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-300 mt-2">
                <img src={q.signature} alt="Signature" className="max-h-32 mx-auto" />
              </div>
              <p className="text-sm text-gray-600 italic mt-2 text-center font-semibold">
                ✓ Signé le {formatDateTime(q.submitted_at)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderBureautiqueEndCourseDetail(q) {
    return (
      <div className="space-y-6">
        {/* Section 1: Identification */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              1. Identification
            </h4>
            <div className="space-y-2">
              <Label className="text-gray-900">Nom et prénom</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.nom_prenom || '—'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Date de fin de formation</Label>
              <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.date_fin || '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Progression */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              2. Progression perçue
            </h4>
            {q.progression_globale && (
              <div className="space-y-2">
                <Label className="text-gray-900">Progression globale en bureautique</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.progression_globale}</p>
              </div>
            )}
            <div className="space-y-3">
              <Label className="text-gray-900 font-semibold">Progression par outil</Label>
              {[
                {key: 'progression_word', label: 'Word'},
                {key: 'progression_excel', label: 'Excel'},
                {key: 'progression_powerpoint', label: 'PowerPoint'},
                {key: 'progression_messagerie', label: 'Messagerie / agenda'},
                {key: 'progression_fichiers', label: 'Organisation fichiers'}
              ].map(({key, label}) => q[key] && (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-900">{label}:</span>
                  <span className="text-pink-700 font-bold bg-pink-50 px-4 py-2 rounded-md border-2 border-pink-200">{q[key]}</span>
                </div>
              ))}
            </div>
            {q.exemple_tache_maitrisee && (
              <div className="space-y-2">
                <Label className="text-gray-900">Exemple de tâche mieux maîtrisée</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.exemple_tache_maitrisee}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Objectifs */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              3. Atteinte des objectifs
            </h4>
            {q.objectifs_atteints && (
              <div className="space-y-2">
                <Label className="text-gray-900">Objectifs atteints ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.objectifs_atteints}</p>
              </div>
            )}
            {q.objectif_1 && (
              <div className="space-y-2">
                <Label className="text-gray-900">Objectif 1</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.objectif_1}</p>
                {q.resultat_objectif_1 && (
                  <p className="text-sm text-pink-600 font-semibold">→ Résultat: {q.resultat_objectif_1}</p>
                )}
              </div>
            )}
            {q.objectif_2 && (
              <div className="space-y-2">
                <Label className="text-gray-900">Objectif 2</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.objectif_2}</p>
                {q.resultat_objectif_2 && (
                  <p className="text-sm text-pink-600 font-semibold">→ Résultat: {q.resultat_objectif_2}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Satisfaction */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              4. Satisfaction globale
            </h4>
            {q.evaluation_formation && (
              <div className="space-y-2">
                <Label className="text-gray-900">Évaluation de la formation</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.evaluation_formation}</p>
              </div>
            )}
            {q.contenu_adapte && (
              <div className="space-y-2">
                <Label className="text-gray-900">Contenu adapté ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.contenu_adapte}</p>
              </div>
            )}
            {q.rythme_formation && (
              <div className="space-y-2">
                <Label className="text-gray-900">Rythme de la formation</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.rythme_formation}</p>
              </div>
            )}
            {q.pedagogie_formateur && (
              <div className="space-y-2">
                <Label className="text-gray-900">Pédagogie et accompagnement</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.pedagogie_formateur}</p>
              </div>
            )}
            {q.recommandation && (
              <div className="space-y-2">
                <Label className="text-gray-900">Recommanderiez-vous cette formation ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.recommandation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Utilité */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              5. Utilité pour votre activité
            </h4>
            <div className="space-y-2">
              <Label className="text-gray-900">La formation vous aidera dans :</Label>
              <div className="space-y-2">
                {[
                  {key: 'utilite_poste', label: 'Votre poste actuel'},
                  {key: 'utilite_recherche', label: 'Votre recherche d\'emploi'},
                  {key: 'utilite_reconversion', label: 'Votre reconversion'},
                  {key: 'utilite_projet_perso', label: 'Un projet personnel'}
                ].map(({key, label}) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={q[key]} readOnly className="w-4 h-4 questionnaire-checkbox" />
                    <span className={q[key] ? 'text-pink-700 font-semibold' : ''}>{label}</span>
                  </label>
                ))}
                {q.utilite_autre && (
                  <p className="text-pink-700 font-semibold bg-pink-50 p-2 rounded-md border-2 border-pink-200">Autre: {q.utilite_autre}</p>
                )}
              </div>
            </div>
            {q.utilisation_competences && (
              <div className="space-y-2">
                <Label className="text-gray-900">Comment utiliserez-vous vos nouvelles compétences ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.utilisation_competences}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 6: Amélioration */}
        <Card className="border-2 border-[#8B5A2B]/20 bg-gray-50">
          <CardContent className="pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-900 border-b-2 border-[#8B5A2B]/30 pb-2">
              6. Pistes d'amélioration
            </h4>
            {q.point_approfondir && (
              <div className="space-y-2">
                <Label className="text-gray-900">Point à approfondir davantage</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.point_approfondir}</p>
              </div>
            )}
            {q.suggestions_amelioration && (
              <div className="space-y-2">
                <Label className="text-gray-900">Suggestions d'amélioration</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200 whitespace-pre-wrap">{q.suggestions_amelioration}</p>
              </div>
            )}
            {q.formation_suivante && (
              <div className="space-y-2">
                <Label className="text-gray-900">Formation suivante ?</Label>
                <p className="text-pink-700 font-semibold bg-pink-50 p-3 rounded-md border-2 border-pink-200">{q.formation_suivante}</p>
                {q.theme_suivant && (
                  <p className="text-sm text-pink-600 font-semibold">→ Thème: {q.theme_suivant}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signature */}
        {q.signature && (
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="pt-6">
              <h4 className="text-lg font-bold text-gray-900 mb-4">✍️ Signature</h4>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-300 mt-2">
                <img src={q.signature} alt="Signature" className="max-h-32 mx-auto" />
              </div>
              <p className="text-sm text-gray-600 italic mt-2 text-center font-semibold">
                ✓ Signé le {formatDateTime(q.submitted_at)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Vue liste des questionnaires
  return (
    <>
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-br from-[#8B5A2B] via-[#7A4F26] to-[#6B4522] text-white flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-lg">Documents bénéficiaires</h4>
            <p className="text-sm opacity-90 mt-1">Questionnaires et documents soumis par l'élève</p>
          </div>
          
          {/* Bouton magique "Générer le Bilan Élève" */}
          <Button
            onClick={handleGenerateBilan}
            disabled={!formationNeedsQ || !midCourseQ || !endCourseQ || downloading}
            className={`
              ${formationNeedsQ && midCourseQ && endCourseQ 
                ? 'bg-gradient-to-r from-[#E8F5E9] to-[#C8E6C9] text-gray-800 hover:from-[#C8E6C9] hover:to-[#A5D6A7] border-2 border-green-300' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              }
              font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-200 whitespace-nowrap
              ${formationNeedsQ && midCourseQ && endCourseQ ? 'hover:scale-105 hover:shadow-lg' : ''}
            `}
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                🪄 Générer le Bilan Élève
              </>
            )}
          </Button>
        </div>

        {/* Questionnaire 1 : Besoins en formation */}
        {formationNeedsQ && (
          <Card className="border-2 border-[#8B5A2B]/20 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <FileText className="w-12 h-12 text-[#8B5A2B]" />
                  <div className="flex-1">
                    <h5 className="font-bold text-lg text-gray-900">1) Questionnaire de besoin en formation</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      👤 Bénéficiaire : <span className="font-medium">{studentName}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      📅 Soumis le {formatDateTime(formationNeedsQ.submitted_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => {
                      setSelectedQuestionnaire(formationNeedsQ);
                      setSelectedType('formation-needs');
                    }}
                    className="bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
                  >
                    Consulter →
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadQuestionnaire('formation-needs');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEmailQuestionnaire('formation-needs');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Envoyer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questionnaire 2 : À mi-parcours */}
        {midCourseQ && (
          <Card className="border-2 border-[#8B5A2B]/20 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <FileText className="w-12 h-12 text-[#8B5A2B]" />
                  <div className="flex-1">
                    <h5 className="font-bold text-lg text-gray-900">2) Questionnaire à mi-parcours</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      👤 Bénéficiaire : <span className="font-medium">{studentName}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      📅 Soumis le {formatDateTime(midCourseQ.submitted_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => {
                      setSelectedQuestionnaire(midCourseQ);
                      setSelectedType('mid-course');
                    }}
                    className="bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
                  >
                    Consulter →
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadQuestionnaire('mid-course');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEmailQuestionnaire('mid-course');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Envoyer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questionnaire 3 : Fin de formation */}
        {endCourseQ && (
          <Card className="border-2 border-[#8B5A2B]/20 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <FileText className="w-12 h-12 text-[#8B5A2B]" />
                  <div className="flex-1">
                    <h5 className="font-bold text-lg text-gray-900">3) Questionnaire de fin de formation</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      👤 Bénéficiaire : <span className="font-medium">{studentName}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      📅 Soumis le {formatDateTime(endCourseQ.submitted_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => {
                      setSelectedQuestionnaire(endCourseQ);
                      setSelectedType('end-course');
                    }}
                    className="bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
                  >
                    Consulter →
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadQuestionnaire('end-course');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEmailQuestionnaire('end-course');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Envoyer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Modal d'envoi par email */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#8B5A2B]">
              Envoyer le questionnaire par email
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="emailTo" className="text-base font-semibold">
                Destinataire(s) <span className="text-red-600">*</span>
              </Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="exemple@email.com, autre@email.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="h-12 text-base border-2 border-[#8B5A2B]/30"
              />
              <p className="text-sm text-gray-600 italic">
                💡 Séparez plusieurs emails par des virgules
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailSubject" className="text-base font-semibold">
                Objet de l'email
              </Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-12 text-base border-2 border-[#8B5A2B]/30"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailBody" className="text-base font-semibold">
                Message
              </Label>
              <textarea
                id="emailBody"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                className="w-full border-2 border-[#8B5A2B]/30 rounded-lg px-4 py-3 text-base"
                placeholder="Votre message personnalisé..."
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowEmailModal(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
              
              <Button
                onClick={handleSendEmail}
                disabled={sending || !emailTo.trim()}
                className="flex-1 bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Composant principal de la modale
export default function ParcoursEleveModal({ open, onOpenChange, student }) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCategory, setEmailCategory] = useState('');
  const [emailStudentId, setEmailStudentId] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleOpenEmailModal = (category, studentId) => {
    const categoryTitles = {
      'positionnement': 'Test de positionnement',
      'evaluation_cours': 'Évaluations en cours de formation',
      'evaluation_fin': 'Évaluations de fin de formation'
    };
    const categoryLabel = categoryTitles[category] || category;
    
    setEmailCategory(category);
    setEmailStudentId(studentId);
    setEmailSubject(`${categoryLabel} - Synthèse`);
    setEmailBody(`Bonjour,\n\nVeuillez trouver ci-joint le document de synthèse "${categoryLabel}".\n\nCordialement,`);
    setShowEmailModal(true);
  };

  const handlePreviewPdf = async () => {
    try {
      setGeneratingPdf(true);
      console.log('[PDF Preview] Starting PDF generation...');
      
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/pdf/preview?student_id=${emailStudentId}&category=${emailCategory}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob',
          timeout: 30000 // 30 secondes timeout
        }
      );
      
      console.log('[PDF Preview] PDF received, size:', response.data.size, 'bytes');
      console.log('[PDF Preview] Content-Type:', response.headers['content-type']);
      
      // Vérifier que c'est bien un PDF
      if (!response.data.type.includes('pdf') && !response.headers['content-type']?.includes('pdf')) {
        throw new Error('Le fichier reçu n\'est pas un PDF valide');
      }
      
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const pdfUrl = window.URL.createObjectURL(pdfBlob);
      
      console.log('[PDF Preview] Blob URL created:', pdfUrl);
      
      // STRATÉGIE 1: Tenter l'iframe avec détection de timeout
      let iframeLoaded = false;
      let iframeTimeout;
      
      const iframeLoadPromise = new Promise((resolve, reject) => {
        iframeTimeout = setTimeout(() => {
          if (!iframeLoaded) {
            console.warn('[PDF Preview] Iframe timeout (2s)');
            reject(new Error('Iframe timeout'));
          }
        }, 2000); // Timeout de 2 secondes
        
        // Marquer comme succès si on arrive ici
        resolve();
      });
      
      try {
        setPdfPreviewUrl(pdfUrl);
        setShowPreview(true);
        
        // Attendre un court instant pour voir si l'iframe se charge
        await iframeLoadPromise;
        
        iframeLoaded = true;
        clearTimeout(iframeTimeout);
        toast.success("Aperçu du PDF chargé");
        console.log('[PDF Preview] Iframe preview loaded successfully');
      } catch (iframeError) {
        clearTimeout(iframeTimeout);
        console.warn('[PDF Preview] Iframe failed, trying new tab...', iframeError);
        
        // Fermer la preview iframe si elle était ouverte
        setShowPreview(false);
        setPdfPreviewUrl('');
        
        // STRATÉGIE 2: Nouvel onglet
        try {
          const newTab = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
          if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
            throw new Error('Pop-up bloqué');
          }
          toast.info("Aperçu intégré indisponible. Ouverture dans un nouvel onglet.");
          console.log('[PDF Preview] Opened in new tab');
        } catch (tabError) {
          console.warn('[PDF Preview] New tab failed, downloading...', tabError);
          
          // STRATÉGIE 3: Download fallback
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = `${emailCategory}_apercu.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.info("Aperçu intégré indisponible. Téléchargement en cours.");
          console.log('[PDF Preview] Downloaded as fallback');
        }
      }
    } catch (error) {
      console.error('[PDF Preview] Error:', error);
      console.error('[PDF Preview] Stack:', error.stack);
      
      let errorMessage = "Erreur lors de la génération de l'aperçu";
      if (error.code === 'ECONNABORTED') {
        errorMessage = "Timeout: la génération du PDF prend trop de temps";
      } else if (error.response) {
        errorMessage = `Erreur serveur: ${error.response.status} - ${error.response.data?.detail || error.response.statusText}`;
      } else if (error.request) {
        errorMessage = "Pas de réponse du serveur";
      } else {
        errorMessage = error.message || "Erreur inconnue";
      }
      
      toast.error(errorMessage);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast.error("Veuillez saisir au moins un destinataire");
      return;
    }
    
    try {
      setGeneratingPdf(true);
      
      const token = localStorage.getItem('token');
      
      // Envoyer le PDF par email via le backend
      const response = await axios.post(
        `${API}/students/${emailStudentId}/category-notes/${emailCategory}/send-by-email`,
        {
          to: emailTo,
          subject: emailSubject,
          body: emailBody
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      toast.success(`Email envoyé avec succès à ${emailTo} !`);
      
      // Nettoyer
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl('');
      }
      setShowPreview(false);
      setShowEmailModal(false);
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
    } catch (error) {
      console.error("Error sending email:", error);
      let errorMessage = "Erreur lors de l'envoi de l'email";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      toast.error(errorMessage);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#8B5A2B]">
            Parcours élève — {student.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tests" className="w-full">
          <TabsList className="gap-2 bg-[#F4EAE3] p-2 rounded-xl w-full grid grid-cols-3">
            <TabsTrigger 
              value="tests" 
              className="data-[state=active]:bg-[#8B5A2B] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-[#8B5A2B] data-[state=inactive]:border data-[state=inactive]:border-[#8B5A2B]/30 font-medium rounded-lg transition-all"
            >
              Tests et évaluation
            </TabsTrigger>
            <TabsTrigger 
              value="supports" 
              className="data-[state=active]:bg-[#8B5A2B] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-[#8B5A2B] data-[state=inactive]:border data-[state=inactive]:border-[#8B5A2B]/30 font-medium rounded-lg transition-all"
            >
              Supports de formation
            </TabsTrigger>
            <TabsTrigger 
              value="beneficiaire"
              className="data-[state=active]:bg-[#8B5A2B] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-[#8B5A2B] data-[state=inactive]:border data-[state=inactive]:border-[#8B5A2B]/30 font-medium rounded-lg transition-all"
            >
              Documents bénéficiaires
            </TabsTrigger>
          </TabsList>

          {/* Onglet Tests et évaluation - Layout HORIZONTAL (3 colonnes) */}
          <TabsContent value="tests" className="mt-6">
            {/* Sections upload PDF - UNIQUEMENT pour le parcours Anglais */}
            {student.parcours === "Anglais" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* 1A - Test de positionnement */}
                <UploadSectionWithNote
                  studentId={student.id}
                  category="positionnement"
                  title="Test de positionnement"
                  buttonText="Cliquez ici pour télécharger le test de positionnement"
                  showNote={true}
                  onOpenEmailModal={handleOpenEmailModal}
                />

                {/* 2A - Évaluations en cours de formation */}
                <UploadSectionWithNote
                  studentId={student.id}
                  category="evaluation_cours"
                  title="Évaluations en cours de formation"
                  buttonText="Cliquez ici pour télécharger les évaluations en cours de formation"
                  showNote={true}
                  onOpenEmailModal={handleOpenEmailModal}
                />

                {/* 3A - Évaluations de fin de formation */}
                <UploadSectionWithNote
                  studentId={student.id}
                  category="evaluation_fin"
                  title="Évaluations de fin de formation"
                  buttonText="Cliquez ici pour télécharger les évaluations de fin de formation"
                  showNote={true}
                  onOpenEmailModal={handleOpenEmailModal}
                />
              </div>
            )}

            {/* Tests interactifs - Affichage pour TOUS les parcours */}
            <InteractiveTestsDisplaySection studentId={student.id} />
            
            {/* Section Rapport d'évolution (3 boutons) */}
            <MagicReportSection studentId={student.id} studentName={student.name} />
          </TabsContent>

          {/* Onglet Supports de formation - Pleine largeur (pas de note) */}
          <TabsContent value="supports" className="mt-6">
            <div className="max-w-4xl mx-auto">
              <UploadSectionWithNote
                studentId={student.id}
                category="support"
                title="Supports de formation"
                buttonText="Cliquez ici pour télécharger un support de formation"
                showNote={false}
              />
            </div>
          </TabsContent>

          {/* Onglet Documents bénéficiaires - Affichage des questionnaires soumis */}
          <TabsContent value="beneficiaire" className="mt-6">
            <BeneficiaryDocumentsTab studentId={student.id} studentName={student.name} student={student} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Modale d'envoi par email - AU MÊME NIVEAU que la modale principale */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-[#8B5A2B]">
              Transmettre par email
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            {/* Destinataire */}
            <div className="space-y-3">
              <Label htmlFor="emailTo" className="text-base font-semibold text-gray-900">
                Destinataire(s) <span className="text-red-600">*</span>
              </Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="exemple@email.com, autre@email.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="h-12 text-base border-2 border-[#8B5A2B]/30 focus:border-[#8B5A2B] rounded-lg px-4"
              />
              <p className="text-sm text-gray-600 italic">
                💡 Séparez plusieurs emails par des virgules
              </p>
            </div>
            
            {/* Objet */}
            <div className="space-y-3">
              <Label htmlFor="emailSubject" className="text-base font-semibold text-gray-900">
                Objet de l'email
              </Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-12 text-base border-2 border-[#8B5A2B]/30 focus:border-[#8B5A2B] rounded-lg px-4"
              />
            </div>
            
            {/* Message */}
            <div className="space-y-3">
              <Label htmlFor="emailBody" className="text-base font-semibold text-gray-900">
                Message
              </Label>
              <textarea
                id="emailBody"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                className="w-full border-2 border-[#8B5A2B]/30 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#8B5A2B]/50 focus:border-[#8B5A2B]"
                placeholder="Votre message personnalisé..."
              />
            </div>
            
            {/* Aperçu du PDF - SUPPRIMÉ */}
            {false && showPreview && pdfPreviewUrl && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#8B5A2B]">
                  Aperçu du document
                </Label>
                <div className="border-2 border-[#8B5A2B]/30 rounded-lg overflow-hidden bg-gray-50">
                  <iframe
                    src={pdfPreviewUrl}
                    className="w-full h-96 border-0"
                    title="Aperçu PDF"
                    onLoad={() => {
                      console.log('[PDF Preview] Iframe loaded successfully');
                    }}
                    onError={(e) => {
                      console.error('[PDF Preview] Iframe error:', e);
                      toast.warning("Impossible d'afficher l'aperçu intégré.");
                      
                      // Fallback: ouvrir dans nouvel onglet
                      const newTab = window.open(pdfPreviewUrl, '_blank', 'noopener,noreferrer');
                      if (newTab && !newTab.closed) {
                        toast.info("Ouverture dans un nouvel onglet...");
                      } else {
                        // Si pop-up bloqué, forcer le téléchargement
                        const link = document.createElement('a');
                        link.href = pdfPreviewUrl;
                        link.download = `${emailCategory}_apercu.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.info("Téléchargement en cours...");
                      }
                      
                      // Fermer la preview
                      setShowPreview(false);
                    }}
                    sandbox="allow-same-origin allow-scripts allow-downloads"
                  />
                </div>
                <p className="text-xs text-gray-500 italic">
                  💡 Si l'aperçu ne s'affiche pas, il s'ouvrira automatiquement dans un nouvel onglet ou se téléchargera
                </p>
              </div>
            )}
            
            <div className="flex flex-col gap-3 pt-6">
              {/* Bouton Annuler */}
              <Button
                onClick={() => {
                  setShowEmailModal(false);
                  setShowPreview(false);
                  if (pdfPreviewUrl) {
                    window.URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl('');
                  }
                }}
                variant="outline"
                className="w-full py-3 text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                Annuler
              </Button>
              
              {/* Bouton Transmettre par email */}
              <Button
                onClick={handleSendEmail}
                disabled={generatingPdf || !emailTo.trim()}
                className="w-full py-3 bg-[#8B5A2B] hover:bg-[#7A4F26] text-white font-semibold"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Transmettre par email
                  </>
                )}
              </Button>
              
              {/* Bouton Télécharger PDF - vert plein */}
              <Button
                onClick={async () => {
                  try {
                    setGeneratingPdf(true);
                    const token = localStorage.getItem('token');
                    
                    // Utiliser directement student.name depuis les props
                    const studentName = student?.name || 'eleve';
                    
                    const response = await axios.get(
                      `${API}/pdf/preview?student_id=${emailStudentId}&category=${emailCategory}`,
                      {
                        headers: { 'Authorization': `Bearer ${token}` },
                        responseType: 'blob'
                      }
                    );
                    
                    const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
                    const pdfUrl = window.URL.createObjectURL(pdfBlob);
                    
                    // Nom du fichier : NOM_ELEVE_test_de_positionnement.pdf
                    const categoryNames = {
                      'positionnement': 'test_de_positionnement',
                      'evaluation_cours': 'evaluations_cours_formation',
                      'evaluation_fin': 'evaluations_fin_formation'
                    };
                    const fileName = `${studentName.replace(/\s+/g, '_')}_${categoryNames[emailCategory] || emailCategory}.pdf`;
                    
                    // Télécharger le PDF
                    const link = document.createElement('a');
                    link.href = pdfUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Nettoyer
                    window.URL.revokeObjectURL(pdfUrl);
                    
                    toast.success("PDF téléchargé !");
                  } catch (error) {
                    console.error("Error downloading PDF:", error);
                    toast.error("Erreur lors du téléchargement");
                  } finally {
                    setGeneratingPdf(false);
                  }
                }}
                disabled={generatingPdf}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Télécharger le PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
