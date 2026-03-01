import type {
  KhaltiConfig,
  KhaltiInitiateRequest,
  KhaltiInitiateResponse,
  KhaltiVerifyRequest,
  KhaltiVerifyResponse,
  KhaltiPaymentStatus,
} from "./types.js";
import {
  KhaltiConfigError,
  KhaltiApiError,
  KhaltiValidationError,
} from "./errors.js";
import {
  assertPositiveAmount,
  assertNonEmptyString,
  assertValidUrl,
  assertValidEnvironment,
} from "../shared/validation.js";

const API_URLS: Record<string, string> = {
  sandbox: "https://a.khalti.com/api/v2",
  production: "https://khalti.com/api/v2",
};

export class KhaltiClient {
  private readonly apiUrl: string;

  constructor(private readonly config: KhaltiConfig) {
    this.validateConfig(config);
    this.apiUrl = API_URLS[config.environment]!;
  }

  private validateConfig(config: KhaltiConfig): void {
    try {
      assertNonEmptyString(config.secretKey, "secretKey", "KhaltiConfig");
      assertValidEnvironment(config.environment, "KhaltiConfig");
      if (config.returnUrl !== undefined) {
        assertValidUrl(config.returnUrl, "returnUrl", "KhaltiConfig");
      }
      if (config.websiteUrl !== undefined) {
        assertValidUrl(config.websiteUrl, "websiteUrl", "KhaltiConfig");
      }
    } catch (err) {
      throw new KhaltiConfigError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${this.config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let gatewayResponse: Record<string, unknown> | undefined;
      try {
        gatewayResponse = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // Not JSON — leave gatewayResponse undefined
      }
      throw new KhaltiApiError(res.status, text, gatewayResponse);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Initiate a Khalti payment.
   * Amount is in NPR — the SDK converts to paisa (x100) before sending to Khalti.
   * Returns a `paymentUrl` to redirect the user to Khalti's payment page.
   */
  async initiatePayment(
    req: KhaltiInitiateRequest,
  ): Promise<KhaltiInitiateResponse> {
    this.validateInitiateRequest(req);

    const returnUrl = req.returnUrl ?? this.config.returnUrl;
    const websiteUrl = req.websiteUrl ?? this.config.websiteUrl;

    if (!returnUrl) {
      throw new KhaltiValidationError(
        "No returnUrl provided — set it in config or pass it in the request",
      );
    }
    if (!websiteUrl) {
      throw new KhaltiValidationError(
        "No websiteUrl provided — set it in config or pass it in the request",
      );
    }

    // Convert NPR to paisa
    const amountInPaisa = Math.round(req.amount * 100);

    const data = await this.post<{
      pidx: string;
      payment_url: string;
      expires_at: string;
      expires_in: number;
    }>("/epayment/initiate/", {
      return_url: returnUrl,
      website_url: websiteUrl,
      amount: amountInPaisa,
      purchase_order_id: req.purchaseOrderId,
      purchase_order_name: req.purchaseOrderName,
      customer_info: req.customer
        ? {
            name: req.customer.name,
            email: req.customer.email,
            phone: req.customer.phone,
          }
        : undefined,
    });

    return {
      pidx: data.pidx,
      paymentUrl: data.payment_url,
      expiresAt: data.expires_at,
      expiresIn: data.expires_in ?? 0,
    };
  }

  /**
   * Verify a Khalti payment using the `pidx` from the return URL.
   *
   * Khalti returns HTTP 400 with structured JSON for expired/canceled payments
   * instead of a generic error. This method handles that gracefully — returning
   * a response with `isComplete: false` instead of throwing.
   */
  async verifyPayment(
    req: KhaltiVerifyRequest,
  ): Promise<KhaltiVerifyResponse> {
    assertNonEmptyString(req.pidx, "pidx", "verifyPayment");

    const res = await fetch(`${this.apiUrl}/epayment/lookup/`, {
      method: "POST",
      headers: {
        Authorization: `Key ${this.config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pidx: req.pidx }),
    });

    const text = await res.text();
    let data: Record<string, unknown>;

    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON response — throw as API error
      throw new KhaltiApiError(res.status, text);
    }

    // Khalti returns 400 for expired/canceled payments with structured data
    // containing status info. Handle gracefully instead of throwing.
    if (!res.ok) {
      // If the 400 response contains a status field, treat it as a verify response
      if (res.status === 400 && data["status"]) {
        return this.mapVerifyResponse(data);
      }
      // For other error codes, throw
      throw new KhaltiApiError(res.status, text, data);
    }

    return this.mapVerifyResponse(data);
  }

  private mapVerifyResponse(data: Record<string, unknown>): KhaltiVerifyResponse {
    const status = String(data["status"] ?? "") as KhaltiPaymentStatus;
    const totalAmountPaisa = Number(data["total_amount"] ?? 0);
    const feePaisa = Number(data["fee"] ?? 0);

    return {
      pidx: String(data["pidx"] ?? ""),
      status,
      // Convert paisa back to NPR
      totalAmount: totalAmountPaisa / 100,
      fee: feePaisa / 100,
      refunded: Boolean(data["refunded"] ?? false),
      isComplete: status === "Completed",
      transactionId: String(data["transaction_id"] ?? ""),
      purchaseOrderId: String(data["purchase_order_id"] ?? ""),
      raw: data,
    };
  }

  private validateInitiateRequest(req: KhaltiInitiateRequest): void {
    try {
      assertPositiveAmount(req.amount, "amount", "KhaltiInitiateRequest");
      assertNonEmptyString(
        req.purchaseOrderId,
        "purchaseOrderId",
        "KhaltiInitiateRequest",
      );
      assertNonEmptyString(
        req.purchaseOrderName,
        "purchaseOrderName",
        "KhaltiInitiateRequest",
      );
      if (req.returnUrl !== undefined) {
        assertValidUrl(req.returnUrl, "returnUrl", "KhaltiInitiateRequest");
      }
      if (req.websiteUrl !== undefined) {
        assertValidUrl(req.websiteUrl, "websiteUrl", "KhaltiInitiateRequest");
      }
    } catch (err) {
      throw new KhaltiValidationError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
