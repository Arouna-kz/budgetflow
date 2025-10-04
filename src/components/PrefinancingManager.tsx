import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Edit, Trash2, FileText, Calendar, ArrowRightLeft, Download, Search, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Eye, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { showSuccess, showValidationError, showWarning } from '../utils/alerts';
import { Prefinancing, BudgetLine, Grant, PREFINANCING_STATUS, BankAccount, SubBudgetLine } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import { usePrefinancingNotifications } from '../hooks/usePrefinancingNotifications';

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
  // HOOKS D'AUTHENTIFICATION ET PERMISSIONS
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  const { user: currentUser, userProfile, userRole } = useAuth();

  // HOOK DE NOTIFICATIONS POUR LES PRÉFINANCEMENTS
  const { notificationCount, hasNotifications} = usePrefinancingNotifications(prefinancings);

  // ÉTATS PRINCIPAUX
  const [showForm, setShowForm] = useState(false);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [selectedPrefinancing, setSelectedPrefinancing] = useState<Prefinancing | null>(null);
  const [editingPrefinancing, setEditingPrefinancing] = useState<Prefinancing | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [viewingPrefinancing, setViewingPrefinancing] = useState<Prefinancing | null>(null);

  // ÉTATS POUR RECHERCHE, FILTRES ET PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<string>('prefinancingNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

  // ÉTATS DU FORMULAIRE
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
    supervisor1: { name: '', signature: false, observation: '' },
    supervisor2: { name: '', signature: false, observation: '' },
    finalApproval: { name: '', signature: false, observation: '' }
  });

  const [showObservations, setShowObservations] = useState({
    supervisor1: false,
    supervisor2: false,
    finalApproval: false
  });

  // FONCTIONS UTILITAIRES POUR LES RÔLES ET SIGNATURES
  const getUserFullName = (): string => {
    if (!userProfile) return '';
    if (userProfile.firstName && userProfile.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`.trim();
    }
    return userProfile.email;
  };

  const getUserProfession = (): string => {
    return userProfile?.profession || '';
  };

  const canViewSignatureSection = (): boolean => {
    const signatureProfessions = ['Coordinateur de la Subvention', 'Comptable', 'Coordonnateur National'];
    return signatureProfessions.includes(getUserProfession());
  };

  const canSignPrefinancing = (prefinancing: Prefinancing | null, signatureType: string): boolean => {
    if (!prefinancing && signatureType === 'finalApproval') {
      return false;
    }
    
    const currentApprovals = prefinancing ? prefinancing.approvals : approvals;
    
    if (!currentApprovals) {
      return false;
    }
    
    const userProfession = getUserProfession();
    
    // Vérification basée sur la profession et le type de signature
    const professionCanSign = 
      (signatureType === 'supervisor1' && userProfession === 'Coordinateur de la Subvention') ||
      (signatureType === 'supervisor2' && userProfession === 'Comptable') ||
      (signatureType === 'finalApproval' && userProfession === 'Coordonnateur National');

    if (!professionCanSign) return false;

    // Vérifie que la signature n'est pas déjà apposée
    const existingApproval = currentApprovals[signatureType as keyof typeof currentApprovals];
    if (existingApproval?.signature) return false;

    // Pour le signataire final, vérifier que les deux premiers ont signé
    if (signatureType === 'finalApproval') {
      const hasSupervisor1Signed = currentApprovals.supervisor1?.signature;
      const hasSupervisor2Signed = currentApprovals.supervisor2?.signature;
      
      if (!prefinancing) return false;
      
      if (!hasSupervisor1Signed || !hasSupervisor2Signed) {
        return false;
      }
    }

    return true;
  };

  const getPendingSignatures = (): Prefinancing[] => {
    const userProfession = getUserProfession();
    
    return prefinancings.filter(prefinancing => {
      if (userProfession === 'Coordinateur de la Subvention') {
        return !prefinancing.approvals?.supervisor1?.signature;
      } else if (userProfession === 'Comptable') {
        return !prefinancing.approvals?.supervisor2?.signature;
      } else if (userProfession === 'Coordonnateur National') {
        const hasSupervisor1Signed = prefinancing.approvals?.supervisor1?.signature;
        const hasSupervisor2Signed = prefinancing.approvals?.supervisor2?.signature;
        const hasFinalSigned = prefinancing.approvals?.finalApproval?.signature;
        return hasSupervisor1Signed && hasSupervisor2Signed && !hasFinalSigned;
      }
      return false;
    });
  };

  const handleSignPrefinancing = (prefinancing: Prefinancing | null, signatureType: string) => {
    if (!canSignPrefinancing(prefinancing, signatureType)) {
      showWarning('Permission refusée', 'Vous ne pouvez pas signer ce préfinancement');
      return;
    }

    if (prefinancing) {
      // Cas d'un préfinancement existant (édition)
      const updates: Partial<Prefinancing> = {
        approvals: { ...prefinancing.approvals }
      };

      const signatureData = {
        name: getUserFullName(),
        date: new Date().toISOString().split('T')[0],
        signature: true,
        observation: approvals[signatureType as keyof typeof approvals]?.observation || ''
      };

      if (signatureType === 'supervisor1') {
        updates.approvals!.supervisor1 = signatureData;
      } else if (signatureType === 'supervisor2') {
        updates.approvals!.supervisor2 = signatureData;
      } else if (signatureType === 'finalApproval') {
        updates.approvals!.finalApproval = signatureData;
      }

      onUpdatePrefinancing(prefinancing.id, updates);
      showSuccess('Signature enregistrée', 'Votre signature a été enregistrée avec succès');
    } else {
      // Cas d'un nouveau préfinancement (création)
      const updatedApproval = {
        name: getUserFullName(),
        date: new Date().toISOString().split('T')[0],
        signature: true,
        observation: approvals[signatureType as keyof typeof approvals].observation
      };

      setApprovals(prev => ({
        ...prev,
        [signatureType]: updatedApproval
      }));
      
      showSuccess('Signature préparée', 'Votre signature sera enregistrée avec le nouveau préfinancement');
    }
    
    // Réinitialiser les observations après signature
    setApprovals(prev => ({
      ...prev,
      [signatureType]: { ...prev[signatureType as keyof typeof approvals], observation: '' }
    }));
  };

  // EFFET POUR PRÉ-REMPLIR LES NOMS DES SIGNATAIRES
  useEffect(() => {
    if (userProfile && canViewSignatureSection()) {
      const userName = getUserFullName();
      
      setApprovals(prev => {
        const newApprovals = { ...prev };
        const userProfession = getUserProfession();
        
        if (userProfession === 'Coordinateur de la Subvention') {
          newApprovals.supervisor1.name = userName;
        } else if (userProfession === 'Comptable') {
          newApprovals.supervisor2.name = userName;
        } else if (userProfession === 'Coordonnateur National') {
          newApprovals.finalApproval.name = userName;
        }
        
        return newApprovals;
      });
    }
  }, [userProfile]);

  // PERMISSIONS
  const canCreate = hasPermission('prefinancing', 'create');
  const canEdit = hasPermission('prefinancing', 'edit');
  const canDelete = hasPermission('prefinancing', 'delete');
  const canView = hasPermission('prefinancing', 'view');

  // Récupération des données utilisateur
  const userProfession = getUserProfession();
  const userFullName = getUserFullName();
  const pendingSignatures = getPendingSignatures();

  // FONCTIONS DE RECHERCHE ET FILTRAGE
  const filteredPrefinancings = prefinancings.filter(prefinancing => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      prefinancing.prefinancingNumber.toLowerCase().includes(searchLower) ||
      prefinancing.description.toLowerCase().includes(searchLower) ||
      (prefinancing.purpose && getPurposeLabel(prefinancing.purpose).toLowerCase().includes(searchLower));

    const matchesStatus = statusFilter === 'all' || prefinancing.status === statusFilter;
    const matchesDate = !dateFilter || prefinancing.expectedRepaymentDate === dateFilter;
    const matchesPurpose = purposeFilter === 'all' || prefinancing.purpose === purposeFilter;

    return matchesSearch && matchesStatus && matchesDate && matchesPurpose;
  });

  const sortedPrefinancings = [...filteredPrefinancings].sort((a, b) => {
    let aValue: any = a[sortField as keyof Prefinancing];
    let bValue: any = b[sortField as keyof Prefinancing];

    if (sortField === 'amount') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
    } else if (sortField === 'date' || sortField === 'expectedRepaymentDate') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // PAGINATION
  const totalPages = Math.ceil(sortedPrefinancings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPrefinancings = sortedPrefinancings.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    setExpandedRows({});
  };

  const goToPreviousPage = () => currentPage > 1 && goToPage(currentPage - 1);
  const goToNextPage = () => currentPage < totalPages && goToPage(currentPage + 1);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const toggleRowExpansion = (prefinancingId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [prefinancingId]: !prev[prefinancingId]
    }));
  };

  const truncateText = (text: string, maxLength: number = 30): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // FONCTIONS EXISTANTES ADAPTÉES
  const prefinancingNumber = `PRE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

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

  const getSelectedGrant = () => {
    return grants.find(grant => grant.id === formData.grantId);
  };

  const getPurposeLabel = (purpose: Prefinancing['purpose']) => {
    switch (purpose) {
      case 'other_accounts': return 'Autres comptes bancaires';
      case 'between_grants': return 'Entre subventions';
      default: return 'Dépenses spécifiques';
    }
  };

  const getSignatureIcon = (prefinancing: Prefinancing, signatureType: string) => {
    const approval = prefinancing.approvals?.[signatureType as keyof typeof prefinancing.approvals];
    if (approval?.signature) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const isSignatureRequired = (prefinancing: Prefinancing, signatureType: string): boolean => {
    const userProfession = getUserProfession();
    
    if (signatureType === 'supervisor1' && userProfession === 'Coordinateur de la Subvention') {
      return !prefinancing.approvals?.supervisor1?.signature;
    } else if (signatureType === 'supervisor2' && userProfession === 'Comptable') {
      return !prefinancing.approvals?.supervisor2?.signature;
    } else if (signatureType === 'finalApproval' && userProfession === 'Coordonnateur National') {
      const hasSupervisor1Signed = prefinancing.approvals?.supervisor1?.signature;
      const hasSupervisor2Signed = prefinancing.approvals?.supervisor2?.signature;
      return hasSupervisor1Signed && hasSupervisor2Signed && !prefinancing.approvals?.finalApproval?.signature;
    }
    return false;
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

  const getTotalRepaid = (prefinancing: Prefinancing) => {
    return prefinancing.repayments?.reduce((sum, repayment) => sum + repayment.amount, 0) || 0;
  };

  const getRemainingAmount = (prefinancing: Prefinancing) => {
    return prefinancing.amount - getTotalRepaid(prefinancing);
  };

  const updatePrefinancingStatus = (prefinancingId: string, newStatus: Prefinancing['status']) => {
    onUpdatePrefinancing(prefinancingId, { status: newStatus });
  };

  // RÉINITIALISATION DU FORMULAIRE
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
      supervisor1: { name: '', signature: false, observation: '' },
      supervisor2: { name: '', signature: false, observation: '' },
      finalApproval: { name: '', signature: false, observation: '' }
    });
    setShowObservations({
      supervisor1: false,
      supervisor2: false,
      finalApproval: false
    });
    setShowForm(false);
    setEditingPrefinancing(null);
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

  // GESTIONNAIRES D'ÉVÉNEMENTS EXISTANTS
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate && !editingPrefinancing) {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission de créer des préfinancements');
      return;
    }

    if (!canEdit && editingPrefinancing) {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission de modifier des préfinancements');
      return;
    }
    
    if (!formData.grantId || !formData.amount || !formData.description) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, le montant et la description');
      return;
    }

    const validExpenses = expenses.filter(exp => exp.supplier && exp.invoiceNumber && exp.amount);
    if (validExpenses.length === 0) {
      showValidationError('Dépenses manquantes', 'Veuillez ajouter au moins une dépense avec fournisseur, facture et montant');
      return;
    }

    // Préparation des données d'approbation
    const approvalData: any = {};
    
    if (approvals.supervisor1.name) {
      approvalData.supervisor1 = {
        name: approvals.supervisor1.name,
        date: new Date().toISOString().split('T')[0],
        signature: approvals.supervisor1.signature,
        observation: approvals.supervisor1.observation
      };
    }
    
    if (approvals.supervisor2.name) {
      approvalData.supervisor2 = {
        name: approvals.supervisor2.name,
        date: new Date().toISOString().split('T')[0],
        signature: approvals.supervisor2.signature,
        observation: approvals.supervisor2.observation
      };
    }
    
    if (approvals.finalApproval.name) {
      approvalData.finalApproval = {
        name: approvals.finalApproval.name,
        date: new Date().toISOString().split('T')[0],
        signature: approvals.finalApproval.signature,
        observation: approvals.finalApproval.observation
      };
    }

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
        approvals: approvalData
      };

      onUpdatePrefinancing(editingPrefinancing.id, updates);
      showSuccess('Préfinancement modifié', 'Le préfinancement a été modifié avec succès');
    } else {
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
        approvals: approvalData,
        repayments: []
      };

      onAddPrefinancing(newPrefinancing);
      showSuccess('Préfinancement créé', 'Le préfinancement a été créé avec succès');
    }

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

    showSuccess('Remboursement enregistré', 'Le remboursement a été enregistré avec succès');
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

  const toggleObservation = (signatureType: string) => {
    setShowObservations(prev => ({
      ...prev,
      [signatureType]: !prev[signatureType as keyof typeof showObservations]
    }));
  };

  // FONCTIONS D'EXPORT PDF (conservées de votre code original)
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

  const getGrantBankBalance = (grantId: string) => {
    const grant = grants.find(g => g.id === grantId);
    return grant ? grant.totalAmount * 0.3 : 0;
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
                ${formatCurrency(selectedGrant?.totalAmount || 0, formData.grantId)}
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
                ${formData.expectedRepaymentDate ? new Date(formData.expectedRepaymentDate).toLocaleDateString('fr-FR') : 'Non spécifiée'}
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
                  <div style="border: 1px solid #ccc; padding: 6px; margin: 3px 0; border-radius: 3px; background: #f9f9f9;">
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
              ${approvals.supervisor1.observation ? `
              <div style="margin-top: 10px;">
                <strong>Observation:</strong>
                <p style="font-size: 12px; color: #666;">${approvals.supervisor1.observation}</p>
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
              <div style="margin-top: 10px;">
                <strong>Observation:</strong>
                <p style="font-size: 12px; color: #666;">${approvals.supervisor2.observation}</p>
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
              <div style="margin-top: 10px;">
                <strong>Observation:</strong>
                <p style="font-size: 12px; color: #666;">${approvals.finalApproval.observation}</p>
              </div>
              ` : ''}
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

  // VÉRIFICATIONS DE CHARGEMENT ET PERMISSIONS
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

  if (!hasModuleAccess('prefinancing')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowRightLeft className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder à ce module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec notifications de signatures en attente */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Préfinancements</h2>
          <p className="text-gray-600 mt-1">Avances de trésorerie et suivi des remboursements</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Notification des signatures en attente */}
          {pendingSignatures.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">
                  {pendingSignatures.length} signature(s) en attente
                </span>
              </div>
            </div>
          )}
          
          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Préfinancement</span>
            </button>
          )}
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher préfinancement, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvé</option>
              <option value="paid">Décaissé</option>
              <option value="repaid">Remboursé</option>
              <option value="rejected">Rejeté</option>
            </select>
          </div>
          
          <div>
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les objets</option>
              <option value="specific_expenses">Dépenses spécifiques</option>
              <option value="other_accounts">Autres comptes</option>
              <option value="between_grants">Entre subventions</option>
            </select>
          </div>
          
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Filtrer par date remboursement"
            />
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{sortedPrefinancings.length} préfinancement(s)</span>
            {(searchTerm || statusFilter !== 'all' || dateFilter || purposeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateFilter('');
                  setPurposeFilter('all');
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Informations sur la subvention active */}
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

      {/* Tableau des préfinancements avec pagination */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('prefinancingNumber')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Préfinancement</span>
                    {getSortIcon('prefinancingNumber')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Objet
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Montant</span>
                    {getSortIcon('amount')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('expectedRepaymentDate')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Remboursement prévu</span>
                    {getSortIcon('expectedRepaymentDate')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signatures
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPrefinancings.map(prefinancing => {
                const isExpanded = expandedRows[prefinancing.id];
                const totalRepaid = getTotalRepaid(prefinancing);
                const remainingAmount = getRemainingAmount(prefinancing);
                
                return (
                  <React.Fragment key={prefinancing.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <div 
                            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                            onClick={() => toggleRowExpansion(prefinancing.id)}
                          >
                            {isExpanded ? prefinancing.prefinancingNumber : truncateText(prefinancing.prefinancingNumber, 15)}
                            {prefinancing.prefinancingNumber.length > 15 && (
                              <span className="text-blue-600 text-xs ml-1">
                                {isExpanded ? '[Réduire]' : '[Voir plus]'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(prefinancing.date).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div 
                          className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
                          onClick={() => toggleRowExpansion(prefinancing.id)}
                        >
                          {isExpanded ? prefinancing.description : truncateText(prefinancing.description, 25)}
                          {prefinancing.description.length > 25 && (
                            <span className="text-blue-600 text-xs ml-1">
                              {isExpanded ? '[Réduire]' : '[Voir plus]'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(prefinancing.amount, prefinancing.grantId)}
                        {totalRepaid > 0 && (
                          <div className="text-sm text-gray-500">
                            Restant: {formatCurrency(remainingAmount, prefinancing.grantId)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-900">
                        {new Date(prefinancing.expectedRepaymentDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {/* Signature Coordinateur de la subvention */}
                          <div className="relative group">
                            {getSignatureIcon(prefinancing, 'supervisor1')}
                            {isSignatureRequired(prefinancing, 'supervisor1') && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              </div>
                            )}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                              Coordinateur de la subvention
                              {prefinancing.approvals?.supervisor1?.name && (
                                <div className="font-medium">
                                  {prefinancing.approvals.supervisor1.name}
                                </div>
                              )}
                              {prefinancing.approvals?.supervisor1?.date && (
                                <div className="text-gray-300">
                                  {new Date(prefinancing.approvals.supervisor1.date).toLocaleDateString('fr-FR')}
                                </div>
                              )}
                              {canSignPrefinancing(prefinancing, 'supervisor1') && (
                                <button
                                  onClick={() => handleSignPrefinancing(prefinancing, 'supervisor1')}
                                  className="mt-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                                >
                                  Signer
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Signature Comptable */}
                          <div className="relative group">
                            {getSignatureIcon(prefinancing, 'supervisor2')}
                            {isSignatureRequired(prefinancing, 'supervisor2') && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              </div>
                            )}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                              Comptable
                              {prefinancing.approvals?.supervisor2?.name && (
                                <div className="font-medium">
                                  {prefinancing.approvals.supervisor2.name}
                                </div>
                              )}
                              {prefinancing.approvals?.supervisor2?.date && (
                                <div className="text-gray-300">
                                  {new Date(prefinancing.approvals.supervisor2.date).toLocaleDateString('fr-FR')}
                                </div>
                              )}
                              {canSignPrefinancing(prefinancing, 'supervisor2') && (
                                <button
                                  onClick={() => handleSignPrefinancing(prefinancing, 'supervisor2')}
                                  className="mt-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                                >
                                  Signer
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Signature Coordonnateur National */}
                          <div className="relative group">
                            {getSignatureIcon(prefinancing, 'finalApproval')}
                            {isSignatureRequired(prefinancing, 'finalApproval') && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              </div>
                            )}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                              Coordonnateur National
                              {prefinancing.approvals?.finalApproval?.name && (
                                <div className="font-medium">
                                  {prefinancing.approvals.finalApproval.name}
                                </div>
                              )}
                              {prefinancing.approvals?.finalApproval?.date && (
                                <div className="text-gray-300">
                                  {new Date(prefinancing.approvals.finalApproval.date).toLocaleDateString('fr-FR')}
                                </div>
                              )}
                              {canSignPrefinancing(prefinancing, 'finalApproval') && (
                                <button
                                  onClick={() => handleSignPrefinancing(prefinancing, 'finalApproval')}
                                  className="mt-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                                >
                                  Signer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${PREFINANCING_STATUS[prefinancing.status].color}`}>
                          {PREFINANCING_STATUS[prefinancing.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {prefinancing.status === 'paid' && remainingAmount > 0 && canEdit && (
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
                          {canEdit && (
                            <button 
                              onClick={() => {
                                const prefinancingToEdit = prefinancing;
                                setEditingPrefinancing(prefinancingToEdit);
                                setFormData({
                                  grantId: prefinancingToEdit.grantId,
                                  budgetLineId: prefinancingToEdit.budgetLineId || '',
                                  subBudgetLineId: prefinancingToEdit.subBudgetLineId || '',
                                  amount: prefinancingToEdit.amount.toString(),
                                  description: prefinancingToEdit.description,
                                  date: prefinancingToEdit.date,
                                  expectedRepaymentDate: prefinancingToEdit.expectedRepaymentDate,
                                  purpose: prefinancingToEdit.purpose,
                                  targetBankAccount: prefinancingToEdit.targetBankAccount || '',
                                  targetGrant: prefinancingToEdit.targetGrant || ''
                                });
                                
                                setExpenses(prefinancingToEdit.expenses?.map(exp => ({
                                  supplier: exp.supplier,
                                  invoiceNumber: exp.invoiceNumber,
                                  amount: exp.amount.toString(),
                                  description: exp.description
                                })) || [{ supplier: '', invoiceNumber: '', amount: '', description: '' }]);
                                
                                setApprovals({
                                  supervisor1: {
                                    name: prefinancingToEdit.approvals?.supervisor1?.name || '',
                                    signature: prefinancingToEdit.approvals?.supervisor1?.signature || false,
                                    observation: prefinancingToEdit.approvals?.supervisor1?.observation || ''
                                  },
                                  supervisor2: {
                                    name: prefinancingToEdit.approvals?.supervisor2?.name || '',
                                    signature: prefinancingToEdit.approvals?.supervisor2?.signature || false,
                                    observation: prefinancingToEdit.approvals?.supervisor2?.observation || ''
                                  },
                                  finalApproval: {
                                    name: prefinancingToEdit.approvals?.finalApproval?.name || '',
                                    signature: prefinancingToEdit.approvals?.finalApproval?.signature || false,
                                    observation: prefinancingToEdit.approvals?.finalApproval?.observation || ''
                                  }
                                });
                                setShowForm(true);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier le préfinancement"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canView && (
                            <button
                              onClick={() => setViewingPrefinancing(prefinancing)}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Ligne d'expansion pour afficher plus de détails */}
                    {isExpanded && (
                      <tr className="bg-blue-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Détails du préfinancement</h4>
                              <div className="space-y-1">
                                <p><span className="font-medium">Numéro:</span> {prefinancing.prefinancingNumber}</p>
                                <p><span className="font-medium">Objet:</span> {getPurposeLabel(prefinancing.purpose)}</p>
                                <p><span className="font-medium">Description:</span> {prefinancing.description}</p>
                                <p><span className="font-medium">Date de création:</span> {new Date(prefinancing.date).toLocaleDateString('fr-FR')}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Informations financières</h4>
                              <div className="space-y-1">
                                <p><span className="font-medium">Montant total:</span> {formatCurrency(prefinancing.amount, prefinancing.grantId)}</p>
                                <p><span className="font-medium">Déjà remboursé:</span> {formatCurrency(totalRepaid, prefinancing.grantId)}</p>
                                <p><span className="font-medium">Reste à rembourser:</span> {formatCurrency(remainingAmount, prefinancing.grantId)}</p>
                                <p><span className="font-medium">Statut:</span> <span className={`px-2 py-1 text-xs font-medium rounded-full ${PREFINANCING_STATUS[prefinancing.status].color}`}>{PREFINANCING_STATUS[prefinancing.status].label}</span></p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination améliorée */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-4 border-t border-gray-200 gap-4">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Affichage de {startIndex + 1} à {Math.min(endIndex, sortedPrefinancings.length)} sur {sortedPrefinancings.length} préfinancements
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Lignes par page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-gray-300 flex items-center transition-colors hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Précédent
              </button>
              
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600 px-2">Page</span>
                <span className="text-sm font-medium text-gray-900">{currentPage}</span>
                <span className="text-sm text-gray-600">sur</span>
                <span className="text-sm font-medium text-gray-900">{totalPages}</span>
              </div>
              
              <select
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Array.from({ length: totalPages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>

              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-gray-300 flex items-center transition-colors hover:bg-gray-50"
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal du formulaire de préfinancement */}
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

              {/* Section Signatures - Identique à EngagementManager */}
              {canViewSignatureSection() && (
                <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Signatures d'Approbation
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Coordinateur de la Subvention */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">Coordinateur de la Subvention</h4>
                        {canSignPrefinancing(editingPrefinancing, 'supervisor1') && (
                          <button
                            type="button"
                            onClick={() => handleSignPrefinancing(editingPrefinancing, 'supervisor1')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            Signer
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={userProfession === 'Coordinateur de la Subvention' && !approvals.supervisor1.name ? userFullName : approvals.supervisor1.name}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor1: { ...prev.supervisor1, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                        disabled
                      />
                      
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={approvals.supervisor1.signature}
                            onChange={(e) => setApprovals(prev => ({
                              ...prev,
                              supervisor1: { ...prev.supervisor1, signature: e.target.checked }
                            }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={userProfession !== 'Coordinateur de la Subvention' || !!approvals.supervisor1.name}
                          />
                          <span className="text-sm text-gray-700">Signature validée</span>
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            placeholder="Saisissez votre observation..."
                            disabled={userProfession !== 'Coordinateur de la Subvention' || !!approvals.supervisor1.name}
                          />
                        </div>
                      )}
                    </div>

                    {/* Comptable */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">Comptable</h4>
                        {canSignPrefinancing(editingPrefinancing, 'supervisor2') && (
                          <button
                            type="button"
                            onClick={() => handleSignPrefinancing(editingPrefinancing, 'supervisor2')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            Signer
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={userProfession === 'Comptable' && !approvals.supervisor2.name ? userFullName : approvals.supervisor2.name}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          supervisor2: { ...prev.supervisor2, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                        disabled
                      />
                      
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={approvals.supervisor2.signature}
                            onChange={(e) => setApprovals(prev => ({
                              ...prev,
                              supervisor2: { ...prev.supervisor2, signature: e.target.checked }
                            }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={userProfession !== 'Comptable' || !!approvals.supervisor2.name}
                          />
                          <span className="text-sm text-gray-700">Signature validée</span>
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            placeholder="Saisissez votre observation..."
                            disabled={userProfession !== 'Comptable' || !!approvals.supervisor2.name}
                          />
                        </div>
                      )}
                    </div>

                    {/* Coordonnateur National */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">Coordonnateur National</h4>
                        {canSignPrefinancing(editingPrefinancing, 'finalApproval') && (
                          <button
                            type="button"
                            onClick={() => handleSignPrefinancing(editingPrefinancing, 'finalApproval')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            Signer
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={userProfession === 'Coordonnateur National' && !approvals.finalApproval.name ? userFullName : approvals.finalApproval.name}
                        onChange={(e) => setApprovals(prev => ({
                          ...prev,
                          finalApproval: { ...prev.finalApproval, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                        disabled
                      />
                      
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={approvals.finalApproval.signature}
                            onChange={(e) => setApprovals(prev => ({
                              ...prev,
                              finalApproval: { ...prev.finalApproval, signature: e.target.checked }
                            }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={userProfession !== 'Coordonnateur National' || !!approvals.finalApproval.name}
                          />
                          <span className="text-sm text-gray-700">Signature validée</span>
                        </label>
                        
                        <button
                          type="button"
                          onClick={() => toggleObservation('finalApproval')}
                          className="text-blue-600 text-sm hover:text-blue-800 flex items-center space-x-1"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            placeholder="Saisissez votre observation..."
                            disabled={userProfession !== 'Coordonnateur National' || !!approvals.finalApproval.name}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
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
                  {editingPrefinancing ? 'Modifier' : 'Créer'} le Préfinancement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de remboursement */}
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

      {/* Modal de détails du préfinancement */}
      {viewingPrefinancing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Détails du Préfinancement</h2>
              <button
                onClick={() => setViewingPrefinancing(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Numéro de préfinancement</label>
                      <p className="text-sm text-gray-900">{viewingPrefinancing.prefinancingNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Date</label>
                      <p className="text-sm text-gray-900">{new Date(viewingPrefinancing.date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Objet</label>
                      <p className="text-sm text-gray-900">{getPurposeLabel(viewingPrefinancing.purpose)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Statut</label>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${PREFINANCING_STATUS[viewingPrefinancing.status].color}`}>
                        {PREFINANCING_STATUS[viewingPrefinancing.status].label}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations financières</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Montant</label>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(viewingPrefinancing.amount, viewingPrefinancing.grantId)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Date de remboursement prévue</label>
                      <p className="text-sm text-gray-900">{new Date(viewingPrefinancing.expectedRepaymentDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Déjà remboursé</label>
                      <p className="text-sm text-gray-900">{formatCurrency(getTotalRepaid(viewingPrefinancing), viewingPrefinancing.grantId)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Reste à rembourser</label>
                      <p className="text-sm text-gray-900">{formatCurrency(getRemainingAmount(viewingPrefinancing), viewingPrefinancing.grantId)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900">{viewingPrefinancing.description}</p>
                </div>
              </div>

              {viewingPrefinancing.expenses && viewingPrefinancing.expenses.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dépenses concernées</h3>
                  <div className="space-y-3">
                    {viewingPrefinancing.expenses.map((expense, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">Dépense {index + 1}</h4>
                            <p className="text-sm text-gray-600">{expense.supplier} - {expense.invoiceNumber}</p>
                            {expense.description && (
                              <p className="text-sm text-gray-500 mt-1">{expense.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {formatCurrency(expense.amount, viewingPrefinancing.grantId)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingPrefinancing.approvals && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Signatures d'approbation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {viewingPrefinancing.approvals.supervisor1 && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800">Coordinateur de la Subvention</h4>
                        <p className="text-sm text-gray-900">{viewingPrefinancing.approvals.supervisor1.name}</p>
                        <p className="text-xs text-gray-600">
                          Signé: {viewingPrefinancing.approvals.supervisor1.signature ? 'Oui' : 'Non'}
                        </p>
                        {viewingPrefinancing.approvals.supervisor1.date && (
                          <p className="text-xs text-gray-600">
                            Date: {new Date(viewingPrefinancing.approvals.supervisor1.date).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {viewingPrefinancing.approvals.supervisor1.observation && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-600">Observation:</p>
                            <p className="text-xs text-gray-500">{viewingPrefinancing.approvals.supervisor1.observation}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {viewingPrefinancing.approvals.supervisor2 && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800">Comptable</h4>
                        <p className="text-sm text-gray-900">{viewingPrefinancing.approvals.supervisor2.name}</p>
                        <p className="text-xs text-gray-600">
                          Signé: {viewingPrefinancing.approvals.supervisor2.signature ? 'Oui' : 'Non'}
                        </p>
                        {viewingPrefinancing.approvals.supervisor2.date && (
                          <p className="text-xs text-gray-600">
                            Date: {new Date(viewingPrefinancing.approvals.supervisor2.date).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {viewingPrefinancing.approvals.supervisor2.observation && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-600">Observation:</p>
                            <p className="text-xs text-gray-500">{viewingPrefinancing.approvals.supervisor2.observation}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {viewingPrefinancing.approvals.finalApproval && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800">Coordonnateur National</h4>
                        <p className="text-sm text-gray-900">{viewingPrefinancing.approvals.finalApproval.name}</p>
                        <p className="text-xs text-gray-600">
                          Signé: {viewingPrefinancing.approvals.finalApproval.signature ? 'Oui' : 'Non'}
                        </p>
                        {viewingPrefinancing.approvals.finalApproval.date && (
                          <p className="text-xs text-gray-600">
                            Date: {new Date(viewingPrefinancing.approvals.finalApproval.date).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {viewingPrefinancing.approvals.finalApproval.observation && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-600">Observation:</p>
                            <p className="text-xs text-gray-500">{viewingPrefinancing.approvals.finalApproval.observation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewingPrefinancing.repayments && viewingPrefinancing.repayments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique des remboursements</h3>
                  <div className="space-y-2">
                    {viewingPrefinancing.repayments.map((repayment, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{repayment.reference}</p>
                            <p className="text-xs text-gray-600">{new Date(repayment.date).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-600">
                              {formatCurrency(repayment.amount, viewingPrefinancing.grantId)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrefinancingManager;