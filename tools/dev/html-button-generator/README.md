# HTML Button Generator

![Thumbnail](thumbnail.png)

A tool that generates customizable HTML buttons with CSS styles and animations.

## Features

- Generate buttons with custom text
- Choose from multiple color options
- Select button sizes (small, medium, large)
- Apply various animations (pulse, bounce, shake, glow)
- Choose button shapes (rounded, square, pill)
- Copy generated HTML and CSS to clipboard

## Usage

1. Enter button text
2. Select a color using the color picker
3. Choose button size
4. Select animation effect
5. Choose button shape
6. Click "Generate Button" to create your button
7. Copy the generated HTML and CSS to use in your projects

## Generated Button Features

- Responsive design
- Smooth transitions
- Multiple animation effects
- Customizable size and shape
- Modern gradient background

## Files

- `index.html` - Main HTML structure
- `style.css` - CSS styling and animations
- `script.js` - JavaScript functionality

## Example Output

```html
<button class="generated-button btn-medium btn-rounded btn-pulse" style="background-color: #3498db;">Click Me</button>
```

```css
.generated-button {
    padding: 12px 24px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #3498db;
    color: white;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-medium {
    padding: 12px 24px;
    font-size: 1rem;
}

.btn-rounded {
    border-radius: 8px;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
.generated-button.btn-pulse {
    animation: pulse 1.5s infinite;
}
```

## Requirements

- Modern web browser
- No external dependencies

## License

MIT