# Releasing Conch

A release starts when you push a tag. The [Release workflow](.github/workflows/release.yml) builds the macOS app for Apple Silicon and Intel, publishes the installers and updates the feed that installed copies read.

## Channels

| Tag             | Channel | Who gets it                                                   |
| --------------- | ------- | ------------------------------------------------------------- |
| `v0.2.0`        | stable  | Everyone on a stable build, and Homebrew                      |
| `v0.2.0-beta.1` | beta    | People who installed a beta (the app is named "Conch-canary") |

A copy of Conch only updates within its own channel. To move a tester from beta to stable, they install the stable build.

## One-time setup

### Apple signing (required for stable)

A stable release refuses to build without these repository secrets. A beta builds without them, but macOS blocks it until the tester removes the quarantine flag, so add them before the first beta you send to anyone.

| Secret                       | What it is                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Your "Developer ID Application" certificate, exported as `.p12`, in base64 |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12`                             |
| `APPLE_SIGNING_IDENTITY`     | For example `Developer ID Application: Your Name (TEAMID)`                 |
| `APPLE_ID`                   | The Apple ID that owns the developer account                               |
| `APPLE_PASSWORD`             | An app-specific password for that Apple ID                                 |
| `APPLE_TEAM_ID`              | The 10-character team id                                                   |

To make the certificate value: `base64 -i DeveloperID.p12 | pbcopy`.

### Homebrew

`HOMEBREW_TAP_TOKEN` lets the workflow tell `victor-teles/homebrew-tap` about a stable release. The tap writes `Casks/conch.rb` itself.

## Cut a release

1. Make sure `main` is green.
2. Add the changes to [CHANGELOG.md](CHANGELOG.md) under the new version.
3. Tag and push:

   ```bash
   git tag v0.2.0-beta.1    # or v0.2.0 for stable
   git push origin v0.2.0-beta.1
   ```

4. Watch the workflow. When it ends, the release page has `Conch_<version>_arm64.dmg` and `Conch_<version>_x64.dmg`.
5. Edit the release notes on GitHub if the generated ones need it.

For a stable tag the workflow also commits the version into `apps/app/electrobun.config.ts` on `main` and updates the Homebrew cask.

## The update feed

Installed copies do not read the versioned releases. They read one rolling release tagged `updates`, which holds, for each channel and architecture, a manifest (`stable-macos-arm64-update-v2.json`), the app bundle it points to, and patches from the previous version. Each release replaces those files.

- Never delete the `updates` release: every installed copy would stop updating.
- The address is fixed in `apps/app/electrobun.config.ts` (`UPDATE_FEED_URL`) and is built into each copy. If it ever has to move, ship one last release at the old address first.

## Check a release

On a Mac that has the previous version installed:

1. Open Settings → About and press **Check Now**. It should offer the new version, then **Install and Restart**.
2. After the restart, About shows the new version.
3. Press the hotkey from another app. The launcher opens without asking for Accessibility.

On a clean Mac, download the `.dmg`, drag Conch to Applications and open it. macOS should open it without a warning; a warning means signing or notarization failed.

## Build locally

```bash
bun run --cwd apps/app desktop:build
```

This writes an unsigned stable build to `apps/app/artifacts`. It does not download the previous release or make patches; only CI does.
