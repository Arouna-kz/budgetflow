import { useState, useEffect } from 'react';
import { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types/user';

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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('Supabase auth session error:', sessionError);
          if (mounted) setLoading(false);
          return;
        }
        
        if (session?.user && mounted) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else if (mounted) {
          setLoading(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        try {
          if (session?.user) {
            setUser(session.user);
            await loadUserProfile(session.user.id);
          } else {
            setUser(null);
            setUserProfile(null);
            setUserRole(null);
            setLoading(false);
          }
        } catch (err) {
          console.error('Error in auth state change:', err);
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (userId: string) => {
    let mounted = true;
    
    try {
      // Timeout de 10 secondes pour le profil
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const profileTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading user profile')), 10000)
      );

      const profileResult = await Promise.race([profilePromise, profileTimeout]);
      const { data: profile, error: profileError } = profileResult as any;

      if (profileError) {
        console.warn('Profile not found in Supabase:', profileError);
        if (mounted) setLoading(false);
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

        // Timeout de 5 secondes pour le rôle
        const rolePromise = supabase
          .from('user_roles')
          .select('*')
          .eq('id', profile.role_id)
          .single();

        const roleTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout loading role')), 5000)
        );

        try {
          const roleResult = await Promise.race([rolePromise, roleTimeout]);
          const { data: role, error: roleError } = roleResult as any;

          if (roleError) {
            console.error('Error loading role from database:', roleError);
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
          // Pas de fallback vers DEFAULT_ROLES, juste une erreur silencieuse
        }

        // Mettre à jour last_login en arrière-plan
        supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .then(({ error }) => {
            if (error) console.warn('Could not update last login:', error);
          });
      }
      
      if (mounted) setLoading(false);
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      if (mounted) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
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

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
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

      const { data: adminRole, error: roleError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('code', 'ADMIN')
        .single();

      if (roleError) {
        console.error('Error finding admin role:', roleError);
        throw new Error('Le rôle administrateur (ADMIN) est introuvable dans la base de données.');
      }

      const newUserProfile = {
        id: data.user.id,
        email: data.user.email!,
        first_name: userData.firstName,
        last_name: userData.lastName,
        profession: userData.profession || null,
        employee_id: userData.employeeId || null,
        role_id: adminRole.id,
        is_active: true,
        created_by: data.user.id
      };

      const { data: newUserData, error: userError } = await supabase
        .from('users')
        .insert(newUserProfile)
        .select()
        .single();

      if (userError) {
        console.error('Supabase error creating user profile:', userError);
        await supabase.auth.signOut();
        throw new Error(`CREATE_PROFILE_FAILED_${userError.code}`);
      }

      const newUser: User = {
        id: newUserData.id,
        email: newUserData.email,
        firstName: newUserData.first_name,
        lastName: newUserData.last_name,
        profession: newUserData.profession || undefined,
        employeeId: newUserData.employee_id || undefined,
        roleId: newUserData.role_id,
        isActive: newUserData.is_active,
        lastLogin: newUserData.last_login || undefined,
        createdAt: newUserData.created_at,
        updatedAt: newUserData.updated_at,
        createdBy: newUserData.created_by
      };

      setUserProfile(newUser);

      const { data: roleData, error: roleLoadError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', adminRole.id)
        .single();

      if (!roleLoadError && roleData) {
        setUserRole({
          id: roleData.id,
          name: roleData.name,
          code: roleData.code,
          description: roleData.description,
          permissions: roleData.permissions as any,
          color: roleData.color,
          isActive: roleData.is_active,
          createdAt: roleData.created_at,
          updatedAt: roleData.updated_at
        });
      }

      return { success: true, user: data.user };

    } catch (err: any) {
      console.error('Full signup process error:', err);
      let errorMessage = err.message;
      
      if (errorMessage.includes('CREATE_PROFILE_FAILED_23505')) {
        errorMessage = 'Un utilisateur avec cet email ou cet identifiant employé existe déjà.';
      } else if (errorMessage.includes('CREATE_PROFILE_FAILED')) {
        errorMessage = 'Erreur technique lors de la création du profil.';
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
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
    }
  };

  const isAdmin = () => userRole?.code === 'ADMIN';

  const hasPermission = (module: string, action: string) => {
    if (!userRole) return false;
    const globalPermission = userRole.permissions.find(p => p.module === 'all');
    if (globalPermission?.actions.includes(action)) return true;
    const permission = userRole.permissions.find(p => p.module === module);
    return permission?.actions.includes(action) || false;
  };

  const canAccessModule = (module: string) => {
    if (!userRole) return false;
    const globalPermission = userRole.permissions.find(p => p.module === 'all');
    if (globalPermission?.actions.length > 0) return true;
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