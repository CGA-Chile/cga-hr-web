# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual
label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label
string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

All five labels exist in the repository. `wontfix` is GitHub's own default; the other four were
created when this file was written. A label that is named here but missing from the tracker makes
`gh issue edit --add-label` fail, so the two have to be kept in step.

## What is not triaged here

`/triage` is for issues nobody on this project wrote — incoming bug reports and feature requests.
Tickets produced by `/to-tickets` are already agent-ready and skip triage entirely.
