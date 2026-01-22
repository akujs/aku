# Aku CLI Project Plan

This document outlines the plan for building a CLI system for the Aku framework, starting with database commands but designed for extensibility to all framework activities.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package structure | Separate `@akujs/cli` (lightweight) + CLI infrastructure in `@akujs/aku` | Global install is minimal; local `bun aku` works without global install |
| Bootstrap model | Full bootstrap always | Simplicity; all commands get full Application with all providers |
| Command discovery | Explicit only via service providers | No magic auto-discovery; predictable and explicit |
| Signature syntax | TBD (major design subproject) | Needs careful design - TypeScript-native approach preferred |
| Interaction library | TBD | Evaluate `@clack/prompts`, `@inquirer/prompts`, or custom |

---

## Phase 1: Core Infrastructure

### 1.1 CLI Application Core (in `@akujs/aku`)

- `CliApplication` class that orchestrates command execution
- Bootstrap integration:
  - Creates Application instance
  - Boots all service providers
  - Resolves and runs the requested command
- Entry point function that both global CLI and `bun aku` call
- Exit code handling (0 for success, 1+ for errors)

### 1.2 Global CLI Package (`@akujs/cli`)

Lightweight package for global installation:

- Finds local Aku installation (walk up directory tree for `node_modules/@akujs/aku`)
- Imports and calls the entry point from local install
- Prints helpful error if not in an Aku project
- Warns if version mismatch between global CLI and local Aku (TBD: error vs warn vs proceed)
- Package setup with `bin` field in package.json for global `aku` command

### 1.3 Local `aku` Binary

- Bin entry in `@akujs/aku` package.json
- Allows `bun aku` / `npm run aku` in package scripts without global install
- Points to same entry point as global CLI

### 1.4 Terminal Colours

Support for coloured output in the terminal.

