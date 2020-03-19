/**
 * TODO(baptiste): precompute these booleans at compile-time
 * (requires one webpack build per platform)
 */

export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';
