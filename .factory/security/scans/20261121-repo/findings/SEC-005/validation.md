# SEC-005 validation

- Disposition: not_applicable (availability only)
- Method: code trace. Concurrent handshakes can each pass the
  `sessions.size >= maxClients` check before any is accepted. Reaching it needs
  the per-install token, which only a trusted client or same-user software
  holds; each client still has its own call limits.
