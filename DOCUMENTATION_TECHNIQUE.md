# Documentation Technique - BudgetFlow
## Plateforme de Gestion Budgétaire

### Version 1.0 - Architecture et Implémentation

---

## Table des Matières

1. [Architecture Générale](#architecture-générale)
2. [Stack Technologique](#stack-technologique)
3. [Base de Données](#base-de-données)
4. [Authentification et Sécurité](#authentification-et-sécurité)
5. [Structure du Code](#structure-du-code)
6. [Services et API](#services-et-api)
7. [Gestion d'État](#gestion-détat)
8. [Interface Utilisateur](#interface-utilisateur)
9. [Déploiement](#déploiement)
10. [Maintenance et Monitoring](#maintenance-et-monitoring)

---

## Architecture Générale

### Vue d'Ensemble

BudgetFlow est une application web moderne construite selon une architecture client-serveur avec les caractéristiques suivantes :

- **Frontend** : Application React TypeScript avec Vite
- **Backend** : Supabase (PostgreSQL + API REST automatique)
- **Authentification** : Supabase Auth avec RLS (Row Level Security)
- **Stockage** : Base de données PostgreSQL hébergée sur Supabase
- **Déploiement** : Application statique déployable sur CDN

### Principes Architecturaux

1. **Séparation des Responsabilités** : Logique métier séparée de l'interface
2. **Modularité** : Composants réutilisables et services indépendants
3. **Sécurité par Design** : RLS et validation côté serveur
4. **Performance** : Optimisations de rendu et requêtes
5. **Maintenabilité** : Code structuré et documenté

---

## Stack Technologique

### Frontend

```typescript
// Technologies principales
React 18.3.1          // Framework UI
TypeScript 5.5.3      // Typage statique
Vite 5.4.2           // Build tool et dev server
Tailwind CSS 3.4.1   // Framework CSS utilitaire

// Librairies complémentaires
Lucide React 0.344.0  // Icônes
SweetAlert2 11.22.5   // Alertes et modales
html2canvas 1.4.1     // Capture d'écran
jsPDF 3.0.2          // Génération PDF
```

### Backend et Services

```typescript
// Backend as a Service
Supabase 2.57.2       // BaaS complet
PostgreSQL 15         // Base de données
PostgREST            // API REST automatique
GoTrue               // Service d'authentification

// Sécurité
Row Level Security    // Sécurité au niveau des lignes
JWT Tokens           // Authentification stateless
HTTPS/TLS            // Chiffrement transport
```

### Outils de Développement

```typescript
ESLint 9.9.1         // Linting JavaScript/TypeScript
Prettier             // Formatage de code
TypeScript ESLint    // Règles TypeScript spécifiques
Autoprefixer         // Préfixes CSS automatiques
PostCSS              // Traitement CSS
```

---

## Base de Données

### Schéma Conceptuel

La base de données suit un modèle relationnel normalisé avec les entités principales :

```sql
-- Hiérarchie des données budgétaires
grants (subventions)
  ├── budget_lines (lignes budgétaires)
      ├── sub_budget_lines (sous-lignes budgétaires)
          ├── engagements
              ├── payments

-- Gestion des utilisateurs
user_roles (rôles)
  ├── users (utilisateurs)

-- Gestion bancaire
bank_accounts (comptes bancaires)
  ├── bank_transactions (transactions)

-- Modules spécialisés
prefinancings (préfinancements)
employee_loans (prêts employés)
app_settings (paramètres application)
```

### Tables Principales

#### 1. Subventions (grants)

```sql
CREATE TABLE grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  granting_organization TEXT NOT NULL,
  year INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('EUR', 'USD', 'XOF')),
  planned_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'completed', 'suspended')),
  description TEXT,
  bank_account JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. Lignes Budgétaires (budget_lines)

```sql
CREATE TABLE budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  planned_amount DECIMAL(15,2) DEFAULT 0,
  notified_amount DECIMAL(15,2) DEFAULT 0,
  engaged_amount DECIMAL(15,2) DEFAULT 0,
  available_amount DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  color TEXT DEFAULT 'bg-blue-100 text-blue-700',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Sous-lignes Budgétaires (sub_budget_lines)

```sql
CREATE TABLE sub_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  budget_line_id UUID NOT NULL REFERENCES budget_lines(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  planned_amount DECIMAL(15,2) DEFAULT 0,
  notified_amount DECIMAL(15,2) DEFAULT 0,
  engaged_amount DECIMAL(15,2) DEFAULT 0,
  available_amount DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Engagements (engagements)

```sql
CREATE TABLE engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  budget_line_id UUID NOT NULL REFERENCES budget_lines(id) ON DELETE CASCADE,
  sub_budget_line_id UUID NOT NULL REFERENCES sub_budget_lines(id) ON DELETE CASCADE,
  engagement_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  supplier TEXT,
  quote_reference TEXT,
  invoice_number TEXT,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  approvals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. Paiements (payments)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT UNIQUE NOT NULL,
  grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  budget_line_id UUID NOT NULL REFERENCES budget_lines(id) ON DELETE CASCADE,
  sub_budget_line_id UUID NOT NULL REFERENCES sub_budget_lines(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  supplier TEXT NOT NULL,
  description TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('check', 'transfer', 'cash')),
  check_number TEXT,
  bank_reference TEXT,
  invoice_number TEXT NOT NULL,
  invoice_amount DECIMAL(15,2) NOT NULL,
  quote_reference TEXT,
  delivery_note TEXT,
  purchase_order_number TEXT,
  service_acceptance BOOLEAN DEFAULT FALSE,
  control_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cashed', 'rejected')),
  cashed_date DATE,
  approvals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sécurité des Données (RLS)

Chaque table implémente Row Level Security avec des politiques spécifiques :

```sql
-- Exemple pour la table users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent lire leurs propres données
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Politique : Le service role peut tout gérer
CREATE POLICY "Service role can manage all users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Triggers et Fonctions

#### Mise à jour automatique des montants

```sql
-- Fonction pour recalculer les montants engagés
CREATE OR REPLACE FUNCTION update_budget_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer les montants de la sous-ligne budgétaire
  UPDATE sub_budget_lines 
  SET 
    engaged_amount = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM engagements 
      WHERE sub_budget_line_id = NEW.sub_budget_line_id 
        AND status IN ('approved', 'paid')
    ),
    available_amount = notified_amount - engaged_amount
  WHERE id = NEW.sub_budget_line_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur les engagements
CREATE TRIGGER update_amounts_on_engagement
  AFTER INSERT OR UPDATE OR DELETE ON engagements
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_amounts();
```

---

## Authentification et Sécurité

### Architecture d'Authentification

```typescript
// Flow d'authentification
1. Connexion utilisateur → Supabase Auth
2. Génération JWT token → Stockage sécurisé
3. Validation token → Chaque requête API
4. Chargement profil → Base de données users
5. Application permissions → Contrôle d'accès
```

### Gestion des Sessions

```typescript
// Configuration Supabase Auth
const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,    // Renouvellement automatique
    persistSession: true,      // Persistance entre sessions
    detectSessionInUrl: true   // Détection liens email
  }
});
```

### Politiques de Sécurité

1. **Authentification obligatoire** : Toutes les routes protégées
2. **Autorisation granulaire** : Permissions par module et action
3. **Validation côté serveur** : RLS PostgreSQL
4. **Chiffrement** : HTTPS obligatoire
5. **Audit trail** : Traçabilité complète des actions

---

## Structure du Code

### Organisation des Fichiers

```
src/
├── components/           # Composants React
│   ├── Dashboard.tsx    # Tableau de bord
│   ├── GrantManager.tsx # Gestion subventions
│   ├── BudgetPlanning.tsx
│   ├── BudgetTracking.tsx
│   ├── EngagementManager.tsx
│   ├── PaymentManager.tsx
│   ├── TreasuryManager.tsx
│   ├── UserManager.tsx
│   └── ...
├── hooks/               # Hooks React personnalisés
│   └── useAuth.ts      # Gestion authentification
├── lib/                # Configuration et utilitaires
│   ├── supabase.ts     # Client Supabase
│   └── database.types.ts # Types TypeScript générés
├── services/           # Services API
│   └── supabaseService.ts # Abstraction Supabase
├── types/              # Définitions TypeScript
│   ├── index.ts        # Types métier
│   └── user.ts         # Types utilisateurs
├── utils/              # Utilitaires
│   ├── alerts.ts       # Gestion des alertes
│   ├── storage.ts      # Persistance locale
│   └── print.ts        # Utilitaires impression
└── App.tsx             # Composant principal
```

### Patterns de Développement

#### 1. Composants Fonctionnels avec Hooks

```typescript
const GrantManager: React.FC<GrantManagerProps> = ({
  grants,
  onAddGrant,
  onUpdateGrant,
  onDeleteGrant
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  
  // Logique du composant...
  
  return (
    // JSX du composant...
  );
};
```

#### 2. Services avec Gestion d'Erreurs

```typescript
export const grantsService = {
  async create(grant: Omit<Grant, 'id'>): Promise<Grant> {
    try {
      const { data, error } = await supabase
        .from('grants')
        .insert(transformToDatabase(grant))
        .select()
        .single();

      if (error) throw error;
      return transformFromDatabase(data);
    } catch (error) {
      handleSupabaseError(error);
      throw error;
    }
  }
};
```

#### 3. Hooks Personnalisés

```typescript
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initialisation et écoute des changements d'auth
  }, []);
  
  return { user, loading, signIn, signOut, hasPermission };
};
```

---

## Services et API

### Architecture des Services

Les services encapsulent toute la logique d'accès aux données :

```typescript
// Structure type d'un service
interface ServiceInterface<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(item: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Transformation des Données

```typescript
// Transformation base de données ↔ application
const transformFromDatabase = (dbData: any): Grant => ({
  id: dbData.id,
  name: dbData.name,
  reference: dbData.reference,
  grantingOrganization: dbData.granting_organization, // snake_case → camelCase
  totalAmount: dbData.total_amount,
  // ...
});

const transformToDatabase = (appData: Grant): any => ({
  name: appData.name,
  reference: appData.reference,
  granting_organization: appData.grantingOrganization, // camelCase → snake_case
  total_amount: appData.totalAmount,
  // ...
});
```

### Gestion des Erreurs

```typescript
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  
  // Gestion spécifique des erreurs de contrainte
  if (error.code === '23505') {
    const constraint = error.details?.constraint;
    switch (constraint) {
      case 'users_email_key':
        throw new Error('Cet email est déjà utilisé');
      case 'grants_reference_key':
        throw new Error('Cette référence existe déjà');
      default:
        throw new Error('Une valeur en double existe déjà');
    }
  }
  
  // Autres codes d'erreur PostgreSQL
  if (error.code === '42501') throw new Error('Permission refusée');
  if (error.code === '42P01') throw new Error('Table non trouvée');
  
  throw error;
};
```

---

## Gestion d'État

### État Local avec useState

```typescript
// État des formulaires
const [formData, setFormData] = useState({
  name: '',
  amount: '',
  description: ''
});

// État des modales
const [showModal, setShowModal] = useState(false);
const [editingItem, setEditingItem] = useState<Item | null>(null);
```

### État Global avec Context (si nécessaire)

```typescript
// Contexte d'authentification
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const authState = useAuth();
  
  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Synchronisation avec Supabase

```typescript
// Écoute des changements en temps réel
useEffect(() => {
  const subscription = supabase
    .channel('budget_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'engagements' },
      (payload) => {
        // Mettre à jour l'état local
        handleRealtimeUpdate(payload);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

---

## Interface Utilisateur

### Système de Design

#### Couleurs

```css
/* Palette principale */
--blue-600: #2563eb;      /* Actions principales */
--purple-600: #9333ea;    /* Actions secondaires */
--green-600: #16a34a;     /* Succès/validation */
--orange-600: #ea580c;    /* Alertes */
--red-600: #dc2626;       /* Erreurs/suppression */
--gray-600: #4b5563;      /* Texte secondaire */
```

#### Composants Réutilisables

```typescript
// Bouton avec gradient
const GradientButton: React.FC<ButtonProps> = ({ children, variant, ...props }) => (
  <button
    className={`
      bg-gradient-to-r font-medium px-4 py-2 rounded-xl
      hover:shadow-lg transform hover:scale-[1.02] 
      transition-all duration-200 flex items-center space-x-2
      ${variant === 'primary' ? 'from-blue-600 to-purple-600 text-white' : ''}
      ${variant === 'success' ? 'from-green-600 to-blue-600 text-white' : ''}
    `}
    {...props}
  >
    {children}
  </button>
);
```

#### Responsive Design

```typescript
// Breakpoints Tailwind utilisés
sm: '640px'   // Mobile large
md: '768px'   // Tablette
lg: '1024px'  // Desktop
xl: '1280px'  // Large desktop

// Exemple d'utilisation
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Contenu responsive */}
</div>
```

### Gestion des Formulaires

```typescript
// Pattern de formulaire standard
const FormComponent: React.FC = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) newErrors.name = 'Le nom est obligatoire';
    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Le montant doit être positif';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      await service.create(formData);
      showSuccess('Élément créé avec succès');
      resetForm();
    } catch (error) {
      showError('Erreur lors de la création');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Champs du formulaire */}
    </form>
  );
};
```

---

## Déploiement

### Configuration de Production

#### Variables d'Environnement

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application
VITE_APP_NAME=BudgetFlow
VITE_APP_VERSION=1.0.0
```

#### Build de Production

```bash
# Installation des dépendances
npm install

# Build optimisé
npm run build

# Aperçu local du build
npm run preview
```

### Optimisations de Performance

#### Code Splitting

```typescript
// Lazy loading des composants
const GrantManager = lazy(() => import('./components/GrantManager'));
const PaymentManager = lazy(() => import('./components/PaymentManager'));

// Utilisation avec Suspense
<Suspense fallback={<LoadingSpinner />}>
  <GrantManager />
</Suspense>
```

#### Optimisation des Requêtes

```typescript
// Sélection spécifique des colonnes
const { data } = await supabase
  .from('grants')
  .select('id, name, reference, total_amount') // Seulement les colonnes nécessaires
  .eq('status', 'active');

// Pagination pour les grandes listes
const { data } = await supabase
  .from('engagements')
  .select('*')
  .range(0, 49) // 50 premiers éléments
  .order('created_at', { ascending: false });
```

### Monitoring et Logs

```typescript
// Logging structuré
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    // Envoi vers service de monitoring en production
  }
};
```

---

## Maintenance et Monitoring

### Migrations de Base de Données

```sql
-- Structure des migrations Supabase
-- Fichier: supabase/migrations/YYYYMMDD_description.sql

/*
  # Description de la migration
  
  1. Nouvelles tables
     - table_name: description
  
  2. Modifications
     - Ajout de colonnes
     - Modification de contraintes
  
  3. Sécurité
     - Nouvelles politiques RLS
*/

-- SQL de la migration
CREATE TABLE IF NOT EXISTS new_table (...);
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column TEXT;
```

### Sauvegarde et Récupération

```bash
# Sauvegarde automatique Supabase
# - Sauvegardes quotidiennes automatiques
# - Rétention de 7 jours pour le plan gratuit
# - Point-in-time recovery disponible

# Sauvegarde manuelle
pg_dump "postgresql://..." > backup_$(date +%Y%m%d).sql
```

### Monitoring des Performances

```typescript
// Métriques à surveiller
interface PerformanceMetrics {
  responseTime: number;        // Temps de réponse API
  errorRate: number;          // Taux d'erreur
  activeUsers: number;        // Utilisateurs actifs
  databaseConnections: number; // Connexions DB
  memoryUsage: number;        // Utilisation mémoire
}

// Alertes automatiques
const alerts = {
  responseTime: { threshold: 2000, action: 'notify_admin' },
  errorRate: { threshold: 5, action: 'escalate' },
  databaseConnections: { threshold: 80, action: 'scale_up' }
};
```

### Mise à Jour et Versioning

```json
// package.json - Gestion des versions
{
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest"
  }
}
```

---

## Sécurité et Conformité

### Chiffrement des Données

- **En transit** : HTTPS/TLS 1.3
- **Au repos** : Chiffrement AES-256 (Supabase)
- **Mots de passe** : Hachage bcrypt avec salt

### Audit et Conformité

```sql
-- Table d'audit automatique
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger d'audit
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id)
  VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### Protection contre les Attaques

1. **SQL Injection** : Requêtes paramétrées (Supabase)
2. **XSS** : Échappement automatique React
3. **CSRF** : Tokens JWT avec expiration
4. **Rate Limiting** : Limitation des requêtes par utilisateur
5. **Validation** : Côté client et serveur

---

## Tests et Qualité

### Tests Unitaires

```typescript
// Exemple de test avec Vitest
import { describe, it, expect, vi } from 'vitest';
import { grantsService } from '../services/supabaseService';

describe('grantsService', () => {
  it('should create a grant successfully', async () => {
    const mockGrant = {
      name: 'Test Grant',
      reference: 'TEST-2024-001',
      totalAmount: 100000,
      currency: 'EUR' as const
    };
    
    const result = await grantsService.create(mockGrant);
    expect(result.id).toBeDefined();
    expect(result.name).toBe(mockGrant.name);
  });
});
```

### Tests d'Intégration

```typescript
// Test de bout en bout
describe('Budget Planning Flow', () => {
  it('should create budget line and sub-lines', async () => {
    // 1. Créer une subvention
    const grant = await grantsService.create(mockGrant);
    
    // 2. Créer une ligne budgétaire
    const budgetLine = await budgetLinesService.create({
      grantId: grant.id,
      code: 'TEST-PERS',
      name: 'Personnel Test',
      plannedAmount: 50000
    });
    
    // 3. Créer une sous-ligne
    const subBudgetLine = await subBudgetLinesService.create({
      grantId: grant.id,
      budgetLineId: budgetLine.id,
      code: 'TEST-PERS-001',
      name: 'Développeur',
      plannedAmount: 25000
    });
    
    expect(subBudgetLine.budgetLineId).toBe(budgetLine.id);
  });
});
```

### Qualité du Code

```typescript
// Configuration ESLint
export default {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'prefer-const': 'error'
  }
};
```

---

## Performance et Optimisation

### Optimisations Frontend

```typescript
// Mémorisation des composants coûteux
const ExpensiveComponent = React.memo(({ data }) => {
  return <ComplexVisualization data={data} />;
});

// Optimisation des re-rendus
const useOptimizedState = (initialValue: any[]) => {
  const [state, setState] = useState(initialValue);
  
  const updateState = useCallback((newValue: any[]) => {
    setState(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newValue)) {
        return prev; // Éviter les re-rendus inutiles
      }
      return newValue;
    });
  }, []);
  
  return [state, updateState];
};
```

### Optimisations Base de Données

```sql
-- Index pour les requêtes fréquentes
CREATE INDEX idx_engagements_grant_id ON engagements(grant_id);
CREATE INDEX idx_engagements_status ON engagements(status);
CREATE INDEX idx_payments_engagement_id ON payments(engagement_id);

-- Index composites pour les requêtes complexes
CREATE INDEX idx_sub_budget_lines_grant_budget 
  ON sub_budget_lines(grant_id, budget_line_id);
```

---

## Évolutions Futures

### Roadmap Technique

**Version 1.1**
- Notifications en temps réel (WebSockets)
- Export Excel natif
- API REST publique

**Version 1.2**
- Application mobile (React Native)
- Synchronisation hors ligne
- Workflow avancé

**Version 2.0**
- Intelligence artificielle (prédictions budgétaires)
- Intégrations ERP
- Multi-tenant

### Extensibilité

```typescript
// Plugin system pour extensions
interface BudgetFlowPlugin {
  name: string;
  version: string;
  initialize: (app: BudgetFlowApp) => void;
  routes?: Route[];
  components?: ComponentMap;
}

// Enregistrement de plugins
const registerPlugin = (plugin: BudgetFlowPlugin) => {
  plugins.set(plugin.name, plugin);
  plugin.initialize(app);
};
```

---

## Annexes Techniques

### Configuration Supabase

```sql
-- Configuration RLS globale
ALTER DATABASE postgres SET row_security = on;

-- Fonctions utilitaires
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS UUID AS $$
  SELECT auth.jwt() ->> 'sub'::UUID;
$$ LANGUAGE sql STABLE;
```

### Scripts de Déploiement

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Déploiement BudgetFlow"

# Vérifications pré-déploiement
npm run type-check
npm run lint
npm run test

# Build de production
npm run build

# Déploiement
echo "📦 Upload des fichiers..."
# Commandes de déploiement spécifiques à votre hébergeur

echo "✅ Déploiement terminé"
```

### Monitoring et Alertes

```typescript
// Configuration monitoring
const monitoring = {
  performance: {
    threshold: 2000, // ms
    action: 'log_slow_query'
  },
  errors: {
    threshold: 10, // erreurs/minute
    action: 'notify_admin'
  },
  users: {
    concurrent_limit: 100,
    action: 'scale_resources'
  }
};
```

---

*Cette documentation technique est maintenue à jour avec chaque version. Dernière mise à jour : Version 1.0 - Janvier 2025*