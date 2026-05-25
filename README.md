# HomeTruth Backend

Node/Express backend for HomeTruth.

## Tickets

Tickets live in the standalone repo at `../HomeTruth-tickets`.

Reference ticket IDs in branch names, commit messages, pull requests, and implementation notes. Do not add a ticket checkout or submodule inside this repo.

All codebase changes must start from a ticket and include an implementation log
in that ticket. See `../HomeTruth-tickets/README.md` for the shared ways of
working.

## Database Migrations

The backend uses MySQL through Sequelize. Schema changes must be made through
explicit migration files, not by silently changing models and relying on runtime
sync.

Domain schema changes must follow the property + people spine contract in
`docs/property-people-spine-schema.md` and reference the relevant ticket in
`../HomeTruth-tickets`. For HomeTruth domain expansion, default to additive
migrations, preserve compatibility windows, keep uncertain concepts in
facts/evidence first, and avoid destructive changes without a ticketed
deprecation path.

Local database settings are read from `.env`; staging settings are read from
`.env_staging` when `APP_ENV=staging` is set. The required DB keys are:

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=hometruth
DB_USER=root
DB_PASSWORD=...
```

Use these commands from `HomeTruth_BE-staging`:

```bash
npm run db:migrate:status
npm run db:migrate
npm run db:migration:create -- add-home-records
npm run db:migrate:undo
```

For staging, run:

```bash
npm run db:migrate:staging
```

`models/index.js` no longer auto-syncs schemas by default. If a developer needs
the old prototyping behavior for a disposable local database, they must opt in
explicitly:

```bash
AUTO_SYNC_DB=true npm run dev
```

Do not use `AUTO_SYNC_DB=true` for shared, staging, or production databases.

When adding or changing a model:

1. Create a migration with `npm run db:migration:create -- descriptive-name`.
2. Put the table/column/index change in the migration.
3. Update the Sequelize model to match the migration.
4. Run `npm run db:migrate`.
5. Record the migration and verification in the relevant ticket.
