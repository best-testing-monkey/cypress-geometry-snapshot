const {
  addMatchImageSnapshotPlugin,
} = require('cypress-geometry-snapshot/plugin');

module.exports = (on, config) => {
  addMatchImageSnapshotPlugin(on, config);
};
