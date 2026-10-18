import {CURRENCIES} from "./utils.js";

export const patterns={
  description: /^\S(?:.*\S)?$/,
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  rate: /^(0|[1-9]\d*)(\.\d{1,4})?$/,
  date:/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  duplicateWord:/\b(\w+)\s+\1\b/i
};

function ok(value) {
  return {ok: true, value: value};
}

function fail(message) {
  return {ok: false, message: message};
}

export function validateDescription(raw) {
  if( typeof raw!= "string" || raw.trim() === ""){
    return fail ("Description is required.");
  }

  if(!patterns.description.test(raw)){
    return fail("Remove the spaces at the start or end of the description.");
  }

  const cleaned=raw.replace(/\s{2,}/g, " ");
  if(cleaned.length>100) {
    return fail("Description is too long (maximum 100 characters).");
  }

  const repeated=cleaned.match(patterns.duplicateWord);
  if(repeated) {
    return fail('The word "' + repeated[1] + '" is repeated. Check for a typo.');
  }
  return ok(cleaned);
}

export function validateAmount(raw) {
  if(!patterns.amount.test(raw)){
    return fail("Enter a number like 8 or 8.60 (no minus sign, and at most 2 decimals).");
  }
  const number=Number(raw);
  if(number>1000000000) {
    return fail("Amount is too large (maximum 1,000,000,000).");
  }
  return ok(number);
}

export function validateDate(raw){
  if(!patterns.date.test(raw)) {
    return fail("Use the format YYYY-MM-DD, for example 2025-09-25.");
  }
  const year=Number(raw.slice(0,4));
  const month=Number(raw.slice(5,7));
  const day= Number(raw.slice(8, 10));
  if(year<1900 || year>2100){
    return fail("Year  must be between 1900 and 2100.");
  }
  const check=new Date(Date.UTC(year, month-1, day));
  const isReal=
    check.getUTCFullYear()===year&&
    check.getUTCMonth()===month-1&&
    check.getUTCDate()===day;
  if(!isReal) {
    return fail("The date does not exist on the calendar.");
  }
  return ok(raw);
}

export function validateCategory(raw) {
  if (typeof raw!== "string" || raw==="") {
    return fail ("Category is required.");
  }
  if(raw.length>30) {
    return fail("Category is too long (maximum 30 characters).");
  }
  if(!patterns.category.test(raw)) {
    return fail("Use letters, spaces and hyphens only, with no space at the start or end.");
  }
  return ok(raw);
}

export function validateCurrency(raw) {
  if (!CURRENCIES.includes(raw)) {
    return fail("Choose RWF, USD, or EUR.");
  }
  return ok(raw);
}

export function validateRate(raw){
  if(!patterns.rate.test(raw)) {
    return fail("Enter a number like 1890 or 1890.7 (at most 4 decimals).");
  }
  const number=Number(raw);
  if(number<=0) {
    return fail("The rate must be greater than 0.");
  }
  if(number>10000000){
    return fail("The rate is too large.");
  }
  return ok(number);
}

export function validateCap(raw) {
  if (!patterns.amount.test(raw)) {
    return fail("Enter a number like 250000 (use 0 for no cap).");
  }
  const number=Number(raw);
  if(number>1000000000000) {
    return fail("The cap is too large.");
  }
  return ok(number);
}

export function validateCategoryNames(names) {
  if(!Array.isArray(names) || names.length===0) {
    return fail("Enter at least one category.");
  }
  const seen=[];
  for (const name of names) {
    const result=validateCategory(name);
    if(!result.ok) {
      return fail('"' + name+'": '+ result.message);
    }
    if(seen.includes(name.toLowerCase())) {
      return fail('"'+ name+ '" appears twice.');
    }
    seen.push(name.toLowerCase());
  }
  return ok(names);
}

export function validateCategoryInput(raw) {

  // if(typeof raw !== "string") {
  //   return fail("Categories must be entered as text.");
  // }
  const names=raw.split(",").map(part => part.trim()).filter(part => part !== "");
  return validateCategoryNames(names);
}

