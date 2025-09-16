import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérifier si les variables d'environnement Supabase sont disponibles
const hasSupabaseConfig = supabaseUrl && supabaseAnonKey;

if (!hasSupabaseConfig) {
  console.warn('Supabase environment variables not found, running in demo mode');
}

export const supabase = hasSupabaseConfig 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null as any; // Fallback pour le mode démo

// Helper function to handle Supabase errors
// Dans votre fichier supabase.ts
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  
  // Gestion spécifique des erreurs de contrainte d'unicité
  if (error.code === '23505') {
    const constraint = error.details?.constraint;
    
    switch (constraint) {
      case 'bank_accounts_account_number_key':
        throw new Error('Ce numéro de compte bancaire existe déjà');
      case 'users_email_key':
        throw new Error('Cet email est déjà utilisé');
      case 'grants_reference_key':
        throw new Error('Cette référence de subvention existe déjà');
      // Ajoutez d'autres contraintes au besoin
      default:
        throw new Error('Une valeur en double existe déjà');
    }
  }
  
  // Gestion d'autres types d'erreurs
  if (error.code === '42501') {
    throw new Error('Permission refusée');
  }
  
  if (error.code === '42P01') {
    throw new Error('Table non trouvée');
  }
  
  // Pour toutes les autres erreurs, propager l'erreur originale
  throw error;
};
// export const handleSupabaseError = (error: any) => {
//   console.error('Supabase error:', error);
//   if (error?.message) {
//     throw new Error(error.message);
//   }
//   throw new Error('Une erreur est survenue lors de la communication avec la base de données');
// };

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    handleSupabaseError(error);
  }
  return user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};