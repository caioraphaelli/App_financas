export type TransactionType = "receita" | "despesa";
export type ExpenseKind = "variavel" | "fixa" | "parcelada_cartao" | "parcelada_boleto";
export type PurchasePaymentType = "cartao" | "boleto";
export type PaymentMethodKind = "dinheiro" | "pix" | "boleto" | "cartao" | "outro";
export type RecurringPeriodType = "meses" | "indeterminado";
export type ForecastStatus = "pendente" | "convertida" | "nao_realizada";
export type PrazoClassificacao = "curto" | "longo";

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface Subcategory {
  id: string;
  user_id: string | null;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  name: string;
  kind: PaymentMethodKind;
  card_brand: string | null;
  card_last_digits: string | null;
  closing_day: number | null;
  due_day: number | null;
  credit_limit: number | null;
  color: string;
  is_active: boolean;
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
  starting_installment: number;
  payment_method: PurchasePaymentType;
  payment_method_id: string | null;
  first_due_date: string;
  created_at: string;
}

export interface RecurringSeries {
  id: string;
  user_id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  payment_method_id: string | null;
  start_date: string;
  period_type: RecurringPeriodType;
  months_count: number | null;
  data_fim_contrato: string | null;
  created_at: string;
}

export interface Forecast {
  id: string;
  user_id: string;
  group_id: string | null;
  type: TransactionType;
  description: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  payment_method_id: string | null;
  data_prevista: string;
  meses_repeticao: number | null;
  status: ForecastStatus;
  transaction_id: string | null;
  purchase_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastWithRelations extends Forecast {
  category: Category | null;
  subcategory: Subcategory | null;
  payment_method: PaymentMethod | null;
}

export interface UserSettings {
  user_id: string;
  limite_curto_prazo_meses: number;
  limite_longo_prazo_meses: number;
  created_at: string;
  updated_at: string;
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
  payment_method_id: string | null;
  recurring_series_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithRelations extends Transaction {
  category: Category | null;
  subcategory: Subcategory | null;
  payment_method: PaymentMethod | null;
}
