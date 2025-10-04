import React from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Grant, BudgetLine, SubBudgetLine, Engagement, GRANT_STATUS, DEFAULT_BUDGET_LINES } from '../types';

interface DashboardProps {
  grants: Grant[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  engagements: Engagement[];
}

export const Dashboard: React.FC<DashboardProps> = ({ grants, budgetLines, subBudgetLines, engagements }) => {
  const activeGrants = grants.filter(grant => grant.status === 'active');

  const formatPercentage = (rate: number) => {
    if (rate === 0) return '0%';
    if (rate < 0.01) return '< 0.01%';
    if (rate < 0.1) return rate.toFixed(2) + '%';
    if (rate < 1) return rate.toFixed(1) + '%';
    return rate.toFixed(1) + '%';
  };
  
  // Fonction pour formater les montants avec la devise dynamique
   const formatAmount = (amount: number, currencyCode?: string) => {
    const defaultCurrency = activeGrants.length > 0 
      ? activeGrants[0].currency 
      : (grants.length > 0 ? grants[0].currency : 'EUR');
    
    const currency = currencyCode || defaultCurrency;
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // CALCULS PRINCIPAUX - AJOUT DE totalSpent
  const totalGrantAmount = activeGrants.reduce((sum, grant) => sum + (Number(grant.totalAmount) || 0), 0);
  const totalAllocated = subBudgetLines.reduce((sum, line) => sum + (Number(line.notifiedAmount) || 0), 0);
  const totalEngaged = subBudgetLines.reduce((sum, line) => sum + (Number(line.engagedAmount) || 0), 0);
  const totalSpent = subBudgetLines.reduce((sum, line) => sum + (Number(line.spentAmount) || 0), 0); // NOUVEAU
  const totalAvailable = subBudgetLines.reduce((sum, line) => sum + (Number(line.availableAmount) || 0), 0);

  // INDICATEURS - AJOUT DU TAUX D'EXÉCUTION
  const engagementRate = totalAllocated > 0 ? (totalEngaged / totalAllocated) * 100 : 0;
  const executionRate = totalEngaged > 0 ? (totalSpent / totalEngaged) * 100 : 0; // NOUVEAU
  const allocationRate = totalGrantAmount > 0 ? (totalAllocated / totalGrantAmount) * 100 : 0;

  const pendingEngagements = engagements.filter(engagement => engagement.status === 'pending');
  const recentEngagements = engagements.slice(0, 5);

  // const totalGrantAmount = activeGrants.reduce((sum, grant) => sum + (Number(grant.totalAmount) || 0), 0);
  // const totalAllocated = subBudgetLines.reduce((sum, line) => sum + (Number(line.notifiedAmount) || 0), 0);
  // const totalEngaged = subBudgetLines.reduce((sum, line) => sum + (Number(line.engagedAmount) || 0), 0);
  // const totalAvailable = subBudgetLines.reduce((sum, line) => sum + (Number(line.availableAmount) || 0), 0);

  // const executionRate = totalAllocated > 0 ? ((Number(totalEngaged) || 0) / (Number(totalAllocated) || 1)) * 100 : 0;

  // const pendingEngagements = engagements.filter(engagement => engagement.status === 'pending');
  // const recentEngagements = engagements.slice(0, 5);

  const budgetLineBreakdown = budgetLines.map(budgetLine => {
    const subLines = subBudgetLines.filter(line => line.budgetLineId === budgetLine.id);
    const allocated = subLines.reduce((sum, line) => sum + (Number(line.notifiedAmount) || 0), 0);
    const spent = subLines.reduce((sum, line) => sum + (Number(line.engagedAmount) || 0), 0);
    return {
      ...budgetLine,
      allocated,
      spent,
      percentage: allocated > 0 ? ((Number(spent) || 0) / (Number(allocated) || 1)) * 100 : 0
    };
  }).filter(category => category.allocated > 0);

  const alertLines = subBudgetLines.filter(line => {
    const notifiedAmount = Number(line.notifiedAmount) || 0;
    const engagedAmount = Number(line.engagedAmount) || 0;
    const usageRate = notifiedAmount > 0 ? (engagedAmount / notifiedAmount) * 100 : 0;
    return usageRate > 90;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Tableau de Bord Budgétaire</h2>
        <p className="text-gray-600">Vue d'ensemble de la gestion des subventions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Subventions Actives</p>
              <p className="text-2xl font-bold text-blue-600">{activeGrants.length}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatAmount(totalGrantAmount)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

         {/* Carte 1 : Budget Total */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Budget Total</p>
              <p className="text-2xl font-bold text-blue-600">{formatAmount(totalGrantAmount)}</p>
              <p className="text-sm text-gray-500 mt-1">{activeGrants.length} subventions</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Carte 2 : Taux d'Engagement */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux d'Engagement</p>
              <p className="text-2xl font-bold text-green-600">{formatPercentage(engagementRate)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatAmount(totalEngaged)} / {formatAmount(totalAllocated)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Carte 3 : Taux d'Exécution (NOUVELLE) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux d'Exécution</p>
              <p className="text-2xl font-bold text-orange-600">{formatPercentage(executionRate)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatAmount(totalSpent)} / {formatAmount(totalEngaged)}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Carte 4 : Montant Disponible */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Disponible</p>
              <p className="text-2xl font-bold text-purple-600">{formatAmount(totalAvailable)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {pendingEngagements.length} en attente
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subventions Actives */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subventions Actives</h3>
          <div className="space-y-4">
            {activeGrants.map(grant => (
              <div key={grant.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{grant.name}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${GRANT_STATUS[grant.status].color}`}>
                    {GRANT_STATUS[grant.status].label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{grant.grantingOrganization}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Réf: {grant.reference}</span>
                  <span className="font-semibold text-blue-600">
                    {formatAmount(Number(grant.totalAmount) || 0, grant.currency)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {new Date(grant.startDate).toLocaleDateString('fr-FR')} - {new Date(grant.endDate).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
            {activeGrants.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucune subvention active</p>
            )}
          </div>
        </div>

        {/* Répartition par Catégorie */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Ligne Budgétaire</h3>
          <div className="space-y-4">
            {budgetLineBreakdown.map(budgetLine => (
              <div key={budgetLine.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${budgetLine.color}`}>
                      {budgetLine.code}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{budgetLine.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {budgetLine.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(budgetLine.percentage, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatAmount(Number(budgetLine.spent) || 0)}</span>
                  <span>{formatAmount(Number(budgetLine.allocated) || 0)}</span>
                </div>
              </div>
            ))}
            {budgetLineBreakdown.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucune donnée disponible</p>
            )}
          </div>
        </div>
      </div>

      {/* Alertes et Dépenses Récentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertes Budgétaires */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
            Alertes Budgétaires
          </h3>
          <div className="space-y-3">
            {alertLines.map(line => {
              const notifiedAmount = Number(line.notifiedAmount) || 0;
              const engagedAmount = Number(line.engagedAmount) || 0;
              const usageRate = notifiedAmount > 0 ? (engagedAmount / notifiedAmount) * 100 : 0;
              return (
                <div key={line.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{line.name}</p>
                      <p className="text-sm text-gray-600">{line.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{(Number(usageRate) || 0).toFixed(1)}%</p>
                      <p className="text-xs text-gray-500">utilisé</p>
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

        {/* Dépenses Récentes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagements Récents</h3>
          <div className="space-y-3">
            {recentEngagements.map(engagement => {
              const subBudgetLine = subBudgetLines.find(line => line.id === engagement.subBudgetLineId);
              const budgetLine = budgetLines.find(line => line.id === engagement.budgetLineId);
              const grant = grants.find(g => g.id === engagement.grantId);
              
              return (
                <div key={engagement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{engagement.description}</p>
                    <p className="text-sm text-gray-600">
                      {subBudgetLine?.name} • {budgetLine?.name} • {grant?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(engagement.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatAmount(Number(engagement.amount) || 0, grant?.currency)}
                    </p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      engagement.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      engagement.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {engagement.status === 'approved' ? 'Approuvé' :
                       engagement.status === 'processing' ? 'En traitement' : 'Rejeté'}
                    </span>
                  </div>
                </div>
              );
            })}
            {recentEngagements.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucun engagement enregistré</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};