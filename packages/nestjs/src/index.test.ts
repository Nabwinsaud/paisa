import { describe, it, expect } from "bun:test";
import { EsewaModule, ESEWA_CONFIG } from "./esewa/esewa.module.js";
import { KhaltiModule, KHALTI_CONFIG } from "./khalti/khalti.module.js";

describe("NestJS adapter exports", () => {
  it("exports EsewaModule with forRoot and forRootAsync", () => {
    expect(EsewaModule).toBeDefined();
    expect(typeof EsewaModule.forRoot).toBe("function");
    expect(typeof EsewaModule.forRootAsync).toBe("function");
  });

  it("exports KhaltiModule with forRoot and forRootAsync", () => {
    expect(KhaltiModule).toBeDefined();
    expect(typeof KhaltiModule.forRoot).toBe("function");
    expect(typeof KhaltiModule.forRootAsync).toBe("function");
  });

  it("exports config injection tokens", () => {
    expect(typeof ESEWA_CONFIG).toBe("symbol");
    expect(typeof KHALTI_CONFIG).toBe("symbol");
  });

  it("EsewaModule.forRoot returns a DynamicModule", () => {
    const mod = EsewaModule.forRoot({
      merchantCode: "EPAYTEST",
      secretKey: "8gBm/:&EnhH.1/q",
      environment: "sandbox",
      successUrl: "https://example.com/success",
      failureUrl: "https://example.com/fail",
    });
    expect(mod.module).toBe(EsewaModule);
    expect(mod.providers).toBeDefined();
    expect(mod.exports).toBeDefined();
  });

  it("KhaltiModule.forRoot returns a DynamicModule", () => {
    const mod = KhaltiModule.forRoot({
      secretKey: "test-key",
      environment: "sandbox",
      returnUrl: "https://example.com/return",
      websiteUrl: "https://example.com",
    });
    expect(mod.module).toBe(KhaltiModule);
    expect(mod.providers).toBeDefined();
    expect(mod.exports).toBeDefined();
  });
});
