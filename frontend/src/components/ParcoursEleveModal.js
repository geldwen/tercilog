import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Download, Trash2, FileText, Image as ImageIcon, FileSpreadsheet, Loader2, Mail } from "lucide-react";
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

// Composant pour une section d'upload avec note GLOBALE par catégorie
function UploadSectionWithNote({ studentId, category, title, buttonText, showNote = false, onOpenEmailModal }) {
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
      
      // Si le PDF est déjà en preview, on le réutilise, sinon on le génère
      let pdfUrl = pdfPreviewUrl;
      
      if (!pdfUrl) {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${API}/pdf/preview?student_id=${emailStudentId}&category=${emailCategory}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'blob'
          }
        );
        
        const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
        pdfUrl = window.URL.createObjectURL(pdfBlob);
      }
      
      // Télécharger le PDF
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.setAttribute('download', `${emailCategory}_synthese.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Ouvrir le client email
      const mailtoLink = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody + '\n\n(Veuillez attacher le PDF téléchargé)')}`;
      window.location.href = mailtoLink;
      
      toast.success("PDF téléchargé et client email ouvert !");
      
      // Nettoyer
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl('');
      }
      setShowPreview(false);
      setShowEmailModal(false);
      setEmailTo('');
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
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
          <TabsList className="gap-2 bg-[#F4EAE3] p-2 rounded-xl w-full grid grid-cols-2">
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
          </TabsList>

          {/* Onglet Tests et évaluation - Layout HORIZONTAL (3 colonnes) */}
          <TabsContent value="tests" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        </Tabs>
      </DialogContent>

      {/* Modale d'envoi par email - AU MÊME NIVEAU que la modale principale */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#8B5A2B]">
              Transmettre par email
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailTo" className="text-sm font-medium">
                Destinataire(s) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="exemple@email.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="border-[#8B5A2B]/30 focus:border-[#8B5A2B]"
              />
              <p className="text-xs text-gray-500">
                Séparez plusieurs emails par des virgules
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailSubject" className="text-sm font-medium">
                Objet
              </Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="border-[#8B5A2B]/30 focus:border-[#8B5A2B]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailBody" className="text-sm font-medium">
                Message
              </Label>
              <textarea
                id="emailBody"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full border border-[#8B5A2B]/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A2B]/50"
              />
            </div>
            
            {/* Aperçu du PDF */}
            {showPreview && pdfPreviewUrl && (
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
            
            <div className="flex justify-between gap-2 pt-4">
              <div className="flex gap-2">
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
                  className="text-[#8B5A2B] border-[#8B5A2B]/30"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handlePreviewPdf}
                  disabled={generatingPdf}
                  variant="outline"
                  className="text-[#8B5A2B] border-[#8B5A2B]/30"
                >
                  {generatingPdf && !showPreview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      {showPreview ? 'Actualiser' : 'Aperçu'}
                    </>
                  )}
                </Button>
              </div>
              
              <Button
                onClick={handleSendEmail}
                disabled={generatingPdf || !emailTo.trim()}
                className="bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
              >
                {generatingPdf && showPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Envoyer
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
