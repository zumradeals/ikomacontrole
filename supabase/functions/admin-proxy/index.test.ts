/**
 * Contractual Test: GET /playbooks via admin-proxy
 * 
 * Validates that the admin-proxy Edge Function returns:
 * - Response format: { items: [...] }
 * - Each item contains required fields: key, version, title, description, visibility, actions, schema
 * 
 * Run with: deno test --allow-net --allow-env supabase/functions/admin-proxy/index.test.ts
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Required fields per PlaybookItem contract
const REQUIRED_PLAYBOOK_FIELDS = ['key', 'version', 'title', 'description', 'visibility', 'actions', 'schema'] as const;

Deno.test("GET /playbooks returns { items: [...] } with contractual fields", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      method: 'GET',
      path: '/playbooks',
    }),
  });

  assertEquals(response.status, 200, `Expected 200, got ${response.status}`);
  
  const data = await response.json();
  
  // Verify response structure: must have { items: [...] }
  assertExists(data.items, "Response must contain 'items' array");
  assert(Array.isArray(data.items), "'items' must be an array");
  
  console.log(`✅ Response has { items: [...] } with ${data.items.length} playbooks`);
  
  // Verify each playbook has required contractual fields
  for (const playbook of data.items) {
    for (const field of REQUIRED_PLAYBOOK_FIELDS) {
      assertExists(
        playbook[field], 
        `Playbook '${playbook.key || 'unknown'}' missing required field: ${field}`
      );
    }
    
    // Type validations
    assertEquals(typeof playbook.key, 'string', 'key must be string');
    assertEquals(typeof playbook.version, 'string', 'version must be string');
    assertEquals(typeof playbook.title, 'string', 'title must be string');
    assertEquals(typeof playbook.description, 'string', 'description must be string');
    assert(
      playbook.visibility === 'public' || playbook.visibility === 'internal',
      `visibility must be 'public' or 'internal', got: ${playbook.visibility}`
    );
    assert(Array.isArray(playbook.actions), 'actions must be array');
    assertEquals(typeof playbook.schema, 'object', 'schema must be object');
  }
  
  console.log(`✅ All ${data.items.length} playbooks have required contractual fields`);
});

Deno.test("GET /playbooks never returns indexed object format {0:…,1:…}", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      method: 'GET',
      path: '/playbooks',
    }),
  });

  const data = await response.json();
  await response.text().catch(() => {}); // Ensure body consumed
  
  // Check that root level does NOT have numeric indexed keys (legacy format)
  const numericKeys = Object.keys(data).filter(key => !isNaN(Number(key)));
  
  assertEquals(
    numericKeys.length, 
    0, 
    `Response should not have indexed keys. Found: ${numericKeys.join(', ')}`
  );
  
  console.log('✅ Response does not contain legacy indexed object format');
});

Deno.test("Playbook schema has valid structure", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      method: 'GET',
      path: '/playbooks',
    }),
  });

  const data = await response.json();
  
  for (const playbook of data.items) {
    // schema must have type, properties (even if empty)
    assertExists(playbook.schema.type, `Playbook '${playbook.key}' schema missing 'type'`);
    assertEquals(playbook.schema.type, 'object', 'schema.type must be "object"');
    assertExists(playbook.schema.properties, `Playbook '${playbook.key}' schema missing 'properties'`);
  }
  
  console.log(`✅ All ${data.items.length} playbooks have valid schema structure`);
});
