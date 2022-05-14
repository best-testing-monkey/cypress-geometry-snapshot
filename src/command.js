/* eslint-disable no-restricted-syntax */

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

function getXPath(node) {
  if (node === document.body) {
    return `//${element.tagName}`;
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
    ignored: [],
  };
  for (let key of Object.keys(retvals)) {
    retvals['ignored'] = retvals['ignored'].concat(
      filterInRegex(retvals[key], ignoredXpaths)
    );
    retvals[key] = filterOutRegex(retvals[key], ignoredXpaths);
  }
  return retvals;
}

function removeLastInstance(removeString, subjectStr) {
  const charpos = subjectStr.lastIndexOf(removeString);
  if (charpos < 0) return subjectStr;
  let ptone = subjectStr.substring(0, charpos);
  let pttwo = subjectStr.substring(charpos + removeString.length);
  return ptone + pttwo;
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

function checkBounds(keysDiff, geoMapExisting, geoMap, shouldFail) {
  let failLines = '';

  for (const key of keysDiff.common) {
    const oldBounds = geoMapExisting[key];
    const newBounds = geoMap[key];
    let boundsDiffer = false;
    let differkeys = '';
    for (const boundsKey of Object.keys(oldBounds)) {
      if (oldBounds[boundsKey] !== newBounds[boundsKey]) {
        boundsDiffer = true;
        shouldFail = true;
        differkeys += ' ' + boundsKey;
      }
    }
    if (boundsDiffer) {
      differkeys = differkeys.trim();
      differkeys = differkeys.replaceAll(' ', ', ');
      failLines += `- ${differkeys}:\n    ${JSON.stringify(
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

function compareSavedAndCurrentBounds(geoMapExisting, geoMap, ignoredXpaths) {
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
  failLines += checkBounds(keysDiff, geoMapExisting, geoMap);
  //todo: mark moved elements
  //todo: mark locations of old location

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

    //todo: add option ignore (regex of xpath to ignore)
    //todo: add option maxdiff (max difference in px)
    //todo: add option diffStyle (record and diff the calculated styles as well)
    //todo: add option diffHoverStyle (record and diff the calculated styles as well)

    const name = typeof maybeName === 'string' ? maybeName : undefined;
    //todo: if name is 'undefined' then use the current test title

    const target = subject ? cy.wrap(subject) : cy;
    cy.log(`Name is '${name}'`);
    // target.screenshot(name, options);
    cy.log('Get the bounds of all visible elements');
    cy.get(':visible').each((visibleElement, elementIndex, allElements) => {
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

      const snapFN = `${snapshotsDir}/${name}.json`;
      //todo: use the current spec file-name as subfolder in ${snapshotsDir}

      cy.log(`Looking for ${snapFN}`);
      cy.task('fileExists', { path: snapFN }).then(itExists => {
        if (itExists) {
          cy.log('Existing version found in snapshots');
          cy.task('loadAsJson', { path: snapFN }).then(geoMapExisting => {
            cy.log('Compare current and saved bounds');
            const shouldFail = compareSavedAndCurrentBounds(
              geoMapExisting,
              geoMap,
              ignoredXpaths
            );
            if (shouldFail) {
              throw 'Differences were found\n' + shouldFail;
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
