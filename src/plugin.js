'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.cachePath = undefined;

/*
var _extends =
    Object.assign ||
    function(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
*/

// exports.MatchGeometrySnapshotOptions = MatchGeometrySnapshotOptions;
// exports.MatchGeometrySnapshotResult = MatchGeometrySnapshotResult;
// exports.MatchGeometrySnapshotPlugin = MatchGeometrySnapshotPlugin;
exports.addMatchGeometrySnapshotPlugin = addMatchGeometrySnapshotPlugin;

const _fsExtra = require('fs-extra');

const _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function addMatchGeometrySnapshotPlugin(on, config) {
  // on('task', {
  //   [_constants.MATCH]: MatchGeometrySnapshotOptions(config),
  //   [_constants.RECORD]: MatchGeometrySnapshotResult(config),
  // });
  // on('after:screenshot', MatchGeometrySnapshotPlugin);

  on('task', {
    // deconstruct the individual properties
    fileExists({ path }) {
      if (_fsExtra2.default.existsSync(path)) {
        return path;
      } else {
        return false;
      }
    },
    loadAsJson({ path }) {
      const geoMapExisting = JSON.parse(_fsExtra2.default.readFileSync(path));
      return geoMapExisting;
    },
  });
}
