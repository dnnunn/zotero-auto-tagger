# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.1] - 2026-09-18

### Fixed
- The plugin stopped loading on Zotero 10. `strict_max_version` was pinned to `9.0.*`, which
  Zotero's version comparator reads as matching only `9.0.x` builds — not `9.1+` and not `10.x` at
  all. Raised to `10.*` in both `src/manifest.json` and `update.json`.

- `scripts/release.js` produced an unloadable plugin and was the cause of the release-versus-code
  version drift. It hardcoded `0.1.0` in the XPI name; it archived `build/` rather than
  `build/addon/`, so `manifest.json` landed one directory below the archive root and any
  previously-built XPI in `build/xpi/` was bundled into the new one; and it "waited" for the build
  with a 2-second sleep, because `require`-ing `build.js` returns nothing to await.

  It now cleans, then delegates to `build.js` and `package.js`, which already read the version from
  `package.json` and write the correct layout. Verified to produce an archive whose contents are
  identical to the published v0.7.0 XPI.

### Added
- `npm run release` as the entry point for a full clean-build-package run.


## [0.7.0] - 2026-08-13

### Added
- **Controlled study-characteristic facets**, emitted alongside the free-text topical tags as
  `key:value` pairs:
  - `design:` in-vitro · organoid · ex-vivo · animal-invivo · human-trial · observational ·
    review · meta-analysis
  - `exposure:` supplementation · deprivation · knockout · association · none
  - `lifestage:` neonatal · infant · juvenile · adult · aged · mixed
  - `testarticle:` bovine · human · recombinant · milk-derived · peptide · synthetic · not-stated

  Free-text topical tags cannot express the things that decide whether a paper actually supports
  a claim. A knockout-deprivation study reads as supporting evidence from its abstract but shows
  that *removing* a substance changes the outcome, not that adding it helps; `exposure:`
  separates the two. `lifestage:` separates neonatal-model evidence from the adult claims it
  gets cited for.

- Facet values are **validated against the vocabulary in code**, not merely requested in the
  prompt. A local 8B model will occasionally invent a value, and a hallucinated facet is worse
  than a missing one because it looks like signal downstream. Out-of-vocabulary values are
  dropped with a debug line.

### Fixed
- `normaliseTag` could not distinguish a short SHOUTED word from an acronym, so any all-caps word
  of six letters or fewer was preserved as-is: `GENE EXPRESSION` normalised to `GENE expression`
  and still fragmented against `Gene expression` across items. A multi-word tag in which *every*
  word is all-caps is now treated as shouting. Tokens under four letters or containing digits stay
  protected, so `ELISA`, `PCR`, `NEC`, `mRNA`, `CD44`, `IL-6` and `NF KB` are unaffected while
  `GENE EXPRESSION` and `BONE MINERAL DENSITY` normalise correctly.

### Notes
- Facets bypass `normaliseTag` entirely — sentence-casing `exposure:knockout` into
  `Exposure:knockout` would have re-introduced the case fragmentation 0.6.0 removed.
- Facets have their own de-duplication and do not consume the 10-tag topical budget.
- Section headers the model may emit despite the prompt (`FIRST:`, `THEN:`) are now filtered.


## [0.6.0] - 2026-08-13

### Fixed
- Tag case is normalised to a canonical form, with acronyms preserved, so the vocabulary stops
  fragmenting. A 3,159-item run had produced 15,196 distinct tags that collapsed to 12,801 on
  lowercasing alone, with 1,936 concepts split across case variants — `OSTEOPONTIN` /
  `Osteopontin` / `osteopontin` appearing as three separate tags across 2,615 items.


## [0.5.0] - 2026-08-10

### Added
- Live progress window with a cancel control.
- Run position is persisted, so an interrupted run resumes where it stopped.


## [0.4.1] - 2026-08-10

### Fixed
- `retagExisting` now replaces prior LLM tags instead of accumulating them.


## [0.4.0] - 2026-08-10

### Changed
- PubMed and the local LLM now run on every item rather than the LLM acting as a fallback.
- Runs are resumable.


## [0.3.0] - 2026-08-10

### Changed - BREAKING
- Tagging is now **local via Ollama**. The Claude/Anthropic API integration has been removed entirely.
- No API key is required. Nothing is sent to a third party.
- LLM-generated tags are namespaced with a configurable prefix (default `ai: `) and stored as
  automatic tags, so they no longer merge into the PubMed MeSH vocabulary.

### Added
- `extensions.autoTagger.ollamaUrl` (default `http://localhost:11434`)
- `extensions.autoTagger.ollamaModel` (default `qwen3:8b`)
- `extensions.autoTagger.aiTagPrefix` (default `ai: `)
- Reasoning-model support: `<think>` blocks are stripped before tags are parsed.

### Removed
- Anthropic API client, key storage, and the 12-second request throttle it required.
- ~2,300 lines of duplicated dead code across three parallel module trees.
  Packaged extension: 17 files -> 9.

### Migration
- Previously stored `claudeApiKey`, `claudeModel`, and `claudeMinGapMs` preferences are
  cleared automatically on first run.


## [0.2.0] - 2025-05-26

### Added
- Claude AI integration for non-biomedical content tagging
- Support for all Zotero item types (books, reports, theses, etc.)
- Professional icon in multiple sizes (16px, 32px, 48px, 96px)
- Comprehensive error handling and user feedback
- Debug logging for troubleshooting
- update.json for automatic updates

### Changed
- Switched from `Zotero.Prefs.get()` to `Services.prefs.getCharPref()` for reliability
- Replaced browser `alert()` with Zotero's native dialog system
- Updated manifest.json to include update_url for Zotero 7 compatibility
- Improved API key validation

### Fixed
- "alert is not defined" error in Zotero 7 environment
- Preference reading issues
- Manifest validation errors

## [0.1.0] - 2025-05-26

### Added
- Initial release
- PubMed API integration
- MeSH term extraction
- Author keyword extraction
- Batch processing support
- Menu integration (Tools menu and right-click context menu)
- Rate limiting for API calls

### Technical
- Support for Zotero 7+
- Modular architecture with separate API classes
- Transaction-based database updates

[0.2.0]: https://github.com/dnnunn/zotero-auto-tagger/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dnnunn/zotero-auto-tagger/releases/tag/v0.1.0