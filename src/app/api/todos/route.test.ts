import { afterEach, beforeEach, expect, test } from "vitest";
import { makeTestDb, resetDb } from "../../../../test/db";
import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[id]/route";

beforeEach(async () => {
  await makeTestDb();
});
afterEach(() => resetDb());

function post(body: unknown): Request {
  return new Request("http://test/api/todos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST creates a todo, GET lists it", async () => {
  const created = await POST(post({ title: "buy milk", dueDate: "2026-07-26" }));
  expect(created.status).toBe(201);
  const { todo } = await created.json();
  expect(todo.title).toBe("buy milk");
  expect(todo.dueDate).toBe("2026-07-26");

  const list = await (await GET()).json();
  expect(list.todos.map((t: { title: string }) => t.title)).toEqual([
    "buy milk",
  ]);
});

test("POST with empty title is rejected", async () => {
  const res = await POST(post({ title: "   " }));
  expect(res.status).toBe(400);
});

test("PATCH status=done removes it from the open list", async () => {
  const { todo } = await (await POST(post({ title: "finish" }))).json();
  const patched = await PATCH(
    new Request("http://test", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    }),
    { params: Promise.resolve({ id: todo.id }) },
  );
  expect(patched.status).toBe(200);
  const list = await (await GET()).json();
  expect(list.todos).toHaveLength(0);
});

test("PATCH edits title and due date", async () => {
  const { todo } = await (await POST(post({ title: "old" }))).json();
  const res = await PATCH(
    new Request("http://test", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "new", dueDate: "2026-08-01" }),
    }),
    { params: Promise.resolve({ id: todo.id }) },
  );
  const body = await res.json();
  expect(body.todo.title).toBe("new");
  expect(body.todo.dueDate).toBe("2026-08-01");
});

test("DELETE removes the todo", async () => {
  const { todo } = await (await POST(post({ title: "gone" }))).json();
  const res = await DELETE(new Request("http://test"), {
    params: Promise.resolve({ id: todo.id }),
  });
  expect(res.status).toBe(200);
  expect((await (await GET()).json()).todos).toHaveLength(0);
});
