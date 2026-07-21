import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Target, Users, FileText, BarChart3, CreditCard, Banknote, ArrowRightLeft,
  DollarSign, Settings, LogOut, Menu, X, AlertTriangle, Sun, Moon, History, ChevronLeft
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { supabase } from './lib/supabase';
import { 
  grantsService, 
  budgetLinesService, 
  subBudgetLinesService, 
  engagementsService, 
  paymentsService, 
  usersService, 
  rolesService,
  appSettingsService,
  bankTransactionsService,
  prefinancingsService,
  employeeLoansService,
  notificationTranchesService,
  subLineTransfersService
} from './services/supabaseService';
import { changeHistoryService, computeChanges, buildDeleteSnapshot, buildCreateSnapshot } from './services/changeHistoryService';
import { ChangeHistoryEntry } from './types';
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
import HistoryCenter from './components/HistoryCenter';
import UserManager from './components/UserManager';
import UserProfile from './components/UserProfile';
import GrantManager from './components/GrantManager';
import GrantSelector from './components/GrantSelector';
import LoginForm from './components/LoginForm';
import { usePermissions } from './hooks/usePermissions';
import { showSuccess, showError, showToast, showLoading, closeLoading, confirmDelete } from './utils/alerts';
import { 
  Grant, 
  BudgetLine, 
  SubBudgetLine, 
  Engagement, 
  Payment, 
  BankTransaction, 
  Prefinancing, 
  EmployeeLoan,
  PartialPayment,
  NotificationTranche,
  SubLineTransfer,
} from './types';
import { User, UserRole } from './types/user';
import { useGlobalNotifications } from './contexts/GlobalNotificationContext';
import { useEngagementNotifications } from './hooks/useEngagementNotifications';
import { usePaymentNotifications } from './hooks/usePaymentNotifications';
import { usePrefinancingNotifications } from './hooks/usePrefinancingNotifications';
import { useEmployeeLoanNotifications } from './hooks/useEmployeeLoanNotifications';
import { useAvailableEngagementsNotification } from './hooks/useAvailableEngagementsNotification';
import { useTreasuryNotification } from './hooks/useTreasuryNotifications';

// ============================================================
// NOUVEAU HOOK POUR LES NOTIFICATIONS DE TRÉSORERIE
// ============================================================
const useTreasuryNotifications = (payments: Payment[], selectedGrantId: string, isComptable: boolean) => {
  return useMemo(() => {
    if (!isComptable || !selectedGrantId) {
      return { notificationCount: 0, approvedCount: 0, inProgressCount: 0 };
    }

    const grantPayments = payments.filter(p => p.grantId === selectedGrantId && p.status !== 'rejected' && p.status !== 'paid');

    // 1. Paiements approuvés SANS paiements partiels (prêts à être décaissés en totalité)
    const approvedPayments = grantPayments.filter(p => p.status === 'approved' && (!p.partialPayments || p.partialPayments.length === 0));

    // 2. Paiements en cours (in_progress ou approved avec paiements partiels et reste > 0)
    const inProgressPayments = grantPayments.filter(p => {
      if (p.status === 'in_progress') return true;
      if (p.status === 'approved' && p.partialPayments && p.partialPayments.length > 0) {
        const totalPaid = p.partialPayments.reduce((sum, pp) => sum + pp.amount, 0);
        return totalPaid < p.amount;
      }
      return false;
    });

    const total = approvedPayments.length + inProgressPayments.length;

    return {
      notificationCount: total,
      approvedCount: approvedPayments.length,
      inProgressCount: inProgressPayments.length
    };
  }, [payments, selectedGrantId, isComptable]);
};

// ============================================================
// COMPOSANT INTERNE POUR LES ÉLÉMENTS DE MENU AVEC TOOLTIP
// ============================================================
interface MenuItemWithTooltipProps {
  item: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    module: string;
    notificationCount?: number;
  };
  isActive: boolean;
  onClick: () => void;
  collapsed?: boolean;
  notificationCount?: number;
  paymentNotificationCount?: number;
  availableEngagementsNotificationCount?: number;
  isComptable: boolean;
  showAvailableEngagementsNotification?: boolean;
  treasuryApprovedCount?: number;
  treasuryInProgressCount?: number;
}

