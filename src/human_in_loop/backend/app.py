# src/human_in_loop/backend/app.py
from dotenv import load_dotenv
load_dotenv() # This loads variables from .env file

import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from datetime import datetime

# Add the parent directory to the Python path to allow imports from src/config and src/database
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Import DEFAULT_CHAPTER_ID and CHROMA_DB_PATH
from config import ORIGINAL_CHAPTER_PATH, SCREENSHOT_OUTPUT_FILE_PATH, DEFAULT_CHAPTER_ID, CHROMA_DB_PATH
from database.chroma_manager import ChromaManager # Import ChromaManager
# Import the writer_agent and reviewer_agent to trigger them
from ai_agents.writer_agent import spin_chapter_content
from ai_agents.reviewer_agent import review_chapter_content
# Import the reward model functions
from rl_system.reward_model import calculate_review_reward, calculate_human_action_reward, log_workflow_event

app = Flask(__name__)
CORS(app)

# Initialize ChromaManager GLOBALLY when the Flask app starts
try:
    app.logger.info("Initializing ChromaManager globally for Flask app...")
    chroma_manager = ChromaManager()
    app.logger.info(f"ChromaManager initialized. Collection: '{chroma_manager.collection.name}' at path: '{CHROMA_DB_PATH}'")
    collection_count = chroma_manager.collection.count()
    app.logger.info(f"ChromaDB collection '{chroma_manager.collection.name}' has {collection_count} documents on Flask startup.")
except Exception as e:
    app.logger.error(f"CRITICAL ERROR: Failed to initialize ChromaManager globally: {e}")
    chroma_manager = None

DATA_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))

@app.route('/')
def index():
    app.logger.info("Human-in-the-Loop Backend is running!")
    return "Human-in-the-Loop Backend is running!"

@app.route('/content/<chapter_id>/<version_type>')
def get_chapter_version(chapter_id: str, version_type: str):
    app.logger.info(f"Received request for chapter_id: {chapter_id}, version_type: {version_type}")
    if chroma_manager is None:
        app.logger.error("ChromaManager not initialized globally. Cannot fetch content.")
        return jsonify({"error": "Backend database not available."}), 500
    if version_type not in ["original", "spun", "review_comments"]:
        app.logger.error(f"Invalid version type requested: {version_type}")
        return jsonify({"error": "Invalid version type."}), 400
    if chapter_id != DEFAULT_CHAPTER_ID:
        app.logger.warning(f"Requested chapter_id '{chapter_id}' does not match DEFAULT_CHAPTER_ID '{DEFAULT_CHAPTER_ID}'.")
        return jsonify({"error": f"Chapter ID '{chapter_id}' not found."}), 404

    app.logger.info(f"Attempting to retrieve latest version for chapter_id='{chapter_id}', version_type='{version_type}' from ChromaDB.")
    latest_version = chroma_manager.get_latest_chapter_version(chapter_id, version_type)
    
    if latest_version:
        app.logger.info(f"Successfully retrieved {version_type} content for {chapter_id}.")
        return jsonify({"content": latest_version['content'], "id": latest_version['id'], "metadata": latest_version['metadata']})
    else:
        app.logger.warning(f"No {version_type} content found in ChromaDB for chapter ID: {chapter_id}")
        return jsonify({"error": f"No {version_type} content found for chapter ID: {chapter_id}"}), 404

@app.route('/screenshot')
def get_screenshot():
    app.logger.info("Received request for screenshot.")
    if chroma_manager is None:
        app.logger.warning("ChromaManager not initialized, but attempting to serve screenshot.")

    abs_screenshot_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', SCREENSHOT_OUTPUT_FILE_PATH))
    
    if not os.path.exists(abs_screenshot_path):
        app.logger.error(f"Screenshot not found at: {abs_screenshot_path}")
        return jsonify({"error": "Screenshot not found."}), 404
    
    screenshot_dir = os.path.dirname(abs_screenshot_path)
    screenshot_filename = os.path.basename(abs_screenshot_path)
    
    app.logger.info(f"Serving screenshot from: {abs_screenshot_path}")
    return send_from_directory(screenshot_dir, screenshot_filename)

@app.route('/approve_chapter/<chapter_id>', methods=['POST'])
def approve_chapter(chapter_id: str):
    app.logger.info(f"Received request to approve chapter: {chapter_id}")
    if chapter_id != DEFAULT_CHAPTER_ID:
        app.logger.warning(f"Attempt to approve invalid chapter ID: {chapter_id}")
        return jsonify({"error": "Invalid chapter ID."}), 400
    if chroma_manager is None:
        app.logger.error("ChromaManager not initialized globally. Cannot approve chapter.")
        return jsonify({"error": "Backend database not available."}), 500

    try:
        latest_spun_version = chroma_manager.get_latest_chapter_version(chapter_id, "spun")
        if not latest_spun_version:
            app.logger.error(f"Cannot approve chapter {chapter_id}: No spun content found to approve.")
            return jsonify({"error": "No spun content found to approve."}), 404

        approval_metadata = {
            "human_action": "approved",
            "approved_spun_version_id": latest_spun_version['id'],
            "approved_timestamp": datetime.now().isoformat()
        }
        version_id = chroma_manager.add_chapter_version(
            chapter_id=chapter_id,
            content=latest_spun_version['content'],
            version_type="approved",
            metadata=approval_metadata
        )

        if version_id:
            app.logger.info(f"Chapter '{chapter_id}' successfully approved. New version ID: {version_id}")
            # --- RL Logging: Human Approval ---
            reward = calculate_human_action_reward("approved")
            log_workflow_event("human_action_approved", chapter_id, version_id, reward, {"approved_version_id": latest_spun_version['id']})
            # --- End RL Logging ---
            return jsonify({"message": f"Chapter '{chapter_id}' approved successfully.", "version_id": version_id}), 200
        else:
            app.logger.error(f"Failed to record approval for chapter '{chapter_id}' in ChromaDB.")
            return jsonify({"error": "Failed to record approval."}), 500
    except Exception as e:
        app.logger.error(f"Error during chapter approval for {chapter_id}: {e}")
        return jsonify({"error": f"An error occurred during approval: {e}"}), 500

