# Contributing to Aku

Thank you for your interest in contributing to Aku!

## Current Development Status

Currently, all development is happening in the `spike` branch. It's too early to have a well-defined process or branching procedure.

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
