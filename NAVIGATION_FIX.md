# Navigation System Refactor

## Overview
The navigation system has been completely refactored to be simple and reliable. The previous implementation was complex with multiple hooks and broken state management.

## New Navigation System

### Core Components:

1. **DiagnosisContext** - Simplified state management
   - `currentStep`: Current page step (0=home, 1=upload, 2=questions, 3=results)
   - `maxReachedStep`: Highest step reached (controls navigation permissions)
   - `resetAll()`: Clears all state and resets to initial state

2. **useNavigation Hook** - Simple navigation functions
   - `goHome()`: Reset everything and go to home page
   - `goToUpload()`: Navigate to upload page (step 1)
   - `goToQuestions()`: Navigate to questions page (step 2)
   - `goToResults()`: Navigate to results page (step 3)
   - `canNavigateToStep(step)`: Check if step is accessible

### Navigation Rules:

1. **Home Page (Step 0)**: Always accessible
2. **Upload Page (Step 1)**: Always accessible
3. **Questions Page (Step 2)**: Accessible after uploading at least one image
4. **Results Page (Step 3)**: Accessible after reaching questions page

### Button Behaviors:

1. **Reset Button** (on pages 1-3): 
   - Calls `goHome()` which resets all state and navigates to home page
   - Clears images, questions, answers, diagnosis results, etc.

2. **Next Button** (upload page):
   - Only enabled when at least one image is uploaded
   - Updates `maxReachedStep` to 2 and navigates to questions page

3. **Debug Button** (questions page):
   - Works even if questions are not answered
   - Updates `maxReachedStep` to 3 and navigates to results page

4. **Step Navigation Buttons** (1, 2, 3 in header):
   - Only clickable for steps that have been reached (`step <= maxReachedStep`)
   - Navigation doesn't retrigger API calls or animations
   - Preserves all state when navigating backwards/forwards

## Fixed Issues:

1. ✅ Reset button now properly navigates to home page
2. ✅ Next button on upload page now works correctly
3. ✅ Step navigation buttons work backwards and forwards
4. ✅ No API calls or animations are retriggered when navigating between reached pages
5. ✅ State is properly preserved when navigating backwards
6. ✅ Clean, simple implementation without complex state management

## Testing:

The navigation should now work as described:
- Start at home page (step 0)
- Go to upload page, upload images, click Next
- Go to questions page, optionally answer questions, click Debug
- Go to results page, see diagnosis
- Reset button on any page 1-3 should go back to home
- Step buttons should allow navigation between reached pages
