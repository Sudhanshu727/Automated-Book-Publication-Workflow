# src/config.py

import os

# Get the absolute path to the directory containing this script (src/)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Navigate up two levels from src/ to reach the project root (e.g., E:\Automated-Book-Publication-Workflow)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, '..', '..'))

# Your Google Gemini API key.
# It's highly recommended to load this from environment variables in a production setup
# For development, you can paste it directly here, but be careful not to commit it to public repos.
# Example: GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
GEMINI_API_KEY = "AIzaSyBSi63e2XDkKmouF3d-gaQDvqOe1qn-SB8" # Leave empty, Canvas will provide it at runtime.

# Define paths for input and output files relative to PROJECT_ROOT
ORIGINAL_CHAPTER_PATH = os.path.join(PROJECT_ROOT, "src", "data", "raw", "chapter_content.txt")
SCREENSHOT_OUTPUT_FILE_PATH = os.path.join(PROJECT_ROOT, "src", "data", "raw", "chapter_screenshot.png")

# ChromaDB configuration - NOW ABSOLUTE AND RELATIVE TO PROJECT_ROOT
CHROMA_DB_PATH = os.path.join(PROJECT_ROOT, "src", "database", "chroma_db") # Absolute path where ChromaDB will store its data
CHROMA_COLLECTION_NAME = "book_chapters" # Name of the collection for our chapters

# --- Centralized Chapter ID ---
# This ID will be used across all Python scripts and the Flask backend
# to ensure consistency when storing and retrieving data from ChromaDB.
DEFAULT_CHAPTER_ID = "the_gates_of_morning_book1_chapter1"

# These paths are no longer directly used for saving, but can remain as references
# SPUN_CHAPTER_PATH and REVIEW_COMMENTS_PATH are conceptually managed by ChromaDB now
SPUN_CHAPTER_PATH = os.path.join(PROJECT_ROOT, "src", "data", "processed", "spun_chapter.txt")
REVIEW_COMMENTS_PATH = os.path.join(PROJECT_ROOT, "src", "data", "processed", "review_comments.txt")
