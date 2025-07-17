import React, { useState, useEffect, useCallback } from "react";
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
  XCircle,
  Hourglass,
  Search,
  Mic,
  StopCircle,
  Volume2,
  VolumeX,
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
  action: boolean;
  status: boolean;
  search: boolean;
}

interface ErrorState {
  original: string | null;
  spun: string | null;
  reviewComments: string | null;
  screenshot: string | null;
  general: string | null;
  action: string | null;
  status: string | null;
  search: string | null;
}

interface SearchResult {
  id: string;
  content: string;
  version_type: string;
  timestamp: string;
  distance: number;
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
    status: true,
    search: false,
  });

  const [errors, setErrors] = useState<ErrorState>({
    original: null,
    spun: null,
    reviewComments: null,
    screenshot: null,
    general: null,
    action: null,
    status: null,
    search: null,
  });

  const [imageError, setImageError] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [currentChapterStatus, setCurrentChapterStatus] = useState<
    "pending" | "approved" | "revision_requested" | "processing"
  >("processing");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // State for Voice Input (STT)
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null
  );
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // State for Voice Output (TTS)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingContentId, setSpeakingContentId] = useState<string | null>(
    null
  );

  const CHAPTER_ID = "the_gates_of_morning_book1_chapter1";

  // UPDATED: Use import.meta.env.VITE_BACKEND_API_BASE for Vite
  const API_BASE =
    import.meta.env.VITE_BACKEND_API_BASE ||
    (typeof __api_base__ !== "undefined"
      ? __api_base__
      : "http://localhost:5000");

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

        setErrors((prev) => ({ ...prev, [contentType]: null }));
      } catch (error: any) {
        let errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        if (errorMessage.includes("AbortError")) {
          errorMessage = `Request timed out for ${contentType}.`;
        }
        setErrors((prev) => ({ ...prev, [contentType]: errorMessage }));
        console.error(`Error fetching ${contentType}:`, error);
      } finally {
        setLoading((prev) => ({ ...prev, [contentType]: false }));
      }
    },
    [API_BASE]
  );

  const fetchChapterStatus = useCallback(async () => {
    setLoading((prev) => ({ ...prev, status: true }));
    setErrors((prev) => ({ ...prev, status: null }));
    try {
      const response = await fetch(
        `${API_BASE}/chromadb_status_chapter/${CHAPTER_ID}`
      );
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
        setCurrentChapterStatus("pending");
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setErrors((prev) => ({
        ...prev,
        status: `Failed to fetch chapter status: ${errorMessage}`,
      }));
      setCurrentChapterStatus("pending");
    } finally {
      setLoading((prev) => ({ ...prev, status: false }));
    }
  }, [API_BASE, CHAPTER_ID]);

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setErrors((prev) => ({
        ...prev,
        search: "Please enter a search query.",
      }));
      setSearchResults([]);
      return;
    }

    setLoading((prev) => ({ ...prev, search: true }));
    setErrors((prev) => ({ ...prev, search: null }));
    setSearchResults([]);

    try {
      const response = await fetch(`${API_BASE}/semantic_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: searchQuery,
          n_results: 5,
          filter_metadata: { chapter_id: CHAPTER_ID },
        }),
      });

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
      setSearchResults(data.results || []);
      if (data.results && data.results.length === 0) {
        setErrors((prev) => ({
          ...prev,
          search: "No semantic search results found for your query.",
        }));
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setErrors((prev) => ({
        ...prev,
        search: `Semantic search failed: ${errorMessage}`,
      }));
      console.error("Semantic search error:", error);
    } finally {
      setLoading((prev) => ({ ...prev, search: false }));
    }
  };

  // Voice Input Logic (STT)
  const toggleRecording = () => {
    if (!("webkitSpeechRecognition" in window)) {
      setVoiceError(
        "Speech Recognition not supported by your browser. Please use Chrome."
      );
      return;
    }

    if (!recognition) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      const newRecognition = new SpeechRecognition();
      newRecognition.continuous = false;
      newRecognition.interimResults = false;
      newRecognition.lang = "en-IN";

      newRecognition.onstart = () => {
        setIsRecording(true);
        setVoiceError(null);
        setActionMessage("Listening for your feedback...");
      };

      newRecognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setRevisionFeedback((prev) => prev + (prev ? " " : "") + transcript);
        setActionMessage("Feedback transcribed.");
      };

      newRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsRecording(false);
        setVoiceError(`Voice input error: ${event.error}. Please try again.`);
        setActionMessage(null);
        console.error("Speech recognition error:", event);
      };

      newRecognition.onend = () => {
        setIsRecording(false);
        setActionMessage(null);
      };
      setRecognition(newRecognition);
    }

    if (isRecording) {
      recognition?.stop();
    } else {
      setRevisionFeedback("");
      recognition?.start();
    }
  };

  // Voice Output Logic (TTS)
  const speakContent = (text: string, contentId: string) => {
    if (!("speechSynthesis" in window)) {
      setErrors((prev) => ({
        ...prev,
        general: "Text-to-Speech not supported by your browser.",
      }));
      return;
    }

    if (isSpeaking && speakingContentId === contentId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingContentId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingContentId(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingContentId(contentId);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingContentId(null);
    };
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      setSpeakingContentId(null);
      setErrors((prev) => ({
        ...prev,
        general: `Text-to-Speech error: ${event.error}`,
      }));
      console.error("Speech synthesis error:", event);
    };

    window.speechSynthesis.speak(utterance);
  };

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
      fetchChapterStatus();
    };
    loadData();
  }, [fetchContent, fetchChapterStatus, CHAPTER_ID]);

  const handleImageError = () => {
    setImageError(true);
    setErrors((prev) => ({ ...prev, screenshot: "Failed to load screenshot" }));
  };

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
        actionType === "approve" ? "approved" : "processing"
      );

      if (actionType === "request_revision") {
        setActionMessage(
          "Revision requested. AI is generating new content and review. Please wait..."
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
        setLoading((prev) => ({ ...prev, spun: true, reviewComments: true }));
        await Promise.all([
          fetchContent(`/content/${CHAPTER_ID}/spun`, "spun"),
          fetchContent(
            `/content/${CHAPTER_ID}/review_comments`,
            "reviewComments"
          ),
        ]);
        await fetchChapterStatus();
        setActionMessage(
          "New content and review comments loaded. Ready for review."
        );
      } else if (actionType === "approve") {
        await fetchChapterStatus();
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
      setShowFeedbackModal(false);
      setRevisionFeedback("");
    }
  };

  const getStatusInfo = () => {
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

  const ErrorMessage = ({ message }: { message: string }) => (
    <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      <span className="text-red-700 text-sm">{message}</span>
    </div>
  );

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
        <Icon className="h-5 w-5 mr-2 flex-shrink-0" />
        <span className="text-sm">{message}</span>
      </div>
    );
  };

  // Calculate progress
  const contentLoadingStates = [
    loading.original,
    loading.spun,
    loading.reviewComments,
    loading.screenshot,
  ];
  const completedItems = contentLoadingStates.filter((state) => !state).length;
  const progressPercentage = (completedItems / 4) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div className="mb-6">
            <ErrorMessage message={errors.general} />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Content Comparison (Original, Spun, Screenshot) */}
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
                    <div className="ml-auto flex items-center space-x-2">
                      {/* Read Aloud Button for Spun Content */}
                      <button
                        onClick={() =>
                          speakContent(content.spun, "spun-content")
                        }
                        className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                        title={
                          isSpeaking && speakingContentId === "spun-content"
                            ? "Stop Reading"
                            : "Read Aloud"
                        }
                      >
                        {isSpeaking && speakingContentId === "spun-content" ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                      {loading.spun && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                    </div>
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

          {/* Right Column: Review Panel, Semantic Search, Workflow Actions, Progress Summary */}
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
                    <div className="flex items-center space-x-2">
                      {/* Read Aloud Button for Review Comments */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakContent(
                            content.reviewComments,
                            "review-comments"
                          );
                        }}
                        className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                        title={
                          isSpeaking && speakingContentId === "review-comments"
                            ? "Stop Reading"
                            : "Read Aloud"
                        }
                      >
                        {isSpeaking &&
                        speakingContentId === "review-comments" ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                      {loading.reviewComments && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                    </div>
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

            {/* Semantic Search Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Semantic Search
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Search content semantically..."
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      // Allow pressing Enter to search
                      if (e.key === "Enter") {
                        handleSemanticSearch();
                      }
                    }}
                  />
                  <button
                    onClick={handleSemanticSearch}
                    disabled={loading.search}
                    className={`p-2 rounded-lg text-white transition-colors
                      ${
                        loading.search
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }
                    `}
                  >
                    {loading.search ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.search && (
                  <MessageDisplay message={errors.search} type="error" />
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <h4 className="font-medium text-gray-800">
                      Search Results:
                    </h4>
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="text-sm border-b border-gray-100 pb-2 last:border-b-0"
                      >
                        <p className="font-semibold text-gray-700">
                          {result.version_type.replace(/_/g, " ").toUpperCase()}{" "}
                          (Distance: {result.distance.toFixed(4)})
                        </p>
                        <p className="text-gray-600 line-clamp-2">
                          {result.content}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ID: {result.id}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                  }
                />
                <ActionButton
                  onClick={() => setShowFeedbackModal(true)}
                  loading={loading.action}
                  icon={ArrowRight}
                  text="Request Revision"
                  colorClass="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={
                    currentChapterStatus === "approved" || loading.action
                  }
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
                    {completedItems}/4 Complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPercentage}%`,
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
            {voiceError && <MessageDisplay message={voiceError} type="error" />}
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-lg text-white transition-colors flex items-center space-x-2
                        ${
                          isRecording
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-purple-600 hover:bg-purple-700"
                        }
                        ${
                          !("webkitSpeechRecognition" in window)
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }
                    `}
                disabled={!("webkitSpeechRecognition" in window)}
                title={isRecording ? "Stop Recording" : "Start Voice Input"}
              >
                {isRecording ? (
                  <StopCircle className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
                <span>{isRecording ? "Stop Recording" : "Voice Input"}</span>
              </button>
              {isRecording && (
                <span className="text-sm text-gray-600 animate-pulse">
                  Listening...
                </span>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setRevisionFeedback("");
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleWorkflowAction("request_revision", revisionFeedback)
                }
                disabled={loading.action}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading.action ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                <span>
                  {loading.action ? "Processing..." : "Submit Revision Request"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
