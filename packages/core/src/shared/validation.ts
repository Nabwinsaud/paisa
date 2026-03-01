/**
 * Asserts that a required config field is present and non-empty.
 * Throws a descriptive error if missing.
 */
export function assertRequired(
  value: unknown,
  fieldName: string,
  context: string,
): asserts value {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${context}: missing required field "${fieldName}"`);
  }
}

/**
 * Asserts that an amount is a positive number.
 */
export function assertPositiveAmount(
  amount: number,
  fieldName: string,
  context: string,
): void {
  if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
    throw new Error(
      `${context}: "${fieldName}" must be a positive finite number, got ${amount}`,
    );
  }
}

/**
 * Asserts that an optional amount, if provided, is non-negative.
 */
export function assertNonNegativeAmount(
  amount: number | undefined,
  fieldName: string,
  context: string,
): void {
  if (amount === undefined) return;
  if (typeof amount !== "number" || amount < 0 || !Number.isFinite(amount)) {
    throw new Error(
      `${context}: "${fieldName}" must be a non-negative finite number, got ${amount}`,
    );
  }
}

/**
 * Validates that a string is a well-formed URL (http or https).
 * Returns true if valid, false otherwise.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Asserts that a string is a valid HTTP(S) URL.
 */
export function assertValidUrl(
  url: string,
  fieldName: string,
  context: string,
): void {
  if (!isValidUrl(url)) {
    throw new Error(
      `${context}: "${fieldName}" must be a valid HTTP(S) URL, got "${url}"`,
    );
  }
}

/**
 * Asserts that a string is non-empty after trimming.
 */
export function assertNonEmptyString(
  value: string,
  fieldName: string,
  context: string,
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `${context}: "${fieldName}" must be a non-empty string`,
    );
  }
}

/** Valid environment values for payment gateways */
export type PaymentEnvironment = "sandbox" | "production";

const VALID_ENVIRONMENTS: ReadonlySet<string> = new Set<PaymentEnvironment>([
  "sandbox",
  "production",
]);

/**
 * Asserts that an environment value is "sandbox" or "production".
 * Accepts the union type at compile time; also validates at runtime for JS consumers.
 */
export function assertValidEnvironment(
  env: PaymentEnvironment,
  context: string,
): void {
  if (!VALID_ENVIRONMENTS.has(env)) {
    throw new Error(
      `${context}: "environment" must be "sandbox" or "production", got "${env}"`,
    );
  }
}
