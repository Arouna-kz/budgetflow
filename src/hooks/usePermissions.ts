// hooks/usePermissions.ts
import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { PermissionService, RolePermissions } from '../services/permissionService';

export const usePermissions = () => {
  const { userRole, loading: authLoading } = useAuth();

  // Mémoïser les permissions pour éviter les recalculs inutiles
  const permissions: RolePermissions = useMemo(() => {
    if (userRole?.permissions) {
      return PermissionService.normalizePermissions(userRole.permissions);
    }
    return {};
  }, [userRole?.permissions]);

  const hasPermission = (module: string, action: string): boolean => {
    return PermissionService.hasPermission(permissions, module, action);
  };

  const hasModuleAccess = (module: string): boolean => {
    return PermissionService.hasModuleAccess(permissions, module);
  };

  // Vérifie plusieurs permissions à la fois
  const hasAnyPermission = (module: string, actions: string[]): boolean => {
    return actions.some(action => hasPermission(module, action));
  };

  // Vérifie toutes les permissions
  const hasAllPermissions = (module: string, actions: string[]): boolean => {
    return actions.every(action => hasPermission(module, action));
  };
  

  return {
    permissions,
    hasPermission,
    hasModuleAccess,
    hasAnyPermission,
    hasAllPermissions,
    availableModules: PermissionService.getAvailableModules(),
    loading: authLoading 
  };
};