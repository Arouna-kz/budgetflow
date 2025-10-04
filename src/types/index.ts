// Types pour la gestion des subventions et budgets

export interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profession: string; // Rôle métier : 'Coordonnateur National', 'Comptable', etc.
  role?: {
    name: string;
    permissions?: string[];
  };
}

export interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean; // Pour les permissions fines
}


export interface Grant {
  id: string;
  name: string;
  reference: string;
  grantingOrganization: string;
  year: number;
  totalAmount: number;
  plannedAmount: number;
  currency: 'EUR' | 'USD' | 'XOF';
  startDate: string;
  endDate: string;
  status: 'pending' | 'active' | 'completed' | 'suspended';
  description?: string;
  bankAccount?: {
    name: string;
    accountNumber: string;
    bankName: string;
    balance: number;
  };
}

export interface BudgetLine {
  id: string;
  grantId: string;
  code: string;
  name: string;
  plannedAmount: number;
  notifiedAmount: number;
  engagedAmount: number;
  spentAmount: number;
  availableAmount: number;
  description?: string;
  color: string;
}

export interface SubBudgetLine {
  id: string;
  grantId: string;
  budgetLineId: string;
  code: string;
  name: string;
  plannedAmount: number;
  notifiedAmount: number;
  engagedAmount: number;
  spentAmount: number;
  availableAmount: number;
  description?: string;
}

export interface Engagement {
  id: string;
  grantId: string;
  budgetLineId: string;
  subBudgetLineId: string;
  engagementNumber: string;
  amount: number;
  description: string;
  supplier?: string;
  quoteReference?: string;
  invoiceNumber?: string;
  date: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  approvals?: {
    supervisor1?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    supervisor2?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    finalApproval?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
  };
}

export interface Payment {
  id: string;
  paymentNumber: string;
  grantId: string;
  budgetLineId: string;
  subBudgetLineId: string;
  engagementId: string;
  amount: number;
  date: string;
  supplier: string;
  description: string;
  paymentMethod: 'check' | 'transfer' | 'cash';
  checkNumber?: string;
  bankReference?: string;
  invoiceNumber: string;
  invoiceAmount: number;
  quoteReference?: string;
  deliveryNote?: string;
  purchaseOrderNumber?: string;
  serviceAcceptance: boolean;
  controlNotes?: string;
  status: 'pending' | 'approved' | 'paid' | 'cashed' | 'rejected';
  cashedDate?: string;
  approvals?: {
    supervisor1?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    supervisor2?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    finalApproval?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
  };
}

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  balance: number;
  lastUpdateDate: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  reference: string;
}

export interface Prefinancing {
  id: string;
  prefinancingNumber: string;
  grantId: string;
  budgetLineId?: string;
  subBudgetLineId?: string;
  amount: number;
  date: string;
  expectedRepaymentDate: string;
  purpose: 'specific_expenses' | 'other_accounts' | 'between_grants';
  targetBankAccount?: string;
  targetGrant?: string;
  expenses: {
    supplier: string;
    invoiceNumber: string;
    amount: number;
    description: string;
  }[];
  status: 'pending' | 'approved' | 'paid' | 'repaid' | 'rejected';
  repayments?: {
    id: string;
    date: string;
    amount: number;
    reference: string;
  }[];
  description: string;
  approvals?: {
    supervisor1?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    supervisor2?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    finalApproval?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
  };
}

export interface EmployeeLoan {
  id: string;
  loanNumber: string;
  grantId: string;
  budgetLineId?: string;
  subBudgetLineId?: string;
  employee: {
    name: string;
    employeeId: string;
  };
  amount: number;
  date: string;
  expectedRepaymentDate: string;
  description: string;
  repaymentSchedule: {
    installmentAmount: number;
    numberOfInstallments: number;
    frequency: 'monthly' | 'quarterly' | 'annual';
  };
  repayments: {
    id: string;
    date: string;
    amount: number;
    reference: string;
  }[];
  status: 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
  approvals?: {
    supervisor1?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    supervisor2?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
    finalApproval?: { 
      name: string; 
      date: string; 
      signature: boolean; 
      observation?: string 
    };
  };
}

export const DEFAULT_BUDGET_LINES: Omit<BudgetLine, 'id' | 'grantId'>[] = [
  {
    code: 'PIN-PERS',
    name: 'Personnel',
    plannedAmount: 0,
    notifiedAmount: 0,
    engagedAmount: 0,
    spentAmount: 0,
    availableAmount: 0,
    description: 'Frais de personnel et consultants',
    color: 'bg-blue-100 text-blue-700'
  },
  {
    code: 'PIN-EQUIP',
    name: 'Équipements',
    plannedAmount: 0,
    notifiedAmount: 0,
    engagedAmount: 0,
    spentAmount: 0,
    availableAmount: 0,
    description: 'Achat d\'équipements et matériels',
    color: 'bg-green-100 text-green-700'
  },
  {
    code: 'PIN-FONC',
    name: 'Fonctionnement',
    plannedAmount: 0,
    notifiedAmount: 0,
    engagedAmount: 0,
    spentAmount: 0,
    availableAmount: 0,
    description: 'Frais de fonctionnement et services',
    color: 'bg-yellow-100 text-yellow-700'
  },
  {
    code: 'PIN-FORM',
    name: 'Formation',
    plannedAmount: 0,
    notifiedAmount: 0,
    engagedAmount: 0,
    spentAmount: 0,
    availableAmount: 0,
    description: 'Activités de formation et renforcement des capacités',
    color: 'bg-purple-100 text-purple-700'
  }
];

export const GRANT_STATUS = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Terminé', color: 'bg-blue-100 text-blue-700' },
  suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-700' }
};

export const LOAN_STATUS = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800' },
  active: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Remboursé', color: 'bg-purple-100 text-purple-800' },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800' }
};

export const ENGAGEMENT_STATUS = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'En traitement', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800' },
  paid: { label: 'Payé', color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800' }
};

export const PAYMENT_STATUS = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800' },
  paid: { label: 'Payé', color: 'bg-blue-100 text-blue-800' },
  cashed: { label: 'Encaissé', color: 'bg-purple-100 text-purple-800' },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800' }
};

export const PREFINANCING_STATUS = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800' },
  paid: { label: 'Décaissé', color: 'bg-blue-100 text-blue-800' },
  repaid: { label: 'Remboursé', color: 'bg-purple-100 text-purple-800' },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800' }
};