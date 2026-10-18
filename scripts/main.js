import {
  initState, getRecords, getSettings, addRecord, updateRecord, deleteRecord,
  clearRecords, updateSettings, exportData, importText, didLastSaveWork
} from "./state.js";
import { compileRegex, filterRecords, sortRecords } from "./search.js";
import {
  validateDescription, validateAmount, validateCategory, validateDate,
  validateRecordFields, validateRate, validateCap, validateCategoryInput
} from "./validators.js"
import { toDateString } from "./stats.js";
import {
  getViewFromHash, showView, focusHeading, setStatus, showFieldError,
  renderTable, showEditError, findRowButton, renderDashboard,
  fillSettingsForm, renderCategoryOptions
} from "./ui.js";

function byId(id){
  return document.getElementById(id);
}

let editingId=null;

const ADD_FIELDS = [
  {name: "description", check: validateDescription},
  {name: "amount", check: validateAmount},
  { name: "category", check: validateCategory},
  { name: "date", check: validateDate}
];

function refreshRecords() {
  const settings=getSettings();
  const all=getRecords();
  const search=compileRegex(byId("search-input").value, byId("search-case").checked);
  const shown=sortRecords(filterRecords(all, search.regex), byId("sort-select").value, settings.rates);

  renderTable(shown, search.regex, editingId);

  byId("search-input").setAttribute("aria-invalid", search.error === "" ? "false" : "true");
  if (search.error !== "") {
    setStatus("search-status", search.error, true);
  } else if (byId("search-input").value === "") {
    setStatus("search-status", "Showing all "+ all.length + " records.");
  } else {
    setStatus("search-status", shown.length+ " of "+all.length + " records match.")
  }
  byId("empty-state").hidden = (all.length >0);
}

function refreshAll() {
  refreshRecords();
  renderDashboard(getRecords(), getSettings());
}

function applySettingsToPage() {
  const settings=getSettings();
  fillSettingsForm(settings);
  renderCategoryOptions(settings.categories);
}

function reportChange(statusId, message) {
  if(didLastSaveWork()) {
    setStatus(statusId, message, false);
  } else {
    setStatus(statusId, message + " But your browser could not save it, so it will be lost when you close the page.", true);
  }
}

window.addEventListener("hashchange", () => {
  if (window.location.hash==="#main") {
    return;
  }
  const id=getViewFromHash();
  showView(id, true);
});

for (const field of ADD_FIELDS) {
  byId(field.name).addEventListener("input", ()=> {
    const result= field.check(byId(field.name).value);
    showFieldError(field.name, field.name + "-error", result.ok ? "" : result.message);
  });
}

byId ("record-form").addEventListener("submit", event => {
  event.preventDefault();
  const result=validateRecordFields({
    description: byId("description").value,
    amount: byId("amount").value,
    currency: byId("currency").value,
    category: byId("category").value,
    date: byId("date").value
  });

  for(const field of ADD_FIELDS) {
    showFieldError(field.name, field.name + "-error", result.errors[field.name] || "");
  }
  if(!result.ok) {
    const firstBad=ADD_FIELDS.find(field=> result.errors[field.name] != undefined);
    setStatus("form-status", "Please fix the fields marked with errors.", true);
    byId(firstBad.name).focus();
    return;
  }
  addRecord(result.value);
  byId("record-form").reset();
  byId("date").value=toDateString(new Date());
  refreshAll();
  reportChange("form-status", "Transaction added.");
  byId("description").focus();
});

byId("record-form").addEventListener("reset", ()=> {
  for (const field of ADD_FIELDS) {
    showFieldError(field.name, field.name + "-error", "");
  }
  setStatus("form-status", "");
});

byId("search-input").addEventListener("input", () => {
  editingId=null;
  refreshRecords();
});
byId("search-case").addEventListener("change", refreshRecords);
byId("sort-select").addEventListener("change", () => {
  editingId=null;
  refreshRecords();
});

function stopEditing(id) {
  editingId=null;
  refreshRecords();
  const button=findRowButton("edit", id);
  if (button !== null){
    button.focus();
  } else {
    focusHeading("records");
  }
}

function saveEdit(id) {
  const result = validateRecordFields({
    description: byId("edit-description").value,
    amount: byId("edit-amount").value,
    currency: byId("edit-currency").value,
    category:byId("edit-category").value,
    date: byId("edit-date").value
  });
  if(!result.ok) {
    const firstBad=ADD_FIELDS.find(field => result.errors[field.name] !== undefined);
    showEditError(result.errors[firstBad.name]);
    byId("edit-" + firstBad.name) .focus();
    return;
  }
  updateRecord(id, result.value);
  stopEditing(id);
  renderDashboard(getRecords(), getSettings());
  reportChange("app-status", "Transaction updated.");
}

