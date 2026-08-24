# =============================================================================
# Playwright Test Automation Framework - Docker Image
# =============================================================================
# =============================================================================

# Use official Playwright image with all browsers pre-installed.
#
# This MUST match the @playwright/test version in package.json. The image ships the browser
# builds for its own Playwright version and PLAYWRIGHT_BROWSERS_PATH points at them, so a client
# newer than the image looks for browser builds that are not in it and fails at run time with
# "Executable doesn't exist" — nothing to do with the tests. This was pinned at v1.40.0 against a
# 1.60.0 client, i.e. the image could not run the suite at all.
#
# Override at build time with --build-arg PLAYWRIGHT_VERSION=x.y.z when bumping the dependency.
ARG PLAYWRIGHT_VERSION=1.60.0
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy

# Re-declare after FROM: an ARG before FROM is only in scope for the FROM itself.
ARG PLAYWRIGHT_VERSION=1.60.0

# Set working directory
WORKDIR /app

# Set environment variables
ENV CI=true
ENV NODE_ENV=test
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Fail the BUILD if the installed client and the base image have drifted apart. Without this the
# mismatch only shows up as a confusing runtime error inside a CI job, which is how the v1.40 /
# v1.60 gap survived unnoticed.
RUN node -e "\
const want = process.env.PLAYWRIGHT_VERSION; \
const got = require('@playwright/test/package.json').version; \
if (got !== want) { \
  console.error('\\nPlaywright version mismatch:'); \
  console.error('  base image      : v' + want + '-jammy (its browsers are the ones available)'); \
  console.error('  @playwright/test: ' + got + ' (from package.json)'); \
  console.error('Rebuild with --build-arg PLAYWRIGHT_VERSION=' + got + ', or align package.json.\\n'); \
  process.exit(1); \
}" \
  && echo "Playwright client and base image both at v${PLAYWRIGHT_VERSION}"

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create directory for test results
RUN mkdir -p /app/test-results /app/playwright-report /app/tta-report

# Default command - run all tests SERIALLY. These specs drive shared, stateful UAT accounts
# through one browser session each, so fullyParallel/workers>1 lets two workers corrupt each
# other's journey position. scripts/run-e2e.js has pinned workers=1 for this reason all along;
# this entry point used to bypass it and inherit the parallel default.
CMD ["npx", "playwright", "test", "--workers=1"]

# =============================================================================
# Usage Examples:
# =============================================================================
#
# Build the image:
#   docker build -t playwright-framework .
#
# Run all tests:
#   docker run --rm playwright-framework
#
# Run smoke tests:
#   docker run --rm playwright-framework npx playwright test --grep @Smoke
#
# Sharding is intentionally NOT shown as an example: the suite shares stateful UAT accounts, so
# splitting it across processes lets two shards drive the same account at once. Give each shard
# its own accounts first.
#
# Run with mounted results directory:
#   docker run --rm -v $(pwd)/results:/app/test-results playwright-framework
#
# Run specific test file:
#   docker run --rm playwright-framework npx playwright test login.spec.ts
#
# =============================================================================