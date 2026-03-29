import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, FolderOpen, Trophy, Globe, Lock } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TERCIFORM_BLUE = '#0D2040';

export default function GrammaireAnglais({ userId }) {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState({ "Les temps": true, "Général": false, "Vocabulaire": true });
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (userId) loadResources();
  }, [userId]);

  const loadResources = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/students/${userId}/pedagogical-resources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResources(res.data);
    } catch (e) {
      console.error('Erreur chargement ressources grammaire:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folder) => {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleDownload = async (resourceId, resourceName, isHtml) => {
    setDownloading(resourceId);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/students/${userId}/pedagogical-resources/${resourceId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      if (isHtml) {
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
        window.open(url, '_blank');
      } else {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${resourceName}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.success(`${resourceName} téléchargé !`);
      }
    } catch (e) {
      if (e.response?.status === 403) {
        toast.error("Ce fichier est verrouillé par votre formateur");
      } else {
        toast.error("Erreur lors du téléchargement");
      }
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg border-2 border-indigo-200">
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-2 text-gray-500">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (!resources?.has_resources) return null;

  // Group supports by folder
  const allItems = [...(resources.supports || []), ...(resources.evaluations || [])];
  const folders = {};
  allItems.forEach(item => {
    const folder = item.folder || 'Autres';
    if (!folders[folder]) folders[folder] = [];
    folders[folder].push(item);
  });

  const folderConfig = {
    "Les temps": { icon: FolderOpen, color: "#7C3AED" },
    "Général": { icon: FolderOpen, color: "#2563EB" },
    "Vocabulaire": { icon: Globe, color: "#059669" },
  };

  const FolderHeader = ({ title, count }) => {
    const cfg = folderConfig[title] || { icon: FolderOpen, color: "#6B7280" };
    const Icon = cfg.icon;
    return (
      <button
        onClick={() => toggleFolder(title)}
        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
        data-testid={`folder-${title.toLowerCase().replace(/\s/g, '-')}`}
      >
        {openFolders[title] ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.color + '20' }}>
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <span className="font-semibold text-gray-800 text-sm">{title}</span>
        {count > 0 && (
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.color + '15', color: cfg.color }}>
            {count} fichier{count > 1 ? 's' : ''}
          </span>
        )}
      </button>
    );
  };

  const FileRow = ({ item }) => {
    const cfg = folderConfig[item.folder] || { color: "#6B7280" };
    const isVocab = item.is_html;
    const isLocked = !item.unlocked;

    if (isVocab && !isLocked) {
      return (
        <div className="ml-8 py-2">
          <button
            onClick={() => handleDownload(item.id, item.name, true)}
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
      );
    }

    return (
      <div
        className={`flex items-center justify-between py-2.5 px-4 ml-8 rounded-lg transition-colors border border-transparent ${
          isLocked ? 'opacity-50' : 'hover:bg-gray-50 hover:border-gray-200'
        }`}
        data-testid={`file-${item.id}`}
      >
        <div className="flex items-center gap-3">
          {isLocked ? (
            <Lock size={16} className="text-gray-400" />
          ) : (
            <FileText size={16} style={{ color: cfg.color }} />
          )}
          <div>
            <span className={`text-sm ${isLocked ? 'text-gray-400' : 'text-gray-700'}`}>{item.name}</span>
            {isLocked && (
              <p className="text-xs text-orange-500 mt-0.5">Verrouillé — en attente de déblocage par votre formateur</p>
            )}
            {item.unlocked && item.unlocked_at && (
              <p className="text-xs text-green-600 mt-0.5">
                Disponible depuis le {new Date(item.unlocked_at).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
        {isLocked ? (
          <div className="px-3 py-1 bg-gray-200 text-gray-400 rounded text-xs">Verrouillé</div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            style={{ borderColor: cfg.color, color: cfg.color }}
            onClick={() => handleDownload(item.id, item.name, item.is_html)}
            disabled={downloading === item.id}
            data-testid={`download-${item.id}`}
          >
            <Download size={14} className="mr-1" />
            {downloading === item.id ? '...' : 'Télécharger'}
          </Button>
        )}
      </div>
    );
  };

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
        {Object.entries(folders).map(([folderName, items]) => (
          <div key={folderName}>
            <FolderHeader title={folderName} count={items.length} />
            {openFolders[folderName] && (
              <div className="space-y-1 mb-3">
                {items.map(item => (
                  <FileRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
