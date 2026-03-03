import { describe, it, expect } from "bun:test";
import { EsewaClient } from "./client.js";
import {
  EsewaSignatureMismatchError,
  EsewaConfigError,
  EsewaValidationError,
  EsewaInitiationError,
  EsewaStatusCheckError,
} from "./errors.js";

const TEST_CONFIG = {
  merchantCode: "EPAYTEST",
  secretKey: "8gBm/:&EnhH.1/q",
  environment: "sandbox" as const,
  successUrl: "https://example.com/success",
  failureUrl: "https://example.com/fail",
};

function mockFetchResponse(body: unknown, status = 200) {
  const original = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  globalThis.fetch = Object.assign(fn, {
    preconnect: () => {},
  }) as unknown as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
    get url() {
      return capturedUrl;
    },
    get init() {
      return capturedInit;
    },
  };
}

function mockFetchText(text: string, status: number) {
  const original = globalThis.fetch;

  const fn = async () => new Response(text, { status });
  globalThis.fetch = Object.assign(fn, {
    preconnect: () => {},
  }) as unknown as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function mockFetchRedirect(locationUrl: string) {
  const original = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedBody: string | undefined;

  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    if (init?.body) {
      capturedBody = String(init.body);
    }
    return new Response(null, {
      status: 302,
      headers: { Location: locationUrl },
    });
  };
  globalThis.fetch = Object.assign(fn, {
    preconnect: () => {},
  }) as unknown as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
    get url() {
      return capturedUrl;
    },
    get body() {
      return capturedBody;
    },
  };
}

