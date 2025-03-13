/**
 * Copyright (c) 2022-present best-testing-monkey (Tim Jansen)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

global.Cypress = {
  env: () => false,
  log: () => null,
  config: () => '/cypress/screenshots',
  Commands: {
    add: jest.fn(),
  },
};

global.cy = {
  wrap: subject => subject,
};

const {
  MatchGeometrySnapshotCommand,
  addMatchGeometrySnapshotCommand,
} = require('../src/command');

const defaultOptions = {
  failureThreshold: 0,
  failureThresholdType: 'pixel',
};

const boundMatchGeometrySnapshot = MatchGeometrySnapshotCommand(
  defaultOptions
).bind({
  test: 'snap',
});
const subject = { screenshot: jest.fn() };
const commandOptions = {
  failureThreshold: 10,
};

describe('command', () => {
  it('should pass options through', () => {
    global.cy.task = jest.fn().mockResolvedValue({ pass: true });

    boundMatchGeometrySnapshot(subject, commandOptions);

    expect(cy.task).toHaveBeenCalledWith('Matching image snapshot', {
      screenshotsFolder: '/cypress/screenshots',
      updateSnapshots: false,
      options: {
        failureThreshold: 10,
        failureThresholdType: 'pixel',
      },
    });
  });

  it('should pass', () => {
    global.cy.task = jest.fn().mockResolvedValue({ pass: true });

    expect(
      boundMatchGeometrySnapshot(subject, commandOptions)
    ).resolves.not.toThrow();
  });

  it('should fail', () => {
    global.cy.task = jest.fn().mockResolvedValue({
      pass: false,
      added: false,
      updated: false,
      diffRatio: 0.1,
      diffPixelCount: 10,
      diffOutputPath: 'cheese',
    });

    expect(
      boundMatchGeometrySnapshot(subject, commandOptions)
    ).rejects.toThrowErrorMatchingSnapshot();
  });

  it('should add command', () => {
    Cypress.Commands.add.mockReset();
    addMatchGeometrySnapshotCommand();
    expect(Cypress.Commands.add).toHaveBeenCalledWith(
      'MatchGeometrySnapshot',
      { prevSubject: ['optional', 'element', 'window', 'document'] },
      expect.any(Function)
    );
  });

  it('should add command with custom name', () => {
    Cypress.Commands.add.mockReset();
    addMatchGeometrySnapshotCommand('sayCheese');
    expect(Cypress.Commands.add).toHaveBeenCalledWith(
      'sayCheese',
      { prevSubject: ['optional', 'element', 'window', 'document'] },
      expect.any(Function)
    );
  });

  it('should add command with options', () => {
    Cypress.Commands.add.mockReset();
    addMatchGeometrySnapshotCommand({ failureThreshold: 0.1 });
    expect(Cypress.Commands.add).toHaveBeenCalledWith(
      'MatchGeometrySnapshot',
      { prevSubject: ['optional', 'element', 'window', 'document'] },
      expect.any(Function)
    );
  });
});
