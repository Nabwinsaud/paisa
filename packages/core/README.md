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
# or with npm/pnpm/yarn
npm install @nabwin/paisa
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

eSewa uses HMAC-SHA256 signatures. The flow:

1. Your server generates a signed form payload
2. You POST it to eSewa (HTML form or server-side fetch)
3. eSewa redirects the user back to your `successUrl` with a base64-encoded token
4. Your server decodes the token, verifies the signature, and confirms the payment

### Setup

```ts
import { EsewaClient } from "@nabwin/paisa/esewa";

const esewa = new EsewaClient({
  merchantCode: "EPAYTEST",          // Your eSewa merchant code
  secretKey: "8gBm/:&EnhH.1/q",     // Your eSewa secret key
  environment: "sandbox",            // "sandbox" or "production"
});
```

### Initiate Payment

```ts
const form = esewa.getPaymentFormData({
  amount: 500,                                    // Item price in NPR
  totalAmount: 500,                               // Total including tax
  transactionUUID: "order-abc-123",                // Your unique order ID
  successUrl: "https://yoursite.com/pay/success",  // eSewa redirects here on success
  failureUrl: "https://yoursite.com/pay/failure",  // eSewa redirects here on failure
});

// Returns:
// {
//   actionUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
//   payload: {
//     amount: "500",
//     total_amount: "500",
//     transaction_uuid: "order-abc-123",
//     product_code: "EPAYTEST",
//     signature: "base64-hmac-sha256...",
//     signed_field_names: "total_amount,transaction_uuid,product_code",
//     success_url: "...",
//     failure_url: "...",
//     ...
//   }
// }
```

Render this as an HTML form or POST it server-side. eSewa will redirect the user to their payment page.

### Verify Payment

After eSewa redirects back to your `successUrl`, the URL contains a `?data=` query parameter with base64-encoded payment data:

```ts
const result = await esewa.verifyPayment({
  encodedData: req.query.data,  // The base64 string from eSewa's redirect
});

// Returns:
// {
//   status: "COMPLETE",            // Payment status
//   refId: "0EXWOK",               // eSewa's reference ID
//   transactionUUID: "order-abc-123",
//   totalAmount: 500,
//   raw: { ... }                   // Full decoded response
// }

if (result.status === "COMPLETE") {
  // Payment verified -- fulfill the order
}
```

The SDK automatically:
- Decodes the base64 token
- Verifies the HMAC-SHA256 signature (throws `EsewaSignatureMismatchError` if tampered)
- Returns typed, parsed data

### Error Handling

```ts
import { EsewaSignatureMismatchError } from "@nabwin/paisa/esewa";

try {
  const result = await esewa.verifyPayment({ encodedData: data });
} catch (err) {
  if (err instanceof EsewaSignatureMismatchError) {
    // Signature mismatch -- possible tampering. Do NOT fulfill the order.
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

// Returns:
// {
//   pidx: "bZQLD9wRVWo4CdESSfDEMo",
//   paymentUrl: "https://pay.khalti.com/?pidx=bZQLD9wRVWo4CdESSfDEMo",
//   expiresAt: "2025-01-01T00:00:00Z"
// }

// Redirect user to payment.paymentUrl
```

### Verify Payment

After the user pays and returns to your `returnUrl`:

```ts
const result = await khalti.verifyPayment({
  pidx: req.query.pidx,  // From Khalti's redirect
});

// Returns:
// {
//   pidx: "bZQLD9wRVWo4CdESSfDEMo",
//   status: "Completed",
//   totalAmount: 10000,          // In paisa
//   transactionId: "abcdef123",  // Khalti's transaction ID
//   purchaseOrderId: "order-abc-123",
//   raw: { ... }
// }

if (result.status === "Completed") {
  // Payment verified -- fulfill the order
}
```

---

## Environments

| Gateway | Sandbox | Production |
|---------|---------|------------|
| eSewa | `rc-epay.esewa.com.np` | `epay.esewa.com.np` |
| Khalti | `dev.khalti.com` | `khalti.com` |

Set `environment: "sandbox"` for testing, `environment: "production"` for live.

---

## API Reference

### EsewaClient

| Method | Description |
|--------|-------------|
| `getPaymentFormData(req)` | Generates HMAC-signed form payload for eSewa |
| `verifyPayment(req)` | Decodes + verifies base64 callback token |

### KhaltiClient

| Method | Description |
|--------|-------------|
| `initiatePayment(req)` | Calls Khalti initiate API, returns payment URL |
| `verifyPayment(req)` | Calls Khalti lookup API, returns payment status |

---

## License

MIT
