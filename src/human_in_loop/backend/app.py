import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

# Add the parent directory to the Python path to allow imports from src/config
# This ensures config.py can be imported correctly
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from config import ORIGINAL_CHAPTER_PATH, SPUN_CHAPTER_PATH, REVIEW_COMMENTS_PATH

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes, allowing our React frontend to access it

# Define the base directory for our data files
# This assumes app.py is in src/human_in_loop/backend/
# and data files are in src/data/
DATA_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))

@app.route('/')
def index():
    """Basic route to confirm the server is running."""
    return "Human-in-the-Loop Backend is running!"

@app.route('/content/<filename>')
def get_content(filename):
    """
    Serves specific content files (original, spun, review comments).
    """
    file_path = None
    if filename == 'original_chapter.txt':
        file_path = ORIGINAL_CHAPTER_PATH
    elif filename == 'spun_chapter.txt':
        file_path = SPUN_CHAPTER_PATH
    elif filename == 'review_comments.txt':
        file_path = REVIEW_COMMENTS_PATH
    else:
        return jsonify({"error": "File not found or unauthorized access."}), 404

    # Construct the absolute path to the file
    abs_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', file_path)
    
    # Ensure the file exists before attempting to read
    if not os.path.exists(abs_file_path):
        return jsonify({"error": f"File '{filename}' not found at {abs_file_path}"}), 404

    try:
        with open(abs_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": f"Error reading file {filename}: {str(e)}"}), 500

@app.route('/screenshot')
def get_screenshot():
    """
    Serves the screenshot image.
    """
    # Assuming screenshot is in src/data/raw/chapter_screenshot.png
    # You might need to adjust this path based on your config.py
    screenshot_path = os.path.abspath(os.path.join(DATA_BASE_DIR, 'raw', 'chapter_screenshot.png'))
    
    if not os.path.exists(screenshot_path):
        return jsonify({"error": "Screenshot not found."}), 404
    
    # Flask's send_from_directory is good for serving static files
    # We need to send from the directory where the file resides
    screenshot_dir = os.path.dirname(screenshot_path)
    screenshot_filename = os.path.basename(screenshot_path)
    
    return send_from_directory(screenshot_dir, screenshot_filename)

if __name__ == '__main__':
    # Ensure the data directories exist before running the app
    os.makedirs(os.path.dirname(ORIGINAL_CHAPTER_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(SPUN_CHAPTER_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(REVIEW_COMMENTS_PATH), exist_ok=True)
    
    # Run the Flask app
    # In a production environment, use a WSGI server like Gunicorn or uWSGI
    app.run(debug=True, port=5000)  # Run on port 5000
