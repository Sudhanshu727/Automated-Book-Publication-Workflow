Automated Book Publication Workflow
Introduction
This project implements an intelligent, automated, and collaborative system designed to streamline the process of generating and refining book content. It leverages Artificial Intelligence (AI) for initial content creation and quality assurance, while crucially keeping human writers, reviewers, and editors in the loop for oversight, feedback, and iterative refinement.

The core idea is to build a sophisticated content pipeline that combines the speed and scalability of AI with the critical judgment and creativity of human expertise, ensuring high-quality output and continuous improvement.

Key Features
Web Scraping & Screenshots: Automatically fetches content from specified web URLs and captures full-page screenshots for visual reference.

AI Writing & Spinning: Utilizes Large Language Models (LLMs) via the Google Gemini API to "spin" (rewrite, expand, and adapt) raw scraped content into unique, engaging chapter drafts based on defined styles and tones.

AI Review & Quality Assurance: An AI Reviewer agent evaluates the spun content for coherence, grammar, adherence to instructions, and overall quality, providing detailed feedback.

Human-in-the-Loop Interface: A modern React web application provides a centralized dashboard for human reviewers to:

View and compare original content, AI-spun drafts, and AI review comments side-by-side.

Approve content for finalization.

Request revisions with specific textual feedback, triggering new AI generation cycles.

Content Versioning with ChromaDB: All content versions (original, spun, reviewed, approved, revised) are persistently stored and managed in ChromaDB, a lightweight vector database.

Semantic Search: Allows users to perform intelligent searches across all content versions based on semantic meaning, enabling quick retrieval of relevant passages.

Voice Support (STT & TTS):

Speech-to-Text (STT): Enables voice input for providing revision feedback in the frontend.

Text-to-Speech (TTS): Allows the system to "read aloud" AI-generated content and review comments.

RL-Based Reward System (Conceptual Framework): The system is designed to log workflow events and calculate conceptual reward signals based on AI outputs and human actions. This data forms the foundation for future Reinforcement Learning (RL) models to optimize AI agent behavior and workflow efficiency.

Technologies Used
Backend & AI Agents:

Python: Core programming language for backend logic and AI agents.

Flask: Lightweight Python web framework for building the backend API.

Playwright: Python library for web scraping and taking screenshots.

Google Gemini API (1.5 Flash): Powers the LLM-driven AI Writer and AI Reviewer agents.

ChromaDB: Open-source vector database used for efficient content storage, versioning, and semantic search.

httpx: Asynchronous HTTP client for making API calls.

Frontend:

React: JavaScript library for building the user interface.

Vite: Fast and modern frontend build tool for React.

TypeScript: Superset of JavaScript for type safety in the frontend.

Tailwind CSS: Utility-first CSS framework for rapid and responsive UI styling.

Lucide React: Icon library for modern and customizable icons.

Web Speech API (Browser Native): Used for client-side Speech-to-Text and Text-to-Speech functionalities.

Project Structure
Automated-Book-Publication-Workflow/
├── .gitignore
├── README.md
├── LICENSE
├── requirements.txt # Python dependencies
├── config.py # Centralized configuration (API keys, paths, etc.)
├── src/
│ ├── data/
│ │ ├── raw/ # Stores original scraped content (text, screenshots)
│ │ └── processed/ # Stores intermediate/finalized content (less used now with ChromaDB)
│ │
│ ├── scraping/ # Contains web scraping and screenshot logic
│ │ └── web_scraper.py # Scrapes content and stores original in ChromaDB
│ │
│ ├── ai_agents/ # Logic for AI Writer, AI Reviewer, and LLM interactions
│ │ ├── prompts.py # Stores reusable prompt templates for LLMs
│ │ ├── writer_agent.py # Spins content, stores in ChromaDB
│ │ └── reviewer_agent.py # Reviews spun content, stores comments in ChromaDB
│ │
│ ├── database/ # Integration with ChromaDB
│ │ ├── chroma_db/ # Persistent storage for ChromaDB (auto-generated)
│ │ └── chroma_manager.py # Manages interaction with ChromaDB (add, get, search)
│ │
│ ├── human_in_loop/ # Code for the human-in-the-loop web interface
│ │ ├── backend/ # Flask backend API
│ │ │ └── app.py # Flask app serving content and handling actions
│ │ └── frontend_n/ # React frontend UI (Vite project)
│ │ ├── public/
│ │ ├── src/
│ │ │ ├── App.tsx # Main React component with UI and logic
│ │ │ ├── index.css # Tailwind CSS imports
│ │ │ └── main.tsx # React entry point
│ │ ├── index.html
│ │ ├── package.json # Node.js dependencies
│ │ ├── postcss.config.js
│ │ └── tailwind.config.js
│ │
│ └── rl_system/ # Conceptual components for Reinforcement Learning
│ └── reward_model.py # Placeholder for reward calculation logic and logging
│
└── notebooks/ # (Optional) Jupyter notebooks for experimentation

Setup Instructions
Follow these steps to get the project up and running on your local machine.

