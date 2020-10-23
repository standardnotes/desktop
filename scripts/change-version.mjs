import { execSync } from 'child_process';

(async () => {
  const version = process.argv[2];
  if (!version) {
    console.error('Must specify a version number.');
    process.exitCode = 1;
    return;
  }
  execSync(`npm version --no-git-tag-version ${version}`);
  process.chdir('app');
  execSync(`npm version --no-git-tag-version ${version}`);
  process.chdir('..');
  execSync(
    'git add ' +
      'package.json ' +
      'package-lock.json ' +
      'app/package.json ' +
      'app/package-lock.json'
  );
  execSync(`git commit -m "chore(version): ${version}"`);
})();
