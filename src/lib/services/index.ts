export { simulationService } from './simulationService'
export {
  DEFAULT_RATES,
  createDefaultFinancialItems,
  createNewItemDefaults,
  ADDABLE_ITEM_TYPES,
  CASHFLOW_UI_GROUPS,
  CHILD_EDUCATION_PRESETS,
  createChildEducationItems,
  calculateInflatedAmount,
  calculatePostRetirementExpense,
} from './defaultItems'
export {
  runSimulation,
  runSimulationFromItems,
  calculateCurrentState,
  calculateRetirementGoalProgress,
  calculateMilestones,
  type YearlySnapshot,
  type SimulationResult,
  type SimulationProfile,
  type CurrentFinancialState,
  type GoalProgress,
  type Milestone,
} from './simulationEngine'
export { loadFinancialItemsFromDB } from './dbToFinancialItems'
