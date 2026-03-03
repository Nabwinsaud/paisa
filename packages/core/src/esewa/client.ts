import crypto from "node:crypto";
import type {
  EsewaConfig,
  EsewaPaymentRequest,
  EsewaPaymentOptions,
  EsewaVerifyRequest,
  EsewaVerifyResponse,
  EsewaPaymentFormData,
  EsewaInitiateResponse,
  EsewaStatusCheckRequest,
  EsewaStatusCheckResponse,
  EsewaPaymentStatus,
} from "./types.js";
import {
  EsewaConfigError,
  EsewaSignatureMismatchError,
  EsewaValidationError,
  EsewaInitiationError,
  EsewaStatusCheckError,
} from "./errors.js";
import {
  assertPositiveAmount,
  assertNonNegativeAmount,
  assertNonEmptyString,
  assertValidUrl,
  assertValidEnvironment,
} from "../shared/validation.js";

const BASE_URLS: Record<string, string> = {
  sandbox: "https://rc-epay.esewa.com.np",
  production: "https://epay.esewa.com.np",
};

export class EsewaClient {
  private readonly baseUrl: string;

  constructor(private readonly config: EsewaConfig) {
    this.validateConfig(config);
    this.baseUrl = BASE_URLS[config.environment]!;
  }

  private validateConfig(config: EsewaConfig): void {
    try {
      assertNonEmptyString(config.merchantCode, "merchantCode", "EsewaConfig");
      assertNonEmptyString(config.secretKey, "secretKey", "EsewaConfig");
      assertValidEnvironment(config.environment, "EsewaConfig");
      if (config.successUrl !== undefined) {
        assertValidUrl(config.successUrl, "successUrl", "EsewaConfig");
      }
      if (config.failureUrl !== undefined) {
        assertValidUrl(config.failureUrl, "failureUrl", "EsewaConfig");
      }
    } catch (err) {
      throw new EsewaConfigError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private sign(message: string): string {
    return crypto
      .createHmac("sha256", this.config.secretKey)
      .update(message)
      .digest("base64");
  }

  /**
   * Compute the total amount from a payment request.
   * totalAmount = amount + taxAmount + serviceCharge + deliveryCharge
   */
  private computeTotalAmount(req: EsewaPaymentRequest): number {
    return (
      req.amount +
      (req.taxAmount ?? 0) +
      (req.serviceCharge ?? 0) +
      (req.deliveryCharge ?? 0)
    );
  }

  /**
   * Resolve successUrl and failureUrl from request or config.
   * Throws EsewaValidationError if neither is provided.
   */
  private resolveUrls(req: EsewaPaymentRequest): {
    successUrl: string;
    failureUrl: string;
  } {
    const successUrl = req.successUrl ?? this.config.successUrl;
    const failureUrl = req.failureUrl ?? this.config.failureUrl;

    if (!successUrl) {
      throw new EsewaValidationError(
        "No successUrl provided — set it in config or pass it in the request",
      );
    }
    if (!failureUrl) {
      throw new EsewaValidationError(
        "No failureUrl provided — set it in config or pass it in the request",
      );
    }

    return { successUrl, failureUrl };
  }

  /**
   * Build the signed payload for eSewa's form endpoint.
   */
  private buildPayload(
    req: EsewaPaymentRequest,
    totalAmount: number,
    successUrl: string,
    failureUrl: string,
  ): Record<string, string> {
    const uuid = req.transactionId;
    const product = this.config.merchantCode;
    const msg = `total_amount=${totalAmount},transaction_uuid=${uuid},product_code=${product}`;

    return {
      amount: String(req.amount),
      tax_amount: String(req.taxAmount ?? 0),
      total_amount: String(totalAmount),
      transaction_uuid: uuid,
      product_code: product,
      product_service_charge: String(req.serviceCharge ?? 0),
      product_delivery_charge: String(req.deliveryCharge ?? 0),
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: this.sign(msg),
    };
  }

  /**
   * Generate the form data needed to redirect the user to eSewa's payment page.
   *
   * Returns `{ actionUrl, payload }` — use these to build your own HTML form
   * or POST server-side. Pass `{ html: true }` in options to also get an
   * `html` string containing a ready-to-render form snippet.
   *
   * `totalAmount` is auto-computed as `amount + taxAmount + serviceCharge + deliveryCharge`.
   */
  getPaymentFormData(
    req: EsewaPaymentRequest,
    options?: EsewaPaymentOptions,
  ): EsewaPaymentFormData {
    this.validatePaymentRequest(req);

    const totalAmount = this.computeTotalAmount(req);
    const { successUrl, failureUrl } = this.resolveUrls(req);
    const payload = this.buildPayload(req, totalAmount, successUrl, failureUrl);
    const actionUrl = `${this.baseUrl}/api/epay/main/v2/form`;

    const result: EsewaPaymentFormData = { actionUrl, payload };

    if (options?.html) {
      result.html = this.buildHtmlForm(actionUrl, payload);
    }

    return result;
  }

  /**
   * Initiate a payment by POSTing to eSewa's form endpoint server-side.
   *
   * eSewa responds with a 302 redirect to their payment page. This method
   * captures that redirect URL and returns it as `paymentUrl` so you can
   * redirect the user directly — no HTML form needed.
   *
   * `totalAmount` is auto-computed as `amount + taxAmount + serviceCharge + deliveryCharge`.
   */
  async initiatePayment(
    req: EsewaPaymentRequest,
  ): Promise<EsewaInitiateResponse> {
    this.validatePaymentRequest(req);

    const totalAmount = this.computeTotalAmount(req);
    const { successUrl, failureUrl } = this.resolveUrls(req);
    const payload = this.buildPayload(req, totalAmount, successUrl, failureUrl);

    const actionUrl = `${this.baseUrl}/api/epay/main/v2/form`;
    const formData = new URLSearchParams(payload);

    try {
      const response = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        redirect: "manual",
      });

      // eSewa returns 302 with Location header pointing to the payment page
      const locationUrl = response.headers.get("location");

      if (response.status >= 300 && response.status < 400 && locationUrl) {
        return {
          transactionId: req.transactionId,
          productCode: this.config.merchantCode,
          totalAmount,
          signature: payload.signature!,
          paymentUrl: locationUrl,
        };
      }

      // If eSewa returns 200 with a redirect URL in the response body or
      // the Location header is present on a non-redirect status
      if (locationUrl) {
        return {
          transactionId: req.transactionId,
          productCode: this.config.merchantCode,
          totalAmount,
          signature: payload.signature!,
          paymentUrl: locationUrl,
        };
      }

      // If we got a successful response but no Location header, the URL might
      // be the final URL itself (eSewa rendered the payment page directly)
      if (response.ok) {
        return {
          transactionId: req.transactionId,
          productCode: this.config.merchantCode,
          totalAmount,
          signature: payload.signature!,
          paymentUrl: response.url || actionUrl,
        };
      }

      // Non-redirect, non-OK response — something went wrong
      const body = await response.text();
      throw new EsewaInitiationError(
        `Unexpected response (HTTP ${response.status})`,
        response.status,
        body,
      );
    } catch (err) {
      if (err instanceof EsewaInitiationError) throw err;
      if (err instanceof EsewaValidationError) throw err;

      throw new EsewaInitiationError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Verify a payment callback from eSewa.
   * The `encodedData` is the base64-encoded `data` query parameter from the success redirect.
   * Throws `EsewaSignatureMismatchError` if the signature doesn't match (possible tampering).
   */
  async verifyPayment(req: EsewaVerifyRequest): Promise<EsewaVerifyResponse> {
    assertNonEmptyString(req.encodedData, "encodedData", "verifyPayment");

    const json = JSON.parse(
      Buffer.from(req.encodedData, "base64").toString("utf8"),
    ) as Record<string, string>;

    const fields = json["signed_field_names"]?.split(",") ?? [];

    // eSewa's total_amount can contain commas (e.g. "1,000") — strip them for signature
    const msg = fields
      .map((f) => {
        const val = json[f] ?? "";
        // Strip commas from total_amount for correct signature computation
        return `${f}=${f === "total_amount" ? val.replace(/,/g, "") : val}`;
      })
      .join(",");
    const sig = this.sign(msg);

    if (sig !== json["signature"]) throw new EsewaSignatureMismatchError();

    // Parse total_amount, stripping commas
    const rawTotal = json["total_amount"] ?? "0";
    const totalAmount = Number(rawTotal.replace(/,/g, ""));

    const status = (json["status"] ?? "NOT_FOUND") as EsewaPaymentStatus;

    return {
      status,
      isComplete: status === "COMPLETE",
      refId: json["transaction_code"] ?? "",
      transactionId: json["transaction_uuid"] ?? "",
      totalAmount,
      raw: json,
    };
  }

  /**
   * Check transaction status via eSewa's server-side API.
   * Useful for server-to-server verification independent of the callback token.
   *
   * GET {baseUrl}/api/epay/transaction/status?product_code=X&total_amount=Y&transaction_uuid=Z
   */
  async checkTransactionStatus(
    req: EsewaStatusCheckRequest,
  ): Promise<EsewaStatusCheckResponse> {
    assertNonEmptyString(
      req.transactionId,
      "transactionId",
      "checkTransactionStatus",
    );
    assertPositiveAmount(
      req.totalAmount,
      "totalAmount",
      "checkTransactionStatus",
    );

    const params = new URLSearchParams({
      product_code: this.config.merchantCode,
      total_amount: String(req.totalAmount),
      transaction_uuid: req.transactionId,
    });

    const url = `${this.baseUrl}/api/epay/transaction/status?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new EsewaStatusCheckError(res.status, body);
    }

    const data = (await res.json()) as Record<string, unknown>;

    const status = String(
      data["status"] ?? "NOT_FOUND",
    ) as EsewaPaymentStatus;

    return {
      status,
      isComplete: status === "COMPLETE",
      refId: String(data["ref_id"] ?? data["transaction_code"] ?? ""),
      transactionId: req.transactionId,
      totalAmount: req.totalAmount,
      raw: data,
    };
  }

  private validatePaymentRequest(req: EsewaPaymentRequest): void {
    try {
      assertPositiveAmount(req.amount, "amount", "EsewaPaymentRequest");
      assertNonNegativeAmount(
        req.taxAmount,
        "taxAmount",
        "EsewaPaymentRequest",
      );
      assertNonNegativeAmount(
        req.serviceCharge,
        "serviceCharge",
        "EsewaPaymentRequest",
      );
      assertNonNegativeAmount(
        req.deliveryCharge,
        "deliveryCharge",
        "EsewaPaymentRequest",
      );
      assertNonEmptyString(
        req.transactionId,
        "transactionId",
        "EsewaPaymentRequest",
      );
      if (req.successUrl !== undefined) {
        assertValidUrl(req.successUrl, "successUrl", "EsewaPaymentRequest");
      }
      if (req.failureUrl !== undefined) {
        assertValidUrl(req.failureUrl, "failureUrl", "EsewaPaymentRequest");
      }
    } catch (err) {
      throw new EsewaValidationError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private buildHtmlForm(
    actionUrl: string,
    payload: Record<string, string>,
  ): string {
    const fields = Object.entries(payload)
      .map(
        ([name, value]) =>
          `  <input type="hidden" name="${name}" value="${this.escapeHtml(value)}" />`,
      )
      .join("\n");

    return `<form method="POST" action="${this.escapeHtml(actionUrl)}">\n${fields}\n  <button type="submit">Pay with eSewa</button>\n</form>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
