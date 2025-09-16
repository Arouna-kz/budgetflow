import React from 'react';
import { Settings, ChevronDown } from 'lucide-react';
import { Grant } from '../types';

interface GrantSelectorProps {
  grants: Grant[];
  selectedGrantId: string;
  onSelectGrant: (grantId: string) => void;
  isAdmin: boolean;
}

const GrantSelector: React.FC<GrantSelectorProps> = ({
  grants,
  selectedGrantId,
  onSelectGrant,
  isAdmin
}) => {
  const selectedGrant = grants.find(grant => grant.id === selectedGrantId);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Configuration Globale</h3>
          <p className="text-sm text-gray-600">Sélectionnez la subvention active pour toute l'équipe</p>
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
              onChange={(e) => onSelectGrant(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white pr-10"
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
        </div>

        {selectedGrant && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700 font-medium">Organisme</p>
                <p className="text-blue-900 font-semibold">{selectedGrant.grantingOrganization}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Montant Total</p>
                <p className="text-blue-900 font-semibold">
                  {selectedGrant.totalAmount.toLocaleString('fr-FR', { 
                    style: 'currency', 
                    currency: selectedGrant.currency === 'XOF' ? 'XOF' : selectedGrant.currency 
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Période</p>
                <p className="text-blue-900 font-semibold">
                  {new Date(selectedGrant.startDate).toLocaleDateString('fr-FR')} - {new Date(selectedGrant.endDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        )}

        {grants.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Aucune subvention disponible</p>
            <p className="text-sm text-gray-500">Créez d'abord une subvention dans le module "Gestion des Subventions"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrantSelector;