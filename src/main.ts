import 'dotenv/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule, appInstrument } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { setupSwagger } from './config/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    appInstrument ? { instrument: appInstrument } : {},
  );
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // CSP is disabled so the Swagger UI can render; Helmet still sets the other
  // security headers on all API responses.
  app.use(helmet({ contentSecurityPolicy: false }));

  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(config.get<string>('nodeEnv') === 'production'));

  setupSwagger(app);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}
await bootstrap();
