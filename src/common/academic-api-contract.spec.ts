import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';
import { UserRole } from './enums.js';
import { ProgramsController } from '../programs/programs.controller.js';
import { SubjectsController } from '../subjects/subjects.controller.js';
import { SemestersController } from '../semesters/semesters.controller.js';
import { ProfessorsController } from '../professors/professors.controller.js';
import { SectionsController } from '../sections/sections.controller.js';
import { EnrollmentsController } from '../enrollments/enrollments.controller.js';

/**
 * Contract checks derived from the controller decorator metadata actually
 * present in the source (no invented routes). These assert the auth/role
 * posture of the academic endpoints without needing an HTTP server or DB.
 * End-to-end behaviour (pagination envelopes, 401s) is verified separately by
 * the DB-backed e2e suite, which is BLOCKED in this environment.
 */
const PATH = 'path';
const METHOD = 'method';

type RouteInfo = {
  handler: string;
  method: RequestMethod;
  fullPath: string;
  roles: UserRole[] | undefined;
  isPublic: boolean;
};

function readRoutes(controller: new (...args: never[]) => unknown): RouteInfo[] {
  const base = Reflect.getMetadata(PATH, controller) ?? '';
  return Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const fn = (controller.prototype as Record<string, unknown>)[name] as
        | ((...a: unknown[]) => unknown)
        | undefined;
      if (typeof fn !== 'function') return null;
      const path = Reflect.getMetadata(PATH, fn);
      const method = Reflect.getMetadata(METHOD, fn);
      if (path === undefined || method === undefined) return null;
      const seg = path === '/' ? '' : String(path);
      return {
        handler: name,
        method: method as RequestMethod,
        fullPath: `/${base}${seg ? `/${seg}` : ''}`,
        roles: Reflect.getMetadata(ROLES_KEY, fn) as UserRole[] | undefined,
        isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, fn) === true,
      };
    })
    .filter((r): r is RouteInfo => r !== null);
}

function find(routes: RouteInfo[], method: RequestMethod, handler: string): RouteInfo {
  const route = routes.find((r) => r.handler === handler);
  expect(route, `handler ${handler} must exist`).toBeDefined();
  expect(route?.method).toBe(method);
  return route as RouteInfo;
}

const ADMIN = [UserRole.ADMIN];
const MANAGERS = [UserRole.ADMIN, UserRole.PROGRAM_MANAGER, UserRole.SUBJECT_MANAGER];

