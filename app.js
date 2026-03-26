//app.js

// Global zoom scale for canvas
let scale = 1;

// Main generator instance
let generator = null;

/**
 * Main orchestrator class.
 * Responsible for the full pipeline:
 * image → pixels → palette → grid → render → export
 */
class DiamondMosaicGenerator {
    /**
     * @param {HTMLImageElement} img - Source image
     */
    constructor(img) {
        /** @type {number} Color quantization step */
        this.depthRounding = 19;

        /** @type {number} Cell size in pixels (visual scaling) */
        this.cellSize = 10;

        /** @type {number} Maximum number of colors in palette */
        this.maxColors = 10;

        /** @type {number} Grid resolution (controls detail level) */
        this.detailLevel = 100;

        /** @type {HTMLImageElement} */
        this.img = img;
        
        /** @type {Array<[number, number, number]>} Raw palette (centroids) */
        this.paletteCentroids = [];

        /** @type {number[][]} Grid of color IDs */
        this.grid = [];

        /** @type {Object<number, ColorOfPalette>} Final palette */
        this.palette = {};

        /** @type {PaletteBuilder|null} */
        this.paletteBuilder = null;

        // Load UI settings
        this.readSettings();

        /** @type {boolean} true = color mode, false = BW mode */
        this.renderMode = true;

        /** @type {boolean} true = color mode, false = BW mode */
        this.colorProcessor = new ColorProcessor(this.depthRounding);
        
        // Run full pipeline
        this.doIt();

        // Run full pipeline
        this.export = new Export(this.grid, this.palette);
    }

    /**
     * Reads settings from UI inputs
     */
    readSettings() {
        this.maxColors = parseInt(document.getElementById("maxColors").value) || this.maxColors;
        this.detailLevel = parseInt(document.getElementById("detailLevel").value) || this.detailLevel;
        this.depthRounding = parseInt(document.getElementById("depthRounding").value) || this.depthRounding;
        this.cellSize = parseInt(document.getElementById("cellSize").value) || this.cellSize;   
    }

    /**
     * Reads settings from UI inputs
     */
    getDimensions(width, height, detailLevel){
        const ratio = width / height;
        if (ratio > 1) {
            width = detailLevel;
            height = Math.round(detailLevel / ratio);
        } else {
            height = detailLevel;
            width = Math.round(detailLevel * ratio);
        }

        return {width: width, height: height}

    }

    /**
     * Main processing pipeline:
     * 1. Resize image
     * 2. Extract pixels
     * 3. Apply dithering
     * 4. Reduce colors (kMeans)
     * 5. Build palette + grid
     * 6. Render result
     */  
    doIt() {
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");

        // Disable smoothing for pixel-art look
        ctx.imageSmoothingEnabled = false;
       
        // Calculate target resolution
        let dimensions = this.getDimensions(
            this.img.width,
            this.img.height,
            this.detailLevel
        );

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        let width = dimensions.width;
        let height = dimensions.height;

        // Draw resized image to canvas
        ctx.drawImage(this.img, 0, 0, width, height);

        // === IMAGE PROCESSING ===
        const imageProcessor = new ImageProcessor(
            ctx,
            width,
            height,
            this.depthRounding
        );

        let data = imageProcessor.getImageData();
        data = imageProcessor.applyDithering();

        // Convert RGBA → RGB array
        const pixels = imageProcessor.getPixels(data); // [[r,g,b], [r,g,b], ...]

        // Convert RGBA → RGB array
        this.paletteCentroids = new ColorReducer()
            .kMeans(pixels, this.maxColors);

        // === PALETTE + GRID ===
        this.paletteBuilder = new PaletteBuilder(
            data,
            pixels,
            width,
            height,
            this.paletteCentroids
        );

        this.grid = this.paletteBuilder.grid;
        this.palette = this.paletteBuilder.palette;
        this.colorCount = this.paletteBuilder.colorCount;  

        // Build palette UI
        this.paletteBuilder.buildPaletteUI();
        
        // === RENDER ===
        this.renderer = new DrawMosaic(
            this.cellSize,
            this.grid,
            this.palette,
            this.renderMode
        );

        // === EXPORT ===
        this.export = new Export(
            this.grid,
            this.palette
        );
    }
}

