import React, { useState } from 'react';
import { Plus, Edit, Trash2, Users, Calendar, DollarSign, CheckCircle, Download, Printer, X } from 'lucide-react';
import { showSuccess, showValidationError } from '../utils/alerts';
import { EmployeeLoan, BudgetLine, Grant, LOAN_STATUS, SubBudgetLine } from '../types';

interface EmployeeLoanManagerProps {
  loans: EmployeeLoan[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  selectedGrantId?: string;
  onAddLoan: (loan: Omit<EmployeeLoan, 'id'>) => void;
  onUpdateLoan: (id: string, updates: Partial<EmployeeLoan>) => void;
  onAddRepayment: (loanId: string, repayment: { date: string; amount: number; reference: string }) => void;
}

const EmployeeLoanManager: React.FC<EmployeeLoanManagerProps> = ({
  loans,
  budgetLines,
  subBudgetLines,
  grants,
  selectedGrantId,
  onAddLoan,
  onUpdateLoan,
  onAddRepayment
}) => {
  // Définir selectedGrant basé sur selectedGrantId ou la subvention la plus récente
  const selectedGrant = selectedGrantId 
    ? grants.find(grant => grant.id === selectedGrantId)
    : grants.length > 0 
      ? grants.reduce((latest, current) => 
          parseInt(current.id) > parseInt(latest.id) ? current : latest
        )
      : null;

  const [showForm, setShowForm] = useState(false);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<EmployeeLoan | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  
  const [formData, setFormData] = useState({
    grantId: selectedGrant?.id || '',
    budgetLineId: '',
    subBudgetLineId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    expectedRepaymentDate: '',
    employeeName: '',
    employeeId: '',
    installmentAmount: '',
    numberOfInstallments: '12',
    frequency: 'monthly' as EmployeeLoan['repaymentSchedule']['frequency']
  });

  const [repaymentData, setRepaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    reference: ''
  });

  const [approvals, setApprovals] = useState({
    supervisor1: { name: '', signature: false },
    supervisor2: { name: '', signature: false },
    finalApproval: { name: '', signature: false }
  });

