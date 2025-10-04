import { NextResponse } from 'next/server';
import { evalManager } from '@/lib/eval-manager';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get multiple metrics in parallel
    const [successRateTrend, toolUsage, recentFeedback] = await Promise.all([
      evalManager.getSuccessRateTrend(days),
      evalManager.analyzeToolUsage(days),
      evalManager.getRecentFeedback(20),
    ]);

    // Calculate overall stats
    const totalFeedback = successRateTrend.reduce(
      (sum: number, day: any) => sum + day.total_feedback,
      0
    );

    const avgSuccessRate = successRateTrend.length > 0
      ? successRateTrend.reduce((sum: number, day: any) => sum + day.success_rate, 0) / successRateTrend.length
      : 0;

    return NextResponse.json({
      overview: {
        totalFeedback,
        avgSuccessRate: avgSuccessRate.toFixed(2),
        days,
      },
      successRateTrend,
      toolUsage,
      recentFeedback,
    });
  } catch (error) {
    console.error('Error fetching eval metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch eval metrics' },
      { status: 500 }
    );
  }
}
