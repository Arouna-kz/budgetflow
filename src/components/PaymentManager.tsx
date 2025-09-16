import React, { useState } from 'react';
import { Plus, Edit, CreditCard, CheckCircle, Clock, AlertCircle, Eye, Filter, TrendingUp } from 'lucide-react';
import { showWarning } from '../utils/alerts';
import { Payment, Engagement, BudgetLine, Grant, BankAccount, PAYMENT_STATUS } from '../types';

interface PaymentManagerProps {
  payments: Payment[];
  engagements: Engagement[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  bankAccounts: BankAccount[];
  selectedGrantId: string;
  onAddPayment: (payment: Omit<Payment, 'id'>) => void;
  onUpdatePayment: (id: string, updates: Partial<Payment>) => void;
  onViewPaymentDetails: (paymentId: string) => void;
  onCreatePaymentFromEngagement: (engagementId: string) => void;
}

const PaymentManager: React.FC<PaymentManagerProps> = ({
  payments,
  engagements,
  budgetLines,
  subBudgetLines,
  grants,
  bankAccounts,
  selectedGrantId,
  onAddPayment,
  onUpdatePayment,
  onViewPaymentDetails,
  onCreatePaymentFromEngagement
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<string>('');

  // Filtrer les engagements approuvés qui n'ont pas encore de paiement
  const availableEngagements = engagements.filter(engagement => 
    engagement.status === 'approved' && 
    !payments.some(payment => payment.engagementId === engagement.id)
  );

  // Filtrer les paiements par subvention sélectionnée
  const filteredPayments = selectedGrantId 
    ? payments.filter(payment => payment.grantId === selectedGrantId)
    : payments;

  // Filtrer les engagements disponibles par subvention sélectionnée
  const filteredAvailableEngagements = selectedGrantId
    ? availableEngagements.filter(engagement => engagement.grantId === selectedGrantId)
    : availableEngagements;

  // Trouver la subvention active (sélectionnée ou première active)
  const activeGrant = grants.find(grant => grant.id === selectedGrantId) || 
                     grants.find(grant => grant.status === 'active') || 
                     grants[0] || 
                     null;

  const getEngagement = (engagementId: string) => {
    return engagements.find(eng => eng.id === engagementId);
  };

  const getBudgetLine = (budgetLineId: string) => {
    return budgetLines.find(line => line.id === budgetLineId);
  };

  const getGrant = (grantId: string) => {
    return grants.find(grant => grant.id === grantId);
  };

  const handleCreatePayment = (engagementId: string) => {
    setSelectedEngagement(engagementId);
    setShowForm(true);
  };

  const getCurrencySymbol = (currency: Grant['currency']) => {
    switch (currency) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'XOF': return 'CFA';
      default: return '€';
    }
  };

  // Fonction pour formater les montants avec la devise de la subvention active
  const formatCurrency = (amount: number) => {
    if (!activeGrant) return amount.toLocaleString('fr-FR');
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: activeGrant.currency === 'XOF' ? 'XOF' : activeGrant.currency,
      minimumFractionDigits: activeGrant.currency === 'XOF' ? 0 : 2
    });
  };

  const updatePaymentStatus = (paymentId: string, newStatus: Payment['status']) => {
    onUpdatePayment(paymentId, { status: newStatus });
  };

  const pendingPayments = filteredPayments.filter(payment => payment.status === 'pending');
  const approvedPayments = filteredPayments.filter(payment => payment.status === 'approved');
  const paidPayments = filteredPayments.filter(payment => payment.status === 'paid');

  // Calculer le taux de décaissement basé sur les engagements et paiements
  const allEngagements = engagements.filter(eng => 
    !selectedGrantId || eng.grantId === selectedGrantId
  );
  const totalEngaged = allEngagements.reduce((sum, eng) => sum + eng.amount, 0);
  const allPaidPayments = payments.filter(payment => 
    (payment.status === 'paid' || payment.status === 'cashed') &&
    (!selectedGrantId || payment.grantId === selectedGrantId)
  );
  const totalPaid = allPaidPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const disbursementRate = totalEngaged > 0 ? (totalPaid / totalEngaged) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Paiements</h2>
          <p className="text-gray-600 mt-1">Suivi et validation des paiements basés sur les engagements approuvés</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (filteredAvailableEngagements.length === 0) {
                showWarning(
                  'Aucun engagement disponible',
                  'Aucun engagement approuvé n\'est disponible pour créer un paiement'
                );
                return;
              }
              // Ouvrir un sélecteur d'engagement ou prendre le premier
              onCreatePaymentFromEngagement(filteredAvailableEngagements[0].id);
            }}
            className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Créer un Paiement</span>
          </button>
        </div>
      </div>

      {/* Grant Information */}
      {activeGrant && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{activeGrant.name}</h3>
              <p className="text-gray-600">{activeGrant.reference} - {activeGrant.grantingOrganization}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Devise</p>
              <p className="text-lg font-bold text-green-600">
                {activeGrant.currency} ({getCurrencySymbol(activeGrant.currency)})
              </p>
            </div>
          </div>
          {/*  */}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Engagements Disponibles</p>
              <p className="text-2xl font-bold text-blue-600">{filteredAvailableEngagements.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paiements en Attente</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paiements Approuvés</p>
              <p className="text-2xl font-bold text-green-600">{approvedPayments.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paiements Effectués</p>
              <p className="text-2xl font-bold text-purple-600">{paidPayments.length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux de Décaissement</p>
              <p className="text-2xl font-bold text-indigo-600">{disbursementRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatCurrency(totalPaid)} payés
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access to Create Payments */}
      {filteredAvailableEngagements.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Plus className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Créer des Fiches de Paiement</h3>
                <p className="text-gray-600">{filteredAvailableEngagements.length} engagement{filteredAvailableEngagements.length > 1 ? 's' : ''} prêt{filteredAvailableEngagements.length > 1 ? 's' : ''} pour paiement</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAvailableEngagements.slice(0, 6).map(engagement => {
              const budgetLine = getBudgetLine(engagement.budgetLineId);
              
              return (
                <div key={engagement.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{engagement.engagementNumber}</h4>
                      <p className="text-xs text-gray-600 mb-1">{engagement.supplier}</p>
                      <p className="text-xs text-gray-500">{budgetLine?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600 text-sm">
                        {formatCurrency(engagement.amount)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onCreatePaymentFromEngagement(engagement.id)}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:shadow-md transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Créer Fiche de Paiement</span>
                  </button>
                </div>
              );
            })}
          </div>
          
          {filteredAvailableEngagements.length > 6 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Et {filteredAvailableEngagements.length - 6} autre{filteredAvailableEngagements.length - 6 > 1 ? 's' : ''} engagement{filteredAvailableEngagements.length - 6 > 1 ? 's' : ''} disponible{filteredAvailableEngagements.length - 6 > 1 ? 's' : ''}...
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Paiements Récents */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Paiements Récents</h3>
          <div className="space-y-3">
            {filteredPayments.slice(0, 5).map(payment => {
              const engagement = getEngagement(payment.engagementId);
              const budgetLine = getBudgetLine(payment.budgetLineId);
              
              return (
                <div key={payment.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{payment.paymentNumber}</h4>
                      <p className="text-sm text-gray-600">{payment.description}</p>
                      <p className="text-sm text-gray-500">
                        {budgetLine?.name} • {payment.supplier}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(payment.date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </p>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${PAYMENT_STATUS[payment.status].color}`}>
                        {PAYMENT_STATUS[payment.status].label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredPayments.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucun paiement enregistré</p>
            )}
          </div>
        </div>

        {/* Statistiques */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-700">Engagements disponibles</span>
              <span className="text-lg font-bold text-blue-600">{availableEngagements.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-yellow-700">Paiements en attente</span>
              <span className="text-lg font-bold text-yellow-600">{pendingPayments.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-700">Paiements approuvés</span>
              <span className="text-lg font-bold text-green-600">{approvedPayments.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-sm font-medium text-purple-700">Paiements effectués</span>
              <span className="text-lg font-bold text-purple-600">{paidPayments.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Liste des Paiements
            {selectedGrantId && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({filteredPayments.length} paiement{filteredPayments.length > 1 ? 's' : ''})
              </span>
            )}
          </h3>
        </div>
        
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedGrantId ? 'Aucun paiement pour cette subvention' : 'Aucun paiement'}
            </h3>
            <p className="text-gray-500">
              {selectedGrantId ? 'Aucun paiement n\'a été créé pour cette subvention' : 'Les paiements apparaîtront ici une fois créés'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paiement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
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
                {filteredPayments.map(payment => {
                  const engagement = getEngagement(payment.engagementId);
                  const budgetLine = getBudgetLine(payment.budgetLineId);
                  
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{payment.paymentNumber}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(payment.date).toLocaleDateString('fr-FR')}
                          </div>
                          <div className="text-xs text-gray-400">
                            {payment.paymentMethod === 'check' ? 'Chèque' : 
                             payment.paymentMethod === 'transfer' ? 'Virement' : 'Espèces'}
                            {payment.checkNumber && ` N°${payment.checkNumber}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{engagement?.engagementNumber}</div>
                        <div className="text-sm text-gray-500">{budgetLine?.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {payment.supplier}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <select
                          value={payment.status}
                          onChange={(e) => updatePaymentStatus(payment.id, e.target.value as Payment['status'])}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${PAYMENT_STATUS[payment.status].color}`}
                        >
                          <option value="pending">En attente</option>
                          <option value="approved">Approuvé</option>
                          <option value="paid">Payé</option>
                          <option value="cashed">Encaissé</option>
                          <option value="rejected">Rejeté</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => onViewPaymentDetails(payment.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
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

export default PaymentManager;