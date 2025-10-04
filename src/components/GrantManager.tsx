import React, { useState } from 'react';
import { Plus, Edit, Trash2, Banknote, Calendar, Building, ChevronLeft, ChevronRight } from 'lucide-react';
import { showSuccess, showError, showValidationError, confirmDelete } from '../utils/alerts';
import { Grant, BudgetLine, GRANT_STATUS } from '../types';
import { usePermissions } from '../hooks/usePermissions';


interface GrantManagerProps {
  grants: Grant[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
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
  onAddGrant,
  onUpdateGrant,
  onDeleteGrant,
  onUpdateBudgetLine,
  onUpdateSubBudgetLine
}) => {
  // 1. TOUS les hooks doivent être appelés AVANT toute logique conditionnelle
  const [showForm, setShowForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
    bankAccountName: '',
    accountNumber: '',
    bankName: '',
    initialBalance: ''
  });
  
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  
  const itemsPerPage = 10;

  // 2. MAINTENANT nous pouvons faire la vérification conditionnelle
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

  // Le reste du code reste inchangé...
  const canCreate = hasPermission('grants', 'create');
  const canEdit = hasPermission('grants', 'edit');
  const canDelete = hasPermission('grants', 'delete');
  const canView = hasPermission('grants', 'view');

  // Trier les subventions par ID décroissant (plus récentes en haut)
  const sortedGrants = [...grants].sort((a, b) => parseInt(b.id) - parseInt(a.id));
  
  // Pagination
  const totalPages = Math.ceil(sortedGrants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGrants = sortedGrants.slice(startIndex, endIndex);

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
    
    // Vérification uniquement des champs obligatoires (sans les infos bancaires)
    if (!formData.name || !formData.reference || !formData.grantingOrganization || !formData.totalAmount) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const notifiedAmount = parseFloat(formData.totalAmount);
    const initialBalance = parseFloat(formData.initialBalance) || 0;

    // Préparer l'objet bankAccount seulement si au moins un champ est rempli
    const bankAccount = (formData.bankAccountName || formData.accountNumber || formData.bankName) ? {
      name: formData.bankAccountName,
      accountNumber: formData.accountNumber,
      bankName: formData.bankName,
      balance: initialBalance
    } : undefined;

    if (editingGrant) {
      const grantBudgetLines = budgetLines.filter(line => line.grantId === editingGrant.id);
      
      // Si on modifie une subvention et qu'on change le montant notifié
      const currentNotifiedAmount = editingGrant.totalAmount;
      const newNotifiedAmount = notifiedAmount;
      
      // Si le montant notifié a changé, répartir proportionnellement aux lignes budgétaires
      if (currentNotifiedAmount !== newNotifiedAmount && grantBudgetLines.length > 0) {
        // Utiliser les montants planifiés pour la répartition proportionnelle si disponibles
        const totalPlannedAmount = grantBudgetLines.reduce((sum, line) => sum + line.plannedAmount, 0);
        
        if (totalPlannedAmount > 0) {
          // Calculer la répartition proportionnelle pour chaque ligne budgétaire
          grantBudgetLines.forEach(line => {
            const proportion = line.plannedAmount / totalPlannedAmount;
            const newLineNotifiedAmount = newNotifiedAmount * proportion;
            const newAvailableAmount = newLineNotifiedAmount - line.engagedAmount;
            
            onUpdateBudgetLine(line.id, {
              notifiedAmount: newLineNotifiedAmount,
              availableAmount: newAvailableAmount
            });
            
            // Mettre à jour les sous-lignes budgétaires proportionnellement
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
          // Si pas de montants planifiés, répartir équitablement
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

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

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

      {/* Form Modal */}
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
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

              {/* Bank Account Information */}
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

      {/* Grants List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Subventions ({grants.length})
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

          {currentGrants.length === 0 ? (
            <div className="text-center py-12">
              <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune subvention trouvée</p>
              <p className="text-sm text-gray-400 mt-1">Créez votre première subvention pour commencer</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentGrants.map((grant) => {
                const grantBudgetLines = budgetLines.filter(line => line.grantId === grant.id);
                const totalEngaged = grantBudgetLines.reduce((sum, line) => sum + line.engagedAmount, 0);
                const totalSpent = grantBudgetLines.reduce((sum, line) => sum + (line.spentAmount || 0), 0);
                const remainingAmount = grant.totalAmount - totalEngaged;
                const utilizationRate = grant.totalAmount > 0 ? (totalEngaged / grant.totalAmount) * 100 : 0;
                const daysRemaining = grant.endDate ? getDaysRemaining(grant.endDate) : null;

                return (
                  <div key={grant.id} className="border border-gray-200 rounded-xl p-4 md:p-6 hover:shadow-md transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-4">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2 gap-2">
                          <h4 className="text-lg font-semibold text-gray-900">{grant.name}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full w-fit ${
                            grant.status === 'active' ? 'bg-green-100 text-green-800' :
                            grant.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            grant.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {grant.status === 'active' ? 'Active' :
                             grant.status === 'pending' ? 'En attente' :
                             grant.status === 'completed' ? 'Terminée' : 'Suspendue'}
                          </span>
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
                      {(canEdit || canDelete) && (
                        <div className="flex items-center space-x-2 self-end lg:self-auto">
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
                      )}
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4 mb-4">
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-medium mb-1">Montant Planifié</p>
                        <p className="text-sm md:text-lg font-semibold text-green-900">
                          {formatCurrency(grant.plannedAmount, grant.currency)}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium mb-1">Montant Notifié</p>
                        <p className="text-sm md:text-lg font-semibold text-blue-900">
                          {formatCurrency(grant.totalAmount, grant.currency)}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-600 font-medium mb-1">Montant Engagé</p>
                        <p className="text-sm md:text-lg font-semibold text-orange-900">
                          {formatCurrency(totalEngaged, grant.currency)}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-600 font-medium mb-1">Montant Décaissé</p>
                        <p className="text-sm md:text-lg font-semibold text-purple-900">
                          {formatCurrency(totalSpent, grant.currency)}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs text-red-600 font-medium mb-1">Montant restant à Décaisser</p>
                        <p className="text-sm md:text-lg font-semibold text-red-900">
                          {formatCurrency(totalEngaged - totalSpent, grant.currency)}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Taux d'utilisation</span>
                        <span className="text-sm text-gray-600">{utilizationRate.toFixed(1)}%</span>
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

                    {/* Remaining Amount */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Montant non engagé:</span>
                      <span className={`font-semibold ${
                        remainingAmount < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(remainingAmount, grant.currency)}
                      </span>
                    </div>

                    {/* Budget Lines Count */}
                    {grantBudgetLines.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          {grantBudgetLines.length} ligne{grantBudgetLines.length > 1 ? 's' : ''} budgétaire{grantBudgetLines.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    {/* Informations du compte bancaire */}
                    {grant.bankAccount && (
                      <div className="mt-4 bg-green-50 rounded-xl p-4 border border-green-200">
                        <h4 className="font-medium text-green-900 mb-3">Compte Bancaire Associé</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-green-700 font-medium">Nom du compte</p>
                            <p className="text-green-900 font-semibold">{grant.bankAccount.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-green-700 font-medium">Banque</p>
                            <p className="text-green-900 font-semibold">{grant.bankAccount.bankName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-green-700 font-medium">Solde</p>
                            <p className="text-lg md:text-xl font-bold text-green-600">
                              {formatCurrency(grant.bankAccount.balance, grant.currency)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-green-700 font-medium">Numéro de compte</p>
                          <p className="text-green-900 font-mono text-sm break-all">{grant.bankAccount.accountNumber}</p>
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
          <div className="flex justify-center items-center space-x-2 mt-6 p-4 border-t border-gray-100">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
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
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrantManager;