/* global __api_base__ */
// src/human_in_loop/frontend_n/src/App.tsx

import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import {
  FileText,
  Bot,
  MessageSquare,
  Camera,
  AlertCircle,
  Loader2,
  Eye,
  CheckCircle,
  Clock,
  ArrowRight,
  Maximize2,
  ChevronDown,
  ChevronUp,
  XCircle, // Added for error messages
  Hourglass, // Added for "Pending Review" status
} from "lucide-react";

interface ContentData {
  original: string;
  spun: string;
  reviewComments: string;
  screenshotUrl: string;
}

interface LoadingState {
  original: boolean;
  spun: boolean;
  reviewComments: boolean;
  screenshot: boolean;
  action: boolean; // New loading state for actions
  status: boolean; // New loading state for fetching overall status
}

interface ErrorState {
  original: string | null;
  spun: string | null;
  reviewComments: string | null;
  screenshot: string | null;
  general: string | null;
  action: string | null; // New error state for actions
  status: string | null; // New error state for fetching overall status
}

function App() {
  const [content, setContent] = useState<ContentData>({
    original: "",
    spun: "",
    reviewComments: "",
    screenshotUrl: "",
  });

  const [loading, setLoading] = useState<LoadingState>({
    original: true,
    spun: true,
    reviewComments: true,
    screenshot: true,
    action: false,
    status: true, // Initialize status loading as true
  });

  const [errors, setErrors] = useState<ErrorState>({
    original: null,
    spun: null,
    reviewComments: null,
    screenshot: null,
    general: null,
    action: null,
    status: null, // Initialize status error as null
  });

  const [imageError, setImageError] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [currentChapterStatus, setCurrentChapterStatus] = useState<
    "pending" | "approved" | "revision_requested" | "processing"
  >("processing"); // New state for overall chapter status

  const CHAPTER_ID = "the_gates_of_morning_book1_chapter1";
  const API_BASE =
    typeof __api_base__ !== "undefined"
      ? __api_base__
      : "http://localhost:5000";

  // Memoized fetchContent function
  const fetchContent = useCallback(
    async (endpoint: string, contentType: keyof ContentData) => {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          throw new Error(
            `HTTP error! status: ${response.status} - ${
              errorData.message || response.statusText
            }`
          );
        }

        if (contentType === "screenshotUrl") {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setContent((prev) => ({ ...prev, [contentType]: imageUrl }));
        } else {
          const data = await response.json();
          const fetchedContent = data.content || "No content found.";
          setContent((prev) => ({ ...prev, [contentType]: fetchedContent }));
        }

        setErrors((prev) => ({ ...prev, [contentType]: null })); // Clear specific error on success
      } catch (error: any) {
        // Use 'any' for error type if not strictly defined
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        setErrors((prev) => ({ ...prev, [contentType]: errorMessage }));
        console.error(`Error fetching ${contentType}:`, error); // Log detailed error
      } finally {
        setLoading((prev) => ({ ...prev, [contentType]: false })); // Set loading to false regardless of success/failure
      }
    },
    [API_BASE]
  ); // Dependency array for useCallback

  // New function to fetch the latest chapter status from the backend
  const fetchChapterStatus = useCallback(async () => {
    setLoading((prev) => ({ ...prev, status: true }));
    setErrors((prev) => ({ ...prev, status: null }));
    try {
      const response = await fetch(
        `${API_BASE}/chromadb_status_chapter/${CHAPTER_ID}`
      ); // New endpoint
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new Error(
          `HTTP error! status: ${response.status} - ${
            errorData.message || response.statusText
          }`
        );
      }
      const data = await response.json();
      if (data.latest_status) {
        setCurrentChapterStatus(data.latest_status);
      } else {
        setCurrentChapterStatus("pending"); // Default if no specific status found
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setErrors((prev) => ({
        ...prev,
        status: `Failed to fetch chapter status: ${errorMessage}`,
      }));
      setCurrentChapterStatus("pending"); // Fallback status on error
    } finally {
      setLoading((prev) => ({ ...prev, status: false }));
    }
  }, [API_BASE, CHAPTER_ID]);

  // Main useEffect to fetch all content and status on mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchContent(`/content/${CHAPTER_ID}/original`, "original"),
        fetchContent(`/content/${CHAPTER_ID}/spun`, "spun"),
        fetchContent(
          `/content/${CHAPTER_ID}/review_comments`,
          "reviewComments"
        ),
        fetchContent("/screenshot", "screenshotUrl"),
      ]);
      fetchChapterStatus(); // Fetch status after content
    };
    loadData();
  }, [fetchContent, fetchChapterStatus, CHAPTER_ID]); // Dependencies for main useEffect

  const handleImageError = () => {
    setImageError(true);
    setErrors((prev) => ({ ...prev, screenshot: "Failed to load screenshot" }));
  };

  // Function to handle workflow actions (Approve/Request Revision)
  const handleWorkflowAction = async (
    actionType: "approve" | "request_revision",
    feedback: string = ""
  ) => {
    setLoading((prev) => ({ ...prev, action: true }));
    setErrors((prev) => ({ ...prev, action: null }));
    setActionMessage(null);

    const endpoint =
      actionType === "approve"
        ? `/approve_chapter/${CHAPTER_ID}`
        : `/request_revision/${CHAPTER_ID}`;
    const method = "POST";
    const body =
      actionType === "request_revision"
        ? JSON.stringify({ feedback })
        : undefined;
    const headers = { "Content-Type": "application/json" };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        body,
        headers,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unknown error occurred.");
      }
      setActionMessage(data.message);
      setCurrentChapterStatus(
        actionType === "approve" ? "approved" : "revision_requested"
      ); // Update local status immediately

      // If revision requested, re-fetch content to show the new spun version
      if (actionType === "request_revision") {
        setLoading((prev) => ({ ...prev, spun: true, reviewComments: true })); // Set loading for spun and comments
        await fetchContent(`/content/${CHAPTER_ID}/spun`, "spun");
        await fetchContent(
          `/content/${CHAPTER_ID}/review_comments`,
          "reviewComments"
        ); // Re-fetch review comments for new spun content
        setActionMessage(
          "Revision requested. New spun content and review comments are loading..."
        );
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setErrors((prev) => ({
        ...prev,
        action: `Action failed: ${errorMessage}`,
      }));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
      setShowFeedbackModal(false); // Close modal after action attempt
      setRevisionFeedback(""); // Clear feedback
    }
  };

  const getStatusInfo = () => {
    // This function now reflects the overall chapter status
    switch (currentChapterStatus) {
      case "approved":
        return {
          status: "Approved",
          color: "text-green-600",
          bg: "bg-green-50",
          icon: CheckCircle,
        };
      case "revision_requested":
        return {
          status: "Revision Requested",
          color: "text-orange-600",
          bg: "bg-orange-50",
          icon: AlertCircle,
        };
      case "pending":
        return {
          status: "Pending Review",
          color: "text-blue-600",
          bg: "bg-blue-50",
          icon: Hourglass,
        };
      case "processing":
      default:
        return {
          status: "Processing",
          color: "text-gray-600",
          bg: "bg-gray-50",
          icon: Clock,
        };
    }
  };

  const statusInfo = getStatusInfo();

  const LoadingSpinner = ({
    size = "default",
  }: {
    size?: "small" | "default" | "large";
  }) => {
    const sizeClasses = {
      small: "h-4 w-4",
      default: "h-6 w-6",
      large: "h-8 w-8",
    };

    return (
      <div className="flex items-center justify-center py-8">
        <Loader2
          className={`animate-spin text-blue-500 ${sizeClasses[size]}`}
        />
        <span className="ml-2 text-gray-600 text-sm">Loading content...</span>
      </div>
    );
  };

  const ActionButton = ({
    onClick,
    loading,
    icon: Icon,
    text,
    colorClass,
    disabled = false,
  }: {
    onClick: () => void;
    loading: boolean;
    icon: React.ElementType;
    text: string;
    colorClass: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg transition-colors font-medium
        ${loading ? "bg-gray-400 cursor-not-allowed text-gray-600" : colorClass}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span>{loading ? "Processing..." : text}</span>
    </button>
  );

  const MessageDisplay = ({
    message,
    type,
  }: {
    message: string | null;
    type: "success" | "error" | "info";
  }) => {
    if (!message) return null;
    const color =
      type === "success"
        ? "text-green-700"
        : type === "error"
        ? "text-red-700"
        : "text-blue-700";
    const bgColor =
      type === "success"
        ? "bg-green-100"
        : type === "error"
        ? "bg-red-100"
        : "bg-blue-100";
    const Icon =
      type === "success"
        ? CheckCircle
        : type === "error"
        ? XCircle
        : AlertCircle;

    return (
      <div
        className={`flex items-center p-3 rounded-lg ${bgColor} ${color} mb-4`}
      >
        <Icon className="h-5 w-5 mr-2" />
        <span>{message}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bot className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Book Publication Workflow
                  </h1>
                  <p className="text-sm text-gray-600">
                    Chapter:{" "}
                    {CHAPTER_ID.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                      l.toUpperCase()
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${statusInfo.bg}`}
              >
                <statusInfo.icon className={`h-4 w-4 ${statusInfo.color}`} />
                <span
                  className={`text-sm font-medium ${statusInfo.color} capitalize`}
                >
                  {statusInfo.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* General Error */}
        {errors.general && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <ErrorMessage message={errors.general} />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Content Comparison Section */}
          <div className="xl:col-span-2 space-y-6">
            {/* Original vs AI Spun Comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Content Comparison
                  </h2>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Eye className="h-4 w-4" />
                    <span>Side-by-side review</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                {/* Original Content */}
                <div className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <h3 className="font-medium text-gray-900">
                      Original Chapter
                    </h3>
                    {loading.original && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>

                  {loading.original ? (
                    <LoadingSpinner size="small" />
                  ) : errors.original ? (
                    <ErrorMessage message={errors.original} />
                  ) : (
                    <div className="h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                        {content.original}
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Spun Content */}
                <div className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Bot className="h-5 w-5 text-purple-600" />
                    <h3 className="font-medium text-gray-900">
                      AI Generated Version
                    </h3>
                    {loading.spun && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>

                  {loading.spun ? (
                    <LoadingSpinner size="small" />
                  ) : errors.spun ? (
                    <ErrorMessage message={errors.spun} />
                  ) : (
                    <div className="h-96 overflow-y-auto bg-purple-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                        {content.spun}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Screenshot Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Camera className="h-5 w-5 text-gray-600" />
                    <h3 className="font-medium text-gray-900">
                      Original Chapter Screenshot
                    </h3>
                    {loading.screenshot && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  {content.screenshotUrl && !errors.screenshot && (
                    <button
                      onClick={() => setExpandedScreenshot(!expandedScreenshot)}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Maximize2 className="h-4 w-4" />
                      <span>{expandedScreenshot ? "Collapse" : "Expand"}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {loading.screenshot ? (
                  <LoadingSpinner />
                ) : errors.screenshot || imageError ? (
                  <div className="bg-gray-100 rounded-lg p-12 text-center">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      Screenshot not available
                    </p>
                    <p className="text-sm text-gray-500">
                      {errors.screenshot || "Failed to load image"}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={content.screenshotUrl}
                      alt="Original Chapter Screenshot"
                      className={`w-full object-contain transition-all duration-300 ${
                        expandedScreenshot ? "max-h-none" : "max-h-64"
                      }`}
                      onError={handleImageError}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Review Panel */}
          <div className="space-y-6">
            {/* AI Review Comments */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-green-50 border-b border-gray-200">
                <button
                  onClick={() => setReviewExpanded(!reviewExpanded)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-gray-900">
                      AI Review Comments
                    </h3>
                    {loading.reviewComments && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  {reviewExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>

              {reviewExpanded && (
                <div className="p-6">
                  {loading.reviewComments ? (
                    <LoadingSpinner size="small" />
                  ) : errors.reviewComments ? (
                    <ErrorMessage message={errors.reviewComments} />
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {content.reviewComments}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Workflow Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Review Actions</h3>
              </div>
              <div className="p-6 space-y-3">
                {/* Action Messages */}
                <MessageDisplay message={actionMessage} type="success" />
                <MessageDisplay message={errors.action} type="error" />

                <ActionButton
                  onClick={() => handleWorkflowAction("approve")}
                  loading={loading.action}
                  icon={CheckCircle}
                  text="Approve Content"
                  colorClass="bg-green-600 hover:bg-green-700 text-white"
                  disabled={
                    currentChapterStatus === "approved" || loading.action
                  } // Disable if already approved or action in progress
                />
                <ActionButton
                  onClick={() => setShowFeedbackModal(true)} // Open modal for revision
                  loading={loading.action}
                  icon={ArrowRight}
                  text="Request Revision"
                  colorClass="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={
                    currentChapterStatus === "approved" || loading.action
                  } // Disable if approved or action in progress
                />
                <ActionButton
                  onClick={() =>
                    alert("Preview Final functionality not yet implemented.")
                  } // Placeholder
                  loading={false}
                  icon={Eye}
                  text="Preview Final"
                  colorClass="border border-gray-300 hover:bg-gray-50 text-gray-700"
                  disabled={true} // Disable for now as it's not implemented
                />
              </div>
            </div>

            {/* Progress Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Progress Summary</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Content Loading</span>
                  <span className={`font-medium ${statusInfo.color}`}>
                    {
                      Object.values(loading).filter(
                        (l) => typeof l === "boolean" && l !== loading.action
                      ).length
                    }
                    /4 Complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (Object.values(loading).filter(
                          (l) => typeof l === "boolean" && l !== loading.action
                        ).length /
                          4) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Review interface ready for human evaluation
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Revision Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              Request Revision Feedback
            </h3>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4"
              rows={5}
              placeholder="Provide detailed feedback for revision..."
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <ActionButton
                onClick={() =>
                  handleWorkflowAction("request_revision", revisionFeedback)
                }
                loading={loading.action}
                icon={ArrowRight}
                text="Submit Revision Request"
                colorClass="bg-blue-600 hover:bg-blue-700 text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
