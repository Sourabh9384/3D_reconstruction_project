🧠 3D Reconstruction of Organs from CT/MRI Scans for Enhanced Diagnostic Visualization
📌 Overview

This project enables 3D visualization of anatomical structures from DICOM-based CT/MRI scans. It helps radiologists and medical professionals to visualize internal organs more interactively and accurately using:
Preprocessing of DICOM images
Semantic segmentation using deep learning
3D surface reconstruction
Interactive web-based visualization using Three.js

--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 🌟 Key Features

- 📂 Upload and visualize DICOM series
- ⚙️ Preprocessing and noise reduction
- 🧠 U-Net based organ segmentation
- 🏗️ 3D reconstruction of organ structure
- 🔍 Interactive 3D and slice viewers in browser
- 🎨 Model customization (color, opacity, wireframe)
- 📈 Real-time status updates

--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 📁 Project Structure

MedicalImageReconstruction/
│
├── attached_assets/       # Contains processing logic
│   ├── dicom_preprocessing.py
│   ├── segmentation.py
│   ├── reconstruction.py
│   ├── train_segmentation.py
│   └── server.py
│
├── backend/               # FastAPI backend logic
│   ├── preprocessing.py
│   └── routes.py
│
├── frontend/              # Web interface
│   ├── index.html
│   ├── styles.css
│   └── script.js
│
├── SlicerRtData/          # Sample DICOM data
├── uploads/               # Uploaded DICOM files
├── venv/                  # Virtual environment
├── app.py                 # App launcher (Flask/FastAPI)
├── main.py                # Main logic launcher
├── generated-icon.png     # UI icon
└── requirements.txt       # Python package requirements

--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## ⚙️ Installation

### Prerequisites:
- Python 3.8+
- pip

### Step-by-Step Setup:

```bash
# 1. locate the folder
cd MedicalImageReconstruction

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows

# 3. Install required packages
pip install -r requirements.txt

# 4. Start the server
python main.py

# 5. Open your browser and go to
http://127.0.0.1:5000
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

🚀 How It Works

DICOM Upload: Upload a complete DICOM image series from a CT/MRI scan.
Preprocessing: Files are cleaned and standardized for segmentation.
Segmentation: A U-Net model isolates the organ of interest from the volume.
3D Reconstruction: Segmented images are converted into 3D mesh using VTK.
Visualization: Interactive model and slice viewer rendered in the browser.

🛠️ Technologies Used

Layer	             Tools/Frameworks
Frontend	    HTML5, CSS3, JavaScript, Three.js
Backend             Flask, Python
Processing	    PyDICOM, SimpleITK, NumPy, OpenCV
Segmentation        U-Net, TensorFlow/Keras
3D	            VTK, MeshLab-compatible exports (.STL/.OBJ)
UI Styling	    Bootstrap (optional), Custom JS/CSS






