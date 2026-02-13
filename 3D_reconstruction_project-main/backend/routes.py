import os
import logging
import shutil
from werkzeug.utils import secure_filename
from flask import send_file, send_from_directory, request, jsonify
from backend.processing import process_dicom, run_segmentation, create_3d_model

logger = logging.getLogger(__name__)

def register_routes(app):
    """Register all application routes"""

    # Directory paths
    output_dir = "backend/output"
    models_dir = "backend/models"
    dicom_path = "SlicerRtData/eclipse-8.1.20-phantom-prostate/Original/CT"
    upload_dir = "uploads/dicom"
    
    # Ensure directories exist
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(dicom_path, exist_ok=True)
    os.makedirs(upload_dir, exist_ok=True)

    @app.route("/api/model", methods=["GET"])
    def serve_model():
        """Serve the 3D model file"""
        try:
            model_path = os.path.join(models_dir, "organ_model.stl")
            if not os.path.exists(model_path):
                return jsonify({"error": "Model file not found"}), 404
            return send_file(model_path)
        except Exception as e:
            logger.error(f"Error serving model: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/volume", methods=["GET"])
    def serve_volume():
        """Serve the processed volume data for slice viewing"""
        try:
            volume_path = os.path.join(output_dir, "volume.npy")
            if not os.path.exists(volume_path):
                return jsonify({"error": "Volume data not found"}), 404
            return send_file(volume_path)
        except Exception as e:
            logger.error(f"Error serving volume data: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/segmented-volume", methods=["GET"])
    def serve_segmented_volume():
        """Serve the segmented volume data"""
        try:
            segmented_path = os.path.join(output_dir, "segmented_volume.npy")
            if not os.path.exists(segmented_path):
                return jsonify({"error": "Segmented volume data not found"}), 404
            return send_file(segmented_path)
        except Exception as e:
            logger.error(f"Error serving segmented volume: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/upload", methods=["POST"])
    def upload_dicom():
        """Handle multiple DICOM file uploads"""
        try:
            # Check if we have any files in the request
            if 'dicomFiles' not in request.files:
                return jsonify({"status": "error", "message": "No files part in the request"}), 400
                
            # Get all uploaded files
            files = request.files.getlist('dicomFiles')
            
            if len(files) == 0 or all(file.filename == '' for file in files):
                return jsonify({"status": "error", "message": "No files selected"}), 400
            
            # Clear existing DICOM directory to ensure a clean slate
            if os.path.exists(dicom_path):
                for old_file in os.listdir(dicom_path):
                    file_path = os.path.join(dicom_path, old_file)
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                
            # Make sure directory exists
            os.makedirs(dicom_path, exist_ok=True)
            
            # Save all files
            uploaded_count = 0
            for file in files:
                if file.filename != '':
                    filename = secure_filename(file.filename)
                    save_path = os.path.join(dicom_path, filename)
                    file.save(save_path)
                    uploaded_count += 1
            
            logger.info(f"Successfully uploaded {uploaded_count} DICOM files")
            return jsonify({
                "status": "success", 
                "message": f"Successfully uploaded {uploaded_count} DICOM files"
            })
            
        except Exception as e:
            logger.error(f"Error uploading DICOM files: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500
    
    @app.route("/api/process", methods=["POST"])
    def start_processing():
        """Start the processing pipeline on the uploaded DICOM data"""
        try:
            # 1. Process DICOM files
            process_dicom()
            
            # 2. Run segmentation
            run_segmentation()
            
            # 3. Create 3D model
            create_3d_model()
            
            return jsonify({"status": "success", "message": "Processing complete"})
        except Exception as e:
            logger.error(f"Processing error: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        """Serve frontend files or return to index.html for SPA routing"""
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")
