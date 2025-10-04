export interface UserRole {
  id: string;
  name: string;
  code: string;
  description: string;
  permissions: Permission[];
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  actions: string[]; // ['create', 'read', 'update', 'delete', 'approve', 'validate']
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profession?: string;
  employeeId?: string;
  roleId: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface UserSession {
  user: User;
  role: UserRole;
  permissions: Permission[];
  token: string;
  expiresAt: string;
}

export const DEFAULT_PERMISSIONS: Permission[] = [
  {
    id: '1',
    name: 'Gestion des subventions',
    code: 'GRANTS_MANAGEMENT',
    module: 'grants',
    actions: ['create', 'read', 'update', 'delete']
  },
  {
    id: '2',
    name: 'Planification budgétaire',
    code: 'BUDGET_PLANNING',
    module: 'budget_planning',
    actions: ['create', 'read', 'update', 'delete']
  },
  {
    id: '3',
    name: 'Suivi budgétaire',
    code: 'BUDGET_TRACKING',
    module: 'tracking',
    actions: ['read']
  },
  {
    id: '4',
    name: 'Gestion des engagements',
    code: 'ENGAGEMENTS_MANAGEMENT',
    module: 'engagements',
    actions: ['create', 'read', 'update', 'approve']
  },
  
  {
    id: '5',
    name: 'Gestion des paiements',
    code: 'PAYMENTS_MANAGEMENT',
    module: 'payments',
    actions: ['create', 'read', 'update', 'approve']
  },
  {
    id: '6',
    name: 'Validation',
    code: 'VALIDATION',
    module: 'all',
    actions: ['validate']
  },
  {
    id: '7',
    name: 'Gestion de trésorerie',
    code: 'TREASURY_MANAGEMENT',
    module: 'treasury',
    actions: ['create', 'read', 'update', 'delete']
  },
  {
    id: '8',
    name: 'Préfinancements',
    code: 'PREFINANCING_MANAGEMENT',
    module: 'prefinancing',
    actions: ['create', 'read', 'update', 'approve', 'validate']
  },
  {
    id: '9',
    name: 'Prêts employés',
    code: 'LOANS_MANAGEMENT',
    module: 'loans',
    actions: ['create', 'read', 'update', 'approve', 'validate']
  },
  {
    id: '10',
    name: 'Rapports et analyses',
    code: 'REPORTS_ACCESS',
    module: 'reports',
    actions: ['read', 'export']
  },
  {
    id: '11',
    name: 'Lecture seule globale',
    code: 'READ_ONLY_ACCESS',
    module: 'all',
    actions: ['read']
  },
  {
    id: '12',
    name: 'Administration système',
    code: 'SYSTEM_ADMIN',
    module: 'admin',
    actions: ['create', 'read', 'update', 'delete', 'manage_users', 'manage_roles']
  }
];

export const DEFAULT_ROLES: UserRole[] = [
  {
    id: '1',
    name: 'Administrateur',
    code: 'ADMIN',
    description: 'Accès complet à toutes les fonctionnalités',
    permissions: DEFAULT_PERMISSIONS,
    color: 'bg-red-100 text-red-700',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Responsable Financier',
    code: 'FINANCE_MANAGER',
    description: 'Gestion complète des budgets et validation des paiements',
    permissions: DEFAULT_PERMISSIONS.filter(p => 
      ['grants', 'budget_planning', 'tracking', 'engagements', 'payments', 'treasury', 'prefinancing', 'loans', 'reports'].includes(p.module)
    ),
    color: 'bg-blue-100 text-blue-700',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Gestionnaire de Projet',
    code: 'PROJECT_MANAGER',
    description: 'Gestion des engagements et suivi budgétaire',
    permissions: DEFAULT_PERMISSIONS.filter(p => 
      ['tracking', 'engagements', 'payments', 'reports'].includes(p.module)
    ),
    color: 'bg-green-100 text-green-700',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Assistant Administratif',
    code: 'ADMIN_ASSISTANT',
    description: 'Saisie des données et consultation',
    permissions: DEFAULT_PERMISSIONS.filter(p => 
      ['tracking', 'engagements', 'reports'].includes(p.module)
    ).map(p => ({
      ...p,
      actions: p.actions.filter(action => ['create', 'read'].includes(action))
    })),
    color: 'bg-yellow-100 text-yellow-700',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '5',
    name: 'Consultant',
    code: 'CONSULTANT',
    description: 'Accès en lecture seule pour consultation',
    permissions: DEFAULT_PERMISSIONS.filter(p => 
      ['tracking', 'reports'].includes(p.module)
    ).map(p => ({
      ...p,
      actions: ['read']
    })),
    color: 'bg-purple-100 text-purple-700',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '6',
    name: 'Lecture Seule',
    code: 'READ_ONLY',
    description: 'Accès en lecture seule à toutes les données',
    permissions: [DEFAULT_PERMISSIONS.find(p => p.module === 'all')!],
    color: 'bg-gray-100 text-gray-700',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const USER_STATUS = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactif', color: 'bg-gray-100 text-gray-800' },
  suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-800' }
} as const;