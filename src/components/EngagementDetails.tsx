import React from 'react';
import { X, FileText, CheckCircle, Clock, AlertCircle, User } from 'lucide-react';
import { BudgetLine, SubBudgetLine, Engagement, ENGAGEMENT_STATUS } from '../types';

interface EngagementDetailsProps {
  subBudgetLine: SubBudgetLine;
  budgetLine: BudgetLine;
  engagements: Engagement[];
  onClose: () => void;
  onEditEngagement: (engagement: Engagement) => void;
  currency?: string; // Nouvelle prop pour la devise
}

const EngagementDetails: React.FC<EngagementDetailsProps> = ({
  subBudgetLine,
  budgetLine,
  engagements,
  onClose,
  onEditEngagement,
  currency = 'EUR' // Valeur par défaut
}) => {
  const totalEngaged = engagements.reduce((sum, eng) => sum + eng.amount, 0);
  const approvedEngagements = engagements.filter(eng => eng.status === 'approved' || eng.status === 'paid');
  const pendingEngagements = engagements.filter(eng => eng.status === 'pending');

  // Options de formatage dynamique basées sur la devise
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: currency 
    });
  };

  const getApprovalStatus = (engagement: Engagement) => {
    const approvals = engagement.approvals;
    if (!approvals) return { count: 0, total: 0, complete: false };
    
    let count = 0;
    let total = 0;
    
    if (approvals.supervisor1?.name) {
      total++;
      if (approvals.supervisor1.signature) count++;
    }
    if (approvals.supervisor2?.name) {
      total++;
      if (approvals.supervisor2.signature) count++;
    }
    if (approvals.finalApproval?.name) {
      total++;
      if (approvals.finalApproval.signature) count++;
    }
    
    return { count, total, complete: count === total && total > 0 };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Détail des Engagements</h2>
              <p className="text-gray-600">{subBudgetLine.code} - {subBudgetLine.name}</p>
              <p className="text-sm text-gray-500">{budgetLine.code} - {budgetLine.name}</p>
              <p className="text-xs text-gray-400">Devise: {currency}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Budget Summary */}
        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-blue-700 font-medium">Budget Notifié</p>
              <p className="text-xl font-bold text-blue-900">
                {formatCurrency(subBudgetLine.notifiedAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Engagé</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(totalEngaged)}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Solde Disponible</p>
              <p className={`text-xl font-bold ${subBudgetLine.availableAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(subBudgetLine.availableAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Taux d'Engagement</p>
              <p className="text-xl font-bold text-purple-600">
                {subBudgetLine.notifiedAmount > 0 ? ((subBudgetLine.engagedAmount / subBudgetLine.notifiedAmount) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Engagements List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Liste des Engagements ({engagements.length})
            </h3>
            <div className="flex space-x-4 text-sm">
              <span className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Approuvés: {approvedEngagements.length}</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>En attente: {pendingEngagements.length}</span>
              </span>
            </div>
          </div>

          {engagements.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun engagement</h3>
              <p className="text-gray-500">Aucun engagement n'a été enregistré pour cette sous-ligne budgétaire</p>
            </div>
          ) : (
            <div className="space-y-3">
              {engagements.map(engagement => {
                const approvalStatus = getApprovalStatus(engagement);
                
                return (
                  <div key={engagement.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="font-semibold text-gray-900">{engagement.engagementNumber}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${ENGAGEMENT_STATUS[engagement.status].color}`}>
                            {ENGAGEMENT_STATUS[engagement.status].label}
                          </span>
                          
                          {/* Approval Status */}
                          <div className="flex items-center space-x-1">
                            {approvalStatus.complete ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : approvalStatus.total > 0 ? (
                              <Clock className="w-4 h-4 text-orange-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-xs text-gray-600">
                              {approvalStatus.total > 0 ? `${approvalStatus.count}/${approvalStatus.total} signatures` : 'Aucune signature'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-600">Fournisseur</p>
                            <p className="font-medium text-gray-900">{engagement.supplier}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Montant</p>
                            <p className="font-bold text-blue-600">
                              {formatCurrency(engagement.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Date</p>
                            <p className="font-medium text-gray-900">
                              {new Date(engagement.date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm text-gray-600">Description</p>
                            <p className="text-gray-900">{engagement.description}</p>
                        </div>

                        {engagement.quoteReference && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-600">Référence devis</p>
                            <p className="font-medium text-gray-900">{engagement.quoteReference}</p>
                          </div>
                        )}

                        {/* Signatures Details */}
                        {engagement.approvals && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                              <User className="w-4 h-4 mr-2" />
                              Signatures
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              {engagement.approvals.supervisor1?.name && (
                                <div className="flex items-center space-x-2">
                                  {engagement.approvals.supervisor1.signature ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-orange-500" />
                                  )}
                                  <span className="text-gray-700">{engagement.approvals.supervisor1.name}</span>
                                </div>
                              )}
                              {engagement.approvals.supervisor2?.name && (
                                <div className="flex items-center space-x-2">
                                  {engagement.approvals.supervisor2.signature ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-orange-500" />
                                  )}
                                  <span className="text-gray-700">{engagement.approvals.supervisor2.name}</span>
                                </div>
                              )}
                              {engagement.approvals.finalApproval?.name && (
                                <div className="flex items-center space-x-2">
                                  {engagement.approvals.finalApproval.signature ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-orange-500" />
                                  )}
                                  <span className="text-gray-700">{engagement.approvals.finalApproval.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onEditEngagement(engagement)}
                        className="ml-4 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default EngagementDetails;