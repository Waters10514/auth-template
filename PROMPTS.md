# Claude Code Prompts — Quick Reference

Copy and paste the relevant prompt into Claude Code at the start of your session.

---

## New project (no auth yet)

```
Implement the Waters 2FA auth system in this project.
Follow the instructions at:
https://raw.githubusercontent.com/Waters10514/auth-template/main/CLAUDE_SETUP.md
```

---

## Existing project (migrating from another auth system)

```
Migrate this project to the Waters 2FA auth system.
Follow the instructions at:
https://raw.githubusercontent.com/Waters10514/auth-template/main/CLAUDE_MIGRATE.md
```

---

## Existing project (already on Waters 2FA — apply latest upstream patches)

```
Apply the latest Waters 2FA auth patches to this project.
Follow the instructions at:
https://raw.githubusercontent.com/Waters10514/auth-template/main/CLAUDE_PATCH.md
```

Each patch in that file is idempotent — if a project is already up to date
on a given patch, Claude will skip it.

---

That's it. Claude Code will take it from there —
it reads the project name itself and asks you for the rest.
