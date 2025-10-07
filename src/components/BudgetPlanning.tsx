import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, Calendar, AlertCircle, ChevronDown, ChevronRight, ChevronLeft, SortAsc, SortDesc, Download } from 'lucide-react';
import { showSuccess, showError, showValidationError, confirmDelete, showWarning } from '../utils/alerts';
import { BudgetLine, SubBudgetLine, Grant } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import jsPDF from 'jspdf';

// Interface des propriétés du composant
interface BudgetPlanningProps {
    budgetLines: BudgetLine[];
    subBudgetLines: SubBudgetLine[];
    grants: Grant[];
    onAddBudgetLine: (budgetLine: Omit<BudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => void;
    onAddSubBudgetLine: (subBudgetLine: Omit<SubBudgetLine, 'id' | 'engagedAmount' | 'availableAmount'>) => void;
    onUpdateBudgetLine: (id: string, updates: Partial<BudgetLine>) => void;
    onUpdateSubBudgetLine: (id: string, updates: Partial<SubBudgetLine>) => void;
    onDeleteBudgetLine: (id: string) => void;
    onDeleteSubBudgetLine: (id: string) => void;
}

const BudgetPlanning: React.FC<BudgetPlanningProps> = ({
    budgetLines,
    subBudgetLines,
    grants,
    onAddBudgetLine,
    onAddSubBudgetLine,
    onUpdateBudgetLine,
    onUpdateSubBudgetLine,
    onDeleteBudgetLine,
    onDeleteSubBudgetLine
}) => {
    // États pour la gestion des formulaires et de l'interface
    const [showBudgetLineForm, setShowBudgetLineForm] = useState(false);
    const [showSubBudgetLineForm, setShowSubBudgetLineForm] = useState(false);
    const [editingBudgetLine, setEditingBudgetLine] = useState<BudgetLine | null>(null);
    const [editingSubBudgetLine, setEditingSubBudgetLine] = useState<SubBudgetLine | null>(null);
    const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>('');
    const [expandedBudgetLines, setExpandedBudgetLines] = useState<Set<string>>(new Set());

    // États pour le tri et la pagination
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'code',
        direction: 'asc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // États pour le suivi des modifications
    const [modifiedBudgetLines, setModifiedBudgetLines] = useState<Set<string>>(new Set());
    const [modifiedSubBudgetLines, setModifiedSubBudgetLines] = useState<Set<string>>(new Set());
    // États pour la gestion du texte tronqué
    const [expandedText, setExpandedText] = useState<Set<string>>(new Set());
    // Réf pour l'export PDF
    const pdfRef = useRef<HTMLDivElement>(null);
    // États des formulaires
    const [budgetLineFormData, setBudgetLineFormData] = useState({
        grantId: '',
        code: '',
        name: '',
        plannedAmount: '',
        notifiedAmount: '',
        description: '',
        color: 'bg-blue-100 text-blue-700'
    });
    const [subBudgetLineFormData, setSubBudgetLineFormData] = useState({
        grantId: '',
        budgetLineId: '',
        code: '',
        name: '',
        plannedAmount: '',
        notifiedAmount: '',
        description: ''
    });
    // Vérification des permissions
    const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();

    // États dérivés pour le filtrage
    const selectedGrant = grants.length > 0 ? grants[0] : null;
    const filteredBudgetLines = budgetLines;
    const filteredSubBudgetLines = subBudgetLines;

    // Chargement initial - marquer les éléments modifiés existants
    useEffect(() => {
        const savedModifiedBudgetLines = localStorage.getItem('modifiedBudgetLines');
        const savedModifiedSubBudgetLines = localStorage.getItem('modifiedSubBudgetLines');

        if (savedModifiedBudgetLines) {
            setModifiedBudgetLines(new Set(JSON.parse(savedModifiedBudgetLines)));
        }
        if (savedModifiedSubBudgetLines) {
            setModifiedSubBudgetLines(new Set(JSON.parse(savedModifiedSubBudgetLines)));
        }
    }, []);

    // Sauvegarde des modifications dans le localStorage
    useEffect(() => {
        localStorage.setItem('modifiedBudgetLines', JSON.stringify([...modifiedBudgetLines]));
        localStorage.setItem('modifiedSubBudgetLines', JSON.stringify([...modifiedSubBudgetLines]));
    }, [modifiedBudgetLines, modifiedSubBudgetLines]);

    const markBudgetLineAsModified = (id: string) => {
        setModifiedBudgetLines(prev => new Set(prev).add(id));
    };

    const markSubBudgetLineAsModified = (id: string) => {
        setModifiedSubBudgetLines(prev => new Set(prev).add(id));
    };

    const toggleTextExpansion = (id: string) => {
        const newExpanded = new Set(expandedText);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedText(newExpanded);
    };

    // Fonctions de tri et pagination
    const sortedBudgetLines = useMemo(() => {
        const sortableItems = [...filteredBudgetLines];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof BudgetLine];
                const bValue = b[sortConfig.key as keyof BudgetLine];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredBudgetLines, sortConfig]);

