/** Engagement module public API (module pattern — see ../README.md). */
export { engagementRouter } from './engagement.router.js';
export {
  createSurvey,
  listSurveysForUser,
  listAllSurveys,
  respondToSurvey,
  surveyResults,
  closeSurvey,
} from './surveys.service.js';
