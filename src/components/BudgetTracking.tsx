import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Eye, FileText, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Filter, Menu, X } from 'lucide-react';
import { BudgetLine, SubBudgetLine, Grant, Engagement } from '../types';
import jsPDF from 'jspdf';
import { showSuccess, showError, showValidationError, confirmDelete, showWarning } from '../utils/alerts';
import { usePermissions } from '../hooks/usePermissions';

interface BudgetTrackingProps {
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  grants: Grant[];
  engagements: Engagement[];
  selectedGrantId: string;
  onViewEngagements: (subBudgetLineId: string) => void;
}

type SortField = 'name' | 'code' | 'notifiedAmount' | 'engagedAmount' | 'spentAmount' | 'availableAmount' | 'engagementRate' | 'spentRate';
type SortDirection = 'asc' | 'desc';

const BudgetTracking: React.FC<BudgetTrackingProps> = ({ 
  budgetLines, 
  subBudgetLines, 
  grants, 
  engagements, 
  selectedGrantId, 
  onViewEngagements 
}) => {
  // 1. TOUS les hooks doivent être appelés AVANT toute logique conditionnelle
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedBudgetLines, setSelectedBudgetLines] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  

  // Vérification des permissions
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();

   // Définition des permissions spécifiques au module
  const canView = hasPermission('tracking', 'view');
  const canExport = hasPermission('tracking', 'export');
  const canViewDetails = hasPermission('tracking', 'view_details');

  // Utiliser directement les données filtrées par l'App
  const filteredBudgetLines = budgetLines;
  const filteredSubBudgetLines = subBudgetLines;
  const selectedGrant = grants.length > 0 ? grants[0] : null;

  // Détection de la taille d'écran
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Filtrer les sous-lignes budgétaires selon les sélections
  const getFilteredSubBudgetLines = () => {
    if (selectedBudgetLines.length === 0) {
      return filteredSubBudgetLines;
    }
    return filteredSubBudgetLines.filter(line => 
      selectedBudgetLines.includes(line.budgetLineId)
    );
  };

  const filteredSubBudgetLinesData = getFilteredSubBudgetLines();

  // Réinitialiser la page quand les données changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filteredSubBudgetLinesData.length, selectedBudgetLines]);

  // 2. MAINTENANT nous pouvons faire la vérification conditionnelle
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

  if (!hasModuleAccess('tracking')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder à ce module.</p>
        </div>
      </div>
    );
  }

 
  // Calculer le montant décaissé pour chaque sous-ligne budgétaire
  const getSpentAmount = (subBudgetLineId: string) => {
    const lineEngagements = engagements.filter(eng => 
      eng.subBudgetLineId === subBudgetLineId && 
      (eng.status === 'paid' || eng.status === 'approved')
    );
    return lineEngagements.reduce((sum, eng) => sum + eng.amount, 0);
  };

  const getEngagementRate = (line: SubBudgetLine) => {
    return line.notifiedAmount > 0 ? (line.engagedAmount / line.notifiedAmount) * 100 : 0;
  };

  const getSpentRate = (line: SubBudgetLine) => {
    const spentAmount = getSpentAmount(line.id);
    return line.notifiedAmount > 0 ? (spentAmount / line.notifiedAmount) * 100 : 0;
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  

  const totalNotified = filteredSubBudgetLinesData.reduce((sum, line) => sum + line.notifiedAmount, 0);
  const totalEngaged = filteredSubBudgetLinesData.reduce((sum, line) => sum + line.engagedAmount, 0);
  const totalAvailable = filteredSubBudgetLinesData.reduce((sum, line) => sum + line.availableAmount, 0);
  const totalSpent = filteredSubBudgetLinesData.reduce((sum, line) => sum + getSpentAmount(line.id), 0);
  const overallEngagementRate = totalNotified > 0 ? (totalEngaged / totalNotified) * 100 : 0;
  const overallSpentRate = totalNotified > 0 ? (totalSpent / totalNotified) * 100 : 0;

  const alertLines = filteredSubBudgetLinesData.filter(line => {
    const engagementRate = getEngagementRate(line);
    return engagementRate > 90;
  });

  const formatCurrency = (amount: number, currency: Grant['currency']) => {
    return amount.toLocaleString('fr-FR', { 
      style: 'currency', 
      currency: currency === 'XOF' ? 'XOF' : currency,
      minimumFractionDigits: currency === 'XOF' ? 0 : 2
    });
  };

  // Calculer les statistiques par ligne budgétaire
  const budgetLineStats = filteredBudgetLines.map(budgetLine => {
    const subLines = filteredSubBudgetLinesData.filter(line => line.budgetLineId === budgetLine.id);
    const notified = subLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
    const engaged = subLines.reduce((sum, line) => sum + line.engagedAmount, 0);
    const available = subLines.reduce((sum, line) => sum + line.availableAmount, 0);
    const spent = subLines.reduce((sum, line) => sum + getSpentAmount(line.id), 0);
    
    
    return {
      ...budgetLine,
      notified,
      engaged,
      available,
      spent,
      engagementRate: notified > 0 ? (engaged / notified) * 100 : 0,
      spentRate: notified > 0 ? (spent / notified) * 100 : 0
    };
  }).filter(line => line.notified > 0);

  

  // Préparer les données avec toutes les métriques calculées
  const tableData = filteredSubBudgetLinesData.map(line => {
    const spentAmount = getSpentAmount(line.id);
    const engagementRate = getEngagementRate(line);
    const spentRate = getSpentRate(line);
    const budgetLine = budgetLines.find(bl => bl.id === line.budgetLineId);
    const lineGrant = grants.find(g => g.id === line.grantId);
    const lineEngagements = engagements.filter(eng => eng.subBudgetLineId === line.id);

    return {
      ...line,
      spentAmount,
      engagementRate,
      spentRate,
      budgetLineName: budgetLine?.name || 'Ligne supprimée',
      budgetLineCode: budgetLine?.code || 'N/A',
      grantCurrency: lineGrant?.currency || 'EUR',
      engagementsCount: lineEngagements.length
    };
  });

  // Filtrer et trier les données
  const filteredAndSortedData = tableData
    .filter(line => 
      line.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      line.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      line.budgetLineName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'name' || sortField === 'code' || sortField === 'budgetLineName') {
        aValue = aValue?.toLowerCase() || '';
        bValue = bValue?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 opacity-30" />;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" /> : 
      <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />;
  };

  // Gestion de la sélection des lignes budgétaires
  const toggleBudgetLineSelection = (budgetLineId: string) => {
    setSelectedBudgetLines(prev =>
      prev.includes(budgetLineId)
        ? prev.filter(id => id !== budgetLineId)
        : [...prev, budgetLineId]
    );
  };

  const selectAllBudgetLines = () => {
    setSelectedBudgetLines(filteredBudgetLines.map(bl => bl.id));
  };

  const clearBudgetLineSelection = () => {
    setSelectedBudgetLines([]);
  };

  // Fonction pour exporter le tableau en PDF avec vérification de permission
  const exportTableToPDF = async (exportAllData: boolean = false) => {
    if (!canExport) {
      showError('Permission refusée', 'Vous n\'avez pas la permission d\'exporter des données');
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerHeight = 50;
  
      const dataToExport = exportAllData ? filteredAndSortedData : paginatedData;
      
      if (dataToExport.length === 0) {
        alert('Aucune donnée à exporter');
        return;
      }
  
      const columnConfig = [
        { key: 'name', label: 'Sous-ligne', width: 60, align: 'left' },
        { key: 'code', label: 'Code', width: 20, align: 'center' },
        { key: 'budgetLineName', label: 'Ligne budgétaire', width: 50, align: 'left' },
        { key: 'notifiedAmount', label: 'Budget notifié', width: 30, align: 'right' },
        { key: 'engagedAmount', label: 'Engagé', width: 30, align: 'right' },
        { key: 'spentAmount', label: 'Décaissé', width: 30, align: 'right' },
        { key: 'availableAmount', label: 'Solde', width: 30, align: 'right' },
        { key: 'engagementRate', label: 'Taux Eng.', width: 22, align: 'center' },
        { key: 'spentRate', label: 'Taux Dép.', width: 22, align: 'center' }
      ];
  
      const totalWidth = columnConfig.reduce((sum, col) => sum + col.width, 0);
      const scaleFactor = (pageWidth - (margin * 2)) / totalWidth;
      columnConfig.forEach(col => { col.width *= scaleFactor; });
  
      // Fonction splitText SANS troncature
      const splitText = (text: string, maxWidth: number) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
  
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = currentLine ? currentLine + ' ' + word : word;
          
          if (pdf.getTextWidth(testLine) <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
            }
            currentLine = word;
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines;
      };
  
      const formatNumberWithSpaces = (number: number, currency: string = 'XOF') => {
        if (currency === 'XOF') {
          return Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
        
        const parts = number.toFixed(2).split('.');
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const decimalPart = parts[1];
        
        return decimalPart === '00' ? integerPart : `${integerPart}.${decimalPart}`;
      };
  
      let currentY = margin + headerHeight;
      let currentPage = 0;
  
      // En-tête pour la première page
      const drawHeader = () => {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SUIVI BUDGÉTAIRE DÉTAILLÉ', margin, margin + 10);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Détail par Sous-ligne Budgétaire', margin, margin + 18);
        
        if (selectedGrant) {
          pdf.text(`Subvention: ${selectedGrant.name}`, margin, margin + 26);
          pdf.text(`Référence: ${selectedGrant.reference}`, margin, margin + 32);
          pdf.text(`Devise: ${selectedGrant.currency}`, margin, margin + 38);
        }
      };
  
      drawHeader();
  
      // En-têtes du tableau
      let xPosition = margin;
      pdf.setFillColor(59, 130, 246);
      pdf.rect(xPosition, currentY, pageWidth - (margin * 2), 10, 'F');
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      
      columnConfig.forEach((col) => {
        const textWidth = pdf.getTextWidth(col.label);
        let x = xPosition;
        
        if (col.align === 'center') {
          x = xPosition + (col.width - textWidth) / 2;
        } else if (col.align === 'right') {
          x = xPosition + col.width - textWidth - 2;
        } else {
          x = xPosition + 2;
        }
        
        pdf.text(col.label, Math.max(x, xPosition + 2), currentY + 7);
        xPosition += col.width;
      });
  
      currentY += 16;
  
      // Données
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
  
      dataToExport.forEach((line, rowIndex) => {
        if (currentY > pageHeight - 30) {
          pdf.addPage();
          currentPage++;
          currentY = margin + headerHeight + 16;
          drawHeader();
          
          xPosition = margin;
          pdf.setFillColor(59, 130, 246);
          pdf.rect(xPosition, currentY, pageWidth - (margin * 2), 10, 'F');
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          
          columnConfig.forEach((col) => {
            const textWidth = pdf.getTextWidth(col.label);
            let x = xPosition;
            
            if (col.align === 'center') {
              x = xPosition + (col.width - textWidth) / 2;
            } else if (col.align === 'right') {
              x = xPosition + col.width - textWidth - 2;
            } else {
              x = xPosition + 2;
            }
            
            pdf.text(col.label, Math.max(x, xPosition + 2), currentY + 7);
            xPosition += col.width;
          });
          
          currentY += 16;
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
        }
  
        // Fond alterné
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, currentY - 4, pageWidth - (margin * 2), 12, 'F');
        }
  
        pdf.setFontSize(8);
        xPosition = margin;
        let maxLinesInRow = 1;
  
        columnConfig.forEach((col) => {
          let value: any = line[col.key as keyof typeof line];
          let displayValue = '';
  
          if (col.key === 'engagementRate' || col.key === 'spentRate') {
            displayValue = typeof value === 'number' ? `${value.toFixed(1)}%` : '0%';
          } else if (col.key.includes('Amount')) {
            displayValue = typeof value === 'number' ? formatNumberWithSpaces(value) : '0';
          } else {
            displayValue = value?.toString() || '';
          }
  
          if (col.key === 'name' || col.key === 'budgetLineName') {
            const lines = splitText(displayValue, col.width - 4);
            
            lines.forEach((lineText, lineIndex) => {
              pdf.text(lineText, xPosition + 2, currentY + 2 + (lineIndex * 3.5));
            });
            
            maxLinesInRow = Math.max(maxLinesInRow, lines.length);
          } else {
            let x = xPosition;
            
            if (col.align === 'center') {
              const textWidth = pdf.getTextWidth(displayValue);
              x = xPosition + (col.width - textWidth) / 2;
            } else if (col.align === 'right') {
              const textWidth = pdf.getTextWidth(displayValue);
              x = xPosition + col.width - textWidth - 2;
            } else {
              x = xPosition + 2;
            }
  
            // Couleurs conditionnelles
            if (col.key === 'availableAmount' && value < 0) {
              pdf.setTextColor(220, 38, 38);
            } else if (col.key === 'engagementRate' || col.key === 'spentRate') {
              if (value > 90) pdf.setTextColor(220, 38, 38);
              else if (value > 75) pdf.setTextColor(234, 88, 12);
              else if (col.key === 'engagementRate') pdf.setTextColor(5, 150, 105);
              else pdf.setTextColor(59, 130, 246);
            }
  
            pdf.text(displayValue, x, currentY + 2);
            pdf.setTextColor(0, 0, 0);
          }
  
          xPosition += col.width;
        });
  
        currentY += 5 + (maxLinesInRow * 3.5);
      });
  
      // Télécharger le PDF
      const fileName = `suivi-budgetaire-complet-${selectedGrant?.reference || 'global'}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      showSuccess('Export réussi', 'Le fichier PDF a été généré avec succès');
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      showError('Erreur', 'Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  

  // Composant pour les cartes statistiques responsive
  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
          <p className={`text-lg sm:text-xl font-bold ${color} truncate`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
        </div>
        <div className={`p-2 ${color.replace('text-', 'bg-').replace('-600', '-100')} rounded-full flex-shrink-0 ml-2`}>
          <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
        </div>
      </div>
    </div>
  );

  // Si l'utilisateur n'a pas la permission de view, on n'affiche que le message d'accès refusé
  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour visualiser le suivi budgétaire.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4">
      {/* Header Mobile avec menu burger */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Suivi Budgétaire</h2>
            <p className="text-sm text-gray-600 mt-1">Suivi en temps réel</p>
          </div>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 bg-gray-100 rounded-lg"
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Menu mobile */}
        {showMobileMenu && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-4">
            <div className="space-y-3">
              <button
                onClick={() => setShowFilterModal(true)}
                className={`w-full px-3 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 ${
                  selectedBudgetLines.length > 0 
                    ? 'bg-orange-100 text-orange-700 border border-orange-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filtrer ({selectedBudgetLines.length})</span>
              </button>

              {canExport && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => exportTableToPDF(false)}
                    disabled={isGeneratingPDF}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-center space-x-1 disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    <span>PDF Page</span>
                  </button>
                  
                  <button
                    onClick={() => exportTableToPDF(true)}
                    disabled={isGeneratingPDF}
                    className="bg-green-600 text-white px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-center space-x-1 disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    <span>PDF Complet</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Header Desktop */}
      <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Suivi Budgétaire</h2>
          <p className="text-gray-600 mt-1">Suivi en temps réel de l'exécution budgétaire</p>
          {selectedBudgetLines.length > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              Filtrage actif: {selectedBudgetLines.length} ligne(s) budgétaire(s) sélectionnée(s)
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilterModal(true)}
            className={`px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2 ${
              selectedBudgetLines.length > 0 
                ? 'bg-orange-100 text-orange-700 border border-orange-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtrer ({selectedBudgetLines.length})</span>
          </button>

          {canExport && (
            <div className="flex space-x-2">
              <button
                onClick={() => exportTableToPDF(false)}
                disabled={isGeneratingPDF}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPDF ? 'Génération...' : 'PDF Page'}</span>
              </button>
              
              <button
                onClick={() => exportTableToPDF(true)}
                disabled={isGeneratingPDF}
                className="bg-green-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-700 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPDF ? 'Génération...' : 'PDF Complet'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards - Version ultra-responsive */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          title="Budget Notifié"
          value={selectedGrant ? formatCurrency(totalNotified, selectedGrant.currency) : totalNotified.toLocaleString('fr-FR')}
          icon={TrendingUp}
          color="text-blue-600"
        />
        <StatCard
          title="Montant Engagé"
          value={selectedGrant ? formatCurrency(totalEngaged, selectedGrant.currency) : totalEngaged.toLocaleString('fr-FR')}
          icon={CheckCircle}
          color="text-green-600"
        />
        <StatCard
          title="Montant Décaissé"
          value={selectedGrant ? formatCurrency(totalSpent, selectedGrant.currency) : totalSpent.toLocaleString('fr-FR')}
          icon={FileText}
          color="text-purple-600"
        />
        <StatCard
          title="Solde Disponible"
          value={selectedGrant ? formatCurrency(totalAvailable, selectedGrant.currency) : totalAvailable.toLocaleString('fr-FR')}
          icon={TrendingUp}
          color="text-orange-600"
        />
        <StatCard
          title="Taux d'Engagement"
          value={`${overallEngagementRate.toFixed(1)}%`}
          subtitle={`Décaissé: ${overallSpentRate.toFixed(1)}%`}
          icon={AlertTriangle}
          color="text-red-600"
        />
      </div>

      {/* Tableau avec version mobile simplifiée */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Détail par Sous-ligne
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({filteredAndSortedData.length})
              </span>
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="w-3 h-3 sm:w-4 sm:h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-sm"
                />
              </div>

              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="5">5 lignes</option>
                <option value="10">10 lignes</option>
                <option value="20">20 lignes</option>
                <option value="50">50 lignes</option>
              </select>
            </div>
          </div>
        </div>
        
        {filteredSubBudgetLines.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-900 mb-1">
              {selectedGrantId ? 'Aucune sous-ligne budgétaire' : 'Aucune sous-ligne'}
            </h3>
            <p className="text-gray-500 text-sm">
              {selectedGrantId ? 'Aucune sous-ligne n\'a été créée' : 'Sélectionnez une subvention'}
            </p>
          </div>
        ) : (
          <>
            {/* Version mobile simplifiée */}
            {isMobileView ? (
              <div className="p-3 space-y-3">
                {paginatedData.map((line, index) => (
                  <div key={line.id} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{line.name}</h4>
                        <p className="text-xs text-gray-600">{line.code} • {line.budgetLineName}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        line.engagementRate > 90 ? 'bg-red-100 text-red-800' :
                        line.engagementRate > 75 ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {line.engagementRate.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Notifié:</span>
                        <p className="font-medium">{formatCurrency(line.notifiedAmount, line.grantCurrency)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Engagé:</span>
                        <p className="font-medium">{formatCurrency(line.engagedAmount, line.grantCurrency)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Décaissé:</span>
                        <p className="font-medium text-blue-600">{formatCurrency(line.spentAmount, line.grantCurrency)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Solde:</span>
                        <p className={`font-medium ${line.availableAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(line.availableAmount, line.grantCurrency)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">Taux décaissé: {line.spentRate.toFixed(1)}%</span>
                      {canViewDetails && (
                        <button
                          onClick={() => onViewEngagements(line.id)}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                        >
                          Détails ({line.engagementsCount})
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Version desktop complète */
              <div className="overflow-x-auto">
                <table ref={tableRef} className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                        <div className="flex items-center space-x-1">
                          <span>Sous-ligne</span>
                          <SortIcon field="name" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('code')}>
                        <div className="flex items-center space-x-1">
                          <span>Code</span>
                          <SortIcon field="code" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ligne budgétaire</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('notifiedAmount')}>
                        <div className="flex items-center justify-end space-x-1">
                          <span>Notifié</span>
                          <SortIcon field="notifiedAmount" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('engagedAmount')}>
                        <div className="flex items-center justify-end space-x-1">
                          <span>Engagé</span>
                          <SortIcon field="engagedAmount" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('spentAmount')}>
                        <div className="flex items-center justify-end space-x-1">
                          <span>Décaissé</span>
                          <SortIcon field="spentAmount" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('availableAmount')}>
                        <div className="flex items-center justify-end space-x-1">
                          <span>Solde</span>
                          <SortIcon field="availableAmount" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('engagementRate')}>
                        <div className="flex items-center justify-center space-x-1">
                          <span>Taux Eng.</span>
                          <SortIcon field="engagementRate" />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('spentRate')}>
                        <div className="flex items-center justify-center space-x-1">
                          <span>Taux Dép.</span>
                          <SortIcon field="spentRate" />
                        </div>
                      </th>
                      {canViewDetails && (
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedData.map(line => (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 max-w-[120px]">
                          <div className="text-sm font-medium text-gray-900 truncate" title={line.name}>{line.name}</div>
                        </td>
                        <td className="px-3 py-2"><div className="text-xs text-gray-500">{line.code}</div></td>
                        <td className="px-3 py-2 max-w-[100px]">
                          <div className="text-sm text-gray-900 truncate" title={line.budgetLineName}>{line.budgetLineName}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{formatCurrency(line.notifiedAmount, line.grantCurrency)}</td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">{formatCurrency(line.engagedAmount, line.grantCurrency)}</td>
                        <td className="px-3 py-2 text-right text-sm text-blue-600 font-medium">{formatCurrency(line.spentAmount, line.grantCurrency)}</td>
                        <td className={`px-3 py-2 text-right text-sm font-medium ${line.availableAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(line.availableAmount, line.grantCurrency)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-medium ${getEngagementColor(line.engagementRate)}`}>
                            {line.engagementRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-medium ${getEngagementColor(line.spentRate)}`}>
                            {line.spentRate.toFixed(1)}%
                          </span>
                        </td>
                        {canViewDetails && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => onViewEngagements(line.id)}
                              className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Détails
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination responsive */}
            {totalPages > 1 && (
              <div className="p-3 sm:p-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Lignes {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedData.length)} sur {filteredAndSortedData.length}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 3) pageNum = i + 1;
                        else if (currentPage === 1) pageNum = i + 1;
                        else if (currentPage === totalPages) pageNum = totalPages - 2 + i;
                        else pageNum = currentPage - 1 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 rounded text-xs ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Contenu principal en colonne sur mobile */}
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Suivi par Ligne Budgétaire */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Suivi par Ligne Budgétaire</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {budgetLineStats.map(budgetLine => (
              <div key={budgetLine.id} className="space-y-2 p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${budgetLine.color} flex-shrink-0`}>
                      {budgetLine.code}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">{budgetLine.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className="text-xs text-gray-600 block">Engagé: {budgetLine.engagementRate.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500">Décaissé: {budgetLine.spentRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      budgetLine.engagementRate > 90 ? 'bg-red-500' :
                      budgetLine.engagementRate > 75 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetLine.engagementRate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-orange-500" />
            Alertes Budgétaires
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alertLines.map(line => {
              const engagementRate = getEngagementRate(line);
              const spentRate = getSpentRate(line);
              return (
                <div key={line.id} className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{line.name}</p>
                      <p className="text-xs text-gray-600 truncate">{line.code}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-semibold text-orange-600 text-sm">{engagementRate.toFixed(1)}% engagé</p>
                      <p className="text-xs text-gray-600">{spentRate.toFixed(1)}% décaissé</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {alertLines.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 font-medium text-sm">Aucune alerte</p>
                <p className="text-xs text-gray-500">Tous les budgets sont sous contrôle</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de filtrage */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Filtrer par Ligne Budgétaire</h3>
              <button onClick={() => setShowFilterModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex space-x-2">
                <button onClick={selectAllBudgetLines} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md">
                  Tout sélectionner
                </button>
                <button onClick={clearBudgetLineSelection} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md">
                  Tout désélectionner
                </button>
              </div>
              
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                {filteredBudgetLines.map(budgetLine => (
                  <label key={budgetLine.id} className="flex items-center p-3 hover:bg-gray-50 border-b last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selectedBudgetLines.includes(budgetLine.id)}
                      onChange={() => toggleBudgetLineSelection(budgetLine.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm truncate">
                      <span className="font-medium">{budgetLine.code}</span> - {budgetLine.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t">
              <button onClick={() => setShowFilterModal(false)} className="px-4 py-2 text-gray-700 border rounded-lg">
                Annuler
              </button>
              <button onClick={() => setShowFilterModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTracking;