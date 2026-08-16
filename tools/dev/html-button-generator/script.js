document.addEventListener('DOMContentLoaded', function() {
    window.registerDashboardThemeSync();
    // DOM Elements
    const generateBtn = document.getElementById('generateBtn');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const copyBtn = document.getElementById('copyBtn');
    const buttonPreview = document.getElementById('buttonPreview');
    const generatedCode = document.getElementById('generatedCode');
    const colorType = document.getElementById('colorType');
    const colorAmount = document.getElementById('colorAmount');
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    const customColorGroup = document.getElementById('customColorGroup');
    const colorPickerGroup = document.getElementById('colorPickerGroup');
    const glassMode = document.getElementById('glassMode');
    const textShadow = document.getElementById('textShadow');
    const gradientDir = document.getElementById('gradientDir');
    const borderWidth = document.getElementById('borderWidth');

    // INITIALIZE
    updateColorInputs();
    generateButton();

    // EVENT LISTENERS
    generateBtn.addEventListener('click', generateButton);
    randomizeBtn.addEventListener('click', randomizeSettings);
    copyBtn.addEventListener('click', copyToClipboard);

    // Watch for changes in simple selects and checkboxes
    [colorType, glassMode, textShadow, gradientDir, 
     document.getElementById('buttonSize'), 
     document.getElementById('buttonAnimation'), 
     document.getElementById('buttonShape'),
     document.getElementById('borderStyle'),
     document.getElementById('shadow')].forEach(el => {
        el.addEventListener('change', () => {
            handleUIToggle();
            generateButton();
        });
    });

    // Slider for number of colors
    colorAmount.addEventListener('input', function() {
        document.getElementById('colorAmountValue').textContent = this.value;
        updateColorInputs();
    });

    // Slider for border width
    borderWidth.addEventListener('input', function() {
        document.getElementById('borderWidthValue').textContent = this.value + 'px';
        generateButton();
    });

    // Single Color Picker
    document.getElementById('buttonColor').addEventListener('input', generateButton);
    document.getElementById('borderColor').addEventListener('input', generateButton);

    // Toggle logic for showing/hiding UI panels
    function handleUIToggle() {
        const isGradient = colorType.value === 'gradient';
        document.getElementById('gradientColorGroup').style.display = isGradient ? 'block' : 'none';
        document.getElementById('gradientDirGroup').style.display = isGradient ? 'block' : 'none';
        customColorGroup.style.display = isGradient ? 'block' : 'none';
        colorPickerGroup.style.display = isGradient ? 'none' : 'block';
    }

    // Create multiple color inputs for gradients
    function updateColorInputs() {
        colorPickerContainer.innerHTML = '';
        if (colorType.value === 'gradient') {
            const count = parseInt(colorAmount.value);
            for (let i = 0; i < count; i++) {
                const input = document.createElement('input');
                input.type = 'color';
                input.className = 'gradient-picker';
                input.value = getRandomColor();
                input.addEventListener('input', generateButton);
                colorPickerContainer.appendChild(input);
            }
        }
        generateButton();
    }

    function generateButton() {
        // Get form values
        const buttonText = document.getElementById('buttonText').value;
        const buttonColor = document.getElementById('buttonColor').value;
        const buttonSize = document.getElementById('buttonSize').value;
        const buttonAnimation = document.getElementById('buttonAnimation').value;
        const buttonShape = document.getElementById('buttonShape').value;
        const borderStyle = document.getElementById('borderStyle').value;
        const bWidth = borderWidth.value;
        const borderColor = document.getElementById('borderColor').value;
        const shadow = document.getElementById('shadow').value;
        const type = colorType.value;
        const dir = gradientDir.value;

        // Background Logic
        let backgroundCSS = buttonColor;
        if (type === 'gradient') {
            const pickers = document.querySelectorAll('.gradient-picker');
            const colors = Array.from(pickers).map(p => p.value);
            backgroundCSS = dir === 'circle' 
                ? `radial-gradient(circle, ${colors.join(', ')})` 
                : `linear-gradient(${dir}, ${colors.join(', ')})`;
        }

        // Glassmorphism logic
        let glassStyles = '';
        if (glassMode.checked) {
            backgroundCSS = 'rgba(255, 255, 255, 0.2)';
            glassStyles = `backdrop-filter: blur(10px); 
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);`;
        }

        // Map UI to CSS Variables
        const paddings = { small: '8px 16px', medium: '12px 24px', large: '16px 32px' };
        const fontSizes = { small: '0.875rem', medium: '1rem', large: '1.25rem' };
        const radii = { rounded: '8px', square: '0px', pill: '50px' };
        const shadows = { 
            none: 'none', 
            small: '0 2px 5px rgba(0,0,0,0.2)', 
            medium: '0 4px 15px rgba(0,0,0,0.2)', 
            large: '0 8px 25px rgba(0,0,0,0.3)' 
        };

        const animationClass = buttonAnimation !== 'none' ? `btn-anim-${buttonAnimation}` : '';

        const buttonStyles = `
.generated-button {
    display: inline-block;
    padding: ${paddings[buttonSize]};
    font-size: ${fontSizes[buttonSize]};
    font-weight: 600;
    font-family: sans-serif;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    background: ${backgroundCSS};
    color: white;
    border-radius: ${radii[buttonShape]};
    border: ${borderStyle === 'none' ? 'none' : `${bWidth}px ${borderStyle} ${borderColor}`};
    box-shadow: ${shadows[shadow]};
    text-shadow: ${textShadow.checked ? '1px 1px 3px rgba(0,0,0,0.3)' : 'none'};
    transition: all 0.3s ease;
    ${glassStyles}
}

.generated-button:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}

.generated-button:active {
    transform: translateY(0);
}

${buttonAnimation !== 'none' ? `
@keyframes ${buttonAnimation} {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}
.${animationClass} {
    animation: ${buttonAnimation} 1.5s infinite;
}` : ''}`;

        const buttonHtml = `<button class="generated-button ${animationClass}">${buttonText}</button>`;

        // Update BOTH preview columns
        const previewLight = document.getElementById('buttonPreviewLight');
        const previewDark = document.getElementById('buttonPreviewDark');
        
        if(previewLight && previewDark) {
            previewLight.innerHTML = buttonHtml;
            previewDark.innerHTML = buttonHtml;
        }
        
        // Update Stylesheet in Head
        let styleTag = document.getElementById('dynamic-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-styles';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = buttonStyles;

        // Update Display Code
        generatedCode.textContent = buttonStyles;
    }

    function randomizeSettings() {
        const texts = ['Click Me', 'Explore', 'Join Now', 'Download', 'Submit'];
        document.getElementById('buttonText').value = texts[Math.floor(Math.random() * texts.length)];

        // Randomly pick Color Type
        const isGradient = Math.random() > 0.4;
        colorType.value = isGradient ? 'gradient' : 'solid';
        
        // Randomize sizes/shapes
        document.getElementById('buttonSize').value = ['small', 'medium', 'large'][Math.floor(Math.random() * 3)];
        document.getElementById('buttonShape').value = ['rounded', 'square', 'pill'][Math.floor(Math.random() * 3)];
        document.getElementById('buttonAnimation').value = ['none', 'pulse', 'bounce', 'glow'][Math.floor(Math.random() * 4)];
        
        // Randomize Effects
        glassMode.checked = Math.random() > 0.8;
        textShadow.checked = Math.random() > 0.5;

        // Randomize Borders
        const hasBorder = Math.random() > 0.7;
        borderWidth.value = hasBorder ? Math.floor(Math.random() * 5) + 1 : 0;
        document.getElementById('borderWidthValue').textContent = borderWidth.value + 'px';
        document.getElementById('borderStyle').value = hasBorder ? 'solid' : 'none';
        document.getElementById('borderColor').value = getRandomColor();
        document.getElementById('buttonColor').value = getRandomColor();
        document.getElementById('shadow').value = ['none', 'small', 'medium', 'large'][Math.floor(Math.random() * 4)];

        if (isGradient) {
            colorAmount.value = Math.floor(Math.random() * 4) + 2; // 2-5 colors
            document.getElementById('colorAmountValue').textContent = colorAmount.value;
            gradientDir.value = ['45deg', '90deg', '180deg', 'circle'][Math.floor(Math.random() * 4)];
        }

        // Apply visual logic and refresh pickers
        handleUIToggle();
        updateColorInputs(); // This calls generateButton() automatically
    }

    function getRandomColor() {
        return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(generatedCode.textContent).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
        });
    }

    function describeCurrentAssets() {
        const css = generatedCode.textContent || '';
        const previewLight = document.getElementById('buttonPreviewLight');
        const html = previewLight && previewLight.innerHTML ? previewLight.innerHTML : buttonPreview && buttonPreview.innerHTML || '';
        return [
            {
                kind: 'text',
                title: 'Generated Button CSS',
                fileName: 'generated-button.css',
                mimeType: 'text/css',
                textContent: css,
                previewKind: 'text',
                previewText: css,
                sourceDetail: 'Generated button CSS.',
                metadata: { sourceTool: 'html-button-generator', resourceFormat: 'css' }
            },
            {
                kind: 'text',
                title: 'Generated Button HTML',
                fileName: 'generated-button.html',
                mimeType: 'text/html',
                textContent: html,
                previewKind: 'text',
                previewText: html,
                sourceDetail: 'Generated button HTML snippet.',
                metadata: { sourceTool: 'html-button-generator', resourceFormat: 'html' }
            }
        ];
    }

    window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
    window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;
});
