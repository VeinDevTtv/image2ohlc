#!/bin/bash

# Release script for candles-from-image package
# Handles version bumping, tagging, tarball generation, and publishing

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RELEASE_TYPE="patch"
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false
SKIP_TAG=false
SKIP_TARBALL=false
SKIP_PUBLISH=false
PRE_RELEASE=false
PRE_RELEASE_ID="alpha"

# Get package name and current version
PACKAGE_NAME=$(node -p "require('../package.json').name")
CURRENT_VERSION=$(node -p "require('../package.json').version")

# Function to print colored output
print_status() {
    echo -e "${BLUE}🚀${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Function to show help
show_help() {
    cat << EOF
Release Script for $PACKAGE_NAME

Usage: ./scripts/release.sh [options]

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
  ./scripts/release.sh

  # Minor release with dry run
  ./scripts/release.sh --type minor --dry-run

  # Pre-release
  ./scripts/release.sh --type patch --pre-release --pre-release-id beta

  # Release without publishing
  ./scripts/release.sh --skip-publish

  # Quick release (skip tests and build)
  ./scripts/release.sh --skip-tests --skip-build
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            RELEASE_TYPE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tag)
            SKIP_TAG=true
            shift
            ;;
        --skip-tarball)
            SKIP_TARBALL=true
            shift
            ;;
        --skip-publish)
            SKIP_PUBLISH=true
            shift
            ;;
        --pre-release)
            PRE_RELEASE=true
            shift
            ;;
        --pre-release-id)
            PRE_RELEASE_ID="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Function to validate environment
validate_environment() {
    print_status "Validating release environment..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check if working directory is clean
    if [ -n "$(git status --porcelain)" ] && ! git status --porcelain | grep -q "package.json\|CHANGELOG.md"; then
        print_error "Working directory is not clean. Please commit or stash changes."
        exit 1
    fi
    
    # Check if we're on main branch
    BRANCH=$(git branch --show-current)
    if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
        print_warning "Not on main branch (currently on $BRANCH)"
    fi
    
    # Check if npm is logged in (for publishing)
    if ! npm whoami > /dev/null 2>&1; then
        print_warning "Not logged in to npm. Publishing will fail."
    fi
    
    print_success "Environment validation passed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    if ! npm test; then
        print_error "Tests failed. Please fix tests before releasing."
        exit 1
    fi
    print_success "Tests passed"
}

# Function to build project
build_project() {
    print_status "Building project..."
    if ! npm run build; then
        print_error "Build failed. Please fix build issues before releasing."
        exit 1
    fi
    if ! npm run build:frontend; then
        print_error "Frontend build failed. Please fix build issues before releasing."
        exit 1
    fi
    print_success "Build completed"
}

# Function to bump version
bump_version() {
    print_status "Bumping version ($RELEASE_TYPE)..."
    
    # Calculate new version
    NEW_VERSION=$(npm version $RELEASE_TYPE --no-git-tag-version)
    
    if [ "$PRE_RELEASE" = true ]; then
        NEW_VERSION="${NEW_VERSION}-${PRE_RELEASE_ID}.1"
        # Update package.json with pre-release version
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.version = '$NEW_VERSION';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
        "
    fi
    
    echo "📈 Version bumped to: $NEW_VERSION"
    echo "$NEW_VERSION"
}

# Function to update changelog
update_changelog() {
    local new_version=$1
    print_status "Updating changelog..."
    
    local today=$(date -u +%Y-%m-%d)
    local changelog_entry="## [$new_version] - $today

### ${RELEASE_TYPE^}
- Automated release ${RELEASE_TYPE} version bump

"
    
    if [ -f "CHANGELOG.md" ]; then
        # Insert new entry after the header
        sed -i "2i\\$changelog_entry" CHANGELOG.md
    else
        # Create new changelog
        cat > CHANGELOG.md << EOF
# Changelog

All notable changes to this project will be documented in this file.

$changelog_entry
EOF
    fi
    
    print_success "Changelog updated"
}

