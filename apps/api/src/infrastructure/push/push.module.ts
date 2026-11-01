import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { ExpoPushProvider } from './expo-push.provider';
import { DisabledPushProvider, PushNotificationProvider } from './push-notification.provider';

/** Chooses the push adapter from `PUSH_PROVIDER` (ADR-0028). */
@Global()
@Module({
  providers: [
    {
      provide: PushNotificationProvider,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): PushNotificationProvider =>
        config.push.provider === 'expo'
          ? new ExpoPushProvider(config.push.expoAccessToken)
          : new DisabledPushProvider(),
    },
  ],
  exports: [PushNotificationProvider],
})
export class PushModule {}
