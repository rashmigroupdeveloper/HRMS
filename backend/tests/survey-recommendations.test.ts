import { describe, expect, it } from 'vitest';
import { surveyRecommendations } from '../src/modules/engagement/survey-recommendations.js';

describe('surveyRecommendations', () => {
  it('flags a low rating and a majority choice', () => {
    const notes = surveyRecommendations([
      { prompt: 'I can raise a concern', type: 'rating', totalAnswers: 4, avgRating: 2.5 },
      { prompt: 'What should improve', type: 'choice', totalAnswers: 4, choiceDistribution: { Pay: 3, Leave: 1 } },
    ]);
    expect(notes[0]).toContain('2.5');
    expect(notes[1]).toContain('Pay');
  });

  it('says to hold course when every signal is healthy', () => {
    const notes = surveyRecommendations([
      { prompt: 'Manager support', type: 'rating', totalAnswers: 2, avgRating: 4.5 },
    ]);
    expect(notes).toEqual([
      'No question is below the concern line. Keep the current practice and run the survey again next quarter.',
    ]);
  });
});
