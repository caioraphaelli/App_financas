export type TransactionType = "receita" | "despesa";
export type ExpenseKind = "variavel" | "fixa" | "parcelada_cartao" | "parcelada_boleto";
export type PaymentMethod = "cartao" | "boleto";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  total_amount: number;
  installments_total: number;
  payment_method: PaymentMethod;
  first_due_date: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  category_id: string | null;
  subcategory_id: string | null;
  expense_kind: ExpenseKind | null;
  purchase_id: string | null;
  installment_number: number | null;
  installments_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithRelations extends Transaction {
  category: Category | null;
  subcategory: Subcategory | null;
}
