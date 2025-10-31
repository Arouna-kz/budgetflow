import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:', {
    supabaseUrl: !!supabaseUrl,
    supabaseServiceKey: !!supabaseServiceKey
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const adminService = {
  // Créer un utilisateur SANS le connecter automatiquement
  createUser: async (userData: {
    email: string;
    password: string;
    user_metadata: {
      first_name: string;
      last_name: string;
      profession?: string;
    };
    email_confirm?: boolean;
  }) => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: userData.email_confirm || true,
      user_metadata: userData.user_metadata,
    });

    if (error) {
      console.error('Supabase admin create user error:', error);
      throw error;
    }
    
    return data;
  },

  updateUserPassword: async (userId: string, newPassword: string) => {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        password: newPassword
      }
    );

    if (error) {
      console.error('Supabase admin error:', error);
      throw error;
    }
    
    return data;
  }
};