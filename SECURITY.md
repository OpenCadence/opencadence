# Security policy

## Supported versions

Security fixes are applied to the latest published OpenCadence Community release and to `main`. Older releases may no longer receive fixes. Until the project publishes release tags, treat `main` as development code and review changes before upgrading.

## Report a vulnerability privately

Please do not open a public issue for a suspected vulnerability. Use the repository’s **Security** tab to open a private GitHub Security Advisory and select **Report a vulnerability**. Include:

- the affected version or commit;
- the deployment setup;
- steps to reproduce the issue;
- the possible impact; and
- any suggested mitigation, if known.

A maintainer will aim to acknowledge a report within seven days, keep you informed while it is assessed, and coordinate disclosure after a fix or mitigation is available. Please avoid accessing other people’s data, disrupting deployments, or publishing details before that coordination is complete.

## Deployment boundary

OpenCadence Community does not include authentication, authorization, TLS termination, tenant isolation, or rate limiting. Its supported default is one user, one process, and localhost-only access. A report that depends only on directly exposing the application to a LAN or the public internet may be treated as outside the supported deployment model, but reports showing that the documented localhost boundary can be bypassed are in scope.

Connected AI assistants can receive data selected through the local MCP connection. Provider handling outside OpenCadence is not covered by this policy.
