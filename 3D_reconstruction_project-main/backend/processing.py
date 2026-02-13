import os
import numpy as np
import logging
import SimpleITK as sitk
import scipy.ndimage
from skimage import measure
from stl import mesh

# Configure logging
logger = logging.getLogger(__name__)

# Paths
DICOM_PATH = "SlicerRtData/eclipse-8.1.20-phantom-prostate/Original/CT"
OUTPUT_DIR = "backend/output"
MODELS_DIR = "backend/models"
VOLUME_PATH = os.path.join(OUTPUT_DIR, "volume.npy")
SPACING_PATH = os.path.join(OUTPUT_DIR, "spacing.npy")
SEGMENTED_VOLUME_PATH = os.path.join(OUTPUT_DIR, "segmented_volume.npy")
MODEL_SAVE_PATH = os.path.join(MODELS_DIR, "segmentation_model.pth")
STL_MODEL_PATH = os.path.join(MODELS_DIR, "organ_model.stl")

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

def generate_synthetic_volume():
    """
    Generate a synthetic volume for demonstration purposes
    """
    logger.info("Generating synthetic volume data...")
    
    try:
        # Create a 128x128x128 volume
        size = 128
        volume = np.zeros((size, size, size), dtype=np.float32)
        
        # Create some simple structures
        # 1. A sphere in the center
        center = size // 2
        radius = size // 4
        
        for z in range(size):
            for y in range(size):
                for x in range(size):
                    # Distance from center
                    distance = np.sqrt((x - center)**2 + (y - center)**2 + (z - center)**2)
                    # HU values: air (-1000), soft tissue (0-100), bone (700+)
                    if distance < radius:
                        # Main sphere (simulating soft tissue)
                        volume[z, y, x] = 50
                    elif distance < radius + 5 and distance >= radius:
                        # Outer shell (simulating bone or contrast)
                        volume[z, y, x] = 800
        
        # 2. Add a smaller offset sphere (simulating another organ or tumor)
        small_center = [center + 15, center - 10, center]
        small_radius = size // 8
        
        for z in range(size):
            for y in range(size):
                for x in range(size):
                    distance = np.sqrt((x - small_center[0])**2 + 
                                       (y - small_center[1])**2 + 
                                       (z - small_center[2])**2)
                    if distance < small_radius:
                        volume[z, y, x] = 100  # Different HU value
        
        # Add some noise
        noise = np.random.normal(0, 10, volume.shape)
        volume = volume + noise
        
        # Create spacing array (1mm isotropic)
        spacing = np.array([1.0, 1.0, 1.0])
        
        # Save processed volume
        np.save(VOLUME_PATH, volume)
        np.save(SPACING_PATH, spacing)
        logger.info(f"Saved synthetic volume to: {VOLUME_PATH}")
        logger.info(f"Volume shape: {volume.shape}")
        
        return True
    except Exception as e:
        logger.error(f"Error generating synthetic volume: {e}")
        raise

def process_dicom():
    """
    Load and process DICOM series: convert to HU and resample to isotropic spacing
    For demo purposes, we'll generate a synthetic volume if DICOM files are not available
    """
    logger.info("Starting DICOM processing...")
    
    try:
        # Check if DICOM directory exists and contains files
        if not os.path.exists(DICOM_PATH) or len(os.listdir(DICOM_PATH)) == 0:
            logger.warning(f"No DICOM files found in {DICOM_PATH}, using synthetic data instead")
            return generate_synthetic_volume()
        
        # Find all DICOM files, including those without proper extensions
        dicom_files = []
        for file in os.listdir(DICOM_PATH):
            file_path = os.path.join(DICOM_PATH, file)
            if os.path.isfile(file_path):
                # Check if it's a DICOM file even without extension
                try:
                    if file.lower().endswith(('.dcm', '.dicom')) or '.' not in file:
                        dicom_files.append(file_path)
                except:
                    pass
        
        if not dicom_files:
            logger.warning(f"No DICOM files found in {DICOM_PATH}, using synthetic data instead")
            return generate_synthetic_volume()
            
        logger.info(f"Found {len(dicom_files)} potential DICOM files")
        
        # Read DICOM series
        logger.info(f"Reading DICOM series from {DICOM_PATH}...")
        
        # Try using ImageSeriesReader with GDCM series IDs
        try:
            reader = sitk.ImageSeriesReader()
            series_IDs = reader.GetGDCMSeriesIDs(DICOM_PATH)
            
            if series_IDs:
                logger.info(f"Found {len(series_IDs)} DICOM series")
                dicom_series_files = reader.GetGDCMSeriesFileNames(DICOM_PATH, series_IDs[0])
                reader.SetFileNames(dicom_series_files)
                image = reader.Execute()
            else:
                # If no series found, try to sort and read files directly
                logger.info("No DICOM series found, attempting manual sorting...")
                
                # Read individual files to extract position info for sorting
                slices_data = []
                for file_path in dicom_files:
                    try:
                        slice_img = sitk.ReadImage(file_path)
                        # Try to get position information from various DICOM tags
                        position = 0
                        if "0020|0032" in slice_img.GetMetaDataKeys():  # Image Position Patient
                            position = float(slice_img.GetMetaData("0020|0032").split('\\')[2])
                        elif "0020|1041" in slice_img.GetMetaDataKeys():  # Slice Location
                            position = float(slice_img.GetMetaData("0020|1041"))
                        elif "0020|0013" in slice_img.GetMetaDataKeys():  # Instance Number
                            position = float(slice_img.GetMetaData("0020|0013"))
                            
                        slices_data.append((position, file_path, slice_img))
                    except Exception as slice_error:
                        logger.warning(f"Error reading {file_path}: {slice_error}")
                
                if not slices_data:
                    logger.warning("Could not read any valid DICOM files, using synthetic data")
                    return generate_synthetic_volume()
                
                # Sort slices by position
                slices_data.sort(key=lambda x: x[0])
                logger.info(f"Successfully sorted {len(slices_data)} DICOM slices")
                
                # Try to join the series or use the first slice for dimensions
                reader = sitk.ImageSeriesReader()
                reader.SetFileNames([x[1] for x in slices_data])
                try:
                    image = reader.Execute()
                except Exception as series_error:
                    logger.warning(f"Error joining series: {series_error}")
                    # If can't join the series, use just the first valid slice
                    # for a simple demonstration (in real app, we would handle this better)
                    image = slices_data[0][2]
        except Exception as reader_error:
            logger.error(f"Error reading DICOM series: {reader_error}")
            return generate_synthetic_volume()
        
        # Convert to numpy array
        image_array = sitk.GetArrayFromImage(image)  # shape: (z, y, x)
        origin = image.GetOrigin()
        spacing = list(image.GetSpacing())[::-1]  # Convert (x,y,z) to (z,y,x)
        logger.info(f"Loaded DICOM with shape: {image_array.shape}")
        logger.info(f"Original Spacing: {spacing}")
        
        # Convert to Hounsfield Units (HU)
        logger.info("Converting to HU...")
        image_array = image_array.astype(np.int16)
        image_array[image_array == -2000] = 0  # Handle air
        
        # Resample to 1mm x 1mm x 1mm
        logger.info("Resampling to isotropic 1mm spacing...")
        resampled_volume, new_spacing = resample(image_array, spacing)
        logger.info(f"Resampled shape: {resampled_volume.shape}")
        logger.info(f"New spacing: {new_spacing}")
        
        # Save processed volume
        np.save(VOLUME_PATH, resampled_volume)
        np.save(SPACING_PATH, new_spacing)
        logger.info(f"Saved volume to: {VOLUME_PATH}")
        logger.info(f"Saved spacing to: {SPACING_PATH}")
        
        return True
    except Exception as e:
        logger.error(f"Error in DICOM processing: {e}")
        # If any error occurs, fall back to synthetic data
        logger.warning("Falling back to synthetic data due to error")
        return generate_synthetic_volume()

def resample(volume, original_spacing, new_spacing=[1, 1, 1]):
    """Resample volume to new spacing"""
    resize_factor = np.array(original_spacing) / np.array(new_spacing)
    new_shape = np.round(volume.shape * resize_factor)
    real_resize_factor = new_shape / volume.shape
    new_spacing = np.array(original_spacing) / real_resize_factor
    resampled = scipy.ndimage.zoom(volume, real_resize_factor, mode='nearest')
    return resampled, new_spacing

def run_segmentation():
    """
    Run segmentation on the processed volume
    For this simplified version, we'll create a basic threshold-based segmentation
    """
    logger.info("Starting simplified segmentation...")
    
    try:
        # Load volume
        logger.info(f"Loading volume from {VOLUME_PATH}...")
        volume = np.load(VOLUME_PATH)
        
        # Simple threshold-based segmentation
        # We'll segment anything above a certain HU value (e.g., bone or contrast)
        threshold = 200  # HU value threshold, could be adjusted
        logger.info(f"Segmenting with threshold {threshold}...")
        segmented_volume = (volume > threshold).astype(np.uint8)
        
        # Save the segmented volume
        np.save(SEGMENTED_VOLUME_PATH, segmented_volume)
        logger.info(f"Segmentation complete. Saved to {SEGMENTED_VOLUME_PATH}")
        
        return True
    except Exception as e:
        logger.error(f"Error in segmentation: {e}")
        raise

def create_3d_model():
    """
    Create a 3D model from the segmented volume using marching cubes
    This is a wrapper around the functionality in reconstruction.py
    """
    logger.info("Starting 3D reconstruction...")
    
    try:
        # Load segmented volume
        if not os.path.exists(SEGMENTED_VOLUME_PATH):
            logger.error(f"Segmented volume not found at {SEGMENTED_VOLUME_PATH}")
            raise FileNotFoundError(f"Segmented volume not found at {SEGMENTED_VOLUME_PATH}")
        
        volume = np.load(SEGMENTED_VOLUME_PATH)
        logger.info(f"Loaded segmented volume with shape: {volume.shape}")
        
        # Run Marching Cubes
        volume = volume.transpose(2, 1, 0)  # Shape to (X,Y,Z)
        verts, faces, _, _ = measure.marching_cubes(volume, level=0.5)
        
        # Save STL model
        stl_mesh = mesh.Mesh(np.zeros(faces.shape[0], dtype=mesh.Mesh.dtype))
        for i, f in enumerate(faces):
            for j in range(3):
                stl_mesh.vectors[i][j] = verts[f[j]]
        stl_mesh.save(STL_MODEL_PATH)
        logger.info(f"STL model saved to: {STL_MODEL_PATH}")
        
        return True
    except Exception as e:
        logger.error(f"Error in 3D reconstruction: {e}")
        raise
