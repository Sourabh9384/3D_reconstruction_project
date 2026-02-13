/**
 * Slice Viewer Module
 * Handles 2D visualization of medical image slices
 */
class SliceViewer {
    constructor(canvasId) {
        // DOM elements
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.loadingOverlay = document.getElementById('sliceLoadingOverlay');
        
        // Data properties
        this.volumeData = null;
        this.segmentationData = null;
        this.dimensions = [0, 0, 0];
        this.sliceIndex = 0;
        this.maxSliceIndex = 0;
        this.orientation = 'axial'; // axial, coronal, sagittal
        
        // Display properties
        this.windowCenter = 40;    // Default for soft tissue
        this.windowWidth = 400;    // Default for soft tissue
        
        // Initialize canvas size
        this.resizeCanvas();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Add console message
        this.addConsoleMessage('Slice viewer initialized');
    }
    
    /**
     * Resize the canvas to match its container
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Set canvas size in pixels
        this.canvas.width = width * window.devicePixelRatio;
        this.canvas.height = height * window.devicePixelRatio;
        
        // Set canvas size in CSS
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        
        // Scale context for high DPI displays
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Redraw if data exists
        if (this.volumeData) {
            this.drawSlice();
        }
    }
    
    /**
     * Load volume data from the server
     */
    loadVolumeData() {
        this.showLoading(true);
        this.addConsoleMessage('Loading volume data...');
        
        // Fetch volume data
        fetch('/api/volume')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                // Convert ArrayBuffer to Float32Array
                const dataView = new DataView(buffer);
                const headerSize = 128; // NumPy header size
                const dataSize = (buffer.byteLength - headerSize) / 4; // 4 bytes per float32
                
                // Create Float32Array from the data portion of the buffer
                const rawData = new Float32Array(buffer, headerSize, dataSize);
                
                // Assuming dimensions are encoded in the .npy header
                // In a real implementation, we'd parse them from the .npy header
                // For simplicity, we'll use a default layout
                const width = Math.round(Math.cbrt(dataSize));
                const height = width;
                const depth = width;
                
                this.dimensions = [depth, height, width];
                this.volumeData = rawData;
                this.maxSliceIndex = this.dimensions[0] - 1;
                this.sliceIndex = Math.floor(this.maxSliceIndex / 2);
                
                // Update UI
                document.getElementById('volumeSize').textContent = `${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`;
                document.getElementById('volumeDimensions').textContent = this.dimensions.join(' × ');
                document.getElementById('slicePosition').max = this.maxSliceIndex;
                document.getElementById('slicePosition').value = this.sliceIndex;
                document.getElementById('sliceValue').textContent = this.sliceIndex;
                
                // Draw the middle slice
                this.drawSlice();
                
                this.showLoading(false);
                this.addConsoleMessage('Volume data loaded successfully', 'success');
                
                // Try to load segmentation data
                this.loadSegmentationData();
            })
            .catch(error => {
                console.error('Error loading volume data:', error);
                this.showLoading(false);
                this.addConsoleMessage('Error loading volume data: ' + error.message, 'error');
            });
    }
    
    /**
     * Load segmentation data from the server
     */
    loadSegmentationData() {
        this.addConsoleMessage('Loading segmentation data...');
        
        fetch('/api/segmented-volume')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                // Convert ArrayBuffer to Uint8Array (segmentation is binary)
                const dataView = new DataView(buffer);
                const headerSize = 128; // NumPy header size
                const dataSize = buffer.byteLength - headerSize;
                
                // Create Uint8Array from the data portion of the buffer
                const rawData = new Uint8Array(buffer, headerSize, dataSize);
                
                this.segmentationData = rawData;
                
                // Redraw slice with segmentation overlay
                this.drawSlice();
                
                this.addConsoleMessage('Segmentation data loaded successfully', 'success');
            })
            .catch(error => {
                console.error('Error loading segmentation data:', error);
                this.addConsoleMessage('Error loading segmentation data: ' + error.message, 'warning');
            });
    }
    
    /**
     * Draw the current slice based on orientation
     */
    drawSlice() {
        if (!this.volumeData || this.volumeData.length === 0) {
            return;
        }
        
        const [depth, height, width] = this.dimensions;
        const ctx = this.ctx;
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Prepare image data
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Get slice data based on orientation
        let sliceData;
        let segData = null;
        
        if (this.orientation === 'axial') {
            sliceData = this.extractAxialSlice(this.sliceIndex);
            if (this.segmentationData) {
                segData = this.extractAxialSlice(this.sliceIndex, true);
            }
        } else if (this.orientation === 'coronal') {
            sliceData = this.extractCoronalSlice(this.sliceIndex);
            if (this.segmentationData) {
                segData = this.extractCoronalSlice(this.sliceIndex, true);
            }
        } else if (this.orientation === 'sagittal') {
            sliceData = this.extractSagittalSlice(this.sliceIndex);
            if (this.segmentationData) {
                segData = this.extractSagittalSlice(this.sliceIndex, true);
            }
        }
        
        // Apply window/level and create RGBA data
        for (let i = 0; i < sliceData.length; i++) {
            const value = sliceData[i];
            const normalized = this.applyWindowLevel(value);
            
            const baseIndex = i * 4;
            
            // Set grayscale image
            data[baseIndex] = normalized;     // R
            data[baseIndex + 1] = normalized; // G
            data[baseIndex + 2] = normalized; // B
            data[baseIndex + 3] = 255;        // A
            
            // Overlay segmentation if available
            if (segData && segData[i] > 0) {
                data[baseIndex] = 255;        // R (make it red)
                data[baseIndex + 1] = 0;      // G
                data[baseIndex + 2] = 0;      // B
                data[baseIndex + 3] = 150;    // A (semi-transparent)
            }
        }
        
        // Draw the image data to canvas, scaled to fit
        const aspectRatio = width / height;
        let drawWidth, drawHeight;
        
        if (canvasWidth / canvasHeight > aspectRatio) {
            // Canvas is wider than the slice
            drawHeight = canvasHeight;
            drawWidth = drawHeight * aspectRatio;
        } else {
            // Canvas is taller than the slice
            drawWidth = canvasWidth;
            drawHeight = drawWidth / aspectRatio;
        }
        
        // Center the image on the canvas
        const offsetX = (canvasWidth - drawWidth) / 2;
        const offsetY = (canvasHeight - drawHeight) / 2;
        
        // Create a temporary canvas to upscale the image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw the temporary canvas to the main canvas, scaled up
        ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);
        
        // Add slice information overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(offsetX, offsetY, 150, 50);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`Orientation: ${this.orientation}`, offsetX + 10, offsetY + 20);
        ctx.fillText(`Slice: ${this.sliceIndex + 1}/${this.maxSliceIndex + 1}`, offsetX + 10, offsetY + 40);
    }
    
    /**
     * Extract a slice from the volume data in axial orientation
     * @param {number} sliceIndex - Index of the slice
     * @param {boolean} isSegmentation - Whether we're extracting from segmentation data
     * @returns {Float32Array | Uint8Array} - The slice data
     */
    extractAxialSlice(sliceIndex, isSegmentation = false) {
        const [depth, height, width] = this.dimensions;
        const sourceData = isSegmentation ? this.segmentationData : this.volumeData;
        
        // For axial slices (z-plane), we need one complete slice
        const sliceSize = width * height;
        const startIdx = sliceIndex * sliceSize;
        
        // Return the slice data
        return sourceData.slice(startIdx, startIdx + sliceSize);
    }
    
    /**
     * Extract a slice from the volume data in coronal orientation
     * @param {number} sliceIndex - Index of the slice
     * @param {boolean} isSegmentation - Whether we're extracting from segmentation data
     * @returns {Float32Array | Uint8Array} - The slice data
     */
    extractCoronalSlice(sliceIndex, isSegmentation = false) {
        const [depth, height, width] = this.dimensions;
        const sourceData = isSegmentation ? this.segmentationData : this.volumeData;
        
        // For coronal slices (y-plane), we need to extract across multiple z-slices
        const result = isSegmentation ? new Uint8Array(width * depth) : new Float32Array(width * depth);
        
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const volumeIdx = z * (width * height) + sliceIndex * width + x;
                const resultIdx = z * width + x;
                result[resultIdx] = sourceData[volumeIdx];
            }
        }
        
        return result;
    }
    
    /**
     * Extract a slice from the volume data in sagittal orientation
     * @param {number} sliceIndex - Index of the slice
     * @param {boolean} isSegmentation - Whether we're extracting from segmentation data
     * @returns {Float32Array | Uint8Array} - The slice data
     */
    extractSagittalSlice(sliceIndex, isSegmentation = false) {
        const [depth, height, width] = this.dimensions;
        const sourceData = isSegmentation ? this.segmentationData : this.volumeData;
        
        // For sagittal slices (x-plane), we need to extract across multiple z and y values
        const result = isSegmentation ? new Uint8Array(height * depth) : new Float32Array(height * depth);
        
        for (let z = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                const volumeIdx = z * (width * height) + y * width + sliceIndex;
                const resultIdx = z * height + y;
                result[resultIdx] = sourceData[volumeIdx];
            }
        }
        
        return result;
    }
    
    /**
     * Apply window/level transformation to a pixel value
     * @param {number} value - Pixel value
     * @returns {number} - Transformed value (0-255)
     */
    applyWindowLevel(value) {
        // Apply window/level
        const low = this.windowCenter - this.windowWidth / 2;
        const high = this.windowCenter + this.windowWidth / 2;
        
        if (value <= low) {
            return 0;
        } else if (value >= high) {
            return 255;
        } else {
            return Math.round(((value - low) / (high - low)) * 255);
        }
    }
    
    /**
     * Set the current slice index
     * @param {number} index - Slice index
     */
    setSliceIndex(index) {
        if (!this.volumeData) return;
        
        // Ensure index is within bounds
        let max;
        if (this.orientation === 'axial') {
            max = this.dimensions[0] - 1;
        } else if (this.orientation === 'coronal') {
            max = this.dimensions[1] - 1;
        } else {
            max = this.dimensions[2] - 1;
        }
        
        this.sliceIndex = Math.max(0, Math.min(index, max));
        this.maxSliceIndex = max;
        
        // Update UI
        document.getElementById('slicePosition').max = max;
        document.getElementById('slicePosition').value = this.sliceIndex;
        document.getElementById('sliceValue').textContent = this.sliceIndex;
        
        // Redraw
        this.drawSlice();
    }
    
    /**
     * Set the slice orientation
     * @param {string} orientation - 'axial', 'coronal', or 'sagittal'
     */
    setOrientation(orientation) {
        if (!this.volumeData) return;
        
        this.orientation = orientation;
        
        // Reset slice index for the new orientation
        let middle, max;
        if (orientation === 'axial') {
            max = this.dimensions[0] - 1;
        } else if (orientation === 'coronal') {
            max = this.dimensions[1] - 1;
        } else {
            max = this.dimensions[2] - 1;
        }
        
        middle = Math.floor(max / 2);
        this.sliceIndex = middle;
        this.maxSliceIndex = max;
        
        // Update UI
        document.getElementById('slicePosition').max = max;
        document.getElementById('slicePosition').value = this.sliceIndex;
        document.getElementById('sliceValue').textContent = this.sliceIndex;
        
        // Redraw
        this.drawSlice();
    }
    
    /**
     * Show or hide loading overlay
     * @param {boolean} show - Whether to show the loading overlay
     */
    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.remove('d-none');
        } else {
            this.loadingOverlay.classList.add('d-none');
        }
    }
    
    /**
     * Add message to console output
     * @param {string} message - Message to display
     * @param {string} type - Message type (info, success, warning, error)
     */
    addConsoleMessage(message, type = 'info') {
        const console = document.getElementById('statusConsole');
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = message;
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
    }
}

// Initialize slice viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sliceViewer = new SliceViewer('slice-canvas');
});
