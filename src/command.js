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
 * Copyright (c) 2022-present best-testing-monkey (Tim Jansen)
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
  typeof Cypress.env('failOnSnapshotDiff') === 'undefined' ||
  Cypress.env('failOnSnapshotDiff');
const snapshotsDir = `${screenshotsFolder}/../snapshots`;

/**
 * Derive a readable, valid xpath expression.
 *
 * Limitation: elements in an iframe are identified by the xpath valid within that iframe.
 *
 * @param {(() => (Node | null))|ActiveX.IXMLDOMNode|(Node & ParentNode)|ChildNode} node
 *
 * @returns {string}
 */
function getXPath(node) {
  if (node === document.body) {
    return `//${node.tagName}`;
  }
  if (typeof node.hasAttribute === 'undefined') {
    return '/';
  }

  let old = '';
  if (node.hasAttribute('id')) {
    old = `/${node.tagName}[@id='${node.id}']`;
  } else if (node.hasAttribute('class')) {
    old = `/${node.tagName}[@class='${node.getAttribute('class')}']`;
  } else {
    //get the sibling #
    const siblings = node.parentNode.childNodes;
    let sibIndex = -1;
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling !== node && sibling.tagName === node.tagName) {
        sibIndex = i + 1;
        break;
      }
    }
    if (sibIndex > 0) {
      old = `/${node.tagName}[${sibIndex}]`;
    } else {
      old = '/' + node.tagName;
    }
  }

  let new_path;
  if (node.parentNode.tagName === 'HTML') {
    new_path = '//HTML' + old;
  } else {
    new_path = getXPath(node.parentNode) + old;
  }

  return new_path;
}

/**
 * Save an object serialized as JSON
 *
 * @param {string} shotFN
 * @param {Object} geoMap
 */
function saveAsJson(shotFN, geoMap) {
  cy.log(`Save ${shotFN}`);
  cy.writeFile(shotFN, JSON.stringify(geoMap, null, 2));
}

/**
 * return ${subjectArray} without all elements regex matching any in ${regexList}
 *
 * @param {string[]} subjectArray
 * @param {string[]} regexList
 *
 * @returns {string[]}
 */
function filterOutRegex(subjectArray, regexList) {
  console.log('filterOutRegex:');
  if (regexList.length === 0) {
    return subjectArray;
  }

  let retVals = [];
  for (let x of subjectArray) {
    for (let rx of regexList) {
      if (x.match(rx) === null) {
        retVals.push(x);
      }
    }
  }
  return retVals;

  //This is neater, but does not seem to work:
  // return subjectArray.filter(x => {return regexList.some(function(rx) {
  //     console.log(`"${x}".match("${rx}") === null`)
  //     return x.match(rx) === null; })})
}

/**
 * return ${subjectArray} with all elements regex matching any in ${regexList}
 *
 * @param {string[]} subjectArray
 * @param {string[]} regexList
 *
 * @returns {string[]}
 */
function filterInRegex(subjectArray, regexList) {
  console.log('filterInRegex');
  if (regexList.length === 0) {
    return [];
  }
  let retVals = [];
  for (let x of subjectArray) {
    for (let rx of regexList) {
      if (x.match(rx) !== null) {
        retVals.push(x);
      }
    }
  }
  return retVals;

  //This is neater, but does not seem to work:
  // return subjectArray.filter(x => {return regexList.some(function(rx) {
  //     console.log(`"${x}".match("${rx}") !== null`)
  //     return x.match(rx) !== null; })})
}

/**
 * Diff the keys of two objects
 *
 * @param {string[]} oldObject
 * @param {string[]} newObject
 * @param {string[]} ignoredKeys
 *
 * @returns {{common: string[], removed: string[], added: string[]}} Object with the keys of both objects divided between common (no change), removed (keys in oldObject not in the keys of newObject) and added (keys of newObject not found in oldObject)
 */
function diffArrays(oldObject, newObject, ignoredKeys) {
  let retvals = {
    common: oldObject.filter(x => newObject.includes(x)),
    removed: oldObject.filter(x => !newObject.includes(x)),
    added: newObject.filter(x => !oldObject.includes(x)),
  };
  for (let key of Object.keys(retvals)) {
    let ignored = filterInRegex(retvals[key], ignoredKeys);
    retvals[key] = filterOutRegex(retvals[key], ignoredKeys);
    console.log('Ignored @' + key);
    console.log(JSON.stringify(ignored, null, 2));
  }
  return retvals;
}

/**
 * remove the last occurance of ${removeString} from ${subjectStr}
 *
 * @param {string} removeString
 * @param {string} subjectStr
 *
 * @returns {string}
 */
function removeLastInstance(removeString, subjectStr) {
  const subStringIndex = subjectStr.lastIndexOf(removeString);
  if (subStringIndex < 0) return subjectStr;
  let partOne = subjectStr.substring(0, subStringIndex);
  let partTwo = subjectStr.substring(subStringIndex + removeString.length);
  return partOne + partTwo;
}

