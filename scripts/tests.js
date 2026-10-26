import {
  validateDescription, validateAmount, validateDate, validateCategory,
  validateCurrency, validateRate, validateCap, validateCategoryInput,
  validateRecordFields, validateImport
} from "./validators.js";

import {
  formatAmount, roundMoney, escapeHtml, convertToBase
} from "./utils.js";

import { compileRegex, filterRecords, highlight, sortRecords } from "./search.js";

import { 
  totalInBase, topCategory, lastSevenDays, capStatus, toDateString
} from "./stats.js";

import { loadJson, saveJson, RECORDS_KEY, SETTINGS_KEY } from "./storage.js";

import {
  initState, getRecords, getSettings, addRecord, updateRecord, deleteRecord,
  clearRecords, updateSettings, exportData, importText
} from "./state.js";

export const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, passed: true, message: ""});
  } catch (error) {
    results.push({ name: name, passed: false, message: error.message});
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error ("expected " + JSON.stringify(expected) +" but got " + JSON.stringify(actual));
  }
}

function assertSame(actual, expected) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected));
}

const goodRecord = {
  id: "txn_0001", description: "Lunch", amount: 12.5, currency: "USD", category: "Food",
  date: "2025-09-25", createdAt: "2025-09-25T10:00:00.000Z", updatedAt: "2025-09-25T10:00:00.000Z"
};

test("description: normal text is accepted", () => assertEqual(validateDescription("Lunch").ok, true));
test("description: leading space is rejected", () => assertEqual(validateDescription(" Lunch").ok, false));
test("description: trailing space is rejected", () => assertEqual(validateDescription("Lunch ").ok, false));
test("description: empty and only-space are rejected", ()=> {
  assertEqual(validateDescription("").ok, false);
  assertEqual(validateDescription("   ").ok, false);
});
test("description: double space are collapsed", () => 
assertEqual(validateDescription("Lunch   at   cafe").value, "Lunch at cafe")
);
test("description: repeated word is rejected (back-reference)", () => {
  assertEqual(validateDescription("Coffee coffee").ok, false);
  assertEqual(validateDescription("Bus bus pass").ok, false);
});
test("description: similar words are not flagged", () => {
  assertEqual(validateDescription("Tea and tea").ok, true);
  assertEqual(validateDescription("Bussing").ok, true);
});
test("description: over 100 characters is rejected", () =>
assertEqual(validateDescription("a".repeat(101)).ok, false));
test("amount: valid values", () => {
  assertEqual(validateAmount("12.50").value, 12.5);
  assertEqual(validateAmount("0").value, 0);
  assertEqual(validateAmount("0.01").value, 0.01);
  assertEqual(validateAmount("999999999.99").ok, true);
});
test("amount: invalid values", () => {
  for (const bad of ["007", "12.345", "-5", "abc", "", ".5", "1e3", "12.50 ", "1000000001"]) {
    assertEqual(validateAmount(bad).ok, false);
  }
});

test("date: valid dates including a leap day", () => {
  assertEqual(validateDate("2025-09-25").ok, true);
  assertEqual(validateDate("2024-02-29").ok, true);
  assertEqual(validateDate("2025-12-31").ok, true);
});
test("date: wrong structure rejected!", () => {
  for (const bad of ["25-09-25", "2025-9-5", "2025/09/25", "", "2025-13-01", "2025-00-10"]) {
    assertEqual(validateDate(bad).ok, false);
  }
});

test("date: days that do not exist rejected!", () => {
  assertEqual(validateDate("2025-02-29").ok, false);
  assertEqual(validateDate("2025-04-31").ok, false);
  assertEqual(validateDate("2025-02-31").ok, false);
});

test("date: year outside 1900-2100 rejected!", () => {
  assertEqual(validateDate("1899-12-31").ok, false);
  assertEqual(validateDate("2101-01-01").ok, false);
});

test("category: valid values", () => {
  for (const good of ["Food", "Eating-Out", "Coffee Shops"]) {
    assertEqual(validateCategory(good).ok, true);
  }
});

test("category: invalid values", () => {
  for (const bad of ["Food2", " Food", "Food ", "Food--Out", "", "Caf\u00e9", "Food  Court"]) {
    assertEqual(validateCategory(bad).ok, false);
  }
});

test("currencry: only RWF, USD, EUR", () => {
  assertEqual(validateCurrency("USD").ok, true);
  assertEqual(validateCurrency("GBP").ok, false);
});

test("rate: must be greater than 0", () => {
  assertEqual(validateRate("1450").value, 1450);
  assertEqual(validateRate("0.0007").ok, true);
  assertEqual(validateRate("0").ok, false);
  assertEqual(validateRate("-1").ok, false);
  assertEqual(validateRate("abc").ok, false);
});
test("cap: 0 means no cap, text is rejected", () =>  {
  assertEqual(validateCap("0").value, 0);
  assertEqual(validateCap("250000").value, 250000);
  assertEqual(validateCap("abc").ok, false);
});

test("category list: parses and trims", () => 
  assertSame(validateCategoryInput("Food, Books ,Fees").value, ["Food", "Books", "Fees"]));
test("category list: rejects duplicates, bad names, and empty", () => {
  assertEqual(validateCategoryInput("Food, food").ok, false);
  assertEqual(validateCategoryInput("Food, B4d").ok, false);
  assertEqual(validateCategoryInput("").ok, false);
});
test("form: valid input gives clean values", () => {
  const result=validateRecordFields({ description: "Lunch  out",
    amount: "12.50", currency: "USD", category: "Food", date: "2025-09-25"
  });
  assertEqual(result.ok, true);
  assertSame(result.value, { description: "Lunch out", amount: 12.5, currency: "USD", category: "Food", date: "2025-09-25" });
});
test("form: only the bad fields get errors", () => {
  const result=validateRecordFields({description: " x", amount: "12.50", currency: "USD", category: "F00d", date: "2025-09-25"});
  assertEqual(result.ok, false);
  assertSame(Object.keys(result.errors), ["description", "category"]);
});
test("import: a list of valid records is accepted", () => 
  assertEqual(validateImport([goodRecord]).ok, true));
test("import: missing currecy becomes RWF and unkown fields are dropped", () => {
  const item = Object.assign({}, goodRecord, {extra: "x"});
  delete item.currency;
  const result=validateImport([item]);
  assertEqual(result.records[0].currency, "RWF");
  assertEqual(result.records[0].extra, undefined);
});

test("import: wrong top-level shape is rejected", () => {
  assertEqual(validateImport("hello").ok, false);
  assertEqual(validateImport(null).ok, false);
  assertEqual(validateImport({ nothing: 1}).ok, false);
});

test("import: bad records are rejected with the record number", () => {
  const badAmount= Object.assign({}, goodRecord, {amount: "12.50"});
  const  result = validateImport([goodRecord, badAmount]);
  assertEqual(result.ok, false);
  assertEqual(result.message.startsWith("Record 2"), true);
  assertEqual(validateImport([Object.assign({}, goodRecord, { date: "2025-02-31"})]).ok, false);
  assertEqual(validateImport([Object.assign({}, goodRecord, { amount: -1})]).ok, false);
});

test("import: duplicate ids rejected!", () => 
  assertEqual(validateImport([goodRecord, goodRecord]).ok, false));
test("import: object with records and settings is accepted", () => {
  const settings= {baseCurrency: "RWF", rates: { USD: 1450, EUR: 1600
}, cap: 1000, categories: ["Food"]};
  assertEqual(validateImport({ records: [goodRecord], settings:
    settings }).ok, true);
  const badSettings = { rates: {USD: 0, EUR: 1600}, cap:1000, categories: ["Food"]};
  assertEqual(validateImport({records: [goodRecord], settings: badSettings}).ok, false);
});
test("utils: formatAmount, roundMoney, escapeHtml, convertToBase", () => {
  assertEqual(formatAmount(12.5), "12.50");
  assertEqual(formatAmount(2500), "2500");
  assertEqual(formatAmount(0), "0");
  assertEqual(formatAmount(0.01), "0.01");
  assertEqual(roundMoney(0.1 + 0.2), 0.3);
  assertEqual(escapeHtml('<b>"hi"</b> & co'),
"&lt;b&gt;&quot;hi&quot;&lt;/b&gt; &amp; co");
  assertEqual(convertToBase(10, "USD", { USD:1450, EUR:1600}), 14500);
  assertEqual(convertToBase(10, "RWF", {USD: 1450, EUR: 1600}), 10);
});

test("search: empty pattern means no filter and no error", () => {
  const result = compileRegex("", true);
  assertEqual(result.regex, null);
  assertEqual(result.error, "");
});

test("search: invalid pattern gives an error and no crash", () => {
  const result=compileRegex("(", true);
  assertEqual(result.regex, null);
  assertEqual(result.error !== "", true);
});

test("search: dangerous nested repeats and long patterns are blocked", () => {
  assertEqual(compileRegex("(a+)+$", true).regex, null);
  assertEqual(compileRegex("x".repeat(101), true).regex, null);
  assertEqual(compileRegex("(coffee|tea)", true).regex !== null, true);
});

test("seach: case toggle works", () => {
  const records = [goodRecord, Object.assign({}, goodRecord, { id: "txn_0002", description: "Coffee"})];
  assertEqual(filterRecords(records, compileRegex("coffee", true).regex).length, 1);
  assertEqual(filterRecords(records, compileRegex("coffee", false).regex).length, 0);
});
test("search: cents pattern finds amounts with decimals", () => {
  const records=[
    Object.assign({}, goodRecord, { amount: 12.5}),
    Object.assign({}, goodRecord, { id: "txn_0002", amount:2500})
  ];
  assertEqual(filterRecords(records, compileRegex("\\.\\d{2}\\b", true).regex).length, 1);
});

test("search: duplicate word pattern finds repeated words", () => {
  const records = [goodRecord, Object.assign({}, goodRecord, { id: "txn_0002", description: "Coffee coffee beans"})];
  assertEqual(filterRecords(records, compileRegex("\\b(\\w+)\\s+\\1\\b", true).regex).length, 1);
});

test("search: no pattern returns every record", () => assertEqual(filterRecords([goodRecord, goodRecord], null).length, 2));
test("highlight: wraps matches in mark", () => 
  assertEqual(highlight("Iced coffee", compileRegex("coffee",true).regex), "Iced <mark>coffee</mark>"));
test("highlight: escapes HTML so nothing is injected", () => {
  assertEqual(highlight("<b>hi</b>", compileRegex("hi", true).regex),
  "&lt;b&gt;<mark>hi</mark>&lt;/b&gt;");
  assertEqual(highlight("<b>hi</b>", null), "&lt;b&gt;hi&lt;/b&gt;");
});
test("highlight: empty matches do not create empty marks", () => 
assertEqual(highlight("abc", compileRegex("x*", true).regex), "abc"));
const rates= {USD: 1450, EUR: 1600};
const sortSample = [
  Object.assign({}, goodRecord, { id: "a", description: "banana", amount: 2000, currency: "RWF", date: "2025-01-02"}),
  Object.assign({}, goodRecord, { id: "b", description: "Apple", amount: 5, currency: "USD", date: "2025-03-01"}),
  Object.assign({}, goodRecord, {id: "c", description: "cherry", amount: 1, currency: "EUR", date: "2025-02-10"})
];

const ids=list => list.map(r => r.id).join("");
test("sort: data both directions", () => {
  assertEqual(ids(sortRecords(sortSample, "date-desc", rates)), "bca");
  assertEqual(ids(sortRecords(sortSample, "date-asc", rates)), "acb");
});

test("sort: description ignores upper/lower case", () => {
  assertEqual(ids(sortRecords(sortSample, "description-asc", rates)), "bac");
  assertEqual(ids(sortRecords(sortSample, "description-desc", rates)), "cab");
});

test("sort: amount compares after coverting currencies", () => {
  assertEqual(ids(sortRecords(sortSample, "amount-asc", rates)), "cab");
  assertEqual(ids(sortRecords(sortSample, "amount-desc", rates)), "bac");
});

test("Sort: original list is not changed", () => {
  sortRecords(sortSample, "amount-asc", rates);
  assertEqual(ids(sortSample), "abc");
});

const statsRates = { USD: 1450, EUR: 1600};
test("stats: toDateString pads month and day", () => {
  assertEqual(toDateString(new Date(2025, 0, 5)), "2025-01-05");
  assertEqual(toDateString(new Date(2024, 11, 31)), "2024-12-31");
});
test("stats: total converts currencies and avoids float errors", () => {
  const records = [
    Object.assign({}, goodRecord, {amount: 10, currency: "USD"}),
    Object.assign({}, goodRecord, {id: "txn_0002", amount: 2000, currency: "RWF"})
  ];
  assertEqual(totalInBase(records, statsRates), 16500);
  assertEqual(totalInBase([], statsRates), 0);
  const tiny = [
    Object.assign({}, goodRecord, {amount: 0.1, currency: "RWF"}),
    Object.assign({}, goodRecord, { id: "txn_0002", amount: 0.2, currency: "RWF"})
  ];
  assertEqual(totalInBase(tiny, statsRates), 0.3);
});
test("stats: top category uses converted amounts", () => {
  const records = [
    Object.assign({}, goodRecord, {amount: 5000, currency: "RWF", category: "Food"}),
    Object.assign({}, goodRecord, {id: "txn_0002", amount: 10, currency: "USD", category: "Books"})
  ];
  assertSame(topCategory(records, statsRates), { name: "Books", total: 14500});
});

test("stats: top category is null with no records", () => 
assertEqual(topCategory([], statsRates), null));
test("stats: a category named like and object property is safe", () => {
  const records = [Object.assign({}, goodRecord, {amount: 5, currency: "RWF", category: "constructor"})];
  assertSame(topCategory(records, statsRates), {name: "constructor", total:5});
});

test("stats: last 7 days covers 7 days across a year change", () => {
  const days= lastSevenDays([], statsRates, new Date(2025, 0, 3));
  assertEqual(days.length, 7);
  assertEqual(days[0].date, "2024-12-28");
  assertEqual(days[6].date, "2025-01-03");
  assertEqual(days[6].label, "Fri");
});

test("stats: last 7 days counts only records inside the window", () => {
  const today=new Date(2025,0,3);
  const make=(id, date, amount) => Object.assign({}, goodRecord, {
    id: id, date: date, amount: amount, currency: "RWF"
  });
  const records=[
    make("a", "2024-12-27", 100),
    make("b", "2024-12-28", 200),
    make("c", "2025-01-03", 300),
    make("d", "2025-01-03", 50),
    make("e", "2025-01-04", 999)
  ];
  const days=lastSevenDays(records, statsRates, today);
  assertEqual(days[0].total, 200);
  assertEqual(days[6].total, 350);
  assertEqual(days.reduce((sum, day)=> sum + day.total, 0), 550);
});

test("cap: 0 means no cap", () => assertEqual(capStatus(5000, 0, "RWF").state, "none"));
test("cap: under the cap is polite and shows what is left", ()=> {
  const result = capStatus(1000, 5000, "RWF");
  assertEqual(result.over, false);
  assertEqual(result.message, "4000 RWF remaining of your 5000 RWF cap.");
});
test("cap: exactly at the cap is not over", () => {
  assertEqual(capStatus(5000, 5000, "RWF").over, false);
  assertEqual(capStatus(5000, 5000, "RWF").message, "0 RWF remaining of your 5000 RWF cap.");
});
test ("cap: over the cap shows the overage", () => {
  const result=capStatus(5000.5, 5000, "RWF");
  assertEqual(result.over, true);
  assertEqual(result.message, "Over your cap by 0.50 RWF.");
});
const backupRecords=localStorage.getItem(RECORDS_KEY);
const backupSettings=localStorage.getItem(SETTINGS_KEY);

try{
  test("Storage: save then load returns the same data", () => {
    assertEqual(saveJson("finance-tracker:test", {a:1}), true);
    assertSame(loadJson("finance-tracker:test"), {status: "ok", data: {a: 1} });
    localStorage.removeItem("finance-tracker:test");
  });
  test("storage: missisng key is 'empty', broken JSON is 'corrupt'", () => {
    assertEqual(loadJson("finance-tracker:does-not-exist").status, "empty");
    localStorage.setItem("finance-tracker:test", "{broken");
    assertEqual(loadJson("finance-tracker:test").status, "corrupt");
    localStorage.removeItem("finance-tracker:test");
  });
  test("state: starts empty, adds records with ids and timestamps", () => {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    assertEqual(initState().length, 0);
    assertEqual(getRecords().length, 0);
    const first=addRecord({ description: "A", amount: 1, currency: "RWF", category: "Food", date: "2025-01-01"});
    const second = addRecord({description: "B", amount: 2, currency: "USD", category: "Books", date: "2025-01-02"});
    assertEqual(first.id, "txn_0001");
    assertEqual(second.id, "txn_0002");
    assertEqual(first.createdAt, first.updatedAt);
  });
  test("state: records survive a reload", () => {
    initState();
    assertEqual(getRecords().length, 2);
  });
  test("state: update keeps createdAt and moves updatedAt", () => {
    const before = getRecords()[0];
    const after=updateRecord(before.id, {description: "A2", amount: 5, currency: "RWF", category: "Food", date: "2025-01-01"});
    assertEqual(after.description, "A2");
    assertEqual(after.createdAt, before.createdAt);
    assertEqual(after.updatedAt >= before.updatedAt, true);
    assertEqual(updateRecord("nope", {}), null);
  });
  test("state: delete removes only thaht record", () => {
    assertEqual(deleteRecord("txn_0001"), true);
    assertEqual(deleteRecord("txn_0001"), false);
    assertEqual(getRecords().length, 1);
  });
  test("state: new ids never clash after a delete", () => {
    const third = addRecord({description: "C", amount: 3, currency: "RWF", category: "Fees", date: "2025-01-03"});
    assertEqual(third.id, "txn_0003");
  });
  test("state: corrupt saved data is reported and does not crash", () => {
    localStorage.setItem(RECORDS_KEY, "{broken");
    const warnings = initState();
    assertEqual(warnings.length, 1);
    assertEqual(getRecords().length, 0);
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{id: 5}]));
    assertEqual(initState().length, 1);
    assertEqual(getRecords().length, 0);
  });
  test("state: settings save and reload", () => {
    initState();
    const settings = getSettings();
    settings.cap=5000;
    updateSettings(settings);
    initState();
    assertEqual(getSettings().cap, 5000);
  });
  test("state: export then import gives the same records", () => {
    clearRecords();;
    addRecord({description: "A", amount: 1, currency: "RWF", category: "Food", date: "2025-01-01"});
    const text=JSON.stringify(exportData());
    clearRecords();
    assertEqual(getRecords().length, 0);
    const result = importText(text);
    assertEqual(result.ok, true);
    assertEqual(getRecords().length, 1);
  });
  test("state: bad imports are rejected and keep current data", () => {
    assertEqual(importText("not.json").ok, false);
    assertEqual(importText('{"records": "no"}').ok, false);
    assertEqual(importText('[{"id": "x"}]').ok, false);
    assertEqual(getRecords().length, 1);
  });

} finally {
  if(backupRecords === null) { localStorage.removeItem(RECORDS_KEY);}
  else { localStorage.setItem(RECORDS_KEY, backupRecords); }
  if(backupSettings === null) {localStorage.removeItem(SETTINGS_KEY);}
  else { localStorage.setItem(SETTINGS_KEY, backupSettings);}
}

async function  checkSeedFile() {
  try {
    const response = await fetch("seed.json");
    const data = await response.json();
    const result= validateImport(data);
    if(!result.ok) {
      throw new Error (result.message);
    }
    if(result.records.length < 10) {
      throw new Error ("seed.json needs at least 10 records");
    }
    results.push({name: "seed.json: valid and has 10+ records", passed: true, message: ""});
  } catch (error) {
    results.push({name: "seed.json: valid and has 10+ records", passed: false, message: error.message});
  }
}
function showResults() {
  const list= document.getElementById("results");
  const summary=document.getElementById("summary");
  let failed=0;
  for (const item of results) {
    const li=document.createElement("li");
    li.className=item.passed ? "pass":"fail";
    li.textContent=(item.passed ? "PASS: ": "FAIL: ") + item.name + (item.passed ? "": " (" +item.message + ")");
    list.appendChild(li);
    if(!item.passed) {
      failed++;
    }
  }
  summary.textContent=results.length-failed +" of "+
  results.length + " tests passed.";
  summary.className = failed === 0 ? "pass": "fail";
}
if(typeof document !== "undefined") {
  checkSeedFile().then(showResults);
}
