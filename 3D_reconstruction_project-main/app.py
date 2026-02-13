import os
import logging
from flask import Flask
from flask_cors import CORS
from backend.routes import register_routes

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask application
app = Flask(__name__, static_folder="frontend")
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Enable CORS
CORS(app)

# Register routes
register_routes(app)

logger.info("Medical 3D Reconstruction Application initialized")
