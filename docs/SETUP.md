# Setting up and running the skeleton

**Start everything:**

   ```
   docker compose up --build
   ```

**Open:**

   | What | Address |
   | --- | --- |
   | Customer portal | http://app.localhost:3000 |
   | Staff portal | http://staff.localhost:3000 |
   | Emails sent by the app (Mailpit) | http://localhost:8025 |

   If your browser cannot open the `.localhost` addresses, add these two lines to your hosts file (`/etc/hosts` on macOS and Linux, `C:\Windows\System32\drivers\etc\hosts` on Windows):

   ```
   127.0.0.1 app.localhost
   127.0.0.1 staff.localhost
   ```

## Everyday commands

| Task | Command |
| --- | --- |
| Start | `docker compose up` |
| Stop | `docker compose down` |
| Wipe the database and start fresh | `docker compose down -v` then `docker compose up` |
| Create a migration | `docker compose run --rm app npm run migrate:create -- <name>` |
| Run migrations | `docker compose run --rm app npm run migrate` |
| Seed development data | `docker compose run --rm app npm run seed` |
| Run tests | `docker compose run --rm app npm test` |
| Open a database shell | `docker compose exec db psql -U garage garage` |

## After someone adds a dependency

The container keeps its own `node_modules`, so after pulling a change to `package.json`, rebuild:

```
docker compose up --build --renew-anon-volumes
```

## Notes

- **Everything is local only.** Every published port is bound to 127.0.0.1. Never change that, and never deploy this app.
- **`npm audit` reports moderate issues in `node-pg-migrate`'s dependencies.** It is a development tool that never runs in the app itself, so CI should run `npm audit --omit=dev`.
- **The app answers only on its two configured hosts.** Any other `Host` header gets 400. This is deliberate.
