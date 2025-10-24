# Release Guide

This document describes how to create releases for the candles-from-image package.

## Release Process

### Prerequisites

1. **Node.js 18.0.0+** installed
2. **Git** configured with your credentials
3. **npm** account with publish permissions
4. **Clean working directory** (no uncommitted changes)

### Release Scripts

The project includes automated release scripts for both Node.js and Unix environments:

#### Node.js Release Script
```bash
# Basic patch release
npm run release

# Specific version types
npm run release:patch    # 1.0.0 -> 1.0.1
npm run release:minor    # 1.0.0 -> 1.1.0
npm run release:major    # 1.0.0 -> 2.0.0

# Dry run (see what would happen)
npm run release:dry

# Pre-release
npm run release:pre

# Quick release (skip tests and build)
npm run release:quick
```

#### Unix Shell Script
```bash
# Make executable (Unix/Linux/macOS)
chmod +x scripts/release.sh

# Basic patch release
./scripts/release.sh

# Specific version types
./scripts/release.sh --type patch
./scripts/release.sh --type minor
./scripts/release.sh --type major

# Dry run
./scripts/release.sh --dry-run

# Pre-release
./scripts/release.sh --pre-release --pre-release-id beta

# Custom options
./scripts/release.sh --skip-tests --skip-build --skip-publish
```

### Manual Release Process

If you prefer to release manually:

1. **Run Tests**
   ```bash
   npm test
   npm run test:coverage
   ```

2. **Build Project**
   ```bash
   npm run build
   npm run build:frontend
   ```

3. **Bump Version**
   ```bash
   npm version patch  # or minor, major
   ```

4. **Update Changelog**
   ```bash
   # Manually update CHANGELOG.md with new version
   ```

5. **Commit Changes**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: release v1.0.1"
   ```

6. **Create Tag**
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   ```

7. **Generate Tarball**
   ```bash
   npm pack
   mkdir -p dist/tarballs
   mv candles-from-image-1.0.1.tgz dist/tarballs/
   ```

8. **Publish to npm**
   ```bash
   npm publish
   ```

9. **Push to Remote**
   ```bash
   git push origin HEAD
   git push origin v1.0.1
   ```

### Release Options

#### Version Types

- **patch**: Bug fixes and minor improvements (1.0.0 -> 1.0.1)
- **minor**: New features, backward compatible (1.0.0 -> 1.1.0)
- **major**: Breaking changes (1.0.0 -> 2.0.0)

#### Pre-releases

- **alpha**: Early development versions
- **beta**: Feature-complete, testing phase
- **rc**: Release candidate, near final

#### Skip Options

- `--skip-tests`: Skip running tests
- `--skip-build`: Skip building the project
- `--skip-tag`: Skip creating git tag
- `--skip-tarball`: Skip generating tarball
- `--skip-publish`: Skip publishing to npm

### Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Build completes successfully
- [ ] Documentation is up to date
- [ ] CHANGELOG.md is updated
- [ ] Version is bumped correctly
- [ ] Git working directory is clean
- [ ] You're on the correct branch (main/master)

### Post-Release

After creating a release:

- [ ] Verify package is published on npm
- [ ] Check that git tag is created
- [ ] Test the published package
- [ ] Update any external documentation
- [ ] Announce the release to users

### Troubleshooting

#### Common Issues

1. **"Not in a git repository"**
   - Ensure you're in the project root directory
   - Check that `.git` directory exists

2. **"Working directory is not clean"**
   - Commit or stash uncommitted changes
   - Only package.json and CHANGELOG.md should be modified

3. **"Tests failed"**
   - Fix failing tests before releasing
   - Use `--skip-tests` only for emergency releases

4. **"Build failed"**
   - Fix build issues before releasing
   - Use `--skip-build` only for emergency releases

5. **"Not logged in to npm"**
   - Run `npm login` to authenticate
   - Check npm permissions for the package

6. **"Package already exists"**
   - Version already published
   - Bump version or use pre-release

#### Emergency Releases

For emergency releases, you can skip some steps:

```bash
# Skip tests and build (use with caution)
npm run release:quick

# Or use manual options
./scripts/release.sh --skip-tests --skip-build --skip-tarball
```

### Release Artifacts

Each release creates:

1. **Package Tarball**: `dist/tarballs/candles-from-image-{version}.tgz`
2. **Source Tarball**: `dist/tarballs/candles-from-image-{version}-source.tar.gz`
3. **Git Tag**: `v{version}`
4. **npm Package**: Published to npm registry

### Version History

- **1.0.0**: Initial release
- **1.0.1**: Bug fixes and improvements
- **1.1.0**: New features
- **2.0.0**: Breaking changes

### Support

For release-related issues:

- Check the [GitHub Issues](https://github.com/your-username/image2ohlc/issues)
- Review the [Release Scripts](scripts/) directory
- Consult the [Development Guide](DEVELOPMENT.md)

---

**Note**: Always test releases in a development environment before publishing to production.
