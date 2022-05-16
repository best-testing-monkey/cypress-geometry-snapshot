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
  typeof Cypress.env('failOnSnapshotDiff') === 'undefined' ||
  Cypress.env('failOnSnapshotDiff');
const snapshotsDir = `${screenshotsFolder}/../snapshots`;

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

function saveAsJson(shotFN, geoMap) {
  cy.log(`Save ${shotFN}`);
  cy.writeFile(shotFN, JSON.stringify(geoMap, null, 2));
}

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

function diffKeys(oldKeys, newKeys, ignoredXpaths) {
  let retvals = {
    common: oldKeys.filter(x => newKeys.includes(x)),
    removed: oldKeys.filter(x => !newKeys.includes(x)),
    added: newKeys.filter(x => !oldKeys.includes(x)),
  };
  for (let key of Object.keys(retvals)) {
    let ignored = filterInRegex(retvals[key], ignoredXpaths);
    retvals[key] = filterOutRegex(retvals[key], ignoredXpaths);
    console.log('Ignored @' + key);
    console.log(JSON.stringify(ignored, null, 2));
  }
  return retvals;
}

function removeLastInstance(removeString, subjectStr) {
  const subStringIndex = subjectStr.lastIndexOf(removeString);
  if (subStringIndex < 0) return subjectStr;
  let partOne = subjectStr.substring(0, subStringIndex);
  let partTwo = subjectStr.substring(subStringIndex + removeString.length);
  return partOne + partTwo;
}

function checkForNewElements(keysDiff) {
  let shouldFail = false;
  let newElements = 0;
  let failLines = '';
  if (keysDiff.added.length > 0) {
    shouldFail = true;
    for (const key of keysDiff.added) {
      failLines += `New element: ${key}\n`;
      cy.log(`New element: ${key}`);
      newElements++;
    }
  }
  if (newElements > 0) {
    cy.log(`${newElements} new elements found`);
    failLines = `${newElements} new elements found:\n  - ${failLines.replaceAll(
      '\n',
      '\n  - '
    )}`;
    failLines = removeLastInstance('  - ', failLines);
  }
  return failLines;
}

function checkForMissingElements(keysDiff) {
  let missingElements = 0;
  let failLines = '';

  if (keysDiff.removed.length > 0) {
    for (const key of keysDiff.removed) {
      failLines += `Removed element: ${key}\n`;
      missingElements++;
    }
  }
  if (missingElements > 0) {
    failLines = `${missingElements} missing elements:\n  - ${failLines.replaceAll(
      '\n',
      '\n  - '
    )}`;
    failLines = removeLastInstance('  - ', failLines);
  }
  return failLines;
}

function checkBounds(
  keysDiff,
  geoMapExisting,
  geoMap,
  shouldFail,
  maxPixelDiff
) {
  if (typeof maxPixelDiff === 'undefined') {
    maxPixelDiff = 0;
  }
  let failLines = '';

  for (const key of keysDiff.common) {
    const oldBounds = geoMapExisting[key];
    const newBounds = geoMap[key];
    let boundsDiffer = false;
    let differKeys = '';
    for (const boundsKey of Object.keys(oldBounds)) {
      if (
        Math.abs(oldBounds[boundsKey] - newBounds[boundsKey]) > maxPixelDiff
      ) {
        boundsDiffer = true;
        shouldFail = true;
        differKeys += ' ' + boundsKey;
      }
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

function compareSavedAndCurrentBounds(
  geoMapExisting,
  geoMap,
  ignoredXpaths,
  maxPixelDiff
) {
  let shouldFail = false;
  let failLines = '';
  const keysDiff = diffKeys(
    Object.keys(geoMapExisting),
    Object.keys(geoMap),
    ignoredXpaths
  );
  // new element
  failLines += checkForNewElements(keysDiff);
  //todo: highlight new elements

  // missing element
  failLines += checkForMissingElements(keysDiff);
  //todo: mark locations of missing elements

  // Bounds
  failLines += checkBounds(keysDiff, geoMapExisting, geoMap, maxPixelDiff);
  //todo: mark moved elements
  //todo: mark locations of old location

  //todo: make a difference report in JSON
  return failLines;
}

function MatchGeometrySnapshotCommand(defaultOptions) {
  return function MatchGeometrySnapshot(subject, maybeName, commandOptions) {
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

    //todo: add option diffStyle (record and diff the calculated styles as well)
    //todo: add option diffHoverStyle (record and diff the calculated styles as well)

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
    cy.get('@geometryMap').then(geoMap => {
      const shotFN = `${screenshotsFolder}/${name}.json`;
      saveAsJson(shotFN, geoMap);

      const snapFN = `${snapshotsDir}/${Cypress.spec.name}/${name}.json`;

      cy.log(`Looking for ${snapFN}`);
      cy.task('fileExists', { path: snapFN }).then(itExists => {
        if (itExists || !updateSnapshots) {
          cy.log('Existing version found in snapshots');
          cy.task('loadAsJson', { path: snapFN }).then(geoMapExisting => {
            cy.log('Compare current and saved bounds');
            const shouldFail = compareSavedAndCurrentBounds(
              geoMapExisting,
              geoMap,
              ignoredXpaths,
              maxPixelDiff
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
          saveAsJson(snapFN, geoMap);
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
  //todo: add command to crawl the current page
}