describe("EsewaClient", () => {
  const client = new EsewaClient(TEST_CONFIG);

  // ── Config validation ──────────────────────────────────────────────

  describe("constructor config validation", () => {
    it("throws EsewaConfigError when merchantCode is empty", () => {
      expect(
        () =>
          new EsewaClient({ ...TEST_CONFIG, merchantCode: "" }),
      ).toThrow(EsewaConfigError);
    });

    it("throws EsewaConfigError when secretKey is empty", () => {
      expect(
        () =>
          new EsewaClient({ ...TEST_CONFIG, secretKey: "" }),
      ).toThrow(EsewaConfigError);
    });

    it("throws EsewaConfigError for invalid environment", () => {
      expect(
        () =>
          new EsewaClient({
            ...TEST_CONFIG,
            environment: "staging" as any,
          }),
      ).toThrow(EsewaConfigError);
    });

    it("throws EsewaConfigError for invalid successUrl in config", () => {
      expect(
        () =>
          new EsewaClient({ ...TEST_CONFIG, successUrl: "not-a-url" }),
      ).toThrow(EsewaConfigError);
    });

    it("throws EsewaConfigError for invalid failureUrl in config", () => {
      expect(
        () =>
          new EsewaClient({ ...TEST_CONFIG, failureUrl: "bad" }),
      ).toThrow(EsewaConfigError);
    });

    it("accepts valid config without default URLs", () => {
      expect(
        () =>
          new EsewaClient({
            merchantCode: "TEST",
            secretKey: "key",
            environment: "sandbox",
          }),
      ).not.toThrow();
    });
  });

  // ── getPaymentFormData ─────────────────────────────────────────────

  describe("getPaymentFormData", () => {
    it("generates consistent signatures for the same input", () => {
      const req = {
        amount: 100,
        transactionId: "order-123",
      };
      const a = client.getPaymentFormData(req);
      const b = client.getPaymentFormData(req);
      expect(a.payload.signature).toBe(b.payload.signature);
    });

    it("generates different signatures for different inputs", () => {
      const a = client.getPaymentFormData({
        amount: 100,
        transactionId: "order-1",
      });
      const b = client.getPaymentFormData({
        amount: 100,
        transactionId: "order-2",
      });
      expect(a.payload.signature).not.toBe(b.payload.signature);
    });

    it("returns sandbox action URL in sandbox environment", () => {
      const data = client.getPaymentFormData({
        amount: 100,
        transactionId: "t1",
      });
      expect(data.actionUrl).toContain("rc-epay.esewa.com.np");
    });

    it("returns production action URL in production environment", () => {
      const prodClient = new EsewaClient({
        ...TEST_CONFIG,
        environment: "production",
      });
      const data = prodClient.getPaymentFormData({
        amount: 100,
        transactionId: "t1",
      });
      expect(data.actionUrl).toContain("epay.esewa.com.np");
      expect(data.actionUrl).not.toContain("rc-epay");
    });

    it("includes all required payload fields", () => {
      const data = client.getPaymentFormData({
        amount: 100,
        taxAmount: 10,
        transactionId: "order-42",
      });

      expect(data.payload.amount).toBe("100");
      expect(data.payload.tax_amount).toBe("10");
      expect(data.payload.total_amount).toBe("110");
      expect(data.payload.transaction_uuid).toBe("order-42");
      expect(data.payload.product_code).toBe("EPAYTEST");
      expect(data.payload.product_service_charge).toBe("0");
      expect(data.payload.product_delivery_charge).toBe("0");
      expect(data.payload.success_url).toBe("https://example.com/success");
      expect(data.payload.failure_url).toBe("https://example.com/fail");
      expect(data.payload.signed_field_names).toBe(
        "total_amount,transaction_uuid,product_code",
      );
      expect(data.payload.signature).toBeDefined();
    });

    it("defaults taxAmount, serviceCharge, deliveryCharge to 0", () => {
      const data = client.getPaymentFormData({
        amount: 100,
        transactionId: "t1",
      });
      expect(data.payload.tax_amount).toBe("0");
      expect(data.payload.product_service_charge).toBe("0");
      expect(data.payload.product_delivery_charge).toBe("0");
    });

    it("auto-computes totalAmount from amount + charges", () => {
      const data = client.getPaymentFormData({
        amount: 100,
        taxAmount: 13,
        serviceCharge: 5,
        deliveryCharge: 2,
        transactionId: "t1",
      });
      expect(data.payload.total_amount).toBe("120");
    });

    it("uses per-request successUrl/failureUrl over config", () => {
      const data = client.getPaymentFormData({
        amount: 100,
        transactionId: "t1",
        successUrl: "https://override.com/ok",
        failureUrl: "https://override.com/fail",
      });
      expect(data.payload.success_url).toBe("https://override.com/ok");
      expect(data.payload.failure_url).toBe("https://override.com/fail");
    });

    it("throws EsewaValidationError when no successUrl anywhere", () => {
      const noUrlClient = new EsewaClient({
        merchantCode: "TEST",
        secretKey: "key",
        environment: "sandbox",
      });
      expect(() =>
        noUrlClient.getPaymentFormData({
          amount: 100,
          transactionId: "t1",
        }),
      ).toThrow(EsewaValidationError);
    });

    it("does not include html by default", () => {
      const data = client.getPaymentFormData({
        amount: 100,
        transactionId: "t1",
      });
      expect(data.html).toBeUndefined();
    });

    it("includes html when { html: true } is passed", () => {
      const data = client.getPaymentFormData(
        { amount: 100, transactionId: "t1" },
        { html: true },
      );
      expect(data.html).toBeDefined();
      expect(data.html).toContain("<form");
      expect(data.html).toContain("method=\"POST\"");
      expect(data.html).toContain("Pay with eSewa");
    });

    // ── Input validation ──

    it("throws EsewaValidationError for negative amount", () => {
      expect(() =>
        client.getPaymentFormData({
          amount: -10,
          transactionId: "t1",
        }),
      ).toThrow(EsewaValidationError);
    });

    it("throws EsewaValidationError for zero amount", () => {
      expect(() =>
        client.getPaymentFormData({
          amount: 0,
          transactionId: "t1",
        }),
      ).toThrow(EsewaValidationError);
    });

    it("throws EsewaValidationError for empty transactionId", () => {
      expect(() =>
        client.getPaymentFormData({
          amount: 100,
          transactionId: "",
        }),
      ).toThrow(EsewaValidationError);
    });

    it("throws EsewaValidationError for invalid per-request URL", () => {
      expect(() =>
        client.getPaymentFormData({
          amount: 100,
          transactionId: "t1",
          successUrl: "not-valid",
        }),
      ).toThrow(EsewaValidationError);
    });
  });

  // ── initiatePayment ────────────────────────────────────────────────

  describe("initiatePayment", () => {
    it("POSTs form data to eSewa and returns paymentUrl from 302 redirect", async () => {
      const spy = mockFetchRedirect(
        "https://rc-epay.esewa.com.np/payment?ref=abc123",
      );

      try {
        const result = await client.initiatePayment({
          amount: 100,
          transactionId: "order-init-1",
        });

        expect(spy.url).toContain(
          "rc-epay.esewa.com.np/api/epay/main/v2/form",
        );
        expect(result.paymentUrl).toBe(
          "https://rc-epay.esewa.com.np/payment?ref=abc123",
        );
        expect(result.transactionId).toBe("order-init-1");
        expect(result.productCode).toBe("EPAYTEST");
        expect(result.totalAmount).toBe(100);
        expect(result.signature).toBeDefined();
      } finally {
        spy.restore();
      }
    });

    it("auto-computes totalAmount including charges", async () => {
      const spy = mockFetchRedirect(
        "https://rc-epay.esewa.com.np/payment?ref=abc",
      );

      try {
        const result = await client.initiatePayment({
          amount: 100,
          taxAmount: 13,
          serviceCharge: 5,
          deliveryCharge: 2,
          transactionId: "order-charges",
        });

        expect(result.totalAmount).toBe(120);
      } finally {
        spy.restore();
      }
    });

    it("sends form-urlencoded body with correct payload fields", async () => {
      const spy = mockFetchRedirect("https://rc-epay.esewa.com.np/pay");

      try {
        await client.initiatePayment({
          amount: 500,
          transactionId: "order-form",
        });

        expect(spy.body).toBeDefined();
        const params = new URLSearchParams(spy.body!);
        expect(params.get("amount")).toBe("500");
        expect(params.get("total_amount")).toBe("500");
        expect(params.get("transaction_uuid")).toBe("order-form");
        expect(params.get("product_code")).toBe("EPAYTEST");
        expect(params.get("success_url")).toBe("https://example.com/success");
        expect(params.get("failure_url")).toBe("https://example.com/fail");
        expect(params.get("signature")).toBeDefined();
      } finally {
        spy.restore();
      }
    });

    it("throws EsewaInitiationError on non-redirect non-OK response", async () => {
      const spy = mockFetchText("Bad Request", 400);

      try {
        await expect(
          client.initiatePayment({
            amount: 100,
            transactionId: "order-fail",
          }),
        ).rejects.toBeInstanceOf(EsewaInitiationError);
      } finally {
        spy.restore();
      }
    });

    it("throws EsewaValidationError when no successUrl anywhere", async () => {
      const noUrlClient = new EsewaClient({
        merchantCode: "TEST",
        secretKey: "key",
        environment: "sandbox",
      });

      await expect(
        noUrlClient.initiatePayment({
          amount: 100,
          transactionId: "t1",
        }),
      ).rejects.toBeInstanceOf(EsewaValidationError);
    });

    it("uses per-request URLs over config URLs", async () => {
      const spy = mockFetchRedirect("https://rc-epay.esewa.com.np/pay");

      try {
        await client.initiatePayment({
          amount: 100,
          transactionId: "order-url-override",
          successUrl: "https://custom.com/ok",
          failureUrl: "https://custom.com/fail",
        });

        const params = new URLSearchParams(spy.body!);
        expect(params.get("success_url")).toBe("https://custom.com/ok");
        expect(params.get("failure_url")).toBe("https://custom.com/fail");
      } finally {
        spy.restore();
      }
    });

    it("throws EsewaValidationError for zero amount", async () => {
      await expect(
        client.initiatePayment({
          amount: 0,
          transactionId: "t1",
        }),
      ).rejects.toBeInstanceOf(EsewaValidationError);
    });

    it("throws EsewaValidationError for empty transactionId", async () => {
      await expect(
        client.initiatePayment({
          amount: 100,
          transactionId: "",
        }),
      ).rejects.toBeInstanceOf(EsewaValidationError);
    });
  });

  // ── verifyPayment ──────────────────────────────────────────────────

  describe("verifyPayment", () => {
    function makeSignedCallback(
      overrides: Record<string, string> = {},
    ): string {
      const crypto = require("node:crypto");
      const fields: Record<string, string> = {
        transaction_code: "0EXWOK",
        status: "COMPLETE",
        total_amount: "100",
        transaction_uuid: "order-verify",
        product_code: "EPAYTEST",
        signed_field_names:
          "total_amount,transaction_uuid,product_code",
        ...overrides,
      };

      const msg = "total_amount=" +
        fields["total_amount"]!.replace(/,/g, "") +
        ",transaction_uuid=" +
        fields["transaction_uuid"] +
        ",product_code=" +
        fields["product_code"];

      fields["signature"] = crypto
        .createHmac("sha256", TEST_CONFIG.secretKey)
        .update(msg)
        .digest("base64");

      return Buffer.from(JSON.stringify(fields)).toString("base64");
    }

    it("successfully verifies a correctly signed response", async () => {
      const encoded = makeSignedCallback();
      const result = await client.verifyPayment({ encodedData: encoded });

      expect(result.status).toBe("COMPLETE");
      expect(result.isComplete).toBe(true);
      expect(result.refId).toBe("0EXWOK");
      expect(result.transactionId).toBe("order-verify");
      expect(result.totalAmount).toBe(100);
      expect(result.raw).toBeDefined();
    });

    it("throws EsewaSignatureMismatchError on tampered data", async () => {
      const tampered = Buffer.from(
        JSON.stringify({
          transaction_code: "0EXWOK",
          status: "COMPLETE",
          total_amount: "100",
          transaction_uuid: "order-123",
          product_code: "EPAYTEST",
          signed_field_names:
            "total_amount,transaction_uuid,product_code",
          signature: "BAD_SIG",
        }),
      ).toString("base64");

      expect(
        client.verifyPayment({ encodedData: tampered }),
      ).rejects.toBeInstanceOf(EsewaSignatureMismatchError);
    });

    it("strips commas from total_amount for signature verification", async () => {
      const encoded = makeSignedCallback({ total_amount: "1,000" });
      const result = await client.verifyPayment({ encodedData: encoded });

      expect(result.totalAmount).toBe(1000);
      expect(result.isComplete).toBe(true);
    });

    it("returns isComplete=false for non-COMPLETE status", async () => {
      const encoded = makeSignedCallback({ status: "CANCELED" });
      const result = await client.verifyPayment({ encodedData: encoded });

      expect(result.status).toBe("CANCELED");
      expect(result.isComplete).toBe(false);
    });

    it("throws on empty encodedData", async () => {
      expect(
        client.verifyPayment({ encodedData: "" }),
      ).rejects.toThrow();
    });
  });

  // ── checkTransactionStatus ─────────────────────────────────────────

  describe("checkTransactionStatus", () => {
    it("calls the correct status endpoint with query params", async () => {
      const spy = mockFetchResponse({
        status: "COMPLETE",
        ref_id: "REF123",
      });

      try {
        const result = await client.checkTransactionStatus({
          transactionId: "order-1",
          totalAmount: 100,
        });

        expect(spy.url).toContain(
          "rc-epay.esewa.com.np/api/epay/transaction/status",
        );
        expect(spy.url).toContain("product_code=EPAYTEST");
        expect(spy.url).toContain("total_amount=100");
        expect(spy.url).toContain("transaction_uuid=order-1");
        expect(result.status).toBe("COMPLETE");
        expect(result.isComplete).toBe(true);
        expect(result.refId).toBe("REF123");
        expect(result.transactionId).toBe("order-1");
      } finally {
        spy.restore();
      }
    });

    it("throws EsewaStatusCheckError on non-OK response", async () => {
      const spy = mockFetchText("Not Found", 404);

      try {
        await expect(
          client.checkTransactionStatus({
            transactionId: "order-bad",
            totalAmount: 100,
          }),
        ).rejects.toBeInstanceOf(EsewaStatusCheckError);
      } finally {
        spy.restore();
      }
    });

    it("throws on empty transactionId", async () => {
      await expect(
        client.checkTransactionStatus({
          transactionId: "",
          totalAmount: 100,
        }),
      ).rejects.toThrow();
    });

    it("throws on invalid totalAmount", async () => {
      await expect(
        client.checkTransactionStatus({
          transactionId: "t1",
          totalAmount: -50,
        }),
      ).rejects.toThrow();
    });
  });
});
