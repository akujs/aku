import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "child_process";
import { resolve } from "path";

const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;
let serverProcess: ChildProcess;

beforeAll(async () => {
  // Spawn the dev server on a custom port to avoid clashing
  console.log("Starting nextjs dev server...");
  const projectRoot = resolve(import.meta.dir, "..");
  serverProcess = spawn("bun", ["run", "dev"], {
    cwd: projectRoot,
    stdio: "pipe",
    env: { ...process.env, PORT: String(PORT) },
  });

  // Wait for the server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server failed to start within 30 seconds"));
    }, 30000);

    serverProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Ready in")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr?.on("data", () => {
      // Ignore stderr warnings from Next.js
    });

    serverProcess.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
});

afterAll(() => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
});

describe("Cookie API", () => {
  test("basic cookie flow: get empty, set, get, delete, get empty", async () => {
    // Get cookies - should be empty
    let response = await fetch(`${BASE_URL}/aku/api/cookies`);
    let data = await response.json();
    expect(data.cookies).toEqual({});

    // Set a cookie
    response = await fetch(`${BASE_URL}/aku/api/cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "testCookie", value: "testValue" }),
    });
    data = await response.json();
    expect(data.success).toBe(true);
    expect(data.cookie.name).toBe("testCookie");
    expect(data.cookie.value).toBe("testValue");

    // Verify cookie is set by sending it back
    response = await fetch(`${BASE_URL}/aku/api/cookies`, {
      headers: { Cookie: "testCookie=testValue" },
    });
    data = await response.json();
    expect(data.cookies.testCookie).toBe("testValue");

    // Delete the cookie
    response = await fetch(`${BASE_URL}/aku/api/cookies/testCookie`, {
      method: "DELETE",
    });
    data = await response.json();
    expect(data.success).toBe(true);
    expect(data.deleted).toBe("testCookie");

    // Verify cookie is deleted (no cookie header sent)
    response = await fetch(`${BASE_URL}/aku/api/cookies`);
    data = await response.json();
    expect(data.cookies).toEqual({});
  });

  test("cookie options are properly set in Set-Cookie headers", async () => {
    const expiresDate = new Date("2026-01-01T00:00:00.000Z");

    // Set multiple cookies with different options in one request
    const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "optionsCookie",
        value: "testValue",
        options: {
          path: "/aku",
          domain: "localhost",
          secure: true,
          httpOnly: true,
          maxAge: 3600,
          expires: expiresDate.toISOString(),
          sameSite: "lax",
        },
      }),
    });

    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();

    // Verify all options are present in the Set-Cookie header
    expect(setCookieHeader).toContain("optionsCookie=testValue");
    expect(setCookieHeader).toContain("Path=/aku");
    expect(setCookieHeader).toContain("Domain=localhost");
    expect(setCookieHeader).toContain("Secure");
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("Max-Age=3600");
    expect(setCookieHeader).toContain("SameSite=lax");
  });

  test("sameSite strict option", async () => {
    const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "strictCookie",
        value: "value",
        options: { sameSite: "strict" },
      }),
    });

    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("SameSite=strict");
  });

  test("sameSite none option with secure", async () => {
    const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "noneCookie",
        value: "value",
        options: { sameSite: "none", secure: true },
      }),
    });

    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("SameSite=none");
    expect(setCookieHeader).toContain("Secure");
  });

  test("partitioned option with secure", async () => {
    const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "partitionedCookie",
        value: "value",
        options: { partitioned: true, secure: true },
      }),
    });

    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("Partitioned");
    expect(setCookieHeader).toContain("Secure");
  });
});

describe("Param API", () => {
  test("param decoding works with URL-encoded slashes", async () => {
    const response = await fetch(`${BASE_URL}/aku/api/param/either%2For/test`);
    const data = await response.json();
    expect(data.param).toBe("either/or");
  });

  test("param decoding works with multiple encoded characters", async () => {
    const response = await fetch(`${BASE_URL}/aku/api/param/hello%20world%2Ftest/test`);
    const data = await response.json();
    expect(data.param).toBe("hello world/test");
  });

  test("param decoding works with special characters", async () => {
    const response = await fetch(
      `${BASE_URL}/aku/api/param/${encodeURIComponent("foo?bar&baz=qux")}/test`,
    );
    const data = await response.json();
    expect(data.param).toBe("foo?bar&baz=qux");
  });
});

describe("Storage API", () => {
  test("list endpoint returns seeded files with URLs", async () => {
    const response = await fetch(`${BASE_URL}/aku/api/storage`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.files).toBeInstanceOf(Array);
    // Should have seeded images
    expect(data.files.length).toBeGreaterThanOrEqual(4);

    const fileNames = data.files.map((f: { name: string }) => f.name);
    expect(fileNames).toContain("moon-1.jpg");
    expect(fileNames).toContain("moon-2.jpg");
    expect(fileNames).toContain("pigeon.jpg");
    expect(fileNames).toContain("rain.jpg");

    // Verify URLs are present and correct format
    const moonFile = data.files.find((f: { name: string }) => f.name === "moon-1.jpg");
    expect(moonFile.url).toBe("/storage/uploads/moon-1.jpg");
  });

  test("upload adds file to list, delete removes it", async () => {
    // Upload a new file
    const formData = new FormData();
    const blob = new Blob(["test content"], { type: "text/plain" });
    formData.append("file", blob, "test-list-file.txt");

    let response = await fetch(`${BASE_URL}/aku/api/storage`, {
      method: "POST",
      body: formData,
    });
    expect(response.status).toBe(200);

    // Verify it appears in the list
    response = await fetch(`${BASE_URL}/aku/api/storage`);
    let data = await response.json();
    let fileNames = data.files.map((f: { name: string }) => f.name);
    expect(fileNames).toContain("test-list-file.txt");

    // Delete the file
    response = await fetch(`${BASE_URL}/aku/api/storage/test-list-file.txt`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);

    // Verify it's removed from the list
    response = await fetch(`${BASE_URL}/aku/api/storage`);
    data = await response.json();
    fileNames = data.files.map((f: { name: string }) => f.name);
    expect(fileNames).not.toContain("test-list-file.txt");
  });

  test("complete file lifecycle: upload, download, delete, verify deleted", async () => {
    // Load the test image
    const imagePath = resolve(import.meta.dir, "../../../packages/website/public/img/bruno-logo-medium.png");
    const imageFile = Bun.file(imagePath);
    const originalBytes = await imageFile.arrayBuffer();
    const originalSize = imageFile.size;

    // 1. Upload the image
    const formData = new FormData();
    const blob = new Blob([originalBytes], { type: "image/png" });
    formData.append("file", blob, "bruno-logo-medium.png");

    let response = await fetch(`${BASE_URL}/aku/api/storage`, {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();
    if (response.status !== 200) {
      console.error("Upload failed:", response.status, responseText);
      throw new Error(`Upload failed with status ${response.status}: ${responseText}`);
    }

    let data = JSON.parse(responseText);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe("bruno-logo-medium.png");
    expect(data.mimeType).toBe("image/png");
    expect(data.size).toBe(originalSize);

    // 2. Download and verify content matches
    response = await fetch(`${BASE_URL}/aku/api/storage/bruno-logo-medium.png`);

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error("Download failed:", response.status, errorText.substring(0, 500));
    }

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");

    const downloadedBytes = await response.arrayBuffer();
    expect(new Uint8Array(downloadedBytes)).toEqual(new Uint8Array(originalBytes));

    // 3. Delete the file
    response = await fetch(`${BASE_URL}/aku/api/storage/bruno-logo-medium.png`, {
      method: "DELETE",
    });
    data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // 4. Verify file is deleted (should return 404)
    response = await fetch(`${BASE_URL}/aku/api/storage/bruno-logo-medium.png`);
    expect(response.status).toBe(404);
  });
});
