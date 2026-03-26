# Aku + Nitro Integration Test App

This test app verifies that Aku can run inside a Nitro server. The integration works by delegating requests from a Nitro catch-all route to Aku's request handler via `makeEventHandler` from `@akujs/aku/integrations/nitro`.

## Prerequisites

From the repo root, build the Aku package so the `dist/` output is available:

```sh
cd packages/aku
bun run build
```

Then install dependencies:

```sh
cd test-apps/aku-nitro-app
bun install
```

## Start the dev server

```sh
cd test-apps/aku-nitro-app
bun run dev
```

You should see output like:

```
  > Local:    http://localhost:3000/
  > Network:  use --host to expose

[nitro] Nitro Server built in ...ms
```

## Manual test plan

The following requests verify that the Aku integration is working correctly. Run them against the dev server (default `http://localhost:3000`).

### 1. Basic routing

Confirms that Aku receives and handles requests forwarded from Nitro's catch-all route.

```sh
curl http://localhost:3000/aku/hello
```

**Expected:** `Hello from Aku on Nitro!`

### 2. Read cookies from request

Confirms that the integration correctly reads cookies from the incoming request via `IntegrationContext.getCookie`.

```sh
curl http://localhost:3000/aku/api/cookies
```

**Expected:** `{"cookies":{}}`

```sh
curl -H "Cookie: foo=bar; baz=qux" http://localhost:3000/aku/api/cookies
```

**Expected:** `{"cookies":{"foo":"bar","baz":"qux"}}`

### 3. Set a cookie

Confirms that `IntegrationContext.setCookie` correctly sets `Set-Cookie` response headers via h3.

```sh
curl -v -X POST http://localhost:3000/aku/api/cookies \
  -H "Content-Type: application/json" \
  -d '{"name":"testCookie","value":"testValue"}'
```

**Expected:** Response body contains `{"success":true,"cookie":{"name":"testCookie","value":"testValue"}}` and response headers include `set-cookie: testCookie=testValue`.

### 4. Set a cookie with options

Confirms that cookie attributes (path, domain, secure, httpOnly, maxAge, sameSite) are mapped correctly from Aku's `CookieAttributes` to h3's `CookieSerializeOptions`.

```sh
curl -v -X POST http://localhost:3000/aku/api/cookies \
  -H "Content-Type: application/json" \
  -d '{"name":"optCookie","value":"val","options":{"path":"/aku","httpOnly":true,"secure":true,"maxAge":3600,"sameSite":"lax"}}'
```

**Expected:** The `set-cookie` response header should contain all of: `optCookie=val`, `Path=/aku`, `HttpOnly`, `Secure`, `Max-Age=3600`, `SameSite=Lax`.

### 5. Delete a cookie

Confirms that `IntegrationContext.deleteCookie` works via h3.

```sh
curl -v -X DELETE http://localhost:3000/aku/api/cookies/testCookie
```

**Expected:** Response body `{"success":true,"deleted":"testCookie"}` and response headers include a `set-cookie` header that expires the cookie.

### 6. URL parameter decoding

Confirms that Aku's route parameter extraction works correctly when requests are forwarded from Nitro. This tests that `toWebRequest` preserves the original URL encoding.

```sh
curl http://localhost:3000/aku/api/param/hello/test
```

**Expected:** `{"param":"hello"}`

```sh
curl http://localhost:3000/aku/api/param/either%2For/test
```

**Expected:** `{"param":"either/or"}` (the `%2F` is decoded by Aku's router)

```sh
curl "http://localhost:3000/aku/api/param/hello%20world%2Ftest/test"
```

**Expected:** `{"param":"hello world/test"}`

### 7. Non-Aku routes still work

Confirms that Nitro's own routes are not affected by the Aku catch-all.

```sh
curl http://localhost:3000/
```

**Expected:** Nitro's default index page (HTML with "brand new Nitro project")

```sh
curl http://localhost:3000/hello
```

**Expected:** Nitro's own hello route response

## What is being tested

Each test above maps to a specific part of the integration:

| Test | Integration concern |
|------|-------------------|
| Basic routing | `makeEventHandler` correctly calls `app.handleRequest` with the web `Request` from `toWebRequest` |
| Read cookies | `IntegrationContext.getCookie` and `getCookieNames` use h3's `parseCookies` correctly |
| Set cookie | `IntegrationContext.setCookie` calls h3's `setCookie` and the response headers are sent |
| Cookie options | `mapCookieOptions` correctly translates Aku's `CookieAttributes` to h3's format |
| Delete cookie | `IntegrationContext.deleteCookie` calls h3's `deleteCookie` |
| URL params | `toWebRequest` preserves the raw URL so Aku's router can decode params |
| Non-Aku routes | The catch-all at `server/routes/aku/[...path].ts` only intercepts `/aku/**` paths |

## Known limitations

- **Nitro auto-imports**: Nitro auto-imports globals like `defineEventHandler` in the `server/` directory. The `@akujs/aku/integrations/nitro` module uses explicit `import { ... } from "h3"` since it lives outside Nitro's `server/` scope.
- **`addKeepAliveTask` is null**: Nitro supports `waitUntil` in serverless/edge presets, but this is not yet wired up. For long-running server deployments this is a no-op anyway.
- **Storage**: This test app does not exercise Aku's storage integration. See `test-apps/nextjs/` for storage test examples.
