import React, { useRef, useState } from 'react';
import { Paperclip, Upload, Trash2, FileText, Download, Eye, Loader2 } from 'lucide-react';
import { Attachment } from '../types';
import { uploadAttachment, deleteAttachment, downloadAttachment } from '../services/storageService';
import { showError } from '../utils/alerts';

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

/**
 * 3 actions standard sur un fichier joint :
 *  1. Voir       → ouvre uniquement le contenu du fichier (nouvel onglet)
 *  2. Télécharger → enregistre le fichier avec son nom d'origine, sans l'afficher
 *  3. Supprimer  → retire le fichier (si onDelete fourni)
 */
export const AttachmentActions: React.FC<{
  attachment: Attachment;
  onDelete?: (att: Attachment) => void;
  compact?: boolean;
}> = ({ attachment, onDelete, compact }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAttachment(attachment);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <span className="flex items-center gap-1.5 flex-shrink-0">
      {/* 1. Voir le contenu */}
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Voir le contenu du fichier"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50"
      >
        <Eye className="w-4 h-4" />
        {!compact && <span className="hidden sm:inline">Voir</span>}
      </a>
      {/* 2. Télécharger avec le nom d'origine */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title="Télécharger le fichier (nom d'origine conservé)"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
      >
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {!compact && <span className="hidden sm:inline">Télécharger</span>}
      </button>
      {/* 3. Supprimer */}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(attachment)}
          title="Supprimer ce fichier"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-500 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          {!compact && <span className="hidden sm:inline">Supprimer</span>}
        </button>
      )}
    </span>
  );
};

interface FileUploaderProps {
  value: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  folder: string;               // sous-dossier de stockage
  label?: string;
  disabled?: boolean;
  helpText?: string;
  /** Autorise le retrait d'un fichier de la liste (bouton Supprimer). Défaut : true. */
  canRemove?: boolean;
}

/**
 * Zone de téléversement de fichiers physiques (optionnelle) — à placer dans les formulaires.
 */
export const FileUploader: React.FC<FileUploaderProps> = ({
  value = [],
  onChange,
  folder,
  label = 'Documents / proformas (optionnel)',
  disabled = false,
  helpText = 'Formats acceptés : PDF, images, Word, Excel. Plusieurs fichiers possibles.',
  canRemove = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) {
          showError('Fichier trop volumineux', `"${file.name}" dépasse 15 Mo et a été ignoré.`);
          continue;
        }
        uploaded.push(await uploadAttachment(file, folder));
      }
      if (uploaded.length) onChange([...(value || []), ...uploaded]);
    } catch (e: any) {
      console.error('Upload échoué:', e);
      showError('Échec du téléversement', e?.message || 'Impossible de téléverser le fichier. Vérifiez la configuration du stockage Supabase.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = async (att: Attachment) => {
    onChange((value || []).filter(a => a.id !== att.id));
    await deleteAttachment(att.path);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        <span className="text-sm font-medium">{uploading ? 'Téléversement…' : 'Ajouter un ou plusieurs fichiers'}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />
      {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}

      {value && value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map(att => (
            <li key={att.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 min-w-0 text-sm text-gray-700">
                <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
                <span className="truncate">{att.name}</span>
                {att.size ? <span className="text-xs text-gray-400 flex-shrink-0">({formatSize(att.size)})</span> : null}
              </span>
              <AttachmentActions attachment={att} onDelete={(disabled || !canRemove) ? undefined : removeAt} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Affichage des fichiers associés — à placer dans les vues « Détails ».
 * Chaque fichier propose : Voir · Télécharger · Supprimer (si onDelete fourni).
 */
export const AttachmentList: React.FC<{
  attachments?: Attachment[];
  title?: string;
  onDelete?: (att: Attachment) => void;
}> = ({ attachments = [], title = 'Documents associés', onDelete }) => {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div>
      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
        <Paperclip className="w-4 h-4 mr-2 text-blue-600" />
        {title} ({attachments.length})
      </h4>
      <ul className="space-y-2">
        {attachments.map(att => (
          <li key={att.id} className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <span className="flex items-center gap-2 min-w-0 text-sm text-gray-800">
              <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
              <span className="truncate">{att.name}</span>
              {att.size ? <span className="text-xs text-gray-400 flex-shrink-0">({formatSize(att.size)})</span> : null}
            </span>
            <AttachmentActions attachment={att} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </div>
  );
};
