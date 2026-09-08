# Contributing to OpenCadence

Thank you for helping improve OpenCadence Community. Focused fixes and clear discussions are welcome.

## Before you start

- Use GitHub issues for reproducible bugs and focused feature proposals.
- Use GitHub Discussions for support and open-ended ideas when available.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
- Keep real client information, credentials, databases, backups, and generated configuration out of issues, tests, screenshots, and commits. Use fictional data.

Maintainers make final scope, design, and release decisions. A proposal may be declined when it adds maintenance cost or does not fit the current single-user Community workspace.

## Set up the repository

You need Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open <http://127.0.0.1:3000>. Runtime data under `data/` is ignored by Git.

## Make a change

- Keep each pull request focused on one coherent outcome.
- Preserve the documented localhost-only, single-user deployment boundary.
- Follow [BRAND_VOICE.md](BRAND_VOICE.md) for user-facing copy.
- Follow the repository instructions in [AGENTS.md](AGENTS.md), including the bundled Next.js documentation requirement.
- Add tests when they protect meaningful behaviour or a regression. Avoid tests that only repeat implementation details.
- Update documentation when setup, behaviour, privacy, or deployment expectations change.

Run the checks relevant to your change. Before requesting review, run the full suite when possible:

```bash
pnpm check
pnpm test:ui
```

Docker changes should also pass:

```bash
docker compose build
```

## Pull requests

Explain the user or maintainer problem, the chosen approach, validation performed, and any remaining risk. Reviewers may ask for a smaller change or a test at a more stable interface.

By contributing, you agree that your contribution is licensed under the repository’s [GNU Affero General Public License v3.0](LICENSE).

## Conduct

Be respectful, specific, and patient. Assume good intent, welcome different experience levels, and keep feedback about the work rather than the person. Harassment, discrimination, threats, and publication of private information are not accepted. Maintainers may edit or remove contributions and participation that do not meet these expectations.
