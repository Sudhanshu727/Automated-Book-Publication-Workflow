# src/ai_agents/writer_agent.py

import asyncio
import os
import sys
import httpx # Import httpx

# Add the parent directory to the Python path to allow imports from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from config import GEMINI_API_KEY, ORIGINAL_CHAPTER_PATH, SPUN_CHAPTER_PATH
from ai_agents.prompts import WRITER_PROMPT_TEMPLATE

async def spin_chapter_content(chapter_content: str) -> str:
    """
    Uses an LLM (Gemini) to "spin" (rewrite, expand, adapt) the given chapter content.

    Args:
        chapter_content (str): The original chapter content to be spun.

    Returns:
        str: The spun (rewritten) version of the chapter content.
    """
    print("AI Writer: Spinning chapter content...")

    # Construct the payload for the Gemini API call
    prompt = WRITER_PROMPT_TEMPLATE.format(chapter_content=chapter_content)
    
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
                timeout=30.0 # Add a timeout to prevent indefinite hangs
            )
            response.raise_for_status() # Raise an exception for 4xx/5xx responses

            result = response.json()

            if result.get("candidates") and len(result["candidates"]) > 0 and \
               result["candidates"][0].get("content") and \
               result["candidates"][0]["content"].get("parts") and \
               len(result["candidates"][0]["content"]["parts"]) > 0:
                spun_content = result["candidates"][0]["content"]["parts"][0].get("text", "")
                if spun_content:
                    print("AI Writer: Chapter spun successfully!")
                    return spun_content
                else:
                    print("AI Writer: Warning - Spun content text part is empty.")
                    return "Error: Spun content text part is empty."
            else:
                print("AI Writer: Error - No content generated or unexpected response structure.")
                print(f"Full API response: {result}")
                return "Error: Could not generate spun content."

        except httpx.RequestError as e:
            print(f"AI Writer: An HTTP request error occurred: {e}")
            return f"Error: Failed to spin content due to network or request issue: {e}"
        except httpx.HTTPStatusError as e:
            print(f"AI Writer: An HTTP status error occurred: {e.response.status_code} - {e.response.text}")
            return f"Error: Failed to spin content due to API error: {e.response.status_code}"
        except Exception as e:
            print(f"AI Writer: An unexpected error occurred: {e}")
            return f"Error: Failed to spin content due to unexpected issue: {e}"

async def main():
    """
    Main function to read original content, spin it, and save the result.
    """
    # Ensure the data/processed directory exists
    os.makedirs(os.path.dirname(SPUN_CHAPTER_PATH), exist_ok=True)

    try:
        with open(ORIGINAL_CHAPTER_PATH, "r", encoding="utf-8") as f:
            original_content = f.read()
        print(f"Read original chapter content from {ORIGINAL_CHAPTER_PATH}")
    except FileNotFoundError:
        print(f"Error: Original chapter content file not found at {ORIGINAL_CHAPTER_PATH}")
        print("Please ensure you have run the web_scraper.py script first.")
        return

    spun_chapter = await spin_chapter_content(original_content)

    if not spun_chapter.startswith("Error:"): # Check if an error occurred
        with open(SPUN_CHAPTER_PATH, "w", encoding="utf-8") as f:
            f.write(spun_chapter)
        print(f"Spun chapter saved to {SPUN_CHAPTER_PATH}")
    else:
        print(f"Failed to save spun chapter due to error: {spun_chapter}")


if __name__ == "__main__":
    # To run this, ensure you have a chapter_content.txt in src/data/raw/
    # from the previous scraping step.
    asyncio.run(main())
