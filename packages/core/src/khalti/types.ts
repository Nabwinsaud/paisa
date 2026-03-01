export type KhaltiEnvironment = "sandbox" | "production";

export interface KhaltiConfig {
  /** Khalti secret key (live or test) */
  secretKey: string;
  /** Target environment */
  environment: KhaltiEnvironment;
  /** Default return URL after payment (can be overridden per-request) */
  returnUrl?: string;
  /** Default website URL (can be overridden per-request) */
  websiteUrl?: string;
}

export interface KhaltiCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface KhaltiInitiateRequest {
  /** URL Khalti redirects to after payment (overrides config.returnUrl) */
  returnUrl?: string;
  /** Your website's base URL (overrides config.websiteUrl) */
  websiteUrl?: string;
  /** Amount in NPR (e.g. 100 for Rs 100). SDK converts to paisa internally. */
  amount: number;
  /** Your unique order ID */
  purchaseOrderId: string;
  /** Human-readable order name */
  purchaseOrderName: string;
  /** Optional customer details */
  customer?: KhaltiCustomer;
}

export interface KhaltiInitiateResponse {
  pidx: string;
  paymentUrl: string;
  expiresAt: string;
  /** Seconds until the payment link expires */
  expiresIn: number;
}

export interface KhaltiVerifyRequest {
  pidx: string;
}

export type KhaltiPaymentStatus =
  | "Completed"
  | "Pending"
  | "Initiated"
  | "Refunded"
  | "Expired"
  | "User canceled"
  | "Partially refunded";

export interface KhaltiVerifyResponse {
  pidx: string;
  status: KhaltiPaymentStatus;
  /** Total amount in NPR (converted from paisa) */
  totalAmount: number;
  /** Fee charged by Khalti in NPR (converted from paisa) */
  fee: number;
  /** Whether payment was refunded */
  refunded: boolean;
  /** Whether the payment completed successfully */
  isComplete: boolean;
  transactionId: string;
  purchaseOrderId: string;
  raw: Record<string, unknown>;
}
