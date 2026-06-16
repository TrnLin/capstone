import { describe, expect, it, vi } from "vitest"

import { ApiError, createBackendApiClient } from "./backend-api"

describe("createBackendApiClient", () => {
  it("sends bearer tokens on authenticated requests", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: "user-1", email: "me@example.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    const api = createBackendApiClient({
      baseUrl: "http://api.test",
      getToken: () => "session-token",
      fetchImpl,
    })

    await api.me()

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://api.test/api/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
      })
    )
  })

  it("surfaces backend detail text and clears invalid sessions on 401", async () => {
    const onUnauthorized = vi.fn()
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "Invalid or expired session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )
    const api = createBackendApiClient({
      baseUrl: "http://api.test",
      getToken: () => "bad-token",
      onUnauthorized,
      fetchImpl,
    })

    await expect(api.me()).rejects.toMatchObject({
      message: "Invalid or expired session",
      status: 401,
    })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
