# Account Balance Calculation Refactoring

## Summary
Extracted cumulative account balance calculation logic from BudgetTab.tsx into a reusable utility function `calculateAccountBalances()` in `accountValueCalculator.ts`.

## Changes Made

### 1. accountValueCalculator.ts
- Added `AccountBalanceInfo` interface with income, expense, prevBalance, expectedBalance fields
- Added `calculateAccountBalances()` function that calculates cumulative balances from `balance_updated_at` date
- Updated `BudgetTransaction` interface to include optional year/month/day fields
- Kept old `calculateExpectedBalance()` and `calculateAccountTransactionSummary()` functions for backward compatibility

### 2. BudgetTab.tsx
- Replaced 45-line inline useMemo with single line calling `calculateAccountBalances()`
- Added import for new function
- No logic changes - behavior remains identical

### 3. CurrentAssetTab.tsx
- Changed from loading current month transactions only to loading ALL transactions after oldest `balance_updated_at`
- Replaced `calculateAccountTransactionSummary` + `calculateExpectedBalance` with `calculateAccountBalances()`
- Removed `currentYear`, `currentMonth` dependencies from useEffect
- Now uses cumulative logic consistently with BudgetTab

## Key Design Decisions

### Cumulative Logic
The `calculateAccountBalances()` function:
- Uses `balance_updated_at` as the starting point for each account
- Sums ALL transactions after that date (not just current month)
- Formula: `current_balance + all_income_after_date - all_expense_after_date`
- Handles accounts without `balance_updated_at` by including all transactions

### Backward Compatibility
Kept old functions because:
1. `simulationService.ts` uses them for fast initialization (intentionally current month only)
2. `AccountsSummaryPanel.tsx` uses them for sync snapshots (intentionally current month only)
3. Both cases don't need cumulative logic - they want a point-in-time snapshot

### TypeScript Safety
- Made year/month/day optional in BudgetTransaction interface
- Maintains backward compatibility with existing code passing minimal transaction objects
- New code can pass full transaction objects with dates for cumulative calculation

## Files Modified
- `/Users/peter/Desktop/lycon/src/lib/utils/accountValueCalculator.ts`
- `/Users/peter/Desktop/lycon/src/app/dashboard/components/tabs/BudgetTab.tsx`
- `/Users/peter/Desktop/lycon/src/app/dashboard/components/tabs/CurrentAssetTab.tsx`

## Files NOT Modified (intentionally)
- `/Users/peter/Desktop/lycon/src/lib/services/simulationService.ts` - uses current month only for fast init
- `/Users/peter/Desktop/lycon/src/app/dashboard/components/tabs/scenario/AccountsSummaryPanel.tsx` - uses current month for snapshot sync

## Verification
- `npx tsc --noEmit` passes with no errors
- All imports resolved correctly
- Logic tested and matches BudgetTab's existing behavior
