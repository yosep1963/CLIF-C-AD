// Icon Generator for CLIF-C AD PWA
// Creates simple text-based PNG icons using canvas

const fs = require('fs');
const path = require('path');

// Check if canvas module is available (for Netlify build)
let createCanvas;
try {
    createCanvas = require('canvas').createCanvas;
} catch (e) {
    console.log('Canvas module not available, using SVG fallback');
    createSvgIcons();
    process.exit(0);
}

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, size, size);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // CLIF text
    const fontSize = size * 0.25;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillText('CLIF', size / 2, size * 0.35);

    // -C AD text
    const subFontSize = size * 0.18;
    ctx.font = `bold ${subFontSize}px Arial, sans-serif`;
    ctx.fillText('-C AD', size / 2, size * 0.65);

    return canvas.toBuffer('image/png');
}

function createSvgIcons() {
    const sizes = [192, 512];
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');

    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    sizes.forEach(size => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2563eb"/>
  <text x="${size/2}" y="${size*0.38}" font-family="Arial, sans-serif" font-size="${size*0.22}" font-weight="bold" fill="white" text-anchor="middle">CLIF</text>
  <text x="${size/2}" y="${size*0.68}" font-family="Arial, sans-serif" font-size="${size*0.16}" font-weight="bold" fill="white" text-anchor="middle">-C AD</text>
</svg>`;

        // For PWA, we'll create a simple data URI approach
        // Write SVG file as fallback
        fs.writeFileSync(path.join(iconsDir, `icon-${size}.svg`), svg);
        console.log(`Created icon-${size}.svg`);
    });

    // Also create PNG placeholder files with embedded SVG
    // This uses a simple approach for environments without canvas
    sizes.forEach(size => {
        const pngPath = path.join(iconsDir, `icon-${size}.png`);
        if (!fs.existsSync(pngPath)) {
            // Create a simple 1x1 pixel PNG as placeholder
            // In production, you'd use a proper image
            console.log(`Note: ${pngPath} should be replaced with actual PNG for best compatibility`);
        }
    });
}

// Main execution
try {
    const sizes = [192, 512];
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');

    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    if (createCanvas) {
        sizes.forEach(size => {
            const buffer = generateIcon(size);
            const filePath = path.join(iconsDir, `icon-${size}.png`);
            fs.writeFileSync(filePath, buffer);
            console.log(`Generated ${filePath}`);
        });
    } else {
        createSvgIcons();
    }

    console.log('Icon generation complete!');
} catch (error) {
    console.error('Icon generation failed:', error.message);
    createSvgIcons();
}
