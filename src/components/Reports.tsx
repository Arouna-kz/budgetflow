import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, Filter, FileText, Users, CreditCard, Eye, X, Menu, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Grant, BudgetLine, Engagement, Payment, EmployeeLoan, Prefinancing, DEFAULT_BUDGET_LINES } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { showSuccess, showError } from '../utils/alerts';

interface ReportsProps {
  grants: Grant[];
  budgetLines: BudgetLine[];
  subBudgetLines: any[];
  expenses: Engagement[];
  payments?: Payment[];
  employeeLoans?: EmployeeLoan[];
  prefinancings?: Prefinancing[];
}

type SortField = 'date' | 'description' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

const Reports: React.FC<ReportsProps> = ({ 
  grants, 
  budgetLines, 
  subBudgetLines,
  expenses, 
  payments = [], 
  employeeLoans = [], 
  prefinancings = [] 
}) => {
  // === HOOKS DE BASE ===
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'category' | 'beneficiaries' | 'paid-suppliers' | 'pending-suppliers'>('summary');
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // === SYSTÈME DE PERMISSIONS ===
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();

  // Permissions spécifiques au module Reports
  const canView = hasPermission('reports', 'view');
  const canExport = hasPermission('reports', 'export');
  const canViewDetails = hasPermission('reports', 'view_details');

  // === DÉTECTION RESPONSIVE ===
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // === VÉRIFICATION DES PERMISSIONS - APRÈS LES HOOKS ===
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

  if (!hasModuleAccess('reports')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder aux rapports.</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Permission refusée</h2>
          <p className="text-gray-500">Vous n'avez pas la permission de visualiser les rapports.</p>
        </div>
      </div>
    );
  }

  // === DONNÉES ET CALCULS ===
  const selectedGrant = grants.length > 0 ? grants[0] : null;

  // Fonction pour formater les montants avec la devise de la subvention
  const formatCurrency = (amount: number) => {
    if (!selectedGrant) return amount.toLocaleString('fr-FR');
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: selectedGrant.currency === 'XOF' ? 'XOF' : selectedGrant.currency,
      minimumFractionDigits: selectedGrant.currency === 'XOF' ? 0 : 2
    });
  };

  const getCurrencySymbol = () => {
    if (!selectedGrant) return '€';
    
    switch (selectedGrant.currency) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'XOF': return 'CFA';
      default: return '€';
    }
  };

  // Fonction pour filtrer les données selon la période sélectionnée
  const filterByDate = (date: Date) => {
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      return date >= startDate && date <= endDate;
    }
    
    const now = new Date();
    switch (selectedPeriod) {
      case 'current-month':
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
      case 'current-year':
        return date.getFullYear() === now.getFullYear();
      case 'last-year':
        return date.getFullYear() === now.getFullYear() - 1;
      case 'last-3-months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        return date >= threeMonthsAgo && date <= now;
      case 'last-6-months':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        return date >= sixMonthsAgo && date <= now;
      default:
        return true;
    }
  };

  // Filtrer les données selon les permissions
  const filteredExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return filterByDate(expenseDate);
  });

  const filteredPayments = payments.filter(payment => {
    const paymentDate = new Date(payment.date);
    return filterByDate(paymentDate);
  });

  const filteredEmployeeLoans = employeeLoans.filter(loan => {
    const loanDate = new Date(loan.date);
    return filterByDate(loanDate);
  });

  const filteredPrefinancings = prefinancings.filter(prefinancing => {
    const prefinancingDate = new Date(prefinancing.date);
    return filterByDate(prefinancingDate);
  });

  const filteredBudgetLines = budgetLines;

  const selectedGrantData = selectedGrant;

  const totalBudget = filteredBudgetLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
  const totalEngaged = filteredBudgetLines.reduce((sum, line) => sum + line.engagedAmount, 0);
  const totalAvailable = filteredBudgetLines.reduce((sum, line) => sum + line.availableAmount, 0);
  const executionRate = totalBudget > 0 ? (totalEngaged / totalBudget) * 100 : 0;

  const categoryStats = DEFAULT_BUDGET_LINES.map(category => {
    const categoryLines = filteredBudgetLines.filter(line => line.name === category.name);
    const notified = categoryLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
    const engaged = categoryLines.reduce((sum, line) => sum + line.engagedAmount, 0);
    const available = categoryLines.reduce((sum, line) => sum + line.availableAmount, 0);
    
    return {
      ...category,
      notified,
      engaged,
      available,
      executionRate: notified > 0 ? (engaged / notified) * 100 : 0
    };
  }).filter(cat => cat.notified > 0);

  const grantStats = grants.map(grant => {
    const grantExpenses = expenses.filter(exp => exp.grantId === grant.id);
    const totalExpenses = grantExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const paidExpenses = grantExpenses.filter(exp => exp.status === 'paid').reduce((sum, exp) => sum + exp.amount, 0);
    
    return {
      ...grant,
      totalExpenses,
      paidExpenses,
      utilizationRate: grant.totalAmount > 0 ? (paidExpenses / grant.totalAmount) * 100 : 0
    };
  });

  // État des bénéficiaires avances/prêt
  const getBeneficiariesState = () => {
    const beneficiaries = new Map();
    
    filteredEmployeeLoans.forEach(loan => {
      const totalRepaid = loan.repayments.reduce((sum, rep) => sum + rep.amount, 0);
      const remaining = loan.amount - totalRepaid;
      
      if (beneficiaries.has(loan.employee.name)) {
        const existing = beneficiaries.get(loan.employee.name);
        beneficiaries.set(loan.employee.name, {
          ...existing,
          totalObtained: existing.totalObtained + loan.amount,
          totalRepaid: existing.totalRepaid + totalRepaid,
          balance: existing.balance + remaining
        });
      } else {
        beneficiaries.set(loan.employee.name, {
          name: loan.employee.name,
          employeeId: loan.employee.employeeId,
          totalObtained: loan.amount,
          totalRepaid: totalRepaid,
          balance: remaining,
          observations: loan.status === 'completed' ? 'Remboursé' : 'En cours'
        });
      }
    });

    return Array.from(beneficiaries.values());
  };

  // État des fournisseurs payés
  const getPaidSuppliersState = () => {
    const suppliers = new Map();
    
    filteredPayments.filter(payment => payment.status === 'paid' || payment.status === 'cashed').forEach(payment => {
      const engagement = expenses.find(eng => eng.id === payment.engagementId);
      const budgetLine = budgetLines.find(line => line.id === payment.budgetLineId);
      
      if (engagement && budgetLine) {
        const key = payment.supplier;
        if (suppliers.has(key)) {
          const existing = suppliers.get(key);
          existing.payments.push({
            date: payment.date,
            invoiceRef: payment.invoiceNumber || '',
            checkRef: payment.checkNumber || payment.bankReference || '',
            amount: payment.amount,
            balance: existing.balance + payment.amount
          });
          existing.balance += payment.amount;
        } else {
          suppliers.set(key, {
            supplier: payment.supplier,
            payments: [{
              date: payment.date,
              invoiceRef: payment.invoiceNumber || '',
              checkRef: payment.checkNumber || payment.bankReference || '',
              amount: payment.amount,
              balance: payment.amount
            }],
            balance: payment.amount
          });
        }
      }
    });

    return Array.from(suppliers.values());
  };

  // État des fournisseurs en attente de paiements
  const getPendingSuppliersState = () => {
    const suppliers = new Map();
    
    const approvedEngagements = filteredExpenses.filter(engagement => 
      engagement.status === 'approved' && 
      !filteredPayments.some(payment => payment.engagementId === engagement.id)
    );

    approvedEngagements.forEach(engagement => {
      const budgetLine = budgetLines.find(line => line.id === engagement.budgetLineId);
      
      if (engagement.supplier && budgetLine) {
        const key = engagement.supplier;
        if (suppliers.has(key)) {
          const existing = suppliers.get(key);
          existing.invoices.push({
            date: engagement.date,
            budgetLine: budgetLine.name,
            invoiceRef: engagement.invoiceNumber || '',
            amount: engagement.amount
          });
          existing.totalAmount += engagement.amount;
        } else {
          suppliers.set(key, {
            supplier: engagement.supplier,
            invoices: [{
              date: engagement.date,
              budgetLine: budgetLine.name,
              invoiceRef: engagement.invoiceNumber || '',
              amount: engagement.amount
            }],
            totalAmount: engagement.amount,
            observations: 'En attente de paiement'
          });
        }
      }
    });

    return Array.from(suppliers.values());
  };

  // Gérer le changement de période
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  // Formater la période sélectionnée pour l'affichage
  const getPeriodDisplayText = () => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate).toLocaleDateString('fr-FR');
      const end = new Date(customEndDate).toLocaleDateString('fr-FR');
      return `Période personnalisée: ${start} - ${end}`;
    }
    
    const periodLabels: Record<string, string> = {
      'all': 'Toute la période',
      'current-month': 'Mois en cours',
      'last-month': 'Mois dernier',
      'current-year': 'Année en cours',
      'last-year': 'Année dernière',
      'last-3-months': '3 derniers mois',
      'last-6-months': '6 derniers mois'
    };
    
    return periodLabels[selectedPeriod] || 'Période non spécifiée';
  };

  // Tri et pagination pour le rapport détaillé
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 opacity-30" />;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" /> : 
      <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />;
  };

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'date') {
      aValue = new Date(a.date).getTime();
      bValue = new Date(b.date).getTime();
    } else if (sortField === 'description') {
      aValue = a.description?.toLowerCase() || '';
      bValue = b.description?.toLowerCase() || '';
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExpenses = sortedExpenses.slice(startIndex, startIndex + itemsPerPage);

  // === COMPOSANTS RÉUTILISABLES ===
  
  // Carte statistique responsive
  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 stat-card-print">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
          <p className={`text-lg sm:text-xl font-bold ${color} truncate`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
        </div>
        <div className={`p-2 ${color.replace('text-', 'bg-').replace('-600', '-100')} rounded-full flex-shrink-0 ml-2`}>
          <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
        </div>
      </div>
    </div>
  );

  // Pagination responsive
  const Pagination = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      <div className="text-xs sm:text-sm text-gray-700">
        Lignes {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedExpenses.length)} sur {sortedExpenses.length}
      </div>
      <div className="flex items-center space-x-1">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="p-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="flex space-x-1">
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 3) pageNum = i + 1;
            else if (currentPage === 1) pageNum = i + 1;
            else if (currentPage === totalPages) pageNum = totalPages - 2 + i;
            else pageNum = currentPage - 1 + i;

            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-1 rounded text-xs ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Styles d'impression avec logo
  const PrintStyles = () => (
    <style jsx>{`
      @media print {
        /* Masquer tous les éléments sauf le contenu des rapports */
        body * {
          visibility: hidden;
        }
        
        /* Afficher uniquement le composant Reports */
        .print-container,
        .print-container * {
          visibility: visible;
        }
        
        /* Positionner le contenu à imprimer */
        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          margin: 0;
          padding: 0;
        }
        
        /* Styles spécifiques pour l'impression */
        .no-print { 
          display: none !important; 
        }
        
        .print-only { 
          display: block !important; 
        }
        
        .print-header { 
          text-align: center; 
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        
        .print-logo {
          text-align: center;
          margin-bottom: 15px;
        }
        
        .print-logo img {
          max-height: 60px;
          max-width: 200px;
        }
        
        .print-organization {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        
        .print-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .print-subtitle {
          font-size: 14px;
          margin-bottom: 5px;
        }
        
        .print-period {
          font-size: 12px;
          margin-bottom: 10px;
          font-style: italic;
        }
        
        .print-date {
          font-size: 11px;
          color: #666;
        }
        
        .print-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 15px 0;
          font-size: 10px;
        }
        
        .print-table th, 
        .print-table td { 
          border: 1px solid #000; 
          padding: 6px 8px; 
          text-align: left; 
        }
        
        .print-table th { 
          background-color: #f5f5f5 !important; 
          font-weight: bold; 
          text-align: center; 
        }
        
        .print-amount { 
          text-align: right; 
        }
        
        .print-total-row { 
          font-weight: bold; 
          background-color: #f0f0f0 !important; 
        }
        
        /* Améliorer l'apparence des cartes en impression */
        .bg-white {
          background-color: white !important;
          box-shadow: none !important;
          border: 1px solid #ddd !important;
        }
        
        /* Cacher les éléments interactifs */
        button, select, input {
          display: none !important;
        }
        
        /* Assurer que le texte est noir */
        .text-gray-900, .text-gray-700, .text-gray-600 {
          color: #000 !important;
        }
        
        /* Styles pour les stat cards en impression */
        .stat-card-print {
          border: 1px solid #ddd !important;
          background: white !important;
          margin-bottom: 10px !important;
        }
      }
      
      @page {
        margin: 1cm;
        size: A4 portrait;
      }
    `}</style>
  );

  // Fonction pour gérer l'exportation PDF
  const handleExportPDF = () => {
    // Préparer le document pour l'impression
    const originalTitle = document.title;
    document.title = `Rapport_${reportType}_${new Date().toLocaleDateString('fr-FR')}`;
    
    // Déclencher l'impression
    window.print();
    
    // Restaurer le titre original après un délai
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 print:bg-white print-container">
      <PrintStyles />

      {/* En-tête d'impression avec logo */}
      <div className="hidden print:block print-header">
        {/* Logo ajouté ici */}
        <div className="print-logo">
          <img 
            src="/budgetbase/logo.png" 
            alt="Logo BudgetBase" 
            className="print-logo-img"
          />
        </div>
        
        <div className="print-organization">
          CELLULE DE COORDINATION DE LA COOPÉRATION CÔTE D'IVOIRE-UNION EUROPÉENNE
        </div>
        <div className="print-title">
          {reportType === 'beneficiaries' && 'ÉTAT DES BÉNÉFICIAIRES AVANCES/PRÊT'}
          {reportType === 'paid-suppliers' && 'ÉTAT DES FOURNISSEURS PAYÉS'}
          {reportType === 'pending-suppliers' && 'ÉTAT DES FOURNISSEURS EN ATTENTE DE PAIEMENTS'}
          {reportType === 'summary' && 'RAPPORT DE SYNTHÈSE BUDGÉTAIRE'}
          {reportType === 'detailed' && 'RAPPORT DÉTAILLÉ DES ENGAGEMENTS'}
          {reportType === 'category' && 'ANALYSE PAR CATÉGORIE BUDGÉTAIRE'}
        </div>
        {selectedGrantData && (
          <>
            <div className="print-subtitle">
              <strong>Subvention:</strong> {selectedGrantData.name}
            </div>
            <div className="print-subtitle">
              <strong>Référence:</strong> {selectedGrantData.reference} - {selectedGrantData.grantingOrganization}
            </div>
          </>
        )}
        <div className="print-period">
          <strong>Période:</strong> {getPeriodDisplayText()}
        </div>
        <div className="print-date">
          <strong>Édité le:</strong> {new Date().toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} à {new Date().toLocaleTimeString('fr-FR')}
        </div>
      </div>

      {/* === HEADER MOBILE === */}
      <div className="lg:hidden no-print">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Rapports Budgetaires</h2>
            <p className="text-sm text-gray-600 mt-1">Analyses et statistiques</p>
          </div>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 bg-gray-100 rounded-lg"
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Menu mobile */}
        {showMobileMenu && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-4">
            <div className="space-y-3">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="summary">Synthèse</option>
                 <option value="detailed">Détaillé</option>
                 <option value="beneficiaries">Bénéficiaires</option>
                 <option value="paid-suppliers">Fournisseurs Payés</option>
                <option value="pending-suppliers">Fournisseurs En Attente</option>
              </select>

              {canExport && (
                <button
                  onClick={handleExportPDF}
                  className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg font-medium text-sm flex items-center justify-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Exporter PDF</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === HEADER DESKTOP === */}
      <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rapports Budgetaires</h2>
          <p className="text-gray-600 mt-1">Analyses détaillées et statistiques financières</p>
        </div>
        <div className="flex items-center space-x-3">
          {canExport && (
            <button
              onClick={handleExportPDF}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Exporter PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* === FILTRES AVEC PERMISSIONS === */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 no-print">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">Filtres</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de rapport
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="summary">Synthèse</option>
              <option value="detailed">Détaillé</option>
              <option value="beneficiaries">Bénéficiaires</option>
              <option value="paid-suppliers">Fournisseurs Payés</option>
              <option value="pending-suppliers">Fournisseurs En Attente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Toute la période</option>
              <option value="current-month">Mois en cours</option>
              <option value="last-month">Mois dernier</option>
              <option value="current-year">Année en cours</option>
              <option value="last-year">Année dernière</option>
              <option value="last-3-months">3 derniers mois</option>
              <option value="last-6-months">6 derniers mois</option>
              <option value="custom">Période personnalisée</option>
            </select>
          </div>
        </div>

        {/* Dates personnalisés - version responsive */}
        {selectedPeriod === 'custom' && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Période personnalisée</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Date de début
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Aperçu de la période */}
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          <span>{getPeriodDisplayText()}</span>
        </div>
      </div>

      {/* Grant Information */}
      {selectedGrantData && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-blue-200 no-print">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{selectedGrantData.name}</h3>
              <p className="text-gray-600 text-sm">{selectedGrantData.reference} - {selectedGrantData.grantingOrganization}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Devise</p>
              <p className="text-lg font-bold text-blue-600">
                {selectedGrantData.currency} ({getCurrencySymbol()})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === CARTES STATISTIQUES RESPONSIVES === */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 no-print">
          <StatCard
            title="Budget Total"
            value={formatCurrency(totalBudget)}
            icon={BarChart3}
            color="text-blue-600"
          />
          <StatCard
            title="Engagé"
            value={formatCurrency(totalEngaged)}
            subtitle={`${executionRate.toFixed(1)}% du budget`}
            icon={TrendingUp}
            color="text-green-600"
          />
          <StatCard
            title="Disponible"
            value={formatCurrency(totalAvailable)}
            icon={PieChart}
            color="text-purple-600"
          />
          <StatCard
            title="Engagements"
            value={filteredExpenses.length.toString()}
            icon={Calendar}
            color="text-orange-600"
          />
        </div>

      {/* === CONTENU DES RAPPORTS AVEC PERMISSIONS === */}
      
      {/* Rapport de synthèse */}
      {reportType === 'summary' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Rapport de Synthèse</h3>
            {canExport && (
              <button
                onClick={handleExportPDF}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 no-print text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Exporter PDF</span>
              </button>
            )}
          </div>
          
          {isMobileView ? (
            <div className="space-y-4">
              {/* Version mobile simplifiée */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Aperçu Budgetaire</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Budget Total</span>
                    <span className="font-medium">{formatCurrency(totalBudget)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Engagé</span>
                    <span className="font-medium text-green-600">{formatCurrency(totalEngaged)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Disponible</span>
                    <span className="font-medium text-blue-600">{formatCurrency(totalAvailable)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Taux d'engagement</span>
                    <span className="font-medium text-orange-600">{executionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Performance par subvention mobile */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Performance Subventions</h4>
                <div className="space-y-3">
                  {grantStats.slice(0, 3).map(grant => (
                    <div key={grant.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-medium text-gray-900 text-sm truncate">{grant.name}</h5>
                        <span className="text-sm font-semibold text-blue-600">
                          {grant.utilizationRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(grant.utilizationRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Payé: {formatCurrency(grant.paidExpenses)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Version desktop complète */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Grant Performance */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance par Subvention</h3>
                <div className="space-y-4">
                  {grantStats.map(grant => (
                    <div key={grant.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{grant.name}</h4>
                        <span className="text-sm font-semibold text-blue-600">
                          {grant.utilizationRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(grant.utilizationRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Payé: {formatCurrency(grant.paidExpenses)}</span>
                        <span>Total: {formatCurrency(grant.totalAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Catégorie</h3>
                <div className="space-y-4">
                  {categoryStats.map(category => (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${category.color}`}>
                            {category.code}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{category.name}</span>
                        </div>
                        <span className="text-sm text-gray-600">
                          {category.executionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(category.executionRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Engagé: {formatCurrency(category.engaged)}</span>
                        <span>Notifié: {formatCurrency(category.notified)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rapport détaillé */}
      {reportType === 'detailed' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 no-print">
              <h3 className="text-lg font-semibold text-gray-900">Rapport Détaillé des Engagements</h3>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="w-3 h-3 sm:w-4 sm:h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-sm"
                  />
                </div>
                {canExport && (
                  <button
                    onClick={handleExportPDF}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Exporter PDF</span>
                  </button>
                )}
              </div>
            </div>

            {isMobileView ? (
              <div className="space-y-3">
                {paginatedExpenses.map(expense => {
                  const budgetLine = budgetLines.find(line => line.id === expense.budgetLineId);
                  const subBudgetLine = subBudgetLines.find(line => line.id === expense.subBudgetLineId);
                  return (
                    <div key={expense.id} className="bg-gray-50 rounded-lg p-3 border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">{expense.description}</h4>
                          <p className="text-xs text-gray-600">
                            {new Date(expense.date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          expense.status === 'paid' ? 'bg-green-100 text-green-800' :
                          expense.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                          expense.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {expense.status === 'paid' ? 'Payé' :
                           expense.status === 'approved' ? 'Approuvé' :
                           expense.status === 'processing' ? 'En traitement' : 'Rejeté'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Ligne:</span>
                          <p className="font-medium">{budgetLine?.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Sous-ligne:</span>
                          <p className="font-medium">{subBudgetLine?.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Montant:</span>
                          <p className="font-medium text-green-600">{formatCurrency(expense.amount)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Pagination />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Date</span>
                          <SortIcon field="date" />
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                        onClick={() => handleSort('description')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Description</span>
                          <SortIcon field="description" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ligne budgétaire</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sous-ligne budgétaire</th>
                      <th 
                        className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Montant</span>
                          <SortIcon field="amount" />
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span>Statut</span>
                          <SortIcon field="status" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedExpenses.map(expense => {
                      const budgetLine = budgetLines.find(line => line.id === expense.budgetLineId);
                      const subBudgetLine = subBudgetLines.find(line => line.id === expense.subBudgetLineId);
                      return (
                        <tr key={expense.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {new Date(expense.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 max-w-[200px] truncate" title={expense.description}>
                            {expense.description}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">{budgetLine?.name}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">{subBudgetLine?.name}</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              expense.status === 'paid' ? 'bg-green-100 text-green-800' :
                              expense.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              expense.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {expense.status === 'paid' ? 'Payé' :
                               expense.status === 'approved' ? 'Approuvé' :
                               expense.status === 'processing' ? 'En traitement' : 'Rejeté'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rapport par catégorie */}
      {reportType === 'category' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Analyse par Catégorie</h3>
            {canExport && (
              <button
                onClick={handleExportPDF}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 no-print text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Exporter PDF</span>
              </button>
            )}
          </div>
          
          {isMobileView ? (
            <div className="space-y-4">
              {categoryStats.map(category => (
                <div key={category.id} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${category.color}`}>
                      {category.code}
                    </span>
                    <h4 className="font-medium text-gray-900 text-sm">{category.name}</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Notifié:</span>
                      <span className="font-medium">{formatCurrency(category.notified)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Engagé:</span>
                      <span className="font-medium text-green-600">{formatCurrency(category.engaged)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Disponible:</span>
                      <span className={`font-medium ${category.available >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(category.available)}
                      </span>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Taux d'engagement</span>
                        <span>{category.executionRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            category.executionRate > 90 ? 'bg-red-500' :
                            category.executionRate > 75 ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(category.executionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {categoryStats.map(category => (
                <div key={category.id} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${category.color}`}>
                      {category.code}
                    </span>
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Notifié:</span>
                      <span className="font-medium">{formatCurrency(category.notified)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Engagé:</span>
                      <span className="font-medium text-green-600">{formatCurrency(category.engaged)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Disponible:</span>
                      <span className={`font-medium ${category.available >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(category.available)}
                      </span>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Taux d'engagement</span>
                        <span>{category.executionRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            category.executionRate > 90 ? 'bg-red-500' :
                            category.executionRate > 75 ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(category.executionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Autres rapports avec permissions financières */}
      {reportType === 'beneficiaries' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 print:shadow-none print:border-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center no-print">
              <Users className="w-5 h-5 mr-2" />
              État des bénéficiaires avances/prêt
            </h3>
            {canExport && (
              <button
                onClick={handleExportPDF}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 no-print text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Exporter PDF</span>
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 print-table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700">Agents</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Montant obtenu</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Montant remboursé</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Solde</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Observations</th>
                </tr>
              </thead>
              <tbody>
                {getBeneficiariesState().map((beneficiary, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                      <div>{beneficiary.name}</div>
                      <div className="text-xs text-gray-500">{beneficiary.employeeId}</div>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-right print-amount">
                      {formatCurrency(beneficiary.totalObtained)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-right print-amount">
                      {formatCurrency(beneficiary.totalRepaid)}
                    </td>
                    <td className={`border border-gray-300 px-3 py-2 text-sm font-medium text-right print-amount ${beneficiary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(beneficiary.balance)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600">
                      {beneficiary.observations}
                    </td>
                  </tr>
                ))}
                {getBeneficiariesState().length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      Aucun bénéficiaire d'avance ou de prêt
                    </td>
                  </tr>
                )}
                {getBeneficiariesState().length > 0 && (
                  <tr className="print-total-row">
                    <td className="border border-gray-300 px-3 py-2 text-sm font-bold">Total</td>
                    <td className="border border-gray-300 px-3 py-2 text-sm font-bold text-right print-amount">
                      {formatCurrency(getBeneficiariesState().reduce((sum, b) => sum + b.totalObtained, 0))}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm font-bold text-right print-amount">
                      {formatCurrency(getBeneficiariesState().reduce((sum, b) => sum + b.totalRepaid, 0))}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm font-bold text-right print-amount">
                      {formatCurrency(getBeneficiariesState().reduce((sum, b) => sum + b.balance, 0))}
                    </td>
                    <td className="border border-gray-300 px-3 py-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rapports fournisseurs payés et en attente */}
      {reportType === 'paid-suppliers'  && (
        <>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 print:shadow-none print:border-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center no-print">
              {reportType === 'paid-suppliers' ? <CreditCard className="w-5 h-5 mr-2" /> : <FileText className="w-5 h-5 mr-2" />}
              {reportType === 'paid-suppliers' ? 'État des fournisseurs payés' : 'État des fournisseurs en attente de paiements'}
            </h3>
            {canExport && (
              <button
                onClick={handleExportPDF}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 no-print text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Exporter PDF</span>
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 print-table">
              <thead>
                <tr className="bg-gray-50">
                  {reportType === 'paid-suppliers' ? (
                    <>
                      <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700">Dates</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700">Fournisseurs</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Références factures</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Références chèques</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Montants chèques</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Soldes</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Observations</th>
                    </>
                  ) : (
                    <>
                      <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700">Dates</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700">Fournisseurs</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Ligne budgétaire</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Références factures</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Montants facture non payés</th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700">Observations</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {reportType === 'paid-suppliers' ? (
                  <>
                    {getPaidSuppliersState().map(supplier => 
                      supplier.payments.map((payment, index) => (
                        <tr key={`${supplier.supplier}-${index}`}>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                            {new Date(payment.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                            {index === 0 ? supplier.supplier : ''}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-center">
                            {payment.invoiceRef}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-center">
                            {payment.checkRef}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-right print-amount">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 text-right print-amount">
                            {formatCurrency(payment.balance)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600"></td>
                        </tr>
                      ))
                    )}
                    {getPaidSuppliersState().length === 0 && (
                      <tr>
                        <td colSpan={7} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                          Aucun fournisseur payé
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <>
                    {getPendingSuppliersState().map(supplier => 
                      supplier.invoices.map((invoice, index) => (
                        <tr key={`${supplier.supplier}-${index}`}>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                            {new Date(invoice.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                            {index === 0 ? supplier.supplier : ''}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-center">
                            {invoice.budgetLine}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-center">
                            {invoice.invoiceRef}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 text-right print-amount">
                            {formatCurrency(invoice.amount)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600">
                            {index === 0 ? supplier.observations : ''}
                          </td>
                        </tr>
                      ))
                    )}
                    {getPendingSuppliersState().length === 0 && (
                      <tr>
                        <td colSpan={6} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                          Aucun fournisseur en attente de paiement
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}


      {reportType === 'pending-suppliers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center no-print">
              <FileText className="w-5 h-5 mr-2" />
              État des fournisseurs en attente de paiements
            </h3>
            <button
              onClick={handleExportPDF}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 no-print"
            >
              <FileText className="w-4 h-4" />
              <span>Imprimer PDF</span>
            </button>
            <span className="text-sm text-gray-600 no-print">
              {selectedGrantData ? selectedGrantData.name : 'Toutes les subventions'}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 print-table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700">Dates</th>
                  <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700">Fournisseurs</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Ligne budgétaire</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Références factures</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Montants facture non payés</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Observations</th>
                </tr>
              </thead>
              <tbody>
                {getPendingSuppliersState().map(supplier => 
                  supplier.invoices.map((invoice, index) => (
                    <tr key={`${supplier.supplier}-${index}`}>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                        {new Date(invoice.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                        {index === 0 ? supplier.supplier : ''}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {invoice.budgetLine}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {invoice.invoiceRef}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right print-amount">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">
                        {index === 0 ? supplier.observations : ''}
                      </td>
                    </tr>
                  ))
                )}
                {getPendingSuppliersState().length === 0 && (
                  <tr>
                    <td colSpan={6} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      Aucun fournisseur en attente de paiement
                    </td>
                  </tr>
                )}
                {getPendingSuppliersState().length > 0 && (
                  <tr className="bg-gray-100 font-medium print-total-row">
                    <td colSpan={4} className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      <strong>Total</strong>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right print-amount">
                      <strong>
                        {formatCurrency(getPendingSuppliersState().reduce((sum, s) => sum + s.totalAmount, 0))}
                      </strong>
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;