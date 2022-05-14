/* eslint-disable no-restricted-syntax */
const fs = require('fs');

Object.defineProperty(exports, '__esModule', {
  value: true,
});

const _extends =
  Object.assign ||
  function(target) {
    for (let i = 1; i < arguments.length; i++) {
      const source = arguments[i];
      for (const key in source) {
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

exports.MatchGeometrySnapshotCommand = MatchGeometrySnapshotCommand;
exports.addMatchGeometrySnapshotCommand = addMatchGeometrySnapshotCommand;

const _constants = require('./constants');
const fs = require('fs-extra');

const screenshotsFolder = Cypress.config('screenshotsFolder');
const updateSnapshots = Cypress.env('updateSnapshots') || false;
const failOnSnapshotDiff =
  typeof Cypress.env('failOnSnapshotDiff') === 'undefined';
const snapshotsDir = `${screenshotsFolder}/../snapshots`;

function getPathTo(element) {
  if (element.id !== '') return `id("${element.id}")`;
  if (element === document.body) return element.tagName;

  let ix = 0;
  const siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element)
      return `${getPathTo(element.parentNode)}/${element.tagName}[${ix + 1}]`;
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix += 1;
  }
}

function saveAsJson(shotFN, geoMap) {
  cy.log(`Save ${shotFN}`);
  cy.writeFile(shotFN, JSON.stringify(geoMap, null, 2));
}

function diffKeys(oldKeys, newKeys) {
  return {
    common: oldKeys.filter(x => newKeys.includes(x)),
    removed: oldKeys.filter(x => !newKeys.includes(x)),
    added: newKeys.filter(x => !oldKeys.includes(x)),
  };
}

function checkForNewElements(keysDiff) {
  let shouldFail = false;
  if (keysDiff.added.length > 0) {
    shouldFail = true;
    for (const key of keysDiff.added) {
      cy.log(`New element: ${key}`);
    }
  }
  return shouldFail;
}

function checkForMissingElements(keysDiff) {
  let shouldFail = false;
  if (keysDiff.removed.length > 0) {
    shouldFail = true;
    for (const key of keysDiff.added) {
      cy.log(`Removed element: ${key}`);
    }
  }
  return shouldFail;
}

function checkBounds(keysDiff, geoMapExisting, geoMap, shouldFail) {
  for (const key of keysDiff.common) {
    const oldBounds = geoMapExisting[key];
    const newBounds = geoMap[key];
    let boundsDiffer = false;
    for (const boundsKey of Object.keys(oldBounds)) {
      if (oldBounds[boundsKey] !== newBounds[boundsKey]) {
        boundsDiffer = true;
        shouldFail = true;
        break;
      }
    }
    if (boundsDiffer) {
      cy.log(
        `Element bounds differ:${JSON.stringify({
          saved: oldBounds,
          observed: newBounds,
        })}`
      );
    }
  }
  return shouldFail;
}

function compareSavedAndCurrentBounds(geoMapExisting, geoMap) {
  let shouldFail = false;
  const keysDiff = diffKeys(Object.keys(geoMapExisting), Object.keys(geoMap));
  // new element
  shouldFail = shouldFail || checkForNewElements(keysDiff);

  // missing element
  shouldFail = shouldFail || checkForMissingElements(keysDiff);

  // Bounds
  return shouldFail || checkBounds(keysDiff, geoMapExisting, geoMap);
}

function loadAsJson(snapFN) {
  const geoMapExisting = JSON.parse(fs.readFileSync(snapFN));
  return geoMapExisting;
}

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
    // target.screenshot(name, options);
    cy.log('Get the bounds of all visible elements');
    cy.get(':visible').each((visibleElement, elementIndex, allElements) => {
      // Wait untill the last for efficiency
      if (elementIndex == allElements.length - 1) {
        const allBounds = {};
        for (let i = 0; i < allElements.length; i += 1) {
          const element = allElements[i];
          const bounds = element.getBoundingClientRect();
          const elemXpath = getPathTo(element);
          allBounds[elemXpath] = bounds;
        }
        // wrap allBounds and make into an alias to get the value out of this "each" async block
        cy.wrap(allBounds).as('geometryMap');
      }
    });
    cy.get('@geometryMap').then(geoMap => {
      const shotFN = `${screenshotsFolder}/${name}.json`;
      saveAsJson(shotFN, geoMap);

      const snapFN = `${snapshotsDir}/${name}.json`;
      cy.log(`Looking for ${snapFN}`);
      cy.task('fileExists', { path: snapFN }).then(itExists => {
        if (itExists) {
          cy.log('Existing version found in snapshots');
          const geoMapExisting = loadAsJson(snapFN);
          cy.log('Compare current and saved bounds');
          const shouldFail = compareSavedAndCurrentBounds(
            geoMapExisting,
            geoMap
          );

          if (!shouldFail) {
            cy.log('No differences found');
          } else {
            throw 'Differences were found';
          }
        } else {
          saveAsJson(snapFN, geoMap);
        }
      });
    });

    /*        return cy.task(_constants.RECORD).then(({
                                                            pass,
                                                            added,
                                                            updated,
                                                            diffSize,
                                                            imageDimensions,
                                                            diffRatio,
                                                            diffPixelCount,
                                                            diffOutputPath
                                                        }) => {
                    if (!pass && !added && !updated) {
                        const message = diffSize ? `Image size (${imageDimensions.baselineWidth}x${imageDimensions.baselineHeight}) different than saved snapshot size (${imageDimensions.receivedWidth}x${imageDimensions.receivedHeight}).\nSee diff for details: ${diffOutputPath}` : `Image was ${diffRatio * 100}% not the same as saved snapshot with ${diffPixelCount} different pixels.\nSee diff for details: ${diffOutputPath}`;

                        if (failOnSnapshotDiff) {
                            throw new Error(message);
                        } else {
                            Cypress.log({message});
                        }
                    }
                }); */
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
