# setup-marimohub-cli

Install the `mohub` command in a GitHub Actions job.

```yaml
- uses: marimo-team/setup-marimohub-cli@15f7152034cdf6728c02be77d39526360ce60ec2 # v1.0.1
  with:
    version: "0.3.6"

- run: mohub --version
```

The action supports GitHub-hosted Linux x64 and arm64, macOS x64 and arm64, and Windows x64
runners. It downloads the standalone archive from the corresponding
[marimohub release](https://github.com/marimo-team/marimohub/releases), verifies its SHA-256
checksum, and adds the executable to `PATH`.

## Inputs

| Input          | Default               | Description                                       |
| -------------- | --------------------- | ------------------------------------------------- |
| `version`      | `latest`              | An exact `X.Y.Z` version, optional `v`, or latest |
| `github-token` | `${{ github.token }}` | Token used to resolve public GitHub releases      |

## Outputs

| Output          | Description                             |
| --------------- | --------------------------------------- |
| `mohub-version` | Installed version without a leading `v` |
| `mohub-path`    | Absolute path to the executable         |

Pin `version` in production so CLI upgrades are deliberate. Pin this action to the full commit
SHA shown on its release page for the strongest supply-chain protection; `@v1` is the convenient
major-version reference.

## Sync a git-backed notebook

The CLI reads the server and API token from the environment. Store the token as a GitHub Actions
secret, not as an action input.

```yaml
name: Sync marimohub notebook

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: marimohub-sync-${{ github.ref }}
  cancel-in-progress: true

jobs:
  sync:
    runs-on: ubuntu-latest
    env:
      MARIMOHUB_URL: ${{ vars.MARIMOHUB_URL }}
      MARIMOHUB_TOKEN: ${{ secrets.MARIMOHUB_TOKEN }}
      MARIMOHUB_NO_UPDATE_CHECK: "1"
      MARIMOHUB_PROJECT_ID: ${{ vars.MARIMOHUB_PROJECT_ID }}
      MARIMOHUB_NOTEBOOK_ID: ${{ vars.MARIMOHUB_NOTEBOOK_ID }}
    steps:
      - uses: marimo-team/setup-marimohub-cli@15f7152034cdf6728c02be77d39526360ce60ec2 # v1.0.1
        with:
          version: "0.3.6"

      - name: Sync notebook
        run: >-
          mohub notebooks source sync
          --pid "$MARIMOHUB_PROJECT_ID"
          --nid "$MARIMOHUB_NOTEBOOK_ID"
          --yes
```

The command asks marimohub to pull the configured branch through its server-side source-control
credential. The workflow does not need to check out the repository. Synchronizing an already
current notebook is a no-op.

For production, put the variables and secret in a protected GitHub Environment and attach that
environment to the job.

## Development

GitHub runs `dist/index.js` directly, so the bundled `dist/` directory is committed. After changing
the source or dependencies, run `npm run build` and include the resulting bundle in the same pull
request. CI rebuilds the action and rejects bundle drift.

## License

[Apache License 2.0](LICENSE)
