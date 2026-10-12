import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { UsersController } from './users.controller.js';

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

describe('users academic-assignments API contract (controller metadata)', () => {
  it('protects every assignment route with @Roles(ADMIN)', () => {
    const routes = readRoutes(UsersController);

    const get = find(routes, RequestMethod.GET, 'getAcademicAssignments');
    expect(get.fullPath).toBe('/users/:id/academic-assignments');
    expect(get.roles).toEqual(ADMIN);
    expect(get.isPublic).toBe(false);

    const assign = find(routes, RequestMethod.PUT, 'assignProgramManager');
    expect(assign.fullPath).toBe('/users/:id/academic-assignments/program-manager');
    expect(assign.roles).toEqual(ADMIN);

    const removePm = find(routes, RequestMethod.DELETE, 'removeProgramManager');
    expect(removePm.fullPath).toBe('/users/:id/academic-assignments/program-manager');
    expect(removePm.roles).toEqual(ADMIN);

    const setSm = find(routes, RequestMethod.PUT, 'setSubjectManagers');
    expect(setSm.fullPath).toBe('/users/:id/academic-assignments/subject-manager');
    expect(setSm.roles).toEqual(ADMIN);

    const removeSm = find(routes, RequestMethod.DELETE, 'removeSubjectManager');
    expect(removeSm.fullPath).toBe('/users/:id/academic-assignments/subject-manager/:subjectId');
    expect(removeSm.roles).toEqual(ADMIN);
  });

  it('keeps every assignment route non-public', () => {
    for (const route of readRoutes(UsersController)) {
      if (route.handler.includes('academic') || ['removeProgramManager'].includes(route.handler)) {
        expect(route.isPublic, `${route.handler} must not be public`).toBe(false);
      }
    }
  });

  it('keeps self-service routes open to any authenticated user (no @Roles)', () => {
    const routes = readRoutes(UsersController);
    expect(find(routes, RequestMethod.GET, 'findMe').roles).toBeUndefined();
    expect(find(routes, RequestMethod.PATCH, 'updateMe').roles).toBeUndefined();
    expect(find(routes, RequestMethod.PATCH, 'changePassword').roles).toBeUndefined();
  });
});