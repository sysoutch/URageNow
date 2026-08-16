# Favicon Creator

![Thumbnail](thumbnail.png)

A powerful, easy-to-use tool for generating production-ready favicon bundles from any image. This tool creates all necessary favicon formats including 16x16, 32x32, 180x180, 192x192, and 512x512 pixel icons, along with a Web App Manifest file for modern web applications.

## 🌟 Features

- **Multi-format Generation**: Creates all essential favicon sizes (16x16, 32x32, 180x180, 192x192, 512x512)
- **Web App Manifest Support**: Generates a complete `site.webmanifest` file for Progressive Web Apps
- **Drag & Drop Interface**: Simple drag-and-drop or click-to-upload functionality
- **Real-time Preview**: See all generated icons before downloading
- **ZIP Bundle Export**: Download all icons and manifest in a single ZIP file
- **High-Quality Scaling**: Improved image scaling with high-quality rendering
- **Responsive Design**: Works on all device sizes
- **Cross-browser Compatible**: Works in all modern browsers

## 🚀 How to Use

1. **Open the Tool**: Navigate to `favicon-creator/index.html` in your browser
2. **Upload an Image**: 
   - Click the upload area or drag and drop an image file
   - For best results, use a square image (1:1 aspect ratio)
3. **Preview Icons**: View all generated icons in real-time
4. **Download Bundle**: Click the "DOWNLOAD ICON BUNDLE (.ZIP)" button
5. **Add to Your Website**: Extract the ZIP file and add the provided HTML code to your website's `<head>` section

## 📁 Generated Files

The tool generates the following files in the ZIP bundle:

- `favicon-16x16.png` - 16x16 favicon for browser tabs
- `favicon-32x32.png` - 32x32 favicon for high-DPI displays
- `apple-touch-icon.png` - 180x180 icon for iOS devices
- `android-chrome-192x192.png` - 192x192 icon for Android Chrome
- `android-chrome-512x512.png` - 512x512 icon for Android Chrome
- `site.webmanifest` - Web App Manifest file for PWA support

## 🛠️ Technical Details

- **Built with**: HTML5, CSS3, JavaScript (ES6)
- **Dependencies**: Uses JSZip library for ZIP file generation
- **Image Processing**: Canvas-based image resizing and scaling with high-quality rendering
- **File Formats**: All icons are generated as PNG files
- **Responsive UI**: Adapts to different screen sizes
- **Modern Browser Support**: Works in Chrome, Firefox, Safari, Edge
- **Advanced Image Quality Improvements**: 
  - Enabled `imageSmoothingEnabled` for better scaling
  - Set `imageSmoothingQuality` to 'high' for improved rendering
  - Used PNG compression with maximum quality (1.0)
  - Implemented multi-resolution rendering for small favicons (16x16 and 32x32)
  - Enhanced scaling algorithms for better preservation of image details

## 🌐 Browser Compatibility

This tool works in all modern browsers:

- Chrome 50+
- Firefox 50+
- Safari 10+
- Edge 12+
- Opera 37+

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 👨‍💻 Author

**URage Tools** - A collection of web-based tools for developers and designers

For more information about this toolset, visit the [main project page](../../README.md).

## 📌 Usage Example

After downloading the bundle, add this code to your website's `<head>` section:

```html
<!-- Copy this into your <head> -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## 📷 Preview

![Favicon Creator Interface](thumbnail.png)

*The tool generates a preview of all icons before download*