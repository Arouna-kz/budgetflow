import React, { useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, Filter, FileText, Users, CreditCard } from 'lucide-react';
import { Grant, BudgetLine, Engagement, Payment, EmployeeLoan, Prefinancing, DEFAULT_BUDGET_LINES } from '../types';

interface ReportsProps {
  grants: Grant[];
  budgetLines: BudgetLine[];
  subBudgetLines: any[];
  expenses: Engagement[];
  payments?: Payment[];
  employeeLoans?: EmployeeLoan[];
  prefinancings?: Prefinancing[];
}

const Reports: React.FC<ReportsProps> = ({ 
  grants, 
  budgetLines, 
  subBudgetLines,
  expenses, 
  payments = [], 
  employeeLoans = [], 
  prefinancings = [] 
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'category' | 'beneficiaries' | 'paid-suppliers' | 'pending-suppliers'>('summary');
  
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
      endDate.setHours(23, 59, 59, 999); // Inclure toute la journée de fin
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

  const filteredBudgetLines = selectedGrant !== 'all' 
    ? budgetLines
    : budgetLines;

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
    
    // Ajouter les prêts employés
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
    
    // Engagements approuvés sans paiement
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

  return (
    <div className="space-y-6 print:bg-white">
      {/* Styles d'impression */}
      <style jsx>{`
        @media print {
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-header { text-align: center; margin-bottom: 30px; }
          .print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .print-table th, .print-table td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .print-amount { text-align: right; }
          .print-total-row { font-weight: bold; background-color: #f9f9f9; }
          .print-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .print-subtitle { font-size: 14px; margin-bottom: 5px; }
          .print-date { font-size: 12px; color: #666; }
          .print-period { font-size: 12px; margin-bottom: 5px; font-style: italic; }
        }
      `}</style>

      {/* En-tête d'impression (visible uniquement à l'impression) */}
      <div className="hidden print:block print-header">
        <div className="print-organization">
          CELLULE DE COORDINATION DE LA COOPÉRATION CÔTE D'IVOIRE-UNION EUROPÉENNE
        </div>
        <div className="print-title">
          {reportType === 'beneficiaries' && 'État des bénéficiaires avances/prêt'}
          {reportType === 'paid-suppliers' && 'État des fournisseurs payés'}
          {reportType === 'pending-suppliers' && 'État des fournisseurs en attente de paiements'}
          {reportType === 'summary' && 'Rapport de synthèse budgétaire'}
          {reportType === 'detailed' && 'Rapport détaillé des engagements'}
          {reportType === 'category' && 'Analyse par catégorie budgétaire'}
        </div>
        <div className="print-subtitle">
          {selectedGrantData ? selectedGrantData.name : 'Toutes les subventions'}
        </div>
        {selectedGrantData && (
          <div className="print-subtitle">
            {selectedGrantData.reference} - {selectedGrantData.grantingOrganization}
          </div>
        )}
        <div className="print-period">
          {getPeriodDisplayText()}
        </div>
        <div className="print-date">
          Date d'édition: {new Date().toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 no-print">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">Filtres</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de rapport
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="summary">Synthèse</option>
              <option value="detailed">Détaillé</option>
              <option value="beneficiaries">État des bénéficiaires avances/prêt</option>
              <option value="paid-suppliers">État des fournisseurs payés</option>
              <option value="pending-suppliers">État des fournisseurs en attente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Toute la période</option>
              <option value="current-month">Mois en cours</option>
              <option value="last-month">Mois dernier</option>
              <option value="current-year">Année en cours</option>
              <option value="last-year">Année dernière</option>
              <option value="last-3-monhips">3 derniers mois</option>
              <option value="last-6-months">6 derniers mois</option>
              <option value="custom">Période personnalisée</option>
            </select>
          </div>
        </div>

        {/* Sélecteur de dates personnalisées */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Sélection de la période</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={selectedPeriod !== 'custom'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={selectedPeriod !== 'custom'}
              />
            </div>
          </div>
          {selectedPeriod === 'custom' && customStartDate && customEndDate && new Date(customStartDate) > new Date(customEndDate) && (
            <p className="text-red-500 text-sm mt-2">La date de début doit être antérieure à la date de fin.</p>
          )}
          {selectedPeriod !== 'custom' && (
            <p className="text-gray-500 text-sm mt-2">
              Les champs de date sont désactivés. Sélectionnez "Période personnalisée" pour les activer.
            </p>
          )}
        </div>

        {/* Aperçu de la période sélectionnée */}
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          <span>{getPeriodDisplayText()}</span>
        </div>
      </div>

      {/* Grant Information */}
      {selectedGrantData && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200 no-print">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedGrantData.name}</h3>
              <p className="text-gray-600">{selectedGrantData.reference} - {selectedGrantData.grantingOrganization}</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Budget Total</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalBudget)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Engagé</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalEngaged)}
              </p>
              <p className="text-sm text-gray-500">{executionRate.toFixed(1)}% du budget</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Disponible</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(totalAvailable)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Engagements</p>
              <p className="text-2xl font-bold text-orange-600">{filteredExpenses.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {reportType === 'summary' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Rapport de Synthèse</h3>
            <button
              onClick={() => window.print()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2 no-print"
            >
              <FileText className="w-4 h-4" />
              <span>Imprimer PDF</span>
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grant Performance */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
                    ></div>
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
                    ></div>
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
        </div>
      )}

      {reportType === 'detailed' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 no-print">
              <h3 className="text-lg font-semibold text-gray-900">Rapport Détaillé des Engagements</h3>
              <button
                onClick={() => window.print()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Imprimer PDF</span>
              </button>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ligne budgétaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sous-ligne budgétaire</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredExpenses.map(expense => {
                  const budgetLine = budgetLines.find(line => line.id === expense.budgetLineId);
                  const subBudgetLine = subBudgetLines.find(line => line.id === expense.subBudgetLineId);
                  return (
                    <tr key={expense.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(expense.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{expense.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{budgetLine?.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{subBudgetLine?.name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
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
          </div>
        </div>
        </div>
      )}

      {reportType === 'category' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analyse par Catégorie</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportType === 'beneficiaries' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center no-print">
              <Users className="w-5 h-5 mr-2" />
              État des bénéficiaires avances/prêt
            </h3>
            <button
              onClick={() => window.print()}
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
                  <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700">Agents</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Montant obtenu</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Montant remboursé</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Solde</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Observations</th>
                </tr>
              </thead>
              <tbody>
                {getBeneficiariesState().map((beneficiary, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      <div>{beneficiary.name}</div>
                      <div className="text-xs text-gray-500">{beneficiary.employeeId}</div>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right print-amount">
                      {formatCurrency(beneficiary.totalObtained)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right print-amount">
                      {formatCurrency(beneficiary.totalRepaid)}
                    </td>
                    <td className={`border border-gray-300 px-4 py-3 text-sm font-medium text-right print-amount ${beneficiary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(beneficiary.balance)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">
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
                    <td className="border border-gray-300 px-4 py-3 text-sm font-bold">Total</td>
                    <td className="border border-gray-300 px-4 py-3 text-sm font-bold text-right print-amount">
                      {formatCurrency(getBeneficiariesState().reduce((sum, b) => sum + b.totalObtained, 0))}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm font-bold text-right print-amount">
                      {formatCurrency(getBeneficiariesState().reduce((sum, b) => sum + b.totalRepaid, 0))}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm font-bold text-right print-amount">
                      {formatCurrency(getBeneficiariesState().reduce((sum, b) => sum + b.balance, 0))}
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'paid-suppliers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center no-print">
              <CreditCard className="w-5 h-5 mr-2" />
              État des fournisseurs payés
            </h3>
            <button
              onClick={() => window.print()}
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
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Références factures</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Références chèques</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Montants chèques</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Soldes</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Observations</th>
                </tr>
              </thead>
              <tbody>
                {getPaidSuppliersState().map(supplier => 
                  supplier.payments.map((payment, index) => (
                    <tr key={`${supplier.supplier}-${index}`}>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                        {new Date(payment.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                        {index === 0 ? supplier.supplier : ''}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {payment.invoiceRef}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {payment.checkRef}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right print-amount">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-right print-amount">
                        {formatCurrency(payment.balance)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600"></td>
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
                {getPaidSuppliersState().length > 0 && (
                  <tr className="bg-gray-100 font-medium print-total-row">
                    <td colSpan={4} className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      <strong>Total</strong>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right print-amount">
                      <strong>
                        {formatCurrency(getPaidSuppliersState().reduce((sum, s) => sum + s.balance, 0))}
                      </strong>
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'pending-suppliers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center no-print">
              <FileText className="w-5 h-5 mr-2" />
              État des fournisseurs en attente de paiements
            </h3>
            <button
              onClick={() => window.print()}
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