describe('academic API contract (controller metadata)', () => {
  it('mounts each academic controller at its documented base path', () => {
    expect(Reflect.getMetadata(PATH, ProgramsController)).toBe('programs');
    expect(Reflect.getMetadata(PATH, SubjectsController)).toBe('subjects');
    expect(Reflect.getMetadata(PATH, SemestersController)).toBe('semesters');
    expect(Reflect.getMetadata(PATH, ProfessorsController)).toBe('professors');
    expect(Reflect.getMetadata(PATH, SectionsController)).toBe('sections');
    expect(Reflect.getMetadata(PATH, EnrollmentsController)).toBe('enrollments');
  });

  it('exposes exactly one public (unauthenticated) academic route: the registration program list', () => {
    const publicRoutes: string[] = [];
    for (const controller of [
      ProgramsController,
      SubjectsController,
      SemestersController,
      ProfessorsController,
      SectionsController,
      EnrollmentsController,
    ]) {
      for (const route of readRoutes(controller)) {
        if (route.isPublic) {
          publicRoutes.push(`${controller.name}.${route.handler}`);
        }
      }
    }
    expect(publicRoutes).toEqual(['ProgramsController.findForRegistration']);
  });

  it('programs: reads are open to any authenticated user, writes are admin-only', () => {
    const routes = readRoutes(ProgramsController);
    expect(find(routes, RequestMethod.GET, 'findAll').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'findOne').roles).toBeUndefined();
    expect(find(routes, RequestMethod.POST, 'create').roles).toEqual(ADMIN);
    expect(find(routes, RequestMethod.PATCH, 'update').roles).toEqual(ADMIN);
    expect(find(routes, RequestMethod.DELETE, 'remove').roles).toEqual(ADMIN);
  });

  it('subjects: reads open; write routes allow admin + managers (scope enforced in service), delete stays admin-only', () => {
    const routes = readRoutes(SubjectsController);
    expect(find(routes, RequestMethod.GET, 'findAll').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'findOne').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'getPrerequisites').roles).toBeUndefined();
    expect(find(routes, RequestMethod.POST, 'create').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.PATCH, 'update').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.DELETE, 'remove').roles).toEqual(ADMIN);
    expect(find(routes, RequestMethod.PUT, 'setPrerequisites').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.POST, 'addPrerequisite').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.DELETE, 'removePrerequisite').roles).toEqual(MANAGERS);
  });

  it('semesters: writes allow admin + program manager (program scope in service); professors writes stay admin-only', () => {
    const SEMESTER_MANAGERS = [UserRole.ADMIN, UserRole.PROGRAM_MANAGER];
    const semesterRoutes = readRoutes(SemestersController);
    expect(find(semesterRoutes, RequestMethod.GET, 'findAll').roles).toBeUndefined();
    expect(find(semesterRoutes, RequestMethod.GET, 'findOne').roles).toBeUndefined();
    expect(find(semesterRoutes, RequestMethod.POST, 'create').roles).toEqual(SEMESTER_MANAGERS);
    expect(find(semesterRoutes, RequestMethod.PATCH, 'update').roles).toEqual(SEMESTER_MANAGERS);
    expect(find(semesterRoutes, RequestMethod.DELETE, 'remove').roles).toEqual(SEMESTER_MANAGERS);

    const professorRoutes = readRoutes(ProfessorsController);
    expect(find(professorRoutes, RequestMethod.GET, 'findAll').roles).toBeUndefined();
    expect(find(professorRoutes, RequestMethod.GET, 'findOne').roles).toBeUndefined();
    expect(find(professorRoutes, RequestMethod.POST, 'create').roles).toEqual(ADMIN);
    expect(find(professorRoutes, RequestMethod.PATCH, 'update').roles).toEqual(ADMIN);
    expect(find(professorRoutes, RequestMethod.DELETE, 'remove').roles).toEqual(ADMIN);
  });

  it('sections: reads open; section and schedule writes allow admin + managers (scope in service)', () => {
    const routes = readRoutes(SectionsController);
    expect(find(routes, RequestMethod.GET, 'findAll').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'findOne').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'listSchedules').roles).toBeUndefined();
    expect(find(routes, RequestMethod.POST, 'create').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.PATCH, 'update').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.DELETE, 'remove').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.POST, 'addSchedule').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.PATCH, 'updateSchedule').roles).toEqual(MANAGERS);
    expect(find(routes, RequestMethod.DELETE, 'removeSchedule').roles).toEqual(MANAGERS);
  });

  it('enrollments: owner/admin routes are guardless, admin-only routes carry @Roles(ADMIN)', () => {
    const routes = readRoutes(EnrollmentsController);
    // owner-or-admin semantics are enforced in the service, not via @Roles
    expect(find(routes, RequestMethod.POST, 'create').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'findMine').roles).toBeUndefined();
    expect(find(routes, RequestMethod.GET, 'findOne').roles).toBeUndefined();
    expect(find(routes, RequestMethod.PATCH, 'drop').roles).toBeUndefined();
    // admin-only
    expect(find(routes, RequestMethod.GET, 'findAll').roles).toEqual(ADMIN);
    expect(find(routes, RequestMethod.PATCH, 'update').roles).toEqual(ADMIN);
    expect(find(routes, RequestMethod.PATCH, 'recordMarks').roles).toEqual(ADMIN);
    expect(find(routes, RequestMethod.DELETE, 'remove').roles).toEqual(ADMIN);
  });

  it('keeps GET /programs authenticated while the registration list is public', () => {
    const routes = readRoutes(ProgramsController);
    const list = find(routes, RequestMethod.GET, 'findAll');
    expect(list.fullPath).toBe('/programs');
    expect(list.isPublic).toBe(false);
    expect(list.roles).toBeUndefined();

    const registration = find(routes, RequestMethod.GET, 'findForRegistration');
    expect(registration.fullPath).toBe('/programs/registration');
    expect(registration.isPublic).toBe(true);
    expect(registration.roles).toBeUndefined();
  });
});
