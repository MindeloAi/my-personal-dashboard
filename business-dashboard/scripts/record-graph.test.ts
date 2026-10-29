// Checks how records link to each other. No database.
//   bun scripts/record-graph.test.ts
import assert from "node:assert/strict";
import { linksFor, type Graph } from "../src/lib/record-graph";
import type { Client, Project, Invoice, Lead } from "../src/lib/db";

const g: Graph = {
  clients: [{ id: "c1", Name: "Acme" }] as Client[],
  leads: [
    { id: "l1", Name: "Ann", Status: "Won", Client: ["c1"] },
    { id: "l2", Name: "Bo", Status: "New" },
  ] as Lead[],
  projects: [
    { id: "p1", Name: "Site", Client: ["c1"], Lead: ["l1"] },
    { id: "p2", Name: "Pitch", Lead: ["l2"] }, // a lead's project, no client yet
  ] as Project[],
  invoices: [
    { id: "i1", "Invoice Number": "INV-0001", Status: "Paid", Amount: 1000, Project: ["p1"] },
    { id: "i2", "Invoice Number": "INV-0002", Status: "Sent", Amount: 500, "Paid So Far": 200, Client: ["c1"] },
    { id: "i3", "Invoice Number": "VOID-0001", Status: "Void", Amount: 300, Project: ["p1"] },
  ] as Invoice[],
};

const lead = linksFor("lead", "l1", g);
assert.equal(lead.client?.Name, "Acme");
assert.deepEqual(lead.projects.map((p) => p.id), ["p1"]);
assert.deepEqual(lead.invoices.map((i) => i.id), ["i1", "i2"], "void invoices are left out");
assert.equal(lead.paid, 1200, "paid invoice in full plus the payment so far");

const client = linksFor("client", "c1", g);
assert.equal(client.lead?.id, "l1", "the client came from this lead");
assert.equal(client.paid, 1200);

const project = linksFor("project", "p1", g);
assert.deepEqual([project.client?.id, project.lead?.id, project.invoices.length], ["c1", "l1", 1]);

const invoice = linksFor("invoice", "i2", g);
assert.deepEqual([invoice.client?.id, invoice.lead?.id, invoice.projects.length], ["c1", "l1", 0]);

const early = linksFor("lead", "l2", g);
assert.deepEqual([early.client, early.projects.map((p) => p.id)], [undefined, ["p2"]], "a lead's project shows before it has a client");

console.log("record-graph: all checks pass");
