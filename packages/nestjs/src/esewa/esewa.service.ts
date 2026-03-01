import { Injectable } from "@nestjs/common";
import {
  EsewaClient,
  type EsewaPaymentRequest,
  type EsewaPaymentOptions,
  type EsewaVerifyRequest,
  type EsewaStatusCheckRequest,
} from "@nabwin/paisa/esewa";

@Injectable()
export class EsewaService {
  constructor(private readonly client: EsewaClient) {}

  /**
   * Generate the eSewa payment form data (action URL + hidden fields).
   * Use the returned `actionUrl` and `payload` to build a form that POSTs to eSewa.
   * Pass `{ html: true }` in options to also get a ready-to-render HTML form snippet.
   */
  initiatePayment(req: EsewaPaymentRequest, options?: EsewaPaymentOptions) {
    return this.client.getPaymentFormData(req, options);
  }

  /**
   * Verify the payment callback from eSewa.
   * Pass the base64-encoded `data` query parameter from the success redirect.
   */
  async verifyPayment(req: EsewaVerifyRequest) {
    return this.client.verifyPayment(req);
  }

  /**
   * Check transaction status via eSewa's server-side API.
   * Useful for server-to-server verification independent of the callback token.
   */
  async checkTransactionStatus(req: EsewaStatusCheckRequest) {
    return this.client.checkTransactionStatus(req);
  }
}
