import { useState, useEffect, useCallback, useRef } from 'react';
import { Target, Users, FileText, BarChart3, CreditCard, Banknote, ArrowRightLeft, DollarSign, Settings, LogOut, Menu, X, AlertTriangle } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { 
  grantsService, 
  budgetLinesService, 
  subBudgetLinesService, 
  engagementsService, 
  paymentsService, 
  usersService, 
  rolesService,
  appSettingsService,
  bankAccountsService,
  bankTransactionsService,
  prefinancingsService,
  employeeLoansService
} from './services/supabaseService';
import { Dashboard } from './components/Dashboard';
import BudgetPlanning from './components/BudgetPlanning';
import BudgetTracking from './components/BudgetTracking';
import EngagementManager from './components/EngagementManager';
import EngagementForm from './components/EngagementForm';
import EngagementDetails from './components/EngagementDetails';
import PaymentManager from './components/PaymentManager';
import PaymentForm from './components/PaymentForm';
import PaymentDetailsView from './components/PaymentDetailsView';
import TreasuryManager from './components/TreasuryManager';
import PrefinancingManager from './components/PrefinancingManager';
import EmployeeLoanManager from './components/EmployeeLoanManager';
import Reports from './components/Reports';
import UserManager from './components/UserManager';
import UserProfile from './components/UserProfile';
import GrantManager from './components/GrantManager';
import GrantSelector from './components/GrantSelector';
import LoginForm from './components/LoginForm';
import { usePermissions } from './hooks/usePermissions';
import { showSuccess, showError, showToast, showLoading, closeLoading } from './utils/alerts';
import { 
  Grant, 
  BudgetLine, 
  SubBudgetLine, 
  Engagement, 
  Payment, 
  BankAccount, 
  BankTransaction, 
  Prefinancing, 
  EmployeeLoan,
} from './types';
import { User, UserRole } from './types/user';
import { useGlobalNotifications } from './contexts/GlobalNotificationContext';

import { useEngagementNotifications } from './hooks/useEngagementNotifications';
import { usePaymentNotifications } from './hooks/usePaymentNotifications';
import { usePrefinancingNotifications } from './hooks/usePrefinancingNotifications';
import { useEmployeeLoanNotifications } from './hooks/useEmployeeLoanNotifications';

