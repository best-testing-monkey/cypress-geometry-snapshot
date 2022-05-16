# Cypress Geometry Snapshot

The goal of this Cypress plugin is 'visually' testing using the geometry of a web-page, using computed properties of all visible elements:

* Bounding boxes
* computed style
* text

Testing by geometry instead of a graphical pixel-by-pixel diff is generally much faster (for larger pages). 
Crawling a complete website for visible changes now becomes feasable.

<details>

### Cypress GUI

When using `cypress open`, errors are displayed in the GUI.

### Test Reporter

When using `cypress run` and `--reporter cypress-geometry-snapshot/reporter`, diffs are output to your terminal.

</details>

## Installation

Install from npm

```bash
npm install git@github.com:best-testing-monkey/cypress-geometry-snapshot.git --save-dev
```

then add the following in your project's `<rootDir>/cypress/plugins/index.js`:

```js
const {
  addMatchGeometrySnapshotPlugin,
} = require('cypress-geometry-snapshot/plugin');

module.exports = (on, config) => {
  addMatchGeometrySnapshotPlugin(on, config);
};
```

and in `<rootDir>/cypress/support/commands.js` add:

```js
import { addMatchGeometrySnapshotCommand } from 'cypress-geometry-snapshot/command';

addMatchGeometrySnapshotCommand();
```

## Syntax

```js
// addMatchGeometrySnapshotPlugin
addMatchGeometrySnapshotPlugin(on, config);

// addMatchGeometrySnapshotCommand
addMatchGeometrySnapshotCommand();
addMatchGeometrySnapshotCommand(commandName);
addMatchGeometrySnapshotCommand(options);
addMatchGeometrySnapshotCommand(commandName, options);

// MatchGeometrySnapshot
.MatchGeometrySnapshot();
.MatchGeometrySnapshot(name);
.MatchGeometrySnapshot(options);
.MatchGeometrySnapshot(name, options);

// ---or---

cy.MatchGeometrySnapshot();
cy.MatchGeometrySnapshot(name);
cy.MatchGeometrySnapshot(options);
cy.MatchGeometrySnapshot(name, options);
```

## Usage

### In your tests

```js
describe('Login', () => {
  it('should be publicly accessible', () => {
    cy.visit('/login');

    // snapshot name will be the test title
    cy.MatchGeometrySnapshot();

    // snapshot name will be the name passed in
    cy.MatchGeometrySnapshot('login');

    // options object passed in
    cy.MatchGeometrySnapshot(options);

    // match element snapshot
    cy.get('#login').MatchGeometrySnapshot();
  });
});
```

### Updating snapshots

Run Cypress with `--env updateSnapshots=true` in order to update the base image files for all of your tests.

`TODO!! This feature is not implemented yet!`

### Preventing failures

Run Cypress with `--env failOnSnapshotDiff=false` in order to prevent test failures when an image diff does not pass.

`TODO!! This feature is not implemented yet!`

### Reporter

Run Cypress with `--reporter cypress-geometry-snapshot/reporter` in order to report snapshot diffs in your test results. This can be helpful to use with `--env failOnSnapshotDiff=false` in order to quickly view all failing snapshots and their diffs.

If you using [iTerm2](https://www.iterm2.com/version3.html), the reporter will output any image diffs right in your terminal 😎.

#### Multiple reporters

Similar use case to: https://github.com/cypress-io/cypress-example-docker-circle#spec--xml-reports

If you want to report snapshot diffs as well as generate XML junit reports, you can use [mocha-multi-reporters](https://github.com/stanleyhlng/mocha-multi-reporters).

```
npm install --save-dev mocha mocha-multi-reporters mocha-junit-reporter
```

You'll then want to set up a `cypress-reporters.json` which may look a little like this:

```json
{
  "reporterEnabled": "spec, mocha-junit-reporter, cypress-geometry-snapshot/reporter",
  "mochaJunitReporterReporterOptions": {
    "mochaFile": "cypress/results/results-[hash].xml"
  }
}
```

where `reporterEnabled` is a comma-separated list of reporters.

You can then run cypress like this:

`cypress run --reporter mocha-multi-reporters --reporter-options configFile=cypress-reporters.json`

or add the following to your `cypress.json`

```
{
  ..., //other options
  "reporter": "mocha-multi-reporters",
  "reporterOptions": {
    "configFile": "cypress-reporters.json"
  }
}
```

## Options

- `ignore` : array of strings or regex expressions. All found visible elements matching the regex will be ignored
- `maxdiff` : integer of the maximum number of pixels element bounds can differ compared to the snapshot

For example, the default options we use in `<rootDir>/cypress/support/commands.js` are:

```js
addMatchGeometrySnapshotCommand({
  ignore: ['/.*ignoredXpath.*/g'], // will ignore all xpath with the text 'ignoredXpath'
  maxdiff: 5, // bounds and locations MUST be within 5 px (positive or negative)
});
```
