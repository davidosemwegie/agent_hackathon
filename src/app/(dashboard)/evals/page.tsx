"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Clock,
} from "lucide-react";

interface EvalMetrics {
  overview: {
    totalFeedback: number;
    avgSuccessRate: string;
    days: number;
  };
  successRateTrend: Array<{
    date: string;
    success_rate: number;
    total_feedback: number;
  }>;
  toolUsage: Array<{
    tool_name: string;
    usage_count: number;
    success_count: number;
    error_count: number;
    avg_duration_ms: number;
    led_to_success: number;
  }>;
  recentFeedback: Array<{
    id: string;
    rating: number;
    resolved: boolean;
    feedback_text: string;
    task_category: string;
    created_at: string;
    title: string;
  }>;
}

export default function EvalsPage() {
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/evals/metrics?days=${days}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8 text-center text-gray-500">
        No metrics available yet
      </div>
    );
  }

  const latestSuccessRate =
    metrics.successRateTrend.length > 0
      ? metrics.successRateTrend[metrics.successRateTrend.length - 1]
          .success_rate
      : 0;

  const previousSuccessRate =
    metrics.successRateTrend.length > 1
      ? metrics.successRateTrend[metrics.successRateTrend.length - 2]
          .success_rate
      : latestSuccessRate;

  const successRateChange = latestSuccessRate - previousSuccessRate;

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agent Evaluations</h1>
            <p className="text-gray-600 mt-1">
              Track performance and learn from successful interactions
            </p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold mt-1">
                  {parseFloat(metrics.overview.avgSuccessRate).toFixed(1)}%
                </p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  successRateChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {successRateChange >= 0 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
                {Math.abs(successRateChange).toFixed(1)}%
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Feedback</p>
                <p className="text-3xl font-bold mt-1">
                  {metrics.overview.totalFeedback}
                </p>
              </div>
              <Activity className="size-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Time Period</p>
                <p className="text-3xl font-bold mt-1">{days}d</p>
              </div>
              <Clock className="size-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Success Rate Trend */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Success Rate Trend</h2>
          <div className="space-y-2">
            {metrics.successRateTrend.map((day) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">
                  {new Date(day.date).toLocaleDateString()}
                </span>
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all"
                    style={{ width: `${day.success_rate}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">
                  {day.success_rate.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 w-16 text-right">
                  ({day.total_feedback} total)
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Tool Usage Statistics */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Tool Performance</h2>
          <div className="space-y-3">
            {metrics.toolUsage.map((tool) => {
              const successRate =
                tool.usage_count > 0
                  ? (tool.success_count / tool.usage_count) * 100
                  : 0;
              const contributionRate =
                tool.usage_count > 0
                  ? (tool.led_to_success / tool.usage_count) * 100
                  : 0;

              return (
                <div
                  key={tool.tool_name}
                  className="p-4 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{tool.tool_name}</h3>
                    <Badge variant="outline">{tool.usage_count} uses</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Success Rate</span>
                      <p className="font-semibold text-green-600">
                        {successRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Led to Success</span>
                      <p className="font-semibold text-blue-600">
                        {contributionRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Errors</span>
                      <p className="font-semibold text-red-600">
                        {tool.error_count}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg Duration</span>
                      <p className="font-semibold">
                        {tool.avg_duration_ms.toFixed(0)}ms
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Feedback */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Feedback</h2>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {metrics.recentFeedback.map((feedback) => (
                <div
                  key={feedback.id}
                  className="p-4 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {feedback.rating >= 4 ? (
                        <ThumbsUp className="size-5 text-green-600" />
                      ) : (
                        <ThumbsDown className="size-5 text-red-600" />
                      )}
                      <span className="font-medium truncate max-w-[300px]">
                        {feedback.title || "Untitled"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {feedback.feedback_text && (
                    <p className="text-sm text-gray-600 mt-2">
                      {feedback.feedback_text}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {feedback.resolved && (
                      <Badge variant="outline" className="bg-green-50">
                        Resolved
                      </Badge>
                    )}
                    {feedback.task_category && (
                      <Badge variant="outline">{feedback.task_category}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
