import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger';
import { API_PREFIX } from './config/api-prefix';
import { APP_CONFIG, type AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger(process.env.NODE_ENV !== 'production');
  const app = await NestFactory.create(AppModule, { logger });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: config.adminWebOrigin, credentials: true });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('ENNEL API').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);
  logger.log(`API listening on port ${config.port}`, 'Bootstrap');
}

void bootstrap();
