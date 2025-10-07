// components/PaymentDetailsView.tsx
import React from 'react';
import { 
  X, 
  CreditCard, 
  FileText, 
  User, 
  CheckCircle, 
  Clock,
  Truck,
  CheckSquare,
  Building
} from 'lucide-react';
import { Payment, Engagement, BudgetLine, SubBudgetLine, Grant, PAYMENT_STATUS } from '../types';

interface PaymentDetailsViewProps {
  payment: Payment;
  engagement: Engagement;
  subBudgetLine: SubBudgetLine;
  budgetLine: BudgetLine;
  grant: Grant;
  onClose: () => void;
}

const PaymentDetailsView: React.FC<PaymentDetailsViewProps> = ({
  payment,
  engagement,
  subBudgetLine,
  budgetLine,
  grant,
  onClose
}) => {
  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'XOF': return 'CFA';
      default: return '€';
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' ' + getCurrencySymbol(grant.currency);
  };

  const getPaymentMethodLabel = (method: Payment['paymentMethod']) => {
    switch (method) {
      case 'transfer': return 'Virement Bancaire';
      case 'check': return 'Chèque';
      case 'cash': return 'Espèces';
      default: return method;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Détails Complets du Paiement</h2>
              <p className="text-gray-600">{payment.paymentNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Section 1: Informations Générales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Colonne 1: Informations du Paiement */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Informations du Paiement
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de Paiement</label>
                  <p className="text-gray-900 font-medium text-lg">{payment.paymentNumber}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de Paiement</label>
                    <p className="text-gray-900">{new Date(payment.date).toLocaleDateString('fr-FR')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${PAYMENT_STATUS[payment.status].color}`}>
                      {PAYMENT_STATUS[payment.status].label}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                  <p className="text-3xl font-bold text-green-600">{formatAmount(payment.amount)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode de Paiement</label>
                    <p className="text-gray-900 font-medium">{getPaymentMethodLabel(payment.paymentMethod)}</p>
                  </div>

                  {payment.checkNumber && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">N° de Chèque</label>
                      <p className="text-gray-900 font-medium">{payment.checkNumber}</p>
                    </div>
                  )}
                </div>

                {payment.bankReference && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Référence Bancaire</label>
                    <p className="text-gray-900">{payment.bankReference}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Colonne 2: Informations de l'Engagement */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Informations de l'Engagement
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° d'Engagement</label>
                  <p className="text-gray-900 font-medium text-lg">{engagement.engagementNumber}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <p className="text-gray-900 font-medium">{engagement.supplier}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ligne Budgétaire</label>
                    <p className="text-gray-900">{budgetLine.code} - {budgetLine.name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sous-Ligne</label>
                    <p className="text-gray-900">{subBudgetLine.code} - {subBudgetLine.name}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant Engagé</label>
                  <p className="text-xl font-semibold text-blue-600">{formatAmount(engagement.amount)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Informations de Contrôle */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-6">
              <CheckSquare className="w-5 h-5 mr-2" />
              Informations de Contrôle
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {payment.invoiceNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° de Facture</label>
                  <p className="text-gray-900 font-medium">{payment.invoiceNumber}</p>
                </div>
              )}

              {payment.invoiceAmount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant Facture</label>
                  <p className="text-gray-900">{formatAmount(payment.invoiceAmount)}</p>
                </div>
              )}

              {payment.quoteReference && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Référence Devis</label>
                  <p className="text-gray-900">{payment.quoteReference}</p>
                </div>
              )}

              {payment.deliveryNote && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bon de Livraison</label>
                  <p className="text-gray-900">{payment.deliveryNote}</p>
                </div>
              )}

              {payment.purchaseOrderNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bon de Commande</label>
                  <p className="text-gray-900">{payment.purchaseOrderNumber}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Accepté</label>
                <div className="flex items-center space-x-2">
                  {payment.serviceAcceptance ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-600 font-medium">Oui</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-500">Non</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {payment.controlNotes && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes de Contrôle</label>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-900 whitespace-pre-wrap">{payment.controlNotes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Description */}
          {payment.description && (
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-900 whitespace-pre-wrap">{payment.description}</p>
              </div>
            </div>
          )}

          {/* Section 4: Signatures */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-6">
              <User className="w-5 h-5 mr-2" />
              Signatures d'Approval
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Coordinateur de la Subvention */}
              <div className="border border-gray-200 rounded-lg p-6 bg-white">
                <h4 className="font-semibold text-gray-800 mb-4 text-center">Coordinateur de la Subvention</h4>
                {payment.approvals?.supervisor1 ? (
                  <div className="space-y-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {payment.approvals.supervisor1.signature ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-gray-400" />
                      )}
                      <span className="font-medium text-lg">{payment.approvals.supervisor1.name}</span>
                    </div>
                    {payment.approvals.supervisor1.date && (
                      <p className="text-sm text-gray-600">
                        Signé le {new Date(payment.approvals.supervisor1.date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    {payment.approvals.supervisor1.observation && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-sm text-yellow-800 font-medium">Observation:</p>
                        <p className="text-sm text-yellow-700 mt-1">{payment.approvals.supervisor1.observation}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center">En attente de signature</p>
                )}
              </div>

              {/* Comptable */}
              <div className="border border-gray-200 rounded-lg p-6 bg-white">
                <h4 className="font-semibold text-gray-800 mb-4 text-center">Comptable</h4>
                {payment.approvals?.supervisor2 ? (
                  <div className="space-y-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {payment.approvals.supervisor2.signature ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-gray-400" />
                      )}
                      <span className="font-medium text-lg">{payment.approvals.supervisor2.name}</span>
                    </div>
                    {payment.approvals.supervisor2.date && (
                      <p className="text-sm text-gray-600">
                        Signé le {new Date(payment.approvals.supervisor2.date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    {payment.approvals.supervisor2.observation && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-sm text-yellow-800 font-medium">Observation:</p>
                        <p className="text-sm text-yellow-700 mt-1">{payment.approvals.supervisor2.observation}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center">En attente de signature</p>
                )}
              </div>

              {/* Coordonnateur National */}
              <div className="border border-gray-200 rounded-lg p-6 bg-white">
                <h4 className="font-semibold text-gray-800 mb-4 text-center">Coordonnateur National</h4>
                {payment.approvals?.finalApproval ? (
                  <div className="space-y-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {payment.approvals.finalApproval.signature ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-gray-400" />
                      )}
                      <span className="font-medium text-lg">{payment.approvals.finalApproval.name}</span>
                    </div>
                    {payment.approvals.finalApproval.date && (
                      <p className="text-sm text-gray-600">
                        Signé le {new Date(payment.approvals.finalApproval.date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    {payment.approvals.finalApproval.observation && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-sm text-yellow-800 font-medium">Observation:</p>
                        <p className="text-sm text-yellow-700 mt-1">{payment.approvals.finalApproval.observation}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center">En attente de signature</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsView;