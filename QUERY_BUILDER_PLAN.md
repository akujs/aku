# Query Builder API Plan

A fluent, SQL-native query builder that integrates with the existing database infrastructure.

## Philosophy

- **SQL-native**: Users write SQL fragments, not abstracted method chains. Assumes comfort with SQL.
- **Efficient immutability**: Shared arrays with length tracking for copy-on-write semantics.
- **Integration**: Produces `ExecutableStatement` compatible output, works with existing `db.*` methods and transactions.
- **Type safety**: Compile-time tracking of named parameters. Schema-aware typing is out of scope for this plan.
- **Scope**: Recursive CTEs are out of scope - users can write raw SQL for those.

---

## Milestone 1: Query Builder Core and SQL Generation

The foundation: shared-array copy-on-write pattern, command storage, replay mechanism, and SQL output.

### API

```typescript
const query = db.from("artists")
  .join("artworks aw ON aw.artist_id = artists.id")
  .leftJoin("galleries g ON g.id = aw.gallery_id")
  .select("artists.id", "artists.fullName", "aw.title")
  .where("artists.age > 30")
  .where("artists.status = 'active'")
  .groupBy("artists.id")
  .having("COUNT(*) > 1")
  .orderBy("artists.fullName")
  .orderBy("aw.year DESC")
  .limit(10)
  .offset(20)
  .distinct()
  .forUpdate();

// Get the generated SQL
const sql = query.toSql();
// → SELECT artists.id, artists.fullName, aw.title
//   FROM artists
//   JOIN artworks aw ON aw.artist_id = artists.id
//   LEFT JOIN galleries g ON g.id = aw.gallery_id
//   WHERE (artists.age > 30) AND (artists.status = 'active')
//   GROUP BY artists.id
//   HAVING (COUNT(*) > 1)
//   ORDER BY artists.fullName, aw.year DESC
//   LIMIT 10 OFFSET 20
//   FOR UPDATE
```

At this stage, queries cannot be executed - only built and rendered to SQL. Values in SQL are written literally (no parameter binding yet). Identifier quoting comes in Milestone 2.

### Method Behaviour

Most methods are **additive** - calling them multiple times accumulates:
- `.where()` - multiple calls AND together
- `.join()`, `.leftJoin()`, `.rightJoin()`, `.fullJoin()`, `.crossJoin()` - multiple calls add more joins
- `.orderBy()` - multiple calls add more sort columns

Some methods are **replacing** - calling them overrides the previous value:
- `.limit()` - replaces the limit
- `.offset()` - replaces the offset

All methods return a new `QueryBuilder` instance (immutable pattern). This is a single underlying object with TypeScript types that control which methods are accessible.

### Select Behaviour

The builder tracks whether a SELECT has been explicitly set via type state:

```typescript
db.from("artists")                    // QueryBuilder<SelectNotSet>
  .where("age > 30")                  // QueryBuilder<SelectNotSet>
  .select("id", "name")               // QueryBuilder<SelectSet>
  .addSelect("age")                   // QueryBuilder<SelectSet> - adds column
  .replaceSelect("id")                // QueryBuilder<SelectSet> - replaces entirely

// Without explicit select, defaults to *
db.from("artists").where("x").toSql()
// → SELECT * FROM artists WHERE (x)

// Type error - can't use .select() after select is set
db.from("artists")
  .select("id")
  .select("name")                     // Compile error - use .addSelect() or .replaceSelect()
```

Methods available by state:
- `SelectNotSet`: `.select()` available (sets columns, returns `SelectSet`)
- `SelectSet`: `.addSelect()` and `.replaceSelect()` available, `.select()` not available

### WHERE Clause Behaviour

Multiple `.where()` calls are ANDed together. Each condition is wrapped in parentheses to ensure correct precedence.

```typescript
// Single where
db.from("artists").where("age > 30")
// → WHERE (age > 30)

// Multiple where - ANDed with parentheses
db.from("artists")
  .where("status = 'active' OR status = 'pending'")
  .where("age > 30 OR vip = true")
// → WHERE (status = 'active' OR status = 'pending')
//     AND (age > 30 OR vip = true)
```

### Join Types

```typescript
.join("table ON condition")       // INNER JOIN
.innerJoin("table ON condition")  // INNER JOIN (explicit)
.leftJoin("table ON condition")   // LEFT JOIN
.rightJoin("table ON condition")  // RIGHT JOIN
.fullJoin("table ON condition")   // FULL OUTER JOIN
.crossJoin("table")               // CROSS JOIN
```

### Other Clauses

```typescript
// GROUP BY and HAVING
db.from("artworks")
  .select("artist_id, COUNT(*) AS count")
  .groupBy("artist_id")
  .having("COUNT(*) > 5")

// ORDER BY
.orderBy("fullName")              // ASC by default
.orderBy("fullName ASC")
.orderBy("age DESC")
.orderBy("lastName ASC", "firstName ASC")  // Multiple columns
.orderBy("age DESC NULLS LAST")

// LIMIT and OFFSET
.limit(10)
.offset(20)

// DISTINCT
db.from("artists").select("country").distinct()

// Row locking
.forUpdate()
.forShare()
.forUpdate("NOWAIT")
.forUpdate("SKIP LOCKED")
```

### Internal Architecture

#### Command Storage

Each builder method pushes a command as `[methodName, args]`:

```typescript
// .join("artworks ON ...") pushes:
["join", ["artworks ON ..."]]

// .where("x > 5") pushes:
["where", ["x > 5"]]
```

#### Copy-on-Write Pattern

```typescript
class QueryBuilder {
  readonly #commands: QueryCommand[];
  readonly #length: number;

  #derive(command: QueryCommand): QueryBuilder {
    let commands = this.#commands;

    // A sibling has pushed beyond our view - clone our portion
    if (commands.length > this.#length) {
      commands = commands.slice(0, this.#length);
    }

    commands.push(command);
    return new QueryBuilder(commands, this.#length + 1);
  }
}
```

This provides:
- Linear chains: One array, no copying
- Branches: Copy-on-write only when needed
- Most queries are linear (build then execute) - optimal case

#### Build Step

At execution time, replay commands onto a mutable builder:

```typescript
#build(): BuiltQuery {
  const builder = new MutableQueryBuilder();
  for (let i = 0; i < this.#length; i++) {
    const [method, args] = this.#commands[i];
    builder[method](...args);
  }
  return builder.compile();
}
```

### Test Cases

```typescript
// Branching behaviour
const base = db.from("artists").where("active = true");
const young = base.where("age < 30");
const old = base.where("age >= 60");
// young and old are independent - no shared mutation
young.toSql() // → SELECT * FROM artists WHERE (active = true) AND (age < 30)
old.toSql()   // → SELECT * FROM artists WHERE (active = true) AND (age >= 60)

// WHERE combinations
db.from("t").where("a = 1").where("b = 2").toSql()
// → SELECT * FROM t WHERE (a = 1) AND (b = 2)

db.from("t").where("a = 1 OR a = 2").where("b = 3 OR b = 4").toSql()
// → SELECT * FROM t WHERE (a = 1 OR a = 2) AND (b = 3 OR b = 4)

// Method chaining produces correct clause order
db.from("t").where("x").select("a").orderBy("b").limit(1).toSql()
// → SELECT a FROM t WHERE (x) ORDER BY b LIMIT 1

// Select type states
db.from("t").select("a").addSelect("b").toSql()
// → SELECT a, b FROM t

db.from("t").select("a", "b").replaceSelect("c").toSql()
// → SELECT c FROM t

// Default select is *
db.from("t").toSql()
// → SELECT * FROM t
```

---

## Milestone 2: Identifier Quoting

Add automatic quoting of mixed-case identifiers for PostgreSQL compatibility.

### Automatic Identifier Quoting

Identifiers containing uppercase letters are automatically quoted. All-lowercase identifiers are left unquoted.

```typescript
db.from("artists").where("artist.fullName = 'Bernie'").toSql()
// → SELECT * FROM artists WHERE ("artist"."fullName" = 'Bernie')

db.from("artists").select("firstName", "lastName", "age").toSql()
// → SELECT "firstName", "lastName", age FROM artists

db.from("artists").where("age > 30").toSql()
// → SELECT * FROM artists WHERE (age > 30)  (lowercase, no quoting)
```

### Rules

- Identifiers with any uppercase letter → quoted (`fullName` → `"fullName"`)
- All-lowercase identifiers → unquoted (`age` → `age`)
- Dotted notation splits into separate quoted identifiers (`artist.fullName` → `"artist"."fullName"`)
- String literal contents are never modified
- SQL keywords in lowercase are the user's responsibility to avoid or handle

### Implementation

State machine parser for SQL fragments that tracks:
- Inside single-quoted string (skip, preserve content)
- Inside double-quoted identifier (skip, already quoted)
- Otherwise, identify words and quote if they contain uppercase

### Test Cases

```typescript
// Contains uppercase → quoted
db.from("t").where("fullName = 'Bernie'").toSql()
// → SELECT * FROM t WHERE ("fullName" = 'Bernie')

// All lowercase → not quoted
db.from("t").where("age > 30").toSql()
// → SELECT * FROM t WHERE (age > 30)

// Escaped quotes in strings preserved
db.from("t").where("name = 'it''s fine'").toSql()
// → SELECT * FROM t WHERE ("name" = 'it''s fine')

// Dotted identifiers - each part quoted if contains uppercase
db.from("t").where("artist.fullName = 'test'").toSql()
// → SELECT * FROM t WHERE ("artist"."fullName" = 'test')

// Mixed in same expression
db.from("t").where("artist.fullName = 'Bernie' AND age > 30").toSql()
// → SELECT * FROM t WHERE ("artist"."fullName" = 'Bernie' AND age > 30)
```

---

## Milestone 3: Positional Parameters and Subqueries

Support `?` placeholders with immediate value binding, including subquery support.

### Positional Parameters

Values bound immediately. Any value can be passed.

```typescript
.where("fullName = ?", "Bernie")
.where("age > ? AND status = ?", 30, "active")
```

Arity is checked at compile time - wrong number of values is a type error.

```typescript
.where("a = ? AND b = ?", 1, 2)  // OK
.where("a = ? AND b = ?", 1)     // Compile error - missing second value
```

### Subqueries

A `QueryBuilder` can be passed as a value wherever `?` appears. The subquery is built, wrapped in parentheses, and inlined.

#### WHERE Clause Subqueries

```typescript
// IN - subquery returns a list
.where("id IN ?", db.from("artworks").select("artist_id"))
// → WHERE id IN (SELECT "artist_id" FROM "artworks")

// NOT IN
.where("id NOT IN ?", db.from("blocked").select("artist_id"))
// → WHERE id NOT IN (SELECT "artist_id" FROM "blocked")

// EXISTS
.where("EXISTS ?", db.from("artworks").where("artist_id = artists.id").select("1"))
// → WHERE EXISTS (SELECT 1 FROM "artworks" WHERE "artist_id" = "artists"."id")

// NOT EXISTS
.where("NOT EXISTS ?", db.from("artworks").where("artist_id = artists.id").select("1"))
// → WHERE NOT EXISTS (SELECT ...)

// Scalar comparison
.where("age > ?", db.from("artists").select("AVG(age)"))
// → WHERE age > (SELECT AVG(age) FROM "artists")

// ALL/ANY/SOME
.where("sales > ALL ?", db.from("competitors").select("sales"))
// → WHERE sales > ALL (SELECT sales FROM "competitors")

.where("price = ANY ?", db.from("price_points").select("price"))
// → WHERE price = ANY (SELECT price FROM "price_points")
```

#### SELECT Clause Subqueries

Each `?` in the SQL string consumes the next argument.

```typescript
db.from("artists a")
  .select("a.fullName", "? AS artwork_count", db.from("artworks").select("COUNT(*)").where("artist_id = a.id"))
// → SELECT "a"."fullName",
//          (SELECT COUNT(*) FROM "artworks" WHERE "artist_id" = "a"."id") AS artwork_count
//   FROM "artists" "a"

// Multiple subqueries - each ? consumes next arg in order
db.from("artists a")
  .select("a.fullName", "? AS artworks", subquery1, "? AS sales", subquery2)
// The first ? binds to subquery1, the second ? binds to subquery2
```

#### FROM Clause Subqueries

Derived tables / inline views.

```typescript
db.from("? AS top_artists", db.from("artists").select("*").orderBy("sales DESC").limit(10))
  .select("fullName", "sales")
// → SELECT "fullName", "sales"
//   FROM (SELECT * FROM "artists" ORDER BY sales DESC LIMIT 10) AS top_artists
```

#### JOIN Clause Subqueries

```typescript
db.from("artists a")
  .join("? AS recent ON recent.artist_id = a.id",
    db.from("artworks")
      .select("artist_id", "MAX(year) AS latest")
      .groupBy("artist_id")
  )
  .select("a.fullName", "recent.latest")
// → SELECT "a"."fullName", "recent"."latest"
//   FROM "artists" "a"
//   JOIN (SELECT "artist_id", MAX(year) AS latest
//         FROM "artworks" GROUP BY "artist_id") AS recent
//     ON recent.artist_id = a.id
```

#### HAVING Clause Subqueries

```typescript
db.from("artists")
  .select("country", "COUNT(*) AS artist_count")
  .groupBy("country")
  .having("COUNT(*) > ?", db.from("country_stats").select("avg_artists"))
// → HAVING COUNT(*) > (SELECT "avg_artists" FROM "country_stats")
```

#### Nested Subqueries

Subqueries can contain subqueries.

```typescript
db.from("artists")
  .where("id IN ?",
    db.from("artworks")
      .select("artist_id")
      .where("gallery_id IN ?",
        db.from("galleries").select("id").where("country = ?", "France")
      )
  )
// → WHERE id IN (
//     SELECT "artist_id" FROM "artworks"
//     WHERE "gallery_id" IN (
//       SELECT "id" FROM "galleries" WHERE country = $1
//     )
//   )
// With params: ["France"]
```

#### Parameter Merging

When subqueries have their own parameters, all parameters are collected and renumbered in the final SQL.

```typescript
db.from("artists")
  .where("country = ?", "UK")
  .where("id IN ?", db.from("artworks").select("artist_id").where("year > ?", 2000))
  .where("status = ?", "active")
// Final params: ["UK", 2000, "active"]
// All $N placeholders renumbered sequentially
```

### Implementation

- Parse SQL fragments to count `?` placeholders
- Type-level arity checking (compile error if wrong number of values)
- Convert to `$1`, `$2` style in final SQL
- Detect `QueryBuilder` values - build and inline as `(subquery SQL)`
- Merge parameters from subqueries with correct renumbering
- Handle nested subqueries recursively

### Test Cases

```typescript
// Positional arity
.where("a = ? AND b = ?", 1, 2)  // OK
.where("a = ? AND b = ?", 1)     // Compile error

// Subquery params merged
.where("x = ?", 1).where("y IN ?", db.from("t").where("z = ?", 2))
// Params: [1, 2], SQL has $1 and $2 in correct positions

// Nested subqueries
// Params collected depth-first, renumbered sequentially
```

---

## Milestone 4: Common Table Expressions (CTEs)

Support non-recursive CTEs using the WITH clause.

### API

```typescript
const activeArtists = db.from("artists").where("status = ?", "active");

db.with("active_artists", activeArtists)
  .from("active_artists")
  .where("age > ?", 30)
// → WITH "active_artists" AS (SELECT * FROM "artists" WHERE status = $1)
//   SELECT * FROM "active_artists" WHERE age > $2
// Params: ["active", 30]
```

### Multiple CTEs

Chain `.with()` calls to define multiple CTEs.

```typescript
db.with("active_artists", db.from("artists").where("status = ?", "active"))
  .with("recent_artworks", db.from("artworks").where("year > ?", 2020))
  .from("active_artists a")
  .join("recent_artworks r ON r.artist_id = a.id")
  .select("a.fullName", "r.title")
// → WITH "active_artists" AS (SELECT * FROM "artists" WHERE status = $1),
//        "recent_artworks" AS (SELECT * FROM "artworks" WHERE year > $2)
//   SELECT "a"."fullName", "r"."title"
//   FROM "active_artists" "a"
//   JOIN "recent_artworks" "r" ON "r"."artist_id" = "a"."id"
// Params: ["active", 2020]
```

### CTEs with Subqueries

CTEs can be combined with subqueries in the main query.

```typescript
db.with("top_galleries", db.from("galleries").where("rating > ?", 4))
  .from("artists")
  .where("gallery_id IN ?", db.from("top_galleries").select("id"))
// → WITH "top_galleries" AS (SELECT * FROM "galleries" WHERE rating > $1)
//   SELECT * FROM "artists"
//   WHERE "gallery_id" IN (SELECT "id" FROM "top_galleries")
// Params: [4]
```

### Implementation

- `.with(name, query)` adds a CTE definition to the builder
- CTEs are collected and prepended as `WITH name AS (...), ...` before the main SELECT
- Parameters from CTEs are merged with main query parameters
- CTE names follow the same identifier quoting rules

### Test Cases

```typescript
// Single CTE
db.with("cte", db.from("t").where("x = ?", 1)).from("cte")
// → WITH "cte" AS (SELECT * FROM "t" WHERE x = $1) SELECT * FROM "cte"

// Multiple CTEs
db.with("a", query1).with("b", query2).from("a").join("b ON ...")
// → WITH "a" AS (...), "b" AS (...) SELECT * FROM "a" JOIN "b" ON ...

// CTE referenced in subquery
db.with("cte", ...).from("t").where("x IN ?", db.from("cte").select("y"))
// CTE available to subquery
```

---

## Milestone 5: ExecutableStatement Integration

Make the builder work with existing database infrastructure.

### API

The query builder produces output compatible with `ExecutableStatement`, providing all familiar methods:

```typescript
const query = db.from("artists")
  .where("status = ?", "active")
  .orderBy("fullName");

// All ExecutableStatement methods work
const rows = await query.all();
const first = await query.first();
const maybeFirst = await query.firstOrNull();
const mustExist = await query.firstOrFail();
const notFoundHandled = await query.firstOrNotFound();
const count = await query.scalar();
const names = await query.select("fullName").column();
const result = await query.run();

// Route to named client
await query.on("replica").all();
```

### Methods

| Method | Description |
|--------|-------------|
| `.run()` | Execute and return `{rows, rowsAffected}` |
| `.all<T>()` | Return all rows |
| `.first<T>()` | Return first row, throw if none |
| `.firstOrNull<T>()` | Return first row or null |
| `.firstOrFail<T>()` | Return first row, throw QueryError if none |
| `.firstOrNotFound<T>()` | Return first row, call `abort.notFound()` if none |
| `.scalar<T>()` | Return first column of first row |
| `.column<T>()` | Return first column of each row |
| `.on(clientName)` | Route to named database client |

### Transaction Support

Works seamlessly with transactions:

```typescript
await db.transaction(async () => {
  const artist = await db.from("artists")
    .where("id = ?", 1)
    .forUpdate()
    .first();

  // Further operations in same transaction...
});
```

### Implementation

- Builder implements or produces `ExecutableStatement`
- Produces correct `Statement` with `fragments` and `params` properties
- Execution methods trigger the build step, then delegate to existing infrastructure
- Works within `db.transaction()` context via AsyncLocalStorage

### Test Cases

```typescript
// All execution methods work
await db.from("t").all()
await db.from("t").first()
await db.from("t").firstOrNull()
await db.from("t").scalar()
await db.from("t").column()

// Works with transactions
await db.transaction(async () => {
  await db.from("t").where("id = ?", 1).forUpdate().first();
});

// Named client routing
await db.from("t").on("replica").all();
```

---

## Milestone 6: Named Parameters and Type Extraction

Support `:name` placeholders with deferred binding and compile-time tracking.

### API

Parameters extracted from SQL at the type level. Must be bound before execution.

```typescript
const query = db.from("artists")
  .where("fullName = :name AND age > :minAge");
// Type: QueryBuilder<{ name: unknown; minAge: unknown }>

// Bind with .withParams() - removes from required type
const bound = query.withParams({ name: "Bernie" });
// Type: QueryBuilder<{ minAge: unknown }>

const ready = bound.withParams({ minAge: 30 });
// Type: QueryBuilder<{}> - now executable

await ready.all();
```

### Partial Binding

Bind parameters incrementally:

