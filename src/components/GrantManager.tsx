import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit, Trash2, Banknote, Calendar, Building, ChevronLeft, ChevronRight, 
  Search, Filter, X, DollarSign, Clock, TrendingUp, AlertCircle, CheckCircle,
  CreditCard, Wallet, Eye, PieChart
} from 'lucide-react';
import { showSuccess, showError, showValidationError, confirmDelete } from '../utils/alerts';
import { Grant, BudgetLine, SubBudgetLine, Payment, Prefinancing, EmployeeLoan, GRANT_STATUS } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface GrantManagerProps {
  grants: Grant[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  payments: Payment[];
  prefinancings: Prefinancing[];
  employeeLoans: EmployeeLoan[];
  onAddGrant: (grant: Omit<Grant, 'id'>) => void;
  onUpdateGrant: (id: string, updates: Partial<Grant>) => void;
  onDeleteGrant: (id: string) => void;
  onUpdateBudgetLine: (id: string, updates: Partial<BudgetLine>) => void;
  onUpdateSubBudgetLine: (id: string, updates: Partial<SubBudgetLine>) => void;
}

const GrantManager: React.FC<GrantManagerProps> = ({
  grants,
  budgetLines,
  subBudgetLines,
  payments = [],
  prefinancings = [],
  employeeLoans = [],
  onAddGrant,
  onUpdateGrant,
  onDeleteGrant,
  onUpdateBudgetLine,
  onUpdateSubBudgetLine
}) => {
  // États principaux
  const [showForm, setShowForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFilters, setSearchFilters] = useState({
    status: '',
    year: '',
    organization: '',
    currency: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [showGrantDetails, setShowGrantDetails] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    reference: '',
    grantingOrganization: '',
    year: new Date().getFullYear(),
    currency: 'EUR' as Grant['currency'],
    totalAmount: '',
    startDate: '',
    endDate: '',
    status: 'pending' as Grant['status'],
    description: '',
    // Champs pour les informations bancaires (stockées dans JSON bank_account)
    bankAccountName: '',
    accountNumber: '',
    bankName: '',
    initialBalance: ''
  });

  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  
  // Configuration de la pagination
  const itemsPerPage = 10;

  // ============================================
  // FONCTIONS DE CALCUL AVEC PAIEMENTS ÉCHELONNÉS
  // ============================================

  /**
   * Calcule le montant total payé pour une subvention
   * Prend en compte les paiements complets et les paiements partiels
   */
  const getTotalPaidForGrant = (grantId: string): number => {
    const grantPayments = payments.filter(p => 
      p.grantId === grantId && 
      (p.status === 'paid' || p.status === 'in_progress')
    );
    
    return grantPayments.reduce((sum, payment) => {
      // Si le paiement a des paiements partiels, sommer ceux-ci
      if (payment.partialPayments && payment.partialPayments.length > 0) {
        const totalPaid = payment.partialPayments.reduce((s, pp) => s + pp.amount, 0);
        return sum + totalPaid;
      }
      // Sinon, prendre le montant total du paiement
      return sum + payment.amount;
    }, 0);
  };

  /**
   * Calcule le montant en cours de paiement pour une subvention
   */
  const getInProgressAmountForGrant = (grantId: string): number => {
    const grantPayments = payments.filter(p => 
      p.grantId === grantId && 
      p.status === 'in_progress' &&
      p.partialPayments && 
      p.partialPayments.length > 0
    );
    
    return grantPayments.reduce((sum, payment) => {
      const totalPaid = payment.partialPayments?.reduce((s, pp) => s + pp.amount, 0) || 0;
      return sum + (payment.amount - totalPaid);
    }, 0);
  };

  /**
   * Calcule le montant restant à payer pour une subvention
   */
  const getRemainingToPayForGrant = (grantId: string): number => {
    const grantEngagements = budgetLines
      .filter(line => line.grantId === grantId)
      .reduce((sum, line) => sum + line.engagedAmount, 0);
    const totalPaid = getTotalPaidForGrant(grantId);
    return Math.max(0, grantEngagements - totalPaid);
  };

  /**
   * Compte le nombre de paiements échelonnés actifs pour une subvention
   */
  const getActivePartialPaymentsForGrant = (grantId: string): number => {
    return payments.filter(p => 
      p.grantId === grantId && 
      p.partialPayments && 
      p.partialPayments.length > 0 && 
      p.status !== 'paid'
    ).length;
  };

  /**
   * Calcule la progression globale des paiements pour une subvention
   */
  const getPaymentProgressForGrant = (grantId: string): number => {
    const grantEngagements = budgetLines
      .filter(line => line.grantId === grantId)
      .reduce((sum, line) => sum + line.engagedAmount, 0);
    
    if (grantEngagements === 0) return 0;
    
    const totalPaid = getTotalPaidForGrant(grantId);
    return (totalPaid / grantEngagements) * 100;
  };

  /**
   * Obtient les statistiques complètes de paiement pour une subvention
   */
  const getPaymentStatsForGrant = (grantId: string) => {
    const grantBudgetLines = budgetLines.filter(line => line.grantId === grantId);
    const totalEngaged = grantBudgetLines.reduce((sum, line) => sum + line.engagedAmount, 0);
    const totalPaid = getTotalPaidForGrant(grantId);
    const inProgress = getInProgressAmountForGrant(grantId);
    const remainingToPay = getRemainingToPayForGrant(grantId);
    const progressRate = totalEngaged > 0 ? (totalPaid / totalEngaged) * 100 : 0;
    const partialPaymentsCount = getActivePartialPaymentsForGrant(grantId);
    
    return {
      totalEngaged,
      totalPaid,
      inProgress,
      remainingToPay,
      progressRate,
      partialPaymentsCount
    };
  };

  // ============================================
  // FONCTIONS DE CALCUL EXISTANTES
  // ============================================

  const getTotalDisbursed = (grantId: string) => {
    // ✅ Cumule les décaissements réels : montants déjà payés de façon échelonnée
    // (paiements in_progress) + paiements directs complets (paid).
    const grantPayments = payments.filter(p =>
      p.grantId === grantId &&
      (p.status === 'paid' || p.status === 'in_progress')
    );
    return grantPayments.reduce((sum, payment) => {
      // Paiement échelonné : additionner ce qui a déjà été payé (partiels)
      if (payment.partialPayments && payment.partialPayments.length > 0) {
        const totalPaid = payment.partialPayments.reduce((s, pp) => s + pp.amount, 0);
        return sum + totalPaid;
      }
      // Paiement direct complet
      if (payment.status === 'paid') {
        return sum + payment.amount;
      }
      return sum;
    }, 0);
  };

  const getTotalEngagedNotDisbursed = (grantId: string) => {
    const engagedPayments = payments.filter(p => 
      p.grantId === grantId && 
      (p.status === 'pending' || p.status === 'in_progress')
    );
    
    return engagedPayments.reduce((sum, payment) => {
      // Pour les paiements en cours, calculer le reste
      if (payment.partialPayments && payment.partialPayments.length > 0) {
        const totalPaid = payment.partialPayments.reduce((s, pp) => s + pp.amount, 0);
        return sum + (payment.amount - totalPaid);
      }
      return sum + payment.amount;
    }, 0);
  };

  // ============================================
  // RECHERCHE ET FILTRAGE
  // ============================================

  const filteredGrants = useMemo(() => {
    return grants.filter(grant => {
      const matchesSearch = searchTerm === '' || 
        grant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grant.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grant.grantingOrganization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (grant.description && grant.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = searchFilters.status === '' || grant.status === searchFilters.status;
      const matchesYear = searchFilters.year === '' || grant.year.toString() === searchFilters.year;
      const matchesOrganization = searchFilters.organization === '' || 
        grant.grantingOrganization.toLowerCase().includes(searchFilters.organization.toLowerCase());
      const matchesCurrency = searchFilters.currency === '' || grant.currency === searchFilters.currency;

      return matchesSearch && matchesStatus && matchesYear && matchesOrganization && matchesCurrency;
    });
  }, [grants, searchTerm, searchFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredGrants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchFilters]);

  // ============================================
  // GESTIONNAIRES
  // ============================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchFilters({
      status: '',
      year: '',
      organization: '',
      currency: ''
    });
  };

  const hasActiveFilters = searchTerm || searchFilters.status || searchFilters.year || 
                          searchFilters.organization || searchFilters.currency;

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ============================================
  // FORMULAIRE
  // ============================================

  const resetForm = () => {
    setFormData({
      name: '',
      reference: '',
      grantingOrganization: '',
      year: new Date().getFullYear(),
      currency: 'EUR',
      totalAmount: '',
      startDate: '',
      endDate: '',
      status: 'pending',
      description: '',
      bankAccountName: '',
      accountNumber: '',
      bankName: '',
      initialBalance: ''
    });
    setShowForm(false);
    setEditingGrant(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate && !editingGrant) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de créer des subventions');
      return;
    }

    if (!canEdit && editingGrant) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de modifier des subventions');
      return;
    }
    
    if (!formData.name || !formData.reference || !formData.grantingOrganization || !formData.totalAmount) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const notifiedAmount = parseFloat(formData.totalAmount);
    const initialBalance = parseFloat(formData.initialBalance) || 0;

    const bankAccount = (formData.bankAccountName || formData.accountNumber || formData.bankName) ? {
      name: formData.bankAccountName || '',
      accountNumber: formData.accountNumber || '',
      bankName: formData.bankName || '',
      balance: initialBalance,
      lastUpdateDate: new Date().toISOString().split('T')[0]
    } : null;

    if (editingGrant) {
      const grantBudgetLines = budgetLines.filter(line => line.grantId === editingGrant.id);
      const currentNotifiedAmount = editingGrant.totalAmount;
      const newNotifiedAmount = notifiedAmount;
      
      if (currentNotifiedAmount !== newNotifiedAmount && grantBudgetLines.length > 0) {
        const totalPlannedAmount = grantBudgetLines.reduce((sum, line) => sum + line.plannedAmount, 0);
        
        if (totalPlannedAmount > 0) {
          grantBudgetLines.forEach(line => {
            const proportion = line.plannedAmount / totalPlannedAmount;
            const newLineNotifiedAmount = newNotifiedAmount * proportion;
            const newAvailableAmount = newLineNotifiedAmount - line.engagedAmount;
            
            onUpdateBudgetLine(line.id, {
              notifiedAmount: newLineNotifiedAmount,
              availableAmount: newAvailableAmount
            });
            
            const lineSubBudgetLines = subBudgetLines.filter(subLine => subLine.budgetLineId === line.id);
            if (lineSubBudgetLines.length > 0) {
              const totalSubLinePlanned = lineSubBudgetLines.reduce((sum, subLine) => sum + subLine.plannedAmount, 0);
              
              if (totalSubLinePlanned > 0) {
                lineSubBudgetLines.forEach(subLine => {
                  const subProportion = subLine.plannedAmount / totalSubLinePlanned;
                  const newSubLineNotifiedAmount = newLineNotifiedAmount * subProportion;
                  const newSubLineAvailableAmount = newSubLineNotifiedAmount - subLine.engagedAmount;
                  
                  onUpdateSubBudgetLine(subLine.id, {
                    notifiedAmount: newSubLineNotifiedAmount,
                    availableAmount: newSubLineAvailableAmount
                  });
                });
              }
            }
          });
        } else {
          const amountPerLine = newNotifiedAmount / grantBudgetLines.length;
          grantBudgetLines.forEach(line => {
            const newAvailableAmount = amountPerLine - line.engagedAmount;
            onUpdateBudgetLine(line.id, {
              notifiedAmount: amountPerLine,
              availableAmount: newAvailableAmount
            });
          });
        }
      }

      const plannedAmount = grantBudgetLines.reduce((sum, line) => sum + line.plannedAmount, 0);

      onUpdateGrant(editingGrant.id, {
        name: formData.name,
        reference: formData.reference,
        grantingOrganization: formData.grantingOrganization,
        year: formData.year,
        currency: formData.currency,
        plannedAmount: plannedAmount,
        totalAmount: notifiedAmount,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        description: formData.description,
        bankAccount: bankAccount
      });

      showSuccess('Subvention modifiée', 'La subvention a été modifiée avec succès');
    } else {
      onAddGrant({
        name: formData.name,
        reference: formData.reference,
        grantingOrganization: formData.grantingOrganization,
        year: formData.year,
        currency: formData.currency,
        plannedAmount: 0,
        totalAmount: notifiedAmount,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        description: formData.description,
        bankAccount: bankAccount
      });
      showSuccess('Subvention créée', 'La subvention a été créée avec succès');
    }

    resetForm();
  };

  const startEdit = (grant: Grant) => {
    if (!canEdit) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de modifier des subventions');
      return;
    }
    
    setEditingGrant(grant);
    setFormData({
      name: grant.name,
      reference: grant.reference,
      grantingOrganization: grant.grantingOrganization,
      year: grant.year,
      currency: grant.currency,
      totalAmount: grant.totalAmount.toString(),
      startDate: grant.startDate,
      endDate: grant.endDate,
      status: grant.status,
      description: grant.description || '',
      bankAccountName: grant.bankAccount?.name || '',
      accountNumber: grant.bankAccount?.accountNumber || '',
      bankName: grant.bankAccount?.bankName || '',
      initialBalance: grant.bankAccount?.balance?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (grant: Grant) => {
    if (!canDelete) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de supprimer des subventions');
      return;
    }

    const confirmed = await confirmDelete(
      'Supprimer la subvention',
      `Êtes-vous sûr de vouloir supprimer la subvention "${grant.name}" ? Cette action est irréversible.`
    );
    if (confirmed) {
      onDeleteGrant(grant.id);
      showSuccess('Subvention supprimée', 'La subvention a été supprimée avec succès');
    }
  };

  // ============================================
  // FONCTIONS D'AFFICHAGE
  // ============================================

  const getCurrencySymbol = (currency: Grant['currency']) => {
    switch (currency) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'XOF': return 'CFA';
      default: return '€';
    }
  };

  const formatCurrency = (amount: number, currency: Grant['currency']) => {
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: currency === 'XOF' ? 'XOF' : currency,
      minimumFractionDigits: currency === 'XOF' ? 0 : 2
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: Grant['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: Grant['status']) => {
    switch (status) {
      case 'active': return 'Active';
      case 'pending': return 'En attente';
      case 'completed': return 'Terminée';
      case 'suspended': return 'Suspendue';
      default: return status;
    }
  };

  // Données pour les filtres
  const uniqueYears = [...new Set(grants.map(grant => grant.year.toString()))]
    .sort((a, b) => parseInt(b) - parseInt(a));
  const uniqueOrganizations = [...new Set(grants.map(grant => grant.grantingOrganization))].sort();
  const uniqueCurrencies = [...new Set(grants.map(grant => grant.currency))];

  // Permissions
  const canCreate = hasPermission('grants', 'create');
  const canEdit = hasPermission('grants', 'edit');
  const canDelete = hasPermission('grants', 'delete');
  const canView = hasPermission('grants', 'view');

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasModuleAccess('grants')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Banknote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder à ce module.</p>
        </div>
      </div>
    );
  }

  // Trier les subventions par ID décroissant
  const sortedFilteredGrants = [...filteredGrants].sort((a, b) => parseInt(b.id) - parseInt(a.id));
  const currentSortedGrants = sortedFilteredGrants.slice(startIndex, endIndex);

  // ============================================
  // COMPOSANT DETAILS GRANT
  // ============================================

  const GrantDetailsModal = ({ grant, onClose }: { grant: Grant; onClose: () => void }) => {
    const paymentStats = getPaymentStatsForGrant(grant.id);
    const totalDisbursed = getTotalDisbursed(grant.id);
    const engagedNotDisbursed = getTotalEngagedNotDisbursed(grant.id);
    const utilizationRate = grant.totalAmount > 0 ? (paymentStats.totalEngaged / grant.totalAmount) * 100 : 0;
    const disbursementRate = grant.totalAmount > 0 ? (totalDisbursed / grant.totalAmount) * 100 : 0;
    
    // Paiements échelonnés pour cette subvention
    const partialPayments = payments.filter(p => 
      p.grantId === grant.id && 
      p.partialPayments && 
      p.partialPayments.length > 0
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 p-6 border-b flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{grant.name}</h3>
              <p className="text-sm text-gray-600">{grant.reference}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Informations générales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Organisme</p>
                <p className="font-medium">{grant.grantingOrganization}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Année</p>
                <p className="font-medium">{grant.year}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Statut</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(grant.status)}`}>
                  {getStatusLabel(grant.status)}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Devise</p>
                <p className="font-medium">{grant.currency} ({getCurrencySymbol(grant.currency)})</p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Date de début</p>
                <p className="font-medium">{grant.startDate ? new Date(grant.startDate).toLocaleDateString('fr-FR') : 'Non définie'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date de fin</p>
                <p className="font-medium">
                  {grant.endDate ? new Date(grant.endDate).toLocaleDateString('fr-FR') : 'Non définie'}
                  {grant.endDate && (() => {
                    const days = getDaysRemaining(grant.endDate);
                    return days !== null && (
                      <span className={`ml-2 text-sm ${days < 30 ? 'text-red-600' : days < 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                        ({days > 0 ? `${days} jours` : days === 0 ? 'Aujourd\'hui' : 'Expiré'})
                      </span>
                    );
                  })()}
                </p>
              </div>
            </div>

            {/* Description */}
            {grant.description && (
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-gray-800">{grant.description}</p>
              </div>
            )}

            {/* Statistiques financières */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-4">Statistiques financières</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Montant notifié</p>
                  <p className="font-bold text-blue-600">{formatCurrency(grant.totalAmount, grant.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Montant engagé</p>
                  <p className="font-bold text-orange-600">{formatCurrency(paymentStats.totalEngaged, grant.currency)}</p>
                  <p className="text-xs text-gray-500">{utilizationRate.toFixed(2)}% du notifié</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Décaissé</p>
                  <p className="font-bold text-green-600">{formatCurrency(totalDisbursed, grant.currency)}</p>
                  <p className="text-xs text-gray-500">{disbursementRate.toFixed(2)}% du notifié</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Reste à payer</p>
                  <p className="font-bold text-red-600">{formatCurrency(paymentStats.remainingToPay, grant.currency)}</p>
                </div>
              </div>
            </div>

            {/* Paiements échelonnés */}
            {partialPayments.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-purple-600" />
                  Paiements échelonnés ({partialPayments.length})
                </h4>
                <div className="space-y-3">
                  {partialPayments.map(payment => {
                    const totalPaid = payment.partialPayments?.reduce((sum, pp) => sum + pp.amount, 0) || 0;
                    const progress = payment.amount > 0 ? (totalPaid / payment.amount) * 100 : 0;
                    const remaining = payment.amount - totalPaid;
                    
                    return (
                      <div key={payment.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{payment.paymentNumber}</p>
                            <p className="text-sm text-gray-600">{payment.supplier}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                            payment.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {payment.status === 'paid' ? 'Payé' :
                             payment.status === 'in_progress' ? 'En cours' : 'En attente'}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Progression</span>
                            <span className="font-medium text-purple-600">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-purple-600 transition-all duration-300"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Payé: {formatCurrency(totalPaid, grant.currency)}</span>
                            <span className="text-orange-600">Reste: {formatCurrency(remaining, grant.currency)}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {payment.partialPayments?.length || 0} versement(s) effectué(s)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compte bancaire */}
            {grant.bankAccount && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-900 mb-3">Compte bancaire associé</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-green-700">Nom du compte</p>
                    <p className="font-medium text-green-900">{grant.bankAccount.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700">Banque</p>
                    <p className="font-medium text-green-900">{grant.bankAccount.bankName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-green-700">Numéro de compte</p>
                    <p className="font-mono text-sm text-green-900 break-all">{grant.bankAccount.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700">Solde actuel</p>
                    <p className="font-bold text-xl text-green-600">
                      {formatCurrency(grant.bankAccount.balance, grant.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700">Dernière mise à jour</p>
                    <p className="text-sm text-green-900">{grant.bankAccount.lastUpdateDate}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Subventions</h2>
          <p className="text-gray-600 mt-1">Gérez vos subventions et financements</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Subvention</span>
          </button>
        )}
      </div>

      {/* Section Recherche et Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Recherche et Filtres
          </h3>
          <div className="flex items-center space-x-3">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
              >
                <X className="w-4 h-4" />
                <span>Effacer tous les filtres</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center space-x-1"
            >
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Rechercher par nom, référence, organisation ou description..."
          />
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={searchFilters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="active">Active</option>
                <option value="completed">Terminée</option>
                <option value="suspended">Suspendue</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Année
              </label>
              <select
                value={searchFilters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Toutes les années</option>
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organisme financeur
              </label>
              <select
                value={searchFilters.organization}
                onChange={(e) => handleFilterChange('organization', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Tous les organismes</option>
                {uniqueOrganizations.map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Devise
              </label>
              <select
                value={searchFilters.currency}
                onChange={(e) => handleFilterChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Toutes les devises</option>
                {uniqueCurrencies.map(currency => (
                  <option key={currency} value={currency}>
                    {currency === 'EUR' ? 'Euro (€)' : 
                     currency === 'USD' ? 'Dollar US ($)' : 
                     'Franc CFA (CFA)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Résultats */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm text-gray-600">
            {filteredGrants.length} subvention{filteredGrants.length > 1 ? 's' : ''} trouvée{filteredGrants.length > 1 ? 's' : ''}
            {hasActiveFilters && ' (filtrées)'}
          </span>
          {filteredGrants.length === 0 && grants.length > 0 && (
            <span className="text-sm text-orange-600 font-medium">
              Aucune subvention ne correspond aux critères de recherche
            </span>
          )}
        </div>
      </div>

      {/* Modal de formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingGrant ? 'Modifier la subvention' : 'Nouvelle subvention'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Devise *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as Grant['currency'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dollar US ($)</option>
                    <option value="XOF">Franc CFA (CFA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Année *
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du projet *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Projet Innovation Numérique"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Référence *
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: PIN-2024-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organisme financeur *
                  </label>
                  <input
                    type="text"
                    value={formData.grantingOrganization}
                    onChange={(e) => setFormData(prev => ({ ...prev, grantingOrganization: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Région Nouvelle-Aquitaine"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant total notifié *
                </label>
                <div className="relative">
                  <input
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-12"
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    {getCurrencySymbol(formData.currency)}
                  </div>
                </div>
                {editingGrant && budgetLines.filter(line => line.grantId === editingGrant.id).length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    ⚡ La modification sera répartie proportionnellement aux lignes budgétaires
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Grant['status'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">En attente</option>
                  <option value="active">Active</option>
                  <option value="completed">Terminée</option>
                  <option value="suspended">Suspendue</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description du projet..."
                />
              </div>

              {/* Informations du compte bancaire */}
              <div className="bg-green-50 rounded-xl p-4 md:p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations du Compte Bancaire (Optionnel)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom du compte
                    </label>
                    <input
                      type="text"
                      value={formData.bankAccountName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankAccountName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Compte Subvention PIN 2024"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de compte
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: FR76 1234 5678 9012 3456 78"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de la banque
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Crédit Agricole"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Solde initial
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.initialBalance}
                        onChange={(e) => setFormData(prev => ({ ...prev, initialBalance: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-12"
                        placeholder="0.00"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                        {getCurrencySymbol(formData.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                >
                  {editingGrant ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des subventions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Liste des Subventions ({filteredGrants.length})
            </h3>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} sur {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {currentSortedGrants.length === 0 ? (
            <div className="text-center py-12">
              <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {grants.length === 0 ? 'Aucune subvention trouvée' : 'Aucune subvention ne correspond à votre recherche'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {grants.length === 0 ? 'Créez votre première subvention pour commencer' : 'Essayez de modifier vos critères de recherche'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentSortedGrants.map((grant) => {
                const grantBudgetLines = budgetLines.filter(line => line.grantId === grant.id);
                const totalEngaged = grantBudgetLines.reduce((sum, line) => sum + line.engagedAmount, 0);
                
                const totalDisbursed = getTotalDisbursed(grant.id);
                const totalEngagedNotDisbursed = getTotalEngagedNotDisbursed(grant.id);
                const paymentStats = getPaymentStatsForGrant(grant.id);
                const activePartialPayments = getActivePartialPaymentsForGrant(grant.id);
                
                const remainingAmount = grant.totalAmount - totalEngaged;
                const utilizationRate = grant.totalAmount > 0 ? (totalEngaged / grant.totalAmount) * 100 : 0;
                const disbursementRate = grant.totalAmount > 0 ? (totalDisbursed / grant.totalAmount) * 100 : 0;
                const progressRate = paymentStats.progressRate;
                const daysRemaining = grant.endDate ? getDaysRemaining(grant.endDate) : null;

                return (
                  <div key={grant.id} className="border border-gray-200 rounded-xl p-4 md:p-6 hover:shadow-md transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-4">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2 gap-2">
                          <h4 className="text-lg font-semibold text-gray-900">{grant.name}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full w-fit ${getStatusColor(grant.status)}`}>
                            {getStatusLabel(grant.status)}
                          </span>
                          {activePartialPayments > 0 && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 w-fit">
                              <DollarSign className="w-3 h-3 mr-1" />
                              {activePartialPayments} échelonné(s)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-600 mb-3 gap-1">
                          <span className="flex items-center space-x-1">
                            <Building className="w-4 h-4" />
                            <span>{grant.grantingOrganization}</span>
                          </span>
                          <span className="hidden sm:block">•</span>
                          <span>Réf: {grant.reference}</span>
                          <span className="hidden sm:block">•</span>
                          <span>{grant.year}</span>
                          {grant.endDate && daysRemaining !== null && (
                            <>
                              <span className="hidden sm:block">•</span>
                              <span className={`flex items-center space-x-1 ${
                                daysRemaining < 30 ? 'text-red-600' : daysRemaining < 90 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {daysRemaining > 0 ? `${daysRemaining} jours restants` : 
                                   daysRemaining === 0 ? 'Expire aujourd\'hui' : 'Expiré'}
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                        {grant.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{grant.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 self-end lg:self-auto">
                        <button
                          onClick={() => {
                            setSelectedGrantId(grant.id);
                            setShowGrantDetails(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => startEdit(grant)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(grant)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Résumé financier */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-blue-600 font-medium mb-1">Notifié</p>
                        <p className="text-sm md:text-base font-semibold text-blue-900">
                          {formatCurrency(grant.totalAmount, grant.currency)}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-orange-600 font-medium mb-1">Engagé</p>
                        <p className="text-sm md:text-base font-semibold text-orange-900">
                          {formatCurrency(totalEngaged, grant.currency)}
                        </p>
                        <p className="text-xs text-orange-500">
                          {utilizationRate.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-green-600 font-medium mb-1">Décaissé</p>
                        <p className="text-sm md:text-base font-semibold text-green-900">
                          {formatCurrency(totalDisbursed, grant.currency)}
                        </p>
                        <p className="text-xs text-green-500">
                          {disbursementRate.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-purple-600 font-medium mb-1">En cours</p>
                        <p className="text-sm md:text-base font-semibold text-purple-900">
                          {formatCurrency(paymentStats.inProgress, grant.currency)}
                        </p>
                        {activePartialPayments > 0 && (
                          <p className="text-xs text-purple-500">
                            {activePartialPayments} paiement(s)
                          </p>
                        )}
                      </div>
                      <div className="bg-red-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-red-600 font-medium mb-1">Reste</p>
                        <p className="text-sm md:text-base font-semibold text-red-900">
                          {formatCurrency(paymentStats.remainingToPay, grant.currency)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-gray-600 font-medium mb-1">Non engagé</p>
                        <p className="text-sm md:text-base font-semibold text-gray-900">
                          {formatCurrency(Math.max(0, grant.totalAmount - totalEngaged), grant.currency)}
                        </p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-2 md:p-3">
                        <p className="text-xs text-indigo-600 font-medium mb-1">Progression</p>
                        <p className="text-sm md:text-base font-semibold text-indigo-900">
                          {progressRate.toFixed(2)}%
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className="h-1 rounded-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${Math.min(progressRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Barres de progression */}
                    <div className="space-y-2 mb-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">Taux d'engagement</span>
                          <span className="text-sm text-gray-600">{utilizationRate.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              utilizationRate >= 90 ? 'bg-red-500' :
                              utilizationRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">Taux de décaissement</span>
                          <span className="text-sm text-gray-600">{disbursementRate.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              disbursementRate >= 90 ? 'bg-red-500' :
                              disbursementRate >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(disbursementRate, 100)}%` }}
                          />
                        </div>
                      </div>

                      {activePartialPayments > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-purple-700">Progression des paiements échelonnés</span>
                            <span className="text-sm text-purple-600">{progressRate.toFixed(2)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-purple-600 transition-all duration-300"
                              style={{ width: `${Math.min(progressRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Compte bancaire */}
                    {grant.bankAccount && (
                      <div className="mt-3 bg-green-50 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Wallet className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-900">
                              {grant.bankAccount.name}
                            </span>
                            <span className="text-xs text-green-700">{grant.bankAccount.bankName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-green-600">Solde</span>
                            <span className="ml-2 font-bold text-green-700">
                              {formatCurrency(grant.bankAccount.balance, grant.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 mt-6 p-4 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              Affichage de {startIndex + 1} à {Math.min(endIndex, filteredGrants.length)} sur {filteredGrants.length} subvention{filteredGrants.length > 1 ? 's' : ''}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>
              
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 text-sm rounded-lg min-w-[40px] ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <span>Suivant</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Détails Subvention */}
      {showGrantDetails && selectedGrantId && (
        <GrantDetailsModal
          grant={grants.find(g => g.id === selectedGrantId)!}
          onClose={() => {
            setShowGrantDetails(false);
            setSelectedGrantId(null);
          }}
        />
      )}
    </div>
  );
};

export default GrantManager;