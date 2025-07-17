/* global __api_base__ */
// src/human_in_loop/frontend/src/App.js

import React, { useState, useEffect } from "react";

function App() {
  const [originalContent, setOriginalContent] = useState("");
  const [spunContent, setSpunContent] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Base URL for our Flask backend
  // In the Canvas environment, __api_base__ will be provided.
  // For local development, it defaults to http://localhost:5000.
  const API_BASE_URL =
    typeof __api_base__ !== "undefined"
      ? __api_base__
      : "http://localhost:5000";

  // Log the API_BASE_URL being used for debugging
  console.log("API_BASE_URL being used:", API_BASE_URL);

  // Define a fixed chapter ID for now. In a real app, this would be dynamic.
  const CHAPTER_ID = "the_gates_of_morning_book1_chapter1";

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch original content from ChromaDB via Flask
        const originalRes = await fetch(
          `${API_BASE_URL}/content/${CHAPTER_ID}/original`
        );
        if (!originalRes.ok)
          throw new Error(
            `HTTP error! status: ${originalRes.status} for original content`
          );
        const originalData = await originalRes.json();
        setOriginalContent(originalData.content);

        // Fetch spun content from ChromaDB via Flask
        const spunRes = await fetch(
          `${API_BASE_URL}/content/${CHAPTER_ID}/spun`
        );
        if (!spunRes.ok)
          throw new Error(
            `HTTP error! status: ${spunRes.status} for spun content`
          );
        const spunData = await spunRes.json();
        setSpunContent(spunData.content);

        // Fetch review comments from ChromaDB via Flask
        const reviewRes = await fetch(
          `${API_BASE_URL}/content/${CHAPTER_ID}/review_comments`
        );
        if (!reviewRes.ok)
          throw new Error(
            `HTTP error! status: ${reviewRes.status} for review comments`
          );
        const reviewData = await reviewRes.json();
        setReviewComments(reviewData.content);

        // Set screenshot URL directly
        setScreenshotUrl(`${API_BASE_URL}/screenshot`);
      } catch (e) {
        setError(e.message);
        console.error("Failed to fetch data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array means this effect runs once on mount

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <div className="text-xl text-gray-700">Loading content...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 font-inter">
        <div className="text-xl text-red-700 p-4 rounded-lg shadow-md text-center">
          <p>Error: {error}</p>
          <p className="mt-2">Please ensure the following:</p>
          <ul className="list-disc list-inside text-left mx-auto max-w-sm">
            <li>The Flask backend server is running in a separate terminal.</li>
            <li>
              You have run all Python scripts (scraper, writer, reviewer) to
              populate ChromaDB.
            </li>
            <li>
              No firewall or antivirus is blocking connections to {API_BASE_URL}
              .
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-inter text-gray-800">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-blue-700 mb-2">
          Automated Book Publication Workflow
        </h1>
        <p className="text-lg text-gray-600">
          Human-in-the-Loop Content Review
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
        {/* Original Content Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-2xl font-semibold text-blue-600 mb-4">
            Original Chapter
          </h2>
          <div className="max-h-96 overflow-y-auto text-sm leading-relaxed text-gray-700 bg-gray-50 p-4 rounded-md border border-gray-100">
            {originalContent || "No original content found."}
          </div>
        </div>

        {/* Spun Content Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-2xl font-semibold text-purple-600 mb-4">
            AI Spun Chapter
          </h2>
          <div className="max-h-96 overflow-y-auto text-sm leading-relaxed text-gray-700 bg-purple-50 p-4 rounded-md border border-purple-100">
            {spunContent || "No spun content found."}
          </div>
        </div>

        {/* AI Review Comments Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-2xl font-semibold text-green-600 mb-4">
            AI Review Comments
          </h2>
          <div className="max-h-96 overflow-y-auto text-sm leading-relaxed text-gray-700 bg-green-50 p-4 rounded-md border border-green-100">
            {reviewComments || "No review comments found."}
          </div>
        </div>
      </div>

      {/* Screenshot Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-10">
        <h2 className="text-2xl font-semibold text-orange-600 mb-4">
          Original Chapter Screenshot
        </h2>
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt="Original Chapter Screenshot"
            className="w-full h-auto rounded-lg shadow-md border border-gray-100"
            onError={(e) => {
              e.target.onerror = null; // prevents infinite loop
              e.target.src =
                "https://placehold.co/600x400/cccccc/333333?text=Screenshot+Not+Available";
              console.error("Failed to load screenshot image.");
            }}
          />
        ) : (
          <div className="text-center text-gray-500">
            Screenshot not available.
          </div>
        )}
      </div>

      <footer className="text-center text-gray-500 text-sm mt-10">
        &copy; {new Date().getFullYear()} Automated Book Publication Workflow.
        All rights reserved.
      </footer>
    </div>
  );
}

export default App;