export function validateRecordFields(input) {
  const checks={
    description: validateDescription(input.description),
    amount:validateAmount(input.amount),
    currency: validateCurrency(input.currency),
    category: validateCategory(input.category),
    date: validateDate(input.date)
  };
  const errors={};
  const value={};
  for (const field in checks) {
    if(checks[field].ok) {
      value[field]=checks[field].value;
    }
    else{
      errors[field]=checks[field].message;
    }
  }
  return {ok:Object.keys(errors).length===0, errors: errors, value:value};  
}

function checkStoredRecord(item) {
  if(item===null||typeof item!=="object"||Array.isArray(item)) {
    return "must be an object.";
  }
  if(typeof item.id!== "string" || item.id==="" || item.id.length>50) {
    return "id must be a short, non-empty text.";
  }
  if(typeof item.description !=="string" || item.description.trim()==="" ||item.description.length>100) {
    return "description must be text of 1 to 100 characters.";
  }
  if(typeof item.amount !== "number" || !patterns.amount.test(String(item.amount)) || item.amount > 1000000000) {
    return "amount must be a number of 0 or more with at most 2 decimals.";
  }
  if(!validateCategory(item.category).ok) {
    return "category is invalid";
  }
  if(!validateDate(item.date).ok) {
    return "date must be a real date in YYYY-MM-DD format.";
  }
  if (item.currency!== undefined && !CURRENCIES.includes(item.currency)) {
    return "currency must be RWF, USD or EUR";
  }
  if(typeof item.createdAt !== "string" || isNaN (Date.parse(item.createdAt))) {
    return "createdAt must be a text.";
  } 
  if(typeof item.updatedAt !=="string" || isNaN(Date.parse(item.updatedAt))) {
    return "updatedAt must be a date text.";
  }
  return "";
}

function cleanRecord(item) {
  return {
    id:item.id,
    description:item.description.trim().replace(/\s{2,}/g, " "),
    amount:item.amount,
    currency: item.currency === undefined ? "RWF": item.currency,
    category: item.category,
    date: item.date,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export function validateSettingsObject(s) {
  if (s===null || typeof s!=="object" || Array.isArray(s)) {
    return fail("Settings must be an object.");
  }
  if(s.rates===null || typeof s.rates !=="object") {
    return fail("Settings need a rates object.");
  }
  const usd=validateRate(String(s.rates.USD));
  if(!usd.ok) {
    return fail("USD rate: "+ usd.message);
  }
  const eur=validateRate(String(s.rates.EUR));
  if(!eur.ok) {
    return fail("EUR rate: "+ eur.message);
  }
  const cap=validateCap(String(s.cap));
  if(!cap.ok) {
    return fail("Cap: "+cap.message);
  }
  const names=validateCategoryNames(s.categories);
  if(!names.ok){
    return fail("Categories: " +names.message);
  }
  return ok({
    baseCurrency: "RWF",
    rates: {USD: usd.value, EUR: eur.value},
    cap: cap.value,
    categories: names.value.slice()
  });
}

export function validateImport(data) {
  let list=data;
  let settingsData=undefined;
  if(!Array.isArray(data)) {
    if(data==null || typeof data!="object" || !Array.isArray(data.records)) {
      return fail("The file must be a list of records, or an object with a records list.");
    }
    list = data.records;
    settingsData = data.settings;
  }

  const records=[];
  const ids=[];
  for (let i=0; i<list.length; i++) {
    const label="Record "+ (i+1) + ": ";
    const problem=checkStoredRecord(list[i]);
    if (problem !== ""){
      return fail(label + problem);
    }
    if(ids.includes(list[i].id)) {
      return fail(label + "duplicate id "+list[i].id+".");
    }
    ids.push(list[i].id);
    records.push(cleanRecord(list[i]));
  }

  let settings=null;
  if (settingsData !== undefined) {
    const result=validateSettingsObject(settingsData);
    if(!result.ok){
      return fail(result.message);
    }
    settings=result.value;
  }
  return {ok: true, records: records, settings: settings};
}