/**
 * @param {string[]} allBounds
 * @param {Object<string, {x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number}>} boundsMapNew
 * @param {string} strokeStyle
 */
function highlightBounds(allBounds, boundsMapNew, strokeStyle) {
  for (const key of allBounds) {
    let bounds = boundsMapNew[key];
    drawRectangle(bounds.x, bounds.y, bounds.width, bounds.height, strokeStyle);
  }
}

/**
 * Checks and reports elements that are newly displayed, compared to the saved keys
 *
 * @param {{common: string[], removed: string[], added: string[]}} keysDiff
 *
 * @param {boolean} highLight
 * @param {Object.<string, {x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number}>} boundsMapNew
 * @returns {string} a string with a report of the new elements
 */
function checkForNewElements(keysDiff, highLight = undefined, boundsMapNew) {
  let failLines = '';
  if (keysDiff.added.length > 0) {
    for (const key of keysDiff.added) {
      failLines += `New element: ${key}\n`;
      cy.log(`New element: ${key}`);
    }
  }

  if (highLight) highlightBounds(keysDiff.added, boundsMapNew, 'green');

  if (failLines.length > 0) {
    let newElements = failLines.split('\n').length;
    cy.log(`${newElements} new elements found`);
    failLines = `${newElements} new elements found:\n  - ${failLines.replaceAll(
      '\n',
      '\n  - '
    )}`;
    failLines = removeLastInstance('  - ', failLines);
  }
  return failLines;
}

/**
 * Checks and reports elements that are no longer displayed, compared to the saved keys
 *
 * @param {{common: string[], removed: string[], added: string[]}} keysDiff
 *
 * @returns {string} a string with a report of the removed elements
 */
function checkForMissingElements(
  keysDiff,
  highLight = false,
  boundsMapOld = undefined
) {
  let missingElements = 0;
  let failLines = '';

  if (keysDiff.removed.length > 0) {
    for (const key of keysDiff.removed) {
      failLines += `Removed element: ${key}\n`;
      missingElements++;
    }
  }

  if (highLight) highlightBounds(keysDiff.removed, boundsMapOld, 'red');

  if (missingElements > 0) {
    failLines = `${missingElements} missing elements:\n  - ${failLines.replaceAll(
      '\n',
      '\n  - '
    )}`;
    failLines = removeLastInstance('  - ', failLines);
  }
  return failLines;
}

/**
 * Compare the bounds in ${boundsMapOld} and ${boundsMapNew}, returning a string report of bounds differing >= ${maxPixelDiff}
 *
 * @param {{common: string[], removed: string[], added: string[]}} keysDiff
 * @param {number} maxPixelDiff max pixels a bound may differ on any value
 * @param {Object.<string, {x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number}>} boundsMapNew
 * @param {Object.<string, {x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number}>} boundsMapOld
 *
 * @returns string a string report of bounds differing >= ${maxPixelDiff}
 */
function checkBounds(
  keysDiff,
  boundsMapOld,
  boundsMapNew,
  maxPixelDiff,
  highLight
) {
  if (typeof maxPixelDiff === 'undefined') {
    maxPixelDiff = 0;
  }
  let failLines = '';

  for (const key of keysDiff.common) {
    const oldBounds = boundsMapOld[key];
    const newBounds = boundsMapNew[key];
    let boundsDiffer = false;
    let differKeys = '';
    let differBounds = { old: {}, new: {} };
    for (const boundsKey of Object.keys(oldBounds)) {
      if (
        Math.abs(oldBounds[boundsKey] - newBounds[boundsKey]) > maxPixelDiff
      ) {
        boundsDiffer = true;
        differKeys += ' ' + boundsKey;

        differBounds.old[boundsKey] = oldBounds[boundsKey];
        differBounds.new[boundsKey] = newBounds[boundsKey];
      }
    }

    if (highLight) {
      highlightBounds(differBounds.old, boundsMapNew, 'blue');
      highlightBounds(differBounds.new, boundsMapNew, 'orange');
    }

    if (boundsDiffer) {
      differKeys = differKeys.trim();
      differKeys = differKeys.replaceAll(' ', ', ');
      failLines += `- ${differKeys}:\n    ${JSON.stringify(
        { path: key, saved: oldBounds, observed: newBounds },
        null,
        2
      ).replaceAll('\n', '\n    ')}\n`;
    }
  }
  if (failLines.length > 0) {
    failLines = `Bounds differ:\n ${failLines.replaceAll('\n', '\n  ')}`;
  }
  return failLines;
}

function setupCanvas() {
  const canvas = document.createElement('canvas'); //Create a canvas element
  document.drawingCanvas = canvas;

  //Set canvas width/height
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  //Set canvas drawing area width/height
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  //Position canvas
  canvas.style.position = 'absolute';
  canvas.style.left = 0;
  canvas.style.top = 0;
  canvas.style.zIndex = 100000;
  canvas.style.pointerEvents = 'none'; //Make sure you can click 'through' the canvas
  document.body.appendChild(canvas); //Append canvas to body element
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} strokeStyle
 * @param {string} fillStyle
 */
