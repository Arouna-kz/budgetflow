/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current policies on users table are causing infinite recursion
    - Policies are checking admin roles by querying the same users table
    - This creates a circular dependency

  2. Solution
    - Drop all existing problematic policies
    - Create simplified policies that don't cause recursion
    - Use auth.uid() directly instead of complex role checks
    - Allow service role to manage all operations

  3. Security
    - Users can read and update their own profile
    - Service role can manage all users (for admin operations)
    - No circular dependencies
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Anyone can insert first user" ON users;
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "Users can read their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow user creation during signup"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);