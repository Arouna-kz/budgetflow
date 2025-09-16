import React, { useState } from 'react';
import { Plus, Edit, Trash2, Calendar, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { showSuccess, showError, showValidationError, confirmDelete, showWarning } from '../utils/alerts';
import { BudgetLine, SubBudgetLine, Grant, DEFAULT_BUDGET_LINES } from '../types';

interface BudgetPlanningProps {
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  onAddBudgetLine: (budgetLine: Omit<BudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => void;
  onAddSubBudgetLine: (subBudgetLine: Omit<SubBudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => void;
  onUpdateBudgetLine: (id: string, updates: Partial<BudgetLine>) => void;
  onUpdateSubBudgetLine: (id: string, updates: Partial<SubBudgetLine>) => void;
  onDeleteBudgetLine: (id: string) => void;
  onDeleteSubBudgetLine: (id: string) => void;
}

const BudgetPlanning: React.FC<{
  budgetLines: BudgetLine[],
  subBudgetLines: SubBudgetLine[],
  grants: Grant[],
  onAddBudgetLine: (budgetLine: Omit<BudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => void,
  onAddSubBudgetLine: (subBudgetLine: Omit<SubBudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => void,
  onUpdateBudgetLine: (id: string, updates: Partial<BudgetLine>) => void,
  onUpdateSubBudgetLine: (id: string, updates: Partial<SubBudgetLine>) => void,
  onDeleteBudgetLine: (id: string) => void,
  onDeleteSubBudgetLine: (id: string) => void
}> = ({
  budgetLines,
  subBudgetLines,
  grants,
  onAddBudgetLine,
  onAddSubBudgetLine,
  onUpdateBudgetLine,
  onUpdateSubBudgetLine,
  onDeleteBudgetLine,
  onDeleteSubBudgetLine
}) => {
  const [showBudgetLineForm, setShowBudgetLineForm] = useState(false);
  const [showSubBudgetLineForm, setShowSubBudgetLineForm] = useState(false);
  const [editingBudgetLine, setEditingBudgetLine] = useState<BudgetLine | null>(null);
  const [editingSubBudgetLine, setEditingSubBudgetLine] = useState<SubBudgetLine | null>(null);
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>('');
  const [expandedBudgetLines, setExpandedBudgetLines] = useState<Set<string>>(new Set());
  
  const [budgetLineFormData, setBudgetLineFormData] = useState({
    grantId: '',
    code: '',
    name: '',
    plannedAmount: '',
    notifiedAmount: '',
    description: '',
    color: 'bg-blue-100 text-blue-700'
  });

  const [subBudgetLineFormData, setSubBudgetLineFormData] = useState({
    grantId: '',
    budgetLineId: '',
    code: '',
    name: '',
    plannedAmount: '',
    notifiedAmount: '',
    description: ''
  });

  // Filtrer les lignes budgétaires par subvention sélectionnée
  const filteredBudgetLines = budgetLines;
  const filteredSubBudgetLines = subBudgetLines;
  const selectedGrant = grants.length > 0 ? grants[0] : null;

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

  const resetBudgetLineForm = () => {
    setBudgetLineFormData({
      grantId: selectedGrant?.id || '',
      code: '',
      name: '',
      plannedAmount: '0',
      notifiedAmount: '',
      description: '',
      color: 'bg-blue-100 text-blue-700'
    });
    setShowBudgetLineForm(false);
    setEditingBudgetLine(null);
  };

  const resetSubBudgetLineForm = () => {
    setSubBudgetLineFormData({
      grantId: selectedGrant?.id || '',
      budgetLineId: selectedBudgetLineId || '',
      code: '',
      name: '',
      plannedAmount: '0',
      notifiedAmount: '0',
      description: ''
    });
    setShowSubBudgetLineForm(false);
    setEditingSubBudgetLine(null);
  };

  const handleBudgetLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!budgetLineFormData.grantId || !budgetLineFormData.code || !budgetLineFormData.name || !budgetLineFormData.plannedAmount) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, le code, le nom et le montant planifié');
      return;
    }

    const plannedAmount = parseFloat(budgetLineFormData.plannedAmount);
    const notifiedAmount = 0; // Sera calculé à partir des sous-lignes

    if (editingBudgetLine) {
      onUpdateBudgetLine(editingBudgetLine.id, {
        grantId: budgetLineFormData.grantId,
        code: budgetLineFormData.code,
        name: budgetLineFormData.name,
        plannedAmount,
        notifiedAmount,
        description: budgetLineFormData.description,
        color: budgetLineFormData.color
      });
    } else {
      onAddBudgetLine({
        grantId: budgetLineFormData.grantId,
        code: budgetLineFormData.code,
        name: budgetLineFormData.name,
        plannedAmount,
        notifiedAmount,
        description: budgetLineFormData.description,
        color: budgetLineFormData.color
      });
    }

    resetBudgetLineForm();
  };

  const handleSubBudgetLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subBudgetLineFormData.grantId || !subBudgetLineFormData.budgetLineId || !subBudgetLineFormData.code || !subBudgetLineFormData.name || !subBudgetLineFormData.plannedAmount) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, la ligne budgétaire, le code, le nom et le montant planifié');
      return;
    }

    const plannedAmount = parseFloat(subBudgetLineFormData.plannedAmount);
    const notifiedAmount = parseFloat(subBudgetLineFormData.notifiedAmount) || 0;

    if (editingSubBudgetLine) {
      onUpdateSubBudgetLine(editingSubBudgetLine.id, {
        grantId: subBudgetLineFormData.grantId,
        budgetLineId: subBudgetLineFormData.budgetLineId,
        code: subBudgetLineFormData.code,
        name: subBudgetLineFormData.name,
        plannedAmount,
        notifiedAmount,
        description: subBudgetLineFormData.description
      });
    } else {
      onAddSubBudgetLine({
        grantId: subBudgetLineFormData.grantId,
        budgetLineId: subBudgetLineFormData.budgetLineId,
        code: subBudgetLineFormData.code,
        name: subBudgetLineFormData.name,
        plannedAmount,
        notifiedAmount,
        description: subBudgetLineFormData.description
      });
    }

    resetSubBudgetLineForm();
  };

  const startEditBudgetLine = (line: BudgetLine) => {
    setEditingBudgetLine(line);
    setBudgetLineFormData({
      grantId: line.grantId,
      code: line.code,
      name: line.name,
      plannedAmount: line.plannedAmount.toString(),
      notifiedAmount: '',
      description: line.description || '',
      color: line.color
    });
    setShowBudgetLineForm(true);
  };

  const startEditSubBudgetLine = (line: SubBudgetLine) => {
    setEditingSubBudgetLine(line);
    setSubBudgetLineFormData({
      grantId: line.grantId,
      budgetLineId: line.budgetLineId,
      code: line.code,
      name: line.name,
      plannedAmount: line.plannedAmount.toString(),
      notifiedAmount: line.notifiedAmount.toString(),
      description: line.description || ''
    });
    setShowSubBudgetLineForm(true);
  };

  const toggleBudgetLineExpansion = (budgetLineId: string) => {
    const newExpanded = new Set(expandedBudgetLines);
    if (newExpanded.has(budgetLineId)) {
      newExpanded.delete(budgetLineId);
    } else {
      newExpanded.add(budgetLineId);
    }
    setExpandedBudgetLines(newExpanded);
  };

  const getNotificationRate = (plannedAmount: number, notifiedAmount: number) => {
    return plannedAmount > 0 ? (notifiedAmount / plannedAmount) * 100 : 0;
  };

  const totalPlanned = filteredBudgetLines.reduce((sum, line) => sum + line.plannedAmount, 0);
  const totalNotified = filteredBudgetLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
  const overallNotificationRate = totalPlanned > 0 ? (totalNotified / totalPlanned) * 100 : 0;

  const colorOptions = [
    { value: 'bg-blue-100 text-blue-700', label: 'Bleu', preview: 'bg-blue-100' },
    { value: 'bg-green-100 text-green-700', label: 'Vert', preview: 'bg-green-100' },
    { value: 'bg-yellow-100 text-yellow-700', label: 'Jaune', preview: 'bg-yellow-100' },
    { value: 'bg-purple-100 text-purple-700', label: 'Violet', preview: 'bg-purple-100' },
    { value: 'bg-pink-100 text-pink-700', label: 'Rose', preview: 'bg-pink-100' },
    { value: 'bg-indigo-100 text-indigo-700', label: 'Indigo', preview: 'bg-indigo-100' },
    { value: 'bg-orange-100 text-orange-700', label: 'Orange', preview: 'bg-orange-100' },
    { value: 'bg-gray-100 text-gray-700', label: 'Gris', preview: 'bg-gray-100' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planification Budgétaire</h2>
          <p className="text-gray-600 mt-1">Gestion de la planification et des notifications budgétaires</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (!grants[0]) {
                showWarning('Aucune subvention', 'Aucune subvention disponible pour ajouter une sous-ligne budgétaire');
                return;
              }
              setSubBudgetLineFormData(prev => ({ ...prev, grantId: grants[0].id }));
              setShowSubBudgetLineForm(true);
            }}
            className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Sous-ligne</span>
          </button>
          <button
            onClick={() => {
              if (!grants[0]) {
                showWarning('Aucune subvention', 'Aucune subvention disponible pour ajouter une ligne budgétaire');
                return;
              }
              setBudgetLineFormData(prev => ({ ...prev, grantId: grants[0].id }));
              setShowBudgetLineForm(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Ligne Budgétaire</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Planifié</p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedGrant ? formatCurrency(totalPlanned, selectedGrant.currency) : totalPlanned.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Notifié</p>
              <p className="text-2xl font-bold text-green-600">
                {selectedGrant ? formatCurrency(totalNotified, selectedGrant.currency) : totalNotified.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux de Notification</p>
              <p className="text-2xl font-bold text-purple-600">{overallNotificationRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Edit className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Budget Line Form Modal */}
      {showBudgetLineForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingBudgetLine ? 'Modifier la ligne budgétaire' : 'Nouvelle ligne budgétaire'}
            </h3>
            
            <form onSubmit={handleBudgetLineSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subvention *
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
                  {selectedGrant ? `${selectedGrant.name} (${selectedGrant.reference})` : 'Aucune subvention sélectionnée'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Subvention définie par l'administrateur
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={budgetLineFormData.code}
                    onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: PIN-PERS"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Couleur d'affichage
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {colorOptions.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setBudgetLineFormData(prev => ({ ...prev, color: color.value }))}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          budgetLineFormData.color === color.value 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-full h-4 rounded ${color.preview}`}></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la ligne budgétaire *
                </label>
                <input
                  type="text"
                  value={budgetLineFormData.name}
                  onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Personnel"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget planifié ({selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'})*
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={budgetLineFormData.plannedAmount}
                      onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, plannedAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                      placeholder="0.00"
                      required
                    />
                    
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={budgetLineFormData.description}
                  onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description de la ligne budgétaire..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetBudgetLineForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingBudgetLine ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub Budget Line Form Modal */}
      {showSubBudgetLineForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSubBudgetLine ? 'Modifier la sous-ligne budgétaire' : 'Nouvelle sous-ligne budgétaire'}
            </h3>
            
            <form onSubmit={handleSubBudgetLineSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subvention *
                  </label>
                  <select
                    value={subBudgetLineFormData.grantId}
                    onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, grantId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Sélectionner une subvention</option>
                    {grants.map(grant => (
                      <option key={grant.id} value={grant.id}>
                        {grant.name} ({grant.reference})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ligne budgétaire *
                  </label>
                  <select
                    value={subBudgetLineFormData.budgetLineId}
                    onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, budgetLineId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!selectedGrant}
                  >
                    <option value="">Sélectionner une ligne</option>
                    {budgetLines.filter(line => line.grantId === selectedGrant?.id).map(line => (
                      <option key={line.id} value={line.id}>
                        {line.code} - {line.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={subBudgetLineFormData.code}
                    onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: PIN-PERS-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de la sous-ligne *
                  </label>
                  <input
                    type="text"
                    value={subBudgetLineFormData.name}
                    onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Développeur Senior"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant planifié ({selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'})*
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={subBudgetLineFormData.plannedAmount}
                      onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, plannedAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget notifié (optionnel) - {selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={subBudgetLineFormData.notifiedAmount}
                      onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, notifiedAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Sera défini lors de la notification de subvention
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={subBudgetLineFormData.description}
                  onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description de la sous-ligne budgétaire..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetSubBudgetLineForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingSubBudgetLine ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hierarchical Budget Lines Display */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredBudgetLines.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedGrant ? 'Aucune ligne budgétaire pour cette subvention' : 'Aucune ligne budgétaire'}
            </h3>
            <p className="text-gray-500 mb-4">
              {selectedGrant ? 'Ajoutez des lignes budgétaires pour cette subvention' : 'Aucune subvention disponible'}
            </p>
            <button
              onClick={() => {
                if (!selectedGrant) {
                  showWarning('Aucune subvention', 'Aucune subvention disponible');
                  return;
                }
                setBudgetLineFormData(prev => ({ ...prev, grantId: selectedGrant.id }));
                setShowBudgetLineForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              disabled={!selectedGrant}
            >
              Ajouter une ligne budgétaire
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredBudgetLines.map(budgetLine => {
              const lineSubBudgetLines = filteredSubBudgetLines.filter(sub => sub.budgetLineId === budgetLine.id);
              const isExpanded = expandedBudgetLines.has(budgetLine.id);
              const notificationRate = getNotificationRate(budgetLine.plannedAmount, budgetLine.notifiedAmount);
              const isUnderNotified = notificationRate < 100;
              const lineGrant = grants.find(g => g.id === budgetLine.grantId);
              
              return (
                <div key={budgetLine.id} className={`${isUnderNotified ? 'bg-yellow-50' : ''}`}>
                  {/* Budget Line Header */}
                  <div className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => toggleBudgetLineExpansion(budgetLine.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${budgetLine.color}`}>
                              {budgetLine.code}
                            </span>
                            <span className="text-lg font-semibold text-gray-900">{budgetLine.name}</span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {lineSubBudgetLines.length} sous-ligne{lineSubBudgetLines.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Planifié</div>
                          <div className="font-semibold text-gray-900">
                            {lineGrant ? formatCurrency(budgetLine.plannedAmount, lineGrant.currency) : budgetLine.plannedAmount.toLocaleString('fr-FR')}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Notifié</div>
                          <div className="font-semibold text-gray-900">
                            {lineGrant ? formatCurrency(budgetLine.notifiedAmount, lineGrant.currency) : budgetLine.notifiedAmount.toLocaleString('fr-FR')}
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm text-gray-600">Taux notification</div>
                          <div className={`font-semibold ${isUnderNotified ? 'text-orange-600' : 'text-green-600'}`}>
                            {notificationRate.toFixed(1)}%
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedBudgetLineId(budgetLine.id);
                              setSubBudgetLineFormData(prev => ({ 
                                ...prev, 
                                grantId: budgetLine.grantId,
                                budgetLineId: budgetLine.id 
                              }));
                              setShowSubBudgetLineForm(true);
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Ajouter une sous-ligne"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEditBudgetLine(budgetLine)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteBudgetLine(budgetLine.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub Budget Lines */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      {lineSubBudgetLines.length === 0 ? (
                        <div className="p-6 text-center">
                          <p className="text-gray-500 mb-4">Aucune sous-ligne budgétaire</p>
                          <button
                            onClick={() => {
                              setSelectedBudgetLineId(budgetLine.id);
                              setSubBudgetLineFormData(prev => ({ 
                                ...prev, 
                                grantId: budgetLine.grantId,
                                budgetLineId: budgetLine.id 
                              }));
                              setShowSubBudgetLineForm(true);
                            }}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                          >
                            Ajouter une sous-ligne
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Sous-ligne budgétaire
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Prévision budgétaire
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Budget notifié
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Taux notification
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {lineSubBudgetLines.map(subLine => {
                                const subNotificationRate = getNotificationRate(subLine.plannedAmount, subLine.notifiedAmount);
                                const isSubUnderNotified = subNotificationRate < 100;
                                const subGrant = grants.find(g => g.id === subLine.grantId);
                                
                                return (
                                  <tr key={subLine.id} className={`hover:bg-gray-50 ${isSubUnderNotified ? 'bg-yellow-50' : ''}`}>
                                    <td className="px-6 py-4">
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">{subLine.name}</div>
                                        <div className="text-sm text-gray-500">{subLine.code}</div>
                                        {subLine.description && (
                                          <div className="text-xs text-gray-400 mt-1">{subLine.description}</div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                                      {subGrant ? formatCurrency(subLine.plannedAmount, subGrant.currency) : subLine.plannedAmount.toLocaleString('fr-FR')}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                                      {subGrant ? formatCurrency(subLine.notifiedAmount, subGrant.currency) : subLine.notifiedAmount.toLocaleString('fr-FR')}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex items-center justify-center space-x-2">
                                        {isSubUnderNotified && (
                                          <AlertCircle className="w-4 h-4 text-orange-500" />
                                        )}
                                        <span className={`text-sm font-medium ${
                                          isSubUnderNotified ? 'text-orange-600' : 'text-green-600'
                                        }`}>
                                          {subNotificationRate.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                        <div 
                                          className={`h-1.5 rounded-full transition-all duration-300 ${
                                            isSubUnderNotified ? 'bg-orange-500' : 'bg-green-500'
                                          }`}
                                          style={{ width: `${Math.min(subNotificationRate, 100)}%` }}
                                        ></div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex items-center justify-center space-x-1">
                                        <button
                                          onClick={() => startEditSubBudgetLine(subLine)}
                                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                          title="Modifier"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => onDeleteSubBudgetLine(subLine.id)}
                                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Supprimer"
                                        >
                                          <Trash2 className="w-4 h-4" />
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetPlanning;