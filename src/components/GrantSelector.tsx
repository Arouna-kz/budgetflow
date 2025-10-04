import React from 'react';
import { Settings, ChevronDown } from 'lucide-react';
import { Grant } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface GrantSelectorProps {
  grants: Grant[];
  selectedGrantId: string;
  onSelectGrant: (grantId: string) => void;
}

const GrantSelectorComponent: React.FC<GrantSelectorProps> = ({
  grants,
  selectedGrantId,
  onSelectGrant,
}) => {
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();

  // Vérification des permissions
  const canView = hasPermission('globalConfig', 'view');
  const canEdit = hasPermission('globalConfig', 'edit');

  // Loading state
  if (permissionsLoading) {
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

  const handleGrantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (canEdit) {
      onSelectGrant(e.target.value);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">Configuration Globale</h3>
          <p className="text-sm text-gray-600 truncate">Sélectionnez la subvention active pour toute l'équipe</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subvention Active *
          </label>
          <div className="relative">
            <select
              value={selectedGrantId}
              onChange={handleGrantChange}
              disabled={!canEdit}
              className={`
                w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white pr-10
                ${!canEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'cursor-pointer'}
                transition-colors duration-200
              `}
            >
              <option value="">Sélectionner une subvention</option>
              {grants.map(grant => (
                <option key={grant.id} value={grant.id}>
                  {grant.name} ({grant.reference}) - {grant.year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
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