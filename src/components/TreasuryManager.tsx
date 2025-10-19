import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Banknote, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { showSuccess, showValidationError, confirmDelete, showError } from '../utils/alerts';
import { Payment, BankTransaction, PAYMENT_STATUS, Grant } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface TreasuryManagerProps {
  payments: Payment[];
  bankTransactions: BankTransaction[];
  selectedGrant?: Grant;
  onAddBankTransaction: (transaction: Omit<BankTransaction, 'id'>) => void;
  onUpdateGrant: (id: string, updates: Partial<Grant>) => void;
}

const TreasuryManager: React.FC<TreasuryManagerProps> = ({
  payments,
  bankTransactions,
  selectedGrant,
  onAddBankTransaction,
  onUpdateGrant
}) => {
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  
  // Vérification des permissions
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  
  // Utiliser directement le compte bancaire de la subvention sélectionnée
  const grantBankAccount = selectedGrant?.bankAccount;

  // Créer un objet compte bancaire virtuel pour la subvention
  const virtualBankAccount = grantBankAccount ? {
    id: `grant-${selectedGrant?.id}`,
    name: grantBankAccount.name,
    bankName: grantBankAccount.bankName,
    accountNumber: grantBankAccount.accountNumber,
    balance: grantBankAccount.balance || 0,
    currency: selectedGrant?.currency || 'EUR',
    lastUpdateDate: grantBankAccount.lastUpdateDate || new Date().toISOString()
  } : null;

  const filteredBankAccounts = virtualBankAccount ? [virtualBankAccount] : [];

  // Initialiser le formulaire avec le compte de la subvention si disponible
  const getInitialAccountId = () => {
    if (grantBankAccount && selectedGrant) {
      return `grant-${selectedGrant.id}`;
    }
    return '';
  };

  const [transactionFormData, setTransactionFormData] = useState({
    accountId: getInitialAccountId(),
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'credit' as 'credit' | 'debit',
    reference: ''
  });

  // Mettre à jour accountId quand selectedGrant change
  useEffect(() => {
    if (selectedGrant && selectedGrant.bankAccount) {
      setTransactionFormData(prev => ({
        ...prev,
        accountId: `grant-${selectedGrant.id}`
      }));
    }
  }, [selectedGrant]);

  // Fonction pour mettre à jour le solde du compte bancaire de la subvention
  const updateGrantBankAccountBalance = (amount: number, type: 'credit' | 'debit') => {
    if (!selectedGrant || !selectedGrant.bankAccount) return;

    const currentBalance = selectedGrant.bankAccount.balance || 0;
    const newBalance = type === 'credit' 
      ? currentBalance + amount 
      : currentBalance - amount;

    // Mettre à jour la subvention avec le nouveau solde
    onUpdateGrant(selectedGrant.id, {
      bankAccount: {
        ...selectedGrant.bankAccount,
        balance: newBalance,
        lastUpdateDate: new Date().toISOString()
      }
    });
  };

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

  if (!hasModuleAccess('treasury')) {
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

  // Définition des permissions spécifiques au module
  const canView = hasPermission('treasury', 'view');
  const canCreate = hasPermission('treasury', 'create');

  // Vérifier si la subvention sélectionnée est active
  const canCreateTreasury = canCreate && selectedGrant && selectedGrant.status === 'active';

  // Fonction pour formater les montants avec la devise de la subvention active
  const formatCurrency = (amount: number) => {
    if (!selectedGrant) return amount.toLocaleString('fr-FR');
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: selectedGrant.currency === 'XOF' ? 'XOF' : selectedGrant.currency,
      minimumFractionDigits: selectedGrant.currency === 'XOF' ? 0 : 2
    });
  };

  const resetTransactionForm = () => {
    setTransactionFormData({
      accountId: getInitialAccountId(),
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'credit',
      reference: ''
    });
    setShowTransactionForm(false);
  };

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de créer des transactions');
      return;
    }
    
    if (!transactionFormData.accountId) {
      showValidationError('Compte manquant', 'Veuillez sélectionner un compte bancaire');
      return;
    }
    
    if (!transactionFormData.description.trim()) {
      showValidationError('Description manquante', 'Veuillez saisir une description pour la transaction');
      return;
    }
    
    if (!transactionFormData.amount || parseFloat(transactionFormData.amount) <= 0) {
      showValidationError('Montant invalide', 'Veuillez saisir un montant valide supérieur à 0');
      return;
    }

    const amount = parseFloat(transactionFormData.amount);
    const transactionData = {
      accountId: transactionFormData.accountId,
      date: transactionFormData.date,
      description: transactionFormData.description.trim(),
      amount: amount,
      type: transactionFormData.type,
      reference: transactionFormData.reference.trim()
    };

    // Ajouter la transaction
    onAddBankTransaction(transactionData);

    // Mettre à jour le solde du compte bancaire de la subvention
    if (transactionFormData.accountId.startsWith('grant-') && selectedGrant) {
      updateGrantBankAccountBalance(amount, transactionFormData.type);
    }

    showSuccess('Transaction ajoutée', 'La transaction a été ajoutée avec succès');
    resetTransactionForm();
  };

  // Calculs pour l'état de trésorerie
  const totalBankBalance = filteredBankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const validatedPayments = payments.filter(payment => payment.status === 'approved' || payment.status === 'paid');
  const totalValidatedPayments = validatedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const uncashedPayments = payments.filter(payment => payment.status === 'approved' && !payment.cashedDate);
  const totalUncashedPayments = uncashedPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const getAccountTransactions = (accountId: string) => {
    return bankTransactions.filter(transaction => transaction.accountId === accountId);
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Banknote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour visualiser le module de trésorerie.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">État de Trésorerie</h2>
          <p className="text-gray-600 mt-1">Suivi des comptes bancaires et des paiements</p>
        </div>
        <div className="flex space-x-3">
          {canCreate && (
            <button
              onClick={() => setShowTransactionForm(true)}
              disabled={!canCreateTreasury}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                canCreateTreasury
                  ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:shadow-lg transform hover:scale-[1.02]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              // className="bg-green-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Transaction</span>
            </button>
          )}
        </div>
      </div>

      {/* Information sur la subvention active et sa devise */}
      {selectedGrant && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Subvention Active</h3>
              <p className="text-sm text-gray-600">{selectedGrant.name}</p>
              {grantBankAccount && (
                <p className="text-sm text-gray-500">
                  Compte: {grantBankAccount.name} - {grantBankAccount.bankName}
                </p>
              )}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Solde Total Banques</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalBankBalance)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Banknote className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Chèques Non Encaissés</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(totalUncashedPayments)}
              </p>
              <p className="text-sm text-gray-500">{uncashedPayments.length} chèques</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Comptes Bancaires</p>
              <p className="text-2xl font-bold text-purple-600">{filteredBankAccounts.length}</p>
              <p className="text-sm text-gray-500">
                {selectedGrant ? 'Compte de la subvention' : 'Aucun compte'}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Comptes Bancaires */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedGrant ? 'Compte Bancaire de la Subvention' : 'Comptes Bancaires'}
          </h3>
          <div className="space-y-4">
            {filteredBankAccounts.map(account => {
              const accountTransactions = getAccountTransactions(account.id);
              const recentTransactions = accountTransactions.slice(0, 3);
              
              return (
                <div key={account.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{account.name}</h4>
                      <p className="text-sm text-gray-600">{account.bankName}</p>
                      <p className="text-xs text-gray-500">N° {account.accountNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-xs text-gray-500">
                        MAJ: {new Date(account.lastUpdateDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  {recentTransactions.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Dernières transactions</p>
                      {recentTransactions.map(transaction => (
                        <div key={transaction.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{transaction.description}</span>
                          <span className={`font-medium ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredBankAccounts.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucun compte bancaire configuré</p>
            )}
          </div>
        </div>

        {/* Paiements Non Encaissés */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Paiements Non Encaissés</h3>
          <div className="space-y-3">
            {uncashedPayments.map(payment => (
              <div key={payment.id} className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{payment.paymentNumber}</h4>
                    <p className="text-sm text-gray-600">{payment.supplier}</p>
                    <p className="text-xs text-gray-500">
                      {payment.paymentMethod === 'check' ? 'Chèque' : 'Virement'} 
                      {payment.checkNumber && ` N°${payment.checkNumber}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      Émis le {new Date(payment.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">
                      {formatCurrency(payment.amount)}
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${PAYMENT_STATUS[payment.status].color}`}>
                      {PAYMENT_STATUS[payment.status].label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {uncashedPayments.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 font-medium">Tous les paiements sont encaissés</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Nouvelle transaction bancaire
            </h3>
            
            {/* Grant and Bank Account Info */}
            {selectedGrant && grantBankAccount && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">Subvention et Compte Associé</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-blue-700">Subvention:</span>
                    <span className="ml-2 font-medium">{selectedGrant.name}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Compte:</span>
                    <span className="ml-2 font-medium">{grantBankAccount.name}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Banque:</span>
                    <span className="ml-2 font-medium">{grantBankAccount.bankName}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Devise:</span>
                    <span className="ml-2 font-medium">{selectedGrant.currency}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Solde actuel:</span>
                    <span className="ml-2 font-bold text-blue-600">
                      {formatCurrency(grantBankAccount.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compte bancaire *
                </label>
                {selectedGrant && grantBankAccount ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
                    {grantBankAccount.name} - {grantBankAccount.bankName}
                    <input type="hidden" value={transactionFormData.accountId} />
                  </div>
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">
                    Aucun compte bancaire configuré
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {selectedGrant ? 'Compte bancaire de la subvention active' : 'Aucune subvention sélectionnée'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={transactionFormData.date}
                    onChange={(e) => setTransactionFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={transactionFormData.type}
                    onChange={(e) => setTransactionFormData(prev => ({ ...prev, type: e.target.value as 'credit' | 'debit' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="credit">Crédit (+)</option>
                    <option value="debit">Débit (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  value={transactionFormData.description}
                  onChange={(e) => setTransactionFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Description de la transaction"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant ({selectedGrant?.currency || '€'}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transactionFormData.amount}
                  onChange={(e) => setTransactionFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence
                </label>
                <input
                  type="text"
                  value={transactionFormData.reference}
                  onChange={(e) => setTransactionFormData(prev => ({ ...prev, reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Numéro de chèque, référence virement..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetTransactionForm}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!selectedGrant || !grantBankAccount}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Ajouter Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasuryManager;