# @nabwin/paisa

> Framework-agnostic Nepali payment gateway SDK.

**Paisa** (पैसा) means **money** in Nepali. It is also the smallest unit of Nepali currency (100 paisa = 1 NPR). Every Nepali payment API -- eSewa, Khalti, Fonepay -- speaks in paisa. This SDK is named after the unit every Nepali developer already thinks in when integrating payments.

`@nabwin/paisa` is the **core package**. It has zero framework dependencies. Works with Bun, Node.js, Express, Fastify, Hono, or anything that runs JavaScript.

If you use NestJS, install [`@nabwin/paisa-nestjs`](../nestjs) instead -- it wraps this core in NestJS dynamic modules.

---

## Install

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

---

## Subpath Imports

Import only the gateway you need for smaller bundles:

```ts
// Everything
import { EsewaClient, KhaltiClient } from "@nabwin/paisa";

// eSewa only
import { EsewaClient } from "@nabwin/paisa/esewa";
import type { EsewaConfig, EsewaPaymentRequest } from "@nabwin/paisa/esewa";

// Khalti only
import { KhaltiClient } from "@nabwin/paisa/khalti";
import type { KhaltiConfig, KhaltiInitiateRequest } from "@nabwin/paisa/khalti";
```

Both ESM and CommonJS are supported. TypeScript declarations (`.d.ts`) are included.

---

## eSewa

eSewa uses HMAC-SHA256 signatures. Two ways to initiate payment:

- **`initiatePayment()`** -- POSTs to eSewa server-side, returns a `paymentUrl` you redirect the user to. No HTML form needed.
- **`getPaymentFormData()`** -- Returns the signed payload so you can build your own HTML form or handle the POST yourself.

### Setup

```ts
import { EsewaClient } from "@nabwin/paisa/esewa";

const esewa = new EsewaClient({
  merchantCode: "EPAYTEST",          // Your eSewa merchant code
  secretKey: "8gBm/:&EnhH.1/q",     // Your eSewa secret key
  environment: "sandbox",            // "sandbox" or "production"
  successUrl: "https://yoursite.com/payment/success",
  failureUrl: "https://yoursite.com/payment/failure",
});
```

### Initiate Payment (recommended)

Server-side initiation. POSTs to eSewa and returns the redirect URL directly:

```ts
const result = await esewa.initiatePayment({
  amount: 500,                                    // Item price in NPR
  transactionId: "order-abc-123",                 // Your unique order ID
  successUrl: "https://yoursite.com/pay/success",  // Required (or set in config)
  failureUrl: "https://yoursite.com/pay/failure",  // Required (or set in config)
});

// result.paymentUrl -> "https://rc-epay.esewa.com.np/..."
// Redirect the user to result.paymentUrl
```

`totalAmount` is auto-computed: `amount + taxAmount + serviceCharge + deliveryCharge`. No need to pass it.

### Get Form Data (alternative)

If you prefer building your own HTML form:

```ts
const form = esewa.getPaymentFormData({
  amount: 500,
  transactionId: "order-abc-123",
  successUrl: "https://yoursite.com/pay/success",
  failureUrl: "https://yoursite.com/pay/failure",
});

// form.actionUrl  -> "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
// form.payload    -> { amount, signature, signed_field_names, ... }
```

Or get a ready-to-render HTML form:

```ts
const form = esewa.getPaymentFormData(
  { amount: 500, transactionId: "order-abc-123" },
  { html: true },
);

// form.html -> '<form method="POST" action="...">...</form>'
```

### Verify Payment

After eSewa redirects back to your `successUrl`, the URL contains a `?data=` query parameter with base64-encoded payment data:

```ts
const result = await esewa.verifyPayment({
  encodedData: req.query.data,  // The base64 string from eSewa's redirect
});

if (result.isComplete) {
  // Payment verified -- fulfill the order
}

// result.status        -> "COMPLETE"
// result.refId         -> "0EXWOK"
// result.transactionId -> "order-abc-123"
// result.totalAmount   -> 500
```

The SDK automatically:
- Decodes the base64 token
- Verifies the HMAC-SHA256 signature (throws `EsewaSignatureMismatchError` if tampered)
- Returns typed, parsed data

### Check Transaction Status

Server-to-server status check, independent of the callback:

```ts
const status = await esewa.checkTransactionStatus({
  transactionId: "order-abc-123",
  totalAmount: 500,
});

if (status.isComplete) {
  // Payment confirmed server-side
}
```

### Error Handling

```ts
import {
  EsewaSignatureMismatchError,
  EsewaInitiationError,
  EsewaValidationError,
} from "@nabwin/paisa/esewa";

try {
  const result = await esewa.initiatePayment({ ... });
} catch (err) {
  if (err instanceof EsewaValidationError) {
    // Invalid input (missing URL, bad amount, etc.)
  }
  if (err instanceof EsewaInitiationError) {
    // eSewa rejected the request or network error
  }
  if (err instanceof EsewaSignatureMismatchError) {
    // Signature mismatch during verification -- possible tampering
  }
}
```

---

## Khalti

Khalti uses a two-step server-to-server flow:

1. Your server calls Khalti's initiate API -- returns a `paymentUrl`
2. You redirect the user to `paymentUrl` -- they pay on Khalti's page
3. Khalti redirects back to your `returnUrl` with a `pidx` query param
4. Your server calls Khalti's lookup API with `pidx` to verify

### Setup

```ts
import { KhaltiClient } from "@nabwin/paisa/khalti";

const khalti = new KhaltiClient({
  secretKey: "your_secret_key",   // From Khalti dashboard
  environment: "sandbox",         // "sandbox" or "production"
});
```

### Initiate Payment

```ts
const payment = await khalti.initiatePayment({
  returnUrl: "https://yoursite.com/khalti/return",
  websiteUrl: "https://yoursite.com",
  amount: 10000,                  // In PAISA (Rs 100 = 10000 paisa)
  purchaseOrderId: "order-abc-123",
  purchaseOrderName: "Premium Plan",
  customer: {                     // Optional
    name: "Ram Bahadur",
    email: "ram@example.com",
    phone: "9800000000",
  },
});

// payment.paymentUrl -> redirect user here
// payment.pidx       -> store for verification
```

### Verify Payment

After the user pays and returns to your `returnUrl`:

```ts
const result = await khalti.verifyPayment({
  pidx: req.query.pidx,  // From Khalti's redirect
});

if (result.isComplete) {
  // Payment verified -- fulfill the order
}
```

---

## Environments

| Gateway | Sandbox | Production |
|---------|---------|------------|
| eSewa | `rc-epay.esewa.com.np` | `epay.esewa.com.np` |
| Khalti | `a.khalti.com` | `khalti.com` |

Set `environment: "sandbox"` for testing, `environment: "production"` for live.

---

## API Reference

### EsewaClient

| Method | Description |
|--------|-------------|
| `initiatePayment(req)` | POSTs to eSewa, returns `paymentUrl` for redirect |
| `getPaymentFormData(req, options?)` | Generates HMAC-signed form payload for eSewa |
| `verifyPayment(req)` | Decodes + verifies base64 callback token |
| `checkTransactionStatus(req)` | Server-side transaction status check |

### KhaltiClient

| Method | Description |
|--------|-------------|
| `initiatePayment(req)` | Calls Khalti initiate API, returns payment URL |
| `verifyPayment(req)` | Calls Khalti lookup API, returns payment status |

---

## License

MIT
