/** Letters module public API (module pattern — see ../README.md). */
export { lettersRouter } from './letters.router.js';
export { registerLettersWorkflowHooks } from './workflow-hooks.js';
export { issueLetter, listLetters, renderTemplate } from './letters.service.js';
