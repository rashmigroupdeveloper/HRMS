/**
 * EN-03: HR gets a recommendation from the tally, not only the raw counts.
 * A rating at or below 3, or one answer chosen by at least half the responses,
 * is the item to act on.
 */
export interface RecommendationQuestion {
  prompt: string;
  type: 'rating' | 'choice' | 'text';
  totalAnswers: number;
  avgRating?: number | null | undefined;
  choiceDistribution?: Record<string, number> | undefined;
}

export function surveyRecommendations(questions: readonly RecommendationQuestion[]): string[] {
  const notes: string[] = [];
  for (const question of questions) {
    if (question.totalAnswers === 0) continue;
    if (
      question.type === 'rating' &&
      question.avgRating !== null &&
      question.avgRating !== undefined &&
      question.avgRating <= 3
    ) {
      notes.push(
        `"${question.prompt}" averages ${question.avgRating.toFixed(1)} out of 5. Review it with the team and publish what will change.`,
      );
    }
    if (question.type === 'choice' && question.choiceDistribution) {
      const top = Object.entries(question.choiceDistribution).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / question.totalAnswers >= 0.5) {
        notes.push(
          `Most people answered "${top[0]}" on "${question.prompt}" (${String(top[1])} of ${String(question.totalAnswers)}). Treat that as the priority.`,
        );
      }
    }
  }
  if (notes.length === 0 && questions.some((question) => question.totalAnswers > 0)) {
    notes.push('No question is below the concern line. Keep the current practice and run the survey again next quarter.');
  }
  return notes;
}
