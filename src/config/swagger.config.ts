import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts the OpenAPI document at `/api/docs` (UI) and `/api/docs/json` (raw JSON).
 * Bearer auth is registered as the `access-token` scheme so the Swagger UI
 * "Authorize" button can send a JWT to protected endpoints.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('StudyGO API')
    .setDescription(
      'REST API for StudyGO, a university companion app for Syrian Virtual University (SVU) students. ' +
        'Manages academic programs, semesters, subjects, professors, sections, enrollments and grades, ' +
        'study teams, personal tasks, academic events, and notifications.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the access token returned by POST /api/v1/auth/login',
      },
      'access-token',
    )
    .addTag('auth', 'Registration, login, token refresh, password reset')
    .addTag('users', 'User profiles and administration')
    .addTag('programs', 'Academic programs')
    .addTag('semesters', 'Academic semesters')
    .addTag('subjects', 'Subjects and prerequisites')
    .addTag('professors', 'Professors')
    .addTag('sections', 'Academic sections and schedules')
    .addTag('enrollments', 'Student enrollments, marks and GPA')
    .addTag('teams', 'Study teams, memberships and join requests')
    .addTag('tasks', 'Personal tasks and calendar')
    .addTag('events', 'Shared academic events')
    .addTag('notifications', 'Personal notifications')
    .addTag('health', 'Service health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs/json',
    swaggerOptions: { persistAuthorization: true },
  });
}
