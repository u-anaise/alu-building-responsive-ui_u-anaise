# Student Finance Tracker

A budget tracker for students, built with vanilla HTML, CSS and JavaScript for the ALU Building Responsive UI assignment.

- Live site: https://u-anaise.github.io/alu-building-responsive-ui_u-anaise/
- Demo video:  https://youtu.be/3kUDvmFydY4?si=BQoyiaCvBCRdgmWu
- Theme: Student Finance Tracker

## How I built it

I started by listing every requirement in the assignment and the rubric, chose the finance theme first, and then built the project in the order of the milestones, M1 to M7, the validation rules and the tests, then the interface. I chose RWF as the base currency with USD and EUR.

## Features

- Five sections (About, Dashboard, Records, Add, Settings), shown one at a time.
- Records show as a table on tablets and desktops and as cards on phones.
- An add form that checks every field and shows the error under that field.
- Inline editing of a record, and delete with a confirmation.
- Sorting by date, description or amount. Amounts are compared after converting to RWF.
- Live regex search with an ignore-case toggle and highlighted matches. A broken pattern shows a message and does not crash the page.
- A dashboard with the number of records, the total spent, the top category and a bar chart of the last 7 days.
- A spending cap with a polite message when I am under it and an assertive alert when I go over. A cap of 0 means no cap.
- RWF is the base currency. USD and EUR use rates typed in Settings. The defaults (1450 and 1600) are placeholders, so real rates should be entered.
- Categories that can be edited in Settings.
- Every change is saved to localStorage.
- JSON export, JSON import with validation, and a button that loads 15 sample records from `seed.json`.

Each record has an id, description, amount, currency, category, date, createdAt and updatedAt.

## Run it

The app uses ES modules, so it will not work by double-clicking `index.html`. From the project folder, start a small server:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Run the tests

With the server running, open http://localhost:8000/tests.html. The page runs 67 checks covering validation, search, sorting, stats, saving and import, and marks each one PASS or FAIL. It should say "67 of 67 tests passed." The storage tests back up the saved data first and put it back afterwards.

## Regex catalog

| Where | Pattern | What it checks | Passes | Fails |
|---|---|---|---|---|
| Description | `^\S(?:.*\S)?$` | No space at the start or the end | Lunch at cafe | " Lunch" |
| Description cleanup | `\s{2,}` replaced by one space | Repeated spaces become one | "Lunch   at" becomes "Lunch at" | not applicable |
| Amount | `^(0\|[1-9]\d*)(\.\d{1,2})?$` | A number with no leading zeros and at most 2 decimals | 12, 12.50, 0.01 | 007, 12.345, -5 |
| Rate and cap | `^(0\|[1-9]\d*)(\.\d{1,4})?$` | Same idea with up to 4 decimals. A rate must also be above 0 | 1450, 0.0007 | abc |
| Date shape | `^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$` | YYYY-MM-DD with a valid month and day range | 2025-09-25 | 2025-13-01 |
| Date, real day | not a regex | The shape allows 2025-02-31, so the code also checks that the day exists | 2024-02-29 | 2025-02-31 |
| Category | `^[A-Za-z]+(?:[ -][A-Za-z]+)*$` | Letters, with single spaces or hyphens between words | Eating-Out, Coffee Shops | Food2, Food--Out |
| Advanced: duplicate word | `\b(\w+)\s+\1\b` with the ignore-case flag | Finds the same word twice in a row | Tea and tea | Coffee coffee |

The advanced pattern uses a back-reference. `(\w+)` captures a word, and `\1` means "the same text that group just matched". That is how the pattern can tell that "Coffee coffee" repeats a word without knowing the word in advance.

Search examples to try on the Records section:

- `\.\d{2}\b` finds amounts that have cents.
- `(coffee|tea)` finds either word.
- `\b(\w+)\s+\1\b` finds repeated words, such as "Coffee coffee beans" in the sample data.

The search box refuses patterns longer than 100 characters, and patterns with a repeat inside a repeat like `(a+)+`, because those can freeze the page.

## Keyboard map

| Key | Where | What it does |
|---|---|---|
| Tab, Shift+Tab | Everywhere | Moves to the next or previous control |
| Tab (first press) | Top of the page | Shows "Skip to main content" |
| Enter | Skip link | Jumps past the menu to the content |
| Enter | Navigation links and buttons | Opens the section or presses the button |
| Space | Checkbox and buttons | Toggles or presses |
| Arrow keys | Sort and currency menus | Change the selected option |
| Enter | A field in the add form | Submits the form |
| Enter | A field in a row being edited | Saves the edit |
| Escape | A field in a row being edited | Cancels the edit |

## Accessibility notes

- The page uses header, nav, main, section and footer, with one h1 and headings in order.
- The skip link is the first stop in the tab order.
- Every input has a label tied to it. The inline edit fields use visually hidden labels.
- Hints and errors are connected to their input, wrong fields are marked with `aria-invalid`, and error text sits in a live region so a screen reader reads it out.
- Status messages use `role="status"`. The cap alert uses `role="alert"`, so going over the cap interrupts the user and being under it does not.
- Every control has a visible focus ring.
- Focus is moved on purpose. After navigating it goes to the section heading, after a failed submit to the first wrong field, after saving an edit back to the Edit button, and after a delete to the Records heading.
- On small screens the CSS turns table rows into cards, so I kept the table roles in the HTML to keep the structure.
- The chart is exposed as an image with a text summary of the seven days.
- I checked text contrast by calculation. White on the teal buttons is 5.96 to 1, and the body text on the page background is about 15 to 1.
- Animations stop when the user asks for reduced motion, and zooming is not blocked.

The sort and currency dropdowns and the category suggestions use the browser's own styling, so I could not change their colors.

## Project structure

```
index.html, tests.html, seed.json
styles/main.css
scripts/main.js        starts the app and connects events
scripts/ui.js          draws the page
scripts/state.js       holds the data and saves it
scripts/storage.js     the only file that touches localStorage
scripts/validators.js  all the validation rules
scripts/search.js      regex search, highlighting and sorting
scripts/stats.js       totals, top category, 7-day data and cap
scripts/utils.js       small helpers
scripts/tests.js       the checks that tests.html runs
docs/spec.md           
```

## Credits

- I adapted the three starter snippets from the assignment: the safe regex compiler, highlight matches and persistent state. The compiler now returns an error message and blocks risky patterns. Highlighting now escapes the text before adding `<mark>`, so a record containing HTML cannot inject anything. Loading from localStorage now copes with broken data.
- The cents, drinks and duplicate-word regex examples come from the assignment.
- The skip link, the visually hidden class and the table-to-cards layout are common patterns that were written from general knowledge, not copied from one page.