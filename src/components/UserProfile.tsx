import React, { useState, useEffect } from 'react';
import { User, Edit, Save, X, Eye, EyeOff, Shield, Mail, Phone, Calendar, Briefcase, Hash } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { showSuccess, showError, showValidationError } from '../utils/alerts';
import { usersService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

const UserProfile: React.FC = () => {
  const { userProfile, userRole, signOut } = useAuth();
  
// === SYSTÈME DE PERMISSIONS ===
  const { hasPermission, hasModuleAccess, loading: permissionsLoading } = usePermissions();

  // === HOOKS DE BASE ===
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    profession: '',
    employeeId: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Permissions spécifiques au module Profile
  const canView = hasPermission('profile', 'view');
  const canUpdate = hasPermission('profile', 'edit');
  const canChangePassword = hasPermission('profile', 'edit');
  const canViewSensitive = hasPermission('profile', 'view');

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        email: userProfile.email,
        profession: userProfile.profession || '',
        employeeId: canViewSensitive ? (userProfile.employeeId || '') : '***'
      });
    }
  }, [userProfile, canViewSensitive]);

    

  

  // === VÉRIFICATION DES PERMISSIONS - APRÈS LES HOOKS ===
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

  if (!hasModuleAccess('profile')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès non autorisé</h2>
          <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder au profil.</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Permission refusée</h2>
          <p className="text-gray-500">Vous n'avez pas la permission de visualiser les profils.</p>
        </div>
      </div>
    );
  }

  

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canUpdate) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de modifier le profil');
      return;
    }
    
    if (!profileData.firstName || !profileData.lastName || !profileData.email) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir le prénom, le nom et l\'email');
      return;
    }

    try {
      await usersService.update(userProfile!.id, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        profession: profileData.profession,
        employeeId: canViewSensitive ? profileData.employeeId : userProfile.employeeId,
        updatedAt: new Date().toISOString()
      });

      showSuccess('Profil mis à jour', 'Vos informations ont été mises à jour avec succès');
      setIsEditing(false);
      
      // Recharger la page pour mettre à jour les données dans l'interface
      // window.location.reload();
    } catch (error) {
      showError('Erreur', 'Impossible de mettre à jour le profil');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canChangePassword) {
      showError('Permission refusée', 'Vous n\'avez pas la permission de modifier le mot de passe');
      return;
    }
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir tous les champs du mot de passe');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showValidationError('Mots de passe différents', 'Le nouveau mot de passe et sa confirmation ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showValidationError('Mot de passe trop court', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      // Vérifier d'abord le mot de passe actuel en tentant une connexion
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userProfile!.email,
        password: passwordData.currentPassword
      });

      if (signInError) {
        showValidationError('Mot de passe incorrect', 'Le mot de passe actuel que vous avez saisi est incorrect');
        return;
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) {
        throw updateError;
      }

      showSuccess('Mot de passe mis à jour', 'Votre mot de passe a été modifié avec succès. Vous pouvez maintenant l\'utiliser pour vous connecter.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
    } catch (error) {
      console.error('Password update error:', error);
      showError('Erreur', 'Impossible de modifier le mot de passe. Veuillez réessayer.');
    }
  };

  const cancelEdit = () => {
    if (userProfile) {
      setProfileData({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        email: userProfile.email,
        profession: userProfile.profession || '',
        employeeId: canViewSensitive ? (userProfile.employeeId || '') : '***'
      });
    }
    setIsEditing(false);
  };

  const cancelPasswordChange = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordForm(false);
  };

  if (!userProfile || !userRole) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mon Profil</h2>
          <p className="text-gray-600 mt-1">Gérez vos informations personnelles et paramètres de compte</p>
        </div>
        <div className="flex items-center space-x-3">
          {!isEditing && canUpdate && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>Modifier le profil</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Informations Personnelles</h3>
              {isEditing && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {userProfile.firstName.charAt(0)}{userProfile.lastName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">
                    {userProfile.firstName} {userProfile.lastName}
                  </h4>
                  <p className="text-gray-600">{userRole.name}</p>
                  <p className="text-sm text-gray-500">{userProfile.email}</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Votre prénom"
                    required
                    disabled={!isEditing || !canUpdate}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Votre nom"
                    required
                    disabled={!isEditing || !canUpdate}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Adresse email *
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="votre.email@entreprise.com"
                  required
                  disabled
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Fonction
                  </label>
                  <input
                    type="text"
                    value={profileData.profession}
                    onChange={(e) => setProfileData(prev => ({ ...prev, profession: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Ex: Directeur Financier"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Matricule employé
                  </label>
                  <input
                    type="text"
                    value={profileData.employeeId}
                    onChange={(e) => canViewSensitive && setProfileData(prev => ({ ...prev, employeeId: e.target.value }))}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      !canViewSensitive ? 'bg-gray-100 text-gray-500' : ''
                    }`}
                    placeholder="Ex: ADMIN-001"
                    disabled
                    title={!canViewSensitive ? "Vous n'avez pas la permission de voir cette information" : ""}
                  />
                  {!canViewSensitive && (
                    <p className="text-xs text-gray-500 mt-1">Information sensible - accès restreint</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && canUpdate && (
                <div className="flex space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <Save className="w-5 h-5" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Password Change Section */}
          {canChangePassword && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Sécurité du Compte</h3>
                {!showPasswordForm && (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Changer le mot de passe</span>
                  </button>
                )}
              </div>

              {!showPasswordForm ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Mot de passe</p>
                      <p className="text-sm text-gray-600">Dernière modification: {userProfile.updatedAt ? new Date(userProfile.updatedAt).toLocaleDateString('fr-FR') : 'Inconnue'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mot de passe actuel *
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 transition-colors"
                        placeholder="Votre mot de passe actuel"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nouveau mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 transition-colors"
                        placeholder="Nouveau mot de passe (min. 6 caractères)"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmer le nouveau mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 transition-colors"
                        placeholder="Confirmer le nouveau mot de passe"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-red-500 text-sm mt-1">Les mots de passe ne correspondent pas</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={cancelPasswordChange}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={passwordData.newPassword !== passwordData.confirmPassword || passwordData.newPassword.length < 6}
                      className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Modifier le mot de passe</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="space-y-6">
          {/* Role Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rôle et Permissions</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{userRole.name}</p>
                  <p className="text-sm text-gray-600">{userRole.code}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">{userRole.description}</p>
                
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Modules autorisés:</p>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(userRole.permissions.map(p => p.module))].map(module => (
                      <span key={module} className="px-2 py-1 text-xs bg-white text-gray-600 rounded border">
                        {module}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Statistics */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques du Compte</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Membre depuis</span>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {new Date(userProfile.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Dernière connexion</span>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {userProfile.lastLogin 
                    ? new Date(userProfile.lastLogin).toLocaleDateString('fr-FR')
                    : 'Première connexion'
                  }
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Statut du compte</span>
                </div>
                <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                  userProfile.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {userProfile.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions Rapides</h3>
            
            <div className="space-y-3">
              {canChangePassword && (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors"
                >
                  <Shield className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-gray-900">Changer le mot de passe</p>
                    <p className="text-sm text-gray-600">Modifier votre mot de passe de connexion</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                    signOut();
                  }
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
              >
                <User className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-gray-900">Se déconnecter</p>
                  <p className="text-sm text-gray-600">Fermer votre session actuelle</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;