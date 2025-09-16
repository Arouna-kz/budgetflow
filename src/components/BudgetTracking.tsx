import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Eye, FileText } from 'lucide-react';
import { BudgetLine, SubBudgetLine, Grant, Engagement, DEFAULT_BUDGET_LINES } from '../types';

interface BudgetTrackingProps {
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  engagements: Engagement[];
  selectedGrantId: string;
  onViewEngagements: (subBudgetLineId: string) => void;
}

const BudgetTracking: React.FC<BudgetTrackingProps> = ({ budgetLines, subBudgetLines, grants, engagements, selectedGrantId, onViewEngagements }) => {
  // Utiliser directement les données filtrées par l'App
  const filteredBudgetLines = budgetLines;
  const filteredSubBudgetLines = subBudgetLines;
  const selectedGrant = grants.length > 0 ? grants[0] : null;

  const getEngagementRate = (line: SubBudgetLine) => {
    return line.notifiedAmount > 0 ? (line.engagedAmount / line.notifiedAmount) * 100 : 0;
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  const totalNotified = filteredSubBudgetLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
  const totalEngaged = filteredSubBudgetLines.reduce((sum, line) => sum + line.engagedAmount, 0);
  const totalAvailable = filteredSubBudgetLines.reduce((sum, line) => sum + line.availableAmount, 0);
  const overallEngagementRate = totalNotified > 0 ? (totalEngaged / totalNotified) * 100 : 0;

  const alertLines = filteredSubBudgetLines.filter(line => {
    const engagementRate = getEngagementRate(line);
    return engagementRate > 90;
  });

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

  const budgetLineStats = filteredBudgetLines.map(budgetLine => {
    const subLines = filteredSubBudgetLines.filter(line => line.budgetLineId === budgetLine.id);
    const notified = subLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
    const engaged = subLines.reduce((sum, line) => sum + line.engagedAmount, 0);
    const available = subLines.reduce((sum, line) => sum + line.availableAmount, 0);
    
    return {
      ...budgetLine,
      notified,
      engaged,
      available,
      engagementRate: notified > 0 ? (engaged / notified) * 100 : 0
    };
  }).filter(line => line.notified > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Suivi Budgétaire</h2>
          <p className="text-gray-600 mt-1">Suivi en temps réel de l'exécution budgétaire</p>
        </div>
      </div>

      {/* Grant Information */}
      {/* {selectedGrant && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedGrant.name}</h3>
              <p className="text-gray-600">{selectedGrant.reference} - {selectedGrant.grantingOrganization}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Devise de suivi</p>
              <p className="text-lg font-bold text-blue-600">
                {selectedGrant.currency} ({getCurrencySymbol(selectedGrant.currency)})
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Montant Planifié</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(selectedGrant.plannedAmount, selectedGrant.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Montant Notifié</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(selectedGrant.totalAmount, selectedGrant.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Montant Engagé</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(totalEngaged, selectedGrant.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Taux d'Engagement</p>
              <p className="text-xl font-bold text-purple-600">{overallEngagementRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )} */}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Budget Notifié</p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedGrant ? formatCurrency(totalNotified, selectedGrant.currency) : totalNotified.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Engagé</p>
              <p className="text-2xl font-bold text-green-600">
                {selectedGrant ? formatCurrency(totalEngaged, selectedGrant.currency) : totalEngaged.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Solde Disponible</p>
              <p className="text-2xl font-bold text-purple-600">
                {selectedGrant ? formatCurrency(totalAvailable, selectedGrant.currency) : totalAvailable.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux d'Engagement</p>
              <p className="text-2xl font-bold text-orange-600">{overallEngagementRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suivi par Ligne Budgétaire */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Suivi par Ligne Budgétaire</h3>
          <div className="space-y-4">
            {budgetLineStats.map(budgetLine => (
              <div key={budgetLine.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${budgetLine.color}`}>
                      {budgetLine.code}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{budgetLine.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {budgetLine.engagementRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      budgetLine.engagementRate > 90 ? 'bg-red-500' :
                      budgetLine.engagementRate > 75 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetLine.engagementRate, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Engagé: {selectedGrant ? formatCurrency(budgetLine.engaged, selectedGrant.currency) : budgetLine.engaged.toLocaleString('fr-FR')}</span>
                  <span>Notifié: {selectedGrant ? formatCurrency(budgetLine.notified, selectedGrant.currency) : budgetLine.notified.toLocaleString('fr-FR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
            Alertes Budgétaires
          </h3>
          <div className="space-y-3">
            {alertLines.map(line => {
              const engagementRate = getEngagementRate(line);
              return (
                <div key={line.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{line.name}</p>
                      <p className="text-sm text-gray-600">{line.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{engagementRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {alertLines.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 font-medium">Aucune alerte</p>
                <p className="text-sm text-gray-500">Tous les budgets sont sous contrôle</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Budget Lines Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Détail par Sous-ligne Budgétaire
            {selectedGrantId && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({filteredSubBudgetLines.length} sous-ligne{filteredSubBudgetLines.length > 1 ? 's' : ''})
              </span>
            )}
          </h3>
        </div>
        
        {filteredSubBudgetLines.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedGrantId ? 'Aucune sous-ligne budgétaire pour cette subvention' : 'Aucune sous-ligne budgétaire'}
            </h3>
            <p className="text-gray-500">
              {selectedGrantId ? 'Aucune sous-ligne budgétaire n\'a été créée pour cette subvention' : 'Sélectionnez une subvention pour voir le détail'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sous-ligne budgétaire
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ligne budgétaire
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget notifié
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant engagé
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solde disponible
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taux d'engagement
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubBudgetLines.map(line => {
                  const engagementRate = getEngagementRate(line);
                  const isOverEngaged = engagementRate > 100;
                  const isNearLimit = engagementRate > 90;
                  const lineEngagements = engagements.filter(eng => eng.subBudgetLineId === line.id);
                  const budgetLine = budgetLines.find(bl => bl.id === line.budgetLineId);
                  const lineGrant = grants.find(g => g.id === line.grantId);
                  
                  // Fonction pour tronquer les textes longs
                  const truncateText = (text: string, maxLength: number) => {
                    if (!text) return '';
                    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
                  };
                  
                  return (
                    <tr key={line.id} className={`hover:bg-gray-50 ${isOverEngaged ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 max-w-[150px]">
                        <div className="flex flex-col">
                          <div 
                            className="text-sm font-medium text-gray-900 truncate"
                            title={line.name}
                          >
                            {truncateText(line.name, 30)}
                          </div>
                          <div className="text-xs text-gray-500">{line.code}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[120px]">
                        <div className="flex flex-col">
                          <div 
                            className="text-sm text-gray-900 truncate"
                            title={budgetLine?.name}
                          >
                            {truncateText(budgetLine?.name || '', 25)}
                          </div>
                          <div className="text-xs text-gray-500">{budgetLine?.code}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                        {lineGrant ? formatCurrency(line.notifiedAmount, lineGrant.currency) : line.notifiedAmount.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900 whitespace-nowrap">
                        {lineGrant ? formatCurrency(line.engagedAmount, lineGrant.currency) : line.engagedAmount.toLocaleString('fr-FR')}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-medium whitespace-nowrap ${
                        line.availableAmount < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {lineGrant ? formatCurrency(line.availableAmount, lineGrant.currency) : line.availableAmount.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {isNearLimit && (
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                          )}
                          <span className={`text-sm font-medium ${getEngagementColor(engagementRate)}`}>
                            {engagementRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isOverEngaged ? 'bg-red-500' : 
                              isNearLimit ? 'bg-orange-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(engagementRate, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onViewEngagements(line.id)}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Détails ({lineEngagements.length})
                        </button>
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

export default BudgetTracking;