import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../../server/createApp";

const { app } = createApp();
const agent = request(app);

const NEW_CAT = { name: "Testkategorie", type: "expense", color: "#437a22" };

// The DB is seeded with 14 default categories at startup.
// Tests only validate behaviour for categories they create — no assumption on total count.

describe("GET /api/categories", () => {
  it("returns an array", async () => {
    const res = await agent.get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("includes the seeded default categories", async () => {
    const res = await agent.get("/api/categories");
    const names = res.body.map((c: any) => c.name);
    expect(names).toContain("Gehalt");
    expect(names).toContain("Lebensmittel");
  });
});

describe("POST /api/categories", () => {
  it("creates a new category and returns 201", async () => {
    const res = await agent.post("/api/categories").send(NEW_CAT);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Testkategorie");
    expect(res.body.type).toBe("expense");
    expect(res.body.id).toBeTypeOf("number");
  });

  it("rejects an invalid color format", async () => {
    const res = await agent.post("/api/categories").send({ ...NEW_CAT, color: "not-a-color" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown type", async () => {
    const res = await agent.post("/api/categories").send({ ...NEW_CAT, type: "other" });
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await agent.post("/api/categories").send({ type: "income", color: "#437a22" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/categories/:id", () => {
  let createdId: number;

  beforeEach(async () => {
    const res = await agent.post("/api/categories").send(NEW_CAT);
    createdId = res.body.id;
  });

  it("updates name and color", async () => {
    const res = await agent
      .put(`/api/categories/${createdId}`)
      .send({ name: "Aktualisiert", type: "income", color: "#4f98a3" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Aktualisiert");
    expect(res.body.type).toBe("income");
  });

  it("returns 404 for a non-existent id", async () => {
    const res = await agent
      .put("/api/categories/99999")
      .send(NEW_CAT);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await agent.put("/api/categories/abc").send(NEW_CAT);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("deletes a created category", async () => {
    const create = await agent.post("/api/categories").send(NEW_CAT);
    const id = create.body.id;

    const del = await agent.delete(`/api/categories/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // Verify it no longer appears in the list
    const list = await agent.get("/api/categories");
    const ids = list.body.map((c: any) => c.id);
    expect(ids).not.toContain(id);
  });
});
