import { expect, test } from "vitest";

import { configServer, SECRET } from "../../src";

test("maps a command entry to a local server, turning values into text", () => {
  expect(configServer({ command: "npx", args: ["-y", "pkg", 3], env: { PORT: 8080 } })).toEqual({
    type: "stdio",
    command: "npx",
    args: ["-y", "pkg", "3"],
    env: { PORT: "8080" }
  });
  expect(configServer({ type: "stdio", command: "uvx" })).toEqual({ type: "stdio", command: "uvx", args: [], env: {} });
});

test("maps a URL entry to a remote server, reading Codex's http_headers too", () => {
  expect(configServer({ type: "http", url: "https://x.dev/mcp", headers: { A: "b" } })).toEqual({
    type: "http",
    url: "https://x.dev/mcp",
    headers: { A: "b" }
  });
  expect(configServer({ url: "https://x.dev/mcp", http_headers: { Authorization: "Bearer t" } })).toEqual({
    type: "http",
    url: "https://x.dev/mcp",
    headers: { Authorization: "Bearer t" }
  });
});

test("reads nothing from an entry without a command or URL", () => {
  for (const config of [{}, { command: 1 }, { args: ["x"] }, "npx", null]) expect(configServer(config)).toBeNull();
});

test("flags secret-looking names", () => {
  for (const name of ["API_KEY", "GITHUB_PERSONAL_ACCESS_TOKEN", "Authorization", "DB_PASSWORD", "client_secret"])
    expect(SECRET.test(name)).toBe(true);
  for (const name of ["PATH", "MEMORY_FILE_PATH", "LOG_LEVEL", "X-Region"]) expect(SECRET.test(name)).toBe(false);
});
