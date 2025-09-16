import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Shield, Eye, EyeOff, Key, UserCheck } from 'lucide-react';
import { showSuccess, showError, showWarning, showValidationError, confirmDelete } from '../utils/alerts';
import { User, UserRole, DEFAULT_ROLES, USER_STATUS, Permission, PermissionAction } from '../types/user';
import { supabase } from '../lib/supabase';
import { usersService } from '../services/supabaseService';

interface UserManagerProps {
  users: User[];
  roles: UserRole[];
  currentUser: User;
  onAddUser: (user: User) => void;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onAddRole: (role: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateRole: (id: string, updates: Partial<UserRole>) => void;
  onDeleteRole: (id: string) => void;
}

interface PermissionSelection {
  id: string;
  name: string;
  module: string;
  actions: PermissionAction[];
  selectedActions: string[];
}

const UserManager: React.FC<UserManagerProps> = ({
  users,
  roles,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onAddRole,
  onUpdateRole,
  onDeleteRole
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [userFormData, setUserFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    profession: '',
    employeeId: '',
    roleId: '',
    password: '',
    confirmPassword: '',
    isActive: true
  });

  const [roleFormData, setRoleFormData] = useState({
    name: '',
    code: '',
    description: '',
    color: 'bg-blue-100 text-blue-700',
    isActive: true,
    permissionSelections: [] as PermissionSelection[]
  });

  const resetUserForm = () => {
    setUserFormData({
      email: '',
      firstName: '',
      lastName: '',
      profession: '',
      employeeId: '',
      roleId: '',
      password: '',
      confirmPassword: '',
      isActive: true
    });
    setShowUserForm(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const resetRoleForm = () => {
    setRoleFormData({
      name: '',
      code: '',
      description: '',
      color: 'bg-blue-100 text-blue-700',
      isActive: true,
      permissionSelections: []
    });
    setShowRoleForm(false);
    setEditingRole(null);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!userFormData.email || !userFormData.firstName || !userFormData.lastName || !userFormData.roleId) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir tous les champs marqués d\'un astérisque (*)');
      setLoading(false);
      return;
    }

    if (!editingUser && (!userFormData.password || userFormData.password !== userFormData.confirmPassword)) {
      showValidationError('Mots de passe différents', 'Les mots de passe saisis ne correspondent pas');
      setLoading(false);
      return;
    }

    try {
      if (editingUser) {
        const updatedUser = await usersService.update(editingUser.id, {
          email: userFormData.email,
          firstName: userFormData.firstName,
          lastName: userFormData.lastName,
          profession: userFormData.profession,
          employeeId: userFormData.employeeId,
          roleId: userFormData.roleId,
          isActive: userFormData.isActive
        });
        
        onUpdateUser(editingUser.id, updatedUser);
        showSuccess('Succès', 'Utilisateur modifié avec succès');
      } else {
            // ÉTAPE 1 : Création dans Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: userFormData.email,
                password: userFormData.password,
                options: {
                    data: {
                        first_name: userFormData.firstName,
                        last_name: userFormData.lastName,
                        profession: userFormData.profession
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Erreur lors de la création du compte auth');

            // ✅ CORRECTION 1 : Récupérer l'ID de l'utilisateur nouvellement créé
            const newUserId = authData.user.id; 

            const newUserData = {
                id: newUserId, // ✅ CORRECTION 2 : Ajouter l'ID ici
                email: userFormData.email,
                firstName: userFormData.firstName,
                lastName: userFormData.lastName,
                profession: userFormData.profession,
                employeeId: userFormData.employeeId,
                roleId: userFormData.roleId,
                isActive: userFormData.isActive,
                createdBy: currentUser.id
            };

            // ÉTAPE 2 : Création dans la table 'users' avec l'ID correct
            const newUser = await usersService.create(newUserData);
            onAddUser(newUser);
            
            showSuccess('Succès', 'Utilisateur créé avec succès. Un email de confirmation a été envoyé.');
        }

        resetUserForm();
    } catch (error: any) {
        console.error('Error in user operation:', error);
        showError('Erreur', error.message || 'Une erreur est survenue');
    } finally {
        setLoading(false);
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roleFormData.name || !roleFormData.code || !roleFormData.description) {
      showValidationError('Champs obligatoires manquants', 'Veuillez remplir le nom, le code et la description du rôle');
      return;
    }

    const permissions: Permission[] = roleFormData.permissionSelections
      .filter(selection => selection.selectedActions.length > 0)
      .map(selection => ({
        id: selection.id,
        name: selection.name,
        module: selection.module,
        actions: selection.selectedActions as PermissionAction[]
      }));

    if (editingRole) {
      onUpdateRole(editingRole.id, {
        name: roleFormData.name,
        code: roleFormData.code,
        description: roleFormData.description,
        color: roleFormData.color,
        isActive: roleFormData.isActive,
        permissions: permissions,
        updatedAt: new Date().toISOString()
      });
    } else {
      onAddRole({
        name: roleFormData.name,
        code: roleFormData.code,
        description: roleFormData.description,
        color: roleFormData.color,
        isActive: roleFormData.isActive,
        permissions: permissions
      });
    }

    resetRoleForm();
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profession: user.profession || '',
      employeeId: user.employeeId || '',
      roleId: user.roleId,
      password: '',
      confirmPassword: '',
      isActive: user.isActive
    });
    setShowUserForm(true);
  };

