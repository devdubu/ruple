import { openDatabase } from '@ruple/platform-server';
import { developmentProbe } from './db/schema';
export { developmentProbe } from './db/schema';

// Sample factory; lifecycle and actual business schema remain owned by this service.
export function createDatabase(connectionString: string) {
  return openDatabase(connectionString, { developmentProbe }, 'ruple_context');
}
