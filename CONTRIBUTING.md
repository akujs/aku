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
