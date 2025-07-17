# src/database/chroma_manager.py

import chromadb
import os
import sys
from datetime import datetime

# Add the parent directory to the Python path to allow imports from src/config
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the absolute path for ChromaDB
from config import CHROMA_DB_PATH, CHROMA_COLLECTION_NAME

class ChromaManager:
    """
    Manages interactions with ChromaDB for storing, retrieving, and searching chapter content.
    """
    def __init__(self):
        """
        Initializes the ChromaDB client and gets/creates the collection.
        """
        # Ensure the ChromaDB directory exists
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)
        
        # Initialize the ChromaDB client with a persistent client
        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        
        # Get or create the collection
        self.collection = self.client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)
        # ADDED: Explicitly print the path ChromaDB is using
        print(f"ChromaDB initialized. Collection: '{CHROMA_COLLECTION_NAME}' at '{CHROMA_DB_PATH}'")

    def add_chapter_version(self, chapter_id: str, content: str, version_type: str, metadata: dict = None):
        """
        Adds a new version of a chapter to the ChromaDB collection.

        Args:
            chapter_id (str): A unique identifier for the chapter (e.g., "book1_chapter1").
            content (str): The text content of the chapter version.
            version_type (str): Type of version (e.g., "original", "spun", "reviewed", "human_edited").
            metadata (dict, optional): Additional metadata to store with the document.
        """
        # Generate a unique ID for this specific version
        version_id = f"{chapter_id}_{version_type}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        
        # Prepare metadata
        if metadata is None:
            metadata = {}
        metadata.update({
            "chapter_id": chapter_id,
            "version_type": version_type,
            "timestamp": datetime.now().isoformat()
        })

        try:
            self.collection.add(
                documents=[content],
                metadatas=[metadata],
                ids=[version_id]
            )
            print(f"Added chapter version '{version_id}' ({version_type}) to ChromaDB.")
            return version_id
        except Exception as e:
            print(f"Error adding chapter version to ChromaDB: {e}")
            return None

    def get_latest_chapter_version(self, chapter_id: str, version_type: str = None) -> dict:
        """
        Retrieves the latest version of a chapter based on its chapter_id and optionally version_type.

        Args:
            chapter_id (str): The unique identifier for the chapter.
            version_type (str, optional): The specific type of version to retrieve (e.g., "spun").
                                          If None, returns all versions for the chapter_id, ordered by timestamp.

        Returns:
            dict: A dictionary containing the latest version's content, ID, and metadata,
                  or None if no matching version is found.
        """
        query_where = {"chapter_id": chapter_id}
        if version_type:
            query_where = {
                "$and": [
                    {"chapter_id": chapter_id},
                    {"version_type": version_type}
                ]
            }

        try:
            results = self.collection.get(
                where=query_where,
                include=['documents', 'metadatas'] 
            )

            if not results['ids']:
                print(f"No versions found for chapter_id: {chapter_id}, version_type: {version_type}")
                return None

            # Sort results by timestamp to get the latest
            sorted_versions = sorted(
                zip(results['ids'], results['documents'], results['metadatas']),
                key=lambda x: datetime.fromisoformat(x[2]['timestamp']),
                reverse=True
            )
            
            latest_version_id, latest_content, latest_metadata = sorted_versions[0]
            print(f"Retrieved latest version '{latest_version_id}' for chapter_id: {chapter_id}, type: {version_type}")
            return {
                "id": latest_version_id,
                "content": latest_content,
                "metadata": latest_metadata
            }
        except Exception as e:
            print(f"Error retrieving chapter version from ChromaDB: {e}")
            return None

    def semantic_search(self, query_text: str, n_results: int = 5, filter_metadata: dict = None) -> list:
        """
        Performs a semantic search on the collection.

        Args:
            query_text (str): The text query for semantic search.
            n_results (int): Number of top results to return.
            filter_metadata (dict, optional): Metadata to filter the search results.

        Returns:
            list: A list of dictionaries, each containing 'id', 'content', 'metadata', and 'distance'.
        """
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where=filter_metadata,
                include=['documents', 'metadatas', 'distances']
            )
            
            if not results['ids']:
                print(f"No semantic search results for query: '{query_text}'")
                return []

            formatted_results = []
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i]
                })
            print(f"Semantic search for '{query_text}' returned {len(formatted_results)} results.")
            return formatted_results
        except Exception as e:
            print(f"Error during semantic search: {e}")
            return []

    def get_all_chapter_versions(self, chapter_id: str) -> list:
        """
        Retrieves all versions for a given chapter_id, ordered by timestamp.

        Args:
            chapter_id (str): The unique identifier for the chapter.

        Returns:
            list: A list of dictionaries, each containing version 'id', 'content', and 'metadata'.
        """
        try:
            results = self.collection.get(
                where={"chapter_id": chapter_id},
                include=['documents', 'metadatas'] 
            )

            if not results['ids']:
                print(f"No versions found for chapter_id: {chapter_id}")
                return []

            # Sort results by timestamp
            sorted_versions = sorted(
                zip(results['ids'], results['documents'], results['metadatas']),
                key=lambda x: datetime.fromisoformat(x[2]['timestamp']),
                reverse=True # Latest first
            )
            
            formatted_results = []
            for version_id, content, metadata in sorted_versions:
                formatted_results.append({
                    "id": version_id,
                    "content": content,
                    "metadata": metadata
                })
            print(f"Retrieved {len(formatted_results)} versions for chapter_id: {chapter_id}")
            return formatted_results
        except Exception as e:
            print(f"Error retrieving all chapter versions from ChromaDB: {e}")
            return []

# Example usage (for testing purposes)
if __name__ == "__main__":
    manager = ChromaManager()
    chapter_id = "test_book_chapter_1"

    # Add an original version
    original_content = "This is the original content of the first chapter about a brave knight."
    manager.add_chapter_version(chapter_id, original_content, "original")

    # Add a spun version
    spun_content = "In a realm of valor, a courageous knight embarked on a perilous quest."
    manager.add_chapter_version(chapter_id, spun_content, "spun")

    # Add a reviewed version
    reviewed_content = "The courageous knight, Sir Reginald, began his arduous journey through the enchanted forest."
    manager.add_chapter_version(chapter_id, reviewed_content, "reviewed")

    # Get the latest spun version
    latest_spun = manager.get_latest_chapter_version(chapter_id, "spun")
    if latest_spun:
        print("\nLatest spun version:")
        print(f"ID: {latest_spun['id']}")
        print(f"Content: {latest_spun['content']}")
        print(f"Metadata: {latest_spun['metadata']}")

    # Get all versions for the chapter
    all_versions = manager.get_all_chapter_versions(chapter_id)
    if all_versions:
        print(f"\nAll versions for {chapter_id}:")
        for version in all_versions:
            print(f"- Type: {version['metadata']['version_type']}, Content (first 50 chars): {version['content'][:50]}...")

    # Perform a semantic search
    search_results = manager.semantic_search("brave hero's journey", n_results=2)
    if search_results:
        print("\nSemantic search results:")
        for res in search_results:
            print(f"  ID: {res['id']}, Type: {res['metadata']['version_type']}, Distance: {res['distance']:.4f}")
            print(f"  Content: {res['content'][:100]}...")
