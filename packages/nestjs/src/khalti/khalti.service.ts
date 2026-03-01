import { Injectable } from "@nestjs/common";
import {
  KhaltiClient,
  type KhaltiInitiateRequest,
  type KhaltiVerifyRequest,
} from "@nabwin/paisa/khalti";

@Injectable()
export class KhaltiService {
  constructor(private readonly client: KhaltiClient) {}

  /**
   * Initiate a Khalti payment.
   * Returns a `paymentUrl` — redirect the user there.
   */
  async initiatePayment(req: KhaltiInitiateRequest) {
    return this.client.initiatePayment(req);
  }

  /**
   * Verify a Khalti payment using the `pidx` from the return URL query params.
   */
  async verifyPayment(req: KhaltiVerifyRequest) {
    return this.client.verifyPayment(req);
  }
}