**Library choice:** [picocolors](https://github.com/alexeyraspopov/picocolors)
- Tiny (~2KB), no dependencies
- 10x faster than chalk
- Supports NO_COLOR environment variable

**Colour detection:**
- Respect `NO_COLOR` environment variable (de facto standard)
- Detect TTY capability via `process.stdout.isTTY`
- Provide `--no-color` flag to force disable

**API additions to TerminalUI:**
- `success(text)` - Green text for success messages
- `warning(text)` - Yellow text for warnings
- `error(text)` - Red text for errors
- `info(text)` - Cyan text for informational messages
- `dim(text)` - Dimmed text for secondary information

---

## Phase 2: Command System

### 2.1 Command Interface Design

**Major design subproject** - the developer-facing API for defining commands.

Key decisions:
- Base `Command` class or interface structure
- How commands declare:
  - Name (e.g., `db:migrate`)
  - Description and extended help text
  - Arguments (positional, required/optional, array)
  - Options (flags, values, defaults)
- How commands access the container/application
- The `handle()` or `execute()` method signature
- Return type (exit code? void with exceptions?)

Design considerations:
- Laravel uses string signatures: `'mail:send {user} {--queue}'`
- TypeScript could be more type-safe with object definitions
- Need to balance ergonomics vs type safety vs familiarity

### 2.2 Argument/Option Parsing

- Parse command line arguments into typed values
- Validation:
  - Required arguments present
  - Option value types (string, number, boolean)
  - Custom validation rules
- Error messages for invalid input
- Decision: build on existing library (commander, yargs) or custom?

### 2.3 Service Provider Integration

- Command registration API for service providers:
  ```typescript
  // Example API (TBD)
  this.commands([DbTestCommand, DbShowCommand])
  ```
- Registration timing: during `register()` phase (before boot)
- `ConsoleServiceProvider`:
  - Built-in provider that collects commands from other providers
  - Wires up the CLI application
  - Registers core framework commands

### 2.4 Testing Infrastructure

- Programmatic command invocation for unit tests:
  ```typescript
  const result = await cli.run(['db:test'])
  expect(result.exitCode).toBe(0)
  expect(result.output).toContain('successful')
  ```
- Output capture (stdout, stderr separation)
- Assertions for exit codes, output content, side effects
- Mock input for interactive commands (simulated user responses)
- Integration with existing Bun test setup

### 2.5 Core Test Commands

Commands developed alongside the infrastructure to validate the design:

| Command | Purpose | What it exercises |
|---------|---------|-------------------|
| `list` | List all available commands, grouped by prefix | Command registry, table output, grouping logic |
| `about` | Show application info (version, environment, loaded providers) | Container access, formatted section output |
| `help {command}` | Show detailed help for a specific command | Argument parsing, command metadata access |

These commands:
- Are useful in their own right
- Don't require external dependencies (database, etc.)
- Exercise core CLI features (output formatting, arguments, registry)
- Serve as reference implementations

---

## Phase 3: Help System

### 3.1 Command Help

- `--help` flag works on any command
- Auto-generated from command metadata:
  - Description
  - Usage syntax
  - Arguments with descriptions
  - Options with descriptions and defaults
- Example output:
  ```
  Description:
    Test connectivity to configured database connections

  Usage:
    db:test [options]

  Options:
    --connection=NAME  Test only this connection
    --timeout=MS       Connection timeout in milliseconds [default: 5000]
    -h, --help         Display this help message
  ```

### 3.2 Command Listing

- `aku` with no arguments shows command list
- `aku list` as explicit command (alias)
- Grouped by prefix:
  ```
  Available commands:
    about              Display application information
    help               Show help for a command
    list               List all available commands

  db
    db:show            Display database information
    db:table           Display table structure
    db:test            Test database connectivity
  ```

### 3.3 Group Help (Stretch Goal)

- `aku db` shows all `db:*` commands with descriptions
- Acts as a shortcut for filtered `list`
- Lower priority - can be added later

---

## Phase 4: Interaction & Output

### 4.1 Interaction Library Selection

Evaluate options:

| Library | Size | Pros | Cons |
|---------|------|------|------|
| `@clack/prompts` | ~50KB | Beautiful output, modern API, used by create-next-app | Smaller ecosystem |
| `@inquirer/prompts` | ~2MB | Battle-tested, feature-rich, large ecosystem | Larger bundle |
| Custom on readline | 0 | Full control, no dependencies | More work, edge cases |

Decision process:
- Prototype each with representative prompts
- Evaluate DX, bundle size, edge case handling
- Document choice and rationale

### 4.2 Output Utilities

Methods available to commands:

```typescript
// Basic output
this.info('Operation completed')      // Standard output (cyan/default)
this.error('Something went wrong')    // Error output (red)
this.warn('Deprecated option used')   // Warning output (yellow)
this.line('Plain text')               // Unformatted output

// Structured output
this.table(headers, rows)             // Formatted table
this.newLine(count?)                  // Blank lines

// Progress indication
this.withProgressBar(items, callback) // Progress bar for iterations
this.spin(message, callback)          // Spinner for async operations
```

Verbosity levels:
- `-q` / `--quiet` - Minimal output (errors only)
- Normal - Standard output
- `-v` - Verbose
- `-vv` - Very verbose
- `-vvv` - Debug

### 4.3 Input Utilities

Methods for user interaction:

```typescript
// Text input
const name = await this.ask('What is your name?')
const name = await this.ask('Name?', { default: 'Anonymous' })

// Confirmation
const proceed = await this.confirm('Drop all tables?')
const proceed = await this.confirm('Continue?', { default: true })

// Selection
const env = await this.choice('Select environment', ['dev', 'staging', 'prod'])
const features = await this.multiChoice('Enable features', ['auth', 'api', 'admin'])

// Sensitive input
const password = await this.secret('Enter password')
```

Production safety pattern:
- Destructive commands require confirmation in production
- `--force` flag bypasses confirmation
- Pattern used by Laravel's `ConfirmableTrait`

---

## Phase 5: Database Commands

Commands scoped to current database capabilities (query builder, connection management - no migrations/seeders yet).

### 5.1 `db:test` - Connection Testing

**Purpose:** Test connectivity to configured database connections

**Options:**
- `--connection=NAME` - Test only this connection (default: test all)
- `--timeout=MS` - Connection timeout (default: 5000)

**Interaction:** None (non-interactive)

**Output:**
```
Testing database connections...

  ✓ default (sqlite) - 2ms
  ✓ analytics (postgres) - 15ms
  ✗ legacy (postgres) - Connection refused

2 of 3 connections successful
```

**Exit codes:**
- 0: All connections successful
- 1: One or more connections failed

**Implementation notes:**
- Run `SELECT 1` on each configured client
- Measure and display timing
- Handle connection errors gracefully

### 5.2 `db:show` - Database Information

**Purpose:** Display information about a database

**Options:**
- `--connection=NAME` - Which connection to inspect (default: default)
- `--json` - Output as JSON
- `--counts` - Include row counts (can be slow)

**Interaction:** None (non-interactive)

**Output (text):**
```
Connection: default
Driver:     sqlite
Database:   /path/to/database.db
Tables:     12

Tables:
  Name              Rows    Size
  users             1,234   48KB
  posts             5,678   256KB
  comments         12,345   512KB
  ...
```

**Output (JSON):**
```json
{
  "connection": "default",
  "driver": "sqlite",
  "database": "/path/to/database.db",
  "tables": [
    { "name": "users", "rows": 1234, "size": 49152 },
    ...
  ]
}
```

**Implementation notes:**
- Query `information_schema` for PostgreSQL
- Query `sqlite_master` for SQLite
- Handle different adapters appropriately

### 5.3 `db:table` - Table Structure

**Purpose:** Display structure of a specific table

**Arguments:**
- `table` - Table name (optional)

**Options:**
- `--connection=NAME` - Which connection to use
- `--json` - Output as JSON

**Interaction:**
- If `table` argument not provided, prompt with choice of available tables

**Output:**
```
Table: users
Connection: default

Columns:
  Name          Type         Nullable    Default
  id            integer      no          autoincrement
  email         varchar(255) no          -
  name          varchar(255) yes         null
  created_at    timestamp    no          CURRENT_TIMESTAMP

Indexes:
  Name                  Columns         Unique
  users_pkey            id              yes
  users_email_unique    email           yes
```

**Implementation notes:**
- Query schema metadata from database
- Support both PostgreSQL and SQLite schema inspection
- Choice prompt exercises interaction library

---

## Phase 6: Shell Completions

### 6.1 Completion Script Generation

Generate shell-specific completion scripts from the command registry:

```bash
aku completions bash   # Output bash completion script
aku completions zsh    # Output zsh completion script
aku completions fish   # Output fish completion script
```

**User setup:**
```bash
# Bash (~/.bashrc)
eval "$(aku completions bash)"

# Zsh (~/.zshrc)
eval "$(aku completions zsh)"

# Fish (~/.config/fish/config.fish)
aku completions fish | source
```

### 6.2 Completion Features

**Basic completions:**
- Command names (with colon handling for bash)
- Option names (`--connection`, `--json`, etc.)

**Context-aware completions (stretch):**
- Option values where applicable (e.g., `--connection=` could complete with configured connection names)
- Argument values (e.g., table names for `db:table`)

### 6.3 Implementation Approach

**Recommended:** Static script generation (no runtime dependency)

- `aku completions bash` introspects command registry and outputs a bash script
- Script is self-contained, no callback to `aku` at completion time
- Simple template-based generation (~50-100 lines of code)
- Can upgrade to dynamic completions later if needed

**Libraries considered:**
- [omelette](https://github.com/f/omelette) - Simple template-based API, handles shell detection
- [tabtab](https://github.com/mklabs/tabtab) - Used by npm/pnpm, more features
- Custom templates - Zero dependencies, full control

**Bash colon handling:**
- Colons are word separators in bash completion (`COMP_WORDBREAKS`)
- Need `_get_comp_words_by_ref -n :` and `__ltrim_colon_completions` workarounds
- Or consider space-separated subcommands (`aku db test` vs `aku db:test`)

---

## Phase 7: User Documentation

### 7.1 CLI Usage Guide

Documentation for end users of Aku applications:

- Installing the global CLI
- Running commands (`aku`, `bun aku`, `npx aku`)
- Getting help (`--help`, `aku help <command>`)
- Shell completion setup
- Common workflows

### 7.2 Command Development Guide

Documentation for developers creating commands:

- Creating a command class
- Defining arguments and options
- Accessing the container and services
- Output formatting (tables, colours, progress)
- User interaction (prompts, confirmations)
- Testing commands
- Registering commands via service providers

### 7.3 Built-in Command Reference

Auto-generated or manually written reference for all built-in commands:

- Core commands (`list`, `about`, `help`)
- Database commands (`db:test`, `db:show`, `db:table`)
- Future commands as added

### 7.4 Documentation Location

- Primary: Aku documentation website (`/packages/website/`)
- Secondary: README in `@akujs/cli` package for quick start
- Inline: TSDoc comments on public APIs

---

## Implementation Order

```
Phase 1: Core Infrastructure
├── 1.1 CLI Application Core
├── 1.2 Global CLI Package
├── 1.3 Local aku Binary
└── 1.4 Terminal Colours

Phase 2: Command System
├── 2.1 Command Interface Design  ← Major design work, unlocks everything
├── 2.2 Argument/Option Parsing
├── 2.3 Service Provider Integration
├── 2.4 Testing Infrastructure     ← Develop alongside 2.1-2.3
└── 2.5 Core Test Commands         ← list, about, help

Phase 3: Help System
├── 3.1 Command Help (--help)
├── 3.2 Command Listing
└── 3.3 Group Help (stretch)

Phase 4: Interaction & Output
├── 4.1 Interaction Library Selection
├── 4.2 Output Utilities
└── 4.3 Input Utilities

Phase 5: Database Commands
├── 5.1 db:test
├── 5.2 db:show
└── 5.3 db:table

Phase 6: Shell Completions
├── 6.1 Completion Script Generation
├── 6.2 Completion Features
└── 6.3 Implementation (bash/zsh/fish)

Phase 7: User Documentation
├── 7.1 CLI Usage Guide
├── 7.2 Command Development Guide
├── 7.3 Built-in Command Reference
└── 7.4 Website Integration
```

**Parallelisation opportunities:**
- Phase 4.1 (library selection) can happen in parallel with Phase 2
- Database commands (Phase 5) can start once Phase 2.1 is complete, in parallel with Phases 3-4
- Shell completions (Phase 6) can start once Phase 2 is complete
- Documentation (Phase 7) can be written incrementally as each phase completes

---

## Research References

### Laravel Artisan Architecture

Key files studied:
- `Illuminate/Console/Command.php` - Base command class
- `Illuminate/Console/Application.php` - CLI application (extends Symfony)
- `Illuminate/Foundation/Console/Kernel.php` - Bootstrap and command discovery
- `Illuminate/Console/Concerns/InteractsWithIO.php` - I/O methods

Laravel patterns adopted:
- Service provider registration of commands
- `--force` flag for production confirmation bypass
- Colon-separated command naming for grouping (`db:migrate`)
- Container integration for dependency injection

Laravel patterns adapted:
- String signatures → TypeScript-native approach (TBD)
- Symfony Console dependency → evaluate alternatives

### Interaction Libraries

- `@clack/prompts` - https://github.com/natemoo-re/clack
- `@inquirer/prompts` - https://github.com/SBoudrias/Inquirer.js
- Laravel Prompts - https://github.com/laravel/prompts (PHP, for inspiration)

---

## Open Questions

1. **Signature syntax:** What's the right balance between Laravel-style string signatures and TypeScript type safety?

2. **Argument parsing library:** Build vs buy? If buy, which library? Current recommendation: Node.js built-in `parseArgs` (zero dependencies).

3. **Interaction library:** Final choice after prototyping?

4. **Version mismatch handling:** When global `@akujs/cli` version differs from local `@akujs/aku`, should we warn, error, or just proceed?

5. **Command namespacing - colons vs spaces:**
   - Colons (`db:test`): Laravel-familiar, but requires bash completion workarounds due to `COMP_WORDBREAKS`
   - Spaces (`db test`): Modern convention (git, docker, kubectl), cleaner bash completion, but needs subcommand routing
   - Hybrid: Accept both syntaxes, more implementation work

6. **Completion library:** Custom templates (zero deps, ~50-100 lines) vs `omelette` (handles shell detection/setup)?

---

## Future Extensions (Out of Scope)

These would be added as their underlying features are built:

- `db:migrate` commands (when migration system exists)
- `db:seed` commands (when seeder system exists)
- `make:*` generators (controller, middleware, etc.)
- `route:list` (when routing inspection is needed)
- `cache:*` commands (when caching system exists)
- `queue:*` commands (when queue system exists)