function App() {
  const { user, userProfile, userRole, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Data states
  const [grants, setGrants] = useState<Grant[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [subBudgetLines, setSubBudgetLines] = useState<SubBudgetLine[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentForView, setSelectedPaymentForView] = useState<Payment | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [prefinancings, setPrefinancings] = useState<Prefinancing[]>([]);
  const [employeeLoans, setEmployeeLoans] = useState<EmployeeLoan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const { hasModuleAccess } = usePermissions();

  const { 
    updateEngagementNotifications, 
    updatePaymentNotifications,
    updatePrefinancingNotifications,
    updateEmployeeLoanNotifications,
    totalNotifications,
    hasAnyNotifications
  } = useGlobalNotifications();

  // Notification hooks
  const { notificationCount: engagementNotificationCount } = useEngagementNotifications(engagements, selectedGrantId);
  const { notificationCount: paymentNotificationCount } = usePaymentNotifications(payments, selectedGrantId);
  const { notificationCount: prefinancingNotificationCount } = usePrefinancingNotifications(prefinancings, selectedGrantId);
  const { notificationCount: employeeLoanNotificationCount } = useEmployeeLoanNotifications(employeeLoans, selectedGrantId);

  // Mettez à jour les notifications globales quand les counts changent
  useEffect(() => {
    updateEngagementNotifications(engagementNotificationCount);
  }, [engagementNotificationCount, updateEngagementNotifications]);

  useEffect(() => {
    updatePaymentNotifications(paymentNotificationCount);
  }, [paymentNotificationCount, updatePaymentNotifications]);

  useEffect(() => {
    updatePrefinancingNotifications(prefinancingNotificationCount);
  }, [prefinancingNotificationCount, updatePrefinancingNotifications]);

  useEffect(() => {
    updateEmployeeLoanNotifications(employeeLoanNotificationCount);
  }, [employeeLoanNotificationCount, updateEmployeeLoanNotifications]);

  // 🎯 REFS POUR ÉVITER LES BOUCLES
  const isInitialLoad = useRef(true);
  const isSaving = useRef(false);

  // 🎯 FONCTION AMÉLIORÉE POUR SÉLECTIONNER ET SAUVEGARDER LA SUBVENTION
  const handleSelectGrant = async (grantId: string) => {
    console.log('🎯 User selected grant:', grantId);
    setSelectedGrantId(grantId);
    
    // Sauvegarder immédiatement la sélection utilisateur
    try {
      isSaving.current = true;
      await appSettingsService.set('selectedGrantId', grantId);
      localStorage.setItem('selectedGrantId', grantId);
      console.log('💫 User grant selection saved:', grantId);
    } catch (error) {
      console.error('❌ Error saving user grant selection:', error);
      localStorage.setItem('selectedGrantId', grantId);
    } finally {
      isSaving.current = false;
    }
  };

  const loadAllData = useCallback(async () => {
    try {
      setDataLoading(true);
      showLoading('Chargement des données...');

      console.log('🔄 loadAllData - Début du chargement');

      // Charger les données en parallèle
      const [
        grantsData,
        budgetLinesData,
        subBudgetLinesData,
        engagementsData,
        paymentsData,
        bankAccountsData,
        bankTransactionsData,
        prefinancingsData,
        employeeLoansData,
        usersData,
        rolesData,
      ] = await Promise.all([
        grantsService.getAll(),
        budgetLinesService.getAll(),
        subBudgetLinesService.getAll(),
        engagementsService.getAll(),
        paymentsService.getAll(),
        bankAccountsService.getAll(),
        bankTransactionsService.getAll(),
        prefinancingsService.getAll(),
        employeeLoansService.getAll(),
        usersService.getAll(),
        rolesService.getAll(),
      ]);

      setGrants(grantsData);
      setBudgetLines(budgetLinesData);
      setSubBudgetLines(subBudgetLinesData);
      setEngagements(engagementsData);
      setPayments(paymentsData);
      setBankAccounts(bankAccountsData);
      setBankTransactions(bankTransactionsData);
      setPrefinancings(prefinancingsData);
      setEmployeeLoans(employeeLoansData);
      setUsers(usersData);
      setRoles(rolesData);

      console.log('📊 Données chargées - Subventions:', grantsData.length);

      // 🎯 CHARGEMENT INTELLIGENT DE LA SUBVENTION APRÈS LE CHARGEMENT DES DONNÉES
      if (isInitialLoad.current && grantsData.length > 0) {
        await loadInitialGrantSelection(grantsData);
        isInitialLoad.current = false;
      }

    } catch (error) {
      console.error('Error loading data:', error);
      showError('Erreur de chargement', 'Impossible de charger les données. Veuillez rafraîchir la page.');
    } finally {
      setDataLoading(false);
      closeLoading();
    }
  }, []);

  // 🎯 FONCTION SÉPARÉE POUR LE CHARGEMENT INITIAL
  const loadInitialGrantSelection = async (grantsData: Grant[]) => {
    try {
      console.log('🔄 loadInitialGrantSelection - Début');
      
      // 1. Essayer de charger depuis Supabase
      const savedGrantId = await appSettingsService.get('selectedGrantId');
      console.log('💾 Saved grant from Supabase:', savedGrantId);
      
      // 2. Fallback localStorage
      let grantToSelect = savedGrantId;
      if (!grantToSelect && typeof window !== 'undefined') {
        grantToSelect = localStorage.getItem('selectedGrantId') || '';
        console.log('💾 Saved grant from localStorage:', grantToSelect);
      }
      
      // 3. Vérifier que la subvention existe toujours
      if (grantToSelect && grantsData.find(g => g.id === grantToSelect)) {
        console.log('✅ Using existing saved grant:', grantToSelect);
        setSelectedGrantId(grantToSelect);
        return;
      }
      
      // 4. Fallback: première subvention disponible
      if (grantsData.length > 0) {
        const firstGrant = grantsData[0];
        grantToSelect = firstGrant.id;
        console.log('🎯 Using first available grant:', grantToSelect);
        setSelectedGrantId(grantToSelect);
        
        // 🚨 NE PAS SAUVEGARDER AUTOMATIQUEMENT ICI - seulement si c'est vraiment nécessaire
        console.log('ℹ️  Initial grant selection - no auto-save to avoid loops');
      }
      
    } catch (error) {
      console.error('Error in loadInitialGrantSelection:', error);
    }
  };

  // Load data when user is authenticated
  useEffect(() => {
    if (userProfile) {
      loadAllData();
    }
  }, [userProfile, loadAllData]);

  // 🎯 SAUVEGARDE AUTOMATIQUE UNIQUEMENT POUR LES CHANGEMENTS UTILISATEUR
  useEffect(() => {
    // Éviter la sauvegarde automatique pendant le chargement initial
    if (isInitialLoad.current || isSaving.current || !selectedGrantId) {
      return;
    }

    const saveSelectedGrant = async () => {
      try {
        isSaving.current = true;
        console.log('💾 Auto-saving selected grant:', selectedGrantId);
        await appSettingsService.set('selectedGrantId', selectedGrantId);
        localStorage.setItem('selectedGrantId', selectedGrantId);
      } catch (error) {
        console.error('❌ Error auto-saving selected grant:', error);
      } finally {
        isSaving.current = false;
      }
    };

    // Délai plus long pour éviter les conflits
    const timer = setTimeout(saveSelectedGrant, 1000);
    return () => clearTimeout(timer);
  }, [selectedGrantId]);

  // Fallback to localStorage for demo data if Supabase is not available
  useEffect(() => {
    if (!userProfile) {
      const savedData = localStorage.getItem('budgetFlowData');
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          if (data.grants) setGrants(data.grants);
          if (data.budgetLines) setBudgetLines(data.budgetLines);
          if (data.subBudgetLines) setSubBudgetLines(data.subBudgetLines);
          if (data.engagements) setEngagements(data.engagements);
          if (data.payments) setPayments(data.payments);
          if (data.bankAccounts) setBankAccounts(data.bankAccounts);
          if (data.bankTransactions) setBankTransactions(data.bankTransactions);
          if (data.prefinancings) setPrefinancings(data.prefinancings);
          if (data.employeeLoans) setEmployeeLoans(data.employeeLoans);
          if (data.users) setUsers(data.users);
          if (data.roles) setRoles(data.roles);
          if (data.selectedGrantId) setSelectedGrantId(data.selectedGrantId);
        } catch (error) {
          console.error('Error loading saved data:', error);
        }
      }
    }
  }, [userProfile]);

  // Debug effect pour suivre l'état de la subvention sélectionnée
  useEffect(() => {
    console.log('🔍 DEBUG - Current selectedGrantId:', selectedGrantId);
    console.log('🔍 DEBUG - Available grants:', grants.length);
    if (selectedGrantId) {
      const selectedGrant = grants.find(g => g.id === selectedGrantId);
      console.log('🔍 DEBUG - Selected grant:', selectedGrant?.name);
    }
  }, [selectedGrantId, grants]);

  // Form states
  const [showEngagementForm, setShowEngagementForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showEngagementDetails, setShowEngagementDetails] = useState(false);
  const [selectedSubBudgetLine, setSelectedSubBudgetLine] = useState<SubBudgetLine | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);
  const [editingEngagement, setEditingEngagement] = useState<Engagement | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const isAdmin = () => {
    return userRole?.code === 'ADMIN';
  };

  // Filter data by selected grant
  const getFilteredData = () => {
    if (!selectedGrantId) {
      return {
        budgetLines: [],
        subBudgetLines: [],
        engagements: [],
        payments: [],
        prefinancings: [],
        employeeLoans: []
      };
    }

    return {
      budgetLines: budgetLines.filter(line => line.grantId === selectedGrantId),
      subBudgetLines: subBudgetLines.filter(line => line.grantId === selectedGrantId),
      engagements: engagements.filter(eng => eng.grantId === selectedGrantId),
      payments: payments.filter(payment => payment.grantId === selectedGrantId),
      prefinancings: prefinancings.filter(pref => pref.grantId === selectedGrantId),
      employeeLoans: employeeLoans.filter(loan => loan.grantId === selectedGrantId)
    };
  };

  const filteredData = getFilteredData();
  const selectedGrant = grants.find(grant => grant.id === selectedGrantId);

  // Fallback: Save to localStorage for demo purposes
  useEffect(() => {
    if (!userProfile) {
      const dataToSave = {
        grants,
        budgetLines,
        subBudgetLines,
        engagements,
        payments,
        bankAccounts,
        bankTransactions,
        prefinancings,
        employeeLoans,
        users,
        roles,
        selectedGrantId
      };
      localStorage.setItem('budgetFlowData', JSON.stringify(dataToSave));
    }
  }, [grants, budgetLines, subBudgetLines, engagements, payments, bankAccounts, bankTransactions, prefinancings, employeeLoans, users, roles, selectedGrantId]);

  // Automatically update budget line planned amounts when sub-budget lines change
  useEffect(() => {
    setBudgetLines(prevBudgetLines => {
      const updatedBudgetLines = prevBudgetLines.map(budgetLine => {
        // Find related sub-budget lines
        const lineSubBudgetLines = subBudgetLines.filter(sub => sub.budgetLineId === budgetLine.id);
        // Calculate the total planned amount from children
        const totalPlanned = lineSubBudgetLines.reduce((sum, sub) => sum + (Number(sub.plannedAmount) || 0), 0);
        
        // Only return a new object if the amount has actually changed
        if (budgetLine.plannedAmount !== totalPlanned) {
          return { ...budgetLine, plannedAmount: totalPlanned };
        }
        return budgetLine;
      });
      return updatedBudgetLines;
    });
  }, [subBudgetLines]);

  // Automatically update grant planned amounts when budget lines change
  useEffect(() => {
    setGrants(prevGrants => {
      const updatedGrants = prevGrants.map(grant => {
        // Find related budget lines
        const grantBudgetLines = budgetLines.filter(line => line.grantId === grant.id);
        // Calculate the total planned amount from children
        const totalPlanned = grantBudgetLines.reduce((sum, line) => sum + (Number(line.plannedAmount) || 0), 0);
        
        // Only return a new object if the amount has actually changed
        if (grant.plannedAmount !== totalPlanned) {
          return { ...grant, plannedAmount: totalPlanned };
        }
        return grant;
      });
      return updatedGrants;
    });
  }, [budgetLines]);

  const handleLogout = () => {
    signOut();
    setActiveTab('dashboard');
    showToast('Déconnexion réussie');
  };

  // Grant management
  const handleAddGrant = async (grant: Omit<Grant, 'id'>) => {
    try {
      showLoading('Création de la subvention...');
      
      // Créer d'abord la subvention
      const newGrant = await grantsService.create({
        ...grant,
        plannedAmount: 0
      });
      
      setGrants(prev => [...prev, newGrant]);
      
      // ✅ Créer le compte bancaire UNIQUEMENT si la subvention a des infos bancaires
      if (grant.bankAccount) {
        try {
          const accountId = `grant-${newGrant.id}`;
          const newBankAccount = await bankAccountsService.create({
            id: accountId,
            name: grant.bankAccount.name,
            accountNumber: grant.bankAccount.accountNumber,
            bankName: grant.bankAccount.bankName,
            balance: grant.bankAccount.balance,
            lastUpdateDate: new Date().toISOString().split('T')[0]
          });
          
          setBankAccounts(prev => [...prev, newBankAccount]);
        } catch (error) {
          console.error('Error creating bank account for grant:', error);
          // Ne pas bloquer la création de la subvention si le compte échoue
          showToast('Subvention créée mais erreur avec le compte bancaire', 'warning');
        }
      }
      
      // Auto-select the new grant if it's the first one or if admin
      if (grants.length === 0 || isAdmin()) {
        handleSelectGrant(newGrant.id);
      }
      
      showSuccess('Subvention ajoutée', 'La nouvelle subvention a été créée avec succès');
    } catch (error) {
      showError('Erreur', 'Impossible de créer la subvention');
    } finally {
      closeLoading();
    }
  };

  const handleUpdateGrant = async (id: string, updates: Partial<Grant>) => {
    try {
      await grantsService.update(id, updates);
      setGrants(prev => prev.map(grant => 
        grant.id === id ? { ...grant, ...updates } : grant
      ));

      // ✅ Mettre à jour le compte bancaire associé si les infos bancaires changent
      if (updates.bankAccount) {
        const accountId = `grant-${id}`;
        const existingAccount = bankAccounts.find(acc => acc.id === accountId);
        
        if (existingAccount) {
          // Mettre à jour le compte existant
          await bankAccountsService.update(accountId, {
            name: updates.bankAccount.name,
            accountNumber: updates.bankAccount.accountNumber,
            bankName: updates.bankAccount.bankName,
            balance: updates.bankAccount.balance
          });
          
          setBankAccounts(prev => prev.map(acc => 
            acc.id === accountId ? { ...acc, ...updates.bankAccount } : acc
          ));
        } else if (updates.bankAccount) {
          // Créer un nouveau compte si il n'existe pas mais que des infos sont fournies
          const newBankAccount = await bankAccountsService.create({
            id: accountId,
            name: updates.bankAccount.name,
            accountNumber: updates.bankAccount.accountNumber,
            bankName: updates.bankAccount.bankName,
            balance: updates.bankAccount.balance,
            lastUpdateDate: new Date().toISOString().split('T')[0]
          });
          
          setBankAccounts(prev => [...prev, newBankAccount]);
        }
      }
      
      showSuccess('Subvention modifiée', 'Les modifications ont été enregistrées');
    } catch (error) {
      console.error('Erreur', 'Impossible de modifier la subvention');
    }
  };

  const handleDeleteGrant = async (id: string) => {
    try {
      await grantsService.delete(id);
      setGrants(prev => prev.filter(grant => grant.id !== id));
      
      // ✅ Supprimer le compte bancaire associé
      const accountId = `grant-${id}`;
      const accountToDelete = bankAccounts.find(acc => acc.id === accountId);
      if (accountToDelete) {
        await bankAccountsService.delete(accountId);
        setBankAccounts(prev => prev.filter(acc => acc.id !== accountId));
      }
      
      if (selectedGrantId === id) {
        const remainingGrants = grants.filter(grant => grant.id !== id);
        if (remainingGrants.length > 0) {
          // Sélectionner automatiquement la première subvention disponible
          handleSelectGrant(remainingGrants[0].id);
        } else {
          setSelectedGrantId('');
        }
      }
      showSuccess('Subvention supprimée', 'La subvention a été supprimée avec succès');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer la subvention');
    }
  };

  // ... (les autres fonctions de gestion restent inchangées)
  // Budget line management
  const handleAddBudgetLine = async (budgetLine: Omit<BudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => {
    try {
      const newBudgetLine = await budgetLinesService.create({
        ...budgetLine,
        engagedAmount: 0,
        availableAmount: budgetLine.notifiedAmount
      });
      setBudgetLines(prev => [...prev, newBudgetLine]);
      showSuccess('Ligne budgétaire ajoutée', 'La nouvelle ligne budgétaire a été créée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer la ligne budgétaire');
    }
  };

  const handleUpdateBudgetLine = async (id: string, updates: Partial<BudgetLine>) => {
    try {
      await budgetLinesService.update(id, updates);
      setBudgetLines(prev => prev.map(line => 
        line.id === id ? { ...line, ...updates } : line
      ));
    } catch (error) {
      showError('Erreur', 'Impossible de modifier la ligne budgétaire');
    }
  };

  const handleDeleteBudgetLine = async (id: string) => {
    try {
      await budgetLinesService.delete(id);
      setBudgetLines(prev => prev.filter(line => line.id !== id));
      setSubBudgetLines(prev => prev.filter(line => line.budgetLineId !== id));
      showSuccess('Ligne budgétaire supprimée', 'La ligne budgétaire et ses sous-lignes ont été supprimées');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer la ligne budgétaire');
    }
  };

  // Sub budget line management
  const handleAddSubBudgetLine = async (subBudgetLine: Omit<SubBudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => {
    try {
      const newSubBudgetLine = await subBudgetLinesService.create({
        ...subBudgetLine,
        engagedAmount: 0,
        availableAmount: subBudgetLine.notifiedAmount
      });
      setSubBudgetLines(prev => [...prev, newSubBudgetLine]);
      showSuccess('Sous-ligne budgétaire ajoutée', 'La nouvelle sous-ligne budgétaire a été créée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer la sous-ligne budgétaire');
    }
  };

  const handleUpdateSubBudgetLine = async (id: string, updates: Partial<SubBudgetLine>) => {
    try {
      await subBudgetLinesService.update(id, updates);
      setSubBudgetLines(prev => prev.map(line => 
        line.id === id ? { ...line, ...updates } : line
      ));
    } catch (error) {
      showError('Erreur', 'Impossible de modifier la sous-ligne budgétaire');
    }
  };

  const handleDeleteSubBudgetLine = async (id: string) => {
    try {
      await subBudgetLinesService.delete(id);
      setSubBudgetLines(prev => prev.filter(line => line.id !== id));
      showSuccess('Sous-ligne budgétaire supprimée', 'La sous-ligne budgétaire a été supprimée');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer la sous-ligne budgétaire');
    }
  };

  // Engagement management
  const handleAddEngagement = async (engagement: Omit<Engagement, 'id'>) => {
    try {
      const newEngagement = await engagementsService.create(engagement);
      setEngagements(prev => [...prev, newEngagement]);

      // Update sub budget line amounts
      const subBudgetLine = subBudgetLines.find(line => line.id === engagement.subBudgetLineId);
      if (subBudgetLine) {
        const newEngagedAmount = subBudgetLine.engagedAmount + engagement.amount;
        const updates = {
          engagedAmount: newEngagedAmount,
          availableAmount: subBudgetLine.notifiedAmount - newEngagedAmount
        };
        await subBudgetLinesService.update(engagement.subBudgetLineId, updates);
        setSubBudgetLines(prev => prev.map(line => 
          line.id === engagement.subBudgetLineId ? { ...line, ...updates } : line
        ));
      }

      // Update budget line amounts
      const budgetLine = budgetLines.find(line => line.id === engagement.budgetLineId);
      if (budgetLine) {
        const newEngagedAmount = budgetLine.engagedAmount + engagement.amount;
        const updates = {
          engagedAmount: newEngagedAmount,
          availableAmount: budgetLine.notifiedAmount - newEngagedAmount
        };
        await budgetLinesService.update(engagement.budgetLineId, updates);
        setBudgetLines(prev => prev.map(line => 
          line.id === engagement.budgetLineId ? { ...line, ...updates } : line
        ));
      }

      showSuccess('Engagement ajouté', 'Le nouvel engagement a été enregistré');
      setShowEngagementForm(false);
    } catch (error) {
      showError('Erreur', 'Impossible de créer l\'engagement');
    }
  };

  const handleUpdateEngagement = async (id: string, updates: Partial<Engagement>) => {
    try {
      const oldEngagement = engagements.find(eng => eng.id === id);
      if (!oldEngagement) return;

      await engagementsService.update(id, updates);
      setEngagements(prev => prev.map(eng => 
        eng.id === id ? { ...eng, ...updates } : eng
      ));

      // If amount changed, update budget line amounts
      if (updates.amount !== undefined && updates.amount !== oldEngagement.amount) {
        const amountDifference = updates.amount - oldEngagement.amount;

        // Update sub budget line
        const subBudgetLine = subBudgetLines.find(line => line.id === oldEngagement.subBudgetLineId);
        if (subBudgetLine) {
          const newEngagedAmount = subBudgetLine.engagedAmount + amountDifference;
          const subUpdates = {
            engagedAmount: newEngagedAmount,
            availableAmount: subBudgetLine.notifiedAmount - newEngagedAmount
          };
          await subBudgetLinesService.update(oldEngagement.subBudgetLineId, subUpdates);
          setSubBudgetLines(prev => prev.map(line => 
            line.id === oldEngagement.subBudgetLineId ? { ...line, ...subUpdates } : line
          ));
        }

        // Update budget line
        const budgetLine = budgetLines.find(line => line.id === oldEngagement.budgetLineId);
        if (budgetLine) {
          const newEngagedAmount = budgetLine.engagedAmount + amountDifference;
          const budgetUpdates = {
            engagedAmount: newEngagedAmount,
            availableAmount: budgetLine.notifiedAmount - newEngagedAmount
          };
          await budgetLinesService.update(oldEngagement.budgetLineId, budgetUpdates);
          setBudgetLines(prev => prev.map(line => 
            line.id === oldEngagement.budgetLineId ? { ...line, ...budgetUpdates } : line
          ));
        }
      }

      showSuccess('Engagement modifié', 'Les modifications ont été enregistrées');
      setShowEngagementForm(false);
      setEditingEngagement(null);
    } catch (error) {
      showError('Erreur', 'Impossible de modifier l\'engagement');
    }
  };

  // Payment management
  const handleAddPayment = async (paymentData: Omit<Payment, 'id'>) => {
      try {
          if (editingPayment) {
              // --- MODE MODIFICATION ---
              await paymentsService.update(editingPayment.id, paymentData);

              setPayments(prevPayments => prevPayments.map(p =>
                  p.id === editingPayment.id ? { ...p, ...paymentData } : p
              ));

              showSuccess('Paiement modifié', 'Les modifications ont été enregistrées avec succès.');
              setEditingPayment(null);

          } else {
              // --- MODE CRÉATION ---
              // Filtrer les signatures vides avant de sauvegarder
              const finalApprovals: any = {};
              const { approvals } = paymentData;

              if (approvals?.supervisor1?.signature) {
                  finalApprovals.supervisor1 = approvals.supervisor1;
              }
              if (approvals?.supervisor2?.signature) {
                  finalApprovals.supervisor2 = approvals.supervisor2;
              }

              const paymentToCreate = {
                  ...paymentData,
                  approvals: finalApprovals,
              };

              const newPayment = await paymentsService.create(paymentToCreate);
              setPayments(prev => [...prev, newPayment]);
              showSuccess('Paiement ajouté', 'Le nouveau paiement a été enregistré avec succès.');
          }

          setShowPaymentForm(false);
          setSelectedEngagement(null);

      } catch (error) {
          console.error("Erreur lors de la sauvegarde du paiement:", error);
          showError('Erreur de sauvegarde', editingPayment ? 'Impossible de modifier le paiement.' : 'Impossible de créer le paiement.');
      }
  };

  const handleUpdatePayment = async (id: string, updates: Partial<Payment>) => {
    try {
      await paymentsService.update(id, updates);
      setPayments(prev => prev.map(payment => 
        payment.id === id ? { ...payment, ...updates } : payment
      ));
      showSuccess('Paiement modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le paiement');
    }
  };

  const handleSignPayment = async (paymentId: string, updates: Partial<Payment>) => {
    try {
      await paymentsService.update(paymentId, updates);
      setPayments(prev => prev.map(payment =>
        payment.id === paymentId ? { ...payment, ...updates } : payment
      ));
    } catch (error) {
      showError('Erreur', 'Impossible d\'enregistrer la signature');
    }
  };

  // Treasury management
  const handleDeleteBankAccount = async (id: string) => {
    // Ne pas permettre la suppression des comptes liés aux subventions
    if (id.startsWith('grant-')) {
      showError('Suppression impossible', 'Ce compte est lié à une subvention. Modifiez la subvention pour changer les informations bancaires.');
      return;
    }
    
    try {
      await bankAccountsService.delete(id);
      setBankAccounts(prev => prev.filter(account => account.id !== id));
      showSuccess('Compte supprimé', 'Le compte bancaire a été supprimé');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer le compte bancaire');
    }
  };

  // Fonction handleAddBankTransaction
  const handleAddBankTransaction = async (transaction: Omit<BankTransaction, 'id'>) => {
    try {
      const newTransaction = await bankTransactionsService.create(transaction);
      setBankTransactions(prev => [...prev, newTransaction]);
    
      // Mettre à jour le solde de la subvention si c'est une transaction sur un compte de subvention
      if (transaction.accountId.startsWith('grant-')) {
        const grantId = transaction.accountId.replace('grant-', '');
        const grant = grants.find(g => g.id === grantId);
        
        if (grant && grant.bankAccount) {
          const newBalance = transaction.type === 'credit' 
            ? grant.bankAccount.balance + transaction.amount
            : grant.bankAccount.balance - transaction.amount;

          // Mettre à jour la subvention
          await grantsService.update(grantId, {
            bankAccount: {
              ...grant.bankAccount,
              balance: newBalance,
              lastUpdateDate: new Date().toISOString().split('T')[0]
            }
          });
          
          // Mettre à jour l'état local
          setGrants(prev => prev.map(g => 
            g.id === grantId && g.bankAccount
              ? { 
                  ...g, 
                  bankAccount: { 
                    ...g.bankAccount, 
                    balance: newBalance,
                    lastUpdateDate: new Date().toISOString().split('T')[0]
                  } 
                }
              : g
          ));
        }
      }
      
      showSuccess('Transaction ajoutée', 'La transaction a été enregistrée et le solde mis à jour');
    } catch (error) {
      console.error('Erreur détaillée:', error);
      showError('Erreur', 'Impossible d\'ajouter la transaction');
    }
  };

  // Prefinancing management
  const handleAddPrefinancing = async (prefinancing: Omit<Prefinancing, 'id'>) => {
    try {
      const newPrefinancing = await prefinancingsService.create(prefinancing);
      setPrefinancings(prev => [...prev, newPrefinancing]);
      showSuccess('Préfinancement ajouté', 'La demande de préfinancement a été enregistrée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer le préfinancement');
    }
  };

  const handleUpdatePrefinancing = async (id: string, updates: Partial<Prefinancing>) => {
    try {
      await prefinancingsService.update(id, updates);
      setPrefinancings(prev => prev.map(pref => 
        pref.id === id ? { ...pref, ...updates } : pref
      ));
      showSuccess('Préfinancement modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le préfinancement');
    }
  };

  const handleAddPrefinancingRepayment = async (prefinancingId: string, repayment: { date: string; amount: number; reference: string }) => {
    try {
      const prefinancing = prefinancings.find(p => p.id === prefinancingId);
      if (!prefinancing) return;
      
      const newRepayment = {
        ...repayment,
        id: String(Date.now())
      };
      const updatedRepayments = [...(prefinancing.repayments || []), newRepayment];
      const totalRepaid = updatedRepayments.reduce((sum, rep) => sum + rep.amount, 0);
      const newStatus = totalRepaid >= prefinancing.amount ? 'repaid' : prefinancing.status;
      
      await prefinancingsService.update(prefinancingId, {
        repayments: updatedRepayments,
        status: newStatus
      });
      
      setPrefinancings(prev => prev.map(pref => {
        if (pref.id === prefinancingId) {
          return {
            ...pref,
            repayments: updatedRepayments,
            status: newStatus
          };
        }
        return pref;
      }));
      
      showSuccess('Remboursement ajouté', 'Le remboursement a été enregistré');
    } catch (error) {
      showError('Erreur', 'Impossible d\'ajouter le remboursement');
    }
  };

  // Employee loan management
  const handleAddEmployeeLoan = async (loan: Omit<EmployeeLoan, 'id'>) => {
    try {
      const newLoan = await employeeLoansService.create(loan);
      setEmployeeLoans(prev => [...prev, newLoan]);
      showSuccess('Prêt employé ajouté', 'La demande de prêt a été enregistrée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer le prêt employé');
    }
  };

  const handleUpdateEmployeeLoan = async (id: string, updates: Partial<EmployeeLoan>) => {
    try {
      await employeeLoansService.update(id, updates);
      setEmployeeLoans(prev => prev.map(loan => 
        loan.id === id ? { ...loan, ...updates } : loan
      ));
      showSuccess('Prêt employé modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le prêt employé');
    }
  };

  const handleAddEmployeeLoanRepayment = async (loanId: string, repayment: { date: string; amount: number; reference: string }) => {
    try {
      const loan = employeeLoans.find(l => l.id === loanId);
      if (!loan) return;
      
      const newRepayment = {
        ...repayment,
        id: String(Date.now())
      };
      const updatedRepayments = [...loan.repayments, newRepayment];
      const totalRepaid = updatedRepayments.reduce((sum, rep) => sum + rep.amount, 0);
      const newStatus = totalRepaid >= loan.amount ? 'completed' : 'active';
      
      await employeeLoansService.update(loanId, {
        repayments: updatedRepayments,
        status: newStatus
      });
      
      setEmployeeLoans(prev => prev.map(l => {
        if (l.id === loanId) {
          return {
            ...l,
            repayments: updatedRepayments,
            status: newStatus
          };
        }
        return l;
      }));
      
      showSuccess('Remboursement ajouté', 'Le remboursement a été enregistré');
    } catch (error) {
      showError('Erreur', 'Impossible d\'ajouter le remboursement');
    }
  };

  // Bank account management
  const handleUpdateBankAccount = async (id: string, updates: Partial<BankAccount>) => {
    try {
      await bankAccountsService.update(id, updates);
      setBankAccounts(prev => prev.map(account => 
        account.id === id ? { ...account, ...updates } : account
      ));
      
      // Si c'est un compte lié à une subvention, mettre à jour aussi la subvention
      if (id.startsWith('grant-')) {
        const grantId = id.replace('grant-', '');
        const grant = grants.find(g => g.id === grantId);
        if (grant && grant.bankAccount) {
          await grantsService.update(grantId, {
            bankAccount: { 
              ...grant.bankAccount, 
              ...updates,
              balance: updates.balance !== undefined ? updates.balance : grant.bankAccount.balance
            }
          });
          setGrants(prev => prev.map(g => 
            g.id === grantId && g.bankAccount
              ? { 
                  ...g, 
                  bankAccount: { 
                    ...g.bankAccount, 
                    ...updates,
                    balance: updates.balance !== undefined ? updates.balance : g.bankAccount.balance
                  } 
                }
              : g
          ));
        }
      }
      
      showSuccess('Compte modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le compte bancaire');
    }
  };

  // User management
  const handleAddUser = async (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // For now, we'll add to local state since user creation requires auth signup
      const newUser = {
        ...user,
        id: String(users.length + 1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setUsers(prev => [...prev, newUser]);
      showSuccess('Utilisateur ajouté', 'Le nouvel utilisateur a été créé');
    } catch (error) {
      showError('Erreur', 'Impossible de créer l\'utilisateur');
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    try {
      await usersService.update(id, updates);
      setUsers(prev => prev.map(user => 
        user.id === id ? { ...user, ...updates } : user
      ));
      showSuccess('Utilisateur modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier l\'utilisateur');
    }
  };

  const handleDeleteUser = (id: string) => {
    setUsers(prev => prev.filter(user => user.id !== id));
    showSuccess('Utilisateur supprimé', 'L\'utilisateur a été supprimé');
  };

  // Role management
  const handleAddRole = async (role: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newRole = await rolesService.create(role);
      setRoles(prev => [...prev, newRole]);
      showSuccess('Rôle ajouté', 'Le nouveau rôle a été créé');
    } catch (error) {
      showError('Erreur', 'Impossible de créer le rôle');
    }
  };

  const handleUpdateRole = async (id: string, updates: Partial<UserRole>) => {
    try {
      await rolesService.update(id, updates);
      setRoles(prev => prev.map(role => 
        role.id === id ? { ...role, ...updates } : role
      ));
      showSuccess('Rôle modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le rôle');
    }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      await rolesService.delete(id);
      setRoles(prev => prev.filter(role => role.id !== id));
      showSuccess('Rôle supprimé', 'Le rôle a été supprimé');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer le rôle');
    }
  };

  const handleEditEngagement = (engagement: Engagement) => {
    const subBudgetLine = subBudgetLines.find(line => line.id === engagement.subBudgetLineId);
    if (subBudgetLine) {
      setSelectedSubBudgetLine(subBudgetLine);
      setEditingEngagement(engagement);
      setShowEngagementForm(true);
    }
  };

  const handleViewEngagements = (subBudgetLineId: string) => {
    const subBudgetLine = subBudgetLines.find(line => line.id === subBudgetLineId);
    if (subBudgetLine) {
      setSelectedSubBudgetLine(subBudgetLine);
      setShowEngagementDetails(true);
    }
  };

  const handleCreatePaymentFromEngagement = (engagementId: string) => {
    const engagement = engagements.find(eng => eng.id === engagementId);
    if (engagement) {
      setEditingPayment(null);
      setSelectedEngagement(engagement);
      setShowPaymentForm(true);
    }
  };

  const handleEditPayment = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      setEditingPayment(payment);
      const engagement = engagements.find(eng => eng.id === payment.engagementId);
      if (engagement) {
        setSelectedEngagement(engagement);
        setShowPaymentForm(true);
      }
    }
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      setSelectedPaymentForView(payment);
      setShowPaymentDetails(true);
    } else {
      console.error('Paiement non trouvé:', paymentId);
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de Budget BASE...</p>
          <p className="text-xs text-gray-500 mt-2">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return <LoginForm />;
  }

  if (user && !userProfile && !authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du profil utilisateur...</p>
        </div>
      </div>
    );
  }

  // Show loading screen while loading data
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  // Définition des items de menu
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: BarChart3, module: 'dashboard' },
    { id: 'grants', label: 'Gestion des Subventions', icon: Banknote, module: 'grants' },
    { id: 'budget_planning', label: 'Planification', icon: Target, module: 'budget_planning' },
    { id: 'tracking', label: 'Suivi Budgétaire', icon: BarChart3, module: 'tracking' },
    {id: 'engagements', 
      label: 'Engagements', 
      icon: FileText, 
      module: 'engagements',
      notificationCount: engagementNotificationCount > 0 ? engagementNotificationCount : undefined
    },
    { 
      id: 'payments', 
      label: 'Paiements', 
      icon: CreditCard, 
      module: 'payments',
      notificationCount: paymentNotificationCount > 0 ? paymentNotificationCount : undefined
    },
    { 
      id: 'prefinancing', 
      label: 'Préfinancements', 
      icon: ArrowRightLeft, 
      module: 'prefinancing',
      notificationCount: prefinancingNotificationCount > 0 ? prefinancingNotificationCount : undefined
    },
    { 
      id: 'employee-loans', 
      label: 'Prêts Employés', 
      icon: DollarSign, 
      module: 'employee_loans',
      notificationCount: employeeLoanNotificationCount > 0 ? employeeLoanNotificationCount : undefined
    },
    { id: 'treasury', label: 'Trésorerie', icon: Banknote, module: 'treasury' },
    { id: 'reports', label: 'Rapports', icon: FileText, module: 'reports' },
    { id: 'users', label: 'Utilisateurs', icon: Users, module: 'users' },
    { id: 'globalConfig', label: 'Configuration', icon: Settings, module: 'globalConfig' },
    { id: 'profile', label: 'Mon Profil', icon: Users, module: 'profile' }
  ];

  // Filtrage basé sur les permissions réelles
  const availableMenuItems = menuItems.filter(item => 
    hasModuleAccess(item.module)
  );

  if (!userProfile) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Profil utilisateur non disponible</p>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - Fixed */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 shadow-xl border-b border-indigo-600 fixed top-0 left-0 right-0 z-50">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <div className="relative w-20 h-8">
                    <img
                      src="/budgetbase/logo.png"
                      alt="Logo"
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-white">Budget BASE</h1>
                  <p className="text-xs text-indigo-200">Gestion Budgétaire Intelligente</p>
                </div>
              </div>

              {/* Global Grant Selector */}
              {selectedGrant && (
                <div className="hidden md:flex items-center space-x-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                  <Settings className="w-4 h-4 text-indigo-200" />
                  <div>
                    <p className="text-xs text-indigo-200 font-medium">Subvention Active</p>
                    <p className="text-sm font-semibold text-white">{selectedGrant.name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Notification - Version desktop */}
              <div className="hidden md:block">
                {hasAnyNotifications && (
                  <div className="relative">
                    <div className="flex items-center space-x-2 bg-orange-500/90 backdrop-blur-sm border border-orange-300 rounded-full px-3 py-1 shadow-lg">
                      <AlertTriangle className="w-4 h-4 text-white" />
                      <span className="text-sm font-medium text-white">
                        {totalNotifications} signature(s) en attente
                      </span>
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification - Version mobile */}
              <div className="md:hidden">
                {hasAnyNotifications && (
                  <div className="relative">
                    <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors backdrop-blur-sm">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-white text-xs text-orange-600 font-bold items-center justify-center">
                          {totalNotifications}
                        </span>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="xl:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors backdrop-blur-sm"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="hidden xl:block text-right">
                <p className="text-sm font-medium text-white">
                  {userProfile.firstName} {userProfile.lastName}
                </p>
                <p className="text-xs text-indigo-200">{userRole?.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="hidden lg:block p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors backdrop-blur-sm"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 pt-16">
        {/* Sidebar - Fixed with independent scrolling */}
        <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0 fixed xl:sticky top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-gradient-to-b from-indigo-800 to-purple-900 shadow-2xl border-r border-indigo-700/50 transform transition-transform duration-300 ease-in-out z-40 flex flex-col`}>
          {/* Mobile Header Info */}
          <div className="xl:hidden p-6 border-b border-indigo-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="relative w-20 h-8">
                  <img
                    src="/budgetbase/logo.png"
                    alt="Logo"
                    className="object-contain"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Budget BASE</h1>
                <p className="text-xs text-indigo-200">Gestion Budgétaire</p>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20">
              <p className="text-sm font-medium text-white">
                {userProfile.firstName} {userProfile.lastName}
              </p>
              <p className="text-xs text-indigo-200">{userRole?.name}</p>
            </div>
          </div>

          {/* Navigation avec défilement indépendant */}
          <nav className="flex-1 overflow-y-auto py-6 px-4">
            <div className="space-y-2">
              {availableMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-sm border border-white/20 shadow-lg'
                        : 'text-indigo-100 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-5 h-5 transition-colors ${
                        activeTab === item.id ? 'text-white' : 'text-indigo-300 group-hover:text-white'
                      }`} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    
                    {/* Badge de notification */}
                    {item.notificationCount && item.notificationCount > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-bold leading-none rounded-full transition-all ${
                        activeTab === item.id 
                          ? 'bg-white text-purple-600 shadow-lg' 
                          : 'bg-orange-500 text-white group-hover:bg-orange-400'
                      }`}>
                        {item.notificationCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Logout Button - Only for mobile */}
          <div className="xl:hidden p-4 border-t border-indigo-700/50 bg-indigo-900/50">
            <button
              onClick={() => {
                handleLogout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 text-red-300 hover:bg-red-500/20 hover:text-red-100 border border-transparent hover:border-red-400/30"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="xl:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0 xl:ml-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activeTab === 'dashboard' && (
              <Dashboard 
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                payments={payments}
                prefinancings={prefinancings}
                employeeLoans={employeeLoans}
                engagements={filteredData.engagements}
              />
            )}

            {activeTab === 'grants' && (
              <GrantManager
                grants={grants}
                budgetLines={budgetLines}
                subBudgetLines={subBudgetLines}
                payments={payments}
                prefinancings={prefinancings}
                employeeLoans={employeeLoans}
                onAddGrant={handleAddGrant}
                onUpdateGrant={handleUpdateGrant}
                onDeleteGrant={handleDeleteGrant}
                onUpdateBudgetLine={handleUpdateBudgetLine}
                onUpdateSubBudgetLine={handleUpdateSubBudgetLine}
              />
            )}
            
            {activeTab === 'globalConfig' && (
              <GrantSelector
                grants={grants}
                selectedGrantId={selectedGrantId}
                onSelectGrant={handleSelectGrant}
                isAdmin={isAdmin()}
              />
            )}

            {activeTab === 'profile' && (
              <UserProfile />
            )}

            {activeTab === 'budget_planning' && (
              <BudgetPlanning
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                onAddBudgetLine={handleAddBudgetLine}
                onAddSubBudgetLine={handleAddSubBudgetLine}
                onUpdateBudgetLine={handleUpdateBudgetLine}
                onUpdateSubBudgetLine={handleUpdateSubBudgetLine}
                onDeleteBudgetLine={handleDeleteBudgetLine}
                onDeleteSubBudgetLine={handleDeleteSubBudgetLine}
              />
            )}

            {activeTab === 'tracking' && (
              <BudgetTracking
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                payments={payments}
                prefinancings={prefinancings}
                employeeLoans={employeeLoans}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                engagements={filteredData.engagements}
                selectedGrantId={selectedGrantId}
                onViewEngagements={handleViewEngagements}
              />
            )}

            {activeTab === 'engagements' && (
              <EngagementManager
                engagements={filteredData.engagements}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                onAddEngagement={handleAddEngagement}
                onUpdateEngagement={handleUpdateEngagement}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentManager
                payments={filteredData.payments}
                engagements={filteredData.engagements}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                bankAccounts={bankAccounts}
                selectedGrantId={selectedGrantId}
                onAddPayment={handleAddPayment}
                onUpdatePayment={handleUpdatePayment}
                onViewPaymentDetails={handleViewPaymentDetails}
                onEditPayment={handleEditPayment}
                onCreatePaymentFromEngagement={handleCreatePaymentFromEngagement}
              />
            )}

            {activeTab === 'treasury' && (
             <TreasuryManager
                payments={filteredData.payments}
                bankTransactions={bankTransactions}
                selectedGrant={selectedGrant}
                onAddBankTransaction={handleAddBankTransaction}
                onUpdateGrant={handleUpdateGrant}
              />
            )}

            {activeTab === 'prefinancing' && (
              <PrefinancingManager
                prefinancings={filteredData.prefinancings}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                bankAccounts={bankAccounts}
                onAddPrefinancing={handleAddPrefinancing}
                onUpdatePrefinancing={handleUpdatePrefinancing}
                onAddPrefinancingRepayment={handleAddPrefinancingRepayment}
              />
            )}

            {activeTab === 'employee-loans' && (
              <EmployeeLoanManager
                loans={filteredData.employeeLoans}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                selectedGrantId={selectedGrantId}
                onAddLoan={handleAddEmployeeLoan}
                onUpdateLoan={handleUpdateEmployeeLoan}
                onAddRepayment={handleAddEmployeeLoanRepayment}
              />
            )}

            {activeTab === 'reports' && (
              <Reports
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                expenses={filteredData.engagements}
                payments={filteredData.payments}
                employeeLoans={filteredData.employeeLoans}
                prefinancings={filteredData.prefinancings}
              />
            )}

            {activeTab === 'users' && (
              <UserManager
                users={users}
                roles={roles}
                currentUser={userProfile}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                onAddRole={handleAddRole}
                onUpdateRole={handleUpdateRole}
                onDeleteRole={handleDeleteRole}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEngagementForm && selectedSubBudgetLine && (
        <EngagementForm
          subBudgetLine={selectedSubBudgetLine}
          budgetLine={budgetLines.find(line => line.id === selectedSubBudgetLine.budgetLineId)!}
          grant={grants.find(grant => grant.id === selectedSubBudgetLine.grantId)!}
          onSave={handleAddEngagement}
          onCancel={() => {
            setShowEngagementForm(false);
            setSelectedSubBudgetLine(null);
            setEditingEngagement(null);
          }}
          editingEngagement={editingEngagement}
        />
      )}

      {showPaymentForm && selectedEngagement && (
        <PaymentForm
          engagement={selectedEngagement}
          subBudgetLine={subBudgetLines.find(line => line.id === selectedEngagement.subBudgetLineId)!}
          budgetLine={budgetLines.find(line => line.id === selectedEngagement.budgetLineId)!}
          grant={grants.find(grant => grant.id === selectedEngagement.grantId)!}
          bankAccounts={bankAccounts}
          existingPayments={payments}
          onSave={handleAddPayment}
          onSign={handleSignPayment} 
          onCancel={() => {
            setShowPaymentForm(false);
            setSelectedEngagement(null);
            setEditingPayment(null);
          }}
          editingPayment={editingPayment}
        />
      )}

      {showPaymentDetails && selectedPaymentForView && (
        <PaymentDetailsView
          payment={selectedPaymentForView}
          engagement={engagements.find(e => e.id === selectedPaymentForView.engagementId)!}
          subBudgetLine={subBudgetLines.find(sbl => sbl.id === selectedPaymentForView.subBudgetLineId)!}
          budgetLine={budgetLines.find(bl => bl.id === selectedPaymentForView.budgetLineId)!}
          grant={grants.find(g => g.id === selectedPaymentForView.grantId)!}
          onClose={() => {
            setShowPaymentDetails(false);
            setSelectedPaymentForView(null);
          }}
        />
      )}

      {showEngagementDetails && selectedSubBudgetLine && (
        <EngagementDetails
          subBudgetLine={selectedSubBudgetLine}
          budgetLine={budgetLines.find(line => line.id === selectedSubBudgetLine.budgetLineId)!}
          engagements={engagements.filter(eng => eng.subBudgetLineId === selectedSubBudgetLine.id)}
          onClose={() => {
            setShowEngagementDetails(false);
            setSelectedSubBudgetLine(null);
          }}
          onEditEngagement={handleEditEngagement}
          currency={selectedGrant ? selectedGrant.currency : 'EUR'}
        />
      )}
    </div>
  );
}

export default App;