/**
 * Responsible for rendering mosaic grid onto canvas.
 * Draws colored cells, symbols and grid overlay.
 */
class DrawMosaic{
    /**
     * @param {number} cellSize - Size of one mosaic cell in pixels
     * @param {number[][]} grid - 2D array of color IDs
     * @param {Object<number, ColorOfPalette>} palette - Map of colorId -> color object
     * @param {boolean} renderMode - true = color mode, false = black & white (print mode)
     */
    constructor(cellSize, grid, palette, renderMode){
        /** @type {HTMLCanvasElement} */
        this.canvas = document.getElementById("canvas");

        /** @type {CanvasRenderingContext2D} */
        this.ctx = this.canvas.getContext("2d");

        this.cellSize = cellSize;
        this.grid = grid;
        this.palette = palette;
        this.renderMode = renderMode;

        /** @type {number} */
        this.width = this.grid[0].length;

        /** @type {number} */
        this.height = this.grid.length;

        this.drawMosaic();
    }

    /**
     * Render the mosaic on canvas
     * @param {boolean} [renderMode=true] - Optional override render mode
     */
    drawMosaic(renderMode = true){
        this.renderMode = renderMode;
        
        // Resize canvas to match mosaic dimensions
        this.canvas.width = this.width * this.cellSize;
        this.canvas.height = this.height * this.cellSize;

        // Iterate through grid and draw each cell
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {

                const colorId = this.grid[y][x];
                const color = this.palette[colorId];

                // Draw cell background
                if (this.renderMode) {
                    this.ctx.fillStyle = color.hex;
                    this.ctx.fillRect(
                        x * this.cellSize,
                        y * this.cellSize,
                        this.cellSize,
                        this.cellSize
                    );
                } else {
                    this.ctx.fillStyle = "#ffffff";
                    this.ctx.fillRect(
                        x * this.cellSize,
                        y * this.cellSize,
                        this.cellSize,
                        this.cellSize
                    );
                }
                
                // Prepare text rendering
                this.ctx.fillStyle = "#000";
                this.ctx.font = `${this.cellSize / 2}px Arial`;             
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
               
                const symbol = color.symbol;

                // Choose contrast color for text
                if (this.renderMode) {
                    const { r, g, b } = color.rgb;
                    const isDark = (r + g + b) / 3 < 128;
                    this.ctx.fillStyle = isDark ? "#fff" : "#000";
                } else {
                    this.ctx.fillStyle = "#000"; // для печати всегда чёрный
                }

                // Draw symbol inside cell
                this.ctx.fillText(
                    symbol,
                    x * this.cellSize + this.cellSize / 2,
                    y * this.cellSize + this.cellSize / 2
                );
            }
        }
            
        // Draw grid overlay
        this.drawGrid();
    }

    /**
     * Draw grid lines over mosaic
     */
    drawGrid() {
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 0.5;

        // Vertical lines
        for (let x = 0; x <= this.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.cellSize, 0);
            this.ctx.lineTo(x * this.cellSize, this.height * this.cellSize);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.cellSize);
            this.ctx.lineTo(this.width * this.cellSize, y * this.cellSize);
            this.ctx.stroke();
        }
    }

}

/**
 * Handles exporting mosaic data into different formats (PNG, JSON).
 */
class Export {
    /**
     * @param {number[][]} grid - 2D array of color IDs
     * @param {Object<number, ColorOfPalette>} palette - Color palette map
     */
    constructor(grid, palette){
        this.grid = grid;
        this.palette = palette;
    }

    /**
     * Export canvas content as PNG image
     * @param {string} [fileName="mosaic.png"]
     */
    png(fileName = "mosaic.png"){
        /** @type {HTMLCanvasElement} */
        const canvas = document.getElementById("canvas");

        const link = document.createElement("a");
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    /**
     * Export mosaic data as JSON file
     * @param {string} [fileName="mosaic.json"]
     */
    json(fileName = "mosaic.json"){
        const data = {
            grid: this.grid,
            palette: this.palette
        };

        const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: "application/json" }
        );

        const link = document.createElement("a");
        link.download = fileName;
        link.href = URL.createObjectURL(blob);
        link.click();

        // cleanup
        URL.revokeObjectURL(link.href);
    }
}

