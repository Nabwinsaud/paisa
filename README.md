# @nabwin/paisa

> Nepali payment gateways, one SDK.

**Paisa** (पैसा) is the Nepali and South Asian word for **money**. If you have dealt with Nepali payment APIs, you have already seen it -- Khalti sends amounts in *paisa* (1 rupee = 100 paisa), eSewa returns `total_amount` strings you have to parse yourself. This SDK handles all of that so you don't have to.

**@nabwin** is the npm scope under [Nabwinsaud](https://github.com/Nabwinsaud) -- the developer publishing this package. The naming follows the pattern: `@org/thing`. So `@nabwin/paisa` means "nabwin's paisa library" -- a Nepali payment SDK by nabwin.

---

## What is this?

`@nabwin/paisa` is a **framework-agnostic TypeScript SDK** for integrating Nepali payment gateways into any Node.js application. It currently supports:

| Gateway | Status | What it does |
|---------|--------|--------------|
| **eSewa** | Supported | HMAC-SHA256 signed form payloads, server-side initiation, base64 callback verification |
| **Khalti** | Supported | Server-to-server initiation via API, pidx-based lookup verification |

If you use NestJS, install `@nabwin/paisa-nestjs` instead -- it wraps this core SDK in proper NestJS dynamic modules with `forRoot()` / `forRootAsync()` patterns.

### Why not just call the APIs directly?

You can. But you will end up writing the same boilerplate every time:

- Khalti amounts are in **paisa** (NPR * 100). Forget to multiply? Silent bugs.
- eSewa amounts are **strings**. Forget to cast? API rejects silently.
- eSewa initiation returns a **302 redirect**, not JSON. Miss that? You get an HTML page back.
- eSewa callback data is **base64-encoded JSON** with an HMAC signature you must verify. Skip it? You accept tampered payments.
- Khalti sandbox uses `a.khalti.com`, production uses `khalti.com`. Hardcode the wrong one? Payments fail in prod.

This SDK handles all of it. You pass clean TypeScript objects, you get clean TypeScript objects back.

---

## Packages

This is a monorepo. Two packages are published to npm:

| Package | Description |
|---------|-------------|
| [`@nabwin/paisa`](./packages/core) | Core SDK -- works with any framework or no framework |
| [`@nabwin/paisa-nestjs`](./packages/nestjs) | NestJS adapter -- dynamic modules wrapping the core |

### Install

```bash
bun add @nabwin/paisa
```

```bash
npm install @nabwin/paisa
```

```bash
pnpm add @nabwin/paisa
```

```bash
yarn add @nabwin/paisa
```

For NestJS:

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

### Subpath imports

Both packages support tree-shakeable subpath imports:

```ts
// Import everything
import { EsewaClient, KhaltiClient } from "@nabwin/paisa";

// Import only what you need (smaller bundle)
import { EsewaClient } from "@nabwin/paisa/esewa";
import { KhaltiClient } from "@nabwin/paisa/khalti";

// NestJS modules
import { EsewaModule } from "@nabwin/paisa-nestjs/esewa";
import { KhaltiModule } from "@nabwin/paisa-nestjs/khalti";
```

Both ESM (`import`) and CommonJS (`require`) are supported. TypeScript declarations are included.

---

## Quick Start

### eSewa -- Payment initiation

```ts
import { EsewaClient } from "@nabwin/paisa/esewa";

const esewa = new EsewaClient({
  merchantCode: "EPAYTEST",
  secretKey: "8gBm/:&EnhH.1/q",
  environment: "sandbox",
  successUrl: "https://yoursite.com/payment/success",
  failureUrl: "https://yoursite.com/payment/failure",
});

// Option 1: Server-side initiation (recommended)
// POSTs to eSewa and returns a paymentUrl — redirect the user there
const result = await esewa.initiatePayment({
  amount: 100,
  transactionId: "order-abc-123",
});

// result.paymentUrl -> redirect user here

// Option 2: Get form data (build your own HTML form)
const form = esewa.getPaymentFormData({
  amount: 100,
  transactionId: "order-abc-123",
});

// form.actionUrl  -> "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
// form.payload    -> { amount, signature, signed_field_names, ... }

// Verify callback (after eSewa redirects back with ?data=base64token)
const verification = await esewa.verifyPayment({
  encodedData: req.query.data, // base64 string from eSewa redirect
});

if (verification.isComplete) {
  // Payment verified -- fulfill the order
}
```

`totalAmount` is always auto-computed: `amount + taxAmount + serviceCharge + deliveryCharge`.

### Khalti -- API-based payment

```ts
import { KhaltiClient } from "@nabwin/paisa/khalti";

const khalti = new KhaltiClient({
  secretKey: "your_secret_key",
  environment: "sandbox",
});

// 1. Initiate payment (server-to-server)
const payment = await khalti.initiatePayment({
  returnUrl: "https://yoursite.com/payment/khalti/return",
  websiteUrl: "https://yoursite.com",
  amount: 10000, // in paisa (Rs 100 = 10000 paisa)
  purchaseOrderId: "order-abc-123",
  purchaseOrderName: "Premium Plan",
});

// payment.paymentUrl -> redirect user here
// payment.pidx       -> store this for verification

// 2. Verify payment (after user returns with ?pidx=xxx)
const result = await khalti.verifyPayment({
  pidx: req.query.pidx,
});

if (result.isComplete) {
  // Payment verified -- fulfill the order
}
```

### NestJS

```ts
// app.module.ts
import { EsewaModule } from "@nabwin/paisa-nestjs/esewa";
import { KhaltiModule } from "@nabwin/paisa-nestjs/khalti";

@Module({
  imports: [
    EsewaModule.forRoot({
      merchantCode: process.env.ESEWA_MERCHANT_CODE,
      secretKey: process.env.ESEWA_SECRET_KEY,
      environment: "sandbox",
      successUrl: "https://yoursite.com/payment/success",
      failureUrl: "https://yoursite.com/payment/failure",
    }),
    KhaltiModule.forRoot({
      secretKey: process.env.KHALTI_SECRET_KEY,
      environment: "sandbox",
    }),
  ],
})
export class AppModule {}
```

```ts
// payment.controller.ts
import { EsewaService } from "@nabwin/paisa-nestjs/esewa";
import { KhaltiService } from "@nabwin/paisa-nestjs/khalti";

@Controller("payment")
export class PaymentController {
  constructor(
    private readonly esewa: EsewaService,
    private readonly khalti: KhaltiService,
  ) {}

  @Post("esewa")
  async payWithEsewa() {
    return this.esewa.initiatePayment({
      amount: 100,
      transactionId: "order-abc-123",
    });
  }
}
```

---

## Monorepo Structure

```
nabwin-paisa-monorepo/
├── package.json              # Root -- private, Bun workspaces, Turborepo scripts
├── turbo.json                # Build orchestration + caching
├── tsconfig.base.json        # Shared TypeScript config
├── .changeset/               # Changesets versioning config
├── .github/workflows/        # CI (PR checks) + Release (auto-publish)
├── packages/
│   ├── core/                 # @nabwin/paisa
│   │   ├── src/
│   │   │   ├── esewa/        # eSewa client, types, errors
│   │   │   ├── khalti/       # Khalti client, types, errors
│   │   │   ├── shared/       # Common HTTP utilities
│   │   │   └── index.ts      # Barrel export
│   │   ├── package.json      # Published to npm as @nabwin/paisa
│   │   ├── tsup.config.ts    # Bundles CJS + ESM + .d.ts
│   │   └── tsconfig.json
│   └── nestjs/               # @nabwin/paisa-nestjs
│       ├── src/
│       │   ├── esewa/        # EsewaModule, EsewaService
│       │   ├── khalti/       # KhaltiModule, KhaltiService
│       │   └── index.ts      # Barrel export
│       ├── package.json      # Published to npm as @nabwin/paisa-nestjs
│       ├── tsup.config.ts
│       └── tsconfig.json
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- Git

### Setup

```bash
git clone https://github.com/Nabwinsaud/paisa.git
cd paisa
bun install
```

### Commands

| Command | What it does |
|---------|--------------|
| `bun run build` | Build all packages (Turborepo, cached) |
| `bun run dev` | Watch mode for all packages |
| `bun run test` | Run tests in all packages |
| `bun run lint` | Type-check all packages |
| `bun run clean` | Remove all `dist/` folders |

### Adding a new gateway

1. Create `packages/core/src/{gateway}/` with `client.ts`, `types.ts`, `errors.ts`, `index.ts`
2. Export from `packages/core/src/index.ts`
3. Add entry to `packages/core/tsup.config.ts`
4. Add subpath to `packages/core/package.json` exports
5. Optionally create NestJS module in `packages/nestjs/src/{gateway}/`
6. Write tests, create a changeset, push

### Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning:

```bash
# After making changes:
bun changeset              # Select packages, bump type, describe change

# To release (CI does this automatically):
bun changeset version      # Bump versions + generate CHANGELOG.md
bun changeset publish      # Publish to npm
```

---

## Supported Gateways

| Gateway | Initiation | Verification | Refund | Webhook |
|---------|-----------|-------------|--------|---------|
| eSewa | HMAC-signed form POST + server-side initiation | Base64 callback + status API | Manual (dashboard) | -- |
| Khalti | Server-to-server API | pidx lookup API | Manual (dashboard) | -- |
| Fonepay | Planned | Planned | -- | -- |
| ConnectIPS | Planned | Planned | -- | -- |

---

## The Name

**paisa** (पैसा) -- the smallest unit of Nepali currency. 100 paisa = 1 Nepali Rupee.

Every Nepali payment API speaks in paisa. Khalti sends and receives amounts in paisa. eSewa returns amounts as strings you parse into paisa. This SDK is named after the thing every Nepali payment developer already thinks in.

**@nabwin** -- the npm organization scope. [Nabwinsaud](https://github.com/Nabwinsaud) builds and maintains this SDK.

Together: **@nabwin/paisa** -- "nabwin's paisa library". A Nepali payment SDK that speaks your gateway's language.

---

## License

MIT
