const { createDefaultCategories } = require('./controller');

const initializeCategories = async () => {
  await createDefaultCategories();
};

module.exports = { initializeCategories };
