# Contributing to Aku

Thank you for your interest in contributing to Aku!

## Current Development Status

Currently, all development is happening in the `spike` branch. It's too early to have a well-defined process or branching procedure.

## Installation

We're using Bun workspaces to manage the project. To install the dependencies, run:

```bash
bun install
```

## Running Scripts from the Root

Since this project uses Bun workspaces, you can run scripts in any workspace from the repository root using Bun's workspace filtering feature.

### Running Test Apps

To run the Next.js test app from the root:

```bash
bun run --filter=nextjs dev
```

This will start the Next.js development server. Other available scripts for the Next.js test app:

- `bun run --filter=nextjs dev` - Start the development server
- `bun run --filter=nextjs next:build` - Build the Next.js app
- `bun run --filter=nextjs next:start` - Start the production server
- `bun run --filter=nextjs test:integration` - Run integration tests

### Running Scripts Across All Workspaces

The root `package.json` includes scripts that run across all workspaces using the `--filter='*'` pattern:

- `bun run build` - Build all packages
- `bun run check:test` - Run tests in all packages
- `bun run check:ts` - Type check all packages
- `bun run check:lint` - Lint all packages

For more information on Bun workspace filtering, see the [Bun documentation](https://bun.sh/docs/cli/run#workspace-filtering).

## How to Contribute

If you'd like to contribute, please get in touch and we will arrange working around each other. We're excited to collaborate with anyone interested in the project!

Feel free to:

- Open issues for bugs or feature suggestions
- Discuss ideas in the issues section
- Reach out about contributing code

We appreciate your support and look forward to building this project together.

## Project requirements

To build and test Aku you will need to have the following installed:

| Tool    | Minimum version |
| ------- | --------------- |
| Node.js | 24              |
| Bun     | 1.3.5           |

### Recommended version managers

We recommend using version managers to ensure you're running the correct versions. The repository includes `.nvmrc` and `.bun-version` files that these tools will detect automatically.

**For Node.js — [fnm](https://github.com/Schniz/fnm)**

```bash
# Install fnm (macOS/Linux)
curl -fsSL https://fnm.vercel.app/install | bash

# Then in the project directory:
fnm install
fnm use
```

**For Bun — [bunvm](https://bunvm.com/)**

```bash
# Install bunvm
curl -fsSL https://bunvm.com/install | bash

# Then in the project directory:
bunvm install
bunvm use
```

Both tools support automatic version switching when you `cd` into the project directory. See their documentation for shell integration setup.

### Docker services

Some tests require Docker services (e.g. MinIO for S3 compatibility testing). See the [Docker Compose](./packages/aku/docker-compose.yml) file for the services and their ports.

```bash
# Start the required services
docker compose -f packages/aku/docker-compose.yml up -d
```

If you don't have Docker installed or want to skip these tests, set the `SKIP_DOCKER_INTEGRATION_TESTS` environment variable:

```bash
SKIP_DOCKER_INTEGRATION_TESTS=1 bun check:test
```

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and releases.

### Adding a changeset to your PR

When making changes that should be released, add a changeset:

```bash
bun changeset
```

This prompts you to:
1. Select which packages are affected
2. Choose the version bump type (major/minor/patch)
3. Write a summary of the changes

A markdown file will be created in `.changeset/` - commit this with your PR.

### What happens after merging

1. When your PR merges to `main`, a "Release" PR is automatically created/updated
2. This PR accumulates all pending changesets and shows the version bumps
3. When the Release PR is merged, packages are published to npm
