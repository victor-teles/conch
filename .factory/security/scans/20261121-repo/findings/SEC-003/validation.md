# SEC-003 validation

- Disposition: not_applicable
- Method: code search. `openExternal` has no caller in `src/mainview`, and no
  renderer sink turns data into markup (see SEC-004), so no attacker source
  reaches it.
- Note: if a caller is added, restrict it to `https:` there.