Prerequisites
Python 3.8+: Download from python.org.

Node.js & npm (or yarn): Download from nodejs.org. npm is installed with Node.js.

Playwright Browsers: After installing Python and Node.js, you'll need to install Playwright's browsers.

pip install playwright
playwright install

1. Clone the Repository
   git clone https://github.com/your-username/Automated-Book-Publication-Workflow.git
   cd Automated-Book-Publication-Workflow

(Replace your-username with your actual GitHub username if you've forked/created the repo)

2. Configure API Key
   Open config.py located in src/.

# src/config.py

# ...

GEMINI_API_KEY = "YOUR_ACTUAL_GEMINI_API_KEY_GOES_HERE" # <--- PASTE YOUR KEY HERE

# ...

Replace "YOUR_ACTUAL_GEMINI_API_KEY_GOES_HERE" with your real Google Gemini API Key. You can obtain one from Google AI Studio.

3. Backend Setup (Python)
   Navigate to the project root and install Python dependencies.

# From the project root (Automated-Book-Publication-Workflow/)

pip install -r requirements.txt
pip install "flask[async]" # Install Flask with async support

4. Generate Initial Content & Populate ChromaDB
   Run the Python agents to scrape content, spin it, review it, and store everything in ChromaDB. This step is crucial and must be completed before running the Flask backend or frontend.

# From the project root (Automated-Book-Publication-Workflow/)

# Ensure a clean ChromaDB state (important for consistent testing)

# Delete the chroma_db folder if it exists

rmdir /s /q src\database\chroma_db 2>NUL # For Windows PowerShell/CMD

# rm -rf src/database/chroma_db # For Git Bash/WSL/Linux/macOS

# Run the agents in sequence

python src/scraping/web_scraper.py
python src/ai_agents/writer_agent.py
python src/ai_agents/reviewer_agent.py

Verify the output: Ensure all three scripts run without errors and print messages confirming content storage in ChromaDB.

5. Frontend Setup (React with Vite)
   Navigate to the frontend directory and install Node.js dependencies.

# From the project root (Automated-Book-Publication-Workflow/)

cd src/human_in_loop/frontend_n

# Install Node.js dependencies

npm install

# Install Tailwind CSS and its PostCSS plugin

npm install -D tailwindcss postcss autoprefixer @tailwindcss/typography

Running the Full Stack
You will need three separate terminal windows for this.

Terminal 1: Start Flask Backend

# From the project root (Automated-Book-Publication-Workflow/)

cd src/human_in_loop/backend
python app.py

Keep this terminal running. You should see Flask startup messages.

Terminal 2: Start React Frontend

# From the project root (Automated-Book-Publication-Workflow/)

cd src/human_in_loop/frontend_n
npm run dev

Keep this terminal running. This will open your browser to http://localhost:5173/ (or another available port).

Terminal 3 (Optional): Testing Backend Status
You can use this terminal or your browser to directly check the ChromaDB status.

# In your browser, go to:

http://localhost:5000/chromadb_status

You should see a JSON response listing the documents in your ChromaDB.

Usage
Once both the Flask backend and React frontend are running:

View Content: Open your browser to http://localhost:5173/. You should see the Original Chapter, AI Generated Version, AI Review Comments, and the Screenshot displayed.

Approve Content: Click the "Approve Content" button. This will record an "approved" action in ChromaDB.

Request Revision: Click the "Request Revision" button. A modal will appear.

Type or use the "Voice Input" button (requires Chrome browser and microphone access) to provide feedback (e.g., "Please convert this chapter to Hinglish style, blending Hindi words naturally into English.").

Click "Submit Revision Request." The system will then:

Record the "revision_requested" action in ChromaDB.

Trigger the AI Writer to generate new content based on your feedback.

Trigger the AI Reviewer to review the new content.

Automatically re-fetch and display the new AI-spun content and review comments in the UI after a short delay.

Semantic Search: Use the search bar in the "Semantic Search" section. Type a query (e.g., "brave knight" or "forest adventure") and press Enter or click the search icon. Relevant content snippets from all versions in ChromaDB will be displayed.

Read Aloud (TTS): Click the speaker icon next to "AI Generated Version" or "AI Review Comments" to have the content read aloud by your browser's text-to-speech engine.

Future Enhancements (Conceptual)
Full RL Integration: Develop and train a dedicated RL agent using the logged workflow data and reward signals to dynamically optimize AI prompts, model selection, and overall workflow efficiency.

User Management & Authentication: Implement user roles (writer, reviewer, editor) and secure login.

Multi-Chapter/Book Support: Extend the system to manage multiple chapters and entire books.

Direct Editing: Allow human users to directly edit AI-generated text within the UI and save those as new versions.

Advanced "Preview Final": Generate a formatted, publishable output (e.g., PDF, EPUB) based on approved content.

License
This project is licensed under the MIT License - see the LICENSE file for details.

I hope this README.md is comprehensive and helpful for your GitHub repository! Let me know if you'd like any adjustments or further assistance.
