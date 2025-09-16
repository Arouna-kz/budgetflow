import React, { useState, useRef } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, Download, Printer, User, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { showValidationError, showWarning } from '../utils/alerts';
import { Engagement, BudgetLine, SubBudgetLine, Grant, ENGAGEMENT_STATUS } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface EngagementManagerProps {
  engagements: Engagement[];
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  onAddEngagement: (engagement: Omit<Engagement, 'id'>) => void;
  onUpdateEngagement: (id: string, updates: Partial<Engagement>) => void;
}

const EngagementManager: React.FC<EngagementManagerProps> = ({
  engagements,
  budgetLines,
  subBudgetLines,
  grants,
  onAddEngagement,
  onUpdateEngagement
}) => {
  const [showForm, setShowForm] = useState(false);
  const [showSupplierHistory, setShowSupplierHistory] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [editingEngagement, setEditingEngagement] = useState<Engagement | null>(null);
  const [viewingEngagement, setViewingEngagement] = useState<Engagement | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [formData, setFormData] = useState({
    grantId: '',
    budgetLineId: '',
    subBudgetLineId: '',
    engagementNumber: '',
    amount: '',
    description: '',
    supplier: '',
    quoteReference: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    status: 'processing' as Engagement['status']
  });

  const [approvals, setApprovals] = useState({
    supervisor1: { name: '', signature: false },
    supervisor2: { name: '', signature: false },
    finalApproval: { name: '', signature: false }
  });

  // Références pour les contenus PDF
  const mainContentRef = useRef<HTMLDivElement>(null);
  const signatureContentRef = useRef<HTMLDivElement>(null);

  // Filtrer les engagements par subvention sélectionnée
  const filteredEngagements = engagements;
  const selectedGrant = grants.length > 0 ? grants[0] : null;

  const resetForm = () => {
    setFormData({
      grantId: selectedGrant?.id || '',
      budgetLineId: '',
      subBudgetLineId: '',
      engagementNumber: '',
      amount: '',
      description: '',
      supplier: '',
      quoteReference: '',
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    });
    setApprovals({
      supervisor1: { name: '', signature: false },
      supervisor2: { name: '', signature: false },
      finalApproval: { name: '', signature: false }
    });
    setShowForm(false);
    setEditingEngagement(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.grantId || !formData.budgetLineId || !formData.subBudgetLineId || !formData.amount || !formData.description || !formData.supplier) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, la ligne budgétaire, la sous-ligne budgétaire, le montant, la description et le fournisseur');
      return;
    }

    // Préparer les données d'approbation
    const approvalData: any = {};
    
    if (approvals.supervisor1.name) {
      approvalData.supervisor1 = {
        name: approvals.supervisor1.name,
        date: new Date().toISOString().split('T')[0],
        signature: approvals.supervisor1.signature
      };
    }
    
    if (approvals.supervisor2.name) {
      approvalData.supervisor2 = {
        name: approvals.supervisor2.name,
        date: new Date().toISOString().split('T')[0],
        signature: approvals.supervisor2.signature
      };
    }
    
    if (approvals.finalApproval.name) {
      approvalData.finalApproval = {
        name: approvals.finalApproval.name,
        date: new Date().toISOString().split('T')[0],
        signature: approvals.finalApproval.signature
      };
    }

    if (editingEngagement) {
      onUpdateEngagement(editingEngagement.id, {
        grantId: formData.grantId,
        budgetLineId: formData.budgetLineId,
        subBudgetLineId: formData.subBudgetLineId,
        engagementNumber: formData.engagementNumber,
        amount: parseFloat(formData.amount),
        description: formData.description,
        supplier: formData.supplier,
        quoteReference: formData.quoteReference,
        invoiceNumber: formData.invoiceNumber,
        date: formData.date,
        status: formData.status,
        approvals: approvalData
      });
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const timestamp = String(Date.now()).slice(-6);
      const engagementNumber = `ENG-${year}-${month}-${timestamp}`;
      
      onAddEngagement({
        grantId: formData.grantId,
        budgetLineId: formData.budgetLineId,
        subBudgetLineId: formData.subBudgetLineId,
        engagementNumber: engagementNumber,
        amount: parseFloat(formData.amount),
        description: formData.description,
        supplier: formData.supplier,
        quoteReference: formData.quoteReference,
        invoiceNumber: formData.invoiceNumber,
        date: formData.date,
        status: formData.status,
        approvals: approvalData
      });
    }

    resetForm();
  };

  const startEdit = (engagement: Engagement) => {
    setEditingEngagement(engagement);
    setFormData({
      grantId: engagement.grantId,
      budgetLineId: engagement.budgetLineId,
      subBudgetLineId: engagement.subBudgetLineId,
      engagementNumber: engagement.engagementNumber,
      amount: engagement.amount.toString(),
      description: engagement.description,
      supplier: engagement.supplier || '',
      quoteReference: engagement.quoteReference || '',
      invoiceNumber: engagement.invoiceNumber || '',
      date: engagement.date,
      status: engagement.status
    });

    if (engagement.approvals) {
      setApprovals({
        supervisor1: engagement.approvals.supervisor1 || { name: '', signature: false },
        supervisor2: engagement.approvals.supervisor2 || { name: '', signature: false },
        finalApproval: engagement.approvals.finalApproval || { name: '', signature: false }
      });
    }

    setShowForm(true);
  };

  const viewEngagementDetails = (engagement: Engagement) => {
    setViewingEngagement(engagement);
  };

  const closeEngagementDetails = () => {
    setViewingEngagement(null);
  };

  const getBudgetLine = (budgetLineId: string) => {
    return budgetLines.find(line => line.id === budgetLineId);
  };

  const getSubBudgetLine = (subBudgetLineId: string) => {
    return subBudgetLines.find(line => line.id === subBudgetLineId);
  };

  const getGrant = (grantId: string) => {
    return grants.find(grant => grant.id === grantId);
  };

  const updateEngagementStatus = (engagementId: string, newStatus: Engagement['status']) => {
    onUpdateEngagement(engagementId, { status: newStatus });
  };

  const getSupplierHistory = (supplierName: string) => {
    return engagements.filter(eng => 
      eng.supplier && 
      eng.supplier.toLowerCase().includes(supplierName.toLowerCase()) &&
      eng.id !== editingEngagement?.id
    );
  };

  const showSupplierHistoryModal = (supplierName: string) => {
    setSelectedSupplier(supplierName);
    setShowSupplierHistory(true);
  };

  const exportEngagementForm = async () => {
    const engagement = editingEngagement;
    if (!engagement) return;

    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      // Générer le contenu principal
      const mainContent = generateMainPDFContent(engagement);
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
      const signatureContent = generateSignaturePDFContent(engagement);
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
      pdf.save(`engagement-${engagement.engagementNumber}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      showWarning('Erreur', 'Impossible de générer le PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };


  const generateMainPDFContent = (engagement: Engagement) => {
    const budgetLine = getBudgetLine(engagement.budgetLineId);
    const subBudgetLine = getSubBudgetLine(engagement.subBudgetLineId);
    const grant = getGrant(engagement.grantId);
    const currencySymbol = getCurrencySymbol(grant?.currency || 'EUR');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2c5aa0;">
          <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">FICHE D'ENGAGEMENT</h1>
          <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${engagement.engagementNumber}</h2>
          <p>Date: ${new Date(engagement.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
        </div>
        
        <!-- Informations de la Ligne Budgétaire -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Informations de la Ligne Budgétaire
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
              <strong>Sous-Ligne Budgétaire:</strong>
              <div class="form-field">${subBudgetLine?.code || 'N/A'} - ${subBudgetLine?.name || 'Sous-ligne supprimée'}</div>
            </div>
          </div>
        </div>
        
        <!-- Détails de l'Engagement -->
        <div class="section">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Détails de l'Engagement
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <strong>N° d'Engagement:</strong>
              <div class="form-field">${engagement.engagementNumber}</div>
            </div>
            <div>
              <strong>Date:</strong>
              <div class="form-field">${new Date(engagement.date).toLocaleDateString('fr-FR')}</div>
            </div>
            <div>
              <strong>Fournisseur:</strong>
              <div class="form-field">${engagement.supplier || 'Non spécifié'}</div>
            </div>
            <div>
              <strong>Statut:</strong>
              <div class="form-field">${ENGAGEMENT_STATUS[engagement.status]?.label || engagement.status}</div>
            </div>
            <div>
              <strong>Montant:</strong>
              <div class="form-field">${engagement.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
            </div>
            <div>
              <strong>Devise:</strong>
              <div class="form-field">${grant?.currency || 'EUR'} (${currencySymbol})</div>
            </div>
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>Description:</strong>
            <div class="form-field" style="min-height: 60px;">${engagement.description.replace(/\n/g, '<br>')}</div>
          </div>
          
          ${engagement.quoteReference ? `
          <div style="margin-bottom: 10px;">
            <strong>Référence du Devis:</strong>
            <div class="form-field">${engagement.quoteReference}</div>
          </div>
          ` : ''}
          
          ${engagement.invoiceNumber ? `
          <div>
            <strong>N° de Facture:</strong>
            <div class="form-field">${engagement.invoiceNumber}</div>
          </div>
          ` : ''}
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
          <p>Fiche d'engagement - ${engagement.engagementNumber}</p>
        </div>
      </div>
    `;
  };

  const generateSignaturePDFContent = (engagement: Engagement) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding-top: 50px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c5aa0; margin-bottom: 10px; font-size: 24px;">SIGNATURES D'APPROBATION</h1>
          <h2 style="color: #555; font-size: 18px; margin-bottom: 10px;">${engagement.engagementNumber}</h2>
        </div>
        
        <!-- Signatures -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 16px;">
            Signatures d'Approbation
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div class="signature-box">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordinateur de la subvention</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div class="form-field" style="min-height: 40px;">${approvals.supervisor1.name || '_________________________'}</div>
              <p>Date: ${approvals.supervisor1.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.supervisor1.signature ? '✅ Validée' : '◻ Non validée'}</p>
            </div>
            
            <div class="signature-box">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Comptable</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div class="form-field" style="min-height: 40px;">${approvals.supervisor2.name || '_________________________'}</div>
              <p>Date: ${approvals.supervisor2.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.supervisor2.signature ? '✅ Validée' : '◻ Non validée'}</p>
            </div>
            
            <div class="signature-box">
              <h4 style="font-size: 14px; color: #555; margin-bottom: 15px;">Coordonnateur national</h4>
              <div style="height: 1px; background: #ccc; margin: 20px 0;"></div>
              <div class="form-field" style="min-height: 40px;">${approvals.finalApproval.name || '_________________________'}</div>
              <p>Date: ${approvals.finalApproval.name ? new Date().toLocaleDateString('fr-FR') : '___/___/_____'}</p>
              <p>Signature: ${approvals.finalApproval.signature ? '✅ Validée' : '◻ Non validée'}</p>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #2c5aa0; text-align: center; font-size: 12px; color: #777;">
          <p>Page 2/2 - Signatures d'approbation</p>
          <p>Fiche d'engagement - ${engagement.engagementNumber}</p>
        </div>
      </div>
    `;
  };

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

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Engagements</h2>
          <p className="text-gray-600 mt-1">Suivi et validation des engagements par ligne budgétaire</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (!selectedGrant) {
                showWarning('Aucune subvention', 'Aucune subvention disponible pour ajouter un engagement');
                return;
              }
              setFormData(prev => ({ ...prev, grantId: selectedGrant.id }));
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel Engagement</span>
          </button>
        </div>
      </div>

      {/* Grant Information */}
      {selectedGrant && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedGrant.name}</h3>
              <p className="text-gray-600">{selectedGrant.reference} - {selectedGrant.grantingOrganization}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Devise</p>
              <p className="text-lg font-bold text-blue-600">
                {selectedGrant.currency} ({getCurrencySymbol(selectedGrant.currency)})
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Montant Total</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(selectedGrant.totalAmount, selectedGrant.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Engagements</p>
              <p className="text-xl font-bold text-green-600">{filteredEngagements.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Montant Engagé</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(filteredEngagements.reduce((sum, eng) => sum + eng.amount, 0), selectedGrant.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">En Attente</p>
              <p className="text-xl font-bold text-yellow-600">{filteredEngagements.filter(eng => eng.status === 'pending').length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingEngagement ? 'Modifier l\'engagement' : 'Nouvel engagement'}
                  </h2>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {editingEngagement && (
                  <>
                    <button
                      onClick={exportEngagementForm}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Exporter la fiche"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subvention *
                  </label>
                  <select
                    value={formData.grantId}
                    onChange={(e) => setFormData(prev => ({ ...prev, grantId: e.target.value, budgetLineId: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                    required
                    disabled={!editingEngagement}
                  >
                    <option value="">Sélectionner une subvention</option>
                    {grants.map(grant => (
                      <option key={grant.id} value={grant.id}>
                        {grant.name} ({grant.reference})
                      </option>
                    ))}
                  </select>
                  {!editingEngagement && (
                    <p className="text-xs text-gray-500 mt-1">
                      Subvention sélectionnée automatiquement
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ligne budgétaire *
                  </label>
                  <select
                    value={formData.budgetLineId}
                    onChange={(e) => setFormData(prev => ({ ...prev, budgetLineId: e.target.value, subBudgetLineId: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!formData.grantId}
                  >
                    <option value="">Sélectionner une ligne</option>
                    {budgetLines.filter(line => line.grantId === formData.grantId).map(line => (
                      <option key={line.id} value={line.id}>
                        {line.code} - {line.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sous-ligne budgétaire *
                  </label>
                  <select
                    value={formData.subBudgetLineId}
                    onChange={(e) => setFormData(prev => ({ ...prev, subBudgetLineId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!formData.budgetLineId}
                  >
                    <option value="">Sélectionner une sous-ligne</option>
                    {subBudgetLines.filter(line => line.budgetLineId === formData.budgetLineId).map(line => (
                      <option key={line.id} value={line.id}>
                        {line.code} - {line.name}
                      </option>
                    ))}
                  </select>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant *
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
                    Fournisseur *
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nom du fournisseur"
                      required
                    />
                    {formData.supplier && (
                      <button
                        type="button"
                        onClick={() => showSupplierHistoryModal(formData.supplier)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Voir l'historique du fournisseur"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description de l'engagement..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Référence du devis
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
                    N° Facture
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: FAC-2024-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Engagement['status'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="processing">En traitement</option>
                  <option value="approved">Approuvé</option>
                  <option value="rejected">Rejeté</option>
                </select>
              </div>

              {/* Signatures Section - TOUJOURS VISIBLE MAIS NON OBLIGATOIRE */}
              <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Signatures d'Approbation (Optionnel)
                </h3>
                <p className="text-sm text-yellow-700 mb-4">
                  Vous pouvez ajouter les signatures maintenant ou plus tard lors de la modification.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Responsable 1 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-800">Coordinateur de la Subvention</h4>
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

                  {/* Responsable 2 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-800">Comptable</h4>
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

                  {/* Validation Finale */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-800">Coordonnateur National</h4>
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

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingEngagement ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier History Modal */}
      {showSupplierHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Historique du fournisseur: {selectedSupplier}
              </h3>
              <button
                onClick={() => setShowSupplierHistory(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const supplierEngagements = getSupplierHistory(selectedSupplier);
              const totalEngagements = supplierEngagements.length;
              const totalAmount = supplierEngagements.reduce((sum, eng) => sum + eng.amount, 0);
              const approvedAmount = supplierEngagements
                .filter(eng => eng.status === 'approved' || eng.status === 'paid')
                .reduce((sum, eng) => sum + eng.amount, 0);

              return (
                <div className="space-y-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Total Engagements</p>
                      <p className="text-2xl font-bold text-blue-900">{totalEngagements}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600 font-medium">Montant Total</p>
                      <p className="text-2xl font-bold text-green-900">
                        {totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600 font-medium">Montant Approuvé</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {approvedAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                  </div>

                  {/* Engagements List */}
                  {totalEngagements === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Aucun engagement trouvé pour ce fournisseur
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {supplierEngagements.map(engagement => {
                        const budgetLine = getBudgetLine(engagement.budgetLineId);
                        const grant = getGrant(engagement.grantId);
                        
                        return (
                          <div key={engagement.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h4 className="font-medium text-gray-900">{engagement.engagementNumber}</h4>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${ENGAGEMENT_STATUS[engagement.status].color}`}>
                                    {ENGAGEMENT_STATUS[engagement.status].label}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">{engagement.description}</p>
                                <p className="text-xs text-gray-500">
                                  {budgetLine?.name} • {grant?.name} • {new Date(engagement.date).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900">
                                  {engagement.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Engagement Details Modal */}
      {viewingEngagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Détails de l'engagement</h2>
              <button
                onClick={closeEngagementDetails}
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
                      <label className="block text-sm font-medium text-gray-600">Numéro d'engagement</label>
                      <p className="text-sm text-gray-900">{viewingEngagement.engagementNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Date</label>
                      <p className="text-sm text-gray-900">{new Date(viewingEngagement.date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Statut</label>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${ENGAGEMENT_STATUS[viewingEngagement.status].color}`}>
                        {ENGAGEMENT_STATUS[viewingEngagement.status].label}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations financières</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Montant </label>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(viewingEngagement.amount, selectedGrant?.currency || 'EUR')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Fournisseur</label>
                      <p className="text-sm text-gray-900">{viewingEngagement.supplier || 'Non spécifié'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lignes budgétaires</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Ligne budgétaire</label>
                    {(() => {
                      const budgetLine = getBudgetLine(viewingEngagement.budgetLineId);
                      return (
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{budgetLine?.name || 'Ligne supprimée'}</p>
                          <p className="text-xs text-gray-600">Code: {budgetLine?.code || 'N/A'}</p>
                          {budgetLine && (
                            <p className="text-xs text-gray-600">
                              Budget: {formatCurrency(budgetLine.notifiedAmount, selectedGrant?.currency || 'EUR')}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600">Sous-ligne budgétaire</label>
                    {(() => {
                      const subBudgetLine = getSubBudgetLine(viewingEngagement.subBudgetLineId);
                      return (
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{subBudgetLine?.name || 'Sous-ligne supprimée'}</p>
                          <p className="text-xs text-gray-600">Code: {subBudgetLine?.code || 'N/A'}</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900">{viewingEngagement.description}</p>
                </div>
              </div>

              {viewingEngagement.quoteReference && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Références</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Référence du devis</label>
                      <p className="text-sm text-gray-900">{viewingEngagement.quoteReference}</p>
                    </div>
                    {viewingEngagement.invoiceNumber && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600">N° de Facture</label>
                        <p className="text-sm text-gray-900">{viewingEngagement.invoiceNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewingEngagement.approvals && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Signatures d'approbation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {viewingEngagement.approvals.supervisor1 && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800">Coordinateur de la Subvention</h4>
                        <p className="text-sm text-gray-900">{viewingEngagement.approvals.supervisor1.name}</p>
                        <p className="text-xs text-gray-600">
                          Signé: {viewingEngagement.approvals.supervisor1.signature ? 'Oui' : 'Non'}
                        </p>
                      </div>
                    )}
                    {viewingEngagement.approvals.supervisor2 && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800">Comptable</h4>
                        <p className="text-sm text-gray-900">{viewingEngagement.approvals.supervisor2.name}</p>
                        <p className="text-xs text-gray-600">
                          Signé: {viewingEngagement.approvals.supervisor2.signature ? 'Oui' : 'Non'}
                        </p>
                      </div>
                    )}
                    {viewingEngagement.approvals.finalApproval && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800">Coordonnateur National</h4>
                        <p className="text-sm text-gray-900">{viewingEngagement.approvals.finalApproval.name}</p>
                        <p className="text-xs text-gray-600">
                          Signé: {viewingEngagement.approvals.finalApproval.signature ? 'Oui' : 'Non'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Engagements List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {engagements.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun engagement</h3>
            <p className="text-gray-500 mb-4">Commencez par ajouter votre premier engagement</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Nouvel engagement
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ligne budgétaire
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sous-ligne budgétaire
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
                {filteredEngagements.map(engagement => {
                  const budgetLine = getBudgetLine(engagement.budgetLineId);
                  const subBudgetLine = getSubBudgetLine(engagement.subBudgetLineId);
                  const grant = getGrant(engagement.grantId);
                  
                  return (
                    <tr key={engagement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{engagement.engagementNumber}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(engagement.date).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900" title={budgetLine?.name || 'Ligne supprimée'}>
                          {truncateText(budgetLine?.name || 'Ligne supprimée', 25)}
                        </div>
                        <div className="text-sm text-gray-500">{budgetLine?.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900" title={subBudgetLine?.name || 'Sous-ligne supprimée'}>
                          {truncateText(subBudgetLine?.name || 'Sous-ligne supprimée', 25)}
                        </div>
                        <div className="text-sm text-gray-500">{subBudgetLine?.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => engagement.supplier && showSupplierHistoryModal(engagement.supplier)}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title={engagement.supplier || 'Non spécifié'}
                        >
                          {truncateText(engagement.supplier || 'Non spécifié', 20)}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {grant ? formatCurrency(engagement.amount, grant.currency) : engagement.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <select
                          value={engagement.status}
                          onChange={(e) => updateEngagementStatus(engagement.id, e.target.value as Engagement['status'])}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${ENGAGEMENT_STATUS[engagement.status].color}`}
                        >
                          <option value="pending">En attente</option>
                          <option value="approved">Approuvé</option>
                          <option value="rejected">Rejeté</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => viewEngagementDetails(engagement)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Voir les détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEdit(engagement)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
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

export default EngagementManager;