  const startEditRole = (role: UserRole) => {
    const permissionSelections: PermissionSelection[] = DEFAULT_ROLES[0].permissions.map(defaultPermission => {
      const rolePermission = role.permissions.find(p => p.id === defaultPermission.id);
      
      return {
        id: defaultPermission.id,
        name: defaultPermission.name,
        module: defaultPermission.module,
        actions: defaultPermission.actions,
        selectedActions: rolePermission ? rolePermission.actions : []
      };
    });

    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      code: role.code,
      description: role.description,
      color: role.color,
      isActive: role.isActive,
      permissionSelections
    });
    setShowRoleForm(true);
  };

  const getRole = (roleId: string) => {
    return roles.find(role => role.id === roleId);
  };

  const getCreatedBy = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Système';
  };

  const colorOptions = [
    { value: 'bg-red-100 text-red-700', label: 'Rouge', preview: 'bg-red-100' },
    { value: 'bg-blue-100 text-blue-700', label: 'Bleu', preview: 'bg-blue-100' },
    { value: 'bg-green-100 text-green-700', label: 'Vert', preview: 'bg-green-100' },
    { value: 'bg-yellow-100 text-yellow-700', label: 'Jaune', preview: 'bg-yellow-100' },
    { value: 'bg-purple-100 text-purple-700', label: 'Violet', preview: 'bg-purple-100' },
    { value: 'bg-pink-100 text-pink-700', label: 'Rose', preview: 'bg-pink-100' },
    { value: 'bg-indigo-100 text-indigo-700', label: 'Indigo', preview: 'bg-indigo-100' },
    { value: 'bg-orange-100 text-orange-700', label: 'Orange', preview: 'bg-orange-100' }
  ];

  useEffect(() => {
    if (showRoleForm && !editingRole && roleFormData.permissionSelections.length === 0) {
      const initialPermissionSelections: PermissionSelection[] = DEFAULT_ROLES[0].permissions.map(permission => ({
        id: permission.id,
        name: permission.name,
        module: permission.module,
        actions: permission.actions,
        selectedActions: []
      }));
      
      setRoleFormData(prev => ({ ...prev, permissionSelections: initialPermissionSelections }));
    }
  }, [showRoleForm, editingRole]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h2>
          <p className="text-gray-600 mt-1">Administration centralisée des utilisateurs et des rôles</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowRoleForm(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
          >
            <Shield className="w-4 h-4" />
            <span>Nouveau Rôle</span>
          </button>
          <button
            onClick={() => setShowUserForm(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel Utilisateur</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Utilisateurs ({users.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'roles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Rôles ({roles.length})</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun utilisateur</h3>
                  <p className="text-gray-500 mb-4">Commencez par créer votre premier utilisateur</p>
                  <button
                    onClick={() => setShowUserForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Créer un utilisateur
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Utilisateur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fonction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rôle
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dernière connexion
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(user => {
                        const userRole = getRole(user.roleId);
                        return (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                                  <span className="text-white font-medium text-sm">
                                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                  {user.employeeId && (
                                    <div className="text-xs text-gray-400">ID: {user.employeeId}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {user.profession || 'Non spécifiée'}
                            </td>
                            <td className="px-6 py-4">
                              {userRole && (
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${userRole.color}`}>
                                  {userRole.name}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                user.isActive ? USER_STATUS.active.color : USER_STATUS.inactive.color
                              }`}>
                                {user.isActive ? USER_STATUS.active.label : USER_STATUS.inactive.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {user.lastLogin 
                                ? new Date(user.lastLogin).toLocaleDateString('fr-FR')
                                : 'Jamais connecté'
                              }
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => startEditUser(user)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {user.id !== currentUser.id && (
                                  <button
                                    onClick={() => {
                                      if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
                                        onDeleteUser(user.id);
                                      }
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
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
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              {roles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Shield className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun rôle</h3>
                  <p className="text-gray-500 mb-4">Commencez par créer votre premier rôle</p>
                  <button
                    onClick={() => setShowRoleForm(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    Créer un rôle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {roles.map(role => {
                    const usersWithRole = users.filter(user => user.roleId === role.id);
                    return (
                      <div key={role.id} className="bg-gray-50 rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
                              <Shield className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{role.name}</h3>
                              <p className="text-sm text-gray-600">{role.code}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${role.color}`}>
                              {role.isActive ? 'Actif' : 'Inactif'}
                            </span>
                            <button
                              onClick={() => startEditRole(role)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {usersWithRole.length === 0 && (
                              <button
                                onClick={() => {
                                  if (confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) {
                                    onDeleteRole(role.id);
                                  }
                                }}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">{role.description}</p>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Utilisateurs assignés</span>
                            <span className="text-sm font-bold text-blue-600">{usersWithRole.length}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Permissions</span>
                            <span className="text-sm font-bold text-purple-600">{role.permissions.length}</span>
                          </div>

                          {role.permissions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-600 mb-2">Modules autorisés :</p>
                              <div className="flex flex-wrap gap-1">
                                {[...new Set(role.permissions.map(p => p.module))].map(module => (
                                  <span key={module} className="px-2 py-1 text-xs bg-white text-gray-600 rounded border">
                                    {module}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Form Modal */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h3>
            
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={userFormData.firstName}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Jean"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={userFormData.lastName}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Dupont"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: jean.dupont@entreprise.com"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fonction
                  </label>
                  <input
                    type="text"
                    value={userFormData.profession}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, profession: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Développeur"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Matricule employé
                  </label>
                  <input
                    type="text"
                    value={userFormData.employeeId}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: EMP-2024-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle *
                </label>
                <select
                  value={userFormData.roleId}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, roleId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionner un rôle</option>
                  {roles.filter(role => role.isActive).map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {!editingUser && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={userFormData.password}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                        placeholder="Mot de passe"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmer le mot de passe *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={userFormData.confirmPassword}
                      onChange={(e) => setUserFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Confirmer le mot de passe"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={userFormData.isActive}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Compte actif</span>
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetUserForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Traitement...' : editingUser ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Form Modal */}
      {showRoleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
            </h3>
            
            <form onSubmit={handleRoleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du rôle *
                  </label>
                  <input
                    type="text"
                    value={roleFormData.name}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Responsable Financier"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={roleFormData.code}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: FINANCE_MANAGER"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description du rôle et de ses responsabilités..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur d'affichage
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setRoleFormData(prev => ({ ...prev, color: color.value }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        roleFormData.color === color.value 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-8 rounded ${color.preview} mb-2`}></div>
                      <span className="text-xs text-gray-600">{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 space-y-4">
                  {roleFormData.permissionSelections.map(permission => (
                    <div key={permission.id} className="bg-gray-50 rounded-lg p-4">
                      <label className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={permission.selectedActions.length > 0}
                          onChange={(e) => {
                            const newPermissionSelections = [...roleFormData.permissionSelections];
                            const index = newPermissionSelections.findIndex(p => p.id === permission.id);
                            
                            if (e.target.checked) {
                              newPermissionSelections[index].selectedActions = [...permission.actions];
                            } else {
                              newPermissionSelections[index].selectedActions = [];
                            }
                            
                            setRoleFormData(prev => ({ ...prev, permissionSelections: newPermissionSelections }));
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{permission.name}</div>
                          <div className="text-xs text-gray-500">Module: {permission.module}</div>
                          
                          <div className="mt-2 space-y-2">
                            <div className="text-xs font-medium text-gray-700">Actions:</div>
                            <div className="flex flex-wrap gap-2">
                              {permission.actions.map(action => (
                                <label key={action} className="flex items-center space-x-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={permission.selectedActions.includes(action)}
                                    onChange={(e) => {
                                      const newPermissionSelections = [...roleFormData.permissionSelections];
                                      const permissionIndex = newPermissionSelections.findIndex(p => p.id === permission.id);
                                      
                                      if (e.target.checked) {
                                        newPermissionSelections[permissionIndex].selectedActions = [
                                          ...newPermissionSelections[permissionIndex].selectedActions,
                                          action
                                        ];
                                      } else {
                                        newPermissionSelections[permissionIndex].selectedActions = 
                                          newPermissionSelections[permissionIndex].selectedActions.filter(a => a !== action);
                                      }
                                      
                                      setRoleFormData(prev => ({ ...prev, permissionSelections: newPermissionSelections }));
                                    }}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    disabled={!permission.selectedActions.length && !permission.selectedActions.includes(action)}
                                  />
                                  <span className="text-gray-600">{action}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={roleFormData.isActive}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Rôle actif</span>
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetRoleForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  {editingRole ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;