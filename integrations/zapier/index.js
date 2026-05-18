// Zapier CLI requires a root-level index.js entry point (ignores package.json "main").
// This is a platform limitation — see: https://github.com/zapier/zapier-platform/issues/742
module.exports = require('./dist/index').default || require('./dist/index');
