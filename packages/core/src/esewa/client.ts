import crypto from "node:crypto";
import type {
  EsewaConfig,
  EsewaPaymentRequest,
  EsewaPaymentOptions,
  EsewaVerifyRequest,
  EsewaVerifyResponse,
  EsewaPaymentFormData,
  EsewaStatusCheckRequest,
  EsewaStatusCheckResponse,
  EsewaPaymentStatus,
} from "./types.js";
import {
  EsewaConfigError,
  EsewaSignatureMismatchError,
  EsewaValidationError,
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
   * Generate the form data needed to redirect the user to eSewa's payment page.
   *
   * By default returns `{ actionUrl, payload }`. Pass `{ html: true }` in options
   * to also get an `html` string containing a ready-to-render form snippet.
   */
  getPaymentFormData(
    req: EsewaPaymentRequest,
    options?: EsewaPaymentOptions,
  ): EsewaPaymentFormData {
    this.validatePaymentRequest(req);

    const taxAmount = req.taxAmount ?? 0;
    const serviceCharge = req.serviceCharge ?? 0;
    const deliveryCharge = req.deliveryCharge ?? 0;
    const totalAmount =
      req.totalAmount ?? req.amount + taxAmount + serviceCharge + deliveryCharge;

    const successUrl = req.successUrl ?? this.config.successUrl;
    const failureUrl = req.failureUrl ?? this.config.failureUrl;

    if (!successUrl) {
      throw new EsewaValidationError(
        'No successUrl provided — set it in config or pass it in the request',
      );
    }
    if (!failureUrl) {
      throw new EsewaValidationError(
        'No failureUrl provided — set it in config or pass it in the request',
      );
    }

    const uuid = req.transactionId;
    const product = this.config.merchantCode;
    const msg = `total_amount=${totalAmount},transaction_uuid=${uuid},product_code=${product}`;

    const payload: Record<string, string> = {
      amount: String(req.amount),
      tax_amount: String(taxAmount),
      total_amount: String(totalAmount),
      transaction_uuid: uuid,
      product_code: product,
      product_service_charge: String(serviceCharge),
      product_delivery_charge: String(deliveryCharge),
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: this.sign(msg),
    };

    const actionUrl = `${this.baseUrl}/api/epay/main/v2/form`;

    const result: EsewaPaymentFormData = { actionUrl, payload };

    if (options?.html) {
      result.html = this.buildHtmlForm(actionUrl, payload);
    }

    return result;
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

    const status = (String(data["status"] ?? "NOT_FOUND")) as EsewaPaymentStatus;

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
      assertNonNegativeAmount(req.taxAmount, "taxAmount", "EsewaPaymentRequest");
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
      if (req.totalAmount !== undefined) {
        assertPositiveAmount(
          req.totalAmount,
          "totalAmount",
          "EsewaPaymentRequest",
        );
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
