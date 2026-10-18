import { loadJson, saveJson, RECORDS_KEY, SETTINGS_KEY } from "./storage.js";
import { validateImport, validateSettingsObject } from "./validators.js";

export function getDefaultSettings() {
  return {
    baseCurrency: "RWF",
    rates: {USD: 1450, EUR: 1600},
    cap: 0,
    categories: ["Food", "Books", "Transport", "Entertainment", "Fees", "Other"]
  };
}

let records = [];
let settings=getDefaultSettings();
let lastSaveWorked=true;

function persist() {
  const recordsSaved=saveJson(RECORDS_KEY, records);
  const settingsSaved=saveJson(SETTINGS_KEY, settings);
  lastSaveWorked=recordsSaved && settingsSaved;
}

export function initState() {
  const warnings=[];
  records = [];
  settings=getDefaultSettings();

  const savedRecords=loadJson(RECORDS_KEY);
  if(savedRecords.status === "corrupt") {
    warnings.push("Saved records were unreadable, so the list was reset.");
  } else if (savedRecords.status==="ok") {
    const result = validateImport(savedRecords.data);
    if(result.ok) {
      records=result.records;
    } else {
      warnings.push("Saved records were invalid (" + result.message + ") so the list was reset.");
    }
  }

  const savedSettings=loadJson(SETTINGS_KEY);
  if(savedSettings.status === "corrupt") {
    warnings.push("Saved settings were unreadable, so defaults are used.");
  }
  else if(savedSettings.status === "ok"){
    const result=validateSettingsObject(savedSettings.data);
    if(result.ok) {
      settings=result.value;
    } else{
      warnings.push ("Saved settings were invalid, so defaults are used.");
    }
  }
  return warnings;
}

export function getRecords() {
  return records.slice();
}

export function getSettings() {
  return JSON.parse(JSON.stringify(settings));
}

export function didLastSaveWork() {
  return lastSaveWorked;
}

function makeId() {
  let highest=0;
  for (const record of records) {
    const match=record.id.match(/^txn_(\d+)$/);
    if (match && Number (match[1])>highest) {
      highest = Number (match[1]);
    }
  }
  return "txn_" + String (highest +1).padStart(4, "0");
}

export function addRecord(fields) {
  const now=new Date().toISOString();
  const record={
    id: makeId(),
    description: fields.description,
    amount: fields.amount,
    currency: fields.currency,
    category: fields.category,
    date: fields.date,
    createdAt: now,
    updatedAt: now
  };
  records.push(record);
  persist();
  return record;
}

export function updateRecord(id, fields) {
  const index= records.findIndex(record => record.id === id);
  if(index === -1) {
    return null;
  }
  const old=records[index];
  records[index] = {
    id: old.id,
    description: fields.description,
    amount: fields.amount,
    currency: fields.currency,
    category: fields.category,
    date: fields.date,
    createdAt: old.createdAt,
    updatedAt: new Date().toISOString()
  };
  persist();
  return records[index];
}

export function deleteRecord(id) {
  const before = records.length;
  records= records.filter(record => record.id !== id);
  persist();
  return records.length<before;
}

export function clearRecords() {
  records = [];
  persist();
}

export function updateSettings(newSettings) {
  settings= JSON.parse(JSON.stringify(newSettings));
  persist();
}

export function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    records:getRecords()
  };
}

export function importText(text) {
  let data;
  try {
    data= JSON.parse(text);
  } catch (error) {
    return { ok: false, message: "That file is not valid JSON."};
  }

  const result=validateImport(data);
  if(!result.ok) {
    return {ok: false, message: result.message};
  }
  records=result.records;
  if(result.settings !==null) {
    settings= result.settings;
  }
  persist();
  return { ok: true, message: "Imported "+ records.length + " records." };
}