  // Fonction pour formater les montants avec la devise de la subvention
  const formatCurrency = (amount: number, grantId?: string) => {
    // Trouver la subvention (soit par ID, soit la subvention sélectionnée, soit la première)
    const grant = grantId 
      ? grants.find(g => g.id === grantId) 
      : selectedGrant || grants[0];
    
    if (!grant) return amount.toLocaleString('fr-FR');
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: grant.currency === 'XOF' ? 'XOF' : grant.currency,
      minimumFractionDigits: grant.currency === 'XOF' ? 0 : 2
    });
  };

  const resetForm = () => {
    setFormData({
      grantId: selectedGrant?.id || '',
      budgetLineId: '',
      subBudgetLineId: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      expectedRepaymentDate: '',
      employeeName: '',
      employeeId: '',
      installmentAmount: '',
      numberOfInstallments: '12',
      frequency: 'monthly'
    });
    setApprovals({
      supervisor1: { name: '', signature: false },
      supervisor2: { name: '', signature: false },
      finalApproval: { name: '', signature: false }
    });
    setShowForm(false);
    setEditingLoan(null);
  };

  const resetRepaymentForm = () => {
    setRepaymentData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      reference: ''
    });
    setShowRepaymentForm(false);
    setSelectedLoan(null);
  };

  const handleEditLoan = (loan: EmployeeLoan) => {
    setEditingLoan(loan);
    setFormData({
      grantId: loan.grantId,
      budgetLineId: loan.budgetLineId || '',
      subBudgetLineId: loan.subBudgetLineId || '',
      amount: loan.amount.toString(),
      description: loan.description,
      date: loan.date,
      expectedRepaymentDate: loan.expectedRepaymentDate,
      employeeName: loan.employee.name,
      employeeId: loan.employee.employeeId,
      installmentAmount: loan.repaymentSchedule.installmentAmount.toString(),
      numberOfInstallments: loan.repaymentSchedule.numberOfInstallments.toString(),
      frequency: loan.repaymentSchedule.frequency
    });
    
    // Pré-remplir les approbations
    setApprovals({
      supervisor1: {
        name: loan.approvals?.supervisor1?.name || '',
        signature: loan.approvals?.supervisor1?.signature || false
      },
      supervisor2: {
        name: loan.approvals?.supervisor2?.name || '',
        signature: loan.approvals?.supervisor2?.signature || false
      },
      finalApproval: {
        name: loan.approvals?.finalApproval?.name || '',
        signature: loan.approvals?.finalApproval?.signature || false
      }
    });
    
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.grantId || !formData.amount || !formData.employeeName || !formData.employeeId) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, le montant, le nom et le matricule de l\'employé');
      return;
    }

    // Si on est en mode édition
    if (editingLoan) {
      const updates: Partial<EmployeeLoan> = {
        grantId: formData.grantId,
        budgetLineId: formData.budgetLineId || undefined,
        subBudgetLineId: formData.subBudgetLineId || undefined,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        expectedRepaymentDate: formData.expectedRepaymentDate,
        employee: {
          name: formData.employeeName,
          employeeId: formData.employeeId
        },
        repaymentSchedule: {
          installmentAmount: parseFloat(formData.installmentAmount),
          numberOfInstallments: parseInt(formData.numberOfInstallments),
          frequency: formData.frequency
        },
        approvals: {
          supervisor1: approvals.supervisor1.name ? {
            name: approvals.supervisor1.name,
            date: new Date().toISOString().split('T')[0],
            signature: approvals.supervisor1.signature
          } : undefined,
          supervisor2: approvals.supervisor2.name ? {
            name: approvals.supervisor2.name,
            date: new Date().toISOString().split('T')[0],
            signature: approvals.supervisor2.signature
          } : undefined,
          finalApproval: approvals.finalApproval.name ? {
            name: approvals.finalApproval.name,
            date: new Date().toISOString().split('T')[0],
            signature: approvals.finalApproval.signature
          } : undefined
        }
      };

      onUpdateLoan(editingLoan.id, updates);
      resetForm();
      return;
    }

    // Si c'est une nouvelle demande
    const loanNumber = `PRET-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const loan: Omit<EmployeeLoan, 'id'> = {
      loanNumber,
      grantId: formData.grantId,
      budgetLineId: formData.budgetLineId || undefined,
      subBudgetLineId: formData.subBudgetLineId || undefined,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      expectedRepaymentDate: formData.expectedRepaymentDate,
      employee: {
        name: formData.employeeName,
        employeeId: formData.employeeId
      },
      repaymentSchedule: {
        installmentAmount: parseFloat(formData.installmentAmount),
        numberOfInstallments: parseInt(formData.numberOfInstallments),
        frequency: formData.frequency
      },
      repayments: [],
      status: 'pending',
      approvals: {
        supervisor1: approvals.supervisor1.name ? {
          name: approvals.supervisor1.name,
          date: new Date().toISOString().split('T')[0],
          signature: approvals.supervisor1.signature
        } : undefined,
        supervisor2: approvals.supervisor2.name ? {
          name: approvals.supervisor2.name,
          date: new Date().toISOString().split('T')[0],
          signature: approvals.supervisor2.signature
        } : undefined,
        finalApproval: approvals.finalApproval.name ? {
          name: approvals.finalApproval.name,
          date: new Date().toISOString().split('T')[0],
          signature: approvals.finalApproval.signature
        } : undefined
      }
    };

    onAddLoan(loan);
    resetForm();
  };

  const handleRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLoan || !repaymentData.amount || !repaymentData.reference) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir le montant et la référence du remboursement');
      return;
    }

    onAddRepayment(selectedLoan.id, {
      date: repaymentData.date,
      amount: parseFloat(repaymentData.amount),
      reference: repaymentData.reference
    });

    resetRepaymentForm();
  };

  const getBudgetLine = (budgetLineId: string) => {
    return budgetLines.find(line => line.id === budgetLineId);
  };

  const getGrant = (grantId: string) => {
    return grants.find(grant => grant.id === grantId);
  };

  const updateLoanStatus = (loanId: string, newStatus: EmployeeLoan['status']) => {
    onUpdateLoan(loanId, { status: newStatus });
  };

  const getTotalRepaid = (loan: EmployeeLoan) => {
    return loan.repayments.reduce((sum, repayment) => sum + repayment.amount, 0);
  };

  const getRemainingAmount = (loan: EmployeeLoan) => {
    return loan.amount - getTotalRepaid(loan);
  };

  const getRepaymentProgress = (loan: EmployeeLoan) => {
    return loan.amount > 0 ? (getTotalRepaid(loan) / loan.amount) * 100 : 0;
  };

  const getFrequencyLabel = (frequency: EmployeeLoan['repaymentSchedule']['frequency']) => {
    switch (frequency) {
      case 'monthly': return 'Mensuel';
      case 'quarterly': return 'Trimestriel';
      case 'annual': return 'Annuel';
      default: return frequency;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Prêts aux Employés</h2>
          <p className="text-gray-600 mt-1">Prêts sur compte bancaire et suivi des remboursements</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Prêt</span>
        </button>
      </div>

      {/* Information sur la subvention active */}
      {selectedGrant && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Subvention Active</h3>
              <p className="text-sm text-gray-600">{selectedGrant.name} ({selectedGrant.reference})</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Devise</p>
              <p className="text-sm font-bold text-blue-600">
                {selectedGrant.currency} ({selectedGrant.currency === 'EUR' ? '€' : selectedGrant.currency === 'USD' ? '$' : 'CFA'})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Prêts</p>
              <p className="text-2xl font-bold text-blue-600">{loans.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Total Prêté</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(loans.reduce((sum, loan) => sum + loan.amount, 0))}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Prêts Remboursés</p>
              <p className="text-2xl font-bold text-orange-600">
                {loans.filter(l => l.status === 'completed').length}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Solde</p>
              <p className="text-2xl font-bold text-green-600">
                {loans.filter(l => l.status === 'active').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Loan Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLoan ? 'Modifier le Prêt' : 'Nouvelle Demande de Prêt Employé'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Information */}
              <div className="bg-green-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations Employé</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de l'employé *
                    </label>
                    <input
                      type="text"
                      value={formData.employeeName}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Jean Dupont"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Matricule employé *
                    </label>
                    <input
                      type="text"
                      value={formData.employeeId}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: EMP-2024-001"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Loan Information */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations du Prêt</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subvention *
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
                      {selectedGrant ? `${selectedGrant.name} (${selectedGrant.reference})` : 'Aucune subvention sélectionnée'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Subvention sélectionnée automatiquement par l'administrateur
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ligne budgétaire (optionnel)
                    </label>
                    <select
                      value={formData.budgetLineId}
                      onChange={(e) => setFormData(prev => ({ ...prev, budgetLineId: e.target.value, subBudgetLineId: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!selectedGrant}
                    >
                      <option value="">Aucune ligne budgétaire</option>
                      {budgetLines.filter(line => line.grantId === selectedGrant?.id).map(line => (
                        <option key={line.id} value={line.id}>
                          {line.code} - {line.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sous-ligne budgétaire (optionnel)
                  </label>
                  <select
                    value={formData.subBudgetLineId}
                    onChange={(e) => setFormData(prev => ({ ...prev, subBudgetLineId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!formData.budgetLineId}
                  >
                    <option value="">Aucune sous-ligne budgétaire</option>
                    {subBudgetLines.filter(subLine => subLine.budgetLineId === formData.budgetLineId).map(subLine => (
                      <option key={subLine.id} value={subLine.id}>
                        {subLine.code} - {subLine.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant demandé ({selectedGrant?.currency === 'EUR' ? '€' : 
                         selectedGrant?.currency === 'USD' ? '$' : 'CFA'}) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date prévisionnelle de remboursement *
                    </label>
                    <input
                      type="date"
                      value={formData.expectedRepaymentDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedRepaymentDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Motif du prêt..."
                    required
                  />
                </div>
              </div>

              {/* Repayment Schedule */}
              <div className="bg-orange-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Échéancier de Remboursement</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant par échéance ({selectedGrant?.currency === 'EUR' ? '€' : 
                         selectedGrant?.currency === 'USD' ? '$' : 'CFA'})*
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.installmentAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, installmentAmount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre d'échéances *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.numberOfInstallments}
                      onChange={(e) => setFormData(prev => ({ ...prev, numberOfInstallments: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fréquence *
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as EmployeeLoan['repaymentSchedule']['frequency'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="monthly">Mensuel</option>
                      <option value="quarterly">Trimestriel</option>
                      <option value="annual">Annuel</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="bg-yellow-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Signatures d'Approbation</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800">Coordinateur de la subvention</h5>
                    <input
                      type="text"
                      placeholder="Nom du coordinateur"
                      value={approvals.supervisor1.name}
                      onChange={(e) => setApprovals(prev => ({
                        ...prev,
                        supervisor1: { ...prev.supervisor1, name: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={approvals.supervisor1.signature}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor1: { ...prev.supervisor1, signature: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Signature validée</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800">Chef unité comptabilité</h5>
                    <input
                      type="text"
                      placeholder="Nom du chef unité"
                      value={approvals.supervisor2.name}
                      onChange={(e) => setApprovals(prev => ({
                        ...prev,
                        supervisor2: { ...prev.supervisor2, name: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={approvals.supervisor2.signature}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor2: { ...prev.supervisor2, signature: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Signature validée</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800">Coordonnateur national</h5>
                    <input
                      type="text"
                      placeholder="Nom du coordonnateur national"
                      value={approvals.finalApproval.name}
                      onChange={(e) => setApprovals(prev => ({
                        ...prev,
                        finalApproval: { ...prev.finalApproval, name: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={approvals.finalApproval.signature}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          finalApproval: { ...prev.finalApproval, signature: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Signature validée</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200"
                >
                  {editingLoan ? 'Modifier le Prêt' : 'Enregistrer le Prêt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Form Modal */}
      {showRepaymentForm && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Enregistrer un Remboursement
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Prêt: {selectedLoan.loanNumber} - {selectedLoan.employee.name}
            </p>
            
            <form onSubmit={handleRepaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de remboursement *
                </label>
                <input
                  type="date"
                  value={repaymentData.date}
                  onChange={(e) => setRepaymentData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant remboursé *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={getRemainingAmount(selectedLoan)}
                    value={repaymentData.amount}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {getGrant(selectedLoan.grantId)?.currency === 'EUR' ? '€' : 
                     getGrant(selectedLoan.grantId)?.currency === 'USD' ? '$' : 'CFA'}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Restant à rembourser: {formatCurrency(getRemainingAmount(selectedLoan), selectedLoan.grantId)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence *
                </label>
                <input
                  type="text"
                  value={repaymentData.reference}
                  onChange={(e) => setRepaymentData(prev => ({ ...prev, reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: REMB-2024-001"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetRepaymentForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loans List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loans.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun prêt</h3>
            <p className="text-gray-500 mb-4">Commencez par créer votre première demande de prêt</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Nouveau Prêt
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prêt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employé
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progression
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loans.map(loan => {
                  const budgetLine = getBudgetLine(loan.budgetLineId);
                  const grant = getGrant(loan.grantId);
                  const totalRepaid = getTotalRepaid(loan);
                  const remainingAmount = getRemainingAmount(loan);
                  const progress = getRepaymentProgress(loan);
                  
                  return (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{loan.loanNumber}</div>
                          <div className="text-sm text-gray-500">{budgetLine?.name || 'Aucune ligne budgétaire'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{loan.employee.name}</div>
                        <div className="text-sm text-gray-500">{loan.employee.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(loan.amount, loan.grantId)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Restant: {formatCurrency(remainingAmount, loan.grantId)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-sm font-medium text-gray-600">
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <select
                          value={loan.status}
                          onChange={(e) => updateLoanStatus(loan.id, e.target.value as EmployeeLoan['status'])}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${LOAN_STATUS[loan.status].color}`}
                        >
                          <option value="pending">En attente</option>
                          <option value="approved">Approuvé</option>
                          <option value="active">En cours</option>
                          <option value="completed">Remboursé</option>
                          <option value="rejected">Rejeté</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {loan.status === 'active' && remainingAmount > 0 && (
                            <button
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowRepaymentForm(true);
                              }}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Ajouter un remboursement"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleEditLoan(loan)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier le prêt"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeLoanManager;