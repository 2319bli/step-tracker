# StepTracker

[Open the step tracker](https://2319bli.github.io/step-tracker/)

StepTracker displays daily totals, month-to-date averages, month comparisons, streaks and personal records. The public history is stored in `data/steps.json` as ISO dates and whole-number step counts.

Use **Log steps** to add or correct a day. Edits stay in the current browser. **Daily log → Download updated tracker** makes a self-contained copy of that browser's log. To update the public history, export **Site data (JSON)** and commit it as `data/steps.json`.

GitHub Pages serves the root of `main`. All site assets use relative paths and run without a build step.
