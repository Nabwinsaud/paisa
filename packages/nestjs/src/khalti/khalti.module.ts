import {
  DynamicModule,
  Module,
  type InjectionToken,
  type OptionalFactoryDependency,
} from "@nestjs/common";
import type { KhaltiConfig } from "@nabwin/paisa/khalti";
import { KhaltiClient } from "@nabwin/paisa/khalti";
import { KhaltiService } from "./khalti.service.js";

export const KHALTI_CONFIG = Symbol("KHALTI_CONFIG");

@Module({})
export class KhaltiModule {
  /**
   * Register the Khalti module with static configuration.
   *
   * @example
   * ```ts
   * KhaltiModule.forRoot({
   *   secretKey: 'live_secret_key_...',
   *   environment: 'production',
   * })
   * ```
   */
  static forRoot(config: KhaltiConfig): DynamicModule {
    return {
      module: KhaltiModule,
      providers: [
        { provide: KHALTI_CONFIG, useValue: config },
        {
          provide: KhaltiClient,
          useFactory: (cfg: KhaltiConfig) => new KhaltiClient(cfg),
          inject: [KHALTI_CONFIG],
        },
        KhaltiService,
      ],
      exports: [KhaltiService, KhaltiClient],
    };
  }

  /**
   * Register the Khalti module with async configuration (e.g. from ConfigService).
   *
   * @example
   * ```ts
   * KhaltiModule.forRootAsync({
   *   inject: [ConfigService],
   *   useFactory: (cfg: ConfigService) => ({
   *     secretKey: cfg.get('KHALTI_SECRET_KEY')!,
   *     environment: cfg.get('NODE_ENV') === 'production' ? 'production' : 'sandbox',
   *   }),
   * })
   * ```
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => KhaltiConfig | Promise<KhaltiConfig>;
    inject?: Array<InjectionToken | OptionalFactoryDependency>;
  }): DynamicModule {
    return {
      module: KhaltiModule,
      providers: [
        {
          provide: KHALTI_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: KhaltiClient,
          useFactory: (cfg: KhaltiConfig) => new KhaltiClient(cfg),
          inject: [KHALTI_CONFIG],
        },
        KhaltiService,
      ],
      exports: [KhaltiService, KhaltiClient],
    };
  }
}
