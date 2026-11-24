# What can the Knock CLI manage from the repo?

Research for [#29](https://github.com/krab-spyrosoft/cohort-005-project-fork-001/issues/29). Sources are the Knock docs (docs.knock.app) and the source of `@knocklabs/cli` v1.6.3 ([knocklabs/knock-cli](https://github.com/knocklabs/knock-cli)), read on 2026-11-24. Claims marked **(inference)** are my reading, not something a source states.

## Answer in brief

- **Config as code:** workflows (including their email templates and `categories`), email layouts, partials and translations. You can pull, validate, push, commit and promote all of them from the repo.
- **Management API only, not versioned:** the environment default preference set. A write goes live immediately, and nothing commits or promotes it.
- **Dashboard only:** channels and their per-environment settings (provider, credentials, sandbox mode, overrides, conditions), service tokens, members, API keys and the "Modify resources in any environment" setting.
- **The Knock test (Dev) vs Resend (Prod) split cannot be config-as-code with one channel step.** A workflow step names one `channel_key`, and that key is promoted unchanged across environments. See [Per-environment channels](#per-environment-channels).

## Resources the CLI can manage

Every resource below has `pull`, `push`, `validate`, `list`, `get` and `new` commands, and `knock commit --resource-type` accepts it ([README](https://github.com/knocklabs/knock-cli/blob/v1.6.3/README.md)).

| Cadence asset | CLI resource | Versioned (commit and promote) |
| --- | --- | --- |
| 7 workflows | `knock workflow …` | Yes |
| 5 email templates | Part of each workflow's email step (extracted into files next to `workflow.json`) | Yes, with the workflow |
| One preference category per workflow | The `categories: string[]` field on the workflow ([types.ts](https://github.com/knocklabs/knock-cli/blob/v1.6.3/src/lib/marshal/workflow/types.ts)) | Yes, with the workflow |
| Shared email layout | `knock layout …` (`email_layout`) | Yes |
| Partials (none yet) | `knock partial …` | Yes |
| Translations (none yet) | `knock translation …` | Yes |
| Default preference set | Not in the CLI. Use `PUT /v1/environments/{environment_slug}/defaults` ([MAPI](https://docs.knock.app/mapi-reference/environments/defaults/update)) | **No.** The docs say it "isn't committed or promoted" and "takes effect immediately in the target environment, including production" ([custom preference center](https://docs.knock.app/preferences/custom-preference-center)) |
| Channels and their environment settings | `knock channel list` is read-only. The Management API has only `GET /v1/channels` and `GET /v1/channels/{key}` ([MAPI channels](https://docs.knock.app/mapi-reference/channels)) | No. Settings are per environment, managed in the dashboard |

The CLI also covers message types, guides, audiences, goals, reusable requests, variables, broadcasts and schemas, which Cadence does not use. Categories are not a resource of their own: a category exists because a workflow lists it, and the defaults set refers to it by name ([preferences overview](https://docs.knock.app/preferences/overview)).

## Directory layout

`knock init` writes a `knock.json` whose `knockDir` (for example `.knock`) is the root. The CLI finds `knock.json` by walking up from the working directory ([CLI overview](https://docs.knock.app/cli/overview)). `knock pull` and `knock push` use one subdirectory per resource type ([resources.ts](https://github.com/knocklabs/knock-cli/blob/v1.6.3/src/lib/resources.ts)):

```text
knock.json                      # { "knockDir": ".knock" }
.knock/
  workflows/<workflow-key>/workflow.json     # steps, channel_key, categories
  workflows/<workflow-key>/<step>/…          # extracted templates (e.g. visual_blocks.json, html)
  layouts/<layout-key>/layout.json           # plus extracted html/text layout files
  partials/<partial-key>/partial.json        # plus extracted content
  translations/<locale>/<locale>.json        # or <namespace>.<locale>.json
```

Each JSON file points at a schema (`https://schemas.knock.app/cli/workflow.json` and similar) for editor validation.

## Commit and promote

- Versioned content moves through environments. You edit and commit in Development, then promote upward. Each environment has its own data, API keys, variables, channel settings and preference-center config ([environments](https://docs.knock.app/version-control/environments)).
- `knock push` (or `knock <resource> push`) upserts the resource into an environment, which is the default environment when `--environment` is omitted. `--commit -m "…"` commits the push in the same step. `knock commit` commits pending changes on its own, optionally filtered with `--resource-type` and `--resource-id` ([README](https://github.com/knocklabs/knock-cli/blob/v1.6.3/README.md)).
- `knock commit promote --to=production` promotes all committed changes from the environment just below production. `--only <commit-id>` promotes a single commit ([README](https://github.com/knocklabs/knock-cli/blob/v1.6.3/README.md), [CI/CD guide](https://docs.knock.app/developer-tools/integrating-into-cicd)).
- `knock push` pushes resource types one after another. If one fails, the environment is left partly pushed, because no bulk endpoint exists ([push.ts](https://github.com/knocklabs/knock-cli/blob/v1.6.3/src/commands/push.ts)).
- By default, members can also edit directly in Production. Disabling "Modify resources in any environment" makes Production read-only, so content must be promoted. This is an account setting in the dashboard ([environments](https://docs.knock.app/version-control/environments)).

## Per-environment channels

- A channel exists in every environment with the same key, but "you'll need to configure each channel per environment": provider settings, overrides and conditions ([channels](https://docs.knock.app/concepts/channels), [integrations](https://docs.knock.app/integrations/overview)). None of this is pushable. The Management API only reads it, and secrets come back obfuscated.
- A workflow channel step stores one `channel_key` in `workflow.json` ([types.ts](https://github.com/knocklabs/knock-cli/blob/v1.6.3/src/lib/marshal/workflow/types.ts)), and promotion carries that key to Production unchanged.
- The Knock test email channel is built in, enabled in every environment, can send only to account members, has a 100 emails/month limit and is "not intended for production". Knock's migration path is to "change the channel on each of your existing email steps", then commit and promote ([Knock test channel](https://docs.knock.app/integrations/email/knock-test)).
- **(inference)** So "Knock test in Dev, Resend in Prod" cannot come from one versioned step. The workable options are:
  1. **Point the steps at the Resend channel in both environments, with different per-environment settings (recommended).** Dev gets its own Resend key, or sandbox mode, or a `To` override, all set in the dashboard. This keeps `workflow.json` identical across environments.
  2. Keep two email steps, one per channel, gated by step or channel conditions per environment. This is more complex and easy to get wrong.
  3. Edit the steps in Production only. This breaks promotion, so avoid it.

## CI: validate, push, commit, promote

- **Auth:** a service token (`knock_st_…`). Only an account owner or admin can create one, under Settings > Service tokens. It inherits its creator's privileges, so it has full Management API, CLI and MCP access, with no finer scopes. It is shown only once and cannot call the public Knock API ([service tokens](https://docs.knock.app/developer-tools/service-tokens)). The CLI reads it from `--service-token`, then the `KNOCK_SERVICE_TOKEN` env var, then the user config ([base-command.ts](https://github.com/knocklabs/knock-cli/blob/v1.6.3/src/lib/base-command.ts)). Store it as a CI secret.
- **Validate:** there are only per-resource commands, such as `knock workflow validate --all` and `knock layout validate --all`, and no top-level `knock validate`. Validation runs on the server (`PUT /workflows/{key}/validate`, [api-v1.ts](https://github.com/knocklabs/knock-cli/blob/v1.6.3/src/lib/api-v1.ts)), so it needs network access and the token.
- **Knock's documented flow** ([CI/CD guide](https://docs.knock.app/developer-tools/integrating-into-cicd)):
  - On a feature-branch push: `knock branch switch <branch> --create --force` and `knock push --branch=<branch> --knock-dir=.knock --commit`.
  - On PR merge: `knock branch merge <branch> --force` into Development.
  - On release: `knock commit promote --to=production`.
  - The guide has no validate step, so add one on PRs.
- **Simpler flow without Knock branches:** validate on PR, run `knock push --commit -m "$SHA"` to Development on merge, and run `knock commit promote --to=production` on release. A Cadence `npm` script can wrap these commands. The CLI needs Node.js 24 or later ([README](https://github.com/knocklabs/knock-cli/blob/v1.6.3/README.md)). The CI guide says Node.js 20.19 or later, so pin the CLI version.
- **Default preference set:** CI could `PUT` it from a JSON file in the repo to each environment. Each write goes live immediately, so that file is the only source of truth; no Knock commit records it.

## Must stay dashboard-only

- Channels: creating them, picking the provider, credentials, sandbox mode, overrides and conditions for each environment. Copy them between environments with "Copy from…".
- Service tokens, environment API keys, members and roles, and enabling environments.
- The "Modify resources in any environment" setting.
- Hosted preference-center config for each environment. It is per environment and not versioned, and I did not check whether an API exists for it.
- Variable values can be set with `knock variable set`, but values are per environment and never promoted.