```typescript
const byCountry = db.from("artists").where("country = :country");
// Type: QueryBuilder<{ country: unknown }>

const ukArtists = byCountry.withParams({ country: "UK" });
// Type: QueryBuilder<{}> - executable

const frenchArtists = byCountry.withParams({ country: "France" });
// Type: QueryBuilder<{}> - executable
```

### Type-Level Parameter Extraction

Extract parameter names from SQL strings at compile time:

```typescript
type ExtractNamedParams<SQL extends string> = /* template literal type magic */

// Examples:
type P1 = ExtractNamedParams<"x = :foo">
// { foo: unknown }

type P2 = ExtractNamedParams<"x = :foo AND y = :bar">
// { foo: unknown; bar: unknown }

type P3 = ExtractNamedParams<"x = :foo AND y = :foo">
// { foo: unknown }  -- deduplicated

type P4 = ExtractNamedParams<"x = ':notAParam'">
// {}  -- inside string literal, not a param (stretch goal)
```

### Type Accumulation

The builder type accumulates required params:

```typescript
type QueryBuilder<TParams extends Record<string, unknown>>

// .where() adds to TParams:
.where("x = :foo")   // TParams & { foo: unknown }
.where("y = :bar")   // TParams & { foo: unknown; bar: unknown }

// .withParams() removes from TParams:
.withParams({ foo: 1 })  // { bar: unknown }
```

### Implementation

- Parse SQL to extract named parameter names (`:identifier` pattern)
- Type-level `ExtractNamedParams<SQL>` using template literal types
- Accumulate required params in builder type signature
- `.withParams()` method that binds values and removes from required type
- At build time, substitute `:name` with `$N` and slot values correctly
- Error if executed with unbound named parameters

### Test Cases

```typescript
// Named extraction
.where("x = :foo AND y = :bar")  // Requires { foo, bar }

// Partial binding
const q = db.from("t").where("x = :a AND y = :b");
q.withParams({ a: 1 })  // Type: { b: unknown }
q.withParams({ a: 1, b: 2 })  // Type: {}

// Duplicate params deduplicated
.where("x = :foo OR y = :foo")  // Requires { foo } (not { foo, foo })

// Execution requires all params bound
db.from("t").where("x = :foo").all()  // Compile error - foo not bound
db.from("t").where("x = :foo").withParams({ foo: 1 }).all()  // OK
```

---

## Milestone 7: Mixed Parameters

Allow `?` and `:name` in the same SQL fragment.

### API

Positional and named parameters can be mixed in the same call.

```typescript
.where("fullName = ? AND age > :minAge", "Bernie")
// "Bernie" bound to ?, :minAge tracked for later

.where("status = ? AND country = :country AND age > ?", "active", 30)
// Two positional values bound in order, :country deferred
```

### Execution

```typescript
const query = db.from("artists")
  .where("name = ? AND age > :minAge", "Bernie");
// Type: QueryBuilder<{ minAge: unknown }>

await query.withParams({ minAge: 30 }).all();
// Final SQL: WHERE name = $1 AND age > $2
// Final params: ["Bernie", 30]
```

### Implementation

- Parser handles both `?` and `:name` in single pass
- Positional values consumed in order from varargs
- Named values tracked separately for later binding
- Final SQL has unified `$1`, `$2` numbering
- Type system tracks only named params (positional are bound immediately)

### Test Cases

```typescript
// Mixed in same call
.where("a = ? AND b = :named", 1)  // Binds 1, requires { named }

// Multiple positional with named
.where("a = ? AND b = :x AND c = ?", 1, 2)  // Binds 1 and 2, requires { x }

// Order preserved in final SQL
.where("a = :x AND b = ?", 1).withParams({ x: "foo" })
// Params ordered by position in SQL: ["foo", 1]
```

---

## Milestone 8: Mutations (INSERT, UPDATE, DELETE)

Support data modification operations.

### General

All mutation methods return a `QueryBuilder` that must be executed (via `.run()`, `.all()`, etc.). Object keys are treated as column identifiers and follow the same quoting rules as SQL fragments.

### INSERT

