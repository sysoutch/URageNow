# CSS Architect Pro

A professional-grade utility to refactor monolithic CSS into modular SCSS partials with built-in compilation support.

## 🚀 How to Use

1. **Analyze**: Paste your CSS and hit "Analyze CSS."
2. **Inspect**: Click through the **Scss Modules** list to see how your code was categorized.
3. **Compile**: Use the **Compiler Script** box to choose your environment (Node, Python, or Bash).
4. **Export**: Download the ZIP, extract it, and run the generated script.

## 🛠️ Compilation Guide

Once you have extracted your files:

### Using Node.js (Recommended)

1. Install Sass: `npm install -g sass`
2. Run the command from the "NPM" script option to generate your `styles.css`.

### Using Python

1. Install libsass: `pip install libsass`
2. Run the provided Python snippet to compile your `main.scss` into a production-ready CSS file.

## 📁 Logic Mapping

* **Base**: `html, body, *, audio, video`
* **Type**: `h1-h6, p, a, blockquote`
* **Layout**: `.container, .grid, .row, .col, .nav`
* **Components**: All other classes and IDs.