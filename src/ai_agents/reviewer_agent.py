# src/ai_agents/reviewer_agent.py

import asyncio
import os
import sys
import httpx # Import httpx

# Add the parent directory to the Python path to allow imports from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from config import GEMINI_API_KEY, SPUN_CHAPTER_PATH, REVIEW_COMMENTS_PATH
from ai_agents.prompts import REVIEWER_PROMPT_TEMPLATE

async def review_chapter_content(spun_chapter_content: str) -> str:
    """
    Uses an LLM (Gemini) to review the given spun chapter content.

    Args:
        spun_chapter_content (str): The spun chapter content to be reviewed.

    Returns:
        str: The review comments from the AI Reviewer.
    """
    print("AI Reviewer: Reviewing spun chapter content...")

    # Construct the payload for the Gemini API call
    prompt = REVIEWER_PROMPT_TEMPLATE.format(spun_chapter_content=spun_chapter_content)
    
    # Gemini API expects content in a specific structure
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ]
    }

    # Make the API call to Gemini using httpx
    # The API key is expected to be provided by the Canvas environment at runtime
    # If running locally, ensure GEMINI_API_KEY is set in config.py or env vars
    apiUrl = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                apiUrl,
                headers={'Content-Type': 'application/json'},
                json=payload, # Use json parameter for dictionary payload
                timeout=30.0 # Add a timeout
            )
            response.raise_for_status() # Raise an exception for 4xx/5xx responses

            result = response.json()

            if result.get("candidates") and len(result["candidates"]) > 0 and \
               result["candidates"][0].get("content") and \
               result["candidates"][0]["content"].get("parts") and \
               len(result["candidates"][0]["content"]["parts"]) > 0:
                review_comments = result["candidates"][0]["content"]["parts"][0].get("text", "")
                if review_comments:
                    print("AI Reviewer: Review completed successfully!")
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
    Main function to read spun content, review it, and save the comments.
    """
    # Ensure the data/processed directory exists
    os.makedirs(os.path.dirname(REVIEW_COMMENTS_PATH), exist_ok=True)

    try:
        with open(SPUN_CHAPTER_PATH, "r", encoding="utf-8") as f:
            spun_content = f.read()
        print(f"Read spun chapter content from {SPUN_CHAPTER_PATH}")
    except FileNotFoundError:
        print(f"Error: Spun chapter content file not found at {SPUN_CHAPTER_PATH}")
        print("Please ensure you have run the writer_agent.py script first.")
        return

    review_comments = await review_chapter_content(spun_content)

    if not review_comments.startswith("Error:"): # Check if an error occurred
        with open(REVIEW_COMMENTS_PATH, "w", encoding="utf-8") as f:
            f.write(review_comments)
        print(f"Review comments saved to {REVIEW_COMMENTS_PATH}")
    else:
        print(f"Failed to save review comments due to error: {review_comments}")

if __name__ == "__main__":
    # To run this, ensure you have a spun_chapter.txt in src/data/processed/
    # from the previous AI Writer step.
    asyncio.run(main())
