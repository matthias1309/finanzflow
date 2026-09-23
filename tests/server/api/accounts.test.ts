import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../../server/createApp";
import type { Account } from "../../../shared/schema";

const { app } = createApp();
const agent = request(app);

const NEW_ACC = { name: "Test Girokonto", bank: "ING", color: "#01696f", type: "checking", iban: null };

describe("GET /api/accounts", () => {
  it("returns an empty array on a fresh DB", async () => {
    const res = await agent.get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/accounts", () => {
  // TC-002-01
  it("creates an account and returns 201", async () => {
    const res = await agent.post("/api/accounts").send(NEW_ACC);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Girokonto");
    expect(res.body.bank).toBe("ING");
    expect(res.body.id).toBeTypeOf("number");
  });

  it("accepts a valid IBAN", async () => {
    const res = await agent
      .post("/api/accounts")
      .send({ ...NEW_ACC, iban: "DE89370400440532013000" });
    expect(res.status).toBe(201);
    expect(res.body.iban).toBe("DE89370400440532013000");
  });

  // TC-002-06
  it("rejects an invalid color", async () => {
    const res = await agent.post("/api/accounts").send({ ...NEW_ACC, color: "red" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing name", async () => {
    const res = await agent.post("/api/accounts").send({ bank: "ING", color: "#01696f", type: "checking" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid account type", async () => {
    const res = await agent.post("/api/accounts").send({ ...NEW_ACC, type: "magic" });
    expect(res.status).toBe(400);
  });

  // TC-002-02
  it("rejects an invalid IBAN", async () => {
    const res = await agent.post("/api/accounts").send({ ...NEW_ACC, iban: "not-an-iban" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/accounts/:id", () => {
  let id: number;

  beforeEach(async () => {
    const res = await agent.post("/api/accounts").send(NEW_ACC);
    id = res.body.id;
  });

  // TC-002-03
  it("updates account name", async () => {
    const res = await agent
      .put(`/api/accounts/${id}`)
      .send({ ...NEW_ACC, name: "Neuer Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Neuer Name");
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent.put("/api/accounts/99999").send(NEW_ACC);
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await agent.put("/api/accounts/abc").send(NEW_ACC);
    expect(res.status).toBe(400);
  });

  // TC-002-04
  it("clears an existing IBAN when updated with iban: null", async () => {
    await agent.put(`/api/accounts/${id}`).send({ ...NEW_ACC, iban: "DE89370400440532013000" });
    const res = await agent.put(`/api/accounts/${id}`).send({ ...NEW_ACC, iban: null });
    expect(res.status).toBe(200);
    expect(res.body.iban).toBeNull();
  });
});

describe("DELETE /api/accounts/:id", () => {
  // TC-002-05
  it("deletes the account", async () => {
    const create = await agent.post("/api/accounts").send(NEW_ACC);
    const id = create.body.id;

    const del = await agent.delete(`/api/accounts/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const list = await agent.get("/api/accounts");
    const ids = (list.body as Account[]).map(a => a.id);
    expect(ids).not.toContain(id);
  });
});
