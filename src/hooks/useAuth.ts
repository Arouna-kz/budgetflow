import { useState, useEffect } from 'react';
import { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types/user';
import { DEFAULT_ROLES } from '../types/user';

export const useAuth = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('Supabase auth session error:', sessionError);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        console.log('Session found:', session ? 'yes' : 'no');
        if (session?.user && mounted) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else if (mounted) {
          setLoading(false); // Aucun utilisateur connecté
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event);
        if (!mounted) return;

        try {
          if (session?.user) {
            setUser(session.user);
            await loadUserProfile(session.user.id);
          } else {
            setUser(null);
            setUserProfile(null);
            setUserRole(null);
            setLoading(false); // Seulement ici pour la déconnexion
          }
        } catch (err) {
          console.error('Error in auth state change:', err);
          if (mounted) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Dans src/hooks/useAuth.ts
const loadUserProfile = async (userId: string) => {
  let mounted = true;
  
  try {
    console.log('Loading user profile for:', userId);
    
    // Load user profile from Supabase avec un timeout plus court
    const profilePromise = supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Réduire le timeout à 10 secondes (au lieu de 30)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout loading user profile')), 10000)
    );

    const result = await Promise.race([profilePromise, timeoutPromise]);
    const { data: profile, error: profileError } = result as any;

    if (profileError) {
      console.warn('Profile not found in Supabase:', profileError);
      if (mounted) {
        setLoading(false);
      }
      return;
    }

    if (profile) {
      const userProfileData: User = {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        profession: profile.profession || undefined,
        employeeId: profile.employee_id || undefined,
        roleId: profile.role_id,
        isActive: profile.is_active,
        lastLogin: profile.last_login || undefined,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        createdBy: profile.created_by
      };
      setUserProfile(userProfileData);

      // Load user role avec timeout réduit
      const rolePromise = supabase
        .from('user_roles')
        .select('*')
        .eq('id', profile.role_id)
        .single();

      const roleTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading role')), 5000) // 5 secondes au lieu de 15
      );

      try {
        const roleResult = await Promise.race([rolePromise, roleTimeoutPromise]);
        const { data: role, error: roleError } = roleResult as any;

        if (roleError) {
          console.warn('Error loading role from Supabase:', roleError);
          // Fallback vers les rôles par défaut
          const defaultRole = DEFAULT_ROLES.find(r => r.id === profile.role_id);
          if (defaultRole) {
            setUserRole(defaultRole);
          }
        } else if (role) {
          const userRoleData: UserRole = {
            id: role.id,
            name: role.name,
            code: role.code,
            description: role.description,
            permissions: role.permissions as any,
            color: role.color,
            isActive: role.is_active,
            createdAt: role.created_at,
            updatedAt: role.updated_at
          };
          setUserRole(userRoleData);
        }
      } catch (roleError) {
        console.warn('Error loading role (timeout or other):', roleError);
        // Fallback vers les rôles par défaut
        const defaultRole = DEFAULT_ROLES.find(r => r.id === profile.role_id);
        if (defaultRole) {
          setUserRole(defaultRole);
        }
      }

      // Update last login (ne pas bloquer sur ça)
      try {
        await supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      } catch (updateError) {
        console.warn('Could not update last login:', updateError);
      }
    }
    
    // FINALLY set loading to false
    if (mounted) {
      setLoading(false);
    }
  } catch (err: any) {
    console.error('Error loading user profile:', err);
    if (mounted) {
      setError(err.message);
      setLoading(false); // IMPORTANT: Toujours mettre loading à false même en cas d'erreur
    }
  }
};

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      
      // Connexion Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }
      
      return { success: true, user: data.user };
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: {
  firstName: string;
  lastName: string;
  profession?: string;
  employeeId?: string;
}) => {
  try {
    setError(null);
    setLoading(true);
    console.log('Starting signup process for:', email);

    // 1. Créer le compte Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // emailRedirectTo: `${window.location.origin}/auth/callback`, // Optionnel pour confirmer l'email
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName
        }
      }
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      throw authError;
    }

    if (!data.user) {
      throw new Error('No user object returned from authentication');
    }

    console.log('Auth user created, ID:', data.user.id);

    // 2. Trouver le rôle ADMIN
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('code', 'ADMIN')
      .single();

    if (roleError) {
      console.error('Error finding admin role:', roleError);
      throw new Error('Le rôle administrateur (ADMIN) est introuvable dans la base de données. Veuillez contacter le support.');
    }
    console.log('Admin role found, ID:', adminRole.id);

    // 3. Créer le profil dans public.users
    const newUserProfile = {
      id: data.user.id,
      email: data.user.email!,
      first_name: userData.firstName,
      last_name: userData.lastName,
      profession: userData.profession || null, // Use null instead of undefined for SQL
      employee_id: userData.employeeId || null,
      role_id: adminRole.id,
      is_active: true,
      created_by: data.user.id
      // created_at and updated_at should be automatically set by DEFAULT NOW() in your table
    };

    console.log('Attempting to insert user profile:', newUserProfile);

    const { data: newUserData, error: userError } = await supabase
      .from('users')
      .insert(newUserProfile)
      .select()
      .single();

    if (userError) {
      console.error('Supabase error creating user profile:', userError);
      console.error('Error code:', userError.code, 'Details:', userError.details);
      // Tentative de suppression du compte auth si le profil échoue
      try {
        await supabase.auth.signOut();
        // Note: supabase.auth.admin.deleteUser(data.user.id) serait nécessaire pour supprimer vraiment, mais nécessite des droits admin
      } catch (signOutError) {
        console.error('Error during cleanup after failed profile creation:', signOutError);
      }
      // Lance une erreur avec le code pour faciliter le debug (ex: '23505' pour violation de contrainte unique)
      throw new Error(`CREATE_PROFILE_FAILED_${userError.code}: Échec de la création du profil.`);
    }

    console.log('User profile created successfully:', newUserData);

    // 4. Mettre à jour l'état local
    const newUser: User = {
      id: newUserData.id,
      email: newUserData.email,
      firstName: newUserData.first_name,
      lastName: newUserData.last_name,
      profession: newUserData.profession || undefined,
      employeeId: newUserData.employee_id || undefined,
      roleId: newUserData.role_id,
      isActive: newUserData.is_active,
      lastLogin: newUserData.last_login ? new Date(newUserData.last_login).toISOString() : undefined,
      createdAt: newUserData.created_at,
      updatedAt: newUserData.updated_at,
      createdBy: newUserData.created_by
    };

    setUserProfile(newUser);
    // Charger le rôle à partir des DEFAULT_ROLES ou refaire une requête
    const defaultRole = DEFAULT_ROLES.find(role => role.id === adminRole.id);
    if (defaultRole) {
      setUserRole(defaultRole);
    } else {
      console.warn('Default role not found in DEFAULT_ROLES array for ID:', adminRole.id);
    }

    return { success: true, user: data.user };

  } catch (err: any) {
    console.error('Full signup process error:', err);
    let errorMessage = err.message;
    // Messages d'erreur plus conviviaux
    if (errorMessage.includes('CREATE_PROFILE_FAILED_23505')) {
      errorMessage = 'Une violation de contrainte unique s\'est produite (probablement un email ou un employee_id déjà existant).';
    } else if (errorMessage.includes('CREATE_PROFILE_FAILED')) {
      errorMessage = 'Erreur technique lors de la création du profil. Veuillez réessayer ou contacter le support.';
    }
    setError(errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setLoading(false);
  }
};

  const signOut = async () => {
    try {
      setError(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
    } catch (err: any) {
      console.error('Logout error:', err);
      // Force logout même en cas d'erreur
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
    }
  };

  const isAdmin = () => {
    return userRole?.code === 'ADMIN';
  };

  const hasPermission = (module: string, action: string) => {
    if (!userRole) return false;
    
    // Si l'utilisateur a la permission "all" avec l'action demandée, autoriser
    const globalPermission = userRole.permissions.find(p => p.module === 'all');
    if (globalPermission && globalPermission.actions.includes(action)) {
      return true;
    }
    
    // Vérifier la permission spécifique au module
    const permission = userRole.permissions.find(p => p.module === module);
    return permission?.actions.includes(action) || false;
  };

  const canAccessModule = (module: string) => {
    if (!userRole) return false;
    
    // Si l'utilisateur a la permission "all" avec au moins une action, autoriser l'accès au module
    const globalPermission = userRole.permissions.find(p => p.module === 'all');
    if (globalPermission && globalPermission.actions.length > 0) {
      return true;
    }
    
    // Vérifier si l'utilisateur a au moins une permission pour ce module
    const permission = userRole.permissions.find(p => p.module === module);
    return permission && permission.actions.length > 0;
  };

  return {
    user,
    userProfile,
    userRole,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isAdmin,
    hasPermission,
    canAccessModule
  };
};