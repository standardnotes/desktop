import { spawn } from 'child_process';

function runCommand(fullCommand, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    console.log(fullCommand);
    const [command, ...args] = fullCommand.split(' ');
    // const cmdEnv = (typeof extraEnv === 'object') ? Object.assign( {}, process.env, extraEnv ) : process.env;
    const options = { env: Object.assign({}, process.env, extraEnv) };
    const child = spawn(command, args, options);
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code > 0) {
        reject(code);
      } else {
        resolve(code);
      }
    });
  });
}

const arm64Env = { npm_config_target_arch: 'arm64' };

(async () => {
  try {
    await runCommand('npm --prefix ./web rebuild', arm64Env);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();
