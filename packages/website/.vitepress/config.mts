import type { Plugin } from "vite";
import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
const config = defineConfig({
  title: "Aku",

  description: "The missing batteries for your favourite framework",

  // Ignore localhost URLs in dead link checker
  ignoreDeadLinks: [
    // Ignore all localhost links these are docs about the dev server
    /^https?:\/\/localhost(:\d+)?/,
  ],

  vite: {
    server: {
      fs: {
        strict: false,
      },
    },
    resolve: {
      alias: {
        "/api": "/api/index.html",
      },
    },
    build: {
      chunkSizeWarningLimit: 1000, // Increase from 500KB to 1MB
    },

    plugins: [serveApiIndex()],
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    siteTitle: "Aku", // This replaces "VitePress" in the top left

    outline: {
      level: [2, 3], // This will show h2 and h3 headings
    },

    search: {
      provider: "local",
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "Documentation", link: "/docs/" },
      { text: "API Reference", link: "/api/", target: "_self" },
      { text: "Blog", link: "/blog/" },
      { text: "Progress", link: "/docs/progress" },
    ],

    sidebar: {
      "/docs/": [
        {
          text: "Prologue",
          collapsed: true,
          items: [
            { text: "Contribution Guide", link: "/docs/contributions" },
            { text: "Port Progress", link: "/docs/progress" },
          ],
        },
        {
          text: "Getting Started",
          collapsed: true,
          items: [
            { text: "Installation", link: "/docs/installation" },
            { text: "Configuration", link: "/docs/configuration" },
            { text: "Directory Structure", link: "/docs/structure" },
            { text: "Frontend", link: "/docs/frontend" },
            { text: "Starter Kits", link: "/docs/starter-kits" },
            { text: "Deployment", link: "/docs/deployment" },
          ],
        },
        {
          text: "Architecture Concepts",
          collapsed: true,
          items: [
            { text: "Request Lifecycle", link: "/docs/lifecycle" },
            { text: "Service Container", link: "/docs/container" },
            { text: "Service Providers", link: "/docs/providers" },
            { text: "Facades", link: "/docs/facades" },
          ],
        },
        {
          text: "The Basics",
          collapsed: true,
          items: [
            { text: "Routing", link: "/docs/routing" },
            { text: "Middleware", link: "/docs/middleware" },
            { text: "CSRF Protection", link: "/docs/csrf" },
            { text: "Controllers", link: "/docs/controllers" },
            { text: "Requests", link: "/docs/requests" },
            { text: "Responses", link: "/docs/responses" },
            { text: "Views", link: "/docs/views" },
            { text: "Blade Templates", link: "/docs/blade" },
            { text: "Asset Bundling", link: "/docs/vite" },
            { text: "URL Generation", link: "/docs/urls" },
            { text: "Session", link: "/docs/session" },
            { text: "Validation", link: "/docs/validation" },
            { text: "Error Handling", link: "/docs/errors" },
            { text: "Logging", link: "/docs/logging" },
          ],
        },
        {
          text: "Digging Deeper",
          collapsed: true,
          items: [
            { text: "Artisan Console", link: "/docs/artisan" },
            { text: "Broadcasting", link: "/docs/broadcasting" },
            { text: "Cache", link: "/docs/cache" },
            { text: "Collections", link: "/docs/collections" },
            { text: "Context", link: "/docs/context" },
            { text: "Contracts", link: "/docs/contracts" },
            { text: "Events", link: "/docs/events" },
            { text: "File Storage", link: "/docs/filesystem" },
            { text: "Helpers", link: "/docs/helpers" },
            { text: "Localization", link: "/docs/localization" },
            { text: "Mail", link: "/docs/mail" },
            { text: "Notifications", link: "/docs/notifications" },
            { text: "Package Development", link: "/docs/packages" },
            { text: "Queues", link: "/docs/queues" },
            { text: "Rate Limiting", link: "/docs/rate-limiting" },
            { text: "Strings", link: "/docs/strings" },
            { text: "Task Scheduling", link: "/docs/scheduling" },
          ],
        },
        {
          text: "Security",
          collapsed: true,
          items: [
            { text: "Authentication", link: "/docs/authentication" },
            { text: "Authorization", link: "/docs/authorization" },
            { text: "Email Verification", link: "/docs/verification" },
            { text: "Encryption", link: "/docs/encryption" },
            { text: "Hashing", link: "/docs/hashing" },
            { text: "Password Reset", link: "/docs/passwords" },
          ],
        },
        {
          text: "Database",
          collapsed: true,
          items: [
            { text: "Getting Started", link: "/docs/database" },
            { text: "Query Builder", link: "/docs/queries" },
            { text: "Pagination", link: "/docs/pagination" },
            { text: "Migrations", link: "/docs/migrations" },
            { text: "Seeding", link: "/docs/seeding" },
            { text: "Redis", link: "/docs/redis" },
          ],
        },
        {
          text: "Eloquent ORM",
          collapsed: true,
          items: [
            { text: "Getting Started", link: "/docs/eloquent" },
            { text: "Relationships", link: "/docs/eloquent-relationships" },
            { text: "Collections", link: "/docs/eloquent-collections" },
            { text: "Mutators / Casts", link: "/docs/eloquent-mutators" },
            { text: "API Resources", link: "/docs/eloquent-resources" },
            { text: "Serialization", link: "/docs/eloquent-serialization" },
            { text: "Factories", link: "/docs/eloquent-factories" },
          ],
        },
        {
          text: "Testing",
          collapsed: true,
          items: [
            { text: "Getting Started", link: "/docs/testing" },
            { text: "HTTP Tests", link: "/docs/http-tests" },
            { text: "Console Tests", link: "/docs/console-tests" },
            { text: "Database", link: "/docs/database-testing" },
            { text: "Mocking", link: "/docs/mocking" },
          ],
        },
        {
          text: "Packages",
          collapsed: true,
          items: [
            { text: "Cashier (Paddle)", link: "/docs/cashier-paddle" },
            { text: "Fortify", link: "/docs/fortify" },
            { text: "Prompts", link: "/docs/prompts" },
            { text: "Reverb", link: "/docs/reverb" },
            { text: "Sail", link: "/docs/sail" },
            { text: "Scout", link: "/docs/scout" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/akujs/aku" }],
  },
});

// Custom plugin to serve index.html for /api directory
function serveApiIndex(): Plugin {
  return {
    name: "serve-api-index",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // Specifically handle /api and /api/ URLs
        if (req.url === "/api" || req.url === "/api/") {
          req.url = "/api/index.html";
        }
        next();
      });
    },
  };
}

export default config;
