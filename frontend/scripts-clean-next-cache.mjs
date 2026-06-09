import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const nextCachePath = resolve(process.cwd(), '.next');

await rm(nextCachePath, { force: true, recursive: true });
console.log(`Removed ${nextCachePath}`);
