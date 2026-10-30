import { describe, expect, it } from "vitest";

import { GatewayPort, gatewayUrl } from "../../src";

describe("GatewayPort", () => {
  it.each([1024, 7465, 65535])("accepts %i", (port) => {
    expect(GatewayPort.safeParse(port).success).toBe(true);
  });

  it.each([80, 70000, 7465.5, Number.NaN])("rejects %s with one message", (port) => {
    expect(GatewayPort.safeParse(port).error?.issues[0].message).toBe("Use a port from 1024 to 65535");
  });
});

it("builds the gateway URL on the loopback address", () => {
  expect(gatewayUrl(7465)).toBe("http://127.0.0.1:7465/mcp");
});