function drawRectangle(
  x,
  y,
  width,
  height,
  strokeStyle = 'red',
  fillStyle = undefined
) {
  if (typeof document.drawingCanvas === 'undefined') {
    setupCanvas();
  }
  //Position parameters used for drawing the rectangle
  const context = document.drawingCanvas.getContext('2d');
  //Draw rectangle
  context.rect(x, y, width, height);
  context.strokeStyle = 'red';
  if (fillStyle) {
    context.fillStyle = fillStyle;
    context.fill();
  }
}

/**
 * Compare ${boundsMapOld} and ${boundsMapNew}
 *
 * @param {number} maxPixelDiff max pixels a bound may differ on any value
 * @param {Object.<string, {x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number}>} boundsMapNew
 * @param {string[]} ignoredXpaths
 * @param {Object.<string, {x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number}>} boundsMapOld
 * @param {boolean} highLight
 *
 * @returns string a string report
 */
function compareSavedAndCurrentBounds(
  boundsMapOld,
  boundsMapNew,
  ignoredXpaths,
  maxPixelDiff,
  highLight
) {
  let shouldFail = false;
  let failLines = '';
  const keysDiff = diffArrays(
    Object.keys(boundsMapOld),
    Object.keys(boundsMapNew),
    ignoredXpaths
  );

  setupCanvas();

  failLines += checkForNewElements(keysDiff, highLight, boundsMapNew);
  //todo: highlight new elements

  failLines += checkForMissingElements(keysDiff, highLight, boundsMapOld);
  //todo: mark locations of missing elements

  failLines += checkBounds(
    keysDiff,
    boundsMapOld,
    boundsMapNew,
    maxPixelDiff,
    highLight
  );
  //todo: mark moved elements
  //todo: mark locations of old location

  //todo: make a difference report in JSON
  return failLines;
}

function getValidOptions(defaultOptions, maybeName, commandOptions) {
  const options = _extends(
    {},
    defaultOptions,
    (typeof maybeName === 'string' ? commandOptions : maybeName) || {}
  );
  let ignoredXpaths = options['ignore'];
  if (typeof ignoredXpaths === 'undefined') {
    ignoredXpaths = [];
  }

  let maxPixelDiff = options['maxdiff'];
  if (typeof maxPixelDiff === 'undefined') {
    maxPixelDiff = 0;
  }
  let highLight = options['highlight'];
  return { ignoredXpaths, maxPixelDiff, highLight };
}

/**
 * @param {*|string} defaultOptions
 */
function MatchGeometrySnapshotCommand(defaultOptions) {
  return function MatchGeometrySnapshot(subject, maybeName, commandOptions) {
    let { ignoredXpaths, maxPixelDiff, highLight } = getValidOptions(
      defaultOptions,
      maybeName,
      commandOptions
    );

    const name =
      typeof maybeName === 'string' ? maybeName : Cypress.currentTest.title;

    const target = subject ? cy.wrap(subject) : cy;
    cy.log(`Name is '${name}'`);
    // target.screenshot(name, options);
    cy.log('Get the bounds of all visible elements');
    target.get(':visible').each((visibleElement, elementIndex, allElements) => {
      // Wait untill the last for efficiency
      if (elementIndex == allElements.length - 1) {
        const allBounds = {};
        for (let i = 0; i < allElements.length; i += 1) {
          const element = allElements[i];
          const bounds = element.getBoundingClientRect();
          const elemXpath = getXPath(element);
          allBounds[elemXpath] = bounds;
        }
        // wrap allBounds and make into an alias to get the value out of this "each" async block
        cy.wrap(allBounds).as('geometryMap');
      }
    });

    cy.get('@geometryMap').then(boundsMapNew => {
      const shotFN = `${screenshotsFolder}/${name}.json`;
      saveAsJson(shotFN, boundsMapNew);

      const snapFN = `${snapshotsDir}/${Cypress.spec.name}/${name}.json`;

      cy.log(`Looking for ${snapFN}`);
      cy.task('fileExists', { path: snapFN }).then(itExists => {
        if (itExists || updateSnapshots) {
          cy.log('Existing version found in snapshots');
          cy.task('loadAsJson', { path: snapFN }).then(boundsMapOld => {
            cy.log('Compare current and saved bounds');
            const shouldFail = compareSavedAndCurrentBounds(
              boundsMapOld,
              boundsMapNew,
              ignoredXpaths,
              maxPixelDiff,
              highLight
            );
            if (shouldFail) {
              if (failOnSnapshotDiff) {
                throw 'Differences were found\n' + shouldFail;
              }
              {
                cy.log(
                  `Differences were found\n${shouldFail}\n(fail suppressed)`
                );
              }
            } else {
              cy.log('No differences found');
            }
          });
        } else {
          saveAsJson(snapFN, boundsMapNew);
        }
      });
    });
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

//todo: add option diffStyle (record and diff the calculated styles as well)
//todo: add option diffHoverStyle (record and diff the calculated styles as well)
//todo: add command to crawl the current page
