export { KhaltiModule, KHALTI_CONFIG } from "./khalti.module.js";
export { KhaltiService } from "./khalti.service.js";

// Re-export core types for convenience
export type {
  KhaltiConfig,
  KhaltiEnvironment,
  KhaltiCustomer,
  KhaltiInitiateRequest,
  KhaltiInitiateResponse,
  KhaltiVerifyRequest,
  KhaltiVerifyResponse,
  KhaltiPaymentStatus,
} from "@nabwin/paisa/khalti";
export { KhaltiClient } from "@nabwin/paisa/khalti";
