# jupyter-in-codemirror

A demo site that uses [CodeMirror 6](https://codemirror.net/)'s **mixed-language parsing** support to implement a simple Jupyter-notebook-like experience in the browser.

🔗 **Live demo**: [https://acbart.github.io/jupyter-in-codemirror/](https://acbart.github.io/jupyter-in-codemirror/)

## Features

- 📝 **Markdown cells** — full Markdown syntax highlighting (headings, bold, links, tables, etc.)
- 🐍 **Python cells** — full Python syntax highlighting inside fenced ` ```python ``` ` code blocks
- 🖼️ **Inline images** — `![alt](data:image/...)` base64-encoded images are rendered directly in the editor
- ➕ **Toolbar** — buttons to insert Python, Markdown, or image cells at the end of the notebook
- 🔄 **Reset** — restore the default sample content

## How it works

The editor is a single [CodeMirror 6](https://codemirror.net/) instance configured with:

```js
markdown({
  base: markdownLanguage,
  codeLanguages: languages,   // triggers parseMixed() internally
})
```

The `codeLanguages` option enables CodeMirror's **mixed-language parsing** (`parseMixed` from `@lezer/common`).  Fenced code blocks whose fence identifier matches a known language (e.g. ` ```python`) are automatically parsed with that language's full grammar, providing accurate syntax highlighting.

A custom `ViewPlugin` scans the visible range and replaces `![alt](data:image/...)` Markdown image syntax with actual `<img>` elements rendered as editor widgets.

Cell boundaries are marked with `---` lines, which the same `ViewPlugin` replaces with a thin colour-bar widget.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # build for production
npm run preview  # preview the production build
```

## Deployment

The site is deployed automatically to GitHub Pages via the [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) workflow whenever commits are pushed to `main`.
