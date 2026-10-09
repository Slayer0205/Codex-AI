export type Page =
  | "dashboard"
  | "debts"
  | "customers"
  | "sales"
  | "products"
  | "reports"
  | "settings";
export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  telegramId?: string;
  createdAt: string;
};
export type Product = {
  id: string;
  name: string;
  category: string;
  sku: string;
  cost: number;
  price: number;
  stock: number;
  lowStock: number;
  image: string;
  createdAt: string;
};
export type Debt = {
  id: string;
  customerId: string;
  amount: number;
  dueDate: string;
  notes: string;
  createdAt: string;
  saleId?: string;
  reversedAt?: string;
};
export type Repayment = {
  id: string;
  debtId: string;
  amount: number;
  method: string;
  kind: string;
  createdAt: string;
};
export type Sale = {
  id: string;
  customerId?: string;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  method: string;
  status: string;
  createdAt: string;
  reversedAt?: string;
};
export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
};
export type Settings = {
  storeName: string;
  language: "uz" | "ru" | "en";
  theme: "light" | "dark" | "system";
  notifications: boolean;
  debtDays: number;
  telegramId: string;
};
export type Snapshot = {
  customers: Customer[];
  products: Product[];
  debts: Debt[];
  debt_repayments: Repayment[];
  sales: Sale[];
  sale_items: SaleItem[];
  payments: {
    id: string;
    saleId: string;
    amount: number;
    method: string;
    kind: string;
    createdAt: string;
  }[];
  expenses: {
    id: string;
    name: string;
    category: string;
    amount: number;
    createdAt: string;
  }[];
  inventory_movements: {
    id: string;
    productId: string;
    saleId?: string;
    quantity: number;
    reason: string;
    createdAt: string;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    read: boolean;
    status: string;
    createdAt: string;
  }[];
  audit_logs: {
    id: string;
    action: string;
    entityId: string;
    details: string;
    createdAt: string;
  }[];
  settings: Settings;
  role: string;
  organizationId: string;
};
export type Session = {
  name: string;
  email: string;
  role: string;
  demo: boolean;
};
export type DialogState = {
  kind:
    | "customer"
    | "product"
    | "debt"
    | "repay"
    | "expense"
    | "stock"
    | "editDebt"
    | "editCustomer"
    | "editProduct";
  id?: string;
  customerId?: string;
};
