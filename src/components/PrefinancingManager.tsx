import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, FileText, Calendar, ArrowRightLeft, Download } from 'lucide-react';
import { showSuccess, showValidationError } from '../utils/alerts';
import { Prefinancing, BudgetLine, Grant, PREFINANCING_STATUS, BankAccount, SubBudgetLine } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PrefinancingManagerProps {
  prefinancings: Prefinancing[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  bankAccounts: BankAccount[];
  onAddPrefinancing: (prefinancing: Omit<Prefinancing, 'id'>) => void;
  onUpdatePrefinancing: (id: string, updates: Partial<Prefinancing>) => void;
  onAddPrefinancingRepayment: (prefinancingId: string, repayment: { date: string; amount: number; reference: string }) => void;
}

const PrefinancingManager: React.FC<PrefinancingManagerProps> = ({
  prefinancings,
  budgetLines,
  subBudgetLines,
  grants,
  bankAccounts,
  onAddPrefinancing,
  onUpdatePrefinancing,
  onAddPrefinancingRepayment
}) => {
  const [showForm, setShowForm] = useState(false);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [selectedPrefinancing, setSelectedPrefinancing] = useState<Prefinancing | null>(null);
  const [editingPrefinancing, setEditingPrefinancing] = useState<Prefinancing | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [formData, setFormData] = useState({
    grantId: grants.length > 0 ? grants[0].id : '',
    budgetLineId: '',
    subBudgetLineId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    expectedRepaymentDate: '',
    purpose: 'specific_expenses' as Prefinancing['purpose'],
    targetBankAccount: '',
    targetGrant: ''
  });

  const [repaymentData, setRepaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    reference: ''
  });

  const [expenses, setExpenses] = useState([
    { supplier: '', invoiceNumber: '', amount: '', description: '' }
  ]);

  const [approvals, setApprovals] = useState({
    supervisor1: { name: '', signature: false },
    supervisor2: { name: '', signature: false },
    finalApproval: { name: '', signature: false }
  });

  // Générer le numéro de préfinancement
  const prefinancingNumber = `PRE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Fonction pour formater les montants avec la devise de la subvention
  const formatCurrency = (amount: number, grantId?: string) => {
    const grant = grantId 
      ? grants.find(g => g.id === grantId) 
      : grants.find(g => g.status === 'active') || grants[0];
    
    if (!grant) return amount.toLocaleString('fr-FR');
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: grant.currency === 'XOF' ? 'XOF' : grant.currency,
      minimumFractionDigits: grant.currency === 'XOF' ? 0 : 2
    });
  };

  // Obtenir la subvention sélectionnée dans le formulaire
  const getSelectedGrant = () => {
    return grants.find(grant => grant.id === formData.grantId);
  };

  const resetForm = () => {
    setFormData({
      grantId: grants.length > 0 ? grants[0].id : '',
      budgetLineId: '',
      subBudgetLineId: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      expectedRepaymentDate: '',
      purpose: 'specific_expenses',
      targetBankAccount: '',
      targetGrant: ''
    });
    setExpenses([{ supplier: '', invoiceNumber: '', amount: '', description: '' }]);
    setApprovals({
      supervisor1: { name: '', signature: false },
      supervisor2: { name: '', signature: false },
      finalApproval: { name: '', signature: false }
    });
    setShowForm(false);
    setEditingPrefinancing(null);
  };

  const handleEditPrefinancing = (prefinancing: Prefinancing) => {
    setEditingPrefinancing(prefinancing);
    setFormData({
      grantId: prefinancing.grantId,
      budgetLineId: prefinancing.budgetLineId || '',
      subBudgetLineId: prefinancing.subBudgetLineId || '',
      amount: prefinancing.amount.toString(),
      description: prefinancing.description,
      date: prefinancing.date,
      expectedRepaymentDate: prefinancing.expectedRepaymentDate,
      purpose: prefinancing.purpose,
      targetBankAccount: prefinancing.targetBankAccount || '',
      targetGrant: prefinancing.targetGrant || ''
    });
    
    // Pré-remplir les dépenses
    setExpenses(prefinancing.expenses?.map(exp => ({
      supplier: exp.supplier,
      invoiceNumber: exp.invoiceNumber,
      amount: exp.amount.toString(),
      description: exp.description
    })) || [{ supplier: '', invoiceNumber: '', amount: '', description: '' }]);
    
    // Pré-remplir les approbations
    setApprovals({
      supervisor1: {
        name: prefinancing.approvals?.supervisor1?.name || '',
        signature: prefinancing.approvals?.supervisor1?.signature || false
      },
      supervisor2: {
        name: prefinancing.approvals?.supervisor2?.name || '',
        signature: prefinancing.approvals?.supervisor2?.signature || false
      },
      finalApproval: {
        name: prefinancing.approvals?.finalApproval?.name || '',
        signature: prefinancing.approvals?.finalApproval?.signature || false
      }
    });
    
    setShowForm(true);
  };

  const resetRepaymentForm = () => {
    setRepaymentData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      reference: ''
    });
    setShowRepaymentForm(false);
    setSelectedPrefinancing(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.grantId || !formData.amount || !formData.description) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, le montant et la description');
      return;
    }

    const validExpenses = expenses.filter(exp => exp.supplier && exp.invoiceNumber && exp.amount);
    if (validExpenses.length === 0) {
      showValidationError('Dépenses manquantes', 'Veuillez ajouter au moins une dépense avec fournisseur, facture et montant');
      return;
    }

    // Si on est en mode édition
    if (editingPrefinancing) {
      const updates: Partial<Prefinancing> = {
        grantId: formData.grantId,
        budgetLineId: formData.budgetLineId || undefined,
        subBudgetLineId: formData.subBudgetLineId || undefined,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        expectedRepaymentDate: formData.expectedRepaymentDate,
        purpose: formData.purpose,
        targetBankAccount: formData.targetBankAccount || undefined,
        targetGrant: formData.targetGrant || undefined,
        expenses: validExpenses.map(exp => ({
          supplier: exp.supplier,
          invoiceNumber: exp.invoiceNumber,
          amount: parseFloat(exp.amount),
          description: exp.description
        })),
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

      onUpdatePrefinancing(editingPrefinancing.id, updates);
      resetForm();
      return;
    }

    // Si c'est une nouvelle demande
    const newPrefinancing: Omit<Prefinancing, 'id'> = {
      prefinancingNumber,
      grantId: formData.grantId,
      budgetLineId: formData.budgetLineId || undefined,
      subBudgetLineId: formData.subBudgetLineId || undefined,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      expectedRepaymentDate: formData.expectedRepaymentDate,
      purpose: formData.purpose,
      targetBankAccount: formData.targetBankAccount || undefined,
      targetGrant: formData.targetGrant || undefined,
      status: 'pending',
      expenses: validExpenses.map(exp => ({
        supplier: exp.supplier,
        invoiceNumber: exp.invoiceNumber,
        amount: parseFloat(exp.amount),
        description: exp.description
      })),
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
      },
      repayments: []
    };

    onAddPrefinancing(newPrefinancing);
    resetForm();
  };

  const handleRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPrefinancing || !repaymentData.amount || !repaymentData.reference) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir le montant et la référence du remboursement');
      return;
    }

    onAddPrefinancingRepayment(selectedPrefinancing.id, {
      date: repaymentData.date,
      amount: parseFloat(repaymentData.amount),
      reference: repaymentData.reference
    });

    resetRepaymentForm();
  };

  const addExpense = () => {
    setExpenses([...expenses, { supplier: '', invoiceNumber: '', amount: '', description: '' }]);
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const updateExpense = (index: number, field: string, value: string) => {
    const newExpenses = [...expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setExpenses(newExpenses);
  };

  const getBudgetLine = (budgetLineId: string) => {
    return budgetLines.find(line => line.id === budgetLineId);
  };

  const getGrant = (grantId: string) => {
    return grants.find(grant => grant.id === grantId);
  };

  const getBankAccount = (accountId: string) => {
    return bankAccounts.find(account => account.id === accountId);
  };

  const updatePrefinancingStatus = (prefinancingId: string, newStatus: Prefinancing['status']) => {
    onUpdatePrefinancing(prefinancingId, { status: newStatus });
  };

  const getTotalRepaid = (prefinancing: Prefinancing) => {
    return prefinancing.repayments?.reduce((sum, repayment) => sum + repayment.amount, 0) || 0;
  };

  const getRemainingAmount = (prefinancing: Prefinancing) => {
    return prefinancing.amount - getTotalRepaid(prefinancing);
  };

  const getGrantBankBalance = (grantId: string) => {
    const grant = grants.find(g => g.id === grantId);
    return grant ? grant.totalAmount * 0.3 : 0;
  };

  const getPurposeLabel = (purpose: Prefinancing['purpose']) => {
    switch (purpose) {
      case 'other_accounts': return 'Autres comptes bancaires';
      case 'between_grants': return 'Entre subventions';
      default: return purpose;
    }
  };

  const exportPrefinancingForm = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      // Générer le contenu principal (première page)
      const mainContent = generateMainPDFContent();
      const tempMainDiv = document.createElement('div');
      tempMainDiv.innerHTML = mainContent;
      document.body.appendChild(tempMainDiv);

      const mainCanvas = await html2canvas(tempMainDiv, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      document.body.removeChild(tempMainDiv);

      const mainImgData = mainCanvas.toDataURL('image/png');
      const mainImgWidth = pageWidth - (margin * 2);
      const mainImgHeight = (mainCanvas.height * mainImgWidth) / mainCanvas.width;

      // Ajouter la première page avec le contenu principal
      pdf.addImage(mainImgData, 'PNG', margin, margin, mainImgWidth, mainImgHeight);

      // Générer le contenu des signatures (deuxième page)
      const signatureContent = generateSignaturePDFContent();
      const tempSignatureDiv = document.createElement('div');
      tempSignatureDiv.innerHTML = signatureContent;
      document.body.appendChild(tempSignatureDiv);

      const signatureCanvas = await html2canvas(tempSignatureDiv, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      document.body.removeChild(tempSignatureDiv);

      const signatureImgData = signatureCanvas.toDataURL('image/png');
      const signatureImgWidth = pageWidth - (margin * 2);
      const signatureImgHeight = (signatureCanvas.height * signatureImgWidth) / signatureCanvas.width;

      // Ajouter une deuxième page pour les signatures
      pdf.addPage();
      pdf.addImage(signatureImgData, 'PNG', margin, margin, signatureImgWidth, signatureImgHeight);

      // Télécharger le PDF
      pdf.save(`prefinancement-${formData.purpose}-${new Date().getTime()}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      showValidationError('Erreur', 'Impossible de générer le PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateMainPDFContent = () => {
    const selectedGrant = getSelectedGrant();
    const targetBankAccount = formData.targetBankAccount ? getBankAccount(formData.targetBankAccount) : null;
    const targetGrant = formData.targetGrant ? getGrant(formData.targetGrant) : null;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2c5aa0;">
          <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">DEMANDE DE PRÉFINANCEMENT</h1>
          <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${getPurposeLabel(formData.purpose)}</h2>
          <p>Date de la demande: ${new Date(formData.date).toLocaleDateString('fr-FR')}</p>
        </div>
        
        <!-- Informations de la Subvention Source -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Subvention Source
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Subvention:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${selectedGrant?.name || 'Non spécifié'} (${selectedGrant?.reference || 'N/A'})
              </div>
            </div>
            <div>
              <strong>Compte bancaire source:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${selectedGrant?.bankAccount?.name || 'Non spécifié'} - ${selectedGrant?.bankAccount?.bankName || 'N/A'}
              </div>
            </div>
            <div>
              <strong>Devise:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${selectedGrant?.currency || 'N/A'}
              </div>
            </div>
            <div>
              <strong>Solde bancaire estimé:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatCurrency(getGrantBankBalance(formData.grantId), formData.grantId)}
              </div>
            </div>
          </div>
        </div>

        <!-- Informations du Préfinancement -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Détails du Préfinancement
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Objet:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${getPurposeLabel(formData.purpose)}
              </div>
            </div>
            <div>
              <strong>Montant demandé:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatCurrency(parseFloat(formData.amount || '0'), formData.grantId)}
              </div>
            </div>
            <div>
              <strong>Date prévisionnelle de remboursement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${new Date(formData.expectedRepaymentDate).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>Description:</strong>
            <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff; min-height: 60px;">
              ${formData.description}
            </div>
          </div>

          <!-- Destination spécifique -->
          ${formData.purpose === 'other_accounts' && targetBankAccount ? `
          <div>
            <strong>Compte bancaire de destination:</strong>
            <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
              ${targetBankAccount.name} - ${targetBankAccount.bankName} (${targetBankAccount.accountNumber})
            </div>
          </div>
          ` : ''}

          ${formData.purpose === 'between_grants' && targetGrant ? `
          <div>
            <strong>Subvention de destination:</strong>
            <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
              ${targetGrant.name} (${targetGrant.reference}) - ${targetGrant.currency}
            </div>
          </div>
          ` : ''}
        </div>

        <!-- Dépenses Concernées -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Dépenses Concernées
          </h3>
          ${expenses.filter(exp => exp.supplier && exp.invoiceNumber && exp.amount).map((expense, index) => `
            <div style="margin-bottom: 15px; padding: 15px; border: 1px solid #eee; border-radius: 6px; background: #fff;">
              <h4 style="color: #555; margin-bottom: 10px;">Dépense ${index + 1}</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <strong>Fournisseur:</strong>
                  <div style="border: 1px solid #ccc; padding: 6px; margin: 3px 0; border-radius: 3px; background: #f9f9f9;">
                    ${expense.supplier}
                  </div>
                </div>
                <div>
                  <strong>N° Facture:</strong>
                  <div style="border: 1px solid #ccc; padding: 6px; margin: 3px 0; border-radius: 3px; background: #f9f9f9;">
                    ${expense.invoiceNumber}
                  </div>
                </div>
                <div>
                  <strong>Montant:</strong>
                  <div style="border: 1px solid #ccc; padding: 6px; margin: 3px 0; border-radius: 3px; background: #f9f9f9;">
                    ${formatCurrency(parseFloat(expense.amount || '0'), formData.grantId)}
                  </div>
                </div>
                ${expense.description ? `
                <div>
                  <strong>Description:</strong>
                  <div style="border: 1px solid #ccc; padding: 6px; margin: 3px 0; border-radius: 3px; background: 'f9f9f9;">
                    ${expense.description}
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #2c5aa0; text-align: center; font-size: 12px; color: #777;">
          <p>Page 1/2 - Document généré le ${new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          <p>Demande de préfinancement - ${getPurposeLabel(formData.purpose)}</p>
        </div>
      </div>
    `;
  };

  const generateSignaturePDFContent = () => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; padding-top: 50px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">SIGNATURES D'APPROBATION</h1>
          <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${getPurposeLabel(formData.purpose)}</h2>
        </div>
        
        <!-- Signatures -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Signatures d'Approbation
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div style="border: 1px solid #ccc; padding: 20px; text-align: center; min-height: 150px; border-radius: 8px; background: #fff;">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordinateur de la subvention</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px; min-height: 40px; background: #f9f9f9;">
                ${approvals.supervisor1.name || '_________________________'}
              </div>
              <p>Date: ${approvals.supervisor1.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.supervisor1.signature ? '✅ Validée' : '◻ Non validée'}</p>
            </div>
            
            <div style="border: 1px solid #ccc; padding: 20px; text-align: center; min-height: 150px; border-radius: 8px; background: #fff;">
              <h4 style="font-size: 14px; color: '555; margin-bottom: 15px;">Comptable</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px; min-height: 40px; background: #f9f9f9;">
                ${approvals.supervisor2.name || '_________________________'}
              </div>
              <p>Date: ${approvals.supervisor2.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.supervisor2.signature ? '✅ Validée' : '◻ Non validée'}</p>
            </div>
            
            <div style="border: 1px solid #ccc; padding: 20px; text-align: center; min-height: 150px; border-radius: 8px; background: #fff;">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordonnateur national</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px; min-height: 40px; background: #f9f9f9;">
                ${approvals.finalApproval.name || '_________________________'}
              </div>
              <p>Date: ${approvals.finalApproval.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.finalApproval.signature ? '✅ Validée' : '◻ Non validée'}</p>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #2c5aa0; text-align: center; font-size: 12px; color: #777;">
          <p>Page 2/2 - Signatures d'approbation</p>
          <p>Demande de préfinancement - ${getPurposeLabel(formData.purpose)}</p>
        </div>
      </div>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Préfinancements</h2>
          <p className="text-gray-600 mt-1">Avances de trésorerie et suivi des remboursements</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Préfinancement</span>
        </button>
      </div>

      {/* Information sur la subvention active */}
      {grants.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Subvention Active</h3>
              <p className="text-sm text-gray-600">{grants[0].name} ({grants[0].reference})</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Devise</p>
              <p className="text-sm font-bold text-blue-600">
                {grants[0].currency} ({grants[0].currency === 'EUR' ? '€' : grants[0].currency === 'USD' ? '$' : 'CFA'})
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
              <p className="text-sm font-medium text-gray-600">Total Préfinancements</p>
              <p className="text-2xl font-bold text-blue-600">{prefinancings.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ArrowRightLeft className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Remboursés</p>
              <p className="text-2xl font-bold text-yellow-600">
                {prefinancings.filter(p => p.status === 'repaid').length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Reste à rembourser</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  prefinancings
                    .filter(p => p.status === 'paid' && getRemainingAmount(p) > 0)
                    .reduce((sum, p) => sum + getRemainingAmount(p), 0)
                )}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPrefinancing ? 'Modifier le Préfinancement' : 'Nouvelle Demande de Préfinancement'}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportPrefinancingForm}
                  disabled={isGeneratingPDF}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Exporter en PDF"
                >
                  {isGeneratingPDF ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations Générales</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subvention *
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
                      {getSelectedGrant() ? `${getSelectedGrant()?.name} (${getSelectedGrant()?.reference})` : 'Aucune subvention sélectionnée'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Subvention active présélectionnée automatiquement
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compte bancaire source *
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
                      {getSelectedGrant()?.bankAccount ? 
                        `${getSelectedGrant()?.bankAccount?.name} - ${getSelectedGrant()?.bankAccount?.bankName}` : 
                        'Aucun compte bancaire associé'
                      }
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Compte bancaire de la subvention active
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ligne budgétaire (optionnel)
                    </label>
                    <select
                      value={formData.budgetLineId}
                      onChange={(e) => setFormData(prev => ({ ...prev, budgetLineId: e.target.value, subBudgetLineId: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Aucune ligne budgétaire</option>
                      {budgetLines.filter(line => line.grantId === formData.grantId).map(line => (
                        <option key={line.id} value={line.id}>
                          {line.code} - {line.name}
                        </option>
                      ))}
                    </select>
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
                      {subBudgetLines.filter(line => line.budgetLineId === formData.budgetLineId).map(line => (
                        <option key={line.id} value={line.id}>
                          {line.code} - {line.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Informations de la subvention source */}
                {formData.grantId && (
                  <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2">Subvention Source</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Nom:</span>
                        <span className="ml-2 font-medium">{getSelectedGrant()?.name}</span>
                      </div>
                      <div>
                        <span className="text-blue-700">Solde bancaire estimé:</span>
                        <span className="ml-2 font-medium text-green-600">
                          {formatCurrency(getGrantBankBalance(formData.grantId), formData.grantId)}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Devise:</span>
                        <span className="ml-2 font-medium">{getSelectedGrant()?.currency}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Destination du préfinancement */}
                <div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Objet du préfinancement *
                    </label>
                    <select
                      value={formData.purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value as Prefinancing['purpose'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="specific_expenses">Dépenses spécifiques</option>
                      <option value="other_accounts">Avance vers autres comptes bancaires</option>
                      <option value="between_grants">Transfert entre subventions</option>
                    </select>
                  </div>

                  <div className="mt-4">
                    {formData.purpose === 'other_accounts' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Compte bancaire de destination *
                        </label>
                        <select
                          value={formData.targetBankAccount}
                          onChange={(e) => setFormData(prev => ({ ...prev, targetBankAccount: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Sélectionner un compte</option>
                          {bankAccounts.map(account => (
                            <option key={account.id} value={account.id}>
                              {account.name} - {account.bankName}
                            </option>
                          ))}
                        </select>
                      </div>

                    ) : formData.purpose === 'between_grants' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subvention de destination *
                        </label>
                        <select
                          value={formData.targetGrant}
                          onChange={(e) => setFormData(prev => ({ ...prev, targetGrant: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Sélectionner une subvention</option>
                          {grants.filter(grant => grant.id !== formData.grantId).map(grant => (
                            <option key={grant.id} value={grant.id}>
                              {grant.name} ({grant.reference})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant demandé ({getSelectedGrant()?.currency === 'EUR' ? '€' : 
                         getSelectedGrant()?.currency === 'USD' ? '$' : 'CFA'})*
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
                    placeholder="Description détaillée du préfinancement..."
                    required
                  />
                </div>
              </div>

              {/* Expenses List */}
              <div className="bg-orange-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">Dépenses Concernées</h4>
                  <button
                    type="button"
                    onClick={addExpense}
                    className="bg-orange-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-orange-700 transition-colors"
                  >
                    + Ajouter une dépense
                  </button>
                </div>

                {expenses.map((expense, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 mb-4 border border-orange-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fournisseur *
                        </label>
                        <input
                          type="text"
                          value={expense.supplier}
                          onChange={(e) => updateExpense(index, 'supplier', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Nom du fournisseur"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          N° Facture *
                        </label>
                        <input
                          type="text"
                          value={expense.invoiceNumber}
                          onChange={(e) => updateExpense(index, 'invoiceNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="FAC-2024-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Montant ({getSelectedGrant()?.currency === 'EUR' ? '€' : 
                             getSelectedGrant()?.currency === 'USD' ? '$' : 'CFA'})*
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expense.amount}
                            onChange={(e) => updateExpense(index, 'amount', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeExpense(index)}
                          className="w-full bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors"
                          disabled={expenses.length === 1}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={expense.description}
                        onChange={(e) => updateExpense(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Description de la dépense"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Signatures */}
              <div className="bg-yellow-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Signatures d'Approbation</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800">Coordinateur de la Subvention</h5>
                    <input
                      type="text"
                      placeholder="Nom du responsable"
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
                    <h5 className="font-medium text-gray-800">Comptable</h5>
                    <input
                      type="text"
                      placeholder="Nom du responsable"
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
                    <h5 className="font-medium text-gray-800">Coordonnateur National </h5>
                    <input
                      type="text"
                      placeholder="Responsable entreprise"
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
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200"
                >
                  Enregistrer le Préfinancement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Form Modal */}
      {showRepaymentForm && selectedPrefinancing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Enregistrer un Remboursement
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Préfinancement: {selectedPrefinancing.prefinancingNumber}
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
                    max={getRemainingAmount(selectedPrefinancing)}
                    value={repaymentData.amount}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {getGrant(selectedPrefinancing.grantId)?.currency === 'EUR' ? '€' : 
                     getGrant(selectedPrefinancing.grantId)?.currency === 'USD' ? '$' : 'CFA'}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Restant à rembourser: {formatCurrency(getRemainingAmount(selectedPrefinancing), selectedPrefinancing.grantId)}
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
                  placeholder="Ex: REMB-PRE-2024-001"
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

      {/* Prefinancings List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {prefinancings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <ArrowRightLeft className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun préfinancement</h3>
            <p className="text-gray-500 mb-4">Commencez par créer votre première demande de préfinancement</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Nouveau Préfinancement
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Préfinancement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Objet
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remboursement prévu
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
                {prefinancings.map(prefinancing => {
                  const budgetLine = getBudgetLine(prefinancing.budgetLineId);
                  const grant = getGrant(prefinancing.grantId);
                  const totalRepaid = getTotalRepaid(prefinancing);
                  const remainingAmount = getRemainingAmount(prefinancing);
                  
                  return (
                    <tr key={prefinancing.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{prefinancing.prefinancingNumber}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(prefinancing.date).toLocaleDateString('fr-FR')}
                          </div>
                          <div className="text-sm text-gray-500">{budgetLine?.name || 'Aucune ligne budgétaire'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{getPurposeLabel(prefinancing.purpose)}</div>
                        <div className="text-sm text-gray-500">{prefinancing.description}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(prefinancing.amount, prefinancing.grantId)}
                        {totalRepaid > 0 && (
                          <div className="text-sm text-gray-500">
                            Restant: {formatCurrency(remainingAmount, prefinancing.grantId)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {new Date(prefinancing.expectedRepaymentDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <select
                          value={prefinancing.status}
                          onChange={(e) => updatePrefinancingStatus(prefinancing.id, e.target.value as Prefinancing['status'])}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${PREFINANCING_STATUS[prefinancing.status].color}`}
                        >
                          <option value="pending">En attente</option>
                          <option value="approved">Approuvé</option>
                          <option value="paid">Décaissé</option>
                          <option value="repaid">Remboursé</option>
                          <option value="rejected">Rejeté</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {prefinancing.status === 'paid' && remainingAmount > 0 && (
                            <button
                              onClick={() => {
                                setSelectedPrefinancing(prefinancing);
                                setShowRepaymentForm(true);
                              }}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Ajouter un remboursement"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleEditPrefinancing(prefinancing)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier le préfinancement"
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

export default PrefinancingManager;