@app.route('/request_revision/<chapter_id>', methods=['POST'])
async def request_revision(chapter_id: str):
    app.logger.info(f"Received request for revision for chapter: {chapter_id}")
    if chapter_id != DEFAULT_CHAPTER_ID:
        app.logger.warning(f"Attempt to request revision for invalid chapter ID: {chapter_id}")
        return jsonify({"error": "Invalid chapter ID."}), 400
    if chroma_manager is None:
        app.logger.error("ChromaManager not initialized globally. Cannot request revision.")
        return jsonify({"error": "Backend database not available."}), 500

    try:
        latest_spun_version = chroma_manager.get_latest_chapter_version(chapter_id, "spun")
        if not latest_spun_version:
            app.logger.error(f"Cannot request revision for chapter {chapter_id}: No spun content found to revise.")
            return jsonify({"error": "No spun content found to revise."}), 404

        request_data = request.get_json(silent=True)
        feedback = request_data.get('feedback', '') if request_data else ''
        app.logger.info(f"Revision feedback received: '{feedback}'")

        revision_metadata = {
            "human_action": "revision_requested",
            "revised_spun_version_id": latest_spun_version['id'],
            "revision_request_timestamp": datetime.now().isoformat(),
            "feedback": feedback
        }
        version_id = chroma_manager.add_chapter_version(
            chapter_id=chapter_id,
            content=latest_spun_version['content'],
            version_type="revision_requested",
            metadata=revision_metadata
        )

        if not version_id:
            app.logger.error(f"Failed to record revision request for chapter '{chapter_id}' in ChromaDB.")
            return jsonify({"error": "Failed to record revision request."}), 500
        
        app.logger.info(f"Chapter '{chapter_id}' revision request recorded. New version ID: {version_id}")
        # --- RL Logging: Human Revision Request ---
        reward = calculate_human_action_reward("revision_requested", feedback)
        log_workflow_event("human_action_revision_requested", chapter_id, version_id, reward, {"feedback": feedback, "revised_version_id": latest_spun_version['id']})
        # --- End RL Logging ---

        app.logger.info(f"Triggering AI Writer to generate new spun content for chapter: {chapter_id} with feedback.")
        original_content_version = chroma_manager.get_latest_chapter_version(chapter_id, "original")
        if not original_content_version:
            app.logger.error(f"Could not find original content for chapter {chapter_id} to trigger revision.")
            return jsonify({"error": "Could not find original content for revision."}), 500

        new_spun_content = await spin_chapter_content(chapter_id, original_content_version['content'], feedback=feedback)

        if new_spun_content.startswith("Error:"):
            app.logger.error(f"AI Writer failed to generate revised content: {new_spun_content}")
            return jsonify({"error": f"AI Writer failed to generate revised content: {new_spun_content}"}), 500
        
        app.logger.info(f"AI Writer successfully generated revised content for chapter: {chapter_id}")
        # --- RL Logging: AI Writer Output ---
        log_workflow_event("ai_writer_output", chapter_id, None, 0.0, {"type": "spun_revision", "feedback_used": feedback}) # Reward for writer is indirect
        # --- End RL Logging ---

        app.logger.info(f"Triggering AI Reviewer for the newly generated spun content for chapter: {chapter_id}.")
        new_review_comments = await review_chapter_content(chapter_id, new_spun_content)

        if new_review_comments.startswith("Error:"):
            app.logger.error(f"AI Reviewer failed to generate new review comments: {new_review_comments}")
            return jsonify({"message": f"Chapter '{chapter_id}' revision requested and new content generated, but review failed.", "version_id": version_id}), 200
        
        app.logger.info(f"AI Reviewer successfully generated new review comments for chapter: {chapter_id}")
        # --- RL Logging: AI Reviewer Output ---
        review_reward = calculate_review_reward(new_review_comments)
        log_workflow_event("ai_reviewer_output", chapter_id, None, review_reward, {"review_text": new_review_comments})
        # --- End RL Logging ---

        return jsonify({"message": f"Chapter '{chapter_id}' revision requested, new content and review generated successfully.", "version_id": version_id}), 200

    except Exception as e:
        app.logger.error(f"Error during chapter revision request for {chapter_id}: {e}")
        return jsonify({"error": f"An error occurred during revision request: {e}"}), 500

@app.route('/semantic_search', methods=['POST'])
def semantic_search_endpoint():
    app.logger.info("Received request for semantic search.")
    if chroma_manager is None:
        app.logger.error("ChromaManager not initialized globally. Cannot perform semantic search.")
        return jsonify({"error": "Backend database not available."}), 500

    try:
        request_data = request.get_json()
        query_text = request_data.get('query_text')
        n_results = request_data.get('n_results', 5)
        filter_metadata = request_data.get('filter_metadata', {})

        if not query_text:
            return jsonify({"error": "Missing 'query_text' in request body."}), 400

        app.logger.info(f"Performing semantic search for query: '{query_text}' with n_results={n_results}, filter={filter_metadata}")
        search_results = chroma_manager.semantic_search(query_text, n_results, filter_metadata)

        formatted_results = []
        for res in search_results:
            formatted_results.append({
                "id": res['id'],
                "content": res['content'],
                "version_type": res['metadata'].get('version_type', 'unknown'),
                "timestamp": res['metadata'].get('timestamp', 'unknown'),
                "distance": res['distance']
            })
        
        app.logger.info(f"Semantic search returned {len(formatted_results)} results.")
        return jsonify({"results": formatted_results}), 200

    except Exception as e:
        app.logger.error(f"Error during semantic search: {e}")
        return jsonify({"error": f"An error occurred during semantic search: {e}"}), 500

