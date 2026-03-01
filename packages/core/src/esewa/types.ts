export type EsewaEnvironment = "sandbox" | "production";

export interface EsewaConfig {
  /** eSewa merchant/product code (e.g. "EPAYTEST" for sandbox) */
  merchantCode: string;
  /** HMAC secret key for signature generation */
  secretKey: string;
  /** Target environment */
  environment: EsewaEnvironment;
  /** Default success redirect URL (can be overridden per-request) */
  successUrl?: string;
  /** Default failure redirect URL (can be overridden per-request) */
  failureUrl?: string;
}

export interface EsewaPaymentRequest {
  /** Item price (without tax or charges) */
  amount: number;
  /** Tax amount — defaults to 0 */
  taxAmount?: number;
  /** Service charge — defaults to 0 */
  serviceCharge?: number;
  /** Delivery charge — defaults to 0 */
  deliveryCharge?: number;
  /**
   * Total amount. If omitted, auto-computed as:
   * amount + (taxAmount ?? 0) + (serviceCharge ?? 0) + (deliveryCharge ?? 0)
   */
  totalAmount?: number;
  /** Your unique order/transaction ID */
  transactionId: string;
  /** URL eSewa redirects to on successful payment (overrides config.successUrl) */
  successUrl?: string;
  /** URL eSewa redirects to on failed/cancelled payment (overrides config.failureUrl) */
  failureUrl?: string;
}

/** Options for getPaymentFormData */
export interface EsewaPaymentOptions {
  /** If true, include an HTML form snippet in the response */
  html?: boolean;
}

export interface EsewaPaymentFormData {
  /** The eSewa endpoint to POST the form to */
  actionUrl: string;
  /** Key-value pairs to include as hidden form fields */
  payload: Record<string, string>;
  /** HTML form snippet (only present when { html: true } is passed) */
  html?: string;
}

export interface EsewaVerifyRequest {
  /** Base64-encoded string from eSewa redirect query param `data` */
  encodedData: string;
}

export type EsewaPaymentStatus =
  | "COMPLETE"
  | "PENDING"
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "AMBIGUOUS"
  | "NOT_FOUND"
  | "CANCELED";

export interface EsewaVerifyResponse {
  status: EsewaPaymentStatus;
  /** Whether the payment completed successfully */
  isComplete: boolean;
  refId: string;
  transactionId: string;
  totalAmount: number;
  raw: Record<string, unknown>;
}

/** Request for checking transaction status via eSewa's server-side API */
export interface EsewaStatusCheckRequest {
  /** Your unique order/transaction ID */
  transactionId: string;
  /** Total amount of the transaction */
  totalAmount: number;
}

/** Response from eSewa's transaction status check API */
export interface EsewaStatusCheckResponse {
  status: EsewaPaymentStatus;
  /** Whether the payment completed successfully */
  isComplete: boolean;
  /** eSewa's reference/transaction code */
  refId: string;
  transactionId: string;
  totalAmount: number;
  raw: Record<string, unknown>;
}
