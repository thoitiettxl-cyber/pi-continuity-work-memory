# Changelog

## Unreleased

### Fixed

- Prevented automatic memory extraction from starting after an aborted assistant run.
- Ensured session replacement and shutdown cancel and await automatic and manual memory pipelines before closing SQLite stores, so canceled jobs become superseded instead of leaving stale leases.