@app.route('/chromadb_status')
def chromadb_status():
    app.logger.info("Received request for ChromaDB status.")
    if chroma_manager is None:
        app.logger.error("ChromaManager not initialized globally. Cannot get ChromaDB status.")
        return jsonify({"error": "Backend database not available."}), 500

    try:
        collection_count = chroma_manager.collection.count()
        app.logger.info(f"ChromaDB collection '{chroma_manager.collection.name}' has {collection_count} documents.")

        all_versions = chroma_manager.get_all_chapter_versions(DEFAULT_CHAPTER_ID)
        
        if all_versions:
            content_summary = []
            for v in all_versions:
                content_summary.append({
                    "id": v['id'],
                    "version_type": v['metadata'].get('version_type', 'unknown'),
                    "timestamp": v['metadata'].get('timestamp', 'unknown'),
                    "content_length": len(v['content'])
                })
            app.logger.info(f"Found {len(all_versions)} versions for chapter '{DEFAULT_CHAPTER_ID}'.")
            return jsonify({
                "status": "success",
                "collection_name": chroma_manager.collection.name,
                "document_count": collection_count,
                "chapter_versions": content_summary
            }), 200
        else:
            app.logger.warning(f"No versions found for default chapter '{DEFAULT_CHAPTER_ID}' in ChromaDB.")
            return jsonify({
                "status": "success",
                "collection_name": chroma_manager.collection.name,
                "document_count": collection_count,
                "message": f"No content found for chapter '{DEFAULT_CHAPTER_ID}'. Please run Python agents."
            }), 200

    except Exception as e:
        app.logger.error(f"Error checking ChromaDB status: {e}")
        return jsonify({"status": "error", "message": f"Failed to connect to ChromaDB: {e}"}), 500

@app.route('/chromadb_status_chapter/<chapter_id>')
def chromadb_status_chapter(chapter_id: str):
    app.logger.info(f"Received request for chapter status for chapter: {chapter_id}")
    if chapter_id != DEFAULT_CHAPTER_ID:
        app.logger.warning(f"Attempt to get status for invalid chapter ID: {chapter_id}")
        return jsonify({"error": "Invalid chapter ID."}), 400
    if chroma_manager is None:
        app.logger.error("ChromaManager not initialized globally. Cannot get chapter status.")
        return jsonify({"error": "Backend database not available."}), 500

    try:
        all_versions = chroma_manager.get_all_chapter_versions(chapter_id)
        
        latest_status = 'pending'
        latest_timestamp = datetime.min

        for version in all_versions:
            v_type = version['metadata'].get('version_type')
            v_timestamp_str = version['metadata'].get('timestamp')
            
            if v_timestamp_str:
                v_timestamp = datetime.fromisoformat(v_timestamp_str)
                if v_type == 'approved' and v_timestamp > latest_timestamp:
                    latest_status = 'approved'
                    latest_timestamp = v_timestamp
                elif v_type == 'revision_requested' and v_timestamp > latest_timestamp:
                    latest_status = 'revision_requested'
                    latest_timestamp = v_timestamp
                elif v_type == 'spun' and v_timestamp > latest_timestamp:
                    if latest_status == 'revision_requested':
                        latest_status = 'processing'
                    elif latest_status == 'pending':
                        latest_status = 'pending'
                    latest_timestamp = v_timestamp
                elif v_type == 'original' and latest_status == 'pending':
                     latest_status = 'pending'
                     latest_timestamp = v_timestamp

        app.logger.info(f"Latest status for chapter '{chapter_id}': {latest_status}")
        return jsonify({"latest_status": latest_status}), 200

    except Exception as e:
        app.logger.error(f"Error getting chapter status for {chapter_id}: {e}")
        return jsonify({"error": f"Failed to get chapter status: {e}"}), 500


if __name__ == '__main__':
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    os.makedirs(os.path.dirname(ORIGINAL_CHAPTER_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(SCREENSHOT_OUTPUT_FILE_PATH), exist_ok=True)
    app.run(debug=True, port=5000)
