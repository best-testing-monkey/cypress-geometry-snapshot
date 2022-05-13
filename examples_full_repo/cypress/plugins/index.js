const {
  addMatchGeometrySnapshotPlugin,
} = require('cypress-geometry-snapshot/plugin');

module.exports = (on, config) => {
  addMatchGeometrySnapshotPlugin(on, config);
};
