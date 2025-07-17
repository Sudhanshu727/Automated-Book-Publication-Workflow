# src/ai_agents/writer_agent.py

import asyncio
import os
import sys
import httpx
import time

# Add the parent directory to the Python path to allow imports from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from config import GEMINI_API_KEY, ORIGINAL_CHAPTER_PATH, DEFAULT_CHAPTER_ID
from ai_agents.prompts import WRITER_PROMPT_TEMPLATE # Assuming this prompt will be updated or a new one created
from database.chroma_manager import ChromaManager

# Define a new prompt template for revisions, or modify the existing one
REVISION_PROMPT_TEMPLATE = """
You are an AI writer tasked with revising a book chapter.
The original chapter content is provided below.
The human reviewer has requested a revision with the following feedback:
---
{feedback}
---
Please rewrite and refine the chapter content based on this feedback.
Ensure the revised content maintains the original style and tone, but addresses the specific points raised in the feedback.
Revised Chapter Content:
{chapter_content}
"""

async def spin_chapter_content(chapter_id: str, original_content: str, feedback: str = '', retries: int = 3, delay: int = 5) -> str: # Added feedback parameter
    """
    Uses an LLM (Gemini) to "spin" (rewrite, expand, adapt) the given chapter content.
    If feedback is provided, it revises the content based on that feedback.
    Stores the spun content in ChromaDB.

    Args:
        chapter_id (str): The ID of the chapter being spun.
        original_content (str): The original chapter content to be spun.
        feedback (str): Optional feedback from a human reviewer for revisions.
        retries (int): Number of times to retry on API errors.
        delay (int): Delay in seconds between retries.

    Returns:
        str: The spun (rewritten) version of the chapter content, or an error message.
    """
    if feedback:
        print(f"AI Writer: Revising chapter content based on feedback: '{feedback}'")
        prompt = REVISION_PROMPT_TEMPLATE.format(feedback=feedback, chapter_content=original_content)
    else:
        print("AI Writer: Spinning new chapter content...")
        prompt = WRITER_PROMPT_TEMPLATE.format(chapter_content=original_content)

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ]
    }

    apiUrl = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}";
    
    async with httpx.AsyncClient() as client:
        for attempt in range(retries + 1):
            try:
                response = await client.post(
                    apiUrl,
                    headers={'Content-Type': 'application/json'},
                    json=payload,
                    timeout=120.0 # Increased timeout for potentially longer generation
                )
                response.raise_for_status()

                result = response.json()

                if result.get("candidates") and len(result["candidates"]) > 0 and \
                   result["candidates"][0].get("content") and \
                   result["candidates"][0]["content"].get("parts") and \
                   len(result["candidates"][0]["content"]["parts"]) > 0:
                    spun_content = result["candidates"][0]["content"]["parts"][0].get("text", "")
                    if spun_content:
                        print("AI Writer: Chapter spun/revised successfully!")
                        
                        chroma_manager = ChromaManager()
                        version_id = chroma_manager.add_chapter_version(
                            chapter_id=chapter_id,
                            content=spun_content,
                            version_type="spun", # Still store as 'spun', but it's a new iteration
                            metadata={"source_version_type": "original", "revision_feedback": feedback if feedback else "none"}
                        )
                        if version_id:
                            print(f"AI Writer: Spun content stored in ChromaDB with ID: {version_id}")
                        else:
                            print("AI Writer: Failed to store spun content in ChromaDB.")

                        return spun_content
                    else:
                        print("AI Writer: Warning - Spun content text part is empty.")
                        return "Error: Spun content text part is empty."
                else:
                    print("AI Writer: Error - No content generated or unexpected response structure.")
                    print(f"Full API response: {result}")
                    return "Error: Could not generate spun content."

            except httpx.HTTPStatusError as e:
                if 500 <= e.response.status_code < 600 and attempt < retries:
                    print(f"AI Writer: API error {e.response.status_code}. Retrying in {delay} seconds (Attempt {attempt + 1}/{retries})...")
                    await asyncio.sleep(delay)
                else:
                    print(f"AI Writer: An HTTP status error occurred: {e.response.status_code} - {e.response.text}")
                    return f"Error: Failed to spin content due to API error: {e.response.status_code}"
            except httpx.RequestError as e:
                if attempt < retries:
                    print(f"AI Writer: A request error occurred: {e}. Retrying in {delay} seconds (Attempt {attempt + 1}/{retries})...")
                    await asyncio.sleep(delay)
                else:
                    print(f"AI Writer: An HTTP request error occurred: {e}")
                    return f"Error: Failed to spin content due to network or request issue: {e}"
            except Exception as e:
                print(f"AI Writer: An unexpected error occurred: {e}")
                return f"Error: Failed to spin content due to unexpected issue: {e}"
        return "Error: Max retries exceeded for spinning content."

async def main():
    """
    Main function to read original content, spin it, and save the result to ChromaDB.
    This main function is for initial generation, not for revision.
    """
    chapter_id = DEFAULT_CHAPTER_ID

    try:
        with open(ORIGINAL_CHAPTER_PATH, "r", encoding="utf-8") as f:
            original_content = f.read()
        print(f"Read original chapter content from {ORIGINAL_CHAPTER_PATH}")
        
    except FileNotFoundError:
        print(f"Error: Original chapter content file not found at {ORIGINAL_CHAPTER_PATH}")
        print("Please ensure you have run the web_scraper.py script first.")
        return

    # This call is for initial spinning without feedback
    spun_chapter = await spin_chapter_content(chapter_id, original_content)

    if spun_chapter.startswith("Error:"):
        print(f"Failed to spin chapter due to error: {spun_chapter}")

if __name__ == "__main__":
    asyncio.run(main())