/**
 * Handles low-level image processing:
 * - reading pixel data from canvas
 * - applying color quantization + dithering
 * - converting raw data into RGB pixel array
 */
class ImageProcessor {
    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} depthRounding - Color quantization step
     */
    constructor(ctx, width, height, depthRounding) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.data = null;
        this.depthRounding = depthRounding;

        /** @type {Uint8ClampedArray|null} */
        this.pixels = [];
    }

    /**
     * Get raw RGBA pixel data from canvas
     * @returns {Uint8ClampedArray}
     */
    getImageData() {
        this.data = this.ctx.getImageData(0, 0, this.width, this.height).data;
        return this.data;
    }

    /**
     * Apply simple dithering with color quantization
     * (error diffusion: right + bottom pixels)
     * 
     * @returns {Uint8ClampedArray}
     */
    applyDithering() {
        const copy = new Uint8ClampedArray(this.data);

        for (let y = 0; y < this.height; y++){
            for (let x = 0; x < this.width; x++){

                const i = (y * this.width + x) * 4;

                let r = copy[i];
                let g = copy[i + 1];
                let b = copy[i + 2];

                // Quantize color
                const qr = Math.round(r / this.depthRounding) * this.depthRounding;
                const qg = Math.round(g / this.depthRounding) * this.depthRounding;
                const qb = Math.round(b / this.depthRounding) * this.depthRounding;

                // Error
                const errR = r - qr;
                const errG = g - qg;
                const errB = b - qb;

                // Apply quantized color
                copy[i] = qr;
                copy[i + 1] = qg;
                copy[i + 2] = qb;

                // Spread error (very simplified Floyd-Steinberg)
                const spread = (dx, dy, factor) => {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const ni = (ny * this.width + nx) * 4;
                        
                        copy[ni] += errR * factor;
                        copy[ni + 1] += errG * factor;
                        copy[ni + 2] += errB * factor;
                    }
                };

                spread(1, 0, 0.5); // right
                spread(0, 1, 0.5); // right
            }
        }
        this.data = copy;
        return copy;
    }

    /**
     * Convert RGBA data into array of RGB pixels
     * Example: [[r,g,b], [r,g,b], ...]
     * 
     * @returns {number[][]}
     */
    getPixels() {
       this.pixels = [];

        for (let i = 0; i < this.data.length; i += 4) {
            this.pixels.push([
                this.data[i],
                this.data[i + 1],
                this.data[i + 2]
            ]);
        }
      
        return this.pixels;
    }
}

/**
 * Performs color reduction using K-Means clustering.
 * Extracts dominant colors from pixel array.
 */
class ColorReducer {

    /**
     * @param {number} [k=5] - Default number of clusters (colors)
     * @param {number} [iterations=10] - Max number of iterations
     */
    constructor(k = 5, iterations = 10){
        this.k = k;
        this.iterations = iterations;
    }

    /**
     * Apply K-Means clustering to pixel data
     *
     * @param {number[][]} pixels - Array of pixels [[r,g,b], ...]
     * @param {number} [k=this.k] - Number of clusters
     * @param {number} [iterations=this.iterations] - Max iterations
     * 
     * @returns {number[][]} Array of centroids [[r,g,b], ...]
     */
    kMeans(pixels, k = this.k, iterations = this.iterations) {

        const K = k;
        const ITER = iterations;

        // 🔥 1. Random initialization of centroids
        let centroids = this._getRandomCentroids(pixels, K);

        for (let iter = 0; iter < ITER; iter++) {

            const clusters = Array.from({ length: K }, () => []);

            // Assign pixels to nearest centroid
            for (let p of pixels) {

                let minDist = Infinity;
                let index = 0;

                for (let i = 0; i < K; i++) {
                    const c = centroids[i];

                    const dist =
                        (p[0] - c[0]) ** 2 +
                        (p[1] - c[1]) ** 2 +
                        (p[2] - c[2]) ** 2;

                    if (dist < minDist) {
                        minDist = dist;
                        index = i;
                    }
                }

                clusters[index].push(p);
            }

            // 🔥 2. Recalculate centroids + check movement
            let changed = false;

            for (let i = 0; i < K; i++) {

                if (clusters[i].length === 0) continue;

                let r = 0, g = 0, b = 0;

                for (let p of clusters[i]) {
                    r += p[0];
                    g += p[1];
                    b += p[2];
                }

                const newCentroid = [
                    Math.round(r / clusters[i].length),
                    Math.round(g / clusters[i].length),
                    Math.round(b / clusters[i].length)
                ];

                // 🔥 проверяем изменился ли центроид
                if (
                    newCentroid[0] !== centroids[i][0] ||
                    newCentroid[1] !== centroids[i][1] ||
                    newCentroid[2] !== centroids[i][2]
                ) {
                    changed = true;
                }

                centroids[i] = newCentroid;
            }

            // 🔥 Early exit если стабилизировалось
            if (!changed) {
                console.log(`KMeans converged at iteration ${iter}`);
                break;
            }
        }

        return centroids;
    }

