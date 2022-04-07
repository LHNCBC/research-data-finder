// Plugins enable you to tap into, modify, or extend the internal behavior of Cypress
// For more info, visit https://on.cypress.io/plugins-api
import * as fs from 'fs';

module.exports = (on, config) => {
  on('task', {
    removeCohortFileIfExist(): null {
      const cohortFile = `${config.downloadsFolder}/cohort-100.json`;
      if (fs.existsSync(cohortFile)) {
        fs.unlinkSync(cohortFile);
      }
      return null;
    }
  });
};
