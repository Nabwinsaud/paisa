# @nabwin/paisa-nestjs

> NestJS adapter for [@nabwin/paisa](../core) -- Nepali payment gateway modules.

This package wraps the framework-agnostic `@nabwin/paisa` SDK in proper NestJS dynamic modules. You get `forRoot()` and `forRootAsync()` patterns, injectable services, and full DI support out of the box.

**You do NOT need to install `@nabwin/paisa` separately** -- it is included as a dependency.

---

## Install

```bash
bun add @nabwin/paisa-nestjs
```

```bash
npm install @nabwin/paisa-nestjs
```

```bash
pnpm add @nabwin/paisa-nestjs
```

```bash
yarn add @nabwin/paisa-nestjs
```

### Peer dependencies

This package requires NestJS 10+ or 11+:

```bash
bun add @nestjs/common @nestjs/core reflect-metadata
```

---

## Subpath Imports

```ts
// Everything
import { EsewaModule, KhaltiModule, EsewaService, KhaltiService } from "@nabwin/paisa-nestjs";

// eSewa only
import { EsewaModule, EsewaService } from "@nabwin/paisa-nestjs/esewa";

// Khalti only
import { KhaltiModule, KhaltiService } from "@nabwin/paisa-nestjs/khalti";
```

---

## Module Setup

### eSewa

#### Static config (`forRoot`)

```ts
import { Module } from "@nestjs/common";
import { EsewaModule } from "@nabwin/paisa-nestjs/esewa";

@Module({
  imports: [
    EsewaModule.forRoot({
      merchantCode: "EPAYTEST",
      secretKey: "8gBm/:&EnhH.1/q",
      environment: "sandbox",
      successUrl: "https://yoursite.com/payment/success",
      failureUrl: "https://yoursite.com/payment/failure",
    }),
  ],
})
export class AppModule {}
```

#### Async config (`forRootAsync`)

Use this when your config comes from `ConfigService` or another async source:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EsewaModule } from "@nabwin/paisa-nestjs/esewa";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EsewaModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        merchantCode: config.getOrThrow("ESEWA_MERCHANT_CODE"),
        secretKey: config.getOrThrow("ESEWA_SECRET_KEY"),
        environment: config.get("NODE_ENV") === "production" ? "production" : "sandbox",
        successUrl: config.getOrThrow("ESEWA_SUCCESS_URL"),
        failureUrl: config.getOrThrow("ESEWA_FAILURE_URL"),
      }),
    }),
  ],
})
export class AppModule {}
```

### Khalti

```ts
import { KhaltiModule } from "@nabwin/paisa-nestjs/khalti";

@Module({
  imports: [
    KhaltiModule.forRoot({
      secretKey: process.env.KHALTI_SECRET_KEY!,
      environment: "sandbox",
    }),
  ],
})
export class AppModule {}
```

---

## Using the Services

Once the module is imported, inject `EsewaService` or `KhaltiService` in any controller or provider:

```ts
import { Controller, Post, Get, Body, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { EsewaService } from "@nabwin/paisa-nestjs/esewa";
import { KhaltiService } from "@nabwin/paisa-nestjs/khalti";

@Controller("payment")
export class PaymentController {
  constructor(
    private readonly esewa: EsewaService,
    private readonly khalti: KhaltiService,
  ) {}

  // ── eSewa ────────────────────────────────────────────────────────

  // Option 1: Server-side initiation (recommended)
  // Returns a paymentUrl — redirect the user there
  @Post("esewa/initiate")
  async initiateEsewa(
    @Body() body: { amount: number; orderId: string },
    @Res() res: Response,
  ) {
    const result = await this.esewa.initiatePayment({
      amount: body.amount,
      transactionId: body.orderId,
    });

    return res.redirect(result.paymentUrl);
  }

  // Option 2: Return form data (for custom frontend forms)
  @Post("esewa/form")
  getEsewaFormData(@Body() body: { amount: number; orderId: string }) {
    return this.esewa.getPaymentFormData({
      amount: body.amount,
      transactionId: body.orderId,
    });
  }

  // Verify eSewa callback
  @Get("esewa/verify")
  async verifyEsewa(@Query("data") data: string) {
    const result = await this.esewa.verifyPayment({ encodedData: data });

    if (result.isComplete) {
      // Payment verified -- fulfill the order
    }

    return result;
  }

  // Server-side status check
  @Get("esewa/status")
  checkEsewaStatus(
    @Query("transactionId") transactionId: string,
    @Query("totalAmount") totalAmount: string,
  ) {
    return this.esewa.checkTransactionStatus({
      transactionId,
      totalAmount: Number(totalAmount),
    });
  }

  // ── Khalti ───────────────────────────────────────────────────────

  @Post("khalti/initiate")
  initiateKhalti(@Body() body: { amount: number; orderId: string }) {
    return this.khalti.initiatePayment({
      returnUrl: "https://yoursite.com/payment/khalti/return",
      websiteUrl: "https://yoursite.com",
      amount: body.amount,
      purchaseOrderId: body.orderId,
      purchaseOrderName: "Order",
    });
  }

  @Get("khalti/verify")
  async verifyKhalti(@Query("pidx") pidx: string) {
    const result = await this.khalti.verifyPayment({ pidx });

    if (result.isComplete) {
      // Payment verified -- fulfill the order
    }

    return result;
  }
}
```

`totalAmount` is always auto-computed from `amount + taxAmount + serviceCharge + deliveryCharge`. No need to pass it.

---

## EsewaService API

| Method | Description |
|--------|-------------|
| `initiatePayment(req)` | POSTs to eSewa server-side, returns `paymentUrl` for redirect |
| `getPaymentFormData(req, options?)` | Returns signed form payload (actionUrl + fields) |
| `verifyPayment(req)` | Decodes + verifies base64 callback token |
| `checkTransactionStatus(req)` | Server-side transaction status check |

## KhaltiService API

| Method | Description |
|--------|-------------|
| `initiatePayment(req)` | Calls Khalti initiate API, returns payment URL |
| `verifyPayment(req)` | Calls Khalti lookup API, returns payment status |

---

## Accessing the Underlying Client

If you need the raw `EsewaClient` or `KhaltiClient` from `@nabwin/paisa`, they are also injectable:

```ts
import { Injectable } from "@nestjs/common";
import { EsewaClient } from "@nabwin/paisa/esewa";

@Injectable()
export class PaymentService {
  constructor(private readonly esewaClient: EsewaClient) {
    // Direct access to the core SDK client
  }
}
```

---

## How It Relates to @nabwin/paisa

```
@nabwin/paisa            <-- Core SDK (framework-agnostic)
  EsewaClient                  Works anywhere: Bun, Node, Express, Fastify, etc.
  KhaltiClient

@nabwin/paisa-nestjs     <-- This package (NestJS wrapper)
  EsewaModule                  Wraps EsewaClient in NestJS DI
  EsewaService                 Injectable service delegating to EsewaClient
  KhaltiModule                 Wraps KhaltiClient in NestJS DI
  KhaltiService                Injectable service delegating to KhaltiClient
```

NestJS users install `@nabwin/paisa-nestjs`. Everyone else installs `@nabwin/paisa` directly.

---

## License

MIT
