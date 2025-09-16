/*
  # Create users and roles tables

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key)
      - `name` (text)
      - `code` (text, unique)
      - `description` (text)
      - `permissions` (jsonb)
      - `color` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `first_name` (text)
      - `last_name` (text)
      - `profession` (text, nullable)
      - `employee_id` (text, nullable)
      - `role_id` (uuid, foreign key to user_roles)
      - `is_active` (boolean)
      - `last_login` (timestamp, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create user_roles table first
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  color text DEFAULT 'bg-blue-100 text-blue-700',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  profession text,
  employee_id text,
  role_id uuid REFERENCES user_roles(id),
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Anyone can read user roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM user_roles WHERE code = 'ADMIN'
      )
    )
  );

-- RLS Policies for users
CREATE POLICY "Users can read their own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM user_roles WHERE code = 'ADMIN'
      )
    )
  );

CREATE POLICY "Anyone can insert first user"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if no users exist (first user)
    NOT EXISTS (SELECT 1 FROM users)
    OR
    -- Allow if current user is admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM user_roles WHERE code = 'ADMIN'
      )
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM user_roles WHERE code = 'ADMIN'
      )
    )
  );

-- Insert default roles with proper UUIDs
INSERT INTO user_roles (id, name, code, description, permissions, color, is_active) VALUES
(gen_random_uuid(), 'Administrateur', 'ADMIN', 'Accès complet à toutes les fonctionnalités', 
 '[
   {"id": "1", "name": "Gestion des subventions", "code": "GRANTS_MANAGEMENT", "module": "grants", "actions": ["create", "read", "update", "delete"]},
   {"id": "2", "name": "Planification budgétaire", "code": "BUDGET_PLANNING", "module": "planning", "actions": ["create", "read", "update", "delete"]},
   {"id": "3", "name": "Suivi budgétaire", "code": "BUDGET_TRACKING", "module": "tracking", "actions": ["read"]},
   {"id": "4", "name": "Gestion des engagements", "code": "ENGAGEMENTS_MANAGEMENT", "module": "engagements", "actions": ["create", "read", "update", "approve"]},
   {"id": "5", "name": "Validation des engagements", "code": "ENGAGEMENTS_VALIDATION", "module": "engagements", "actions": ["validate"]},
   {"id": "6", "name": "Gestion des paiements", "code": "PAYMENTS_MANAGEMENT", "module": "payments", "actions": ["create", "read", "update", "approve"]},
   {"id": "7", "name": "Validation des paiements", "code": "PAYMENTS_VALIDATION", "module": "payments", "actions": ["validate"]},
   {"id": "8", "name": "Gestion de trésorerie", "code": "TREASURY_MANAGEMENT", "module": "treasury", "actions": ["create", "read", "update", "delete"]},
   {"id": "9", "name": "Préfinancements", "code": "PREFINANCING_MANAGEMENT", "module": "prefinancing", "actions": ["create", "read", "update", "approve", "validate"]},
   {"id": "10", "name": "Prêts employés", "code": "LOANS_MANAGEMENT", "module": "loans", "actions": ["create", "read", "update", "approve", "validate"]},
   {"id": "11", "name": "Rapports et analyses", "code": "REPORTS_ACCESS", "module": "reports", "actions": ["read", "export"]},
   {"id": "12", "name": "Administration système", "code": "SYSTEM_ADMIN", "module": "admin", "actions": ["create", "read", "update", "delete", "manage_users", "manage_roles"]},
   {"id": "13", "name": "Lecture seule globale", "code": "READ_ONLY_ACCESS", "module": "all", "actions": ["read"]}
 ]'::jsonb, 
 'bg-red-100 text-red-700', true),

(gen_random_uuid(), 'Responsable Financier', 'FINANCE_MANAGER', 'Gestion complète des budgets et validation des paiements',
 '[
   {"id": "1", "name": "Gestion des subventions", "code": "GRANTS_MANAGEMENT", "module": "grants", "actions": ["create", "read", "update", "delete"]},
   {"id": "2", "name": "Planification budgétaire", "code": "BUDGET_PLANNING", "module": "planning", "actions": ["create", "read", "update", "delete"]},
   {"id": "3", "name": "Suivi budgétaire", "code": "BUDGET_TRACKING", "module": "tracking", "actions": ["read"]},
   {"id": "4", "name": "Gestion des engagements", "code": "ENGAGEMENTS_MANAGEMENT", "module": "engagements", "actions": ["create", "read", "update", "approve"]},
   {"id": "5", "name": "Validation des engagements", "code": "ENGAGEMENTS_VALIDATION", "module": "engagements", "actions": ["validate"]},
   {"id": "6", "name": "Gestion des paiements", "code": "PAYMENTS_MANAGEMENT", "module": "payments", "actions": ["create", "read", "update", "approve"]},
   {"id": "7", "name": "Validation des paiements", "code": "PAYMENTS_VALIDATION", "module": "payments", "actions": ["validate"]},
   {"id": "8", "name": "Gestion de trésorerie", "code": "TREASURY_MANAGEMENT", "module": "treasury", "actions": ["create", "read", "update", "delete"]},
   {"id": "9", "name": "Préfinancements", "code": "PREFINANCING_MANAGEMENT", "module": "prefinancing", "actions": ["create", "read", "update", "approve", "validate"]},
   {"id": "10", "name": "Prêts employés", "code": "LOANS_MANAGEMENT", "module": "loans", "actions": ["create", "read", "update", "approve", "validate"]},
   {"id": "11", "name": "Rapports et analyses", "code": "REPORTS_ACCESS", "module": "reports", "actions": ["read", "export"]}
 ]'::jsonb,
 'bg-blue-100 text-blue-700', true),

(gen_random_uuid(), 'Gestionnaire de Projet', 'PROJECT_MANAGER', 'Gestion des engagements et suivi budgétaire',
 '[
   {"id": "3", "name": "Suivi budgétaire", "code": "BUDGET_TRACKING", "module": "tracking", "actions": ["read"]},
   {"id": "4", "name": "Gestion des engagements", "code": "ENGAGEMENTS_MANAGEMENT", "module": "engagements", "actions": ["create", "read", "update", "approve"]},
   {"id": "6", "name": "Gestion des paiements", "code": "PAYMENTS_MANAGEMENT", "module": "payments", "actions": ["create", "read", "update", "approve"]},
   {"id": "11", "name": "Rapports et analyses", "code": "REPORTS_ACCESS", "module": "reports", "actions": ["read", "export"]}
 ]'::jsonb,
 'bg-green-100 text-green-700', true),

(gen_random_uuid(), 'Assistant Administratif', 'ADMIN_ASSISTANT', 'Saisie des données et consultation',
 '[
   {"id": "3", "name": "Suivi budgétaire", "code": "BUDGET_TRACKING", "module": "tracking", "actions": ["read"]},
   {"id": "4", "name": "Gestion des engagements", "code": "ENGAGEMENTS_MANAGEMENT", "module": "engagements", "actions": ["create", "read"]},
   {"id": "11", "name": "Rapports et analyses", "code": "REPORTS_ACCESS", "module": "reports", "actions": ["read", "export"]}
 ]'::jsonb,
 'bg-yellow-100 text-yellow-700', true),

(gen_random_uuid(), 'Consultant', 'CONSULTANT', 'Accès en lecture seule pour consultation',
 '[
   {"id": "3", "name": "Suivi budgétaire", "code": "BUDGET_TRACKING", "module": "tracking", "actions": ["read"]},
   {"id": "11", "name": "Rapports et analyses", "code": "REPORTS_ACCESS", "module": "reports", "actions": ["read"]}
 ]'::jsonb,
 'bg-purple-100 text-purple-700', true),

(gen_random_uuid(), 'Lecture Seule', 'READ_ONLY', 'Accès en lecture seule à toutes les données',
 '[
   {"id": "13", "name": "Lecture seule globale", "code": "READ_ONLY_ACCESS", "module": "all", "actions": ["read"]}
 ]'::jsonb,
 'bg-gray-100 text-gray-700', true)

ON CONFLICT (code) DO NOTHING;