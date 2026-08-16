# Base64 Converter

A browser-based Base64 encoder and decoder with **Data URL support, image previews, binary detection, file conversion, and downloads**.

The entire application runs client-side. No backend, API, account, or external library is required.

---

## Features

### Base64 Encoding

* Text → Base64
* File → Base64
* UTF-8 support
* Emoji and non-Latin characters
* Raw Base64 output
* Data URL output

Example:

```text
Hello World
```

becomes:

```text
SGVsbG8gV29ybGQ=
```

### Base64 Decoding

* Base64 → text
* Base64 → binary data
* Base64 → image
* Base64 → downloadable file
* Unpadded Base64 support
* Standard Base64 support
* Base64URL support (`-` and `_`)
* Whitespace inside Base64 is ignored

### Data URL Support

The converter automatically recognizes Data URLs such as:

```text
data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...
```

It separates:

```text
data:image/png;base64,
```

from the actual Base64 payload before decoding.

Supported examples include:

```text
data:image/png;base64,...
data:image/jpeg;base64,...
data:image/gif;base64,...
data:image/webp;base64,...
data:image/bmp;base64,...
data:image/svg+xml;base64,...
```

### Image Preview

When decoded data is an image, the tool automatically displays it.

Supported image formats include:

* PNG
* JPEG
* GIF
* WebP
* BMP
* SVG

The preview also displays:

* MIME type
* File size
* Image format
* Image dimensions

### Binary Data Detection

Base64 doesn't necessarily contain text.

For example:

```text
yURXhydOcPt4xdBo
```

is valid Base64 but decodes to binary bytes rather than valid UTF-8 text.

The tool can display the decoded data as hexadecimal:

```text
C9 44 57 C7 17 4E 70 FB 78 C5 D0 68
```

This prevents valid binary Base64 from being incorrectly reported as "invalid Base64."

### File Support

Files can be:

* Selected with a file picker
* Dragged and dropped into the tool
* Encoded into Base64
* Converted into Data URLs

For example, dropping a PNG can produce:

```text
data:image/png;base64,iVBORw0KGgo...
```

### Download

Decoded binary data can be downloaded directly.

The tool automatically chooses an appropriate file extension for common formats.

Examples:

```text
decoded-file.png
decoded-file.jpg
decoded-file.gif
decoded-file.webp
decoded-file.svg
decoded-file.pdf
decoded-file.json
decoded-file.txt
```

---

# User Interface

The application has two main modes.

## Text / File → Base64

Used to encode text or files.

Output can be either:

### Raw Base64

```text
iVBORw0KGgoAAAANSUhEUg...
```

### Data URL

```text
data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...
```

---

## Base64 / Data URL → File

Paste either:

```text
iVBORw0KGgoAAAANSUhEUg...
```

or:

```text
data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...
```

The application automatically determines what it can.

For an image, it displays a preview.

For text, it displays the decoded text.

For binary data, it displays a hexadecimal representation.

---

# Base64 Validation

The decoder accepts standard padded Base64:

```text
SGVsbG8=
```

and unpadded Base64:

```text
SGVsbG8
```

It also accepts Base64URL:

```text
abc-def_123
```

Whitespace is ignored, so formatted Base64 is also supported:

```text
SGVs
bG8g
V29y
bGQ=
```

Invalid Base64 is rejected with an explanatory error.

---

# Important Base64 Padding Details

Base64 padding is represented by `=`.

For example:

```text
SGVsbG8=
```

is valid.

However, padding must match the encoded data.

The converter normalizes valid missing padding automatically, but does not blindly accept arbitrary extra padding.

This prevents malformed Base64 from being treated as valid data.

---

# Privacy

The application runs entirely in the browser.

There is no:

* Backend
* Database
* API
* Upload service
* Analytics dependency
* External JavaScript library

Your input remains on your device unless you explicitly use a browser feature such as downloading or copying the result.

## Security Warning

**Base64 is not encryption.**

For example:

```text
password123
```

can easily become:

