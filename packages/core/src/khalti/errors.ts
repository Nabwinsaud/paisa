/** Thrown when Khalti config is invalid (missing required fields, bad environment, etc.) */
export class KhaltiConfigError extends Error {
  constructor(message: string) {
    super(`Khalti config error: ${message}`);
    this.name = "KhaltiConfigError";
  }
}

/**
 * Thrown on Khalti API errors.
 * For HTTP 400 responses (e.g. expired/canceled payments), `gatewayResponse` contains
 * the structured JSON error data from Khalti instead of just raw text.
 */
export class KhaltiApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;
  /** Structured error data from Khalti (parsed JSON), if available */
  public readonly gatewayResponse: Record<string, unknown> | null;

  constructor(
    statusCode: number,
    responseBody: string,
    gatewayResponse?: Record<string, unknown>,
  ) {
    super(`Khalti API error ${statusCode}: ${responseBody}`);
    this.name = "KhaltiApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.gatewayResponse = gatewayResponse ?? null;
  }
}

/** Thrown when input validation fails for Khalti payment requests */
export class KhaltiValidationError extends Error {
  constructor(message: string) {
    super(`Khalti validation error: ${message}`);
    this.name = "KhaltiValidationError";
  }
}
