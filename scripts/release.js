#!/usr/bin/env node

/**
 * Release script for candles-from-image package
 * Handles version bumping, tagging, tarball generation, and publishing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ReleaseManager {
  constructor() {
    this.packageJsonPath = path.join(__dirname, '..', 'package.json');
    this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    this.currentVersion = this.packageJson.version;
    this.packageName = this.packageJson.name;
  }

  /**
   * Main release function
   */
  async release(options = {}) {
    const {
      type = 'patch', // patch, minor, major
      dryRun = false,
      skipTests = false,
      skipBuild = false,
      skipTag = false,
      skipTarball = false,
      skipPublish = false,
      preRelease = false,
      preReleaseId = 'alpha'
    } = options;

    console.log(`🚀 Starting release process for ${this.packageName}`);
    console.log(`📦 Current version: ${this.currentVersion}`);
    console.log(`🔧 Release type: ${type}`);
    console.log(`🧪 Dry run: ${dryRun}`);
    console.log('=' * 50);

    try {
      // Step 1: Validate environment
      await this.validateEnvironment();

      // Step 2: Run tests (unless skipped)
      if (!skipTests) {
        await this.runTests();
      }

      // Step 3: Build project (unless skipped)
      if (!skipBuild) {
        await this.buildProject();
      }

      // Step 4: Bump version
      const newVersion = await this.bumpVersion(type, preRelease, preReleaseId);
      console.log(`📈 Version bumped to: ${newVersion}`);

      // Step 5: Update changelog
      await this.updateChangelog(newVersion, type);

      // Step 6: Commit changes
      if (!dryRun) {
        await this.commitChanges(newVersion);
      }

      // Step 7: Create git tag (unless skipped)
      if (!skipTag && !dryRun) {
        await this.createTag(newVersion);
      }

      // Step 8: Generate tarball (unless skipped)
      if (!skipTarball) {
        await this.generateTarball(newVersion, dryRun);
      }

      // Step 9: Publish to npm (unless skipped)
      if (!skipPublish && !dryRun) {
        await this.publishPackage(newVersion);
      }

      console.log('✅ Release completed successfully!');
      console.log(`🎉 New version: ${newVersion}`);

      if (dryRun) {
        console.log('🔍 This was a dry run - no changes were committed or published');
      }

    } catch (error) {
      console.error('❌ Release failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate release environment
   */
  async validateEnvironment() {
    console.log('🔍 Validating release environment...');

    // Check if we're in a git repository
    try {
      execSync('git status', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Not in a git repository');
    }

    // Check if working directory is clean
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim() && !status.includes('package.json') && !status.includes('CHANGELOG.md')) {
      throw new Error('Working directory is not clean. Please commit or stash changes.');
    }

    // Check if we're on main branch
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (branch !== 'main' && branch !== 'master') {
      console.warn(`⚠️  Warning: Not on main branch (currently on ${branch})`);
    }

    // Check if npm is logged in (for publishing)
    try {
      execSync('npm whoami', { stdio: 'pipe' });
    } catch (error) {
      console.warn('⚠️  Warning: Not logged in to npm. Publishing will fail.');
    }

    console.log('✅ Environment validation passed');
  }

  /**
   * Run tests
   */
  async runTests() {
    console.log('🧪 Running tests...');
    try {
      execSync('npm test', { stdio: 'inherit' });
      console.log('✅ Tests passed');
    } catch (error) {
      throw new Error('Tests failed. Please fix tests before releasing.');
    }
  }

  /**
   * Build project
   */
  async buildProject() {
    console.log('🔨 Building project...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      execSync('npm run build:frontend', { stdio: 'inherit' });
      console.log('✅ Build completed');
    } catch (error) {
      throw new Error('Build failed. Please fix build issues before releasing.');
    }
  }

  /**
   * Bump version in package.json
   */
  async bumpVersion(type, preRelease = false, preReleaseId = 'alpha') {
    console.log(`📈 Bumping version (${type})...`);

    const versionParts = this.currentVersion.split('.').map(Number);
    let [major, minor, patch] = versionParts;

    switch (type) {
      case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor += 1;
        patch = 0;
        break;
      case 'patch':
        patch += 1;
        break;
      default:
        throw new Error(`Invalid version type: ${type}`);
    }

    let newVersion = `${major}.${minor}.${patch}`;

    if (preRelease) {
      newVersion += `-${preReleaseId}.1`;
    }

    // Update package.json
    this.packageJson.version = newVersion;
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(this.packageJson, null, 2) + '\n');

    return newVersion;
  }

  /**
   * Update changelog
   */
  async updateChangelog(newVersion, type) {
    console.log('📝 Updating changelog...');

    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    const today = new Date().toISOString().split('T')[0];

    const changelogEntry = `## [${newVersion}] - ${today}

### ${type.charAt(0).toUpperCase() + type.slice(1)}
- Automated release ${type} version bump

`;

    let changelog = '';
    if (fs.existsSync(changelogPath)) {
      changelog = fs.readFileSync(changelogPath, 'utf8');
    } else {
      changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
    }

    // Insert new entry after the header
    const lines = changelog.split('\n');
    const headerEndIndex = lines.findIndex(line => line.startsWith('## [')) || lines.length;
    lines.splice(headerEndIndex, 0, changelogEntry.trim());
    
    fs.writeFileSync(changelogPath, lines.join('\n'));
    console.log('✅ Changelog updated');
  }

  /**
   * Commit changes
   */
  async commitChanges(newVersion) {
    console.log('💾 Committing changes...');
    
    try {
      execSync(`git add package.json CHANGELOG.md`, { stdio: 'inherit' });
      execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'inherit' });
      console.log('✅ Changes committed');
    } catch (error) {
      throw new Error('Failed to commit changes');
    }
  }

  /**
   * Create git tag
   */
  async createTag(newVersion) {
    console.log(`🏷️  Creating git tag v${newVersion}...`);
    
    try {
      execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
      console.log('✅ Git tag created');
    } catch (error) {
      throw new Error('Failed to create git tag');
    }
  }

  /**
   * Generate tarball
   */
  async generateTarball(newVersion, dryRun = false) {
    console.log('📦 Generating tarball...');

    const tarballDir = path.join(__dirname, '..', 'dist', 'tarballs');
    const tarballName = `${this.packageName}-${newVersion}.tgz`;

    // Ensure tarball directory exists
    if (!fs.existsSync(tarballDir)) {
      fs.mkdirSync(tarballDir, { recursive: true });
    }

    if (dryRun) {
      console.log(`🔍 Would generate tarball: ${tarballName}`);
      return;
    }

    try {
      // Create tarball using npm pack
      execSync(`npm pack`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      // Move tarball to dist/tarballs directory
      const sourceTarball = path.join(__dirname, '..', `${this.packageName}-${newVersion}.tgz`);
      const destTarball = path.join(tarballDir, tarballName);
      
      if (fs.existsSync(sourceTarball)) {
        fs.renameSync(sourceTarball, destTarball);
        console.log(`✅ Tarball generated: ${destTarball}`);
      } else {
        throw new Error('Tarball was not created');
      }

      // Also create a source tarball
      const sourceTarballName = `${this.packageName}-${newVersion}-source.tar.gz`;
      const sourceTarballPath = path.join(tarballDir, sourceTarballName);
      
      execSync(`git archive --format=tar.gz --prefix=${this.packageName}-${newVersion}/ HEAD > ${sourceTarballPath}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      console.log(`✅ Source tarball generated: ${sourceTarballPath}`);

    } catch (error) {
      throw new Error(`Failed to generate tarball: ${error.message}`);
    }
  }

  /**
   * Publish package to npm
   */
  async publishPackage(newVersion) {
    console.log('📤 Publishing package to npm...');

    try {
      execSync('npm publish', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ Package published to npm');
    } catch (error) {
      throw new Error(`Failed to publish package: ${error.message}`);
    }
  }

  /**
   * Push changes to remote repository
   */
  async pushToRemote(newVersion) {
    console.log('📤 Pushing changes to remote repository...');

    try {
      execSync('git push origin HEAD', { stdio: 'inherit' });
      execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });
      console.log('✅ Changes pushed to remote');
    } catch (error) {
      throw new Error(`Failed to push to remote: ${error.message}`);
    }
  }

  /**
   * Clean up release artifacts
   */
  async cleanup() {
    console.log('🧹 Cleaning up release artifacts...');

    const artifacts = [
      path.join(__dirname, '..', 'dist', 'tarballs'),
      path.join(__dirname, '..', '*.tgz'),
      path.join(__dirname, '..', '*.tar.gz')
    ];

    for (const artifact of artifacts) {
      if (fs.existsSync(artifact)) {
        if (fs.statSync(artifact).isDirectory()) {
          fs.rmSync(artifact, { recursive: true, force: true });
        } else {
          fs.unlinkSync(artifact);
        }
      }
    }

    console.log('✅ Cleanup completed');
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'patch',
    dryRun: false,
    skipTests: false,
    skipBuild: false,
    skipTag: false,
    skipTarball: false,
    skipPublish: false,
    preRelease: false,
    preReleaseId: 'alpha',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '--skip-tag':
        options.skipTag = true;
        break;
      case '--skip-tarball':
        options.skipTarball = true;
        break;
      case '--skip-publish':
        options.skipPublish = true;
        break;
      case '--pre-release':
        options.preRelease = true;
        break;
      case '--pre-release-id':
        options.preReleaseId = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
Release Script for ${require('../package.json').name}

Usage: node scripts/release.js [options]

Options:
  -t, --type <type>          Version type: patch, minor, major (default: patch)
  --dry-run                  Show what would be done without making changes
  --skip-tests               Skip running tests
  --skip-build               Skip building the project
  --skip-tag                 Skip creating git tag
  --skip-tarball             Skip generating tarball
  --skip-publish             Skip publishing to npm
  --pre-release              Create a pre-release version
  --pre-release-id <id>      Pre-release identifier (default: alpha)
  -h, --help                 Show this help message

Examples:
  # Patch release
  node scripts/release.js

  # Minor release with dry run
  node scripts/release.js --type minor --dry-run

  # Pre-release
  node scripts/release.js --type patch --pre-release --pre-release-id beta

  # Release without publishing
  node scripts/release.js --skip-publish

  # Quick release (skip tests and build)
  node scripts/release.js --skip-tests --skip-build
`);
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const releaseManager = new ReleaseManager();
  
  try {
    await releaseManager.release(options);
  } catch (error) {
    console.error('❌ Release failed:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = ReleaseManager;
