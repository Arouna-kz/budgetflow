export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          profession: string | null
          employee_id: string | null
          role_id: string
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          email: string
          first_name: string
          last_name: string
          profession?: string | null
          employee_id?: string | null
          role_id: string
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          profession?: string | null
          employee_id?: string | null
          role_id?: string
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          name: string
          code: string
          description: string
          permissions: Json
          color: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description: string
          permissions: Json
          color: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string
          permissions?: Json
          color?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      grants: {
        Row: {
          id: string
          name: string
          reference: string
          granting_organization: string
          year: number
          currency: string
          planned_amount: number
          total_amount: number
          start_date: string
          end_date: string
          status: string
          description: string | null
          bank_account: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          reference: string
          granting_organization: string
          year: number
          currency: string
          planned_amount?: number
          total_amount: number
          start_date: string
          end_date: string
          status: string
          description?: string | null
          bank_account?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          reference?: string
          granting_organization?: string
          year?: number
          currency?: string
          planned_amount?: number
          total_amount?: number
          start_date?: string
          end_date?: string
          status?: string
          description?: string | null
          bank_account?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      budget_lines: {
        Row: {
          id: string
          grant_id: string
          code: string
          name: string
          planned_amount: number
          notified_amount: number
          engaged_amount: number
          available_amount: number
          description: string | null
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          grant_id: string
          code: string
          name: string
          planned_amount: number
          notified_amount: number
          engaged_amount?: number
          available_amount?: number
          description?: string | null
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          grant_id?: string
          code?: string
          name?: string
          planned_amount?: number
          notified_amount?: number
          engaged_amount?: number
          available_amount?: number
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string
        }
      }
      sub_budget_lines: {
        Row: {
          id: string
          grant_id: string
          budget_line_id: string
          code: string
          name: string
          planned_amount: number
          notified_amount: number
          engaged_amount: number
          available_amount: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          grant_id: string
          budget_line_id: string
          code: string
          name: string
          planned_amount: number
          notified_amount: number
          engaged_amount?: number
          available_amount?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          grant_id?: string
          budget_line_id?: string
          code?: string
          name?: string
          planned_amount?: number
          notified_amount?: number
          engaged_amount?: number
          available_amount?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      engagements: {
        Row: {
          id: string
          grant_id: string
          budget_line_id: string
          sub_budget_line_id: string
          engagement_number: string
          amount: number
          description: string
          supplier: string | null
          quote_reference: string | null
          invoice_number: string | null
          date: string
          status: string
          approvals: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          grant_id: string
          budget_line_id: string
          sub_budget_line_id: string
          engagement_number: string
          amount: number
          description: string
          supplier?: string | null
          quote_reference?: string | null
          invoice_number?: string | null
          date: string
          status: string
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          grant_id?: string
          budget_line_id?: string
          sub_budget_line_id?: string
          engagement_number?: string
          amount?: number
          description?: string
          supplier?: string | null
          quote_reference?: string | null
          invoice_number?: string | null
          date?: string
          status?: string
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          payment_number: string
          grant_id: string
          budget_line_id: string
          sub_budget_line_id: string
          engagement_id: string
          amount: number
          date: string
          supplier: string
          description: string
          payment_method: string
          check_number: string | null
          bank_reference: string | null
          invoice_number: string
          invoice_amount: number
          quote_reference: string | null
          delivery_note: string | null
          purchase_order_number: string | null
          service_acceptance: boolean
          control_notes: string | null
          status: string
          cashed_date: string | null
          approvals: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payment_number: string
          grant_id: string
          budget_line_id: string
          sub_budget_line_id: string
          engagement_id: string
          amount: number
          date: string
          supplier: string
          description: string
          payment_method: string
          check_number?: string | null
          bank_reference?: string | null
          invoice_number: string
          invoice_amount: number
          quote_reference?: string | null
          delivery_note?: string | null
          purchase_order_number?: string | null
          service_acceptance?: boolean
          control_notes?: string | null
          status: string
          cashed_date?: string | null
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payment_number?: string
          grant_id?: string
          budget_line_id?: string
          sub_budget_line_id?: string
          engagement_id?: string
          amount?: number
          date?: string
          supplier?: string
          description?: string
          payment_method?: string
          check_number?: string | null
          bank_reference?: string | null
          invoice_number?: string
          invoice_amount?: number
          quote_reference?: string | null
          delivery_note?: string | null
          purchase_order_number?: string | null
          service_acceptance?: boolean
          control_notes?: string | null
          status?: string
          cashed_date?: string | null
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      bank_accounts: {
        Row: {
          id: string
          name: string
          account_number: string
          bank_name: string
          balance: number
          last_update_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          account_number: string
          bank_name: string
          balance?: number
          last_update_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          account_number?: string
          bank_name?: string
          balance?: number
          last_update_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      bank_transactions: {
        Row: {
          id: string
          account_id: string
          date: string
          description: string
          amount: number
          type: string
          reference: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          date: string
          description: string
          amount: number
          type: string
          reference: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          date?: string
          description?: string
          amount?: number
          type?: string
          reference?: string
          created_at?: string
          updated_at?: string
        }
      }
      prefinancings: {
        Row: {
          id: string
          prefinancing_number: string
          grant_id: string
          budget_line_id: string | null
          sub_budget_line_id: string | null
          amount: number
          date: string
          expected_repayment_date: string
          purpose: string
          target_bank_account: string | null
          target_grant: string | null
          expenses: Json
          status: string
          repayments: Json | null
          description: string
          approvals: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          prefinancing_number: string
          grant_id: string
          budget_line_id?: string | null
          sub_budget_line_id?: string | null
          amount: number
          date: string
          expected_repayment_date: string
          purpose: string
          target_bank_account?: string | null
          target_grant?: string | null
          expenses: Json
          status: string
          repayments?: Json | null
          description: string
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prefinancing_number?: string
          grant_id?: string
          budget_line_id?: string | null
          sub_budget_line_id?: string | null
          amount?: number
          date?: string
          expected_repayment_date?: string
          purpose?: string
          target_bank_account?: string | null
          target_grant?: string | null
          expenses?: Json
          status?: string
          repayments?: Json | null
          description?: string
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      employee_loans: {
        Row: {
          id: string
          loan_number: string
          grant_id: string
          budget_line_id: string | null
          sub_budget_line_id: string | null
          employee: Json
          amount: number
          date: string
          expected_repayment_date: string
          description: string
          repayment_schedule: Json
          repayments: Json
          status: string
          approvals: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_number: string
          grant_id: string
          budget_line_id?: string | null
          sub_budget_line_id?: string | null
          employee: Json
          amount: number
          date: string
          expected_repayment_date: string
          description: string
          repayment_schedule: Json
          repayments?: Json
          status: string
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_number?: string
          grant_id?: string
          budget_line_id?: string | null
          sub_budget_line_id?: string | null
          employee?: Json
          amount?: number
          date?: string
          expected_repayment_date?: string
          description?: string
          repayment_schedule?: Json
          repayments?: Json
          status?: string
          approvals?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}