<div align="center">
  <a href="https://opencadence.app">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-horizontal-white.svg">
      <img src="public/brand/logo-horizontal-primary.svg" alt="OpenCadence" width="520">
    </picture>
  </a>

  <p><strong>Your freelance work, in one calm workspace under your control.</strong></p>
  <p>
    <a href="https://opencadence.app">Website</a> ·
    <a href="docs/SELF_HOSTING.md">Self-hosting guide</a> ·
    <a href="docs/MCP.md">AI assistant setup</a>
  </p>
</div>

## What is OpenCadence?

OpenCadence is an open-source workspace for freelancers and independent professionals. It brings your clients, leads, projects, tasks, follow-ups, and notes together so you always know what needs your attention next.

Instead of piecing your work together across a CRM, task manager, and notes app, OpenCadence gives you one focused place to manage the full journey from a new lead to completed work and the next opportunity.

OpenCadence Community runs on your own computer. There is no account to create, your workspace remains under your control, and the app continues to work without a cloud service.

## Everything you need to keep work moving

- **Start each day with clarity:** see tasks due today or overdue, follow-ups, active projects, and recent notes in one Today view.
- **Stay on top of client relationships:** organise leads and clients, track conversations, and remember when to follow up.
- **Move projects forward:** group tasks and notes around each project and see progress at a glance.
- **Capture the details:** keep useful notes connected to the right client or project.
- **Find anything quickly:** search across your clients, projects, tasks, and notes.
- **Work with an AI assistant:** optionally connect an MCP-compatible assistant to help manage the same workspace.
- **Keep control of your data:** your Community workspace is stored on the computer running OpenCadence and can be backed up whenever you choose.

## Who is it for?

OpenCadence is made for people who manage client work themselves: freelancers, consultants, creatives, developers, and other independent professionals. It is especially useful if you want the structure of a lightweight CRM and project manager without the overhead of a large business platform.

The current Community edition is a **single-user workspace**. It does not yet include team accounts, cloud sync, invoicing, time tracking, file uploads, recurring tasks, or calendar and email integrations. Logging outreach records what happened; it does not send an email.

## Get started

OpenCadence can be run with Docker or directly with Node.js. Both options keep the app available only on your computer by default.

### Run with Docker

You will need Docker Engine with the Compose plugin.

```bash
git clone https://github.com/OpenCadence/opencadence.git opencadence
cd opencadence
docker compose up --build -d
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000), then choose whether to explore a fictional example workspace or begin with an empty one.

For backups, upgrades, restoring data, or changing the port, read the **[self-hosting guide](docs/SELF_HOSTING.md)**.

### Run with Node.js

You will need Node.js 22.13 or newer.

```bash
git clone https://github.com/OpenCadence/opencadence.git opencadence
cd opencadence
pnpm install
pnpm dev
```

Open the local address shown in your terminal, normally [http://127.0.0.1:3000](http://127.0.0.1:3000).

For a long-running source installation, build and run the production server:

```bash
pnpm build
pnpm start
```

Keep the process supervised and back up the database before upgrades. See the [source installation guidance](docs/SELF_HOSTING.md#run-from-source) for production, restore, and upgrade steps.

> [!IMPORTANT]
> OpenCadence Community does not currently include a login or multi-user access controls. Keep it on a trusted computer and do not expose it directly to a local network or the public internet. See the [self-hosting guide](docs/SELF_HOSTING.md) before setting up remote access.

## Connect an AI assistant

OpenCadence includes an optional local MCP connection. This allows a compatible AI assistant to help create and update tasks, manage projects and client relationships, plan follow-ups, log outreach, and search notes.

```bash
pnpm --silent mcp:config
```

The connection is optional, works with the same local workspace, and does not require the OpenCadence web app to be running. What your chosen assistant does with shared information depends on that assistant and its model provider. Read the **[MCP setup and privacy guide](docs/MCP.md)** before connecting one.

## Your data

Your workspace is stored in a SQLite database on the computer running OpenCadence. Node.js installations use `data/cadence.sqlite`; Docker installations keep it in a persistent Docker volume. OpenCadence creates the database automatically on first launch.

Create a backup at any time with:

```bash
pnpm backup
```

Backups contain your client information and notes, so store them somewhere private. OpenCadence updates older databases automatically, but you should always make a backup before upgrading. Docker users should follow the dedicated [backup and restore instructions](docs/SELF_HOSTING.md#back-up).

## Community and Cloud

**OpenCadence Community** is the complete local application in this repository. Core workspace features are not intentionally withheld to force a hosted subscription. You are free to run, inspect, modify, and share it under the [GNU Affero General Public License v3.0](LICENSE).

**OpenCadence Cloud** is planned for people who would rather have hosting and connected services managed for them. Future paid services may include hosting, sync, collaboration, integrations, delivery services, and support. They do not change your right to use the Community edition.

Learn more at **[opencadence.app](https://opencadence.app)**.

## Development

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, test, review, and conduct expectations. Please report security issues privately using [SECURITY.md](SECURITY.md).

```bash
pnpm check
pnpm test:ui
```

Tests use temporary workspaces and do not touch your local OpenCadence data.

---

Copyright © 2026 OpenCadence.
