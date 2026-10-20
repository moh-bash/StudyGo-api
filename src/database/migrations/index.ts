import type { MigrationInterface } from 'typeorm';
import { InitialSchema1791555907470 } from './1791555907470-InitialSchema.js';
import { AddUserProgramId1791777700607 } from './1791777700607-AddUserProgramId.js';
import { AcademicRoles1791798594481 } from './1791798594481-AcademicRoles.js';
import { AddUserPhone1792470000000 } from './1792470000000-AddUserPhone.js';
import { SubjectCodeProgramScope1792500000000 } from './1792500000000-SubjectCodeProgramScope.js';
import { SubjectWeightDefaults1792510000000 } from './1792510000000-SubjectWeightDefaults.js';
import { SubjectTeams1792600000000 } from './1792600000000-SubjectTeams.js';

/**
 * Explicit migration list used by the CLI data source. `migration:generate`
 * writes a new file next to this one; add the exported class here so it is
 * picked up by `migration:run` and `migration:revert`.
 */
export const MIGRATIONS: Array<new () => MigrationInterface> = [
  InitialSchema1791555907470,
  AddUserProgramId1791777700607,
  AcademicRoles1791798594481,
  AddUserPhone1792470000000,
  SubjectCodeProgramScope1792500000000,
  SubjectWeightDefaults1792510000000,
  SubjectTeams1792600000000,
];