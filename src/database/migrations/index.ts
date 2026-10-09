import type { MigrationInterface } from 'typeorm';
import { InitialSchema1791555907470 } from './1791555907470-InitialSchema.js';

/**
 * Explicit migration list used by the CLI data source. `migration:generate`
 * writes a new file next to this one; add the exported class here so it is
 * picked up by `migration:run` and `migration:revert`.
 */
export const MIGRATIONS: Array<new () => MigrationInterface> = [InitialSchema1791555907470];