/** Thrown when eSewa config is invalid (missing required fields, bad environment, etc.) */
export class EsewaConfigError extends Error {
  constructor(message: string) {
    super(`eSewa config error: ${message}`);
    this.name = "EsewaConfigError";
  }
}

/** Thrown when eSewa callback signature doesn't match (possible tampering) */
export class EsewaSignatureMismatchError extends Error {
  constructor() {
    super("eSewa: signature mismatch — possible payment tampering");
    this.name = "EsewaSignatureMismatchError";
  }
}

/** Thrown when eSewa payment verification fails */
export class EsewaVerificationError extends Error {
  constructor(message: string) {
    super(`eSewa verification failed: ${message}`);
    this.name = "EsewaVerificationError";
  }
}

/** Thrown when eSewa transaction status check API fails */
export class EsewaStatusCheckError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`eSewa status check failed (HTTP ${statusCode}): ${responseBody}`);
    this.name = "EsewaStatusCheckError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/** Thrown when input validation fails for eSewa payment requests */
export class EsewaValidationError extends Error {
  constructor(message: string) {
    super(`eSewa validation error: ${message}`);
    this.name = "EsewaValidationError";
  }
}