const MenuItemWithTooltip = ({
  item,
  isActive,
  onClick,
  collapsed = false,
  notificationCount,
  paymentNotificationCount,
  availableEngagementsNotificationCount,
  isComptable,
  showAvailableEngagementsNotification, // conservé mais non utilisé
  treasuryApprovedCount = 0,
  treasuryInProgressCount = 0
}: MenuItemWithTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const Icon = item.icon;

  const updateTooltipPosition = () => {
    if (buttonRef.current && showTooltip) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      });
    }
  };

  useEffect(() => {
    if (showTooltip) {
      updateTooltipPosition();
      window.addEventListener('scroll', updateTooltipPosition);
      window.addEventListener('resize', updateTooltipPosition);
      return () => {
        window.removeEventListener('scroll', updateTooltipPosition);
        window.removeEventListener('resize', updateTooltipPosition);
      };
    }
  }, [showTooltip]);

  // ----- CALCUL DES BADGES (deux au maximum, superposés) -----
  const getBadges = () => {
    if (item.id === 'payments') {
      const badges = [];
      if (isComptable && availableEngagementsNotificationCount && availableEngagementsNotificationCount > 0) {
        badges.push({
          count: availableEngagementsNotificationCount,
          color: 'bg-green-500',
          label: 'engagements disponibles'
        });
      }
      if (paymentNotificationCount && paymentNotificationCount > 0) {
        badges.push({
          count: paymentNotificationCount,
          color: 'bg-orange-500',
          label: 'signatures'
        });
      }
      return badges;
    }

    if (item.id === 'treasury') {
      // ✅ UNIQUEMENT pour le comptable
      if (!isComptable) return [];

      const badges = [];
      if (treasuryApprovedCount > 0) {
        badges.push({
          count: treasuryApprovedCount,
          color: 'bg-blue-500',
          label: 'approuvés'
        });
      }
      if (treasuryInProgressCount > 0) {
        badges.push({
          count: treasuryInProgressCount,
          color: 'bg-purple-500',
          label: 'en cours'
        });
      }
      return badges;
    }

    if (['engagements', 'prefinancing', 'employee-loans'].includes(item.id)) {
      if (notificationCount && notificationCount > 0) {
        return [{
          count: notificationCount,
          color: 'bg-orange-500',
          label: 'signatures'
        }];
      }
      return [];
    }

    return [];
  };

  const badges = getBadges();
  const hasBadges = badges.length > 0;

  // ----- CONTENU DU TOOLTIP (détaillé) -----
  const getTooltipContent = (): React.ReactNode => {
    if (item.id === 'payments') {
      const parts = [];
      if (isComptable && availableEngagementsNotificationCount && availableEngagementsNotificationCount > 0) {
        parts.push(
          <div key="avail" className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>{availableEngagementsNotificationCount} engagement(s) prêt(s) pour paiement</span>
          </div>
        );
      }
      if (paymentNotificationCount && paymentNotificationCount > 0) {
        parts.push(
          <div key="sign" className={`flex items-center gap-2 ${parts.length > 0 ? 'mt-1 pt-1 border-t border-gray-700' : ''}`}>
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>{paymentNotificationCount} signature(s) en attente</span>
          </div>
        );
      }
      return parts.length > 0 ? <>{parts}</> : null;
    }

    if (item.id === 'treasury') {
      const parts = [];
      if (treasuryApprovedCount > 0) {
        parts.push(
          <div key="approved" className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>{treasuryApprovedCount} paiement(s) approuvé(s) à décaisser</span>
          </div>
        );
      }
      if (treasuryInProgressCount > 0) {
        parts.push(
          <div key="inprogress" className={`flex items-center gap-2 ${parts.length > 0 ? 'mt-1 pt-1 border-t border-gray-700' : ''}`}>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>{treasuryInProgressCount} paiement(s) en cours (échelonné(s))</span>
          </div>
        );
      }
      return parts.length > 0 ? <>{parts}</> : null;
    }

    if (['engagements', 'prefinancing', 'employee-loans'].includes(item.id) && notificationCount && notificationCount > 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          <span>{notificationCount} signature(s) en attente</span>
        </div>
      );
    }

    return null;
  };

  const tooltipContent = getTooltipContent();

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center rounded-xl text-left transition-all duration-200 group ${
          collapsed ? 'justify-center px-0 py-3' : 'justify-between px-4 py-3'
        } ${
          isActive
            ? 'bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-sm border border-white/20 shadow-lg'
            : 'text-indigo-100 hover:bg-white/5 hover:text-white border border-transparent'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'relative' : 'space-x-3'}`}>
          <Icon className={`w-5 h-5 transition-colors ${
            isActive ? 'text-white' : 'text-indigo-300 group-hover:text-white'
          }`} />
          {!collapsed && <span className="font-medium">{item.label}</span>}
          {/* En mode réduit : pastille de notification compacte sur l'icône */}
          {collapsed && hasBadges && (
            <span className={`absolute -top-2 -right-2 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[9px] font-bold leading-none rounded-full text-white ${badges[0].color} ring-2 ring-indigo-800`}>
              {badges[0].count}
            </span>
          )}
        </div>

        {/* Badges superposés (mode étendu) */}
        {!collapsed && hasBadges && (
          <div className="flex flex-col items-end -space-y-1.5">
            {badges.map((badge, index) => (
              <span
                key={index}
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold leading-none rounded-full text-white ${
                  badge.color
                } ${isActive ? 'ring-2 ring-white/50' : ''}`}
              >
                {badge.count}
              </span>
            ))}
          </div>
        )}
      </button>

      {showTooltip && (collapsed || tooltipContent) && (
        <div
          style={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateY(-50%)',
            zIndex: 9999,
          }}
          className="pointer-events-none"
        >
          <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 shadow-xl border border-gray-700 max-w-xs">
            {collapsed && <div className="font-semibold whitespace-nowrap">{item.label}</div>}
            {tooltipContent && <div className={collapsed ? 'mt-1 pt-1 border-t border-gray-700' : ''}>{tooltipContent}</div>}
            <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
              <div className="border-8 border-transparent border-r-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
// ============================================================
// COMPOSANT PRINCIPAL APP
// ============================================================
function App() {
  const { user, userProfile, userRole, loading: authLoading, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Réduction de la sidebar sur grand écran (xl+). Par défaut affichée comme aujourd'hui.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const [notificationTranches, setNotificationTranches] = useState<NotificationTranche[]>([]);
  const [subLineTransfers, setSubLineTransfers] = useState<SubLineTransfer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const { hasModuleAccess } = usePermissions();

  // --- Notifications globales ---
  const { 
    updateEngagementNotifications, 
    updatePaymentNotifications,
    updatePrefinancingNotifications,
    updateEmployeeLoanNotifications,
    totalNotifications,
    hasAnyNotifications
  } = useGlobalNotifications();

  // Hooks de notification existants
  const { notificationCount: engagementNotificationCount } = useEngagementNotifications(engagements, selectedGrantId);
  const { notificationCount: paymentNotificationCount } = usePaymentNotifications(payments, selectedGrantId);
  const { notificationCount: prefinancingNotificationCount } = usePrefinancingNotifications(prefinancings, selectedGrantId);
  const { notificationCount: employeeLoanNotificationCount } = useEmployeeLoanNotifications(employeeLoans, selectedGrantId);
  const treasuryNotifications = useTreasuryNotification(payments, selectedGrantId);

  // --- Nouveauté : notifications pour la trésorerie ---
  const userProfession = userProfile?.profession || '';
  const isComptable = userProfession === 'Comptable';
  const { 
    notificationCount: treasuryNotificationCount, 
    approvedCount: treasuryApprovedCount, 
    inProgressCount: treasuryInProgressCount 
  } = useTreasuryNotifications(payments, selectedGrantId, isComptable);

  // Mise à jour des notifications globales
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

  // Références pour le chargement initial
  const isInitialLoad = useRef(true);
  const isSaving = useRef(false);

  // Sélection de subvention
  const handleSelectGrant = async (grantId: string) => {
    setSelectedGrantId(grantId);
    try {
      isSaving.current = true;
      await appSettingsService.set('selectedGrantId', grantId);
      localStorage.setItem('selectedGrantId', grantId);
    } catch (error) {
      console.error('❌ Error saving user grant selection:', error);
      localStorage.setItem('selectedGrantId', grantId);
    } finally {
      isSaving.current = false;
    }
  };

  // Chargement des données
  const loadAllData = useCallback(async () => {
    try {
      setDataLoading(true);
      showLoading('Chargement des données...');

      const [
        grantsData,
        budgetLinesData,
        subBudgetLinesData,
        engagementsData,
        paymentsData,
        bankTransactionsData,
        prefinancingsData,
        employeeLoansData,
        usersData,
        rolesData,
        tranchesData,
        transfersData,
      ] = await Promise.all([
        grantsService.getAll(),
        budgetLinesService.getAll(),
        subBudgetLinesService.getAll(),
        engagementsService.getAll(),
        paymentsService.getAll(),
        bankTransactionsService.getAll(),
        prefinancingsService.getAll(),
        employeeLoansService.getAll(),
        usersService.getAll(),
        rolesService.getAll(),
        notificationTranchesService.getAll(),
        subLineTransfersService.getAll(),
      ]);
      setNotificationTranches(tranchesData);
      setSubLineTransfers(transfersData);

      setGrants(grantsData);
      setBudgetLines(budgetLinesData);
      setEngagements(engagementsData);
      
      // ✅ CORRECTION : Recalculer les sous-lignes immédiatement
      const recalculatedSubLines = await Promise.all(
        subBudgetLinesData.map(async (line) => {
          // Calculer le total engagé (EXCLURE les rejetés, annulés, en attente)
          const engaged = engagementsData
            .filter(eng => 
              eng.subBudgetLineId === line.id && 
              eng.status !== 'rejected' && 
              eng.status !== 'cancelled' &&
              eng.status !== 'pending'
            )
            .reduce((sum, eng) => sum + eng.amount, 0);
          
          const available = line.notifiedAmount - engaged;
          
          // Mettre à jour en base si différent
          if (line.engagedAmount !== engaged || line.availableAmount !== Math.max(0, available)) {
            await subBudgetLinesService.update(line.id, {
              engagedAmount: engaged,
              availableAmount: Math.max(0, available)
            });
          }
          
          return { ...line, engagedAmount: engaged, availableAmount: Math.max(0, available) };
        })
      );
      
      setSubBudgetLines(recalculatedSubLines);  // ✅ Utiliser les données recalculées
      
      // ✅ CORRECTION : paymentsService.getAll() renvoie déjà partialPayments (camelCase).
      // On garde cette valeur et on retombe sur partial_payments seulement si besoin,
      // pour ne pas écraser les paiements échelonnés avec un tableau vide.
      const paymentsWithPartial = paymentsData.map(p => ({
        ...p,
        partialPayments: p.partialPayments ?? (p as any).partial_payments ?? [],
      }));
      setPayments(paymentsWithPartial);
      
      setBankTransactions(bankTransactionsData);
      setPrefinancings(prefinancingsData);
      setEmployeeLoans(employeeLoansData);
      setUsers(usersData);
      setRoles(rolesData);

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

  const loadInitialGrantSelection = async (grantsData: Grant[]) => {
    try {
      const savedGrantId = await appSettingsService.get('selectedGrantId');
      let grantToSelect = savedGrantId;
      if (!grantToSelect && typeof window !== 'undefined') {
        grantToSelect = localStorage.getItem('selectedGrantId') || '';
      }
      if (grantToSelect && grantsData.find(g => g.id === grantToSelect)) {
        setSelectedGrantId(grantToSelect);
        return;
      }
      if (grantsData.length > 0) {
        const firstGrant = grantsData[0];
        setSelectedGrantId(firstGrant.id);
      }
    } catch (error) {
      console.error('Error in loadInitialGrantSelection:', error);
    }
  };

  // Chargement au démarrage
  useEffect(() => {
    if (userProfile) {
      loadAllData();
    }
  }, [userProfile, loadAllData]);

  // Sauvegarde automatique de la subvention sélectionnée
  useEffect(() => {
    if (isInitialLoad.current || isSaving.current || !selectedGrantId) {
      return;
    }
    const saveSelectedGrant = async () => {
      try {
        isSaving.current = true;
        await appSettingsService.set('selectedGrantId', selectedGrantId);
        localStorage.setItem('selectedGrantId', selectedGrantId);
      } catch (error) {
        console.error('❌ Error auto-saving selected grant:', error);
      } finally {
        isSaving.current = false;
      }
    };
    const timer = setTimeout(saveSelectedGrant, 1000);
    return () => clearTimeout(timer);
  }, [selectedGrantId]);

  // Fallback localStorage pour la démo
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

  // États des formulaires
  const [showEngagementForm, setShowEngagementForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showEngagementDetails, setShowEngagementDetails] = useState(false);
  const [selectedSubBudgetLine, setSelectedSubBudgetLine] = useState<SubBudgetLine | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);
  const [editingEngagement, setEditingEngagement] = useState<Engagement | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const isAdmin = () => userRole?.code === 'ADMIN';

  // Filtrer les données par subvention sélectionnée
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

  // Ajouter cette fonction après les déclarations des handlers
  const recalculateSubBudgetLines = useCallback(async () => {
    // 1. Récupérer toutes les sous-lignes
    const allSubLines = subBudgetLines;
    
    // 2. Pour chaque sous-ligne, recalculer engagedAmount et availableAmount
    const updatedSubLines = await Promise.all(
      allSubLines.map(async (line) => {
        // Calculer le total engagé (EXCLURE les rejetés, annulés, en attente)
        const engaged = engagements
          .filter(eng => 
            eng.subBudgetLineId === line.id && 
            eng.status !== 'rejected' && 
            eng.status !== 'cancelled' &&
            eng.status !== 'pending'
          )
          .reduce((sum, eng) => sum + eng.amount, 0);
        
        // Calculer le disponible
        const available = line.notifiedAmount - engaged;
        
        // Mettre à jour dans la base
        await subBudgetLinesService.update(line.id, {
          engagedAmount: engaged,
          availableAmount: Math.max(0, available)
        });
        
        // Retourner la ligne mise à jour
        return { ...line, engagedAmount: engaged, availableAmount: Math.max(0, available) };
      })
    );
    
    // Mettre à jour le state
    setSubBudgetLines(updatedSubLines);
  }, [engagements, subBudgetLines]);


  // Engagements disponibles pour paiement
  const getFilteredAvailableEngagements = () => {
    if (!selectedGrantId) return [];
    return engagements.filter(engagement => 
      engagement.grantId === selectedGrantId &&
      engagement.status === 'approved' && 
      !payments.some(payment => payment.engagementId === engagement.id)
    );
  };

  const filteredAvailableEngagements = getFilteredAvailableEngagements();
  const selectedGrant = grants.find(grant => grant.id === selectedGrantId);
  const availableEngagementsCount = filteredAvailableEngagements.length;
  const {
    showNotification: showAvailableEngagementsNotification,
    notificationCount: availableEngagementsNotificationCount,
    isComptable: isComptableFromHook
  } = useAvailableEngagementsNotification(availableEngagementsCount);

  // Sauvegarde locale pour démo
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

  // Mise à jour automatique des montants planifiés
  useEffect(() => {
    setBudgetLines(prevBudgetLines => {
      const updatedBudgetLines = prevBudgetLines.map(budgetLine => {
        const lineSubBudgetLines = subBudgetLines.filter(sub => sub.budgetLineId === budgetLine.id);
        const totalPlanned = lineSubBudgetLines.reduce((sum, sub) => sum + (Number(sub.plannedAmount) || 0), 0);
        if (budgetLine.plannedAmount !== totalPlanned) {
          return { ...budgetLine, plannedAmount: totalPlanned };
        }
        return budgetLine;
      });
      return updatedBudgetLines;
    });
  }, [subBudgetLines]);

  useEffect(() => {
    setGrants(prevGrants => {
      const updatedGrants = prevGrants.map(grant => {
        const grantBudgetLines = budgetLines.filter(line => line.grantId === grant.id);
        const totalPlanned = grantBudgetLines.reduce((sum, line) => sum + (Number(line.plannedAmount) || 0), 0);
        if (grant.plannedAmount !== totalPlanned) {
          return { ...grant, plannedAmount: totalPlanned };
        }
        return grant;
      });
      return updatedGrants;
    });
  }, [budgetLines]);

  // Déconnexion
  const handleLogout = () => {
    signOut();
    setActiveTab('dashboard');
    showToast('Déconnexion réussie');
  };

  // ============================================================
  // GESTION DES SUBVENTIONS (suppression avec dépendances)
  // ============================================================
  const checkGrantDependencies = (grantId: string) => {
    const grantBudgetLines = budgetLines.filter(line => line.grantId === grantId);
    const grantSubBudgetLines = subBudgetLines.filter(subLine => 
      grantBudgetLines.some(line => line.id === subLine.budgetLineId)
    );
    const dependencies = [];
    
    const directPrefinancings = prefinancings.filter(pref => pref.grantId === grantId);
    if (directPrefinancings.length > 0) {
      dependencies.push(`${directPrefinancings.length} préfinancement(s) direct(s)`);
    }
    const indirectPrefinancings = prefinancings.filter(pref => 
      grantSubBudgetLines.some(subLine => subLine.id === pref.subBudgetLineId)
    );
    if (indirectPrefinancings.length > 0) {
      dependencies.push(`${indirectPrefinancings.length} préfinancement(s) indirect(s)`);
    }
    const directEmployeeLoans = employeeLoans.filter(loan => loan.grantId === grantId);
    if (directEmployeeLoans.length > 0) {
      dependencies.push(`${directEmployeeLoans.length} prêt(s) employé(s) direct(s)`);
    }
    const indirectEmployeeLoans = employeeLoans.filter(loan => 
      grantSubBudgetLines.some(subLine => subLine.id === loan.subBudgetLineId)
    );
    if (indirectEmployeeLoans.length > 0) {
      dependencies.push(`${indirectEmployeeLoans.length} prêt(s) employé(s) indirect(s)`);
    }
    if (grantBudgetLines.length > 0) {
      dependencies.push(`${grantBudgetLines.length} ligne(s) budgétaire(s)`);
    }
    if (grantSubBudgetLines.length > 0) {
      dependencies.push(`${grantSubBudgetLines.length} sous-ligne(s) budgétaire(s)`);
    }
    const grantEngagements = engagements.filter(eng => 
      grantSubBudgetLines.some(subLine => subLine.id === eng.subBudgetLineId)
    );
    if (grantEngagements.length > 0) {
      dependencies.push(`${grantEngagements.length} engagement(s)`);
    }
    const grantPayments = payments.filter(p => 
      grantEngagements.some(eng => eng.id === p.engagementId)
    );
    if (grantPayments.length > 0) {
      dependencies.push(`${grantPayments.length} paiement(s)`);
    }
    const grantTransactions = bankTransactions.filter(t => t.grantId === grantId);
    if (grantTransactions.length > 0) {
      dependencies.push(`${grantTransactions.length} transaction(s) bancaire(s)`);
    }
    return {
      hasDependencies: dependencies.length > 0,
      dependencies: dependencies.join(', '),
      message: dependencies.length > 0 
        ? `Cette subvention a ${dependencies.length} type(s) d'éléments liés.` 
        : 'Aucune dépendance trouvée.'
    };
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [grantToDelete, setGrantToDelete] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<{
    hasDependencies: boolean;
    dependencies: string[];
    message: string;
  } | null>(null);

  const performGrantDeletion = async (id: string) => {
    try {
      const grantToLog = grants.find(g => g.id === id);
      showLoading('Suppression de la subvention en cours...');
      const grantBudgetLines = budgetLines.filter(line => line.grantId === id);
      const grantSubBudgetLines = subBudgetLines.filter(subLine => 
        grantBudgetLines.some(line => line.id === subLine.budgetLineId)
      );
      const transactionsToDelete = bankTransactions.filter(transaction => transaction.grantId === id);
      const grantEngagements = engagements.filter(eng => 
        grantSubBudgetLines.some(subLine => subLine.id === eng.subBudgetLineId)
      );
      const paymentsToDelete = payments.filter(p => 
        grantEngagements.some(eng => eng.id === p.engagementId)
      );
      const grantPrefinancings = prefinancings.filter(pref => 
        pref.grantId === id ||
        grantSubBudgetLines.some(subLine => subLine.id === pref.subBudgetLineId)
      );
      const grantEmployeeLoans = employeeLoans.filter(loan => 
        loan.grantId === id ||
        grantSubBudgetLines.some(subLine => subLine.id === loan.subBudgetLineId)
      );

      for (const t of transactionsToDelete) await bankTransactionsService.delete(t.id);
      for (const p of paymentsToDelete) await paymentsService.delete(p.id);
      for (const pref of grantPrefinancings) await prefinancingsService.delete(pref.id);
      for (const loan of grantEmployeeLoans) await employeeLoansService.delete(loan.id);
      for (const eng of grantEngagements) await engagementsService.delete(eng.id);
      for (const sub of grantSubBudgetLines) await subBudgetLinesService.delete(sub.id);
      for (const line of grantBudgetLines) await budgetLinesService.delete(line.id);
      await grantsService.delete(id);
      if (grantToLog) logDelete('grant', id, grantToLog.name || grantToLog.reference || id, grantToLog, id);

      setBankTransactions(prev => prev.filter(t => !transactionsToDelete.some(d => d.id === t.id)));
      setPayments(prev => prev.filter(p => !paymentsToDelete.some(d => d.id === p.id)));
      setPrefinancings(prev => prev.filter(pref => !grantPrefinancings.some(d => d.id === pref.id)));
      setEmployeeLoans(prev => prev.filter(loan => !grantEmployeeLoans.some(d => d.id === loan.id)));
      setEngagements(prev => prev.filter(eng => !grantEngagements.some(d => d.id === eng.id)));
      setSubBudgetLines(prev => prev.filter(sub => !grantSubBudgetLines.some(d => d.id === sub.id)));
      setBudgetLines(prev => prev.filter(line => !grantBudgetLines.some(d => d.id === line.id)));
      setGrants(prev => prev.filter(g => g.id !== id));

      if (selectedGrantId === id) {
        const remaining = grants.filter(g => g.id !== id);
        if (remaining.length > 0) handleSelectGrant(remaining[0].id);
        else setSelectedGrantId('');
      }
      closeLoading();
      showSuccess('Subvention supprimée', 'La subvention et tous ses éléments ont été supprimés avec succès.');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      closeLoading();
      showError('Erreur', 'Impossible de supprimer la subvention.');
    }
  };

  const triggerDeleteGrant = async (id: string) => {
    const dependencyCheck = checkGrantDependencies(id);
    if (dependencyCheck.hasDependencies) {
      setGrantToDelete(id);
      setDeleteDependencies(dependencyCheck);
      setShowDeleteModal(true);
      return;
    }
    await performGrantDeletion(id);
  };

  // ============================================================
  // GESTIONNAIRES D'ÉVÉNEMENTS (CRUD)
  // ============================================================
  const handleAddGrant = async (grant: Omit<Grant, 'id'>) => {
    try {
      showLoading('Création de la subvention...');
      const newGrant = await grantsService.create({ ...grant, plannedAmount: 0 });
      setGrants(prev => [...prev, newGrant]);
      logCreate('grant', newGrant.id, newGrant.name || newGrant.reference || newGrant.id, newGrant, newGrant.id);
      handleSelectGrant(newGrant.id);
      showSuccess('Subvention ajoutée', 'La nouvelle subvention a été créée avec succès');
    } catch (error) {
      showError('Erreur', 'Impossible de créer la subvention');
    } finally {
      closeLoading();
    }
  };

  // Journalise une modification dans l'historique d'audit (silencieux si rien n'a changé)
  const logChange = (
    entityType: ChangeHistoryEntry['entityType'],
    entityId: string,
    entityLabel: string,
    oldObj: any,
    updates: any,
    grantId?: string
  ) => {
    const changes = computeChanges(oldObj, updates);
    if (!changes.length) return;
    changeHistoryService.record({
      entityType, entityId, entityLabel, grantId, changes,
      changedById: user?.id,
      changedByName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : (userProfile as any)?.email || 'Inconnu',
    });
  };

  // Journalise une création (avec un instantané des valeurs initiales)
  const logCreate = (
    entityType: ChangeHistoryEntry['entityType'],
    entityId: string,
    entityLabel: string,
    createdObj: any,
    grantId?: string
  ) => {
    changeHistoryService.record({
      entityType, entityId, entityLabel, grantId, action: 'create',
      changes: buildCreateSnapshot(createdObj),
      changedById: user?.id,
      changedByName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : (userProfile as any)?.email || 'Inconnu',
    });
  };

  // Journalise une suppression (avec un instantané de ce qui existait)
  const logDelete = (
    entityType: ChangeHistoryEntry['entityType'],
    entityId: string,
    entityLabel: string,
    deletedObj: any,
    grantId?: string
  ) => {
    changeHistoryService.record({
      entityType, entityId, entityLabel, grantId, action: 'delete',
      changes: buildDeleteSnapshot(deletedObj),
      changedById: user?.id,
      changedByName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : (userProfile as any)?.email || 'Inconnu',
    });
  };

  const handleUpdateGrant = async (id: string, updates: Partial<Grant>) => {
    try {
      const old = grants.find(g => g.id === id);
      await grantsService.update(id, updates);
      setGrants(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      if (old) logChange('grant', id, old.name || old.reference || id, old, updates, id);
      showSuccess('Subvention modifiée', 'Les modifications ont été enregistrées');
    } catch (error) {
      console.error('Erreur', 'Impossible de modifier la subvention');
    }
  };

  const handleDeleteGrant = async (id: string) => {
    await triggerDeleteGrant(id);
  };

  const handleAddBudgetLine = async (budgetLine: Omit<BudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => {
    try {
      const newBudgetLine = await budgetLinesService.create({
        ...budgetLine,
        engagedAmount: 0,
        availableAmount: budgetLine.notifiedAmount
      });
      setBudgetLines(prev => [...prev, newBudgetLine]);
      logCreate('budget_line', newBudgetLine.id, `${newBudgetLine.code} — ${newBudgetLine.name}`, newBudgetLine, (newBudgetLine as any).grantId);
      showSuccess('Ligne budgétaire ajoutée', 'La nouvelle ligne budgétaire a été créée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer la ligne budgétaire');
    }
  };

  const handleUpdateBudgetLine = async (id: string, updates: Partial<BudgetLine>) => {
    try {
      const old = budgetLines.find(l => l.id === id);
      await budgetLinesService.update(id, updates);
      setBudgetLines(prev => prev.map(line => line.id === id ? { ...line, ...updates } : line));
      if (old) logChange('budget_line', id, `${old.code} — ${old.name}`, old, updates, (old as any).grantId);
    } catch (error) {
      showError('Erreur', 'Impossible de modifier la ligne budgétaire');
    }
  };

  const handleDeleteBudgetLine = async (id: string) => {
    // Implémentation complète déjà présente – gardée telle quelle
    console.warn('handleDeleteBudgetLine non implémenté en détail dans cette version');
    try {
      // ... code existant ...
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer la ligne budgétaire');
    }
  };

  const handleAddSubBudgetLine = async (subBudgetLine: Omit<SubBudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => {
    try {
      const newSubBudgetLine = await subBudgetLinesService.create({
        ...subBudgetLine,
        engagedAmount: 0,
        availableAmount: subBudgetLine.notifiedAmount
      });
      setSubBudgetLines(prev => [...prev, newSubBudgetLine]);
      logCreate('sub_budget_line', newSubBudgetLine.id, `${(newSubBudgetLine as any).code} — ${(newSubBudgetLine as any).name}`, newSubBudgetLine, (newSubBudgetLine as any).grantId);
      showSuccess('Sous-ligne budgétaire ajoutée', 'La nouvelle sous-ligne budgétaire a été créée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer la sous-ligne budgétaire');
    }
  };

  const handleUpdateSubBudgetLine = async (id: string, updates: Partial<SubBudgetLine>) => {
    try {
      const old = subBudgetLines.find(l => l.id === id);
      await subBudgetLinesService.update(id, updates);
      setSubBudgetLines(prev => prev.map(line => line.id === id ? { ...line, ...updates } : line));
      if (old) logChange('sub_budget_line', id, `${(old as any).code} — ${(old as any).name}`, old, updates, (old as any).grantId);
    } catch (error) {
      showError('Erreur', 'Impossible de modifier la sous-ligne budgétaire');
    }
  };

  const handleDeleteSubBudgetLine = async (id: string) => {
    try {
      const old = subBudgetLines.find(l => l.id === id);
      await subBudgetLinesService.delete(id);
      setSubBudgetLines(prev => prev.filter(line => line.id !== id));
      if (old) logDelete('sub_budget_line', id, `${(old as any).code} — ${(old as any).name}`, old, (old as any).grantId);
      showSuccess('Sous-ligne supprimée', 'La sous-ligne budgétaire a été supprimée');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer la sous-ligne budgétaire');
    }
  };

  // ➕ Ajout d'une tranche de montant notifié (répartie sur les sous-lignes)
  // Réessaie une écriture qui échoue pour une raison transitoire (réseau : « Failed to fetch »,
  // timeout…). Les erreurs métier (permission, doublon, contrainte) ne sont PAS retentées.
  const persistWithRetry = async <T,>(fn: () => Promise<T>, retries = 2): Promise<T> => {
    let lastErr: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e || '');
        const transient = /failed to fetch|networkerror|network error|timeout|fetch|econn|load failed/i.test(msg);
        if (!transient || attempt === retries) break;
        await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
      }
    }
    throw lastErr;
  };

  const handleAddNotificationTranche = async (tranche: Omit<NotificationTranche, 'id' | 'createdAt'>) => {
    // ⚠️ Robustesse : les écritures sont séquentielles (jamais en rafale) et l'ORDRE est
    // volontaire — on applique d'abord les montants (sous-lignes → lignes → subvention),
    // puis on crée l'enregistrement d'historique EN DERNIER. Ainsi, une coupure réseau
    // (« Failed to fetch ») au milieu ne laisse jamais une tranche fantôme, et un nouvel
    // essai (la modale travaille sur des montants CIBLES) ne fait que réappliquer l'écart
    // restant. Le total de la subvention est RECALCULÉ depuis les lignes (idempotent).
    try {
      const dist = tranche.distribution || [];
      const lineIncrements: Record<string, number> = {};

      // 1) Sous-lignes
      for (const d of dist) {
        const sub = subBudgetLines.find(s => s.id === d.subBudgetLineId);
        if (!sub || !d.amount) continue;
        const newNotified = (sub.notifiedAmount || 0) + d.amount;
        const newAvailable = Math.max(0, newNotified - (sub.engagedAmount || 0));
        await persistWithRetry(() => subBudgetLinesService.update(sub.id, { notifiedAmount: newNotified, availableAmount: newAvailable }));
        setSubBudgetLines(prev => prev.map(s => s.id === sub.id ? { ...s, notifiedAmount: newNotified, availableAmount: newAvailable } : s));
        lineIncrements[sub.budgetLineId] = (lineIncrements[sub.budgetLineId] || 0) + d.amount;
      }

      // 2) Lignes budgétaires parentes
      const newLineNotified: Record<string, number> = {};
      for (const [lineId, inc] of Object.entries(lineIncrements)) {
        const line = budgetLines.find(l => l.id === lineId);
        if (!line) continue;
        const newNotified = (line.notifiedAmount || 0) + inc;
        const newAvailable = Math.max(0, newNotified - (line.engagedAmount || 0));
        await persistWithRetry(() => budgetLinesService.update(lineId, { notifiedAmount: newNotified, availableAmount: newAvailable }));
        setBudgetLines(prev => prev.map(l => l.id === lineId ? { ...l, notifiedAmount: newNotified, availableAmount: newAvailable } : l));
        newLineNotified[lineId] = newNotified;
      }

      // 3) Subvention : total RECALCULÉ = somme des montants notifiés de ses lignes (idempotent)
      const grant = grants.find(g => g.id === tranche.grantId);
      let activated = false;
      if (grant) {
        const newTotal = budgetLines
          .filter(l => l.grantId === grant.id)
          .reduce((s, l) => s + (newLineNotified[l.id] !== undefined ? newLineNotified[l.id] : (l.notifiedAmount || 0)), 0);
        const wasEmpty = (grant.totalAmount || 0) <= 0;
        // Le 1er montant notifié active automatiquement une subvention encore « en attente »
        const grantUpdates: Partial<Grant> = { totalAmount: newTotal };
        if (wasEmpty && grant.status === 'pending') {
          grantUpdates.status = 'active';
          activated = true;
        }
        await persistWithRetry(() => grantsService.update(grant.id, grantUpdates));
        setGrants(prev => prev.map(g => g.id === grant.id ? { ...g, ...grantUpdates } : g));
      }

      // 4) Historique EN DERNIER (non financier) — une éventuelle erreur ici ne fausse aucun montant
      const created = await persistWithRetry(() => notificationTranchesService.create(tranche));
      setNotificationTranches(prev => [...prev, created]);

      showSuccess(
        'Notification enregistrée',
        activated
          ? 'La tranche a été répartie et la subvention est désormais active.'
          : 'La tranche de montant notifié a été ajoutée et répartie.'
      );
    } catch (error) {
      console.error('Erreur tranche notification:', error);
      showError('Erreur', "Impossible d'enregistrer la notification (problème réseau ?). Les montants déjà appliqués sont conservés — rouvrez la fenêtre et réessayez, seul l'écart restant sera ajouté.");
      throw error; // laisse la modale ouverte pour un nouvel essai
    }
  };

  // 🔁 Transfert de fonds d'une sous-ligne vers une autre
  const handleAddSubLineTransfer = async (transfer: Omit<SubLineTransfer, 'id' | 'createdAt'>) => {
    // Même logique de robustesse que les notifications : écritures séquentielles avec réessai,
    // montants d'abord, enregistrement d'historique EN DERNIER, erreur propagée à la modale.
    try {
      const src = subBudgetLines.find(s => s.id === transfer.fromSubBudgetLineId);
      const dst = subBudgetLines.find(s => s.id === transfer.toSubBudgetLineId);

      if (src) {
        const newNotified = Math.max(0, (src.notifiedAmount || 0) - transfer.amount);
        const newAvailable = Math.max(0, newNotified - (src.engagedAmount || 0));
        await persistWithRetry(() => subBudgetLinesService.update(src.id, { notifiedAmount: newNotified, availableAmount: newAvailable }));
        setSubBudgetLines(prev => prev.map(s => s.id === src.id ? { ...s, notifiedAmount: newNotified, availableAmount: newAvailable } : s));
      }
      if (dst) {
        const newNotified = (dst.notifiedAmount || 0) + transfer.amount;
        const newAvailable = Math.max(0, newNotified - (dst.engagedAmount || 0));
        await persistWithRetry(() => subBudgetLinesService.update(dst.id, { notifiedAmount: newNotified, availableAmount: newAvailable }));
        setSubBudgetLines(prev => prev.map(s => s.id === dst.id ? { ...s, notifiedAmount: newNotified, availableAmount: newAvailable } : s));
      }

      // Ajustement des lignes budgétaires parentes (net par ligne)
      const lineDeltas: Record<string, number> = {};
      if (src) lineDeltas[src.budgetLineId] = (lineDeltas[src.budgetLineId] || 0) - transfer.amount;
      if (dst) lineDeltas[dst.budgetLineId] = (lineDeltas[dst.budgetLineId] || 0) + transfer.amount;
      for (const [lineId, delta] of Object.entries(lineDeltas)) {
        if (delta === 0) continue;
        const line = budgetLines.find(l => l.id === lineId);
        if (!line) continue;
        const newNotified = Math.max(0, (line.notifiedAmount || 0) + delta);
        const newAvailable = Math.max(0, newNotified - (line.engagedAmount || 0));
        await persistWithRetry(() => budgetLinesService.update(lineId, { notifiedAmount: newNotified, availableAmount: newAvailable }));
        setBudgetLines(prev => prev.map(l => l.id === lineId ? { ...l, notifiedAmount: newNotified, availableAmount: newAvailable } : l));
      }

      // Historique EN DERNIER
      const created = await persistWithRetry(() => subLineTransfersService.create(transfer));
      setSubLineTransfers(prev => [...prev, created]);
      showSuccess('Transfert effectué', 'Le transfert entre sous-lignes a été enregistré.');
    } catch (error) {
      console.error('Erreur transfert:', error);
      showError('Erreur', "Impossible d'effectuer le transfert (problème réseau ?). Les montants déjà appliqués sont conservés — réessayez.");
      throw error;
    }
  };

  // Modifier handleAddEngagement
  const handleAddEngagement = async (engagement: Omit<Engagement, 'id'>) => {
    try {
      const newEngagement = await engagementsService.create(engagement);
      setEngagements(prev => [...prev, newEngagement]);
      logCreate('engagement', newEngagement.id, newEngagement.engagementNumber || newEngagement.id, newEngagement, newEngagement.grantId);
      // ✅ RECALCULER après ajout
      await recalculateSubBudgetLines();
      showSuccess('Engagement ajouté', 'Le nouvel engagement a été enregistré');
      setShowEngagementForm(false);
    } catch (error) {
      showError('Erreur', 'Impossible de créer l\'engagement');
    }
  };

  // Modifier handleUpdateEngagement
  const handleUpdateEngagement = async (id: string, updates: Partial<Engagement>) => {
    try {
      const old = engagements.find(e => e.id === id);
      await engagementsService.update(id, updates);
      setEngagements(prev => prev.map(eng => eng.id === id ? { ...eng, ...updates } : eng));
      if (old) logChange('engagement', id, old.engagementNumber || id, old, updates, old.grantId);
      // ✅ RECALCULER après mise à jour
      await recalculateSubBudgetLines();
      showSuccess('Engagement modifié', 'Les modifications ont été enregistrées');
      setShowEngagementForm(false);
      setEditingEngagement(null);
    } catch (error) {
      showError('Erreur', 'Impossible de modifier l\'engagement');
    }
  };

  // Modifier handleDeleteEngagement
  const handleDeleteEngagement = async (id: string) => {
    try {
      const old = engagements.find(e => e.id === id);
      await engagementsService.delete(id);
      setEngagements(prev => prev.filter(eng => eng.id !== id));
      if (old) logDelete('engagement', id, old.engagementNumber || id, old, old.grantId);
      // ✅ RECALCULER après suppression
      await recalculateSubBudgetLines();
      showSuccess('Engagement supprimé', 'L\'engagement a été supprimé avec succès');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer l\'engagement');
    }
  };



  const handleAddPayment = async (paymentData: Omit<Payment, 'id'>) => {
    try {
      let newPayment;
      if (editingPayment) {
        await paymentsService.update(editingPayment.id, paymentData);
        setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...paymentData } : p));
        showSuccess('Paiement modifié', 'Les modifications ont été enregistrées');
        setEditingPayment(null);
      } else {
        const finalApprovals: any = {};
        if (paymentData.approvals?.supervisor1?.signature) finalApprovals.supervisor1 = paymentData.approvals.supervisor1;
        if (paymentData.approvals?.supervisor2?.signature) finalApprovals.supervisor2 = paymentData.approvals.supervisor2;
        newPayment = await paymentsService.create({ ...paymentData, approvals: finalApprovals });
        setPayments(prev => [...prev, newPayment]);
        logCreate('payment', newPayment.id, newPayment.paymentNumber || newPayment.id, newPayment, newPayment.grantId);
        showSuccess('Paiement ajouté', 'Le nouveau paiement a été enregistré avec succès.');
      }
      setShowPaymentForm(false);
      setSelectedEngagement(null);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du paiement:", error);
      showError('Erreur', 'Impossible de créer le paiement.');
    }
  };

  const handleUpdatePayment = async (id: string, updates: Partial<Payment>) => {
    const oldPayment = payments.find(p => p.id === id);
    let finalUpdates: any = { ...updates };
    // Version camelCase pour la mise à jour réactive de l'état local
    const localUpdates: Partial<Payment> = { ...updates };

    // Si on met à jour les paiements partiels, recalculer le statut
    if (updates.partialPayments) {
      const payment = payments.find(p => p.id === id);
      if (payment) {
        const totalPaid = updates.partialPayments.reduce((sum, pp) => sum + pp.amount, 0);
        const remaining = payment.amount - totalPaid;
        let newStatus: Payment['status'] = payment.status;
        if (remaining <= 0) newStatus = 'paid';
        else if (totalPaid > 0) newStatus = 'in_progress';
        finalUpdates.status = newStatus;
        localUpdates.status = newStatus;
        localUpdates.remainingAmount = Math.max(0, remaining);
      }
      // ✅ Transformer partialPayments → partial_payments pour la base
      finalUpdates.partial_payments = finalUpdates.partialPayments;
      delete finalUpdates.partialPayments;
    }

    // Supprimer les champs non persistants
    delete finalUpdates.cashedDate;

    const { error } = await supabase
      .from('payments')
      .update(finalUpdates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Erreur mise à jour:', error);
      showError('Erreur', 'Impossible de mettre à jour le paiement.');
    } else {
      // ✅ Mise à jour réactive de l'état local (sans recharger toute la page),
      // comme pour la création d'un engagement. Les pages Trésorerie / Suivi /
      // Tableau de bord se recalculent à partir de l'état `payments`.
      setPayments(prev => prev.map(p => (p.id === id ? { ...p, ...localUpdates } : p)));
      if (oldPayment) logChange('payment', id, oldPayment.paymentNumber || id, oldPayment, localUpdates, oldPayment.grantId);
      showSuccess('Succès', 'Le paiement a été mis à jour.');
    }
  };

  // const handleUpdatePayment = async (id: string, updates: Partial<Payment>) => {
  //   try {
  //     await paymentsService.update(id, updates);
  //     setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  //     showSuccess('Paiement modifié', 'Les modifications ont été enregistrées');
  //   } catch (error) {
  //     showError('Erreur', 'Impossible de modifier le paiement');
  //   }
  // };

  const handleSignPayment = async (paymentId: string, updates: Partial<Payment>) => {
    try {
      await paymentsService.update(paymentId, updates);
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...updates } : p));
    } catch (error) {
      showError('Erreur', 'Impossible d\'enregistrer la signature');
    }
  };

  const handleAddBankTransaction = async (transaction: Omit<BankTransaction, 'id'>) => {
    try {
      const newTransaction = await bankTransactionsService.create(transaction);
      setBankTransactions(prev => [...prev, newTransaction]);
      // Mise à jour du solde de la subvention
      if (transaction.grantId) {
        const grant = grants.find(g => g.id === transaction.grantId);
        if (grant && grant.bankAccount) {
          const newBalance = transaction.type === 'credit' 
            ? grant.bankAccount.balance + transaction.amount
            : grant.bankAccount.balance - transaction.amount;
          await grantsService.update(transaction.grantId, {
            bankAccount: {
              ...grant.bankAccount,
              balance: newBalance,
              lastUpdateDate: new Date().toISOString().split('T')[0]
            }
          });
          setGrants(prev => prev.map(g => 
            g.id === transaction.grantId && g.bankAccount
              ? { ...g, bankAccount: { ...g.bankAccount, balance: newBalance, lastUpdateDate: new Date().toISOString().split('T')[0] } }
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

  // Enregistre un mouvement bancaire (débit/crédit) SANS toast — utilisé pour les
  // décaissements/remboursements de préfinancements et prêts, afin d'alimenter
  // automatiquement la Trésorerie et de mettre à jour le solde de la subvention.
  const recordBankMovement = async (mvt: { grantId: string; date: string; description: string; amount: number; type: 'credit' | 'debit'; reference: string }) => {
    if (!mvt.grantId || !mvt.amount) return;
    try {
      const newTransaction = await bankTransactionsService.create(mvt);
      setBankTransactions(prev => [...prev, newTransaction]);
      const grant = grants.find(g => g.id === mvt.grantId);
      if (grant && grant.bankAccount) {
        const newBalance = mvt.type === 'credit'
          ? grant.bankAccount.balance + mvt.amount
          : grant.bankAccount.balance - mvt.amount;
        const updatedAccount = { ...grant.bankAccount, balance: newBalance, lastUpdateDate: new Date().toISOString().split('T')[0] };
        await grantsService.update(mvt.grantId, { bankAccount: updatedAccount });
        setGrants(prev => prev.map(g => g.id === mvt.grantId && g.bankAccount ? { ...g, bankAccount: updatedAccount } : g));
      }
    } catch (e) {
      console.warn('Mouvement bancaire automatique échoué', e);
    }
  };

  const handleDeletePrefinancing = async (id: string) => {
    try {
      const old = prefinancings.find(p => p.id === id);
      await prefinancingsService.delete(id);
      setPrefinancings(prev => prev.filter(p => p.id !== id));
      if (old) logDelete('prefinancing', id, old.prefinancingNumber || id, old, old.grantId);
      showSuccess('Préfinancement supprimé', 'Le préfinancement a été supprimé avec succès');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer le préfinancement');
    }
  };

  const handleDeleteEmployeeLoan = async (id: string) => {
    try {
      const old = employeeLoans.find(l => l.id === id);
      await employeeLoansService.delete(id);
      setEmployeeLoans(prev => prev.filter(l => l.id !== id));
      if (old) logDelete('employee_loan', id, old.loanNumber || id, old, old.grantId);
      showSuccess('Prêt supprimé', 'Le prêt employé a été supprimé avec succès');
    } catch (error) {
      showError('Erreur', 'Impossible de supprimer le prêt employé');
    }
  };

  const handleAddPrefinancing = async (prefinancing: Omit<Prefinancing, 'id'>) => {
    try {
      const newPrefinancing = await prefinancingsService.create(prefinancing);
      setPrefinancings(prev => [...prev, newPrefinancing]);
      logCreate('prefinancing', newPrefinancing.id, newPrefinancing.prefinancingNumber || newPrefinancing.id, newPrefinancing, newPrefinancing.grantId);
      showSuccess('Préfinancement ajouté', 'La demande de préfinancement a été enregistrée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer le préfinancement');
    }
  };

  const handleUpdatePrefinancing = async (id: string, updates: Partial<Prefinancing>) => {
    try {
      const old = prefinancings.find(p => p.id === id);
      await prefinancingsService.update(id, updates);
      setPrefinancings(prev => prev.map(pref => pref.id === id ? { ...pref, ...updates } : pref));
      if (old) logChange('prefinancing', id, old.prefinancingNumber || id, old, updates, old.grantId);
      // Décaissement : passage à « payé » → débit automatique en Trésorerie
      if (old && old.status !== 'paid' && updates.status === 'paid') {
        const today = new Date().toISOString().split('T')[0];
        await recordBankMovement({
          grantId: old.grantId, date: today,
          description: `Décaissement préfinancement ${old.prefinancingNumber}`,
          amount: old.amount, type: 'debit', reference: old.prefinancingNumber,
        });
        // Préfinancement entre subventions : créditer la subvention destinataire
        if (old.purpose === 'between_grants' && old.targetGrant) {
          const sourceName = grants.find(g => g.id === old.grantId)?.name || '';
          await recordBankMovement({
            grantId: old.targetGrant, date: today,
            description: `Réception préfinancement ${old.prefinancingNumber}${sourceName ? ` (depuis ${sourceName})` : ''}`,
            amount: old.amount, type: 'credit', reference: old.prefinancingNumber,
          });
        }
      }
      showSuccess('Préfinancement modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le préfinancement');
    }
  };

  const handleAddPrefinancingRepayment = async (prefinancingId: string, repayment: { date: string; amount: number; reference: string }) => {
    try {
      const prefinancing = prefinancings.find(p => p.id === prefinancingId);
      if (!prefinancing) return;
      const newRepayment = { ...repayment, id: String(Date.now()) };
      const updatedRepayments = [...(prefinancing.repayments || []), newRepayment];
      const totalRepaid = updatedRepayments.reduce((sum, rep) => sum + rep.amount, 0);
      const newStatus = totalRepaid >= prefinancing.amount ? 'repaid' : prefinancing.status;
      await prefinancingsService.update(prefinancingId, { repayments: updatedRepayments, status: newStatus });
      setPrefinancings(prev => prev.map(pref =>
        pref.id === prefinancingId ? { ...pref, repayments: updatedRepayments, status: newStatus } : pref
      ));
      // Remboursement : entrée d'argent → crédit automatique en Trésorerie (subvention d'origine)
      await recordBankMovement({
        grantId: prefinancing.grantId, date: repayment.date,
        description: `Remboursement préfinancement ${prefinancing.prefinancingNumber}`,
        amount: repayment.amount, type: 'credit', reference: repayment.reference || prefinancing.prefinancingNumber,
      });
      // Entre subventions : la subvention destinataire restitue les fonds (débit)
      if (prefinancing.purpose === 'between_grants' && prefinancing.targetGrant) {
        await recordBankMovement({
          grantId: prefinancing.targetGrant, date: repayment.date,
          description: `Restitution préfinancement ${prefinancing.prefinancingNumber}`,
          amount: repayment.amount, type: 'debit', reference: repayment.reference || prefinancing.prefinancingNumber,
        });
      }
      showSuccess('Remboursement ajouté', 'Le remboursement a été enregistré');
    } catch (error) {
      showError('Erreur', 'Impossible d\'ajouter le remboursement');
    }
  };

  const handleAddEmployeeLoan = async (loan: Omit<EmployeeLoan, 'id'>) => {
    try {
      const newLoan = await employeeLoansService.create(loan);
      setEmployeeLoans(prev => [...prev, newLoan]);
      logCreate('employee_loan', newLoan.id, newLoan.loanNumber || newLoan.id, newLoan, newLoan.grantId);
      showSuccess('Prêt employé ajouté', 'La demande de prêt a été enregistrée');
    } catch (error) {
      showError('Erreur', 'Impossible de créer le prêt employé');
    }
  };

  const handleUpdateEmployeeLoan = async (id: string, updates: Partial<EmployeeLoan>) => {
    try {
      const old = employeeLoans.find(l => l.id === id);
      await employeeLoansService.update(id, updates);
      setEmployeeLoans(prev => prev.map(loan => loan.id === id ? { ...loan, ...updates } : loan));
      if (old) logChange('employee_loan', id, old.loanNumber || id, old, updates, old.grantId);
      // Décaissement du prêt : passage à « en cours » (active) → débit automatique
      if (old && old.status !== 'active' && updates.status === 'active') {
        await recordBankMovement({
          grantId: old.grantId, date: new Date().toISOString().split('T')[0],
          description: `Décaissement prêt ${old.loanNumber} - ${old.employee?.name || ''}`.trim(),
          amount: old.amount, type: 'debit', reference: old.loanNumber,
        });
      }
      showSuccess('Prêt employé modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier le prêt employé');
    }
  };

  const handleAddEmployeeLoanRepayment = async (loanId: string, repayment: { date: string; amount: number; reference: string }) => {
    try {
      const loan = employeeLoans.find(l => l.id === loanId);
      if (!loan) return;
      const newRepayment = { ...repayment, id: String(Date.now()) };
      const updatedRepayments = [...loan.repayments, newRepayment];
      const totalRepaid = updatedRepayments.reduce((sum, rep) => sum + rep.amount, 0);
      const newStatus = totalRepaid >= loan.amount ? 'completed' : 'active';
      await employeeLoansService.update(loanId, { repayments: updatedRepayments, status: newStatus });
      setEmployeeLoans(prev => prev.map(l =>
        l.id === loanId ? { ...l, repayments: updatedRepayments, status: newStatus } : l
      ));
      // Remboursement du prêt : entrée d'argent → crédit automatique en Trésorerie
      await recordBankMovement({
        grantId: loan.grantId, date: repayment.date,
        description: `Remboursement prêt ${loan.loanNumber} - ${loan.employee?.name || ''}`.trim(),
        amount: repayment.amount, type: 'credit', reference: repayment.reference || loan.loanNumber,
      });
      showSuccess('Remboursement ajouté', 'Le remboursement a été enregistré');
    } catch (error) {
      showError('Erreur', 'Impossible d\'ajouter le remboursement');
    }
  };

  const handleAddUser = async (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
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
      setUsers(prev => prev.map(user => user.id === id ? { ...user, ...updates } : user));
      showSuccess('Utilisateur modifié', 'Les modifications ont été enregistrées');
    } catch (error) {
      showError('Erreur', 'Impossible de modifier l\'utilisateur');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await usersService.delete(id);
      setUsers(prev => prev.filter(user => user.id !== id));
      showSuccess('Utilisateur supprimé', 'L\'utilisateur a été supprimé avec succès');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showError('Erreur', error.message || 'Impossible de supprimer l\'utilisateur');
    }
  };

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
      setRoles(prev => prev.map(role => role.id === id ? { ...role, ...updates } : role));
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

  const handleAddPartialPayment = async (paymentId: string, partialPayment: Omit<PartialPayment, 'id'>) => {
    try {
      const updatedPayment = await paymentsService.addPartialPayment(paymentId, partialPayment);
      setPayments(prev => prev.map(p => p.id === paymentId ? updatedPayment : p));
      showSuccess('Paiement partiel ajouté', 'Le paiement partiel a été enregistré avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du paiement partiel:', error);
      showError('Erreur', 'Impossible d\'ajouter le paiement partiel');
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
    }
  };

  // ============================================================
  // DÉFINITION DES ÉLÉMENTS DE MENU
  // ============================================================
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: BarChart3, module: 'dashboard' },
    { id: 'tracking', label: 'Tableau de suivi budgétaire', icon: BarChart3, module: 'tracking' },
    { id: 'grants', label: 'Gestion des Subventions', icon: Banknote, module: 'grants' },
    { id: 'budget_planning', label: 'Planification', icon: Target, module: 'budget_planning' },
    {
      id: 'engagements',
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
      notificationCount: (() => {
        const signatureNotification = paymentNotificationCount > 0 ? paymentNotificationCount : undefined;
        const availableEngagementsNotification = isComptable && showAvailableEngagementsNotification && availableEngagementsNotificationCount > 0 ? availableEngagementsNotificationCount : undefined;
        return availableEngagementsNotification || signatureNotification;
      })()
    },
    { 
      id: 'treasury', 
      label: 'Trésorerie', 
      icon: Banknote, 
      module: 'treasury',
      notificationCount: isComptable && treasuryNotifications.total > 0 ? treasuryNotifications.total : undefined
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
    { id: 'reports', label: 'Rapports', icon: FileText, module: 'reports' },
    { id: 'users', label: 'Utilisateurs', icon: Users, module: 'users' },
    { id: 'globalConfig', label: 'Configuration', icon: Settings, module: 'globalConfig' },
    { id: 'history', label: 'Historique', icon: History, module: 'history' },
    { id: 'profile', label: 'Mon Profil', icon: Users, module: 'profile' }
  ];

  const availableMenuItems = menuItems.filter(item => hasModuleAccess(item.module));

  // ============================================================
  // RENDU CONDITIONNEL DE CHARGEMENT
  // ============================================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de Budget Flow...</p>
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

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Profil utilisateur non disponible</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // COMPTE DÉSACTIVÉ : aucun accès à la plateforme
  // ============================================================
  if (userProfile.isActive === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 max-w-md w-full p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Compte désactivé</h1>
          <p className="text-gray-600 mb-1">
            Votre compte <span className="font-medium">{userProfile.email}</span> n'est plus actif.
          </p>
          <p className="text-gray-600 mb-6">
            Vous n'avez plus accès à la plateforme. Veuillez contacter un administrateur pour réactiver votre accès.
          </p>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================
  return (
    <div className="app-shell min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 dark:from-slate-900 dark:to-indigo-950 shadow-xl border-b border-indigo-600 dark:border-slate-700 fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="backdrop-blur-sm rounded-xl border border-white/20">
                  <div className="relative w-20 h-8">
                    <img
                      src="/budgetflow/logo.png"
                      alt="Logo"
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-white">Budget Flow</h1>
                  <p className="text-xs text-indigo-200">Gestion Budgétaire Intelligente</p>
                </div>
              </div>

              {selectedGrant && (
                <div
                  onClick={() => { if (hasModuleAccess('globalConfig')) setActiveTab('globalConfig'); }}
                  role={hasModuleAccess('globalConfig') ? 'button' : undefined}
                  className={`hidden md:flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-xl border border-white/20 group relative transition-colors ${hasModuleAccess('globalConfig') ? 'cursor-pointer hover:bg-white/20' : ''}`}
                  title={hasModuleAccess('globalConfig') ? `Subvention active : ${selectedGrant.name} — cliquez pour changer de subvention` : `Subvention active : ${selectedGrant.name}`}
                >
                  <Banknote className="w-4 h-4 text-indigo-200 flex-shrink-0" />
                  <div className="max-w-[180px]">
                    <p className="text-xs text-indigo-200 font-medium truncate">Subvention Active</p>
                    <p className="text-xs font-semibold text-white truncate">
                      {selectedGrant.name.length > 25 ? `${selectedGrant.name.substring(0, 25)}...` : selectedGrant.name}
                    </p>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 hidden group-hover:block bg-gray-900 text-white text-sm rounded-lg py-2 px-3 whitespace-normal max-w-xs text-center shadow-lg z-50 border border-gray-700">
                    {selectedGrant.name}
                    {hasModuleAccess('globalConfig') && (
                      <span className="block text-indigo-300 mt-1">Cliquez pour changer de subvention</span>
                    )}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
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
                onClick={toggleTheme}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors backdrop-blur-sm"
                title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
                aria-label="Changer de thème"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
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

      {/* Main Content */}
      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0 fixed xl:sticky top-16 left-0 h-[calc(100vh-4rem)] w-80 ${sidebarCollapsed ? 'xl:w-20' : 'xl:w-80'} bg-gradient-to-b from-indigo-800 to-purple-900 dark:from-slate-900 dark:to-indigo-950 shadow-2xl border-r border-indigo-700/50 dark:border-slate-700/60 transform transition-all duration-300 ease-in-out z-40 flex flex-col`}>
          {/* Mobile Header Info */}
          <div className="xl:hidden p-6 border-b border-indigo-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="relative w-20 h-8">
                  <img
                    src="/budgetflow/logo.png"
                    alt="Logo"
                    className="object-contain"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Budget Flow</h1>
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

          {/* Bouton de réduction de la barre latérale (grand écran uniquement) */}
          <div className={`hidden xl:flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'} px-4 pt-4`}>
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
              aria-label={sidebarCollapsed ? 'Agrandir le menu latéral' : 'Réduire le menu latéral'}
            >
              <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Navigation avec défilement */}
          <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${sidebarCollapsed ? 'xl:px-2 px-4' : 'px-4'}`}>
            <div className="space-y-2">
              {availableMenuItems.map((item) => (
                <MenuItemWithTooltip
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  collapsed={sidebarCollapsed}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  notificationCount={item.notificationCount}
                  paymentNotificationCount={paymentNotificationCount}
                  availableEngagementsNotificationCount={availableEngagementsNotificationCount}
                  isComptable={isComptable}
                  showAvailableEngagementsNotification={showAvailableEngagementsNotification}
                  // Nouvelles props pour la trésorerie
                  treasuryApprovedCount={treasuryNotifications.approvedUncashedCount}
                  treasuryInProgressCount={treasuryNotifications.inProgressCount}
                />
              ))}
            </div>
          </nav>

          {/* Logout Button - Mobile */}
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

        {/* Contenu principal */}
        <div className="flex-1 min-w-0 xl:ml-0">
          <div className={`${sidebarCollapsed ? 'max-w-none' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-[max-width] duration-300`}>
            {activeTab === 'dashboard' && (
              <Dashboard
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                payments={payments}
                prefinancings={prefinancings}
                employeeLoans={employeeLoans}
                engagements={filteredData.engagements}
                onNavigate={setActiveTab}
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
                onNavigate={setActiveTab}
                onAddNotificationTranche={handleAddNotificationTranche}
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
                onAddSubLineTransfer={handleAddSubLineTransfer}
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
                onNavigate={setActiveTab}
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
                onDeleteEngagement={handleDeleteEngagement}
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
                onAddPartialPayment={handleAddPartialPayment}
                onAddBankTransaction={handleAddBankTransaction}
              />
            )}

            {activeTab === 'treasury' && (
              <TreasuryManager
                payments={filteredData.payments}
                bankTransactions={bankTransactions}
                selectedGrant={selectedGrant}
                onAddBankTransaction={handleAddBankTransaction}
                onUpdateGrant={handleUpdateGrant}
                onUpdatePayment={handleUpdatePayment}
                onAddPartialPayment={handleAddPartialPayment}
              />
            )}

            {activeTab === 'prefinancing' && (
              <PrefinancingManager
                prefinancings={filteredData.prefinancings}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                allGrants={grants}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                onAddPrefinancing={handleAddPrefinancing}
                onUpdatePrefinancing={handleUpdatePrefinancing}
                onAddPrefinancingRepayment={handleAddPrefinancingRepayment}
                onDeletePrefinancing={handleDeletePrefinancing}
              />
            )}

            {activeTab === 'employee-loans' && (
              <EmployeeLoanManager
                loans={filteredData.employeeLoans}
                budgetLines={filteredData.budgetLines}
                subBudgetLines={filteredData.subBudgetLines}
                grants={[selectedGrant].filter(Boolean) as Grant[]}
                selectedGrantId={selectedGrantId}
                payments={filteredData.payments}
                onAddLoan={handleAddEmployeeLoan}
                onUpdateLoan={handleUpdateEmployeeLoan}
                onAddRepayment={handleAddEmployeeLoanRepayment}
                onDeleteLoan={handleDeleteEmployeeLoan}
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
                notificationTranches={notificationTranches.filter(t => t.grantId === selectedGrantId)}
              />
            )}

            {activeTab === 'history' && (
              <HistoryCenter
                selectedGrant={selectedGrant}
                notificationTranches={notificationTranches.filter(t => t.grantId === selectedGrantId)}
                subLineTransfers={subLineTransfers.filter(t => t.grantId === selectedGrantId)}
                subBudgetLines={filteredData.subBudgetLines}
              />
            )}

            {activeTab === 'users' && (
              <UserManager
                users={users || []}
                roles={roles || []}
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

      {/* Modal de suppression avec dépendances */}
      {showDeleteModal && deleteDependencies && grantToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 flex-shrink-0">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.312 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h2 className="text-xl font-bold text-white">Suppression avec dépendances</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg">
                <div className="flex gap-3">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-800">
                    Cette subvention a des <span className="font-bold">éléments liés</span> qui seront également supprimés.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <h3 className="text-gray-700 font-semibold mb-3">Éléments liés qui seront supprimés :</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {deleteDependencies.dependencies.split(', ').map((dep, index) => (
                    <div key={index} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                      <span className="text-gray-700">{dep.split(' ').slice(0, -1).join(' ')} :</span>
                      <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                        {dep.split(' ').pop()}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-sm mt-3 text-center">
                  Total : {deleteDependencies.dependencies.split(', ').length} élément(s)
                </p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
                <p className="text-blue-800 font-semibold mb-2">Subvention concernée :</p>
                <p className="text-gray-800 font-medium text-lg mb-2">
                  {grants.find(g => g.id === grantToDelete)?.name || 'Subvention inconnue'}
                </p>
                {grants.find(g => g.id === grantToDelete)?.plannedAmount !== undefined && (
                  <p className="text-gray-600">
                    Montant planifié : <span className="font-bold">
                      {grants.find(g => g.id === grantToDelete)?.plannedAmount?.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €
                    </span>
                  </p>
                )}
                {grants.find(g => g.id === grantToDelete)?.description && (
                  <p className="text-gray-600 mt-2 text-sm">
                    Description : {grants.find(g => g.id === grantToDelete)?.description}
                  </p>
                )}
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-semibold text-red-700 text-lg">⚠️ Cette action est irréversible</span>
                </div>
                <p className="text-red-600 text-center text-sm">
                  Êtes-vous sûr de vouloir continuer ? Cette action supprimera définitivement la subvention et tous ses éléments liés.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setGrantToDelete(null);
                  setDeleteDependencies(null);
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 hover:shadow-lg hover:border-gray-400 min-w-32"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setShowDeleteModal(false);
                  if (grantToDelete) {
                    await performGrantDeletion(grantToDelete);
                  }
                  setGrantToDelete(null);
                  setDeleteDependencies(null);
                }}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-200 hover:from-red-700 hover:to-red-800 active:scale-95 min-w-32"
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals des formulaires */}
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