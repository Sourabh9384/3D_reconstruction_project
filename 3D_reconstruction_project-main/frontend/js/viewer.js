/**
 * 3D Viewer Module
 * Handles 3D rendering of medical models using Three.js
 */
class MedicalModelViewer {
    constructor(containerId) {
        // DOM container
        this.container = document.getElementById(containerId);
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.wireframe = null;
        
        // Overlay elements
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Model properties
        this.modelColor = 0x3498db;
        this.modelOpacity = 1.0;
        this.showWireframe = false;
        
        // Stats
        this.vertexCount = 0;
        this.faceCount = 0;
        
        // Initialize the viewer
        this.initialize();
    }
    
    /**
     * Initialize the Three.js scene, camera, renderer and controls
     */
    initialize() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Set up camera
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspectRatio = width / height;
        this.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
        this.camera.position.set(0, 0, 100);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        
        // Set up orbit controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        this.scene.add(directionalLight);
        
        // Add grid helper for orientation
        const gridHelper = new THREE.GridHelper(50, 50, 0x555555, 0x333333);
        this.scene.add(gridHelper);
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start animation loop
        this.animate();
        
        // Update status
        this.addConsoleMessage('3D viewer initialized');
    }
    
    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Handle window resize events
     */
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    /**
     * Load STL model from the server
     */
    loadModel() {
        this.showLoading(true);
        this.addConsoleMessage('Loading 3D model...');
        
        // Remove existing model if present
        if (this.model) {
            this.scene.remove(this.model);
            this.model = null;
        }
        
        if (this.wireframe) {
            this.scene.remove(this.wireframe);
            this.wireframe = null;
        }
        
        // Use STLLoader to load the model
        const loader = new THREE.STLLoader();
        loader.load('/api/model', 
            // onLoad callback
            (geometry) => {
                // Update stats
                this.vertexCount = geometry.attributes.position.count;
                this.faceCount = this.vertexCount / 3;
                document.getElementById('vertexCount').textContent = this.vertexCount.toLocaleString();
                document.getElementById('faceCount').textContent = this.faceCount.toLocaleString();
                
                // Center the geometry
                geometry.computeBoundingBox();
                const center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                geometry.translate(-center.x, -center.y, -center.z);
                
                // Create material
                const material = new THREE.MeshStandardMaterial({
                    color: this.modelColor,
                    opacity: this.modelOpacity,
                    transparent: this.modelOpacity < 1.0,
                    side: THREE.DoubleSide
                });
                
                // Create mesh
                this.model = new THREE.Mesh(geometry, material);
                this.scene.add(this.model);
                
                // Also create wireframe
                const wireframeMaterial = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    opacity: 0.2,
                    transparent: true
                });
                
                const wireframeGeometry = new THREE.WireframeGeometry(geometry);
                this.wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
                this.wireframe.visible = this.showWireframe;
                this.scene.add(this.wireframe);
                
                // Reset camera to fit model
                this.resetView();
                
                this.showLoading(false);
                this.addConsoleMessage('Model loaded successfully', 'success');
            },
            // onProgress callback
            (xhr) => {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                this.addConsoleMessage(`Loading model: ${percent}% complete`);
            },
            // onError callback
            (error) => {
                console.error('Error loading model:', error);
                this.showLoading(false);
                this.addConsoleMessage('Error loading model: ' + error, 'error');
            }
        );
    }
    
    /**
     * Reset camera view to fit the model
     */
    resetView() {
        if (!this.model) return;
        
        // Compute bounding sphere
        this.model.geometry.computeBoundingSphere();
        const sphere = this.model.geometry.boundingSphere;
        
        // Position camera to fit the bounding sphere
        const offset = sphere.radius * 2.5;
        this.camera.position.set(offset, offset, offset);
        this.camera.lookAt(sphere.center);
        this.controls.target.copy(sphere.center);
        this.controls.update();
    }
    
    /**
     * Zoom the camera in
     */
    zoomIn() {
        this.camera.position.multiplyScalar(0.9);
        this.controls.update();
    }
    
    /**
     * Zoom the camera out
     */
    zoomOut() {
        this.camera.position.multiplyScalar(1.1);
        this.controls.update();
    }
    
    /**
     * Enter or exit fullscreen mode
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                this.addConsoleMessage('Error attempting to enable fullscreen: ' + err.message, 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Set model color
     * @param {string} colorHex - Color in hex format (#RRGGBB)
     */
    setModelColor(colorHex) {
        this.modelColor = parseInt(colorHex.replace('#', '0x'), 16);
        if (this.model) {
            this.model.material.color.set(this.modelColor);
        }
    }
    
    /**
     * Set model opacity
     * @param {number} opacity - Opacity value (0-1)
     */
    setModelOpacity(opacity) {
        this.modelOpacity = opacity;
        if (this.model) {
            this.model.material.opacity = opacity;
            this.model.material.transparent = opacity < 1.0;
        }
    }
    
    /**
     * Toggle wireframe visibility
     * @param {boolean} show - Whether to show the wireframe
     */
    setWireframeVisibility(show) {
        this.showWireframe = show;
        if (this.wireframe) {
            this.wireframe.visible = show;
        }
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

// Initialize viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.viewer = new MedicalModelViewer('three-container');
});
