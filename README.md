# Zotero Auto-Tagger

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zotero](https://img.shields.io/badge/Zotero-7+-red.svg)](https://www.zotero.org/)
[![Version](https://img.shields.io/badge/version-0.2.1-blue.svg)](https://github.com/dnnunn/zotero-auto-tagger/releases)

Automatically generate keyword tags for your Zotero library items using AI and biomedical databases. Perfect for researchers who want to organize their references efficiently.

## ✨ Features

- **🧬 PubMed Integration**: Automatically fetches MeSH terms and author keywords for biomedical literature
- **🤖 Claude AI Fallback**: Intelligently generates tags for non-biomedical content (books, reports, theses, etc.)
- **📚 Universal Coverage**: Works with any item type in your Zotero library
- **⚡ Batch Processing**: Tag multiple items at once
- **💰 Cost Efficient**: Uses Claude 3 Haiku model for minimal API costs
- **🎯 Smart Prioritization**: Tries PubMed first for items with DOI/PMID, falls back to AI when needed

## 🚀 What's New in v0.2.1

- **Fixed Claude API Rate Limiting**: No more 429 errors when batch processing items
- **Automatic Request Throttling**: Implements 12-second delays between Claude API calls
- **Debug Logging**: See when rate limiting is active in debug output
- **Improved Reliability**: Smooth batch processing without interruptions

## 📋 Requirements

- Zotero 7 or higher
- Claude API key from [Anthropic](https://console.anthropic.com) (required for non-biomedical content)
- PubMed API key (optional, enhances biomedical queries)

## 🔧 Installation

1. Download the latest `.xpi` file: [zotero-auto-tagger-v0.2.1.xpi](https://github.com/dnnunn/zotero-auto-tagger/releases/download/v0.2.1/zotero-auto-tagger-v0.2.1.xpi)
2. In Zotero: Tools → Add-ons → Gear icon → Install Add-on From File
3. Select the downloaded `.xpi` file
4. Restart Zotero

## ⚙️ Configuration

### Setting API Keys

#### Via Config Editor (Recommended)
1. Edit → Settings → Advanced → Config Editor
2. Add your API keys:
   - `extensions.autoTagger.claudeApiKey`: Your Claude API key
   - `extensions.autoTagger.pubmedApiKey`: Your PubMed API key (optional)

#### Via JavaScript Console
```javascript
// Set Claude API key (required)
Services.prefs.setCharPref('extensions.autoTagger.claudeApiKey', 'sk-ant-YOUR_KEY_HERE');

// Set PubMed API key (optional)
Services.prefs.setCharPref('extensions.autoTagger.pubmedApiKey', 'YOUR_PUBMED_KEY');
```

## 📖 Usage

1. Select one or more items in your Zotero library
2. Right-click → "Auto-Tag Selected Items"
   
   OR
   
   Tools → "Auto-Tag Items"
3. The plugin will:
   - Check for DOI/PMID and try PubMed first
   - Fall back to Claude AI for items without PubMed data
   - Add generated tags to your items
   - Show a summary of results

## 🏗️ How It Works

### For Biomedical Content
- Searches PubMed using DOI or PMID
- Extracts MeSH terms and author-provided keywords
- Adds standardized medical subject headings

### For Everything Else
- Analyzes title, abstract, authors, and metadata
- Uses Claude AI to understand content and context
- Generates 5-10 relevant keyword tags
- Focuses on main topics, methodologies, and key concepts

## 💡 Examples

**Biomedical Article**: 
- Input: Article with DOI about cancer research
- Output: MeSH terms like "Neoplasms", "Cell Proliferation", "Apoptosis"

**Book Chapter**:
- Input: Chapter about machine learning in healthcare
- Output: AI-generated tags like "Machine Learning", "Healthcare Analytics", "Predictive Modeling"

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/dnnunn/zotero-auto-tagger.git
cd zotero-auto-tagger

# Install dependencies
npm install

# Build the plugin
npm run build

# Create .xpi file
cd build && zip -r ../zotero-auto-tagger.xpi * -x "*.DS_Store" && cd ..
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to the Zotero team for their excellent reference management software
- Anthropic for providing the Claude AI API
- The biomedical research community for standardized MeSH terms

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/dnnunn/zotero-auto-tagger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dnnunn/zotero-auto-tagger/discussions)

## 🗺️ Roadmap

- [ ] Support for additional AI models (GPT-4, local LLMs)
- [ ] Custom prompt templates
- [ ] Tag filtering and validation rules
- [ ] Bulk operations with progress bar
- [ ] Export tagging reports
- [ ] Integration with other metadata services

---

Made with ❤️ for the research community
