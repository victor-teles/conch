# SEC-001 attack path

- Severity: **high**
- Policy decision: report and fix

## Path

1. The user exposes a DuckDB connection to agents (Settings → Agents), or
   imports a `.conch.json` bundle whose widget targets their DuckDB connection.
2. An agent's question (possibly injected from content the agent read) leads
   Conch's model to write `read_text('<file>')`, or the bundle's widget
   template contains it.
3. `assertReadOnly` passes it (no rule for table functions).
4. `DuckdbPool.execute` runs it inside `BEGIN TRANSACTION READ ONLY`, which only
   blocks database writes; DuckDB reads the file in the Conch process.
5. Rows flow back to the agent (`ask` → `structuredContent`) or into the
   widget card.

## Impact

Any file the user can read. `~/.config/conch/.key` plus `connections.json`
decrypt every stored database password, which breaks the Agents guarantee
"credentials never leave the bun process" and the per-connection exposure
model.

## Counterevidence

Same-user malware is out of scope, but the attacker here is an agent the user
deliberately limited to exposed connections, or a bundle from someone else.
Neither has the user's file access by design. Not dispositive.
