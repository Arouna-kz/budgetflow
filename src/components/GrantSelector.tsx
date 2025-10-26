import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ChevronDown, Search, X } from 'lucide-react';
import { Grant } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface GrantSelectorProps {
  grants: Grant[];
  selectedGrantId: string;
  onSelectGrant: (grantId: string) => void;
}


// Dans GrantSelectorComponent, simplifiez le code :

const GrantSelectorComponent: React.FC<GrantSelectorProps> = ({
  grants,
  selectedGrantId,
  onSelectGrant,
}) => {
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();
  const [isDataReady, setIsDataReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Attendre que les données soient prêtes
  useEffect(() => {
    if (grants.length > 0 && selectedGrantId) {
      setIsDataReady(true);
    }
  }, [grants, selectedGrantId]);

  // Vérification des permissions
  const canView = hasPermission('globalConfig', 'view');
  const canEdit = hasPermission('globalConfig', 'edit');

  // 🎯 FILTRAGE DES SUBVENTIONS POUR LA RECHERCHE
  const filteredGrants = useMemo(() => {
    if (!searchTerm) return grants;
    
    return grants.filter(grant =>
      grant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grant.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grant.grantingOrganization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grant.year.toString().includes(searchTerm)
    );
  }, [grants, searchTerm]);

  // Gestionnaire de sélection de subvention - SIMPLIFIÉ
  const handleGrantSelect = (grantId: string) => {
  if (canEdit) {
    onSelectGrant(grantId); // Cette fonction doit être handleSelectGrant de App.tsx
    setIsDropdownOpen(false);
    setSearchTerm('');
  }
};

  // Gestionnaire de recherche
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Effacer la recherche
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.grant-selector-dropdown')) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Loading state combiné
  if (permissionsLoading || !isDataReady) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
          </div>
        </div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  // Vérification d'accès au module
  if (!hasModuleAccess('globalConfig')) {
    return null;
  }

  // Vérification de permission view
  if (!canView) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Settings className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Configuration Globale</h3>
            <p className="text-sm text-gray-500">Accès non autorisé</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedGrant = grants.find(grant => grant.id === selectedGrantId);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">Configuration Globale</h3>
          <p className="text-sm text-gray-600 truncate">
            {selectedGrant 
              ? `Subvention active: ${selectedGrant.name}`
              : 'Sélectionnez la subvention active pour toute l\'équipe'
            }
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grant-selector-dropdown">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subvention Active *
          </label>
          
          {/* 🎯 SELECT PERSONNALISÉ AVEC RECHERCHE */}
          <div className="relative">
            {/* Bouton d'affichage de la valeur sélectionnée */}
            <button
              type="button"
              onClick={() => canEdit && setIsDropdownOpen(!isDropdownOpen)}
              disabled={!canEdit}
              className={`
                w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                text-left pr-10 flex items-center justify-between transition-all duration-200
                ${!canEdit 
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                  : 'bg-white hover:border-gray-400 cursor-pointer'
                }
                ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-100' : ''}
              `}
            >
              <span className="truncate">
                {selectedGrant 
                  ? `${selectedGrant.name} (${selectedGrant.reference}) - ${selectedGrant.year}`
                  : 'Sélectionner une subvention'
                }
              </span>
              <ChevronDown 
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'transform rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown avec recherche */}
            {isDropdownOpen && canEdit && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-lg max-h-80 overflow-hidden">
                {/* Barre de recherche */}
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      placeholder="Rechercher une subvention..."
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Liste des résultats */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredGrants.length === 0 ? (
                    <div className="px-4 py-3 text-center text-gray-500 text-sm">
                      {searchTerm ? 'Aucune subvention trouvée' : 'Aucune subvention disponible'}
                    </div>
                  ) : (
                    <div className="py-1">
                      {filteredGrants.map((grant) => (
                        <button
                          key={grant.id}
                          onClick={() => handleGrantSelect(grant.id)}
                          className={`
                            w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors duration-150 border-b border-gray-100 last:border-b-0
                            ${grant.id === selectedGrantId ? 'bg-blue-50 border-blue-200' : ''}
                          `}
                        >
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-start justify-between">
                              <span className="font-medium text-gray-900 text-sm truncate">
                                {grant.name}
                              </span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                                {grant.year}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {grant.reference} • {grant.grantingOrganization}
                            </div>
                            <div className="text-xs font-medium text-blue-600">
                              {grant.totalAmount.toLocaleString('fr-FR', { 
                                style: 'currency', 
                                currency: grant.currency === 'XOF' ? 'XOF' : grant.currency,
                                maximumFractionDigits: 0
                              })}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Indicateur de résultats */}
                {searchTerm && (
                  <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-500">
                      {filteredGrants.length} subvention{filteredGrants.length > 1 ? 's' : ''} trouvée{filteredGrants.length > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Cette subvention sera utilisée dans tous les modules pour toute l'équipe
          </p>
          {!canEdit && (
            <p className="text-xs text-orange-600 mt-1">
              Vous n'avez pas la permission de modifier la subvention active
            </p>
          )}
        </div>

        {selectedGrant && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-blue-700 font-medium">Organisme</p>
                <p className="text-blue-900 font-semibold text-sm md:text-base truncate" title={selectedGrant.grantingOrganization}>
                  {selectedGrant.grantingOrganization}
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-sm text-blue-700 font-medium">Montant Total</p>
                <p className="text-blue-900 font-semibold text-sm md:text-base">
                  {selectedGrant.totalAmount.toLocaleString('fr-FR', { 
                    style: 'currency', 
                    currency: selectedGrant.currency === 'XOF' ? 'XOF' : selectedGrant.currency,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-sm text-blue-700 font-medium">Période</p>
                <p className="text-blue-900 font-semibold text-sm md:text-base">
                  {new Date(selectedGrant.startDate).toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  })} - {new Date(selectedGrant.endDate).toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            {/* Informations supplémentaires */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-600">Statut:</span>
                <span className={`px-2 py-1 rounded-full font-medium ${
                  selectedGrant.status === 'active' ? 'bg-green-100 text-green-800' :
                  selectedGrant.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  selectedGrant.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedGrant.status === 'active' ? 'Active' :
                   selectedGrant.status === 'pending' ? 'En attente' :
                   selectedGrant.status === 'completed' ? 'Terminée' : 'Suspendue'}
                </span>
              </div>
            </div>
          </div>
        )}

        {grants.length === 0 && (
          <div className="text-center py-6 md:py-8 bg-gray-50 rounded-xl">
            <Settings className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium text-sm md:text-base">Aucune subvention disponible</p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Créez d'abord une subvention dans le module "Gestion des Subventions"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrantSelectorComponent;