import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Users, Calendar, DollarSign, CheckCircle, Clock, Download, Printer, X, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, AlertCircle, FileText, Eye } from 'lucide-react';
import { showSuccess, showValidationError, showWarning } from '../utils/alerts';
import { EmployeeLoan, BudgetLine, Grant, LOAN_STATUS, SubBudgetLine } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useEmployeeLoanNotifications } from '../hooks/useEmployeeLoanNotifications';

interface EmployeeLoanManagerProps {
  loans: EmployeeLoan[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  selectedGrantId?: string;
  onAddLoan: (loan: Omit<EmployeeLoan, 'id'>) => void;
  onUpdateLoan: (id: string, updates: Partial<EmployeeLoan>) => void;
  onAddRepayment: (loanId: string, repayment: { date: string; amount: number; reference: string }) => void;
}

const EmployeeLoanManager: React.FC<EmployeeLoanManagerProps> = ({
  loans,
  budgetLines,
  subBudgetLines,
  grants,
  selectedGrantId,
  onAddLoan,
  onUpdateLoan,
  onAddRepayment
}) => {
  // HOOKS D'AUTHENTIFICATION ET PERMISSIONS
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  const { user: currentUser, userProfile, userRole } = useAuth();

  // HOOK DE NOTIFICATIONS POUR LES PRÊTS EMPLOYÉS
  const { notificationCount, hasNotifications} = useEmployeeLoanNotifications(loans);

  // ÉTATS DU COMPOSANT
  const [showForm, setShowForm] = useState(false);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<EmployeeLoan | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // États pour le tri et la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<string>('loanNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // État pour gérer l'expansion du contenu des cellules
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    grantId: selectedGrantId || '',
    budgetLineId: '',
    subBudgetLineId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    expectedRepaymentDate: '',
    employeeName: '',
    employeeId: '',
    installmentAmount: '',
    numberOfInstallments: '12',
    frequency: 'monthly' as EmployeeLoan['repaymentSchedule']['frequency']
  });

  const [repaymentData, setRepaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    reference: ''
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

  // RÉFÉRENCES POUR PDF
  const mainContentRef = useRef<HTMLDivElement>(null);
  const signatureContentRef = useRef<HTMLDivElement>(null);

  // 🎯 FONCTIONS UTILITAIRES POUR LES RÔLES ET PERMISSIONS

  // Récupère le nom complet de l'utilisateur
  const getUserFullName = (): string => {
    if (!userProfile) return '';
    if (userProfile.firstName && userProfile.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`.trim();
    }
    return userProfile.email;
  };

  // Récupère la profession de l'utilisateur 
  const getUserProfession = (): string => { 
    return userProfile?.profession || '';
  };

  // Vérifie si l'utilisateur peut modifier le statut
  const canModifyStatusComptable = (): boolean => {
    return getUserProfession() === 'Comptable';
  };

  const canModifyStatus = (): boolean => {
    return getUserProfession() === 'Coordonnateur National';
  };

  // Vérifie si l'utilisateur peut voir la section signature
  const canViewSignatureSection = (): boolean => {
    const signatureProfessions = ['Coordinateur de la Subvention', 'Comptable', 'Coordonnateur National'];
    return signatureProfessions.includes(getUserProfession());
  }; 

  // Vérifie si l'utilisateur peut signer un prêt spécifique
  const canSignLoan = (loan: EmployeeLoan | null, signatureType: string): boolean => {
    const currentApprovals = loan ? loan.approvals : approvals;
    
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

    // POUR LE COORDONNATEUR NATIONAL : vérifier que les autres ont signé
    if (signatureType === 'finalApproval') {
      const hasSupervisor1Signed = currentApprovals.supervisor1?.signature;
      const hasSupervisor2Signed = currentApprovals.supervisor2?.signature;
      
      // Le coordonnateur national ne peut signer que si les deux autres ont signé
      if (!hasSupervisor1Signed || !hasSupervisor2Signed) {
        return false;
      }
    }

    return true;
  };

  // Récupère les prêts en attente de signature pour l'utilisateur actuel
  const getPendingSignatures = (): EmployeeLoan[] => {
    const userProfession = getUserProfession();
    
    return loans.filter(loan => {
      if (userProfession === 'Coordinateur de la Subvention') {
        return !loan.approvals?.supervisor1?.signature;
      } else if (userProfession === 'Comptable') {
        return !loan.approvals?.supervisor2?.signature;
      } else if (userProfession === 'Coordonnateur National') {
        const hasSupervisor1Signed = loan.approvals?.supervisor1?.signature;
        const hasSupervisor2Signed = loan.approvals?.supervisor2?.signature;
        const hasFinalSigned = loan.approvals?.finalApproval?.signature;
        return hasSupervisor1Signed && hasSupervisor2Signed && !hasFinalSigned;
      }
      return false;
    });
  };

  // Fonction pour ouvrir le modal de détails
  const handleViewDetails = (loan: EmployeeLoan) => {
    setSelectedLoan(loan);
    setShowDetailsModal(true);
  };

  // Fonction pour fermer le modal de détails
  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedLoan(null);
  };

  // Fonction pour basculer l'expansion d'une ligne
  const toggleRowExpansion = (loanId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loanId)) {
        newSet.delete(loanId);
      } else {
        newSet.add(loanId);
      }
      return newSet;
    });
  };

  // Fonction pour tronquer le texte
  const truncateText = (text: string, maxLength: number = 30): string => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  // PERMISSIONS SPÉCIFIQUES AU MODULE PRÊTS
  const canCreate = hasPermission('employee_loans', 'create');
  const canEdit = hasPermission('employee_loans', 'edit');
  const canDelete = hasPermission('employee_loans', 'delete');
  const canView = hasPermission('employee_loans', 'view');
  const canApprove = hasPermission('employee_loans', 'approve');

  // Vérifier si la subvention sélectionnée est active
  const activeGrant = grants.find(grant => grant.status === 'active');
  const canCreateLoan = canCreate && activeGrant;

  // Récupération des données utilisateur
  const userProfession = getUserProfession();
  const userFullName = getUserFullName();
  const pendingSignatures = getPendingSignatures();

  // Définir selectedGrant basé sur selectedGrantId ou la subvention la plus récente
  const selectedGrant = selectedGrantId 
    ? grants.find(grant => grant.id === selectedGrantId)
    : grants.length > 0 
      ? grants.reduce((latest, current) => 
          parseInt(current.id) > parseInt(latest.id) ? current : latest
        )
      : null;

  // Fonction pour formater les montants avec la devise de la subvention
  const formatCurrency = (amount: number, grantId?: string) => {
    const grant = grantId 
      ? grants.find(g => g.id === grantId) 
      : selectedGrant || grants[0];
    
    if (!grant) return amount.toLocaleString('fr-FR');
    
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: grant.currency === 'XOF' ? 'XOF' : grant.currency,
      minimumFractionDigits: grant.currency === 'XOF' ? 0 : 2
    });
  };

  // Fonction pour obtenir l'icône de signature
  const getSignatureIcon = (loan: EmployeeLoan, signatureType: string) => {
    const approval = loan.approvals?.[signatureType as keyof typeof loan.approvals];
    if (approval?.signature) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // Fonction pour déterminer si une signature est requise
  const isSignatureRequired = (loan: EmployeeLoan, signatureType: string): boolean => {
    const userProfession = getUserProfession();
    
    if (signatureType === 'supervisor1' && userProfession === 'Coordinateur de la Subvention') {
      return !loan.approvals?.supervisor1?.signature;
    } else if (signatureType === 'supervisor2' && userProfession === 'Comptable') {
      return !loan.approvals?.supervisor2?.signature;
    } else if (signatureType === 'finalApproval' && userProfession === 'Coordonnateur National') {
      const hasSupervisor1Signed = loan.approvals?.supervisor1?.signature;
      const hasSupervisor2Signed = loan.approvals?.supervisor2?.signature;
      return hasSupervisor1Signed && hasSupervisor2Signed && !loan.approvals?.finalApproval?.signature;
    }
    return false;
  };

  // Fonction pour signer un prêt
  const handleSignLoan = (loan: EmployeeLoan | null, signatureType: string) => {
    if (!canSignLoan(loan, signatureType)) {
      if (signatureType === 'finalApproval') {
        showWarning('Signature impossible', 'Les signatures du Coordinateur de la Subvention et du Comptable sont requises avant votre signature');
      } else {
        showWarning('Permission refusée', 'Vous ne pouvez pas signer ce prêt');
      }
      return;
    }

    // Logique de signature simplifiée
    if (loan) {
      // Cas d'un prêt existant
      const updates: Partial<EmployeeLoan> = {
        approvals: { ...loan.approvals }
      };

      // Appliquer la signature
      updates.approvals = {
        ...updates.approvals,
        [signatureType]: {
          name: userFullName,
          date: new Date().toISOString().split('T')[0],
          signature: true,
          observation: approvals[signatureType as keyof typeof approvals].observation
        }
      };

      onUpdateLoan(loan.id, updates);
      showSuccess('Signature enregistrée', 'Votre signature a été enregistrée avec succès');
    } else {
      // Cas d'un nouveau prêt
      const updatedApproval = {
        name: userFullName,
        date: new Date().toISOString().split('T')[0],
        signature: true,
        observation: approvals[signatureType as keyof typeof approvals].observation
      };

      setApprovals(prev => ({
        ...prev,
        [signatureType]: updatedApproval
      }));
      
      showSuccess('Signature préparée', 'Votre signature sera enregistrée avec le nouveau prêt');
    }
    
    // Réinitialiser les observations
    setApprovals(prev => ({
      ...prev,
      [signatureType]: { ...prev[signatureType as keyof typeof approvals], observation: '' }
    }));
  };

  // Fonction pour basculer l'affichage des observations
  const toggleObservation = (signatureType: string) => {
    setShowObservations(prev => ({
      ...prev,
      [signatureType]: !prev[signatureType as keyof typeof showObservations]
    }));
  };

  // 🎯 FONCTIONS D'EXPORT PDF PROFESSIONNELLES

  const exportLoanForm = async (loan: EmployeeLoan) => {
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      // Générer le contenu principal
      const mainContent = generateMainPDFContent(loan);
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
      const signatureContent = generateSignaturePDFContent(loan);
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
      pdf.save(`pret-employe-${loan.loanNumber}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      showWarning('Erreur', 'Impossible de générer le PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateMainPDFContent = (loan: EmployeeLoan) => {
    const budgetLine = getBudgetLine(loan.budgetLineId);
    const grant = getGrant(loan.grantId);
    const totalRepaid = getTotalRepaid(loan);
    const remainingAmount = getRemainingAmount(loan);
    const progress = getRepaymentProgress(loan);

    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2c5aa0;">
          <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">FICHE DE PRÊT EMPLOYÉ</h1>
          <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${loan.loanNumber}</h2>
          <p>Date: ${new Date(loan.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
        </div>
        
        <!-- Informations Employé -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Informations Employé
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Nom de l'employé:</strong>
              <div class="form-field">${loan.employee.name}</div>
            </div>
            <div>
              <strong>Matricule:</strong>
              <div class="form-field">${loan.employee.employeeId}</div>
            </div>
          </div>
        </div>

        <!-- Informations Subvention et Budget -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Informations Subvention et Budget
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Subvention:</strong>
              <div class="form-field">${grant?.name || 'Non spécifié'}</div>
            </div>
            <div>
              <strong>Référence:</strong>
              <div class="form-field">${grant?.reference || 'N/A'}</div>
            </div>
            <div>
              <strong>Ligne Budgétaire:</strong>
              <div class="form-field">${budgetLine?.code || 'N/A'} - ${budgetLine?.name || 'Ligne supprimée'}</div>
            </div>
            <div>
              <strong>Devise:</strong>
              <div class="form-field">${grant?.currency || 'EUR'} (${getCurrencySymbol(grant?.currency || 'EUR')})</div>
            </div>
          </div>
        </div>
        
        <!-- Détails du Prêt -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Détails du Prêt
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>N° de Prêt:</strong>
              <div class="form-field">${loan.loanNumber}</div>
            </div>
            <div>
              <strong>Date:</strong>
              <div class="form-field">${new Date(loan.date).toLocaleDateString('fr-FR')}</div>
            </div>
            <div>
              <strong>Montant du prêt:</strong>
              <div class="form-field">${formatCurrency(loan.amount, loan.grantId)}</div>
            </div>
            <div>
              <strong>Statut:</strong>
              <div class="form-field">${LOAN_STATUS[loan.status]?.label || loan.status}</div>
            </div>
            <div>
              <strong>Date remboursement prévue:</strong>
              <div class="form-field">${new Date(loan.expectedRepaymentDate).toLocaleDateString('fr-FR')}</div>
            </div>
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>Description:</strong>
            <div class="form-field" style="min-height: 60px;">${loan.description.replace(/\n/g, '<br>')}</div>
          </div>
        </div>

        <!-- Échéancier de Remboursement -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Échéancier de Remboursement
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Montant par échéance:</strong>
              <div class="form-field">${formatCurrency(loan.repaymentSchedule.installmentAmount, loan.grantId)}</div>
            </div>
            <div>
              <strong>Nombre d'échéances:</strong>
              <div class="form-field">${loan.repaymentSchedule.numberOfInstallments}</div>
            </div>
            <div>
              <strong>Fréquence:</strong>
              <div class="form-field">${getFrequencyLabel(loan.repaymentSchedule.frequency)}</div>
            </div>
          </div>
        </div>

        <!-- État du Remboursement -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            État du Remboursement
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>Total remboursé:</strong>
              <div class="form-field">${formatCurrency(totalRepaid, loan.grantId)}</div>
            </div>
            <div>
              <strong>Reste à rembourser:</strong>
              <div class="form-field">${formatCurrency(remainingAmount, loan.grantId)}</div>
            </div>
            <div>
              <strong>Progression:</strong>
              <div class="form-field">${progress.toFixed(1)}%</div>
            </div>
            <div>
              <strong>Nombre de remboursements:</strong>
              <div class="form-field">${loan.repayments.length}</div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #2c5aa0; text-align: center; font-size: 12px; color: #777;">
          <p>Document généré le ${new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          <p>Fiche de prêt employé - ${loan.loanNumber}</p>
        </div>
      </div>
    `;
  };

  const generateSignaturePDFContent = (loan: EmployeeLoan) => {
    const currentApprovals = loan.approvals || approvals;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding-top: 50px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">SIGNATURES D'APPROBATION</h1>
          <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${loan.loanNumber}</h2>
        </div>
        
        <!-- Signatures -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Signatures d'Approbation
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div class="signature-box">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordinateur de la Subvention</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div class="form-field" style="min-height: 40px;">${currentApprovals.supervisor1?.name || '_________________________'}</div>
              <p>Date: ${(currentApprovals.supervisor1 as any)?.date || '___/___/_____'}</p>
              <p>Signature: ${currentApprovals.supervisor1?.signature ? '✅ Validée' : '◻ Non validée'}</p>
              ${currentApprovals.supervisor1?.observation ? `
              <div style="margin-top: 10px;">
                <strong>Observation:</strong>
                <p style="font-size: 12px; color: #666;">${currentApprovals.supervisor1.observation}</p>
              </div>
              ` : ''}
            </div>
            
            <div class="signature-box">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Comptable</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div class="form-field" style="min-height: 40px;">${currentApprovals.supervisor2?.name || '_________________________'}</div>
              <p>Date: ${(currentApprovals.supervisor2 as any)?.date || '___/___/_____'}</p>
              <p>Signature: ${currentApprovals.supervisor2?.signature ? '✅ Validée' : '◻ Non validée'}</p>
              ${currentApprovals.supervisor2?.observation ? `
              <div style="margin-top: 10px;">
                <strong>Observation:</strong>
                <p style="font-size: 12px; color: #666;">${currentApprovals.supervisor2.observation}</p>
              </div>
              ` : ''}
            </div>
            
            <div class="signature-box">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordonnateur national</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div class="form-field" style="min-height: 40px;">${currentApprovals.finalApproval?.name || '_________________________'}</div>
              <p>Date: ${(currentApprovals.finalApproval as any)?.date || '___/___/_____'}</p>
              <p>Signature: ${currentApprovals.finalApproval?.signature ? '✅ Validée' : '◻ Non validée'}</p>
              ${currentApprovals.finalApproval?.observation ? `
              <div style="margin-top: 10px;">
                <strong>Observation:</strong>
                <p style="font-size: 12px; color: #666;">${currentApprovals.finalApproval.observation}</p>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #2c5aa0; text-align: center; font-size: 12px; color: #777;">
          <p>Page 2/2 - Signatures d'approbation</p>
          <p>Fiche de prêt employé - ${loan.loanNumber}</p>
        </div>
      </div>
    `;
  };

  const getCurrencySymbol = (currency: string = 'EUR') => {
    switch (currency) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'XOF': return 'CFA';
      default: return '€';
    }
  };

  // 🎯 FONCTIONS DE RECHERCHE ET FILTRAGE

  const getBudgetLine = (budgetLineId: string) => {
    return budgetLines.find(line => line.id === budgetLineId);
  };

  const getGrant = (grantId: string) => {
    return grants.find(grant => grant.id === grantId);
  };

  // Filtrage et recherche des prêts
  const searchedLoans = loans.filter(loan => {
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = 
      loan.loanNumber.toLowerCase().includes(searchLower) ||
      loan.employee.name.toLowerCase().includes(searchLower) ||
      loan.employee.employeeId.toLowerCase().includes(searchLower) ||
      loan.description.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Tri des prêts
  const sortedLoans = [...searchedLoans].sort((a, b) => {
    let aValue: any = a[sortField as keyof EmployeeLoan];
    let bValue: any = b[sortField as keyof EmployeeLoan];

    if (sortField === 'amount') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
    } else if (sortField === 'date') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedLoans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLoans = sortedLoans.slice(startIndex, endIndex);

  // Navigation des pages
  const goToPage = (page: number) => setCurrentPage(page);
  const goToPreviousPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  // Gestion du tri
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const resetForm = () => {
    setFormData({
      grantId: selectedGrantId || '',
      budgetLineId: '',
      subBudgetLineId: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      expectedRepaymentDate: '',
      employeeName: '',
      employeeId: '',
      installmentAmount: '',
      numberOfInstallments: '12',
      frequency: 'monthly'
    });
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
    setEditingLoan(null);
  };

  const resetRepaymentForm = () => {
    setRepaymentData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      reference: ''
    });
    setShowRepaymentForm(false);
    setSelectedLoan(null);
  };

  const handleEditLoan = (loan: EmployeeLoan) => {
    if (!canEdit) {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission de modifier les prêts');
      return;
    }

    setEditingLoan(loan);
    setFormData({
      grantId: loan.grantId,
      budgetLineId: loan.budgetLineId || '',
      subBudgetLineId: loan.subBudgetLineId || '',
      amount: loan.amount.toString(),
      description: loan.description,
      date: loan.date,
      expectedRepaymentDate: loan.expectedRepaymentDate,
      employeeName: loan.employee.name,
      employeeId: loan.employee.employeeId,
      installmentAmount: loan.repaymentSchedule.installmentAmount.toString(),
      numberOfInstallments: loan.repaymentSchedule.numberOfInstallments.toString(),
      frequency: loan.repaymentSchedule.frequency
    });
    
    // Pré-remplir les approbations
    setApprovals({
      supervisor1: {
        name: loan.approvals?.supervisor1?.name || '',
        signature: loan.approvals?.supervisor1?.signature || false,
        observation: loan.approvals?.supervisor1?.observation || ''
      },
      supervisor2: {
        name: loan.approvals?.supervisor2?.name || '',
        signature: loan.approvals?.supervisor2?.signature || false,
        observation: loan.approvals?.supervisor2?.observation || ''
      },
      finalApproval: {
        name: loan.approvals?.finalApproval?.name || '',
        signature: loan.approvals?.finalApproval?.signature || false,
        observation: loan.approvals?.finalApproval?.observation || ''
      }
    });
    
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🎯 VÉRIFICATION SUBVENTION ACTIVE
    if (!activeGrant) {
      showWarning('Subvention inactive', 'Impossible de créer un prêt employé car la subvention n\'est pas active');
      return;
    }

    if (!canCreate && !editingLoan) {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission de créer des prêts');
      return;
    }

    if (!canEdit && editingLoan) {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission de modifier des prêts');
      return;
    }
    
    if (!formData.grantId || !formData.amount || !formData.employeeName || !formData.employeeId) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, le montant, le nom et le matricule de l\'employé');
      return;
    }

    // Si on est en mode édition
    if (editingLoan) {
      const updates: Partial<EmployeeLoan> = {
        grantId: formData.grantId,
        budgetLineId: formData.budgetLineId || undefined,
        subBudgetLineId: formData.subBudgetLineId || undefined,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        expectedRepaymentDate: formData.expectedRepaymentDate,
        employee: {
          name: formData.employeeName,
          employeeId: formData.employeeId
        },
        repaymentSchedule: {
          installmentAmount: parseFloat(formData.installmentAmount),
          numberOfInstallments: parseInt(formData.numberOfInstallments),
          frequency: formData.frequency
        },
        approvals: {
          supervisor1: approvals.supervisor1.name ? {
            name: approvals.supervisor1.name,
            date: new Date().toISOString().split('T')[0],
            signature: approvals.supervisor1.signature,
            observation: approvals.supervisor1.observation
          } : undefined,
          supervisor2: approvals.supervisor2.name ? {
            name: approvals.supervisor2.name,
            date: new Date().toISOString().split('T')[0],
            signature: approvals.supervisor2.signature,
            observation: approvals.supervisor2.observation
          } : undefined,
          finalApproval: approvals.finalApproval.name && approvals.finalApproval.signature ? {
            name: approvals.finalApproval.name,
            date: new Date().toISOString().split('T')[0],
            signature: approvals.finalApproval.signature,
            observation: approvals.finalApproval.observation
          } : undefined
        }
      };

      onUpdateLoan(editingLoan.id, updates);
      resetForm();
      return;
    }

    // Si c'est une nouvelle demande
    const loanNumber = `PRET-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const loan: Omit<EmployeeLoan, 'id'> = {
      loanNumber,
      grantId: formData.grantId,
      budgetLineId: formData.budgetLineId || undefined,
      subBudgetLineId: formData.subBudgetLineId || undefined,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      expectedRepaymentDate: formData.expectedRepaymentDate,
      employee: {
        name: formData.employeeName,
        employeeId: formData.employeeId
      },
      repaymentSchedule: {
        installmentAmount: parseFloat(formData.installmentAmount),
        numberOfInstallments: parseInt(formData.numberOfInstallments),
        frequency: formData.frequency
      },
      repayments: [],
      status: 'pending',
      approvals: {
        supervisor1: approvals.supervisor1.name ? {
          name: approvals.supervisor1.name,
          date: new Date().toISOString().split('T')[0],
          signature: approvals.supervisor1.signature,
          observation: approvals.supervisor1.observation
        } : undefined,
        supervisor2: approvals.supervisor2.name ? {
          name: approvals.supervisor2.name,
          date: new Date().toISOString().split('T')[0],
          signature: approvals.supervisor2.signature,
          observation: approvals.supervisor2.observation
        } : undefined,
        finalApproval: approvals.finalApproval.name && approvals.finalApproval.signature ? {
          name: approvals.finalApproval.name,
          date: new Date().toISOString().split('T')[0],
          signature: approvals.finalApproval.signature,
          observation: approvals.finalApproval.observation
        } : undefined
      }
    };

    onAddLoan(loan);
    resetForm();
  };

  const handleRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfession === 'Comptable') {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission d\'ajouter des remboursements');
      return;
    }

    if (!selectedLoan || !repaymentData.amount || !repaymentData.reference) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir le montant et la référence du remboursement');
      return;
    }

    onAddRepayment(selectedLoan.id, {
      date: repaymentData.date,
      amount: parseFloat(repaymentData.amount),
      reference: repaymentData.reference
    });

    resetRepaymentForm();
  };

  const updateLoanStatus = (loanId: string, newStatus: EmployeeLoan['status']) => {
    if (!canApprove) {
      showWarning('Permission refusée', 'Vous n\'avez pas la permission de modifier le statut des prêts');
      return;
    }
    onUpdateLoan(loanId, { status: newStatus });
  };

  const getTotalRepaid = (loan: EmployeeLoan) => {
    return loan.repayments.reduce((sum, repayment) => sum + repayment.amount, 0);
  };

  const getRemainingAmount = (loan: EmployeeLoan) => {
    return loan.amount - getTotalRepaid(loan);
  };

  const getRepaymentProgress = (loan: EmployeeLoan) => {
    return loan.amount > 0 ? (getTotalRepaid(loan) / loan.amount) * 100 : 0;
  };

  const getFrequencyLabel = (frequency: EmployeeLoan['repaymentSchedule']['frequency']) => {
    switch (frequency) {
      case 'monthly': return 'Mensuel';
      case 'quarterly': return 'Trimestriel';
      case 'annual': return 'Annuel';
      default: return frequency;
    }
  };

  // 🚨 VÉRIFICATIONS DE CHARGEMENT ET PERMISSIONS
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

  if (!hasModuleAccess('employee_loans')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Prêts aux Employés</h2>
          <p className="text-gray-600 mt-1">Prêts sur compte bancaire et suivi des remboursements</p>
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
              disabled={!canCreateLoan}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                canCreateLoan
                  ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:shadow-lg transform hover:scale-[1.02]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Prêt</span>
            </button>
          )}
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher prêt, employé, matricule..."
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
              <option value="active">En cours</option>
              <option value="completed">Remboursé</option>
              <option value="rejected">Rejeté</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>{sortedLoans.length} prêt(s) trouvé(s)</span>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Information sur la subvention active */}
      {selectedGrant && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-4 border border-green-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Subvention Active</h3>
              <p className="text-sm text-gray-600">{selectedGrant.name} ({selectedGrant.reference})</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Prêts</p>
              <p className="text-xl font-bold text-blue-600">{loans.length}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Total Prêté</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(loans.reduce((sum, loan) => sum + loan.amount, 0))}
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Prêts Remboursés</p>
              <p className="text-xl font-bold text-orange-600">
                {loans.filter(l => l.status === 'completed').length}
              </p>
            </div>
            <div className="p-2 bg-orange-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En cours</p>
              <p className="text-xl font-bold text-green-600">
                {loans.filter(l => l.status === 'active').length}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Loan Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingLoan ? 'Modifier le Prêt' : 'Nouvelle Demande de Prêt Employé'}
                  </h3>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {editingLoan && (
                  <button
                    onClick={() => exportLoanForm(editingLoan)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Exporter la fiche"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Information */}
              <div className="bg-green-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations Employé</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de l'employé *
                    </label>
                    <input
                      type="text"
                      value={formData.employeeName}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Jean Dupont"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Matricule employé *
                    </label>
                    <input
                      type="text"
                      value={formData.employeeId}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: EMP-2024-001"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Loan Information */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations du Prêt</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subvention *
                    </label>
                    <select
                      value={formData.grantId}
                      onChange={(e) => setFormData(prev => ({ ...prev, grantId: e.target.value }))}
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
                </div>

                <div className="mt-4">
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
                    {subBudgetLines.filter(subLine => subLine.budgetLineId === formData.budgetLineId).map(subLine => (
                      <option key={subLine.id} value={subLine.id}>
                        {subLine.code} - {subLine.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant demandé *
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
                    placeholder="Motif du prêt..."
                    required
                  />
                </div>
              </div>

              {/* Repayment Schedule */}
              <div className="bg-orange-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Échéancier de Remboursement</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant par échéance *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.installmentAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, installmentAmount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre d'échéances *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.numberOfInstallments}
                      onChange={(e) => setFormData(prev => ({ ...prev, numberOfInstallments: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fréquence *
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as EmployeeLoan['repaymentSchedule']['frequency'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="monthly">Mensuel</option>
                      <option value="quarterly">Trimestriel</option>
                      <option value="annual">Annuel</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Signatures - Affichée seulement pour les rôles autorisés */}
              {canViewSignatureSection() && (
                <div className="bg-yellow-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Signatures d'Approbation</h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Coordinateur de la Subvention */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-800">Coordinateur de la Subvention</h5>
                        {canSignLoan(editingLoan, 'supervisor1') && (
                          <button
                            type="button"
                            onClick={() => handleSignLoan(editingLoan, 'supervisor1')}
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
                        <h5 className="font-medium text-gray-800">Comptable</h5>
                        {canSignLoan(editingLoan, 'supervisor2') && (
                          <button
                            type="button"
                            onClick={() => handleSignLoan(editingLoan, 'supervisor2')}
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
                        <h5 className="font-medium text-gray-800">Coordonnateur National</h5>
                        {canSignLoan(editingLoan, 'finalApproval') && (
                          <button
                            type="button"
                            onClick={() => handleSignLoan(editingLoan, 'finalApproval')}
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
                  className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200"
                >
                  {editingLoan ? 'Modifier le Prêt' : 'Enregistrer le Prêt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Form Modal */}
      {showRepaymentForm && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Enregistrer un Remboursement
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Prêt: {selectedLoan.loanNumber} - {selectedLoan.employee.name}
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
                  Montant remboursé ( {getGrant(selectedLoan.grantId)?.currency === 'EUR' ? '€' : 
                     getGrant(selectedLoan.grantId)?.currency === 'USD' ? '$' : 'CFA'})*
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={getRemainingAmount(selectedLoan)}
                    value={repaymentData.amount}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Restant à rembourser: {formatCurrency(getRemainingAmount(selectedLoan), selectedLoan.grantId)}
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
                  placeholder="Ex: REMB-2024-001"
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

      {/* Details Modal */}
      {showDetailsModal && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Détails du Prêt - {selectedLoan.loanNumber}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedLoan.employee.name} - {selectedLoan.employee.employeeId}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => exportLoanForm(selectedLoan)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Exporter la fiche"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCloseDetails}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Informations Générales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations Générales</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-gray-700">N° de Prêt:</span>
                      <p className="text-gray-900">{selectedLoan.loanNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Statut:</span>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${LOAN_STATUS[selectedLoan.status].color}`}>
                        {LOAN_STATUS[selectedLoan.status].label}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date du prêt:</span>
                      <p className="text-gray-900">{new Date(selectedLoan.date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date remboursement prévue:</span>
                      <p className="text-gray-900">{new Date(selectedLoan.expectedRepaymentDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations Employé</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-gray-700">Nom:</span>
                      <p className="text-gray-900">{selectedLoan.employee.name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Matricule:</span>
                      <p className="text-gray-900">{selectedLoan.employee.employeeId}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations Financières */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Détails Financiers</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-gray-700">Montant du prêt:</span>
                      <p className="text-gray-900 font-semibold">{formatCurrency(selectedLoan.amount, selectedLoan.grantId)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total remboursé:</span>
                      <p className="text-gray-900">{formatCurrency(getTotalRepaid(selectedLoan), selectedLoan.grantId)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Reste à rembourser:</span>
                      <p className="text-gray-900 font-semibold">{formatCurrency(getRemainingAmount(selectedLoan), selectedLoan.grantId)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Progression:</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(getRepaymentProgress(selectedLoan), 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-600">
                          {getRepaymentProgress(selectedLoan).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Échéancier</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-gray-700">Montant par échéance:</span>
                      <p className="text-gray-900">{formatCurrency(selectedLoan.repaymentSchedule.installmentAmount, selectedLoan.grantId)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Nombre d'échéances:</span>
                      <p className="text-gray-900">{selectedLoan.repaymentSchedule.numberOfInstallments}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Fréquence:</span>
                      <p className="text-gray-900">{getFrequencyLabel(selectedLoan.repaymentSchedule.frequency)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-yellow-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Description</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedLoan.description}</p>
              </div>

              {/* Historique des Remboursements */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900">Historique des Remboursements</h4>
                  <p className="text-sm text-gray-600">
                    {selectedLoan.repayments.length} remboursement(s) enregistré(s)
                  </p>
                </div>
                
                {selectedLoan.repayments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">Aucun remboursement enregistré pour ce prêt</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Référence
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedLoan.repayments.map((repayment, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(repayment.date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                              {formatCurrency(repayment.amount, selectedLoan.grantId)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {repayment.reference}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            Total remboursé
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(getTotalRepaid(selectedLoan), selectedLoan.grantId)}
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="bg-purple-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Signatures d'Approbation</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <h5 className="font-medium text-gray-700 mb-2">Coordinateur de la Subvention</h5>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedLoan.approvals?.supervisor1?.name || 'En attente'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedLoan.approvals?.supervisor1?.date ? 
                          new Date(selectedLoan.approvals.supervisor1.date).toLocaleDateString('fr-FR') : ''
                        }
                      </p>
                      <div className="mt-2">
                        {selectedLoan.approvals?.supervisor1?.signature ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </div>
                      {selectedLoan.approvals?.supervisor1?.observation && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs text-yellow-800">
                            {selectedLoan.approvals.supervisor1.observation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <h5 className="font-medium text-gray-700 mb-2">Comptable</h5>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedLoan.approvals?.supervisor2?.name || 'En attente'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedLoan.approvals?.supervisor2?.date ? 
                          new Date(selectedLoan.approvals.supervisor2.date).toLocaleDateString('fr-FR') : ''
                        }
                      </p>
                      <div className="mt-2">
                        {selectedLoan.approvals?.supervisor2?.signature ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </div>
                      {selectedLoan.approvals?.supervisor2?.observation && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs text-yellow-800">
                            {selectedLoan.approvals.supervisor2.observation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <h5 className="font-medium text-gray-700 mb-2">Coordonnateur National</h5>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedLoan.approvals?.finalApproval?.name || 'En attente'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedLoan.approvals?.finalApproval?.date ? 
                          new Date(selectedLoan.approvals.finalApproval.date).toLocaleDateString('fr-FR') : ''
                        }
                      </p>
                      <div className="mt-2">
                        {selectedLoan.approvals?.finalApproval?.signature ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </div>
                      {selectedLoan.approvals?.finalApproval?.observation && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs text-yellow-800">
                            {selectedLoan.approvals.finalApproval.observation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loans List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Liste des Prêts
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({sortedLoans.length} prêt{sortedLoans.length > 1 ? 's' : ''})
              </span>
            </h3>
            
            {/* Sélecteur du nombre de lignes par page */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Lignes par page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
        
        {currentLoans.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'Aucun prêt ne correspond aux critères de recherche' 
                : 'Aucun prêt'
              }
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par créer votre première demande de prêt'
              }
            </p>
            {canCreate && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Nouveau Prêt
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('loanNumber')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Prêt</span>
                        {getSortIcon('loanNumber')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('employee.name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Employé</span>
                        {getSortIcon('employee.name')}
                      </div>
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progression
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
                  {currentLoans.map(loan => {
                    const budgetLine = getBudgetLine(loan.budgetLineId);
                    const grant = getGrant(loan.grantId);
                    const totalRepaid = getTotalRepaid(loan);
                    const remainingAmount = getRemainingAmount(loan);
                    const progress = getRepaymentProgress(loan);
                    const isExpanded = expandedRows.has(loan.id);
                    
                    return (
                      <React.Fragment key={loan.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div 
                              className="cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => toggleRowExpansion(loan.id)}
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {isExpanded ? loan.loanNumber : truncateText(loan.loanNumber, 12)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {isExpanded ? budgetLine?.name : truncateText(budgetLine?.name || 'Aucune ligne budgétaire', 20)}
                              </div>
                              {!isExpanded && (
                                <div className="text-xs text-blue-600 mt-1 flex items-center">
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                  Voir plus
                                </div>
                              )}
                              {isExpanded && (
                                <div className="text-xs text-blue-600 mt-1 flex items-center">
                                  <ChevronUp className="w-3 h-3 mr-1" />
                                  Voir moins
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{loan.employee.name}</div>
                            <div className="text-sm text-gray-500">{loan.employee.employeeId}</div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(loan.amount, loan.grantId)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Restant: {formatCurrency(remainingAmount, loan.grantId)}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="text-sm font-medium text-gray-600">
                                {progress.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {/* Signature Coordinateur de la Subvention */}
                              <div className="relative group">
                                {getSignatureIcon(loan, 'supervisor1')}
                                {isSignatureRequired(loan, 'supervisor1') && (
                                  <div className="absolute -top-1 -right-1">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                  </div>
                                )}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                  Coordinateur de la Subvention
                                  {loan.approvals?.supervisor1?.name && (
                                    <div className="font-medium">
                                      {loan.approvals.supervisor1.name}
                                    </div>
                                  )}
                                  {loan.approvals?.supervisor1?.date && (
                                    <div className="text-gray-300">
                                      {new Date(loan.approvals.supervisor1.date).toLocaleDateString('fr-FR')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Signature Comptable */}
                              <div className="relative group">
                                {getSignatureIcon(loan, 'supervisor2')}
                                {isSignatureRequired(loan, 'supervisor2') && (
                                  <div className="absolute -top-1 -right-1">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                  </div>
                                )}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                  Comptable
                                  {loan.approvals?.supervisor2?.name && (
                                    <div className="font-medium">
                                      {loan.approvals.supervisor2.name}
                                    </div>
                                  )}
                                  {loan.approvals?.supervisor2?.date && (
                                    <div className="text-gray-300">
                                      {new Date(loan.approvals.supervisor2.date).toLocaleDateString('fr-FR')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Signature Coordonnateur National */}
                              <div className="relative group">
                                {getSignatureIcon(loan, 'finalApproval')}
                                {isSignatureRequired(loan, 'finalApproval') && (
                                  <div className="absolute -top-1 -right-1">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                  </div>
                                )}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                  Coordonnateur National
                                  {loan.approvals?.finalApproval?.name && (
                                    <div className="font-medium">
                                      {loan.approvals.finalApproval.name}
                                    </div>
                                  )}
                                  {loan.approvals?.finalApproval?.date && (
                                    <div className="text-gray-300">
                                      {new Date(loan.approvals.finalApproval.date).toLocaleDateString('fr-FR')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {canModifyStatus() ? (
                              <>
                                <select
                                  value={loan.status}
                                  onChange={(e) => updateLoanStatus(loan.id, e.target.value as EmployeeLoan['status'])}
                                  className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${LOAN_STATUS[loan.status].color}`}
                                >
                                  <option value="pending">En attente</option>
                                  <option value="approved">Approuvé</option>
                                  <option value="rejected">Rejeté</option>
                                </select>
                                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${LOAN_STATUS[loan.status].color}`}>
                                  {LOAN_STATUS[loan.status].label}
                                </span>
                              </>
                              ): canModifyStatusComptable() ? (
                              <>
                                {loan.status === 'approved' || loan.status === 'active' || loan.status === 'completed'? ( 
                                  <select
                                    value={loan.status}
                                    onChange={(e) => updateLoanStatus(loan.id, e.target.value as EmployeeLoan['status'])}
                                    className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${LOAN_STATUS[loan.status].color}`}
                                  >
                                    <option value="active">En cours</option>
                                    <option value="completed">Remboursé</option>
                                  </select>
                                ) : ''}
                                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${LOAN_STATUS[loan.status].color}`}>
                                  {LOAN_STATUS[loan.status].label}
                                </span>
                              </>
                            ):(
                              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${LOAN_STATUS[loan.status].color}`}>
                                {LOAN_STATUS[loan.status].label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {/* Bouton Voir Détails */}
                              <button
                                onClick={() => handleViewDetails(loan)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Voir les détails"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {loan.status === 'active' && remainingAmount > 0 && userProfession === 'Comptable' && canEdit && (
                                <button
                                  onClick={() => {
                                    setSelectedLoan(loan);
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
                                  onClick={() => handleEditLoan(loan)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Modifier le prêt"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Ligne détaillée expandable */}
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-2">Détails du prêt</h4>
                                  <div className="space-y-1">
                                    <p><span className="font-medium">Description:</span> {loan.description}</p>
                                    <p><span className="font-medium">Date:</span> {new Date(loan.date).toLocaleDateString('fr-FR')}</p>
                                    <p><span className="font-medium">Date remboursement prévue:</span> {new Date(loan.expectedRepaymentDate).toLocaleDateString('fr-FR')}</p>
                                    <p><span className="font-medium">Échéancier:</span> {loan.repaymentSchedule.numberOfInstallments} × {formatCurrency(loan.repaymentSchedule.installmentAmount, loan.grantId)} ({getFrequencyLabel(loan.repaymentSchedule.frequency)})</p>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-2">Remboursements</h4>
                                  <div className="space-y-1">
                                    <p><span className="font-medium">Total remboursé:</span> {formatCurrency(totalRepaid, loan.grantId)}</p>
                                    <p><span className="font-medium">Reste à rembourser:</span> {formatCurrency(remainingAmount, loan.grantId)}</p>
                                    <p><span className="font-medium">Nombre de remboursements:</span> {loan.repayments.length}</p>
                                    {loan.repayments.length > 0 && (
                                      <p><span className="font-medium">Dernier remboursement:</span> {new Date(loan.repayments[loan.repayments.length - 1].date).toLocaleDateString('fr-FR')}</p>
                                    )}
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

            {/* Pagination intégrée au tableau */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-4 border-t border-gray-200 gap-4 bg-gray-50">
                <div className="text-sm text-gray-700">
                  Affichage de {startIndex + 1} à {Math.min(endIndex, sortedLoans.length)} sur {sortedLoans.length} prêts
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-gray-300 flex items-center"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Précédent
                  </button>
                  
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 py-1 text-sm rounded min-w-[40px] ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-gray-300 flex items-center"
                  >
                    Suivant
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeLoanManager;