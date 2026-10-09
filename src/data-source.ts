import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './config/typeorm.config.js';

/**
 * Data source used exclusively by the TypeORM CLI (migrations). Run through
 * `tsx` via the npm `typeorm` script.
 */
export default new DataSource(buildDataSourceOptions());