    const paginatedBudgetLines = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedBudgetLines.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedBudgetLines, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedBudgetLines.length / itemsPerPage);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const getCurrencySymbolForPDF = (currency: Grant['currency']) => {
      switch (currency) {
          case 'EUR': return '€';
          case 'USD': return '$';
          case 'XOF': return 'CFA';
          default: return '€';
      }
    };

    const formatCurrencyForPDF = (amount: number, currency: Grant['currency']) => {
      // Formater le nombre avec des espaces comme séparateurs de milliers
      const formattedAmount = amount.toLocaleString('fr-FR', {
        minimumFractionDigits: currency === 'XOF' ? 0 : 2,
        maximumFractionDigits: currency === 'XOF' ? 0 : 2,
        useGrouping: true
      }).replace(/\s/g, ' '); 
      return formattedAmount;
    };

    const getColorText = (colorClass: string) => {
      // Extract text color from Tailwind color classes
      const colorMap: { [key: string]: string } = {
          'bg-blue-100 text-blue-700': '#1e40af',
          'bg-green-100 text-green-700': '#166534',
          'bg-yellow-100 text-yellow-700': '#854d0e',
          'bg-purple-100 text-purple-700': '#6b21a8',
          'bg-pink-100 text-pink-700': '#831843',
          'bg-indigo-100 text-indigo-700': '#3730a3',
          'bg-orange-100 text-orange-700': '#9a3412',
          'bg-gray-100 text-gray-700': '#374151'
      };
      return colorMap[colorClass] || '#000000';
    };

    // Fonctions utilitaires
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

    const getNotificationRate = (plannedAmount: number, notifiedAmount: number) => {
        return plannedAmount > 0 ? (notifiedAmount / plannedAmount) * 100 : 0;
    };
    
    // Fonction d'exportation en PDF
    const exportToPDF = async () => {
      if (!canExport) {
        showError('Permission refusée', 'Vous n\'avez pas la permission d\'exporter des données');
        return;
      }
      try {
        showSuccess('Génération du PDF', 'Le PDF est en cours de génération...');

        // Calculer les totaux
        const totalPlanned = filteredBudgetLines.reduce((sum, line) => sum + line.plannedAmount, 0);
        const totalNotified = filteredBudgetLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
        const overallNotificationRate = totalPlanned > 0 ? (totalNotified / totalPlanned) * 100 : 0;

        // Créer le PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Marges
        const margin = {
          top: 20,
          right: 15,
          bottom: 20,
          left: 15
        };
        
        const contentWidth = pageWidth - margin.left - margin.right;
        let yPosition = margin.top;

        // Fonction pour vérifier si on a besoin d'une nouvelle page
        const checkPageBreak = (requiredHeight: number) => {
          if (yPosition + requiredHeight > pageHeight - margin.bottom) {
            pdf.addPage();
            yPosition = margin.top;
            return true;
          }
          return false;
        };

        // En-tête du PDF
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RAPPORT BUDGÉTAIRE', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, margin.left, yPosition);
        yPosition += 5;

        if (selectedGrant) {
          pdf.text(`Subvention : ${selectedGrant.name} (${selectedGrant.reference})`, margin.left, yPosition);
          yPosition += 8;
        }

        // Ligne de séparation
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin.left, yPosition, pageWidth - margin.right, yPosition);
        yPosition += 15;

        // Cartes de résumé
        const cardWidth = contentWidth / 3 - 10;
        const cardHeight = 25;

        // Vérifier si on a la place pour les cartes
        checkPageBreak(cardHeight + 10);

        // Carte 1 - Total Planifié
        pdf.setFillColor(219, 234, 254);
        pdf.rect(margin.left, yPosition, cardWidth, cardHeight, 'F');
        pdf.setDrawColor(209, 213, 219);
        pdf.rect(margin.left, yPosition, cardWidth, cardHeight);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Total Planifié', margin.left + 5, yPosition + 8);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(37, 99, 235);
        
        const totalPlannedText = selectedGrant 
          ? `${formatCurrencyForPDF(totalPlanned, selectedGrant.currency)} ${getCurrencySymbolForPDF(selectedGrant.currency)}`
          : formatCurrencyForPDF(totalPlanned, 'EUR');
        
        pdf.text(
          totalPlannedText,
          margin.left + cardWidth / 2, 
          yPosition + 18,
          { align: 'center' }
        );
        pdf.setTextColor(0, 0, 0);

        // Carte 2 - Total Notifié
        pdf.setFillColor(220, 252, 231);
        pdf.rect(margin.left + cardWidth + 5, yPosition, cardWidth, cardHeight, 'F');
        pdf.setDrawColor(209, 213, 219);
        pdf.rect(margin.left + cardWidth + 5, yPosition, cardWidth, cardHeight);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Total Notifié', margin.left + cardWidth + 10, yPosition + 8);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(5, 150, 105);
        
        const totalNotifiedText = selectedGrant 
          ? `${formatCurrencyForPDF(totalNotified, selectedGrant.currency)} ${getCurrencySymbolForPDF(selectedGrant.currency)}`
          : formatCurrencyForPDF(totalNotified, 'EUR');
        
        pdf.text(
          totalNotifiedText,
          margin.left + cardWidth + 5 + cardWidth / 2, 
          yPosition + 18,
          { align: 'center' }
        );
        pdf.setTextColor(0, 0, 0);

        // Carte 3 - Taux Notification
        pdf.setFillColor(243, 232, 255);
        pdf.rect(margin.left + (cardWidth + 5) * 2, yPosition, cardWidth, cardHeight, 'F');
        pdf.setDrawColor(209, 213, 219);
        pdf.rect(margin.left + (cardWidth + 5) * 2, yPosition, cardWidth, cardHeight);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Taux Notification', margin.left + (cardWidth + 5) * 2 + 5, yPosition + 8);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(124, 58, 237);
        
        pdf.text(
          `${overallNotificationRate.toFixed(1)}%`,
          margin.left + (cardWidth + 5) * 2 + cardWidth / 2, 
          yPosition + 18,
          { align: 'center' }
        );
        pdf.setTextColor(0, 0, 0);

        yPosition += cardHeight + 15;

        // Titre du tableau
        checkPageBreak(20);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Lignes Budgétaires (${filteredBudgetLines.length})`, margin.left, yPosition);
        yPosition += 10;

        // Préparer les données du tableau avec des largeurs ajustées
        const tableHeaders = ['Code', 'Lignes et Sous lignes', 'Budget Planifié', 'Budget Notifié', 'Taux'];
        const columnWidths = [20, 70, 40, 40, 15];
        const baseRowHeight = 8;
        const headerHeight = 8;
        const cellPadding = 2;

        // Vérifier si on a la place pour l'en-tête du tableau
        checkPageBreak(headerHeight + baseRowHeight);

        // En-tête du tableau - CORRIGÉ
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin.left, yPosition, contentWidth, headerHeight, 'F');

        // Fonction pour dessiner une ligne de tableau - AMÉLIORÉE
        const drawTableRow = (cells: { text: string; align: 'left' | 'right' | 'center'; fontSize: number; fontStyle: string; maxWidth: number; textColor?: number[] }[], rowY: number, bgColor?: number[]) => {
          let currentX = margin.left;
          let maxCellHeight = baseRowHeight;

          // Calculer la hauteur maximale nécessaire pour cette ligne
          cells.forEach((cell, index) => {
            pdf.setFontSize(cell.fontSize);
            pdf.setFont('helvetica', cell.fontStyle as any);
            
            const lines = pdf.splitTextToSize(cell.text, cell.maxWidth - cellPadding * 2);
            const cellHeight = Math.max(baseRowHeight, lines.length * cell.fontSize * 0.35 + cellPadding * 2);
            maxCellHeight = Math.max(maxCellHeight, cellHeight);
          });

          // Dessiner le fond de la ligne
          if (bgColor) {
            pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            pdf.rect(margin.left, rowY, contentWidth, maxCellHeight, 'F');
          }

          // Dessiner les bordures et le texte
          currentX = margin.left;
          cells.forEach((cell, index) => {
            // Bordure de la cellule
            pdf.setDrawColor(209, 213, 219);
            pdf.rect(currentX, rowY, columnWidths[index], maxCellHeight);

            // Texte de la cellule
            pdf.setFontSize(cell.fontSize);
            pdf.setFont('helvetica', cell.fontStyle as any);
            if (cell.textColor) {
              pdf.setTextColor(cell.textColor[0], cell.textColor[1], cell.textColor[2]);
            }

            const lines = pdf.splitTextToSize(cell.text, cell.maxWidth - cellPadding * 2);
            const textY = rowY + cellPadding + (cell.fontSize * 0.35);
            
            lines.forEach((line: string, lineIndex: number) => {
              const textX = cell.align === 'right' 
                ? currentX + columnWidths[index] - cellPadding
                : currentX + cellPadding;
              
              pdf.text(line, textX, textY + (lineIndex * cell.fontSize * 0.35), { align: cell.align });
            });

            pdf.setTextColor(0, 0, 0);
            currentX += columnWidths[index];
          });

          return maxCellHeight;
        };

        // Fonction pour redessiner l'en-tête du tableau
        const drawTableHeader = (y: number) => {
          pdf.setFillColor(243, 244, 246);
          pdf.rect(margin.left, y, contentWidth, headerHeight, 'F');
          
          let headerX = margin.left;
          tableHeaders.forEach((header, index) => {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            const align = index >= 2 ? 'right' : 'left';
            const textX = align === 'right' ? headerX + columnWidths[index] - cellPadding : headerX + cellPadding;
            
            // Gestion spéciale pour l'en-tête "Lignes et Sous lignes"
            if (index === 1) {
              const lines = ['Lignes et', 'Sous lignes'];
              lines.forEach((line, lineIndex) => {
                pdf.text(line, textX, y + 3 + (lineIndex * 3));
              });
            } else {
              pdf.text(header, textX, y + 5, { align });
            }
            
            // Bordures des colonnes
            pdf.setDrawColor(209, 213, 219);
            pdf.rect(headerX, y, columnWidths[index], headerHeight);
            
            headerX += columnWidths[index];
          });
        };

        // Données du tableau - CORRIGÉ
        let isFirstRowOnNewPage = true;

        filteredBudgetLines.forEach((budgetLine, lineIndex) => {
          const notificationRate = getNotificationRate(budgetLine.plannedAmount, budgetLine.notifiedAmount);
          const lineGrant = grants.find(g => g.id === budgetLine.grantId);
          const lineSubBudgetLines = filteredSubBudgetLines.filter(sub => sub.budgetLineId === budgetLine.id);

          // Préparer les cellules pour la ligne principale
          const plannedAmountText = lineGrant 
            ? `${formatCurrencyForPDF(budgetLine.plannedAmount, lineGrant.currency)} ${getCurrencySymbolForPDF(lineGrant.currency)}`
            : formatCurrencyForPDF(budgetLine.plannedAmount, 'EUR');
          
          const notifiedAmountText = lineGrant 
            ? `${formatCurrencyForPDF(budgetLine.notifiedAmount, lineGrant.currency)} ${getCurrencySymbolForPDF(lineGrant.currency)}`
            : formatCurrencyForPDF(budgetLine.notifiedAmount, 'EUR');

          const mainRowCells = [
            {
              text: budgetLine.code,
              align: 'left' as const,
              fontSize: 7,
              fontStyle: 'bold',
              maxWidth: columnWidths[0],
              textColor: [parseInt(getColorText(budgetLine.color).slice(1, 3), 16), parseInt(getColorText(budgetLine.color).slice(3, 5), 16), parseInt(getColorText(budgetLine.color).slice(5, 7), 16)]
            },
            {
              text: budgetLine.name,
              align: 'left' as const,
              fontSize: 7,
              fontStyle: 'normal',
              maxWidth: columnWidths[1]
            },
            {
              text: plannedAmountText,
              align: 'right' as const,
              fontSize: 7,
              fontStyle: 'normal',
              maxWidth: columnWidths[2]
            },
            {
              text: notifiedAmountText,
              align: 'right' as const,
              fontSize: 7,
              fontStyle: 'normal',
              maxWidth: columnWidths[3]
            },
            {
              text: `${notificationRate.toFixed(1)}%`,
              align: 'right' as const,
              fontSize: 7,
              fontStyle: 'bold',
              maxWidth: columnWidths[4],
              textColor: notificationRate < 100 ? [234, 88, 12] : [5, 150, 105]
            }
          ];

          // Vérifier si on a la place pour la ligne principale
          const estimatedHeight = baseRowHeight * 2; // Estimation conservatrice
          if (checkPageBreak(estimatedHeight)) {
            isFirstRowOnNewPage = true;
          }

          // Redessiner l'en-tête si c'est la première ligne sur une nouvelle page
          if (isFirstRowOnNewPage) {
            drawTableHeader(yPosition);
            yPosition += headerHeight;
            isFirstRowOnNewPage = false;
          }

          // Dessiner la ligne principale avec fond alterné
          const bgColor = lineIndex % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
          const rowHeight = drawTableRow(mainRowCells, yPosition, bgColor);
          yPosition += rowHeight;

          // Sous-lignes
          lineSubBudgetLines.forEach((subLine) => {
            const subNotificationRate = getNotificationRate(subLine.plannedAmount, subLine.notifiedAmount);
            const subGrant = grants.find(g => g.id === subLine.grantId);

            const subPlannedAmountText = subGrant 
              ? `${formatCurrencyForPDF(subLine.plannedAmount, subGrant.currency)} ${getCurrencySymbolForPDF(subGrant.currency)}`
              : formatCurrencyForPDF(subLine.plannedAmount, 'EUR');
            
            const subNotifiedAmountText = subGrant 
              ? `${formatCurrencyForPDF(subLine.notifiedAmount, subGrant.currency)} ${getCurrencySymbolForPDF(subGrant.currency)}`
              : formatCurrencyForPDF(subLine.notifiedAmount, 'EUR');

            const subRowCells = [
              {
                text: subLine.code,
                align: 'left' as const,
                fontSize: 6,
                fontStyle: 'normal',
                maxWidth: columnWidths[0],
                textColor: [107, 114, 128]
              },
              {
                text: subLine.name,
                align: 'left' as const,
                fontSize: 6,
                fontStyle: 'normal',
                maxWidth: columnWidths[1]
              },
              {
                text: subPlannedAmountText,
                align: 'right' as const,
                fontSize: 6,
                fontStyle: 'normal',
                maxWidth: columnWidths[2]
              },
              {
                text: subNotifiedAmountText,
                align: 'right' as const,
                fontSize: 6,
                fontStyle: 'normal',
                maxWidth: columnWidths[3]
              },
              {
                text: `${subNotificationRate.toFixed(1)}%`,
                align: 'right' as const,
                fontSize: 6,
                fontStyle: 'bold',
                maxWidth: columnWidths[4],
                textColor: subNotificationRate < 100 ? [234, 88, 12] : [5, 150, 105]
              }
            ];

            // Vérifier si on a la place pour la sous-ligne
            const subEstimatedHeight = baseRowHeight * 2;
            if (checkPageBreak(subEstimatedHeight)) {
              drawTableHeader(yPosition);
              yPosition += headerHeight;
            }

            // Dessiner la sous-ligne avec fond bleu clair
            const subRowHeight = drawTableRow(subRowCells, yPosition, [239, 246, 255]);
            yPosition += subRowHeight;
          });
        });

        // Pied de page sur chaque page
        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          pdf.setPage(i);
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(156, 163, 175);
          pdf.text(
            `Page ${i} sur ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
          
          pdf.text(
            `Document généré automatiquement - ${new Date().getFullYear()}`,
            pageWidth / 2,
            pageHeight - 5,
            { align: 'center' }
          );
        }

        // Sauvegarder le PDF
        pdf.save(`budget_planning_${new Date().toISOString().split('T')[0]}.pdf`);
        
        showSuccess('PDF généré', 'Le rapport PDF a été généré avec succès');
      } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        showError('Erreur', 'Une erreur est survenue lors de la génération du PDF');
      }
    };

    // Réinitialisation des formulaires
    const resetBudgetLineForm = () => {
        setBudgetLineFormData({
            grantId: selectedGrant?.id || '',
            code: '', name: '', plannedAmount: '0', notifiedAmount: '', description: '',
            color: 'bg-blue-100 text-blue-700'
        });
        setShowBudgetLineForm(false);
        setEditingBudgetLine(null);
    };

    const resetSubBudgetLineForm = () => {
        setSubBudgetLineFormData({
            grantId: selectedGrant?.id || '',
            budgetLineId: selectedBudgetLineId || '',
            code: '', name: '', plannedAmount: '0', notifiedAmount: '0', description: ''
        });
        setShowSubBudgetLineForm(false);
        setEditingSubBudgetLine(null);
    };

    // Soumission des formulaires avec vérification des permissions
    const handleBudgetLineSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!canCreate && !editingBudgetLine) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de créer des lignes budgétaires');
        return;
      }

      if (!canEdit && editingBudgetLine) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de modifier des lignes budgétaires');
        return;
      }
      
      if (!budgetLineFormData.grantId || !budgetLineFormData.code || !budgetLineFormData.name || !budgetLineFormData.plannedAmount) {
        showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, le code, le nom et le montant planifié');
        return;
      }

      const plannedAmount = parseFloat(budgetLineFormData.plannedAmount);
      const notifiedAmount = parseFloat(budgetLineFormData.notifiedAmount) || 0;

      if (editingBudgetLine) {
        onUpdateBudgetLine(editingBudgetLine.id, {
          grantId: budgetLineFormData.grantId,
          code: budgetLineFormData.code,
          name: budgetLineFormData.name,
          plannedAmount,
          notifiedAmount,
          description: budgetLineFormData.description,
          color: budgetLineFormData.color
        });
        markBudgetLineAsModified(editingBudgetLine.id);
        showSuccess('Ligne modifiée', 'La ligne budgétaire a été modifiée avec succès');
      } else {
        onAddBudgetLine({
          grantId: budgetLineFormData.grantId,
          code: budgetLineFormData.code,
          name: budgetLineFormData.name,
          plannedAmount,
          notifiedAmount,
          description: budgetLineFormData.description,
          color: budgetLineFormData.color
        });
        showSuccess('Ligne ajoutée', 'La ligne budgétaire a été ajoutée avec succès');
      }

      resetBudgetLineForm();
    };

    const handleSubBudgetLineSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!canCreate && !editingSubBudgetLine) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de créer des sous-lignes budgétaires');
        return;
      }

      if (!canEdit && editingSubBudgetLine) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de modifier des sous-lignes budgétaires');
        return;
      }

      if (!subBudgetLineFormData.grantId || !subBudgetLineFormData.budgetLineId || !subBudgetLineFormData.code || !subBudgetLineFormData.name || !subBudgetLineFormData.plannedAmount) {
        showValidationError('Champs obligatoires manquants', 'Veuillez remplir la subvention, la ligne budgétaire, le code, le nom et le montant planifié');
        return;
      }

      const plannedAmount = parseFloat(subBudgetLineFormData.plannedAmount);
      const notifiedAmount = parseFloat(subBudgetLineFormData.notifiedAmount) || 0;

      if (editingSubBudgetLine) {
        onUpdateSubBudgetLine(editingSubBudgetLine.id, {
          grantId: subBudgetLineFormData.grantId,
          budgetLineId: subBudgetLineFormData.budgetLineId,
          code: subBudgetLineFormData.code,
          name: subBudgetLineFormData.name,
          plannedAmount,
          notifiedAmount,
          description: subBudgetLineFormData.description
        });
        markSubBudgetLineAsModified(editingSubBudgetLine.id);
        showSuccess('Sous-ligne modifiée', 'La sous-ligne budgétaire a été modifiée avec succès');
      } else {
        onAddSubBudgetLine({
          grantId: subBudgetLineFormData.grantId,
          budgetLineId: subBudgetLineFormData.budgetLineId,
          code: subBudgetLineFormData.code,
          name: subBudgetLineFormData.name,
          plannedAmount,
          notifiedAmount,
          description: subBudgetLineFormData.description
        });
        showSuccess('Sous-ligne ajoutée', 'La sous-ligne budgétaire a été ajoutée avec succès');
      }

      resetSubBudgetLineForm();
    };

    // Édition des lignes
    const startEditBudgetLine = (line: BudgetLine) => {
      if (!canEdit) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de modifier des lignes budgétaires');
        return;
      }
      
      setEditingBudgetLine(line);
      setBudgetLineFormData({
        grantId: line.grantId,
        code: line.code,
        name: line.name,
        plannedAmount: line.plannedAmount.toString(),
        notifiedAmount: line.notifiedAmount.toString(),
        description: line.description || '',
        color: line.color
      });
      setShowBudgetLineForm(true);
    };

    const startEditSubBudgetLine = (line: SubBudgetLine) => {
      if (!canEdit) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de modifier des sous-lignes budgétaires');
        return;
      }
      
      setEditingSubBudgetLine(line);
      setSubBudgetLineFormData({
        grantId: line.grantId,
        budgetLineId: line.budgetLineId,
        code: line.code,
        name: line.name,
        plannedAmount: line.plannedAmount.toString(),
        notifiedAmount: line.notifiedAmount.toString(),
        description: line.description || ''
      });
      setShowSubBudgetLineForm(true);
    };

    // Suppression avec confirmation
    const handleDeleteBudgetLine = async (line: BudgetLine) => {
      if (!canDelete) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de supprimer des lignes budgétaires');
        return;
      }

      const confirmed = await confirmDelete(
        'Supprimer la ligne budgétaire',
        `Êtes-vous sûr de vouloir supprimer la ligne "${line.name}" ? Cette action est irréversible.`
      );
      if (confirmed) {
        onDeleteBudgetLine(line.id);
        showSuccess('Ligne supprimée', 'La ligne budgétaire a été supprimée avec succès');
      }
    };

    const handleDeleteSubBudgetLine = async (line: SubBudgetLine) => {
      if (!canDelete) {
        showError('Permission refusée', 'Vous n\'avez pas la permission de supprimer des sous-lignes budgétaires');
        return;
      }

      const confirmed = await confirmDelete(
        'Supprimer la sous-ligne budgétaire',
        `Êtes-vous sûr de vouloir supprimer la sous-ligne "${line.name}" ? Cette action est irréversible.`
      );
      if (confirmed) {
        onDeleteSubBudgetLine(line.id);
        showSuccess('Sous-ligne supprimée', 'La sous-ligne budgétaire a été supprimée avec succès');
      }
    };
    // Expansion des lignes
    const toggleBudgetLineExpansion = (budgetLineId: string) => {
        const newExpanded = new Set(expandedBudgetLines);
        if (newExpanded.has(budgetLineId)) {
            newExpanded.delete(budgetLineId);
        } else {
            newExpanded.add(budgetLineId);
        }
        setExpandedBudgetLines(newExpanded);
    };

    // Calcul des totaux
    const totalPlanned = filteredBudgetLines.reduce((sum, line) => sum + line.plannedAmount, 0);
    const totalNotified = filteredBudgetLines.reduce((sum, line) => sum + line.notifiedAmount, 0);
    const overallNotificationRate = totalPlanned > 0 ? (totalNotified / totalPlanned) * 100 : 0;

    // Options de couleurs
    const colorOptions = [
        { value: 'bg-blue-100 text-blue-700', label: 'Bleu', preview: 'bg-blue-100' },
        { value: 'bg-green-100 text-green-700', label: 'Vert', preview: 'bg-green-100' },
        { value: 'bg-yellow-100 text-yellow-700', label: 'Jaune', preview: 'bg-yellow-100' },
        { value: 'bg-purple-100 text-purple-700', label: 'Violet', preview: 'bg-purple-100' },
        { value: 'bg-pink-100 text-pink-700', label: 'Rose', preview: 'bg-pink-100' },
        { value: 'bg-indigo-100 text-indigo-700', label: 'Indigo', preview: 'bg-indigo-100' },
        { value: 'bg-orange-100 text-orange-700', label: 'Orange', preview: 'bg-orange-100' },
        { value: 'bg-gray-100 text-gray-700', label: 'Gris', preview: 'bg-gray-100' }
    ];

    // Définition des permissions
    const canCreate = hasPermission('budget_planning', 'create');
    const canEdit = hasPermission('budget_planning', 'edit');
    const canDelete = hasPermission('budget_planning', 'delete');
    const canExport = hasPermission('budget_planning', 'export');
    
    // Composants internes
    const SortableHeader = ({ label, sortKey }: { label: string; sortKey: string; }) => (
        <th
            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
            onClick={() => handleSort(sortKey)}
        >
            <div className="flex items-center space-x-1">
                <span>{label}</span>
                {sortConfig.key === sortKey && (
                    sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                )}
            </div>
        </th>
    );

    const ExpandableText = ({ text, id, maxLength = 50 }: { text: string; id: string; maxLength?: number }) => {
        const isExpanded = expandedText.has(id);
        const shouldTruncate = text.length > maxLength;
        const displayText = isExpanded || !shouldTruncate ? text : `${text.substring(0, maxLength)}...`;

        return (
            <div className="group" onClick={() => shouldTruncate && toggleTextExpansion(id)}>
                <p className={`text-sm ${shouldTruncate ? 'cursor-pointer' : ''}`}>
                    {displayText}
                </p>
                {shouldTruncate && (
                    <span className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                        {isExpanded ? 'Voir moins' : 'Voir plus'}
                    </span>
                )}
            </div>
        );
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

    if (!hasModuleAccess('budget_planning')) {
        return <div className="text-center p-8">Accès non autorisé à ce module.</div>;
    }

    return (
        <div className="space-y-6">
            {/* En-tête avec boutons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Planification Budgétaire</h2>
                    <p className="text-gray-600 mt-1">Gestion de la planification et des notifications budgétaires</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canExport && (
                         <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 flex items-center space-x-2">
                            <Download className="w-4 h-4" />
                            <span>Exporter PDF</span>
                        </button>
                    )}
                    {canCreate && (
                        <>
                            <button onClick={() => setShowSubBudgetLineForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-2">
                                <Plus className="w-4 h-4" />
                                <span>Nouvelle Sous-ligne</span>
                            </button>
                            <button onClick={() => setShowBudgetLineForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center space-x-2">
                                <Plus className="w-4 h-4" />
                                <span>Nouvelle Ligne</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Cartes de résumé */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Planifié</p>
                    <p className="text-xl md:text-2xl font-bold text-blue-600">
                      {selectedGrant ? formatCurrency(totalPlanned, selectedGrant.currency) : totalPlanned.toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Notifié</p>
                    <p className="text-xl md:text-2xl font-bold text-green-600">
                      {selectedGrant ? formatCurrency(totalNotified, selectedGrant.currency) : totalNotified.toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-green-100 rounded-full">
                    <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Taux de Notification</p>
                    <p className="text-xl md:text-2xl font-bold text-purple-600">{overallNotificationRate.toFixed(1)}%</p>
                  </div>
                  <div className="p-2 md:p-3 bg-purple-100 rounded-full">
                    <Edit className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL LIGNE BUDGETAIRE (RESPONSIVE) */}
            {showBudgetLineForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md md:max-w-2xl lg:max-w-4xl p-6 max-h-[95vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          {editingBudgetLine ? 'Modifier la ligne budgétaire' : 'Nouvelle ligne budgétaire'}
                        </h3>
                        
                        <form onSubmit={handleBudgetLineSubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Subvention *
                            </label>
                            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
                              {selectedGrant ? `${selectedGrant.name} (${selectedGrant.reference})` : 'Aucune subvention sélectionnée'}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Subvention définie par l'administrateur
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Code *
                              </label>
                              <input
                                type="text"
                                value={budgetLineFormData.code}
                                onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, code: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: PIN-PERS"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Couleur d'affichage
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {colorOptions.map(color => (
                                  <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setBudgetLineFormData(prev => ({ ...prev, color: color.value }))}
                                    className={`p-2 rounded-lg border-2 transition-all ${
                                      budgetLineFormData.color === color.value 
                                        ? 'border-blue-500 ring-2 ring-blue-200' 
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <div className={`w-full h-4 rounded ${color.preview}`}></div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nom de la ligne budgétaire *
                            </label>
                            <input
                              type="text"
                              value={budgetLineFormData.name}
                              onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Ex: Personnel"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Budget planifié ({selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'})*
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={budgetLineFormData.plannedAmount}
                                  onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, plannedAmount: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                                  placeholder="0.00"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Budget notifié ({selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'})
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={budgetLineFormData.notifiedAmount}
                                  onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, notifiedAmount: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Description
                            </label>
                            <textarea
                              value={budgetLineFormData.description}
                              onChange={(e) => setBudgetLineFormData(prev => ({ ...prev, description: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              rows={3}
                              placeholder="Description de la ligne budgétaire..."
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                            <button
                              type="button"
                              onClick={resetBudgetLineForm}
                              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              type="submit"
                              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                              {editingBudgetLine ? 'Modifier' : 'Ajouter'}
                            </button>
                          </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL SOUS-LIGNE BUDGETAIRE (RESPONSIVE) */}
            {showSubBudgetLineForm && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md md:max-w-2xl lg:max-w-4xl p-6 max-h-[95vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          {editingSubBudgetLine ? 'Modifier la sous-ligne budgétaire' : 'Nouvelle sous-ligne budgétaire'}
                        </h3>
                        
                        <form onSubmit={handleSubBudgetLineSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Subvention *
                              </label>
                              <select
                                value={subBudgetLineFormData.grantId}
                                onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, grantId: e.target.value }))}
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
                                Ligne budgétaire *
                              </label>
                              <select
                                value={subBudgetLineFormData.budgetLineId}
                                onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, budgetLineId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              >
                                <option value="">Sélectionner une ligne</option>
                                {budgetLines.map(line => (
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
                                Code *
                              </label>
                              <input
                                type="text"
                                value={subBudgetLineFormData.code}
                                onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, code: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: PIN-PERS-001"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nom de la sous-ligne *
                              </label>
                              <input
                                type="text"
                                value={subBudgetLineFormData.name}
                                onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Développeur Senior"
                                required
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Montant planifié ({selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'})*
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={subBudgetLineFormData.plannedAmount}
                                  onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, plannedAmount: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                                  placeholder="0.00"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Budget notifié ({selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '€'})
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={subBudgetLineFormData.notifiedAmount}
                                  onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, notifiedAmount: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Description
                            </label>
                            <textarea
                              value={subBudgetLineFormData.description}
                              onChange={(e) => setSubBudgetLineFormData(prev => ({ ...prev, description: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              rows={3}
                              placeholder="Description de la sous-ligne budgétaire..."
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                            <button
                              type="button"
                              onClick={resetSubBudgetLineForm}
                              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              type="submit"
                              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                              {editingSubBudgetLine ? 'Modifier' : 'Ajouter'}
                            </button>
                          </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Conteneur principal pour le tableau et les contrôles */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                      Lignes Budgétaires ({sortedBudgetLines.length})
                  </h3>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    {/* Sélecteur d'éléments par page */}
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600 whitespace-nowrap">Lignes par page:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15">15</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                      </select>
                    </div>
        
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-600 min-w-[100px] text-center">
                          Page {currentPage} sur {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* LOGIQUE D'AFFICHAGE RESPONSIVE : TABLEAU (desktop) ou CARTES (mobile) */}
                
                {/* Vue TABLEAU pour écrans larges (lg et plus) */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="w-12 px-4 py-3"></th>
                                <SortableHeader label="Code" sortKey="code" />
                                <SortableHeader label="Ligne budgétaire" sortKey="name" />
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sous-lignes</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget Planifié</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget Notifié</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Taux Notification</th>
                                {(canEdit || canDelete || canCreate) && (
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedBudgetLines.map(budgetLine => {
                                const lineSubBudgetLines = filteredSubBudgetLines.filter(sub => sub.budgetLineId === budgetLine.id);
                                const isExpanded = expandedBudgetLines.has(budgetLine.id);
                                const notificationRate = getNotificationRate(budgetLine.plannedAmount, budgetLine.notifiedAmount);
                                const isUnderNotified = notificationRate < 100;
                                const lineGrant = grants.find(g => g.id === budgetLine.grantId);
                                const isModified = modifiedBudgetLines.has(budgetLine.id);

                                return (
                                  <React.Fragment key={budgetLine.id}>
                                    <tr className={`hover:bg-gray-50 ${isModified ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''} ${isUnderNotified ? 'bg-yellow-50' : ''}`}>
                                      <td className="px-4 py-4">
                                        <button
                                          onClick={() => toggleBudgetLineExpansion(budgetLine.id)}
                                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="w-4 h-4" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4" />
                                          )}
                                        </button>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="flex items-center space-x-2">
                                          {isModified && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Modifié récemment"></div>
                                          )}
                                          <span className={`px-2 py-1 text-xs font-medium rounded ${budgetLine.color}`}>
                                            {budgetLine.code}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <ExpandableText 
                                          text={budgetLine.name} 
                                          id={`budgetline-name-${budgetLine.id}`}
                                          maxLength={30}
                                        />
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="text-sm text-gray-500">
                                          {lineSubBudgetLines.length} sous-ligne{lineSubBudgetLines.length > 1 ? 's' : ''}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                                        {lineGrant ? formatCurrency(budgetLine.plannedAmount, lineGrant.currency) : budgetLine.plannedAmount.toLocaleString('fr-FR')}
                                      </td>
                                      <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                                        {lineGrant ? formatCurrency(budgetLine.notifiedAmount, lineGrant.currency) : budgetLine.notifiedAmount.toLocaleString('fr-FR')}
                                      </td>
                                      <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                          {isUnderNotified && (
                                            <AlertCircle className="w-4 h-4 text-orange-500" />
                                          )}
                                          <span className={`text-sm font-medium ${
                                            isUnderNotified ? 'text-orange-600' : 'text-green-600'
                                          }`}>
                                            {notificationRate.toFixed(1)}%
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 max-w-[80px] mx-auto">
                                          <div 
                                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                              isUnderNotified ? 'bg-orange-500' : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(notificationRate, 100)}%` }}
                                          ></div>
                                        </div>
                                      </td>
                                      {(canEdit || canDelete || canCreate) && (
                                        <td className="px-4 py-4 text-center">
                                          <div className="flex items-center justify-center space-x-1">
                                            {canCreate && (
                                              <button
                                                onClick={() => {
                                                  setSelectedBudgetLineId(budgetLine.id);
                                                  setSubBudgetLineFormData(prev => ({ 
                                                    ...prev, 
                                                    grantId: budgetLine.grantId,
                                                    budgetLineId: budgetLine.id 
                                                  }));
                                                  setShowSubBudgetLineForm(true);
                                                }}
                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Ajouter une sous-ligne"
                                              >
                                                <Plus className="w-4 h-4" />
                                              </button>
                                            )}
                                            {canEdit && (
                                              <button
                                                onClick={() => startEditBudgetLine(budgetLine)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Modifier"
                                              >
                                                <Edit className="w-4 h-4" />
                                              </button>
                                            )}
                                            {canDelete && (
                                              <button
                                                onClick={() => handleDeleteBudgetLine(budgetLine)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Supprimer"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      )}
                                    </tr>

                                    {/* Sous-lignes détaillées */}
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={8} className="p-0">
                                          <div className="bg-gray-50 border-t border-gray-200">
                                            {lineSubBudgetLines.length === 0 ? (
                                              <div className="p-6 text-center">
                                                <p className="text-gray-500 mb-4">Aucune sous-ligne budgétaire</p>
                                                {canCreate && (
                                                  <button
                                                    onClick={() => {
                                                      setSelectedBudgetLineId(budgetLine.id);
                                                      setSubBudgetLineFormData(prev => ({ 
                                                        ...prev, 
                                                        grantId: budgetLine.grantId,
                                                        budgetLineId: budgetLine.id 
                                                      }));
                                                      setShowSubBudgetLineForm(true);
                                                    }}
                                                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                                                  >
                                                    Ajouter une sous-ligne
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <div className="overflow-x-auto">
                                                <table className="w-full">
                                                  <thead className="bg-gray-100">
                                                    <tr>
                                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Sous-ligne budgétaire
                                                      </th>
                                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Prévision budgétaire
                                                      </th>
                                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Budget notifié
                                                      </th>
                                                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Taux notification
                                                      </th>
                                                      {(canEdit || canDelete) && (
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                          Actions
                                                        </th>
                                                      )}
                                                    </tr>
                                                  </thead>
                                                  <tbody className="bg-white divide-y divide-gray-200">
                                                    {lineSubBudgetLines.map(subLine => {
                                                      const subNotificationRate = getNotificationRate(subLine.plannedAmount, subLine.notifiedAmount);
                                                      const isSubUnderNotified = subNotificationRate < 100;
                                                      const subGrant = grants.find(g => g.id === subLine.grantId);
                                                      const isSubModified = modifiedSubBudgetLines.has(subLine.id);
                                                      
                                                      return (
                                                        <tr key={subLine.id} className={`hover:bg-gray-50 ${isSubModified ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''} ${isSubUnderNotified ? 'bg-yellow-50' : ''}`}>
                                                          <td className="px-4 py-4 max-w-[300px]">
                                                            <div className="flex items-center space-x-2">
                                                              {isSubModified && (
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Modifié récemment"></div>
                                                              )}
                                                              <div className="min-w-0 flex-1">
                                                                <ExpandableText 
                                                                  text={subLine.name} 
                                                                  id={`subline-name-${subLine.id}`}
                                                                  maxLength={40}
                                                                />
                                                                <div className="mt-1">
                                                                  <ExpandableText 
                                                                    text={subLine.code} 
                                                                    id={`subline-code-${subLine.id}`}
                                                                    maxLength={30}
                                                                  />
                                                                </div>
                                                                {subLine.description && (
                                                                  <div className="mt-1">
                                                                    <ExpandableText 
                                                                      text={subLine.description} 
                                                                      id={`subline-desc-${subLine.id}`}
                                                                      maxLength={50}
                                                                    />
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </div>
                                                          </td>
                                                          <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                                                            {subGrant ? formatCurrency(subLine.plannedAmount, subGrant.currency) : subLine.plannedAmount.toLocaleString('fr-FR')}
                                                          </td>
                                                          <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                                                            {subGrant ? formatCurrency(subLine.notifiedAmount, subGrant.currency) : subLine.notifiedAmount.toLocaleString('fr-FR')}
                                                          </td>
                                                          <td className="px-4 py-4 text-center">
                                                            <div className="flex items-center justify-center space-x-2">
                                                              {isSubUnderNotified && (
                                                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                                              )}
                                                              <span className={`text-sm font-medium ${
                                                                isSubUnderNotified ? 'text-orange-600' : 'text-green-600'
                                                              }`}>
                                                                {subNotificationRate.toFixed(1)}%
                                                              </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 max-w-[80px] mx-auto">
                                                              <div 
                                                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                                                  isSubUnderNotified ? 'bg-orange-500' : 'bg-green-500'
                                                                }`}
                                                                style={{ width: `${Math.min(subNotificationRate, 100)}%` }}
                                                              ></div>
                                                            </div>
                                                          </td>
                                                          {(canEdit || canDelete) && (
                                                            <td className="px-4 py-4 text-center">
                                                              <div className="flex items-center justify-center space-x-1">
                                                                {canEdit && (
                                                                  <button
                                                                    onClick={() => startEditSubBudgetLine(subLine)}
                                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Modifier"
                                                                  >
                                                                    <Edit className="w-4 h-4" />
                                                                  </button>
                                                                )}
                                                                {canDelete && (
                                                                  <button
                                                                    onClick={() => handleDeleteSubBudgetLine(subLine)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Supprimer"
                                                                  >
                                                                    <Trash2 className="w-4 h-4" />
                                                                  </button>
                                                                )}
                                                              </div>
                                                            </td>
                                                          )}
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
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

                {/* Vue CARTES pour petits écrans (en dessous de lg) */}
                <div className="block lg:hidden space-y-4">
                    {paginatedBudgetLines.map(budgetLine => {
                        const lineSubBudgetLines = filteredSubBudgetLines.filter(sub => sub.budgetLineId === budgetLine.id);
                        const isExpanded = expandedBudgetLines.has(budgetLine.id);
                        const notificationRate = getNotificationRate(budgetLine.plannedAmount, budgetLine.notifiedAmount);
                        const isUnderNotified = notificationRate < 100;
                        const lineGrant = grants.find(g => g.id === budgetLine.grantId);
                        const isModified = modifiedBudgetLines.has(budgetLine.id);

                        return (
                            <div key={budgetLine.id} className={`border rounded-lg p-4 space-y-3 ${isModified ? 'border-blue-500' : 'border-gray-200'} ${isUnderNotified ? 'bg-yellow-50' : 'bg-white'}`}>
                                {/* En-tête de la carte */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${budgetLine.color}`}>{budgetLine.code}</span>
                                        <h4 className="font-bold text-gray-800 mt-1">{budgetLine.name}</h4>
                                    </div>
                                    <button onClick={() => toggleBudgetLineExpansion(budgetLine.id)} className="p-2 text-gray-500">
                                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </button>
                                </div>

                                {/* Contenu de la carte */}
                                <div className="grid grid-cols-2 gap-4 text-sm border-t border-b py-3">
                                    <div>
                                        <p className="text-gray-500">Budget Planifié</p>
                                        <p className="font-medium text-gray-900">{lineGrant ? formatCurrency(budgetLine.plannedAmount, lineGrant.currency) : ''}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Budget Notifié</p>
                                        <p className="font-medium text-gray-900">{lineGrant ? formatCurrency(budgetLine.notifiedAmount, lineGrant.currency) : ''}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Taux Notification</p>
                                        <p className={`font-bold ${isUnderNotified ? 'text-orange-600' : 'text-green-600'}`}>{notificationRate.toFixed(1)}%</p>
                                    </div>
                                     <div>
                                        <p className="text-gray-500">Sous-lignes</p>
                                        <p className="font-medium text-gray-900">{lineSubBudgetLines.length}</p>
                                    </div>
                                </div>

                                {/* Actions de la carte */}
                                {(canEdit || canDelete || canCreate) && (
                                    <div className="flex items-center justify-center space-x-2">
                                      {canCreate && (
                                        <button
                                          onClick={() => {
                                            setSelectedBudgetLineId(budgetLine.id);
                                            setSubBudgetLineFormData(prev => ({ 
                                              ...prev, 
                                              grantId: budgetLine.grantId,
                                              budgetLineId: budgetLine.id 
                                            }));
                                            setShowSubBudgetLineForm(true);
                                          }}
                                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                          title="Ajouter une sous-ligne"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button
                                          onClick={() => startEditBudgetLine(budgetLine)}
                                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                          title="Modifier"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDeleteBudgetLine(budgetLine)}
                                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Supprimer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                )}

                                {/* Contenu déplié (sous-lignes) */}
                                {isExpanded && (
                                    <div className="pl-4 border-l-2 border-gray-200 space-y-3 pt-3">
                                      <h5 className="font-semibold text-sm text-gray-700">{lineSubBudgetLines.length} Sous-ligne(s)</h5>
                                      {lineSubBudgetLines.map(subLine => {
                                        const subNotificationRate = getNotificationRate(subLine.plannedAmount, subLine.notifiedAmount);
                                        const isSubUnderNotified = subNotificationRate < 100;
                                        const subGrant = grants.find(g => g.id === subLine.grantId);
                                        const isSubModified = modifiedSubBudgetLines.has(subLine.id);
                                        
                                        return (
                                          <div key={subLine.id} className={`border rounded-lg p-3 space-y-2 ${isSubModified ? 'border-blue-500' : 'border-gray-200'} ${isSubUnderNotified ? 'bg-yellow-50' : 'bg-white'}`}>
                                            <div className="flex justify-between items-start">
                                              <div>
                                                <span className="text-xs text-gray-500">{subLine.code}</span>
                                                <h6 className="font-medium text-gray-800">{subLine.name}</h6>
                                              </div>
                                              <div className="flex space-x-1">
                                                {canEdit && (
                                                  <button
                                                    onClick={() => startEditSubBudgetLine(subLine)}
                                                    className="p-1 text-gray-400 hover:text-blue-600"
                                                    title="Modifier"
                                                  >
                                                    <Edit className="w-3 h-3" />
                                                  </button>
                                                )}
                                                {canDelete && (
                                                  <button
                                                    onClick={() => handleDeleteSubBudgetLine(subLine)}
                                                    className="p-1 text-gray-400 hover:text-red-600"
                                                    title="Supprimer"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <p className="text-gray-500">Planifié</p>
                                                <p className="font-medium">{subGrant ? formatCurrency(subLine.plannedAmount, subGrant.currency) : ''}</p>
                                              </div>
                                              <div>
                                                <p className="text-gray-500">Notifié</p>
                                                <p className="font-medium">{subGrant ? formatCurrency(subLine.notifiedAmount, subGrant.currency) : ''}</p>
                                              </div>
                                              <div className="col-span-2">
                                                <p className="text-gray-500">Taux Notification</p>
                                                <p className={`font-bold ${isSubUnderNotified ? 'text-orange-600' : 'text-green-600'}`}>{subNotificationRate.toFixed(1)}%</p>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination détaillée */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200 space-y-4 sm:space-y-0">
                    <div className="text-sm text-gray-600">
                      Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, sortedBudgetLines.length)} sur {sortedBudgetLines.length} lignes
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Début
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Précédent
                      </button>
                      
                      {/* Indicateurs de page */}
                      <div className="flex space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                              onClick={() => handlePageChange(pageNum)}
                              className={`w-8 h-8 text-sm rounded-lg ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Suivant
                      </button>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Fin
                      </button>
                    </div>
                  </div>
                )}
            </div>
        </div>
    );
};

export default BudgetPlanning;