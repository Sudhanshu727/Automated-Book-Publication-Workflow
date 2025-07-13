import asyncio
import os
import sys
from playwright.async_api import async_playwright

# Add the parent directory to the Python path to allow imports from src/
# This is crucial when running scripts from subdirectories
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Import the path from our centralized configuration
from src.config import ORIGINAL_CHAPTER_PATH, SCREENSHOT_OUTPUT_FILE_PATH # Assuming you'll add SCREENSHOT_OUTPUT_FILE_PATH to config.py later

# Define the URL to scrape
URL = "https://en.wikisource.org/wiki/The_Gates_of_Morning/Book_1/Chapter_1"

async def scrape_chapter(url: str):
    """
    Scrapes the main content from a given URL and takes a full-page screenshot.

    Args:
        url (str): The URL of the web page to scrape.
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
            # This selector targets the main content area of a MediaWiki page,
            # specifically the div with id 'mw-content-text' which contains the article text.
            # We then look for paragraphs within this content.
            content_selector = "#mw-content-text .mw-parser-output"
            
            # Wait for the content to be visible
            await page.wait_for_selector(content_selector)

            # Get the inner text of the content area
            chapter_content = await page.inner_text(content_selector)
            
            # Clean up the content (e.g., remove extra newlines or leading/trailing whitespace)
            cleaned_content = "\n".join([line.strip() for line in chapter_content.splitlines() if line.strip()])

            # Ensure the directory for the output file exists
            os.makedirs(os.path.dirname(ORIGINAL_CHAPTER_PATH), exist_ok=True)

            # Save the extracted content to the specified text file path from config
            with open(ORIGINAL_CHAPTER_PATH, "w", encoding="utf-8") as f:
                f.write(cleaned_content)
            print(f"Chapter content saved to {ORIGINAL_CHAPTER_PATH}")

            # Ensure the directory for the screenshot file exists
            screenshot_dir = os.path.dirname(SCREENSHOT_OUTPUT_FILE_PATH) if SCREENSHOT_OUTPUT_FILE_PATH else "screenshots"
            os.makedirs(screenshot_dir, exist_ok=True)

            # Save the screenshot to the specified path or default
            screenshot_path = SCREENSHOT_OUTPUT_FILE_PATH if SCREENSHOT_OUTPUT_FILE_PATH else os.path.join(screenshot_dir, "chapter_screenshot.png")
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"Full page screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred during scraping: {e}")
        finally:
            # Close the browser
            await browser.close()
            print("Browser closed.")

# Main execution block
if __name__ == "__main__":
    # Ensure Playwright browsers are installed before running:
    # run `playwright install` in your terminal
    asyncio.run(scrape_chapter(URL))