```text
cGFzc3dvcmQxMjM=
```

Anyone can decode it.

Do not use Base64 as a security mechanism for:

* Passwords
* API keys
* Authentication tokens
* Private keys
* Secrets
* Confidential information

---

# Installation

No installation is required.

```text
base64-converter/
├── index.html
└── README.md
```

Open:

```text
index.html
```

in a modern browser.

The application works offline.

---

# Browser Requirements

The tool uses modern browser APIs including:

* `TextEncoder`
* `TextDecoder`
* `Blob`
* `FileReader`
* `URL.createObjectURL`
* Clipboard API
* File API

Use a current version of:

* Chrome
* Edge
* Firefox
* Safari

---

# Keyboard Shortcuts

Currently supported:

| Shortcut       | Action  |
| -------------- | ------- |
| `Ctrl + Enter` | Convert |
| `Cmd + Enter`  | Convert |

Additional shortcuts can be added in future versions.

---

# Project Structure

```text
base64-converter/
│
├── index.html
└── README.md
```

The current implementation intentionally keeps everything inside one HTML file so the tool can easily be copied, hosted, or used offline.

---

# Current Roadmap

## v1.0 — Basic Converter

* [x] Text → Base64
* [x] Base64 → Text
* [x] UTF-8 support
* [x] Copy result
* [x] Clear
* [x] Swap
* [x] Responsive UI

## v2.0 — Data & Binary Support

* [x] Data URL parsing
* [x] Image detection
* [x] Image preview
* [x] MIME detection
* [x] Binary detection
* [x] Hex preview
* [x] File → Base64
* [x] Drag and drop
* [x] Download decoded files
* [x] Base64URL support
* [x] Unpadded Base64 support
* [x] Image dimensions
* [x] Raw Base64/Data URL output options

---

# Next Things To Do

## 1. Live Conversion

Add an option for automatic conversion while typing:

```text
☑ Convert automatically
```

This would make the tool useful for quick experimentation.

---

## 2. Character and Byte Statistics

Show information such as:

```text
Characters: 1,024
UTF-8 bytes: 1,087
Base64 length: 1,452
```

For decoded data:

```text
Decoded bytes: 1,087
Base64 overhead: ~33%
```

---

## 3. Better Image Information

For decoded images, display additional information:

```text
Format: PNG
MIME: image/png
Dimensions: 1920 × 1080
Size: 1.42 MB
Color type: RGBA
```

For PNG files, the application could inspect the PNG header directly.

---

## 4. Image Conversion

Add optional image conversion:

```text
PNG → JPEG
PNG → WebP
JPEG → WebP
WebP → PNG
```

This could be implemented entirely client-side using a `<canvas>`.

---

## 5. Image Optimization

Add controls such as:

```text
Quality: 80%
Maximum width: 1920px
Maximum height: 1080px
```

Then allow the user to export the optimized image as Base64 or a Data URL.

---

## 6. JSON Tools

Add a JSON mode:

```text
JSON → Base64
Base64 → JSON
```

With automatic JSON formatting and validation.

Example:

```json
{
  "delta": "Matrix bot accepted the request."
}
```

---

## 7. JWT Decoder

Add a JWT inspection tool.

A JWT contains Base64URL-encoded sections:

```text
header.payload.signature
```

The tool could decode and display:

```text
Header
Payload
Signature
```

Important: the tool should clearly state that decoding a JWT does **not** verify its signature.

---

## 8. URL Encoder / Decoder

Add a related developer utility:

```text
URL Encode
URL Decode
```

This would complement Base64 and Data URL functionality.

---

## 9. Hash Generator

Add client-side hashing:

* MD5
* SHA-1
* SHA-256
* SHA-384
* SHA-512

Where appropriate, use the browser's Web Crypto API rather than third-party libraries.

---

## 10. Data URI Generator

Create a dedicated Data URI tool:

```text
File
 ↓
MIME detection
 ↓
Base64 encoding
 ↓
Data URL
```

Example:

