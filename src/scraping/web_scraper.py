import asyncio
import os
import sys
from playwright.async_api import async_playwright

# Add the parent directory to the Python path to allow imports from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Import paths and DEFAULT_CHAPTER_ID from our centralized configuration
from src.config import ORIGINAL_CHAPTER_PATH, SCREENSHOT_OUTPUT_FILE_PATH, DEFAULT_CHAPTER_ID
# CORRECTED IMPORT: Import from src.database.chroma_manager
from src.database.chroma_manager import ChromaManager # Import ChromaManager

# Define the URL to scrape
URL = "https://en.wikisource.org/wiki/The_Gates_of_Morning/Book_1/Chapter_1"

async def scrape_chapter(url: str, chapter_id: str):
    """
    Scrapes the main content from a given URL, takes a full-page screenshot,
    and stores the original content in ChromaDB.

    Args:
        url (str): The URL of the web page to scrape.
        chapter_id (str): The ID to associate with this chapter in ChromaDB.
    """
    print(f"Starting to scrape: {url}")
    async with async_playwright() as p:
        # Launch a headless Chromium browser
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Navigate to the specified URL
            await page.goto(url, wait_until="domcontentloaded")
            print("Page loaded successfully.")

            # --- Extract Chapter Content ---
            content_selector = "#mw-content-text .mw-parser-output"
            await page.wait_for_selector(content_selector)
            chapter_content = await page.inner_text(content_selector)
            cleaned_content = "\n".join([line.strip() for line in chapter_content.splitlines() if line.strip()])

            # Ensure the directory for the output file exists
            os.makedirs(os.path.dirname(ORIGINAL_CHAPTER_PATH), exist_ok=True)

            # Save the extracted content to the specified text file path from config
            with open(ORIGINAL_CHAPTER_PATH, "w", encoding="utf-8") as f:
                f.write(cleaned_content)
            print(f"Chapter content saved to {ORIGINAL_CHAPTER_PATH}")

            # --- Store original content in ChromaDB ---
            chroma_manager = ChromaManager() # Initialize ChromaManager
            original_version_id = chroma_manager.add_chapter_version(
                chapter_id=chapter_id, # Use the passed chapter_id
                content=cleaned_content,
                version_type="original"
            )
            if original_version_id:
                print(f"Original content stored in ChromaDB with ID: {original_version_id}")
            else:
                print("Failed to store original content in ChromaDB.")

            # --- Take Screenshot ---
            # Ensure the directory for the screenshot file exists
            os.makedirs(os.path.dirname(SCREENSHOT_OUTPUT_FILE_PATH), exist_ok=True)
            
            # Save the screenshot to the specified path
            await page.screenshot(path=SCREENSHOT_OUTPUT_FILE_PATH, full_page=True)
            print(f"Full page screenshot saved to {SCREENSHOT_OUTPUT_FILE_PATH}")

        except Exception as e:
            print(f"An error occurred during scraping: {e}")
        finally:
            # Close the browser
            await browser.close()
            print("Browser closed.")

# Main execution block
if __name__ == "__main__":
    asyncio.run(scrape_chapter(URL, DEFAULT_CHAPTER_ID))
