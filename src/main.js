import { EditorState } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  Decoration,
  WidgetType,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from "@codemirror/language";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

// ---------------------------------------------------------------------------
// Image Widget — renders a base64 (or any) image inline replacing the syntax
// ---------------------------------------------------------------------------
class ImageWidget extends WidgetType {
  constructor(src, alt) {
    super();
    this.src = src;
    this.alt = alt;
  }

  eq(other) {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-notebook-image-wrap";

    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.className = "cm-notebook-image";
    img.title = this.alt || "Embedded image";
    wrap.appendChild(img);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cell separator Widget — a thin coloured line drawn between notebook cells
// ---------------------------------------------------------------------------
class CellSeparatorWidget extends WidgetType {
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-cell-separator";
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  ignoreEvent() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// ViewPlugin — scans the document and builds decorations for:
//   1. Inline images  (![](...data:image/...))
//   2. Cell separator lines  (lines that start with "---")
// ---------------------------------------------------------------------------
const notebookDecorations = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

function buildDecorations(view) {
  const decorations = [];
  const doc = view.state.doc;

  // Iterate over visible lines for efficiency
  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    let offset = from;

    // ── Inline images ──────────────────────────────────────────────────────
    // Match ![alt text](data:image/...) anywhere in the visible range
    const imgRe = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
    let m;
    while ((m = imgRe.exec(text)) !== null) {
      const start = offset + m.index;
      const end = start + m[0].length;
      decorations.push(
        Decoration.replace({
          widget: new ImageWidget(m[2], m[1]),
          inclusive: false,
          block: false,
        }).range(start, end)
      );
    }

    // ── Cell separators ────────────────────────────────────────────────────
    // A line containing only "---" acts as a cell boundary marker.
    const sepRe = /^---$/gm;
    while ((m = sepRe.exec(text)) !== null) {
      const lineStart = offset + m.index;
      const lineEnd = lineStart + m[0].length;
      decorations.push(
        Decoration.replace({
          widget: new CellSeparatorWidget(),
          inclusive: true,
          block: false,
        }).range(lineStart, lineEnd)
      );
    }
  }

  // Decorations must be sorted by range start
  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations, true);
}

// ---------------------------------------------------------------------------
// Editor theme
// ---------------------------------------------------------------------------
const notebookTheme = EditorView.theme({
  "&": {
    minHeight: "400px",
    fontSize: "14px",
  },
  ".cm-content": {
    padding: "16px 16px 32px",
    caretColor: "#4a90d9",
    lineHeight: "1.7",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-line": {
    padding: "0 4px",
  },
  // Make fenced code blocks stand out with a subtle background
  ".cm-fenced-code": {
    background: "#f8f8f8",
  },
  ".tok-meta": {
    color: "#4a90d9",
    fontWeight: "bold",
  },
  // Gutter styling
  ".cm-gutters": {
    background: "#fafafa",
    borderRight: "1px solid #e8e8e8",
    color: "#aaa",
  },
});

// ---------------------------------------------------------------------------
// Default notebook content — demonstrates markdown + python + images
// ---------------------------------------------------------------------------
const DEFAULT_CONTENT = `# 📓 Jupyter in CodeMirror

Welcome to this **mixed-language parsing** demo!

This editor uses [CodeMirror 6](https://codemirror.net/) with its built-in
\`parseMixed\` support to highlight **Markdown** and **Python** in the same
document. Fenced code blocks tagged with \`\`\`python\`\`\` are parsed by the full
Python language grammar — just like a real Jupyter notebook.

---

## 🐍 Python Cell — Hello World

\`\`\`python
# A classic first program
def greet(name: str) -> str:
    """Return a personalised greeting."""
    return f"Hello, {name}!"

print(greet("World"))
\`\`\`

---

## 📊 Python Cell — Data Analysis

\`\`\`python
import statistics

data = [2, 4, 4, 4, 5, 5, 7, 9]

mean   = statistics.mean(data)
median = statistics.median(data)
stdev  = statistics.stdev(data)

print(f"Data:               {data}")
print(f"Mean:               {mean:.2f}")
print(f"Median:             {median}")
print(f"Standard deviation: {stdev:.2f}")
\`\`\`

---

## 🖼️ Image Cell — Base64 Encoded PNG

Inline images are rendered directly in the editor.  
The Markdown syntax \`![alt](data:image/...)\` is replaced with the actual image:

![A small colourful gradient](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACtNsBpAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAAFUSURBVFiF7ZZBCoMwEEX/MYtCF+5MoHsvIC49ioiHcOEBPEERFxUPIHiJ7lx0k4VxEXASSGJ1HgTyIMxkMvO+ST4BU1VVVVVVVTU9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8ATkuKcRL9y/QAAAAAElFTkSuQmCC)

---

## 🧠 Python Cell — Object-Oriented Example

\`\`\`python
from dataclasses import dataclass, field
from typing import List


@dataclass
class Notebook:
    title: str
    cells: List[str] = field(default_factory=list)

    def add_cell(self, source: str) -> None:
        self.cells.append(source)

    def cell_count(self) -> int:
        return len(self.cells)


nb = Notebook(title="My Notebook")
nb.add_cell("print('hello')")
nb.add_cell("x = 42")

print(f"Notebook: {nb.title!r}  |  cells: {nb.cell_count()}")
\`\`\`

---

## 📝 Markdown Cell — Formatting Showcase

Mixed-language parsing lets each section use its **own grammar**:

| Cell type | Language    | Feature                        |
|-----------|-------------|--------------------------------|
| Markdown  | Markdown    | Rich text, links, tables       |
| Code      | Python      | Full syntax highlighting       |
| Image     | (widget)    | Base64 PNG/JPEG rendered live  |

> **Try it!** Edit the Python code above — syntax highlighting updates instantly.

---

*Built with ❤️ using [CodeMirror 6](https://codemirror.net/) mixed-language parsing.*
`;

// ---------------------------------------------------------------------------
// Assemble the extensions
// ---------------------------------------------------------------------------
const extensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
  // ── Mixed-language parsing: Markdown as the base language, with Python
  //    (and any other @codemirror/language-data language) highlighted inside
  //    fenced code blocks.  This calls parseMixed() internally.
  markdown({
    base: markdownLanguage,
    codeLanguages: languages,
  }),
  notebookDecorations,
  notebookTheme,
];