```text
data:image/png;base64,...
```

Include a convenient **Copy Data URL** button.

---

## 11. Data URI Parser

Allow users to paste:

```text
data:image/png;base64,...
```

and display:

```text
Scheme: data
MIME: image/png
Encoding: Base64
Payload size: 125 KB
```

---

## 12. More File Types

Add automatic detection for:

* PDF
* ZIP
* GZIP
* WebAssembly
* MP3
* WAV
* MP4
* ICO
* TIFF
* TAR
* JSON
* XML
* HTML

The tool could identify binary formats using file signatures ("magic bytes").

---

## 13. Audio and Video Preview

Similar to image previews:

```text
Base64
 ↓
Decode
 ↓
Audio/video detected
 ↓
Browser media player
```

Possible formats:

* MP3
* WAV
* OGG
* MP4
* WebM

---

## 14. Clipboard Improvements

Add:

* Copy Base64
* Copy decoded text
* Copy Data URL
* Copy hex
* Copy MIME type

---

## 15. Large File Handling

Large Base64 strings can consume significant memory.

Future versions should consider:

* Streaming APIs
* Chunked processing
* Progress indicators
* Memory-safe conversion
* Large-file warnings

Example:

```text
Processing...
████████████████░░░░ 80%
```

---

## 16. PWA Support

Turn the converter into an installable Progressive Web App.

Possible files:

```text
index.html
manifest.json
service-worker.js
icons/
```

Benefits:

* Install on desktop/mobile
* Offline usage
* App-like experience

---

## 17. Dark / Light Theme

Add:

```text
🌙 Dark
☀ Light
```

and save the preference with `localStorage`.

---

## 18. Accessibility

Improve accessibility with:

* ARIA labels
* Better screen-reader support
* Keyboard navigation
* Focus management
* High-contrast mode
* Reduced-motion support

---

## 19. Automated Tests

Create tests for:

### Text

```text
Hello
Hello World
こんにちは
Привет
مرحبا
😀 🚀 🌍
```

### Base64

```text
SGVsbG8=
SGVsbG8
```

### Data URLs

```text
data:text/plain;base64,...
data:image/png;base64,...
```

### Binary

```text
C9 44 57 C7 17 4E 70 FB 78 C5 D0 68
```

### Edge Cases

* Empty input
* Missing padding
* Extra padding
* Invalid characters
* Whitespace
* Very large input
* Invalid UTF-8
* Corrupted image data

---

# Future Developer Toolkit

The project could eventually become a complete browser-based developer utility suite:

```text
Developer Tools
│
├── Base64 Converter
├── Data URL Generator
├── JSON Formatter
├── JSON Validator
├── JWT Decoder
├── URL Encoder / Decoder
├── HTML Entity Encoder / Decoder
├── Hash Generator
├── UUID Generator
├── Timestamp Converter
├── Regex Tester
├── Color Converter
├── XML Formatter
├── YAML Formatter
└── Binary / Hex Viewer
```

All tools could follow the same principle:

> **Fast, local, privacy-friendly, and usable without an account.**

---

# Contributing

Contributions can focus on:

* New file-format detection
* Better binary inspection
* Accessibility
* Performance
* Mobile UI
* Testing
* New developer utilities
* Browser compatibility

Keep dependencies to a minimum where possible.

---

# License

Choose an open-source license before publishing the project.

Common choices include:

* MIT
* Apache-2.0
* GPL-3.0

MIT is a simple choice for a small browser utility if you want broad reuse.

---

# Changelog

## v2.0

* Added Data URL parsing
* Added automatic MIME detection
* Added image previews
* Added image dimensions
* Added binary/hex preview
* Added file encoding
* Added drag-and-drop
* Added file downloads
* Added Base64URL support
* Added unpadded Base64 support
* Added raw Base64/Data URL output
* Improved Base64 validation

## v1.0

* Added Text → Base64
* Added Base64 → Text
* Added UTF-8 support
* Added copy
* Added clear
* Added swap
* Added responsive interface
