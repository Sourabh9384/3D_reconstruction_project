/**
 * Application Controls Module
 * Handles user interactions and connects the 3D and slice viewers
 */
document.addEventListener('DOMContentLoaded', () => {
    // References to our viewer objects
    const viewer3d = window.viewer;
    const sliceViewer = window.sliceViewer;
    
    // Progress indicators
    const processingProgress = document.getElementById('processingProgress');
    const processingStatus = document.getElementById('processingStatus');
    const uploadStatus = document.getElementById('uploadStatus');
    
    // -- DICOM Upload Form --
    const uploadForm = document.getElementById('uploadForm');
    const fileList = document.getElementById('fileList');
    
    // Update file list when files are selected
    document.getElementById('dicomFiles').addEventListener('change', (e) => {
        const files = e.target.files;
        updateFileList(files);
    });
    
    // Display the list of selected files
    function updateFileList(files) {
        fileList.innerHTML = '';
        if (files.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-unstyled small';
            
            for (let i = 0; i < files.length; i++) {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-file-medical me-1"></i> ${files[i].name}`;
                ul.appendChild(li);
            }
            
            fileList.appendChild(ul);
            addConsoleMessage(`Selected ${files.length} DICOM files`);
        } else {
            fileList.innerHTML = 'No files selected';
        }
    }
    
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('dicomFiles');
        const files = fileInput.files;
        
        if (files.length === 0) {
            addConsoleMessage('No files selected for upload', 'warning');
            uploadStatus.textContent = 'Please select DICOM files to upload';
            return;
        }
        
        addConsoleMessage(`Uploading ${files.length} DICOM files...`);
        uploadStatus.textContent = 'Uploading...';
        
        // Create form data
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('dicomFiles', files[i]);
        }
        
        // Send files to server
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                addConsoleMessage(data.message, 'success');
                uploadStatus.textContent = data.message;
                
                // Clear the file input
                fileInput.value = '';
                fileList.innerHTML = '';
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            addConsoleMessage('Upload error: ' + error.message, 'error');
            uploadStatus.textContent = 'Error: ' + error.message;
        });
    });
    
    // -- Process Button --
    const processBtn = document.getElementById('processBtn');
    processBtn.addEventListener('click', () => {
        // Start processing pipeline
        addConsoleMessage('Starting medical image processing pipeline...');
        
        // Show progress
        processingProgress.classList.remove('d-none');
        processingProgress.querySelector('.progress-bar').style.width = '0%';
        processingProgress.querySelector('.progress-bar').classList.remove('bg-danger');
        
        // Simulate processing stages with fetch call
        fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                addConsoleMessage('Processing complete', 'success');
                processingProgress.querySelector('.progress-bar').style.width = '100%';
                processingStatus.textContent = 'Processing complete';
                
                // Load data into viewers
                sliceViewer.loadVolumeData();
                viewer3d.loadModel();
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Processing error:', error);
            addConsoleMessage('Processing error: ' + error.message, 'error');
            processingProgress.querySelector('.progress-bar').style.width = '100%';
            processingProgress.querySelector('.progress-bar').classList.add('bg-danger');
            processingStatus.textContent = 'Error: ' + error.message;
        });

        // Simulate progress updates
        simulateProgressUpdates();
    });

    // Function to simulate progress updates
    function simulateProgressUpdates() {
        const progressBar = processingProgress.querySelector('.progress-bar');
        const stages = [
            { percent: 20, message: "Loading DICOM files..." },
            { percent: 40, message: "Converting to HU units..." },
            { percent: 60, message: "Running segmentation..." },
            { percent: 80, message: "Generating 3D model..." },
            { percent: 95, message: "Finalizing..." }
        ];
        
        let currentStage = 0;
        
        const interval = setInterval(() => {
            if (currentStage >= stages.length) {
                clearInterval(interval);
                return;
            }
            
            const stage = stages[currentStage];
            progressBar.style.width = `${stage.percent}%`;
            processingStatus.textContent = stage.message;
            addConsoleMessage(stage.message);
            
            currentStage++;
        }, 1500);
    }
    
    // -- 3D Viewer Controls --
    
    // Reset View
    document.getElementById('resetViewBtn').addEventListener('click', () => {
        viewer3d.resetView();
    });
    
    // Zoom In
    document.getElementById('zoomInBtn').addEventListener('click', () => {
        viewer3d.zoomIn();
    });
    
    // Zoom Out
    document.getElementById('zoomOutBtn').addEventListener('click', () => {
        viewer3d.zoomOut();
    });
    
    // Fullscreen
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        viewer3d.toggleFullscreen();
    });
    
    // Model Color
    document.getElementById('modelColor').addEventListener('input', (e) => {
        viewer3d.setModelColor(e.target.value);
    });
    
    // Model Opacity
    document.getElementById('modelOpacity').addEventListener('input', (e) => {
        const opacity = parseFloat(e.target.value);
        document.getElementById('opacityValue').textContent = opacity.toFixed(1);
        viewer3d.setModelOpacity(opacity);
    });
    
    // Wireframe Toggle
    document.getElementById('showWireframe').addEventListener('change', (e) => {
        viewer3d.setWireframeVisibility(e.target.checked);
    });
    
    // -- Slice Viewer Controls --
    
    // Slice Position
    document.getElementById('slicePosition').addEventListener('input', (e) => {
        const index = parseInt(e.target.value);
        document.getElementById('sliceValue').textContent = index;
        sliceViewer.setSliceIndex(index);
    });
    
    // Orientation Buttons
    document.getElementById('axialBtn').addEventListener('click', (e) => {
        setActiveButton(e.target);
        sliceViewer.setOrientation('axial');
    });
    
    document.getElementById('coronalBtn').addEventListener('click', (e) => {
        setActiveButton(e.target);
        sliceViewer.setOrientation('coronal');
    });
    
    document.getElementById('sagittalBtn').addEventListener('click', (e) => {
        setActiveButton(e.target);
        sliceViewer.setOrientation('sagittal');
    });
    
    // Helper to set active button in a group
    function setActiveButton(button) {
        // Remove active class from all buttons in the group
        const group = button.parentElement;
        const buttons = group.querySelectorAll('.btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to the clicked button
        button.classList.add('active');
    }
    
    // -- Console Functions --
    
    // Helper function to add messages to the console
    function addConsoleMessage(message, type = 'info') {
        const console = document.getElementById('statusConsole');
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = message;
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
    }
    
    // Expose console message function globally
    window.addConsoleMessage = addConsoleMessage;
    
    // Initialize with a welcome message
    addConsoleMessage('Welcome to MedView 3D - Medical Image Reconstruction System');
    addConsoleMessage('You can upload your own DICOM files using the upload form.');
    addConsoleMessage('After uploading files or to use sample data, click "Run Pipeline" to process the data.');
});
