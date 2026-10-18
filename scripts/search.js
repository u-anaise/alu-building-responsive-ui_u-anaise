import { escapeHtml, formatAmount, convertToBase } from "./utils.js";

export function compileRegex(input, ignoreCase) {
  if (input === "") {
    return { regex: null, error: ""};
  }
  if (input.length>100) {
    return {regex: null, error: "Pattern is too long (maximum 100 characters)."};
  }
  if(/\([^)]*[+*][^)]*\)[+*{]/.test(input)) {
    return {regex: null, error: "This pattern could freeze the page (a repeat inside a repeat). Try a simpler one."};
  }
  try {
    const flags=ignoreCase? "gi": "g";
    return {regex: new RegExp(input, flags), error: ""};
  } catch (error) {
    return {regex: null, error: "Invalid pattern: " + error.message};
  }
}

function searchableParts(record) {
  return [record.description, record.category, formatAmount(record.amount), record.date, record.currency];
}

export function recordMatches(record, regex) {
  for (const text of searchableParts(record)) {
    if(text.search(regex) !==-1) {
      return true;
    }
  }
  return false;
}

export function filterRecords(records, regex) {
  if (regex === null) {
    return records.slice();
  }
  return records.filter(record => recordMatches(record, regex));
}

export function highlight (text, regex) {
  if(regex === null) {
    return escapeHtml(text);
  }
  let result = "";
  let lastIndex=0;
  for (const match of text.matchAll(regex)) {
    if(match[0] === "") {
      continue;
    }
    result +=escapeHtml(text.slice(lastIndex, match.index));
    result +="<mark>" + escapeHtml(match[0]) + "</mark>";
    lastIndex=match.index + match[0].length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

export function sortRecords(records, sortKey, rates) {
  const copy= records.slice();
  const parts=sortKey.split("-");
  const field=parts[0];
  const direction=parts[1]=== "asc" ? 1 : -1;

  copy.sort((a, b) => {
    let result=0;
    if (field === "date") {
      result = a.date.localeCompare(b.date);
    } else if(field === "description") {
      result = a.description.localeCompare(b.description, undefined, { sensitivity: "base"});
    } else if(field === "amount") {
      result = convertToBase(a.amount, a.currency, rates) - convertToBase(b.amount, b.currency, rates);
    }
    return result * direction;
  });
  return copy;
}