// ---------------------------------------------------------------------------
// Create the editor
// ---------------------------------------------------------------------------
const view = new EditorView({
  state: EditorState.create({
    doc: DEFAULT_CONTENT,
    extensions,
  }),
  parent: document.getElementById("editor"),
});

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------
function insertAtEnd(text) {
  const doc = view.state.doc;
  const endPos = doc.length;
  // Find the last non-empty line so we can append after it
  const insertText = "\n" + text;
  view.dispatch({
    changes: { from: endPos, insert: insertText },
    selection: { anchor: endPos + insertText.length },
    scrollIntoView: true,
  });
  view.focus();
}

document.getElementById("btn-add-python").addEventListener("click", () => {
  insertAtEnd(
    "\n---\n\n## New Python Cell\n\n```python\n# Your code here\nprint('Hello!')\n```\n"
  );
});

document.getElementById("btn-add-markdown").addEventListener("click", () => {
  insertAtEnd(
    "\n---\n\n## New Markdown Cell\n\nWrite your **markdown** here.\n"
  );
});

document.getElementById("btn-add-image").addEventListener("click", () => {
  const placeholder =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  insertAtEnd(
    `\n---\n\n## New Image Cell\n\n![Image description](${placeholder})\n`
  );
});

document.getElementById("btn-reset").addEventListener("click", () => {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: DEFAULT_CONTENT },
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
  view.focus();
});
