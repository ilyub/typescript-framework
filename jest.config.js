const config = require("@skylib/config/src/jest-preset");

module.exports = {
  moduleNameMapper: {
    ...config.moduleNameMapper,
    [/^pouchdb$/u.source]: require.resolve("pouchdb/dist/pouchdb.js")
  },
  preset: "@skylib/config/src"
};