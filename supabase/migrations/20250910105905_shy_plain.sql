/*
  # Fix infinite recursion in user_roles RLS policies

  1. Problem
    - Current RLS policies on user_roles table cause infinite recursion
    - The admin policy tries to check if user has admin role by querying user_roles table
    - This creates a circular dependency when loading user profiles

  2. Solution
    - Drop existing problematic policies
    - Create simpler, non-recursive policies
    - Use direct user ID checks instead of role-based checks where possible
    - Allow authenticated users to read user_roles (needed for role display)
    - Restrict modifications to service role only

  3. Security
    - Enable RLS on user_roles table
    - Allow all authenticated users to read roles (safe for display purposes)
    - Only allow inserts/updates/deletes via service role or specific conditions
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Anyone can read user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON user_roles;

-- Create new non-recursive policies
CREATE POLICY "Authenticated users can read user roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage user roles (for admin operations)
CREATE POLICY "Service role can manage user roles"
  ON user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow the first user to be created (when no users exist)
-- This avoids the chicken-and-egg problem during initial setup
CREATE POLICY "Allow role management during initial setup"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
  );