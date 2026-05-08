// js/scenario.js — Scenario selector for V.O.I.D.
// Imports both OS scenarios and exports the selected one.

import WINDOWS_SCENARIO from './scenarios/windows.js';
import LINUX_SCENARIO from './scenarios/linux.js';

const SCENARIOS = {
  windows: WINDOWS_SCENARIO,
  linux: LINUX_SCENARIO,
};

/**
 * Get the scenario for the given OS type.
 * @param {string} osType - 'linux' or 'windows'
 * @returns {object} The scenario data
 */
export function getScenario(osType) {
  return SCENARIOS[osType] || SCENARIOS.linux;
}

export default SCENARIOS;
