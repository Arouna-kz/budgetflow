// components/PermissionGuard.tsx
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionGuardProps {
  module: string;
  action?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean;
  actions?: string[]; // Pour vérifier plusieurs actions
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  module,
  action,
  children,
  fallback = null,
  requireAll = false,
  actions = []
}) => {
  const { 
    hasPermission, 
    hasModuleAccess, 
    hasAnyPermission, 
    hasAllPermissions 
  } = usePermissions();

  let hasAccess = false;

  if (actions.length > 0) {
    // Vérification multiple d'actions
    hasAccess = requireAll 
      ? hasAllPermissions(module, actions)
      : hasAnyPermission(module, actions);
  } else if (action) {
    // Vérification d'une action spécifique
    hasAccess = hasPermission(module, action);
  } else {
    // Vérification d'accès au module
    hasAccess = hasModuleAccess(module);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// Exemples d'utilisation :
// <PermissionGuard module="payments" action="create">
//   <button>Créer paiement</button>
// </PermissionGuard>

// <PermissionGuard module="users" actions={['view', 'edit']} requireAll={true}>
//   <UserEditor />
// </PermissionGuard>