# Statistics Features Update

## Overview
Enhanced the driver and admin statistics pages with two major new features:
1. Missing workday days tracking
2. Interactive month/year selector

## Feature 1: Missing Days Statistics Card

### Purpose
Tracks and displays working days in the selected month that have no submissions, excluding weekends (Saturday/Sunday).

### German Title
**Fehlende Tage** (Missing Days)

### Logic
- Uses the currently selected month and year
- Loops through all days in the selected month
- Automatically excludes Saturdays and Sundays
- For the current month: only calculates up to today (does not count future dates)
- For past months: calculates the full month
- A date is considered submitted if there is at least one entry on that date
- Multiple submissions on the same day count as one submitted day

### Display
- **Large number**: Total count of missing working days
- **Small text**: Comma-separated list of missing day numbers (e.g., "3, 15, 18")
- If no missing days: Shows "0" with "-" below

### UI Design
- New card in the statistics grid
- Red gradient background (from-red-500 to-red-600)
- AlertCircle icon from lucide-react
- Matches existing card design language
- Fully responsive

## Feature 2: Interactive Month/Year Selector

### Purpose
Allows users to select any month from any year to view historical statistics.

### Behavior
- Click the month header card to open the selector
- Select year from dropdown (shows last 10 years)
- Select month from visual grid
- All statistics cards update based on selected month/year
- Default selection is the current month/year

### UI Components

#### Month Header (Clickable)
- Displays: "{Month Name} {Year}" (e.g., "März 2026")
- Subtitle: "Monatsstatistik"
- Hover state indicates interactivity
- Calendar icon for visual clarity

#### Modal/Selector
- Clean modal overlay with backdrop
- Year dropdown selector
- Month grid (3 columns, abbreviated names)
- "Abbrechen" (Cancel) and "Übernehmen" (Apply) buttons
- Two variants:
  - **Driver variant**: Dark theme matching driver profile
  - **Admin variant**: Light theme matching admin dashboard

### Updated Statistics
When month/year changes, all cards recalculate:
- Arbeitstage (Working Days)
- Gesamtstunden (Total Hours)
- Durchschnitt (Average Hours)
- Einträge (Entries)
- Fehlende Tage (Missing Days) - NEW

## Implementation Details

### New Files Created

#### `/src/lib/statisticsUtils.ts`
Shared utility functions for statistics calculations:
- `calculateMonthStatistics()`: Core statistics calculator
- `getMonthName()`: German month names
- `calculateWorkHours()`: Work time calculation
- `getAvailableYears()`: Year list generator
- `getMonths()`: Month list with German names
- Missing days calculation logic

#### `/src/components/MonthSelector.tsx`
Reusable month/year selector component:
- Two variants (driver/admin)
- Modal interface
- Year and month selection
- Callback on selection change

### Updated Files

#### `/src/components/DriverProfile.tsx`
- Integrated MonthSelector component
- Added state for selectedYear and selectedMonth
- Updated loadDriverData to use selected month
- Refactored to use shared statistics utilities
- Added new "Fehlende Tage" card
- Updated all stat cards to use new data structure

#### `/src/components/ReportsTab.tsx`
- Integrated MonthSelector component
- Updated driver statistics section
- Updated driver comparison section
- Added "Fehlende Tage" card to both sections
- Refactored to use shared statistics utilities
- Maintains existing period selection functionality

## Date Handling

### Important Considerations
- Uses consistent local date parsing
- Avoids UTC conversion issues
- Properly handles month boundaries
- Correctly identifies weekends
- Handles current month vs past months appropriately
- Does not penalize future dates as missing

### Date Format
All dates use ISO format: `YYYY-MM-DD`

## User Experience

### Driver View
1. Driver sees statistics for current month by default
2. Clicks the month header card
3. Modal opens with year/month selector
4. Selects desired month and year
5. Clicks "Übernehmen" (Apply)
6. All statistics update immediately
7. Missing days highlighted in red card

### Admin View
1. Admin selects a driver
2. Sees current month statistics by default
3. Clicks month selector card
4. Chooses different month/year
5. Statistics recalculate for selected period
6. Can compare two drivers with missing days data

## Visual Design

### Color Scheme
- **Blue**: Arbeitstage (Working Days)
- **Green**: Gesamtstunden (Total Hours)
- **Orange**: Durchschnitt (Average)
- **Cyan**: Einträge (Entries)
- **Red**: Fehlende Tage (Missing Days) - NEW

### Design Consistency
- Maintains existing gradient backgrounds
- Keeps rounded corners (rounded-xl)
- Preserves spacing and padding
- Responsive grid layout
- Icon + text card structure
- Shadow effects for depth

## Technical Architecture

### Shared Logic
All statistics calculations use the same core logic to ensure consistency between driver and admin views.

### State Management
- Month/year selection stored in component state
- Triggers data reload on change
- Maintains current selection across component lifecycle

### Performance
- Efficient date calculations
- Minimal re-renders
- Optimized database queries
- Single query per statistics load

## Testing Considerations

### Test Scenarios
1. ✅ View current month statistics
2. ✅ Change to previous month
3. ✅ Change to different year
4. ✅ Verify missing days calculation
5. ✅ Check weekend exclusion
6. ✅ Verify current month partial calculation
7. ✅ Test with no entries
8. ✅ Test with multiple entries per day
9. ✅ Test month selector UI
10. ✅ Test both driver and admin views

### Edge Cases Handled
- No entries in selected month
- All days have entries (0 missing)
- Future months (no false missing days)
- Current month (only up to today)
- Month transitions
- Year changes
- Weekend days properly excluded

## Accessibility

- Clickable month header has hover states
- Modal can be closed with cancel button
- Clear visual hierarchy
- Color-blind friendly (uses icons + text)
- Keyboard navigation support through native elements

## Future Enhancements (Optional)

Possible improvements:
- Export statistics for selected month
- Compare multiple months
- Visual charts/graphs
- Email reports for missing days
- Custom weekend configuration
- Holiday exclusion
- Notification for missing days

## Summary

The new features provide:
- ✅ Complete historical statistics viewing
- ✅ Easy month/year navigation
- ✅ Missing workday tracking
- ✅ Consistent design language
- ✅ Mobile responsive
- ✅ Works in both driver and admin contexts
- ✅ Production-ready implementation