# Function to commit changes
commit_changes() {
    local new_version=$1
    print_status "Committing changes..."
    
    git add package.json CHANGELOG.md
    git commit -m "chore: release v$new_version"
    
    print_success "Changes committed"
}

# Function to create git tag
create_tag() {
    local new_version=$1
    print_status "Creating git tag v$new_version..."
    
    git tag -a "v$new_version" -m "Release v$new_version"
    
    print_success "Git tag created"
}

# Function to generate tarball
generate_tarball() {
    local new_version=$1
    print_status "Generating tarball..."
    
    # Create tarball directory
    mkdir -p dist/tarballs
    
    if [ "$DRY_RUN" = true ]; then
        echo "🔍 Would generate tarball: ${PACKAGE_NAME}-${new_version}.tgz"
        return
    fi
    
    # Create tarball using npm pack
    npm pack
    
    # Move tarball to dist/tarballs directory
    if [ -f "${PACKAGE_NAME}-${new_version}.tgz" ]; then
        mv "${PACKAGE_NAME}-${new_version}.tgz" "dist/tarballs/"
        print_success "Tarball generated: dist/tarballs/${PACKAGE_NAME}-${new_version}.tgz"
    else
        print_error "Tarball was not created"
        exit 1
    fi
    
    # Also create a source tarball
    local source_tarball_name="${PACKAGE_NAME}-${new_version}-source.tar.gz"
    git archive --format=tar.gz --prefix="${PACKAGE_NAME}-${new_version}/" HEAD > "dist/tarballs/${source_tarball_name}"
    print_success "Source tarball generated: dist/tarballs/${source_tarball_name}"
}

# Function to publish package
publish_package() {
    local new_version=$1
    print_status "Publishing package to npm..."
    
    if ! npm publish; then
        print_error "Failed to publish package"
        exit 1
    fi
    
    print_success "Package published to npm"
}

# Function to push to remote
push_to_remote() {
    local new_version=$1
    print_status "Pushing changes to remote repository..."
    
    git push origin HEAD
    git push origin "v$new_version"
    
    print_success "Changes pushed to remote"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up release artifacts..."
    
    # Remove any stray tarballs in root
    rm -f *.tgz *.tar.gz
    
    print_success "Cleanup completed"
}

# Main release function
main() {
    echo "🚀 Starting release process for $PACKAGE_NAME"
    echo "📦 Current version: $CURRENT_VERSION"
    echo "🔧 Release type: $RELEASE_TYPE"
    echo "🧪 Dry run: $DRY_RUN"
    echo "=================================================="
    
    # Step 1: Validate environment
    validate_environment
    
    # Step 2: Run tests (unless skipped)
    if [ "$SKIP_TESTS" = false ]; then
        run_tests
    fi
    
    # Step 3: Build project (unless skipped)
    if [ "$SKIP_BUILD" = false ]; then
        build_project
    fi
    
    # Step 4: Bump version
    NEW_VERSION=$(bump_version)
    
    # Step 5: Update changelog
    update_changelog "$NEW_VERSION"
    
    # Step 6: Commit changes
    if [ "$DRY_RUN" = false ]; then
        commit_changes "$NEW_VERSION"
    fi
    
    # Step 7: Create git tag (unless skipped)
    if [ "$SKIP_TAG" = false ] && [ "$DRY_RUN" = false ]; then
        create_tag "$NEW_VERSION"
    fi
    
    # Step 8: Generate tarball (unless skipped)
    if [ "$SKIP_TARBALL" = false ]; then
        generate_tarball "$NEW_VERSION"
    fi
    
    # Step 9: Publish to npm (unless skipped)
    if [ "$SKIP_PUBLISH" = false ] && [ "$DRY_RUN" = false ]; then
        publish_package "$NEW_VERSION"
    fi
    
    print_success "Release completed successfully!"
    echo "🎉 New version: $NEW_VERSION"
    
    if [ "$DRY_RUN" = true ]; then
        echo "🔍 This was a dry run - no changes were committed or published"
    fi
}

# Run main function
main
