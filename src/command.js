'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

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
/**
 * Copyright (c) 2018-present The Palmer Group
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

exports.MatchGeometrySnapshotCommand = MatchGeometrySnapshotCommand;
exports.addMatchGeometrySnapshotCommand = addMatchGeometrySnapshotCommand;

var _constants = require('./constants');

const screenshotsFolder = Cypress.config('screenshotsFolder');
const updateSnapshots = Cypress.env('updateSnapshots') || false;
const failOnSnapshotDiff =
  typeof Cypress.env('failOnSnapshotDiff') === 'undefined';

function MatchGeometrySnapshotCommand(defaultOptions) {
  return function MatchGeometrySnapshot(subject, maybeName, commandOptions) {
    const options = _extends(
      {},
      defaultOptions,
      (typeof maybeName === 'string' ? commandOptions : maybeName) || {}
    );

    cy.task(_constants.MATCH, {
      screenshotsFolder,
      updateSnapshots,
      options,
    });

    const name = typeof maybeName === 'string' ? maybeName : undefined;
    const target = subject ? cy.wrap(subject) : cy;
    target.screenshot(name, options);

    return cy
      .task(_constants.RECORD)
      .then(
        ({
          pass,
          added,
          updated,
          diffSize,
          imageDimensions,
          diffRatio,
          diffPixelCount,
          diffOutputPath,
        }) => {
          if (!pass && !added && !updated) {
            const message = diffSize
              ? `Image size (${imageDimensions.baselineWidth}x${
                  imageDimensions.baselineHeight
                }) not the same as saved snapshot size (${
                  imageDimensions.receivedWidth
                }x${
                  imageDimensions.receivedHeight
                }).\nSee diff for details: ${diffOutputPath}`
              : `Image was ${diffRatio *
                  100}% not the same as saved snapshot with ${diffPixelCount} different pixels.\nSee diff for details: ${diffOutputPath}`;

            if (failOnSnapshotDiff) {
              throw new Error(message);
            } else {
              Cypress.log({ message });
            }
          }
        }
      );
  };
}

function addMatchGeometrySnapshotCommand(
  maybeName = 'MatchGeometrySnapshot',
  maybeOptions
) {
  const options = typeof maybeName === 'string' ? maybeOptions : maybeName;
  const name =
    typeof maybeName === 'string' ? maybeName : 'MatchGeometrySnapshot';
  Cypress.Commands.add(
    name,
    {
      prevSubject: ['optional', 'element', 'window', 'document'],
    },
    MatchGeometrySnapshotCommand(options)
  );
}