```typescript
// Single row - fullName quoted, age not (same rules as SQL identifiers)
await db.from("artists").insert({ fullName: "New Artist", age: 25 }).run()

// Multiple rows
await db.from("artists").insert([
  { fullName: "Artist 1", age: 25 },
  { fullName: "Artist 2", age: 30 }
]).run()

// With RETURNING
const created = await db.from("artists")
  .insert({ fullName: "New Artist", age: 25 })
  .returning("id", "fullName")
  .first()

// INSERT ... SELECT
await db.from("artists_archive")
  .insertFrom(db.from("artists").select("*").where("status = ?", "inactive"))
  .run()
```

### UPDATE

```typescript
await db.from("artists")
  .where("id = ?", 1)
  .update({ age: 26, status: "active" })
  .run()

// With RETURNING
const updated = await db.from("artists")
  .where("id = ?", 1)
  .update({ age: 26 })
  .returning("*")
  .first()
```

### DELETE

```typescript
await db.from("artists")
  .where("status = ?", "deleted")
  .delete()
  .run()

// With RETURNING
const deleted = await db.from("artists")
  .where("id = ?", 1)
  .delete()
  .returning("id")
  .first()
```

### UPSERT (INSERT ... ON CONFLICT)

```typescript
await db.from("artists")
  .insert({ id: 1, fullName: "Artist", age: 25 })
  .onConflict("id")
  .doUpdate({ age: 25 })
  .run()

await db.from("artists")
  .insert({ id: 1, fullName: "Artist" })
  .onConflict("id")
  .doNothing()
  .run()
```

### Named Parameters in Mutations

```typescript
const updateAge = db.from("artists")
  .where("id = :id")
  .update({ age: ":newAge" });  // Or however we want to handle this

await updateAge.withParams({ id: 1, newAge: 26 }).run();
```

### Implementation

- `.insert(data)` generates INSERT with column list and VALUES
- `.update(data)` generates UPDATE SET with column = value pairs
- `.delete()` generates DELETE
- `.returning(...columns)` appends RETURNING clause
- `.onConflict(column).doUpdate(data)` / `.doNothing()` for upserts
- `.insertFrom(query)` for INSERT ... SELECT
- Object keys follow identifier quoting rules

### Test Cases

```typescript
// Object keys follow quoting rules
.insert({ fullName: "Bernie", age: 30 })
// → INSERT INTO ... ("fullName", age) VALUES ($1, $2)

// UPDATE requires WHERE (or explicit .all() to update all?)
.where("id = ?", 1).update({ age: 26 })
// → UPDATE ... SET age = $2 WHERE id = $1

// RETURNING works
.insert({...}).returning("id").first()
// Returns the inserted row

// Upsert
.insert({...}).onConflict("id").doUpdate({ age: 26 })
// → INSERT ... ON CONFLICT (id) DO UPDATE SET age = $N
```

---

## Milestone 9: Prepared Statements

Compile queries for repeated execution.

### API

```typescript
const findByName = await db.from("artists")
  .select("id", "fullName", "age")
  .where("fullName = :name")
  .prepare("find_artist_by_name");

// Execute efficiently (no re-parsing)
const bernie = await findByName.execute({ name: "Bernie" });
const alice = await findByName.execute({ name: "Alice" });

// Clean up when done
await findByName.deallocate();
```

### Auto-generated Names

```typescript
// Name can be omitted - auto-generated
const query = await db.from("artists")
  .where("status = :status")
  .prepare();

await query.execute({ status: "active" });
await query.deallocate();
```

### Implementation

- `.prepare(name?)` sends `PREPARE name AS ...` to database
- Returns a `PreparedStatement` wrapper with the statement name
- `.execute(params)` sends `EXECUTE name($1, $2, ...)` with bound params
- `.deallocate()` sends `DEALLOCATE name`
- Auto-generate unique names if not provided
- Type signature ensures all named params are provided to execute

### Test Cases

```typescript
// Prepare and execute
const stmt = await db.from("t").where("x = :x").prepare("my_stmt");
await stmt.execute({ x: 1 });
await stmt.deallocate();

// Auto-generated name
const stmt = await db.from("t").prepare();
// Name is auto-generated, stmt still works

// Type safety
const stmt = await db.from("t").where("x = :x AND y = :y").prepare();
stmt.execute({ x: 1 })  // Compile error - missing y
stmt.execute({ x: 1, y: 2 })  // OK
```
