import React, { useState, useEffect } from 'react';
import { X, Save, CreditCard, User, CheckCircle, AlertTriangle, FileText, Truck, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { showValidationError, showSuccess, showWarning } from '../utils/alerts';
import { BudgetLine, SubBudgetLine, Grant, Engagement, Payment, BankAccount } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

interface PaymentFormProps {
  engagement: Engagement;
  subBudgetLine: SubBudgetLine;
  budgetLine: BudgetLine;
  grant: Grant;
  bankAccounts: BankAccount[];
  existingPayments: Payment[];
  onSave: (payment: Omit<Payment, 'id'>) => void;
  onSign: (paymentId: string, updates: Partial<Payment>) => void;
  onCancel: () => void;
  editingPayment?: Payment | null;
}

export default function PaymentForm({
  engagement,
  subBudgetLine,
  budgetLine,
  grant,
  bankAccounts,
  existingPayments,
  onSave,
  onSign,
  onCancel,
  editingPayment
}: PaymentFormProps) {
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserProfession, setCurrentUserProfession] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const currency = grant.currency || 'EUR';

  // HOOKS D'AUTHENTIFICATION ET PERMISSIONS
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  const { user: currentUser, userProfile } = useAuth();

  // Récupérer les informations de l'utilisateur connecté depuis useAuth
  useEffect(() => {
    if (userProfile) {
      setCurrentUserName(`${userProfile.firstName} ${userProfile.lastName}`);
      setCurrentUserProfession(userProfile.profession || '');
    }
  }, [userProfile]);

  const [formData, setFormData] = useState({
    paymentNumber: '',
    amount: engagement.amount.toString(),
    description: `Paiement pour ${engagement.description}`,
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'check' as Payment['paymentMethod'],
    checkNumber: '',
    bankReference: '',
    invoiceNumber: '',
    invoiceAmount: engagement.amount.toString(),
    quoteReference: engagement.quoteReference || '',
    deliveryNote: '',
    purchaseOrderNumber: '',
    serviceAcceptance: false,
    controlNotes: '',
  });

  const [approvals, setApprovals] = useState({
    supervisor1: { name: '', signature: false, observation: '' },
    supervisor2: { name: '', signature: false, observation: '' },
    finalApproval: { name: '', signature: false, observation: '' }
  });

  const [showObservations, setShowObservations] = useState({
    supervisor1: false,
    supervisor2: false,
    finalApproval: false
  });

  const canCreate = hasPermission('payments', 'create');
  const canEdit = hasPermission('payments', 'edit');

  // Fonctions pour gérer les signatures
  const canViewSignatureSection = (): boolean => {
    const signatureProfessions = ['Coordinateur de la Subvention', 'Comptable', 'Coordonnateur National'];
    return signatureProfessions.includes(currentUserProfession);
  };

  const canSignPayment = (signatureType: string): boolean => {
    const currentApprovals = approvals;
    
    // Vérification basée sur la profession et le type de signature
    const professionCanSign = 
      (signatureType === 'supervisor1' && currentUserProfession === 'Coordinateur de la Subvention') ||
      (signatureType === 'supervisor2' && currentUserProfession === 'Comptable') ||
      (signatureType === 'finalApproval' && currentUserProfession === 'Coordonnateur National');

    if (!professionCanSign) return false;

    // Vérifie que la signature n'est pas déjà apposée
    const existingApproval = currentApprovals[signatureType as keyof typeof currentApprovals];
    if (existingApproval?.signature) return false;

    // Pour le coordonnateur national, vérifier que les deux premiers ont signé
    if (signatureType === 'finalApproval') {
      const hasSupervisor1Signed = currentApprovals.supervisor1?.signature;
      const hasSupervisor2Signed = currentApprovals.supervisor2?.signature;
      
      if (!hasSupervisor1Signed || !hasSupervisor2Signed) {
        return false;
      }
    }

    return true;
  };

  // 🎯 NOUVELLE FONCTION : Pour signer un nouveau paiement (création)
  const handleSignNewPayment = (signatureType: string) => {
    const userProfession = currentUserProfession;
    const userName = currentUserName;
    
    // Vérifier que l'utilisateur peut signer (Coordonnateur National ne peut pas signer en création)
    if (signatureType === 'finalApproval') {
      showWarning('Signature impossible', 'Le Coordonnateur National ne peut pas signer lors de la création d\'un paiement');
      return;
    }
    
    if (!userName) {
      showWarning('Nom manquant', 'Impossible de signer sans nom d\'utilisateur');
      return;
    }
    
    // Mettre à jour les approbations avec la signature
    setApprovals(prev => ({
      ...prev,
      [signatureType]: {
        name: userName,
        signature: true,
        observation: prev[signatureType as keyof typeof prev].observation,
        date: new Date().toISOString().split('T')[0]
      }
    }));
    
    showSuccess('Signature préparée', 'Votre signature sera enregistrée avec le nouveau paiement');
  };

  // 🎯 FONCTION MODIFIÉE : Pour signer un paiement existant (édition)
  const handleSignExistingPayment = (signatureType: string) => {
    if (!editingPayment || !editingPayment.id) {
      showWarning('Erreur', 'Paiement non trouvé pour la signature');
      return;
    }

    if (!canSignPayment(signatureType)) {
      if (signatureType === 'finalApproval') {
        showWarning('Signature impossible', 'Les signatures du Coordinateur de la Subvention et du Comptable sont requises avant votre signature');
      } else {
        showWarning('Permission refusée', 'Vous ne pouvez pas signer ce paiement');
      }
      return;
    }

    const updatedApproval = {
      name: currentUserName,
      date: new Date().toISOString().split('T')[0],
      signature: true,
      observation: approvals[signatureType as keyof typeof approvals].observation || ''
    };

    const newApprovalsState = {
      ...approvals,
      [signatureType]: updatedApproval
    };

    // Mettre à jour l'état local pour un retour visuel immédiat
    setApprovals(newApprovalsState);

    // Enregistrer la signature immédiatement pour un paiement existant
    onSign(editingPayment.id, { approvals: newApprovalsState });
    showSuccess('Signature enregistrée !');
  };

  // 🎯 FONCTION UNIFIÉE : Gère à la fois création et modification
  const handleSignPayment = (signatureType: string) => {
    if (editingPayment) {
      handleSignExistingPayment(signatureType);
    } else {
      handleSignNewPayment(signatureType);
    }
  };

  const toggleObservation = (signatureType: string) => {
    setShowObservations(prev => ({
      ...prev,
      [signatureType]: !prev[signatureType as keyof typeof showObservations]
    }));
  };

  useEffect(() => {
    if (editingPayment) {
      setFormData({
        paymentNumber: editingPayment.paymentNumber,
        amount: editingPayment.amount.toString(),
        description: editingPayment.description,
        date: editingPayment.date,
        paymentMethod: editingPayment.paymentMethod,
        checkNumber: editingPayment.checkNumber || '',
        bankReference: editingPayment.bankReference || '',
        invoiceNumber: editingPayment.invoiceNumber || '',
        invoiceAmount: editingPayment.invoiceAmount?.toString() || engagement.amount.toString(),
        quoteReference: editingPayment.quoteReference || engagement.quoteReference || '',
        deliveryNote: editingPayment.deliveryNote || '',
        purchaseOrderNumber: editingPayment.purchaseOrderNumber || '',
        serviceAcceptance: editingPayment.serviceAcceptance || false,
        controlNotes: editingPayment.controlNotes || '',
      });
      
      if (editingPayment.approvals) {
        setApprovals({
          supervisor1: editingPayment.approvals.supervisor1 || { name: '', signature: false, observation: '' },
          supervisor2: editingPayment.approvals.supervisor2 || { name: '', signature: false, observation: '' },
          finalApproval: editingPayment.approvals.finalApproval || { name: '', signature: false, observation: '' }
        });
      }
    } else {
      // Générer un numéro de paiement automatique
      const paymentNumber = `PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      setFormData(prev => ({ ...prev, paymentNumber }));
      
      // Auto-remplir le nom de l'utilisateur connecté dans les signatures correspondantes
      if (currentUserName && canViewSignatureSection()) {
        if (currentUserProfession === 'Coordinateur de la Subvention') {
          setApprovals(prev => ({
            ...prev,
            supervisor1: { ...prev.supervisor1, name: currentUserName }
          }));
        } else if (currentUserProfession === 'Comptable') {
          setApprovals(prev => ({
            ...prev,
            supervisor2: { ...prev.supervisor2, name: currentUserName }
          }));
        }
        // Note: Le Coordonnateur National n'est PAS auto-rempli lors de la création
      }
    }
  }, [editingPayment, engagement, currentUserName, currentUserProfession]);

  const validateForm = (): boolean => {
    // Validation des champs obligatoires
    if (!formData.amount || !formData.description || !formData.invoiceNumber) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir le montant, la description et le numéro de facture');
      return false;
    }

    // Validation du montant
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      showValidationError('Montant invalide', 'Le montant doit être un nombre positif');
      return false;
    }

    if (amount > engagement.amount) {
      showValidationError('Montant trop élevé', `Le montant ne peut pas dépasser ${formatAmount(engagement.amount)}`);
      return false;
    }

    // Validation de la trésorerie
    if (balanceAfterPayment < 0) {
      showValidationError('Solde insuffisant', 'Le solde disponible est insuffisant pour effectuer ce paiement');
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // 🎯 MODIFICATION IMPORTANTE : Préparation des données d'approbation
    // Pour les NOUVEAUX paiements, on enregistre seulement les signatures validées
    const approvalData: any = {};
    
    // Coordinateur de la Subvention - enregistré seulement si signé
    if (approvals.supervisor1.signature && approvals.supervisor1.name) {
      approvalData.supervisor1 = {
        name: approvals.supervisor1.name,
        date: new Date().toISOString().split('T')[0],
        signature: true,
        observation: approvals.supervisor1.observation
      };
    }
    
    // Comptable - enregistré seulement si signé
    if (approvals.supervisor2.signature && approvals.supervisor2.name) {
      approvalData.supervisor2 = {
        name: approvals.supervisor2.name,
        date: new Date().toISOString().split('T')[0],
        signature: true,
        observation: approvals.supervisor2.observation
      };
    }
    
    // Coordonnateur National - NE PEUT PAS signer lors de l'ajout
    // Pour les nouveaux paiements, on n'enregistre JAMAIS le Coordonnateur National
    if (editingPayment && approvals.finalApproval.signature && approvals.finalApproval.name) {
      approvalData.finalApproval = {
        name: approvals.finalApproval.name,
        date: new Date().toISOString().split('T')[0],
        signature: true,
        observation: approvals.finalApproval.observation
      };
    }

    const payment: Omit<Payment, 'id'> = {
      paymentNumber: formData.paymentNumber,
      engagementId: engagement.id,
      grantId: grant.id,
      budgetLineId: budgetLine.id,
      subBudgetLineId: subBudgetLine.id,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      supplier: engagement.supplier || '',
      paymentMethod: formData.paymentMethod,
      checkNumber: formData.checkNumber || undefined,
      bankReference: formData.bankReference || undefined,
      invoiceNumber: formData.invoiceNumber,
      invoiceAmount: parseFloat(formData.invoiceAmount),
      quoteReference: formData.quoteReference || undefined,
      deliveryNote: formData.deliveryNote || undefined,
      purchaseOrderNumber: formData.purchaseOrderNumber || undefined,
      serviceAcceptance: formData.serviceAcceptance,
      controlNotes: formData.controlNotes || undefined,
      status: 'pending',
      approvals: Object.keys(approvalData).length > 0 ? approvalData : undefined
    };

    onSave(payment);
  };

  // Calculs de trésorerie
  const totalBankBalance = bankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const uncashedPayments = existingPayments.filter(p => p.status === 'paid' && !p.cashedDate);
  const totalUncashedAmount = uncashedPayments.reduce((sum, p) => sum + p.amount, 0);
  const availableBeforePayment = totalBankBalance - totalUncashedAmount;
  const balanceAfterPayment = availableBeforePayment - parseFloat(formData.amount || '0');
  
  // Calculs sur la ligne budgétaire
  const linePayments = existingPayments.filter(p => p.subBudgetLineId === subBudgetLine.id && p.status === 'paid');
  const totalPaidOnLine = linePayments.reduce((sum, p) => sum + p.amount, 0);
  const newTotalPaidOnLine = totalPaidOnLine + parseFloat(formData.amount || '0');
  const disbursementRate = subBudgetLine.notifiedAmount > 0 ? (newTotalPaidOnLine / subBudgetLine.notifiedAmount) * 100 : 0;

  // Fonction pour formater les montants avec la devise de la subvention
  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: currency 
    });
  };

  const exportPaymentForm = async () => {
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
      pdf.save(`paiement-${formData.paymentNumber}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      showValidationError('Erreur', 'Impossible de générer le PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateMainPDFContent = () => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <!-- Header avec Logo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2c5aa0;">
          <div style="flex: 1;">
            <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">FICHE DE PAIEMENT</h1>
            <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${formData.paymentNumber}</h2>
            <p>Date: ${new Date(formData.date).toLocaleDateString('fr-FR')}</p>
          </div>
          <div style="width: 80px; height: 32px;">
            <img src="/budgetflow/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
        </div>
        
        <!-- Informations de l'Engagement -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Informations de l'Engagement
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>N° Engagement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${engagement.engagementNumber}
              </div>
            </div>
            <div>
              <strong>Ligne Budgétaire:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${budgetLine.code} - ${budgetLine.name}
              </div>
            </div>
            <div>
              <strong>Sous-ligne Budgétaire:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${subBudgetLine.code} - ${subBudgetLine.name}
              </div>
            </div>
            <div>
              <strong>Fournisseur:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${engagement.supplier}
              </div>
            </div>
            <div>
              <strong>Montant Engagé:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(engagement.amount)}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Analyse de Trésorerie -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Analyse de Trésorerie
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Solde total banques:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(totalBankBalance)}
              </div>
            </div>
            <div>
              <strong>Paiements non encaissés:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(totalUncashedAmount)}
              </div>
            </div>
            <div>
              <strong>Disponible avant paiement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(availableBeforePayment)}
              </div>
            </div>
            <div>
              <strong>Solde après paiement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(balanceAfterPayment)}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Détails du Paiement -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Détails du Paiement
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>N° de Paiement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.paymentNumber}
              </div>
            </div>
            <div>
              <strong>Date de Paiement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${new Date(formData.date).toLocaleDateString('fr-FR')}
              </div>
            </div>
            <div>
              <strong>Montant du Paiement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(parseFloat(formData.amount || '0'))}
              </div>
            </div>
            <div>
              <strong>Mode de Paiement:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.paymentMethod === 'check' ? 'Chèque' : formData.paymentMethod === 'transfer' ? 'Virement' : 'Espèces'}
              </div>
            </div>
            ${formData.checkNumber ? `
            <div>
              <strong>N° de Chèque:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.checkNumber}
              </div>
            </div>
            ` : ''}
            ${formData.bankReference ? `
            <div>
              <strong>Référence Bancaire:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.bankReference}
              </div>
            </div>
            ` : ''}
          </div>
          <div>
            <strong>Description:</strong>
            <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff; min-height: 60px;">
              ${formData.description}
            </div>
          </div>
        </div>
        
        <!-- Informations de Contrôle -->
        <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Informations de Contrôle
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>N° de Facture:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.invoiceNumber}
              </div>
            </div>
            <div>
              <strong>Montant de la Facture:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formatAmount(parseFloat(formData.invoiceAmount || '0'))}
              </div>
            </div>
            ${formData.quoteReference ? `
            <div>
              <strong>Référence du Devis:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.quoteReference}
              </div>
            </div>
            ` : ''}
            ${formData.deliveryNote ? `
            <div>
              <strong>N° Bon de Livraison:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.deliveryNote}
              </div>
            </div>
            ` : ''}
            ${formData.purchaseOrderNumber ? `
            <div>
              <strong>N° Bon de Commande:</strong>
              <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
                ${formData.purchaseOrderNumber}
              </div>
            </div>
            ` : ''}
          </div>
          <div>
            <strong>Service livré et accepté:</strong>
            <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff;">
              ${formData.serviceAcceptance ? 'Oui' : 'Non'}
            </div>
          </div>
          ${formData.controlNotes ? `
          <div style="margin-top: 15px;">
            <strong>Notes de contrôle:</strong>
            <div style="border: 1px solid #ccc; padding: 8px; margin: 5px 0; border-radius: 4px; background: #fff; min-height: 40px;">
              ${formData.controlNotes}
            </div>
          </div>
          ` : ''}
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
          <p>Fiche de paiement - ${formData.paymentNumber}</p>
        </div>
      </div>
    `;
  };

  const generateSignaturePDFContent = () => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; padding-top: 50px;">
        <!-- Header avec Logo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
          <div style="flex: 1;">
            <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">SIGNATURES D'APPROBATION</h1>
            <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${formData.paymentNumber}</h2>
          </div>
          <div style="width: 80px; height: 32px;">
            <img src="/budgetflow/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
        </div>
        
        <!-- Signatures -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Signatures d'Approbation
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div style="border: 1px solid #ccc; padding: 20px; text-align: center; min-height: 150px; border-radius: 8px; background: #fff;">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordinateur de la Subvention</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px; min-height: 40px; background: #f9f9f9;">
                ${approvals.supervisor1.name || '_________________________'}
              </div>
              <p>Date: ${approvals.supervisor1.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.supervisor1.signature ? '✅ Validée' : '◻ Non validée'}</p>
              ${approvals.supervisor1.observation ? `
              <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <strong style="font-size: 11px;">Observation:</strong>
                <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">${approvals.supervisor1.observation}</p>
              </div>
              ` : ''}
            </div>
            
            <div style="border: 1px solid #ccc; padding: 20px; text-align: center; min-height: 150px; border-radius: 8px; background: #fff;">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Comptable</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px; min-height: 40px; background: #f9f9f9;">
                ${approvals.supervisor2.name || '_________________________'}
              </div>
              <p>Date: ${approvals.supervisor2.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.supervisor2.signature ? '✅ Validée' : '◻ Non validée'}</p>
              ${approvals.supervisor2.observation ? `
              <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <strong style="font-size: 11px;">Observation:</strong>
                <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">${approvals.supervisor2.observation}</p>
              </div>
              ` : ''}
            </div>
            
            <div style="border: 1px solid #ccc; padding: 20px; text-align: center; min-height: 150px; border-radius: 8px; background: #fff;">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordonnateur national</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px; min-height: 40px; background: #f9f9f9;">
                ${approvals.finalApproval.name || '_________________________'}
              </div>
              <p>Date: ${approvals.finalApproval.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.finalApproval.signature ? '✅ Validée' : '◻ Non validée'}</p>
              ${approvals.finalApproval.observation ? `
              <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <strong style="font-size: 11px;">Observation:</strong>
                <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">${approvals.finalApproval.observation}</p>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #2c5aa0; text-align: center; font-size: 12px; color: #777;">
          <p>Page 2/2 - Signatures d'approbation</p>
          <p>Fiche de paiement - ${formData.paymentNumber}</p>
        </div>
      </div>
    `;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Fiche de Paiement</h2>
              <p className="text-gray-600">{editingPayment ? 'Modification' : 'Nouveau'} - {engagement.engagementNumber}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportPaymentForm}
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
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Engagement Info */}
        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Informations de l'Engagement</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-blue-700 font-medium">N° Engagement</p>
              <p className="text-blue-900 font-semibold">{engagement.engagementNumber}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Ligne Budgétaire</p>
              <p className="text-blue-900 font-semibold">{budgetLine.code} - {budgetLine.name}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Sous-ligne Budgétaire</p>
              <p className="text-blue-900 font-semibold">{subBudgetLine.code} - {subBudgetLine.name}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Fournisseur</p>
              <p className="text-blue-900 font-semibold">{engagement.supplier}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Montant Engagé</p>
              <p className="text-xl font-bold text-green-600">
                {formatAmount(engagement.amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Treasury Analysis */}
        <div className="bg-yellow-50 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analyse de Trésorerie</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800">Situation Bancaire</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Solde total banques:</span>
                  <span className="font-medium">{formatAmount(totalBankBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paiements non encaissés:</span>
                  <span className="font-medium text-orange-600">-{formatAmount(totalUncashedAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700 font-medium">Disponible avant paiement:</span>
                  <span className={`font-bold ${availableBeforePayment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(availableBeforePayment)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-800">Impact du Paiement</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant à payer:</span>
                  <span className="font-medium text-blue-600">{formatAmount(parseFloat(formData.amount || '0'))}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700 font-medium">Solde après paiement:</span>
                  <span className={`font-bold ${balanceAfterPayment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(balanceAfterPayment)}
                  </span>
                </div>
                {balanceAfterPayment < 0 && (
                  <div className="flex items-center space-x-1 text-red-600 text-xs">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Solde insuffisant</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-800">Sous-ligne Budgétaire</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Déjà décaissé:</span>
                  <span className="font-medium">{formatAmount(totalPaidOnLine)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nouveau total:</span>
                  <span className="font-medium text-purple-600">{formatAmount(newTotalPaidOnLine)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700 font-medium">Taux de décaissement:</span>
                  <span className={`font-bold ${disbursementRate > 100 ? 'text-red-600' : 'text-green-600'}`}>
                    {disbursementRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Details */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Détails du Paiement</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° de Paiement *
                </label>
                <input
                  type="text"
                  value={formData.paymentNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de Paiement *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant du Paiement ({currency})*
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={engagement.amount}
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
                  Mode de Paiement *
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as Payment['paymentMethod'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="check">Chèque</option>
                  <option value="transfer">Virement</option>
                  <option value="cash">Espèces</option>
                </select>
              </div>
            </div>

            {formData.paymentMethod === 'check' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° de Chèque
                </label>
                <input
                  type="text"
                  value={formData.checkNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 1234567"
                />
              </div>
            )}

            {formData.paymentMethod === 'transfer' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence Bancaire
                </label>
                <input
                  type="text"
                  value={formData.bankReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, bankReference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: VIR-2024-001"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Description du paiement..."
                required
              />
            </div>
          </div>

          {/* Control Information */}
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Informations de Contrôle
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° de Facture *
                </label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: FAC-2024-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant de la Facture ({currency})*
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.invoiceAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence du Devis
                </label>
                <input
                  type="text"
                  value={formData.quoteReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, quoteReference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: DEV-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° Bon de Livraison
                </label>
                <input
                  type="text"
                  value={formData.deliveryNote}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryNote: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: BL-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° Bon de Commande
                </label>
                <input
                  type="text"
                  value={formData.purchaseOrderNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseOrderNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: BC-2024-001"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.serviceAcceptance}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceAcceptance: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <Truck className="w-4 h-4 mr-1" />
                  Service livré et accepté
                </span>
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes de contrôle
              </label>
              <textarea
                value={formData.controlNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, controlNotes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Notes additionnelles pour le contrôle..."
              />
            </div>
          </div>

          {/* Signatures Section */}
          {canViewSignatureSection() && (
            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Signatures d'Approbation
                {!editingPayment && (
                  <span className="ml-2 text-sm font-normal text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    Mode création
                  </span>
                )}
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coordinateur de la Subvention */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">Coordinateur de la Subvention</h4>
                    {canSignPayment('supervisor1') && (
                      <button
                        type="button"
                        onClick={() => handleSignPayment('supervisor1')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        Signer
                      </button>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">Nom du signataire</label>
                    <input
                      type="text"
                      value={approvals.supervisor1.name}
                      onChange={(e) => !editingPayment && setApprovals(prev => ({
                        ...prev,
                        supervisor1: { ...prev.supervisor1, name: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        editingPayment || approvals.supervisor1.signature ? 'bg-gray-100' : ''
                      }`}
                      disabled={editingPayment || approvals.supervisor1.signature}
                      placeholder={currentUserProfession === 'Coordinateur de la Subvention' ? currentUserName : "Nom du coordinateur"}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={approvals.supervisor1.signature}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor1: { ...prev.supervisor1, signature: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={true} // La case est gérée par le bouton "Signer"
                      />
                      <span className="text-sm text-gray-700">
                        {approvals.supervisor1.signature ? '✅ Signature validée' : 'Signature en attente'}
                      </span>
                    </label>
                    
                    <button
                      type="button"
                      onClick={() => toggleObservation('supervisor1')}
                      className="text-blue-600 text-sm hover:text-blue-800 flex items-center space-x-1"
                    >
                      <span>Observation</span>
                      {showObservations.supervisor1 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {showObservations.supervisor1 && (
                    <div className="mt-3">
                      <textarea
                        value={approvals.supervisor1.observation}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor1: { ...prev.supervisor1, observation: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        placeholder="Saisissez votre observation..."
                        disabled={approvals.supervisor1.signature}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {approvals.supervisor1.signature 
                          ? "Observation verrouillée après signature" 
                          : "Cette observation sera enregistrée avec votre signature"
                        }
                      </p>
                    </div>
                  )}
                  
                  {approvals.supervisor1.signature && (
                    <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-700">
                        ✅ Prêt à être signé avec le paiement
                      </p>
                    </div>
                  )}
                </div>

                {/* Comptable */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">Comptable</h4>
                    {canSignPayment('supervisor2') && (
                      <button
                        type="button"
                        onClick={() => handleSignPayment('supervisor2')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        Signer
                      </button>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">Nom du signataire</label>
                    <input
                      type="text"
                      value={approvals.supervisor2.name}
                      onChange={(e) => !editingPayment && setApprovals(prev => ({
                        ...prev,
                        supervisor2: { ...prev.supervisor2, name: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        editingPayment || approvals.supervisor2.signature ? 'bg-gray-100' : ''
                      }`}
                      disabled={editingPayment || approvals.supervisor2.signature}
                      placeholder={currentUserProfession === 'Comptable' ? currentUserName : "Nom du comptable"}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={approvals.supervisor2.signature}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor2: { ...prev.supervisor2, signature: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={true}
                      />
                      <span className="text-sm text-gray-700">
                        {approvals.supervisor2.signature ? '✅ Signature validée' : 'Signature en attente'}
                      </span>
                    </label>
                    
                    <button
                      type="button"
                      onClick={() => toggleObservation('supervisor2')}
                      className="text-blue-600 text-sm hover:text-blue-800 flex items-center space-x-1"
                    >
                      <span>Observation</span>
                      {showObservations.supervisor2 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {showObservations.supervisor2 && (
                    <div className="mt-3">
                      <textarea
                        value={approvals.supervisor2.observation}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor2: { ...prev.supervisor2, observation: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        placeholder="Saisissez votre observation..."
                        disabled={approvals.supervisor2.signature}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {approvals.supervisor2.signature 
                          ? "Observation verrouillée après signature" 
                          : "Cette observation sera enregistrée avec votre signature"
                        }
                      </p>
                    </div>
                  )}
                  
                  {approvals.supervisor2.signature && (
                    <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-700">
                        ✅ Prêt à être signé avec le paiement
                      </p>
                    </div>
                  )}
                </div>

                {/* Coordonnateur National */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">Coordonnateur National</h4>
                    {canSignPayment('finalApproval') && (
                      <button
                        type="button"
                        onClick={() => handleSignPayment('finalApproval')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        Signer
                      </button>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">Nom du signataire</label>
                    <input
                      type="text"
                      value={approvals.finalApproval.name}
                      onChange={(e) => !editingPayment && setApprovals(prev => ({
                        ...prev,
                        finalApproval: { ...prev.finalApproval, name: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        editingPayment || approvals.finalApproval.signature ? 'bg-gray-100' : ''
                      }`}
                      disabled={editingPayment || approvals.finalApproval.signature || !editingPayment}
                      placeholder={currentUserProfession === 'Coordonnateur National' ? currentUserName : "Nom du coordonnateur"}
                    />
                  </div>
                  
                  {!editingPayment && (
                    <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-700">
                        ℹ️ Le Coordonnateur National ne peut signer qu'après la création du paiement
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={approvals.finalApproval.signature}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          finalApproval: { ...prev.finalApproval, signature: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={true}
                      />
                      <span className="text-sm text-gray-700">
                        {approvals.finalApproval.signature ? '✅ Signature validée' : 'Signature en attente'}
                      </span>
                    </label>
                    
                    <button
                      type="button"
                      onClick={() => toggleObservation('finalApproval')}
                      className="text-blue-600 text-sm hover:text-blue-800 flex items-center space-x-1"
                      disabled={!editingPayment}
                    >
                      <span>Observation</span>
                      {showObservations.finalApproval ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {showObservations.finalApproval && (
                    <div className="mt-3">
                      <textarea
                        value={approvals.finalApproval.observation}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          finalApproval: { ...prev.finalApproval, observation: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        placeholder="Saisissez votre observation..."
                        disabled={approvals.finalApproval.signature || !editingPayment}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {!editingPayment 
                          ? "Observations disponibles après création" 
                          : approvals.finalApproval.signature 
                            ? "Observation verrouillée après signature" 
                            : "Cette observation sera enregistrée avec votre signature"
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Information sur le comportement des signatures */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Comportement des signatures :</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Coordinateur & Comptable</strong> : Peuvent signer dès la création</li>
                  <li>• <strong>Coordonnateur National</strong> : Ne peut signer qu'après création</li>
                  <li>• Les noms ne sont enregistrés que si la signature est validée</li>
                  <li>• Les observations sont verrouillées après signature</li>
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{editingPayment ? 'Modifier' : 'Enregistrer'} le Paiement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}