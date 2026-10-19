## Mail rules
- Email templates store tenant-scoped content and ordered blocks in the database; shared domain resolution selects treatment before category before base, and authenticated saves validate configured options to keep preview and delivery rules consistent.
- Mail artwork uses tenant-private storage with server-sniffed uploads and UUID paths in template blocks; signed preview URLs expire after ten minutes to avoid persisting temporary access links.
- Mail HTML is produced by one escaped table-based domain renderer, shared with a script-disabled preview; its palette comes from global mail tokens, ordered leading blocks share the introduction surface, and online/clinic copy uses configured conditional blocks so preview and future delivery cannot diverge.
- Mail moments render server-side via `src/data/mailer.server.ts` into `mail_outbox` with the shared renderer; only allowlist-setting addresses are marked for real delivery, so demo data never reaches patients.

- Mail management uses phase/moment option rows and the shared list pattern, with one reusable sent-mail list; treatment resolution and preview reuse the existing domain rules and renderer.
