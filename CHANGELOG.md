# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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