"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

interface FeedbackWidgetProps {
  conversationId: string;
  userId?: string;
  onSubmit?: (feedback: {
    rating: number;
    resolved: boolean;
    feedbackText?: string;
  }) => void;
  className?: string;
}

export function FeedbackWidget({
  conversationId,
  userId = "default-user",
  onSubmit,
  className,
}: FeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);

  const handleRatingClick = (rating: number) => {
    setSelectedRating(rating);
    setShowTextInput(true);
  };

  const handleSubmit = async () => {
    if (selectedRating === null) return;

    const feedback = {
      conversationId,
      userId,
      rating: selectedRating,
      resolved: selectedRating >= 4,
      feedbackText: feedbackText.trim() || undefined,
      taskCategory: "general", // Could be inferred from conversation
    };

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });

      if (response.ok) {
        setSubmitted(true);
        onSubmit?.({
          rating: selectedRating,
          resolved: selectedRating >= 4,
          feedbackText: feedbackText.trim() || undefined,
        });
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  const handleSkip = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-gray-600", className)}>
        <MessageSquare className="size-4" />
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-4 bg-gray-50 rounded-lg border", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Was this helpful?</p>
        <button
          onClick={handleSkip}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Skip
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={selectedRating === 5 ? "default" : "outline"}
          onClick={() => handleRatingClick(5)}
          className={cn(
            "flex items-center gap-2",
            selectedRating === 5 && "bg-green-600 hover:bg-green-700"
          )}
        >
          <ThumbsUp className="size-4" />
          Yes
        </Button>
        <Button
          size="sm"
          variant={selectedRating === 1 ? "default" : "outline"}
          onClick={() => handleRatingClick(1)}
          className={cn(
            "flex items-center gap-2",
            selectedRating === 1 && "bg-red-600 hover:bg-red-700"
          )}
        >
          <ThumbsDown className="size-4" />
          No
        </Button>
      </div>

      {showTextInput && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <Textarea
            placeholder="Tell us more (optional)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="min-h-[60px] text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSkip}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={selectedRating === null}
            >
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