function removeRecord(id) {
  const record= getRecords(). find(item => item.id === id);
  if(record === undefined) {
    return;
  }
  if(!confirm('Delete "'+record.description+ '"? This cannot be undone.')) {
    return;
  }
  deleteRecord(id);
  refreshAll();
  reportChange("app-status", "Transaction deleted");
  focusHeading("records");
}

byId("records-body").addEventListener("click", event => {
  const button = event.target.closest("button");
  if(button === null) {
    return;
  }
  const action= button.dataset.action;
  const id=button.dataset.id;

  if (action==="edit") {
    editingId=id;

    refreshRecords();
    byId("edit-description").focus();
  } else if (action === "cancel") {
    stopEditing(id);
  } else if (action === "save") {
    saveEdit(id);
  } else if (action === "delete") {
    removeRecord(id);
  }
});

byId("records-body").addEventListener("keydown", event => {
  if (editingId === null) {
    return;
  }
  if (event.key === "Escape") {
    stopEditing(editingId);
  } else  if (event.key === "Enter" && event.target.tagName === "INPUT") {
    saveEdit(editingId);
  }
});

byId("settings-form").addEventListener("submit", event => {
  event.preventDefault();
  const checks= [
    { inputId: "rate-usd", errorId: "rate-usd-error", result: validateRate(byId("rate-usd").value) },
    { inputId: "rate-eur", errorId: "rate-eur-error", result: validateRate(byId("rate-eur").value) },
    { inputId: "cap-input", errorId: "cap-error", result: validateCap(byId("cap-input").value) },
    { inputId: "categories-input", errorId: "categories-error", result: validateCategoryInput(byId("categories-input").value) }
  ];

  let firstBad = null;
  for (const check of checks) {
    showFieldError(check.inputId, check.errorId, check.result.ok ? "" : check.result.message);
    if(!check.result.ok && firstBad === null) {
      firstBad = check;
    }
  }
  if(firstBad !== null) {
    setStatus("settings-status", "Please fix the fields marked with errors.", true);
    byId(firstBad.inputId).focus();
    return;
  }

  updateSettings({
    baseCurrency: "RWF",
    rates: {USD: checks[0].result.value, EUR:checks[1].result.value},
    cap: checks[2].result.value,
    categories:checks[3].result.value
  });
  applySettingsToPage();
  refreshAll();
  reportChange("settings-status", "Settings saved.");
});

byId("export-btn").addEventListener("click", () => {
  const text=JSON.stringify(exportData(), null, 2);
  const blob=new Blob([text], { type: "application/json"})
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="finance-export.json";
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("data-status", "Exported " + getRecords().length+" records.", false);
});

function runImport(text) {
  const count =getRecords().length;
  if(count>0 && !confirm("This replaces your " + count+" current records. Continue? ")) {
    setStatus("data-status", "Import cancelled. Nothing was changed.");
    return ;
  }
  const result = importText(text);
  if(!result.ok) {
    setStatus("data-status", "Import failed: "+result.message, true);
    return;
  }
  editingId= null;
  applySettingsToPage();
  refreshAll();
  reportChange("data-status", result.message);
}

byId("import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (file === undefined) {
    return;
  }
  try{
    runImport(await file.text());
  } catch (error) {
    setStatus("data-status", "Could not read that file.", true);
  }
  event.target.value="";
});

byId("load-seed-btn").addEventListener("click", async () => {
  try {
    const response=await fetch("seed.json");
    if(!response.ok) {
      throw new Error("not found");
    }
    runImport(await response.text());
  } catch ( error ) {
    setStatus("data-status", "Could not load seed.json. Open the site through a local server.", true);
  }
});

byId("clear-btn").addEventListener("click", () => {
  if (getRecords().length === 0) {
    setStatus("data-status", "There are no records to delete");
    return;
  }
  if( !confirm ("Delete all " + getRecords().length + " records? This cannot be undone.")) {
    return;
  }
  clearRecords();
  editingId=null;
  refreshAll();
  reportChange("data-status", "All records deleted.");
});

const warnings = initState();
applySettingsToPage();
byId("date").value=toDateString(new Date());
refreshAll();
showView(getViewFromHash(), false);
if(warnings.length>0) {
  setStatus("app-status", warnings.join(" "), true);
}