# Knowledge-Graph-Pro

Knowledge-Graph-Pro is a multi-source relationship intelligence app that unifies activity from your team stack into one graph.

It supports live OAuth-based connectors, a combined relationship graph, source-based filtering, and a dedicated integrations workspace for setup and reconnection.

## What it does

- Builds one combined graph from connected apps
- Lets you filter by one or more selected sources
- Surfaces relationship insights from people, issues, docs, messages, meetings, and design activity
- Provides a preview mode with sample data
- Persists integration auth sessions across restarts

## Supported integrations

- Slack
- Jira
- Confluence
- Google Workspace
- Gmail / Calendar
- Notion
- Zoom
- Trello
- GitHub
- Linear
- Figma

## Tech stack

- Node.js (ES modules) backend
- Vanilla JS frontend
- OAuth connectors per provider
- Persistent integration state in local `.data` storage

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Fill credentials for the providers you want to connect.
4. Register redirect URIs in each provider console exactly as configured in `.env`.
5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Integration flow

1. Open **Integrations** tab.
2. Select an integration card.
3. Save credentials/config.
4. Click connect and complete OAuth.
5. Return to graph and refresh connected sources.

Connected sources remain available after restart, and each source shows reconnect options.

## Data and session persistence

- Integration state is stored in `.data/integration-state.json`
- Session cookie (`sid`) is persistent for browser restart continuity
- Demo graph data is available at `public/data/demo-graph.json`

## Local development notes

- App origin and redirect URIs are controlled via `.env`
- `PORT` defaults to `3000`
- TLS can be enabled with `TLS_PFX_PATH` and `TLS_PFX_PASSPHRASE`
- If TLS is not valid, app can still run over HTTP depending on local config

## Project structure

- `server.js` - app bootstrap and server startup
- `src/server/` - auth handlers, connector clients, graph merge utilities
- `public/` - UI, graph rendering, integrations dashboard, styles
- `.data/` - local persisted runtime state

## Roadmap ideas

- Robust token refresh and rotation per provider
- Connector-level health checks and diagnostics
- Scheduled graph refresh jobs
- Team-level analytics and trend snapshots
