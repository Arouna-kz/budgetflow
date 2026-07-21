import { supabase } from '../lib/supabase';
import { Attachment } from '../types';

// Nom du bucket Supabase Storage (à créer — voir SQL fourni)
const BUCKET = 'attachments';

// Nettoie le nom de fichier pour un chemin sûr
const sanitize = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);

/**
 * Téléverse un fichier physique dans Supabase Storage et renvoie ses métadonnées.
 * @param file    Le fichier à téléverser
 * @param folder  Sous-dossier logique (ex: 'engagements', 'payments', 'prefinancing', 'loans')
 */
export const uploadAttachment = async (file: File, folder: string): Promise<Attachment> => {
  if (!supabase) {
    throw new Error('Stockage indisponible (Supabase non configuré).');
  }
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${folder}/${stamp}_${rand}_${sanitize(file.name)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    id: `att-${stamp}-${rand}`,
    name: file.name,
    path,
    url: pub.publicUrl,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
  };
};

/**
 * Télécharge un fichier en conservant EXACTEMENT son nom d'origine, sans l'afficher.
 * On récupère le contenu en blob puis on déclenche un téléchargement local :
 * l'attribut `download` d'un lien est ignoré par les navigateurs pour les URLs
 * d'une autre origine (cas des URLs Supabase), d'où le passage par un blob.
 */
export const downloadAttachment = async (att: { url: string; name: string }): Promise<void> => {
  try {
    const res = await fetch(att.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch (e) {
    console.warn('Téléchargement direct impossible, ouverture dans un onglet:', e);
    // Repli : ouvrir dans un nouvel onglet (le navigateur gérera le téléchargement)
    window.open(att.url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Supprime un fichier du bucket (best-effort — n'interrompt pas le flux si échec).
 */
export const deleteAttachment = async (path: string): Promise<void> => {
  if (!supabase || !path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.warn('Suppression du fichier échouée:', e);
  }
};
