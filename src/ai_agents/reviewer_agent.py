# src/ai_agents/reviewer_agent.py
from dotenv import load_dotenv
load_dotenv() # This loads variables from .env file
import asyncio
import os
import sys
import httpx

# Add the parent directory to the Python path to allow imports from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from config import GEMINI_API_KEY, DEFAULT_CHAPTER_ID
from ai_agents.prompts import REVIEWER_PROMPT_TEMPLATE
from database.chroma_manager import ChromaManager

async def review_chapter_content(chapter_id: str, spun_chapter_content: str) -> str:
    """
    Uses an LLM (Gemini) to review the given spun chapter content.
    Stores the review comments in ChromaDB.

    Args:
        chapter_id (str): The ID of the chapter being reviewed.
        spun_chapter_content (str): The spun chapter content to be reviewed.

    Returns:
        str: The review comments from the AI Reviewer, or an error message.
    """
    print("AI Reviewer: Reviewing spun chapter content...")

    prompt = REVIEWER_PROMPT_TEMPLATE.format(spun_chapter_content=spun_chapter_content)
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ]
    }

    apiUrl = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                apiUrl,
                headers={'Content-Type': 'application/json'},
                json=payload,
                timeout=60.0
            )
            response.raise_for_status()

            result = response.json()

            if result.get("candidates") and len(result["candidates"]) > 0 and \
               result["candidates"][0].get("content") and \
               result["candidates"][0]["content"].get("parts") and \
               len(result["candidates"][0]["content"]["parts"]) > 0:
                review_comments = result["candidates"][0]["content"]["parts"][0].get("text", "")
                if review_comments:
                    print("AI Reviewer: Review completed successfully!")
                    
                    chroma_manager = ChromaManager()
                    version_id = chroma_manager.add_chapter_version(
                        chapter_id=chapter_id,
                        content=review_comments,
                        version_type="review_comments",
                        metadata={"reviewed_version_type": "spun"}
                    )
                    if version_id:
                        print(f"AI Reviewer: Review comments stored in ChromaDB with ID: {version_id}")
                    else:
                        print("AI Reviewer: Failed to store review comments in ChromaDB.")

                    return review_comments
                else:
                    print("AI Reviewer: Warning - Review comments text part is empty.")
                    return "Error: Review comments text part is empty."
            else:
                print("AI Reviewer: Error - No review generated or unexpected response structure.")
                print(f"Full API response: {result}")
                return "Error: Could not generate review comments."

        except httpx.RequestError as e:
            print(f"AI Reviewer: An HTTP request error occurred: {e}")
            return f"Error: Failed to review content due to network or request issue: {e}"
        except httpx.HTTPStatusError as e:
            print(f"AI Reviewer: An HTTP status error occurred: {e.response.status_code} - {e.response.text}")
            return f"Error: Failed to review content due to API error: {e.response.status_code}"
        except Exception as e:
            print(f"AI Reviewer: An unexpected error occurred: {e}")
            return f"Error: Failed to review content due to unexpected issue: {e}"

async def main():
    """
    Main function to fetch spun content from ChromaDB, review it, and save comments to ChromaDB.
    """
    chapter_id = DEFAULT_CHAPTER_ID # Use the centralized ID
    chroma_manager = ChromaManager()

    latest_spun_version = chroma_manager.get_latest_chapter_version(chapter_id, "spun")

    if not latest_spun_version:
        print(f"Error: No spun content found in ChromaDB for chapter_id: {chapter_id}.")
        print("Please ensure the writer_agent.py script has been run successfully.")
        return

    spun_content = latest_spun_version['content']
    print(f"Retrieved latest spun content from ChromaDB (ID: {latest_spun_version['id']})")

    review_comments = await review_chapter_content(chapter_id, spun_content)

    if review_comments.startswith("Error:"):
        print(f"Failed to review chapter due to error: {review_comments}")

if __name__ == "__main__":
    asyncio.run(main())
