# Zotero Auto-Tagger

A Zotero plugin that automatically generates and adds relevant tags to your references using PubMed keywords and AI-powered analysis.

## Features

- 🏷️ **Automatic Tag Generation**: Generate tags using PubMed keywords and AI analysis
- 🤖 **Multiple Sources**: Support for PubMed MeSH terms and Claude AI
- 📚 **Bulk Processing**: Tag entire collections or libraries at once
- ⚡ **Smart Caching**: Cache results to minimize API calls
- 🌐 **Multi-language Support**: Available in English and Chinese
- 🎨 **Native Zotero Integration**: Seamlessly integrates with Zotero 7

## Installation

1. Download the latest `.xpi` file from the [Releases](https://github.com/dnnunn/zotero-auto-tagger/releases) page
2. Open Zotero 7
3. Go to Tools → Add-ons
4. Click the gear icon and select "Install Add-on From File..."
5. Select the downloaded `.xpi` file

## Usage

### Tag Selected Items
1. Select one or more items in your library
2. Right-click and choose "Auto-Tag Items"
3. The plugin will generate and add relevant tags

### Tag Collection
1. Right-click on a collection
2. Choose "Auto-Tag Collection"
3. All items in the collection will be processed

### Tag Entire Library
1. Go to Tools → Auto-Tag Library
2. Or use the keyboard shortcut: `Ctrl/Cmd + Alt + T`

## Configuration

Access preferences through Tools → Add-ons → Auto-Tagger → Preferences

- **Tag Sources**: Choose between PubMed, Claude AI, or both
- **Max Tags**: Maximum number of tags per item (default: 10)
- **API Keys**: Configure Claude API key if using AI tagging
- **Cache Duration**: How long to cache results (default: 30 days)

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup instructions.

## License

AGPL-3.0 - see [LICENSE](LICENSE) for details.
