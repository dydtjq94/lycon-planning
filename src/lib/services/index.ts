export { financialService, simulationService, financialItemService } from './financialService'
export {
  migrateOnboardingToFinancialItems,
  extractProfileInfo,
  getMonthlyAmount,
  isItemActiveAt,
} from './dataMigration'
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
export { linkedItemService } from './linkedItemService'
export {
  runSimulation,
  calculateCurrentState,
  calculateRetirementGoalProgress,
  calculateMilestones,
  type YearlySnapshot,
  type SimulationResult,
  type CurrentFinancialState,
  type GoalProgress,
  type Milestone,
} from './simulationEngine'
