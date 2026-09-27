# data/okf: the demo organization's OKF bundle (P4 authors, P2 reviews retrieval quality)

This is the canonical knowledge for the live demo. Everything retrieval-related is derived from it and can be rebuilt with `POST /knowledge/reindex`.

- Start by copying `shared/fixtures/okf/` here, then grow it: more projects, people, Jira and Slack exports converted by `mosaic_knowledge.ingestion`, and a v2 security policy for the invalidation demo.
- Point the system at it with `MOSAIC_OKF_DIR=./data/okf`.
- **Do not edit `shared/fixtures/okf/` for the demo.** That bundle is frozen test data that everyone's contract tests depend on. Changing it is a contract change.

Conventions: one concept per file, a YAML frontmatter that validates as `OKFFrontmatter`, an `index.md` per directory for progressive disclosure, relative Markdown links between concepts, and `privacy:` set on anything sensitive.
