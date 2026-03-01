import {
  DynamicModule,
  Module,
  type InjectionToken,
  type OptionalFactoryDependency,
} from "@nestjs/common";
import type { EsewaConfig } from "@nabwin/paisa/esewa";
import { EsewaClient } from "@nabwin/paisa/esewa";
import { EsewaService } from "./esewa.service.js";

export const ESEWA_CONFIG = Symbol("ESEWA_CONFIG");

@Module({})
export class EsewaModule {
  /**
   * Register the eSewa module with static configuration.
   *
   * @example
   * ```ts
   * EsewaModule.forRoot({
   *   merchantCode: 'EPAYTEST',
   *   secretKey: '8gBm/:&EnhH.1/q',
   *   environment: 'sandbox',
   * })
   * ```
   */
  static forRoot(config: EsewaConfig): DynamicModule {
    return {
      module: EsewaModule,
      providers: [
        { provide: ESEWA_CONFIG, useValue: config },
        {
          provide: EsewaClient,
          useFactory: (cfg: EsewaConfig) => new EsewaClient(cfg),
          inject: [ESEWA_CONFIG],
        },
        EsewaService,
      ],
      exports: [EsewaService, EsewaClient],
      global: false,
    };
  }

  /**
   * Register the eSewa module with async configuration (e.g. from ConfigService).
   *
   * @example
   * ```ts
   * EsewaModule.forRootAsync({
   *   inject: [ConfigService],
   *   useFactory: (cfg: ConfigService) => ({
   *     merchantCode: cfg.get('ESEWA_MERCHANT_CODE')!,
   *     secretKey: cfg.get('ESEWA_SECRET_KEY')!,
   *     environment: cfg.get('NODE_ENV') === 'production' ? 'production' : 'sandbox',
   *   }),
   * })
   * ```
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => EsewaConfig | Promise<EsewaConfig>;
    inject?: Array<InjectionToken | OptionalFactoryDependency>;
  }): DynamicModule {
    return {
      module: EsewaModule,
      providers: [
        {
          provide: ESEWA_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: EsewaClient,
          useFactory: (cfg: EsewaConfig) => new EsewaClient(cfg),
          inject: [ESEWA_CONFIG],
        },
        EsewaService,
      ],
      exports: [EsewaService, EsewaClient],
    };
  }
}
