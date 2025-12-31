// Build script for CLIF-C AD Calculator
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const srcDir = path.join(__dirname, '..', 'src');
const iconsDir = path.join(publicDir, 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate PNG icons from SVG using Node.js
// For environments without canvas, we'll create simple placeholder or use SVG
function generateIcons() {
    const sizes = [192, 512];

    sizes.forEach(size => {
        const svgPath = path.join(iconsDir, `icon-${size}.svg`);
        const pngPath = path.join(iconsDir, `icon-${size}.png`);

        if (fs.existsSync(svgPath)) {
            console.log(`SVG icon exists: icon-${size}.svg`);
        }

        // Create a minimal valid PNG file
        // This is a 1x1 blue pixel PNG that will be replaced with proper icon
        if (!fs.existsSync(pngPath)) {
            // Minimal PNG header + IHDR + IDAT + IEND for a blue pixel
            const minimalPng = createMinimalPng(size);
            fs.writeFileSync(pngPath, minimalPng);
            console.log(`Created placeholder PNG: icon-${size}.png`);
        }
    });
}

function createMinimalPng(size) {
    // Create a valid minimal PNG file
    // This creates a small blue PNG image
    const { createCanvas } = attemptLoadCanvas();

    if (createCanvas) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(0, 0, size, size);

        // Rounded corners effect (fill with rounded rect)
        const radius = size * 0.125;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(size - radius, 0);
        ctx.quadraticCurveTo(size, 0, size, radius);
        ctx.lineTo(size, size - radius);
        ctx.quadraticCurveTo(size, size, size - radius, size);
        ctx.lineTo(radius, size);
        ctx.quadraticCurveTo(0, size, 0, size - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fillStyle = '#2563eb';
        ctx.fill();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fontSize1 = size * 0.22;
        ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
        ctx.fillText('CLIF', size / 2, size * 0.36);

        const fontSize2 = size * 0.16;
        ctx.font = `bold ${fontSize2}px Arial, sans-serif`;
        ctx.fillText('-C AD', size / 2, size * 0.66);

        return canvas.toBuffer('image/png');
    }

    // Fallback: Return a minimal valid PNG (1x1 blue pixel)
    // PNG signature + IHDR + IDAT + IEND
    return Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x02, // 8-bit RGB
        0x00, 0x00, 0x00, // compression, filter, interlace
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x0C, // IDAT length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0xD7, 0x63, 0x28, 0x65, 0xE8, 0xEF, 0x00, 0x03, 0x30, 0x01, 0x01, // compressed blue pixel
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
}

function attemptLoadCanvas() {
    try {
        return require('canvas');
    } catch (e) {
        console.log('Canvas module not available, using fallback');
        return { createCanvas: null };
    }
}

// Copy src files to public for serving
function copySrcFiles() {
    const srcPublicDir = path.join(publicDir, 'src');

    if (!fs.existsSync(srcPublicDir)) {
        fs.mkdirSync(srcPublicDir, { recursive: true });
    }

    ['styles.css', 'app.js'].forEach(file => {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(srcPublicDir, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to public/src/`);
        }
    });
}

// Update paths in index.html for production
function updateIndexHtml() {
    const indexPath = path.join(publicDir, 'index.html');
    let content = fs.readFileSync(indexPath, 'utf8');

    // Update relative paths
    content = content.replace(/\.\.\/src\//g, 'src/');

    fs.writeFileSync(indexPath, content);
    console.log('Updated index.html paths');
}

// Main build process
console.log('Building CLIF-C AD Calculator...\n');

generateIcons();
copySrcFiles();
updateIndexHtml();

console.log('\nBuild complete!');