    /**
     * Get random unique centroids from pixels
     * @param {number[][]} pixels
     * @param {number} k
     * @returns {number[][]}
     */
    _getRandomCentroids(pixels, k) {
        const centroids = [];
        const used = new Set();

        while (centroids.length < k) {
            const index = Math.floor(Math.random() * pixels.length);

            if (!used.has(index)) {
                used.add(index);
                centroids.push([...pixels[index]]);
            }
        }

        return centroids;
    }
}

/**
 * Utility class for color transformations:
 * - quantization
 * - RGB ↔ HEX conversion
 */
class ColorProcessor {
    /**
     * Utility class for color transformations:
     * - quantization
     * - RGB ↔ HEX conversion
     */
    constructor(depthRounding = 51) {
        this.depthRounding = depthRounding;
    }   

    /**
     * Quantize RGB color based on rounding step
     * Example: reduces number of possible colors
     * 
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {string} HEX color (e.g. "#ff00aa")
     */
    quantizeColor(r, g, b) {
        r = Math.round(r / this.depthRounding) * this.depthRounding;
        g = Math.round(g / this.depthRounding) * this.depthRounding;
        b = Math.round(b / this.depthRounding) * this.depthRounding;

        return this.rgbToHex(r, g, b);
    }

    /**
     * Convert RGB to HEX string
     * 
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {string}
     */
    rgbToHex(r, g, b) {
        return "#" + [r, g, b]
            .map(v => this._clamp(v).toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Convert HEX string to RGB object
     * 
     * @param {string} hex - Format "#rrggbb"
     * @returns {{r:number, g:number, b:number}}
     */
    hexToRgb(hex) {
         const bigint = parseInt(hex.slice(1), 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    /**
     * Clamp value to valid RGB range (0–255)
     * 
     * @private
     * @param {number} v
     * @returns {number}
     */
    _clamp(v) {
        return Math.max(0, Math.min(255, v));
    }

}

/**
 * Builds a palette and a color grid for a given image.
 * Maps each pixel to the closest centroid color.
 */
class PaletteBuilder {
    /**
     * Builds a palette and a color grid for a given image.
     * Maps each pixel to the closest centroid color.
     */
    constructor(data, pixels, width, height, centroids) {
        this.data = data;
        this.pixels = pixels;
        this.width = width;
        this.height = height;
        this.centroids = centroids;

        this.colorProcessor = new ColorProcessor();
        
        /** @type {Array<Array<number>>} Grid of color indices */
        this._grid = [];

        /** @type {Array<Array<number>>} Grid of color indices */
        this._palette = {};
       

        this.build();
    }
    
    /** @type {Object<number, ColorOfPalette>} Palette object keyed by color id */
    get grid() {
        return this._grid;
    }

    /** @returns {Array<Array<number>>} 2D array of color indices */
    get palette() {
       return this._palette;
    }

    /**
     * Build the color grid and palette
     */
    build() {
        // create palette from centroids
        this.centroids.forEach((c, i) => {
            
            this._palette[i] = new ColorOfPalette(
                i,
                {r:c[0], g:c[1], b:c[2]}, 
                this.colorProcessor.rgbToHex(c[0], c[1], c[2]),
                0
            );
        });

        for (let y = 0; y < this.height; y++) {
            const row = [];

            for (let x = 0; x < this.width; x++) {

                const i = (y * this.width + x) * 4;

                const pixel = [
                    this.data[i],
                    this.data[i + 1],
                    this.data[i + 2]
                ];

                let best = 0;
                let minDist = Infinity;

                // find nearest centroid
                for (let j = 0; j < this.centroids.length; j++) {
                    const c = this.centroids[j];

                    const dist =
                        (pixel[0] - c[0]) ** 2 +
                        (pixel[1] - c[1]) ** 2 +
                        (pixel[2] - c[2]) ** 2;

                    if (dist < minDist) {
                        minDist = dist;
                        best = j;
                    }
                }
                
                this.palette[best].colorCount++; 
                row.push(best);
            }

            this._grid.push(row);
        }
    }



    /**
     * Render the palette as HTML elements in the container with id "palette".
     */
    buildPaletteUI() {

        const container = document.getElementById("palette");
        container.innerHTML = "";

        Object.entries(this.palette).forEach(([id, color]) => {

            const row = document.createElement("div");
            row.className = "palette-item";

            row.innerHTML = `
                <div class="color-box" style="background:${color.hex}"></div>
                <span><b>${color.symbol}</b></span>
                <span>${color.hex}</span>
                <span>(${color.colorCount})</span>
            `;

            container.appendChild(row);
        });
    }



}

/**
 * Represents a single color in the palette.
 */
class ColorOfPalette {
    /**
     * @param {number|null} id - Color ID
     * @param {{r:number, g:number, b:number}} rgb - RGB values
     * @param {string} hex - Hex color string
     * @param {number} colorCount - Number of pixels assigned to this color
     */
    constructor(id = null, rgb = {r:0, g:0, b:0}, hex = "#000000", colorCount = 0) {
        /** @private */
        this._id = id;

        /** @private */
        this._rgb = rgb;

        /** @private */
        this._hex = hex;

        /** @private */
        this._colorCount = colorCount;

        /** @private */
        this._symbol = this._getSymbol();        
    }

    /** @private */
    get id(){
        return this._id;
    }

    /** @returns {number|null} */
    get rgb(){
        return this._rgb;
    }

    /** @returns {string} */
    get hex(){
        return this._hex;
    }

    /** @returns {number} */
    get colorCount(){
        return this._colorCount;
    }

    /** @returns {string} Symbol representing this color in the mosaic */
    get symbol(){
        return this._symbol;
    }

    set rgb(value){this._rgb = value;}
    set hex(value){this._hex = value;}
    set colorCount(value){this._colorCount = value;}
    set symbol(value){this._symbol = value;}

    /**
     * Assigns a symbol from the predefined set based on color ID
     * @private
     * @returns {string}
     */
    _getSymbol() {
        const symbols = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0".split("");
        return symbols[this._id] || "?";
    }

}

/**
 * Load an image from the file input and initialize the mosaic generator.
 * @param {Event} event - Change event from the file input
 */
function loadImage(event) {
    const file = event.target.files[0];

    const img = new Image();

    img.onload = () => {
        generator = new DiamondMosaicGenerator(img);
        URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
}


document.addEventListener("DOMContentLoaded", () => {
    // Export buttons
    document.getElementById("exportPNG").onclick = () => {
        if (generator) generator.export.png();
    };

    document.getElementById("exportJSON").onclick = () => {
        if (generator) generator.export.json();
    };

    // Render mode buttons
    document.getElementById("modeColor").onclick = () => {
        if (generator) {
             generator.renderer.drawMosaic(true);
        }
    };

    document.getElementById("modeBW").onclick = () => {
        if (generator) {
            generator.renderer.drawMosaic(false);
        }
    };
    
    // Settings inputs: re-process on change
    document.getElementById("processBtn").onclick = () => {
        if (!generator) return;

        generator.readSettings();
        generator.doIt();
    };

    // Settings inputs: re-process on change
    ["detailLevel", "maxColors", "depthRounding", "cellSize"].forEach(id => {
        document.getElementById(id).addEventListener("change", () => {
            if (generator) {
                generator.readSettings();
                generator.doIt();
            }
        });
    });

    // Process button
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();

        scale += e.deltaY * -0.001;
        scale = Math.min(Math.max(0.5, scale), 5);

        canvas.style.transform = `scale(${scale})`;
    });

    // File input change
    document.getElementById("fileInput").addEventListener("change", loadImage);
});