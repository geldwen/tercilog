import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, FolderOpen, Trophy, Globe } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TERCIFORM_BLUE = '#0D2040';

const LES_TEMPS_FILES = [
  { id: "temps_1", name: "1) Les présents en anglais" },
  { id: "temps_2", name: "2) Les futurs en anglais" },
  { id: "temps_3", name: "3) Les passés en anglais" },
  { id: "temps_4", name: "4) Les modaux en anglais" },
];

const GENERAL_FILES = []; // Sera rempli avec les fichiers A-G

export default function GrammaireAnglais() {
  const [openFolders, setOpenFolders] = useState({ les_temps: true, general: false, vocabulaire: true });
  const [downloading, setDownloading] = useState(null);

  const toggleFolder = (folder) => {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleDownload = async (category, fileId, fileName) => {
    setDownloading(fileId);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/grammaire/${category}/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${fileName} téléchargé !`);
    } catch (e) {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloading(null);
    }
  };

  const handleOpenVocabulary = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/grammaire/vocabulaire/challenge`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
      window.open(url, '_blank');
    } catch (e) {
      toast.error("Erreur lors de l'ouverture du Vocabulary Challenge");
    }
  };

  const FolderHeader = ({ icon: Icon, title, folderKey, color, count }) => (
    <button
      onClick={() => toggleFolder(folderKey)}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
      data-testid={`folder-${folderKey}`}
    >
      {openFolders[folderKey] ? (
        <ChevronDown size={18} className="text-gray-400" />
      ) : (
        <ChevronRight size={18} className="text-gray-400" />
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ backgroundColor: color + '20' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <span className="font-semibold text-gray-800 text-sm">{title}</span>
      {count > 0 && (
        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '15', color }}>
          {count} fichier{count > 1 ? 's' : ''}
        </span>
      )}
    </button>
  );

  const FileRow = ({ file, category, color }) => (
    <div
      className="flex items-center justify-between py-2.5 px-4 ml-8 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
      data-testid={`file-${file.id}`}
    >
      <div className="flex items-center gap-3">
        <FileText size={16} style={{ color }} />
        <span className="text-sm text-gray-700">{file.name}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        style={{ borderColor: color, color }}
        onClick={() => handleDownload(category, file.id, file.name)}
        disabled={downloading === file.id}
        data-testid={`download-${file.id}`}
      >
        <Download size={14} className="mr-1" />
        {downloading === file.id ? '...' : 'Télécharger'}
      </Button>
    </div>
  );

  return (
    <Card className="shadow-lg border-2 border-indigo-200" data-testid="grammaire-anglais-card">
      <CardHeader style={{ backgroundColor: '#EDE9FE' }}>
        <CardTitle className="text-xl flex items-center gap-2" style={{ color: TERCIFORM_BLUE }}>
          <BookOpen size={24} />
          Grammaire Anglais
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Fiches de grammaire, exercices et ressources pour votre parcours Anglais
        </p>
      </CardHeader>
      <CardContent className="pt-4 space-y-1">

        {/* Dossier : Les temps */}
        <FolderHeader
          icon={FolderOpen}
          title="Les temps"
          folderKey="les_temps"
          color="#7C3AED"
          count={LES_TEMPS_FILES.length}
        />
        {openFolders.les_temps && (
          <div className="space-y-1 mb-3">
            {LES_TEMPS_FILES.map(file => (
              <FileRow key={file.id} file={file} category="les-temps" color="#7C3AED" />
            ))}
          </div>
        )}

        {/* Dossier : Général */}
        {GENERAL_FILES.length > 0 && (
          <>
            <FolderHeader
              icon={FolderOpen}
              title="Général"
              folderKey="general"
              color="#2563EB"
              count={GENERAL_FILES.length}
            />
            {openFolders.general && (
              <div className="space-y-1 mb-3">
                {GENERAL_FILES.map(file => (
                  <FileRow key={file.id} file={file} category="general" color="#2563EB" />
                ))}
              </div>
            )}
          </>
        )}
        {GENERAL_FILES.length === 0 && (
          <>
            <FolderHeader
              icon={FolderOpen}
              title="Général"
              folderKey="general"
              color="#2563EB"
              count={0}
            />
            {openFolders.general && (
              <div className="ml-8 py-3 px-4 text-sm text-gray-400 italic">
                Fichiers A-G bientôt disponibles...
              </div>
            )}
          </>
        )}

        {/* Dossier : Vocabulaire */}
        <FolderHeader
          icon={Globe}
          title="Vocabulaire"
          folderKey="vocabulaire"
          color="#059669"
          count={1}
        />
        {openFolders.vocabulaire && (
          <div className="ml-8 py-2">
            <button
              onClick={handleOpenVocabulary}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 transition-all hover:shadow-md w-full group"
              data-testid="vocabulary-challenge-btn"
            >
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Trophy size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-amber-800 text-sm">Vocabulary Challenge</p>
                <p className="text-xs text-amber-600">Testez votre vocabulaire anglais !</p>
              </div>
              <svg className="w-5 h-5 ml-auto text-amber-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
