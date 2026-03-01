import { describe, it, expect } from "bun:test";
import { KhaltiClient } from "./client.js";
import {
  KhaltiApiError,
  KhaltiConfigError,
  KhaltiValidationError,
} from "./errors.js";

const TEST_CONFIG = {
  secretKey: "test-secret-key-123",
  environment: "sandbox" as const,
  returnUrl: "https://example.com/return",
  websiteUrl: "https://example.com",
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
    get body() {
      return capturedInit?.body
        ? JSON.parse(capturedInit.body as string)
        : undefined;
    },
    get headers() {
      return capturedInit?.headers as Record<string, string> | undefined;
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

describe("KhaltiClient", () => {
  const client = new KhaltiClient(TEST_CONFIG);

  // ── Config validation ──────────────────────────────────────────────

  describe("constructor config validation", () => {
    it("throws KhaltiConfigError when secretKey is empty", () => {
      expect(
        () => new KhaltiClient({ ...TEST_CONFIG, secretKey: "" }),
      ).toThrow(KhaltiConfigError);
    });

    it("throws KhaltiConfigError for invalid environment", () => {
      expect(
        () =>
          new KhaltiClient({
            ...TEST_CONFIG,
            environment: "dev" as any,
          }),
      ).toThrow(KhaltiConfigError);
    });

    it("throws KhaltiConfigError for invalid returnUrl in config", () => {
      expect(
        () =>
          new KhaltiClient({ ...TEST_CONFIG, returnUrl: "not-a-url" }),
      ).toThrow(KhaltiConfigError);
    });

    it("accepts valid config without default URLs", () => {
      expect(
        () =>
          new KhaltiClient({
            secretKey: "key",
            environment: "sandbox",
          }),
      ).not.toThrow();
    });
  });

  // ── initiatePayment ────────────────────────────────────────────────

  describe("initiatePayment", () => {
    it("calls the correct sandbox URL (a.khalti.com)", async () => {
      const spy = mockFetchResponse({
        pidx: "abc123",
        payment_url: "https://pay.khalti.com/abc",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        const res = await client.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test Order",
        });

        expect(spy.url).toContain("a.khalti.com");
        expect(spy.url).not.toContain("dev.khalti.com");
        expect(spy.url).toContain("/epayment/initiate/");
        expect(res.pidx).toBe("abc123");
        expect(res.paymentUrl).toBe("https://pay.khalti.com/abc");
        expect(res.expiresAt).toBe("2025-01-01T00:00:00Z");
        expect(res.expiresIn).toBe(1800);
      } finally {
        spy.restore();
      }
    });

    it("converts NPR amount to paisa (x100)", async () => {
      const spy = mockFetchResponse({
        pidx: "abc123",
        payment_url: "https://pay.khalti.com/abc",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        await client.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test Order",
        });

        // 100 NPR = 10000 paisa
        expect(spy.body.amount).toBe(10000);
      } finally {
        spy.restore();
      }
    });

    it("handles fractional NPR amounts correctly", async () => {
      const spy = mockFetchResponse({
        pidx: "abc",
        payment_url: "https://pay.khalti.com/abc",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        await client.initiatePayment({
          amount: 99.99,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
        });

        expect(spy.body.amount).toBe(9999);
      } finally {
        spy.restore();
      }
    });

    it("calls the correct production URL", async () => {
      const prodClient = new KhaltiClient({
        ...TEST_CONFIG,
        environment: "production",
      });

      const spy = mockFetchResponse({
        pidx: "prod123",
        payment_url: "https://pay.khalti.com/prod",
        expires_at: "2025-06-01T00:00:00Z",
        expires_in: 3600,
      });

      try {
        await prodClient.initiatePayment({
          amount: 50,
          purchaseOrderId: "order-prod",
          purchaseOrderName: "Prod Order",
        });

        expect(spy.url).toContain("khalti.com/api/v2");
        expect(spy.url).not.toContain("a.khalti.com");
      } finally {
        spy.restore();
      }
    });

    it("sends the correct Authorization header", async () => {
      const spy = mockFetchResponse({
        pidx: "x",
        payment_url: "https://pay.khalti.com/x",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        await client.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
        });

        expect(spy.headers?.["Authorization"]).toBe(
          `Key ${TEST_CONFIG.secretKey}`,
        );
      } finally {
        spy.restore();
      }
    });

    it("sends customer info when provided", async () => {
      const spy = mockFetchResponse({
        pidx: "x",
        payment_url: "https://pay.khalti.com/x",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        await client.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
          customer: {
            name: "Ram Bahadur",
            email: "ram@example.com",
            phone: "9801234567",
          },
        });

        expect(spy.body.customer_info).toEqual({
          name: "Ram Bahadur",
          email: "ram@example.com",
          phone: "9801234567",
        });
      } finally {
        spy.restore();
      }
    });

    it("omits customer_info when customer is not provided", async () => {
      const spy = mockFetchResponse({
        pidx: "x",
        payment_url: "https://pay.khalti.com/x",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        await client.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
        });

        expect(spy.body.customer_info).toBeUndefined();
      } finally {
        spy.restore();
      }
    });

    it("uses per-request returnUrl/websiteUrl over config", async () => {
      const spy = mockFetchResponse({
        pidx: "x",
        payment_url: "https://pay.khalti.com/x",
        expires_at: "2025-01-01T00:00:00Z",
        expires_in: 1800,
      });

      try {
        await client.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
          returnUrl: "https://override.com/return",
          websiteUrl: "https://override.com",
        });

        expect(spy.body.return_url).toBe("https://override.com/return");
        expect(spy.body.website_url).toBe("https://override.com");
      } finally {
        spy.restore();
      }
    });

    it("throws KhaltiValidationError when no returnUrl anywhere", () => {
      const noUrlClient = new KhaltiClient({
        secretKey: "key",
        environment: "sandbox",
      });
      expect(
        noUrlClient.initiatePayment({
          amount: 100,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
        }),
      ).rejects.toBeInstanceOf(KhaltiValidationError);
    });

    it("throws KhaltiApiError on non-OK response", async () => {
      const spy = mockFetchText("Bad Request: invalid amount", 400);

      try {
        await expect(
          client.initiatePayment({
            amount: 100,
            purchaseOrderId: "order-bad",
            purchaseOrderName: "Bad Order",
          }),
        ).rejects.toBeInstanceOf(KhaltiApiError);
      } finally {
        spy.restore();
      }
    });

    // ── Input validation ──

    it("throws KhaltiValidationError for negative amount", () => {
      expect(
        client.initiatePayment({
          amount: -10,
          purchaseOrderId: "order-1",
          purchaseOrderName: "Test",
        }),
      ).rejects.toBeInstanceOf(KhaltiValidationError);
    });

    it("throws KhaltiValidationError for empty purchaseOrderId", () => {
      expect(
        client.initiatePayment({
          amount: 100,
          purchaseOrderId: "",
          purchaseOrderName: "Test",
        }),
      ).rejects.toBeInstanceOf(KhaltiValidationError);
    });
  });

  // ── verifyPayment ──────────────────────────────────────────────────

  describe("verifyPayment", () => {
    it("calls the lookup endpoint and maps response fields", async () => {
      const spy = mockFetchResponse({
        pidx: "abc123",
        status: "Completed",
        total_amount: 10000,
        fee: 300,
        refunded: false,
        transaction_id: "txn-456",
        purchase_order_id: "order-1",
      });

      try {
        const result = await client.verifyPayment({ pidx: "abc123" });

        expect(spy.url).toContain("/epayment/lookup/");
        expect(result.pidx).toBe("abc123");
        expect(result.status).toBe("Completed");
        expect(result.isComplete).toBe(true);
        // Paisa to NPR conversion
        expect(result.totalAmount).toBe(100);
        expect(result.fee).toBe(3);
        expect(result.refunded).toBe(false);
        expect(result.transactionId).toBe("txn-456");
        expect(result.purchaseOrderId).toBe("order-1");
        expect(result.raw).toBeDefined();
      } finally {
        spy.restore();
      }
    });

    it("handles 400 gracefully for expired/canceled payments", async () => {
      // Khalti returns 400 with structured data for expired payments
      const spy = mockFetchResponse(
        {
          pidx: "expired-pidx",
          status: "Expired",
          total_amount: 10000,
          fee: 0,
          refunded: false,
          transaction_id: "",
          purchase_order_id: "order-1",
        },
        400,
      );

      try {
        const result = await client.verifyPayment({ pidx: "expired-pidx" });

        // Should NOT throw — returns response with isComplete: false
        expect(result.status).toBe("Expired");
        expect(result.isComplete).toBe(false);
        expect(result.totalAmount).toBe(100);
      } finally {
        spy.restore();
      }
    });

    it("handles 400 gracefully for user-canceled payments", async () => {
      const spy = mockFetchResponse(
        {
          pidx: "canceled-pidx",
          status: "User canceled",
          total_amount: 5000,
          fee: 0,
          refunded: false,
          transaction_id: "",
          purchase_order_id: "order-2",
        },
        400,
      );

      try {
        const result = await client.verifyPayment({ pidx: "canceled-pidx" });

        expect(result.status).toBe("User canceled");
        expect(result.isComplete).toBe(false);
      } finally {
        spy.restore();
      }
    });

    it("throws KhaltiApiError on 400 without status field", async () => {
      const spy = mockFetchResponse(
        { detail: "Something went wrong" },
        400,
      );

      try {
        await expect(
          client.verifyPayment({ pidx: "bad" }),
        ).rejects.toBeInstanceOf(KhaltiApiError);
      } finally {
        spy.restore();
      }
    });

    it("throws KhaltiApiError with gatewayResponse on structured error", async () => {
      const spy = mockFetchResponse(
        { detail: "Invalid pidx", error_key: "invalid_pidx" },
        400,
      );

      try {
        const err: KhaltiApiError = await client
          .verifyPayment({ pidx: "bad" })
          .catch((e) => e);

        expect(err).toBeInstanceOf(KhaltiApiError);
        expect(err.gatewayResponse).toBeDefined();
        expect(err.gatewayResponse?.["detail"]).toBe("Invalid pidx");
      } finally {
        spy.restore();
      }
    });

    it("throws KhaltiApiError on non-400 errors", async () => {
      const spy = mockFetchText("Internal Server Error", 500);

      try {
        await expect(
          client.verifyPayment({ pidx: "invalid" }),
        ).rejects.toBeInstanceOf(KhaltiApiError);
      } finally {
        spy.restore();
      }
    });

    it("throws on empty pidx", async () => {
      await expect(
        client.verifyPayment({ pidx: "" }),
      ).rejects.toThrow();
    });
  });
});
