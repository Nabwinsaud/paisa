import Link from 'next/link';
import { highlight } from 'fumadocs-core/highlight';

const codeExample = `import { EsewaClient } from '@nabwin/paisa/esewa';

const esewa = new EsewaClient({
  merchantCode: 'EPAYTEST',
  secretKey: '8gBm/:&EnhH.1/q',
  environment: 'sandbox',
  successUrl: 'https://example.com/success',
  failureUrl: 'https://example.com/failure',
});

const { paymentUrl } = await esewa.initiatePayment({
  amount: 100,
  transactionId: 'order-123',
});

// redirect user to paymentUrl`;

const features = [
  {
    title: 'Type-Safe',
    description:
      'Strict TypeScript types for every config, request, and response. Catch errors at compile time, not in production.',
  },
  {
    title: 'Multi-Gateway',
    description:
      'Unified patterns across eSewa, Khalti, and more coming soon. Same mental model, different providers.',
  },
  {
    title: 'NestJS Ready',
    description:
      'First-class NestJS adapter with forRoot / forRootAsync dynamic modules. Inject services, not raw clients.',
  },
  {
    title: 'Zero Dependencies',
    description:
      'Only uses Node.js / Bun built-ins. No axios, no node-fetch, no bloat in your bundle.',
  },
  {
    title: 'Signature Handling',
    description:
      'HMAC-SHA256 signature generation and verification built-in. Detects tampered callbacks automatically.',
  },
  {
    title: 'Server-Side Initiation',
    description:
      'Initiate payments server-side and get a redirect URL. No HTML forms needed, works with any framework.',
  },
];

const gateways = [
  { name: 'eSewa', status: 'available' as const },
  { name: 'Khalti', status: 'available' as const },
  { name: 'ConnectIPS', status: 'coming' as const },
  { name: 'IME Pay', status: 'coming' as const },
  { name: 'Fonepay', status: 'coming' as const },
];

export default async function HomePage() {
  const highlighted = await highlight(codeExample, { lang: 'ts', themes: { light: 'github-light', dark: 'github-dark' } });
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center text-center px-4 pt-20 pb-16 gap-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-fd-border px-4 py-1.5 text-sm text-fd-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          v0.3.0 released
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl">
          Nepali Payments,{' '}
          <span className="bg-gradient-to-r from-fd-primary to-fd-primary/60 bg-clip-text text-transparent">
            Made Simple
          </span>
        </h1>

        <p className="text-lg text-fd-muted-foreground max-w-2xl leading-relaxed">
          A type-safe SDK for integrating Nepali payment gateways into any Node.js or Bun application.
          eSewa and Khalti today, more gateways coming soon.
        </p>

        <div className="flex flex-row gap-3 mt-2">
          <Link
            href="/docs"
            className="px-6 py-2.5 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href="/docs/installation"
            className="px-6 py-2.5 rounded-lg border border-fd-border font-medium text-sm hover:bg-fd-accent transition-colors"
          >
            Installation
          </Link>
        </div>

        {/* Install snippet */}
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card px-5 py-3 font-mono text-sm">
          <span className="text-fd-muted-foreground select-none">$</span>
          <span>bun add @nabwin/paisa</span>
        </div>
      </section>

      {/* Code Preview */}
      <section className="px-4 pb-20 max-w-3xl mx-auto w-full">
        <div className="rounded-xl border border-fd-border bg-fd-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-fd-border">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-fd-muted-foreground ml-2 font-mono">payment.ts</span>
          </div>
          <div className="p-5 text-sm leading-relaxed overflow-x-auto [&_pre]:!bg-transparent [&_code]:!bg-transparent">
            {highlighted}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 pb-20 max-w-5xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-3">Why @nabwin/paisa?</h2>
        <p className="text-fd-muted-foreground text-center mb-10 max-w-xl mx-auto">
          Built for developers who want reliable payment integrations without the boilerplate.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-fd-border bg-fd-card p-6 hover:border-fd-primary/40 transition-colors"
            >
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-fd-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Gateways */}
      <section className="px-4 pb-20 max-w-3xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-3">Supported Gateways</h2>
        <p className="text-fd-muted-foreground text-center mb-10">
          We're building support for every major Nepali payment provider.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gateways.map((gw) => (
            <div
              key={gw.name}
              className="flex items-center justify-between rounded-lg border border-fd-border bg-fd-card px-5 py-4"
            >
              <span className="font-medium">{gw.name}</span>
              {gw.status === 'available' ? (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                  Available
                </span>
              ) : (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-fd-muted/50 text-fd-muted-foreground">
                  Coming Soon
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section className="px-4 pb-20 max-w-3xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-10">Packages</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            href="/docs/installation"
            className="rounded-lg border border-fd-border bg-fd-card p-6 hover:border-fd-primary/40 transition-colors group"
          >
            <h3 className="font-semibold font-mono text-sm mb-2 group-hover:text-fd-primary transition-colors">
              @nabwin/paisa
            </h3>
            <p className="text-sm text-fd-muted-foreground">
              Core SDK with EsewaClient and KhaltiClient. Works with any runtime.
            </p>
          </Link>
          <Link
            href="/docs/nestjs"
            className="rounded-lg border border-fd-border bg-fd-card p-6 hover:border-fd-primary/40 transition-colors group"
          >
            <h3 className="font-semibold font-mono text-sm mb-2 group-hover:text-fd-primary transition-colors">
              @nabwin/paisa-nestjs
            </h3>
            <p className="text-sm text-fd-muted-foreground">
              NestJS adapter with dynamic modules, injectable services, and async config.
            </p>
          </Link>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-4 pb-20 text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to integrate?</h2>
        <p className="text-fd-muted-foreground mb-6">
          Get up and running in under 5 minutes.
        </p>
        <Link
          href="/docs"
          className="px-8 py-3 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Read the Docs
        </Link>
      </section>
    </div>
  );
}
