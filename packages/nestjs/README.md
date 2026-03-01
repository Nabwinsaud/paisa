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
# or with npm/pnpm/yarn
npm install @nabwin/paisa-nestjs
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
import { Controller, Post, Get, Body, Query } from "@nestjs/common";
import { EsewaService } from "@nabwin/paisa-nestjs/esewa";
import { KhaltiService } from "@nabwin/paisa-nestjs/khalti";

@Controller("payment")
export class PaymentController {
  constructor(
    private readonly esewa: EsewaService,
    private readonly khalti: KhaltiService,
  ) {}

  @Post("esewa/initiate")
  initiateEsewa(@Body() body: { amount: number; orderId: string }) {
    return this.esewa.initiatePayment({
      amount: body.amount,
      totalAmount: body.amount,
      transactionUUID: body.orderId,
      successUrl: "https://yoursite.com/payment/success",
      failureUrl: "https://yoursite.com/payment/failure",
    });
  }

  @Get("esewa/verify")
  verifyEsewa(@Query("data") data: string) {
    return this.esewa.verifyPayment({ encodedData: data });
  }

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
  verifyKhalti(@Query("pidx") pidx: string) {
    return this.khalti.verifyPayment({ pidx });
  }
}
```

---

## Accessing the Underlying Client

If you need the raw `EsewaClient` or `KhaltiClient` from `@nabwin/paisa`, they are also injectable:

```ts
import { Injectable } from "@nestjs/common";
import { EsewaClient } from "@nabwin/paisa/esewa";

@Injectable()
export class CustomPaymentService {
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
