import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import { CatalogController } from './catalog.controller.js';

const PATH = 'path';
const METHOD = 'method';

/**
 * Contract checks derived from the controller decorator metadata actually
 * present in the source. The catalog endpoint is authenticated-but-role-free:
 * its scope comes from the caller's own `programId`, so any signed-in user
 * (student or manager) may read their own catalog and no `@Roles` gate applies.
 */
describe('catalog API contract (controller metadata)', () => {
  it('mounts the catalog controller at /catalog', () => {
    expect(Reflect.getMetadata(PATH, CatalogController)).toBe('catalog');
  });

  it('exposes GET /catalog as authenticated (not public) with no role restriction', () => {
    const fn = CatalogController.prototype.getCatalog;
    expect(Reflect.getMetadata(METHOD, fn)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH, fn)).toBe('/');
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, fn)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, fn)).toBeUndefined();
  });
});
