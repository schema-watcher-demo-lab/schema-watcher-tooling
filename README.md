# Crew Schema Watcher

Autonomous agent for detecting and reporting schema changes in PRs.

## Installation

```bash
bun add -g crew-schema-watcher
```

## Usage

### PR Mode

```bash
crew-schema-watcher --repo owner/name --pr 123 \
  --api-key your-api-key \
  --slack-webhook https://hooks.slack.com/...
```

### Options

- `-r, --repo <owner/name>` - Repository (required)
- `-p, --pr <number>` - PR number (required for PR mode)
- `--api-endpoint <url>` - Schema storage API endpoint
- `--api-key <key>` - API key for authentication
- `--slack-webhook <url>` - Slack webhook URL
- `--kafka-broker <address>` - Kafka broker address
- `--kafka-topic <topic>` - Kafka topic name
- `--dry-run` - Skip reporting, just output results
- `--init` - Initial full project scan (bootstrap)

## Supported Sources

- Prisma (`.prisma` files)
- dbt models (`models/*.yml`, `models/*.sql`)
- SQL migrations (`migrations/*.sql`, `db/migrations/*.sql`)
- Django models (`models.py`)
- TypeORM entities (`entities/*.ts`)

## GitHub Action

See `.github/workflows/schema-watcher.yml` for example usage.

### Local Action + Backend E2E

Use the canonical runbook at:

- `../docs/schema-watcher-local-action-and-schema-history.md`

## Development

```bash
bun install
bun test        # Run tests
bun run build   # Build CLI
```
