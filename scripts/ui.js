import { escapeHtml, formatAmount, CURRENCIES } from "./utils.js";
import { highlight } from "./search.js";
import { totalInBase, topCategory, lastSevenDays, capStatus } from "./stats.js";

const VIEW_IDS = ["about", "dashboard", "records", "add", "settings"];

function byId(id) {
  return document.getElementById(id);
}

export function getViewFromHash() {
  const id= window.location.hash.slice(1);
  return VIEW_IDS.includes(id) ? id: "about";
}

export function showView(id, moveFocus) {
  for (const viewId of VIEW_IDS) {
    byId(viewId).hidden=(viewId !==id);
  }
  for(const link of document.querySelectorAll(".nav-list a")) {
    if(link.getAttribute("href")==='#' +id) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
  const heading = byId(id+"-title");
  document.title=heading.textContent+" - Student Finance Tracker";
  if (moveFocus) {
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  }
}

export function focusHeading (viewId) {
  const heading = byId(viewId + "-title");
  heading.setAttribute("tabindex", "-1");
  heading.focus();
}

export function setStatus(id, message, isError) {
  const element=byId(id);
  element.textContent=message;
  element.classList.toggle("is-error", isError === true);
  element.classList.toggle("is-ok", isError===false);
}

export function showFieldError (inputId, errorId, message) {
  byId(errorId).textContent=message;
  byId(inputId).setAttribute("aria-invalid", message === ""? "false": "true");
}

function currencyOptions(selected) {
  let html="";
  for (const code of CURRENCIES) {
    html +='<option value="' + code + '"' + (code === selected ? " selected" : "") + ">" +code +"</option>";
  }
  return html;
}

function viewRow(record, regex) {
  const id=escapeHtml(record.id);
  const name=escapeHtml(record.description);
  return "<tr>" +
    '<td data-label="Description">' +highlight(record.description, regex) + "</td>" +    
    '<td data-label="Amount">' +highlight(formatAmount(record.amount), regex) + " "+ highlight(record.currency, regex)+ "</td>" +
    '<td data-label="Category">' +highlight(record.category, regex) + "</td>" +
    '<td data-label="Date">' +highlight(record.date, regex) + "</td>" +
    '<td data-label="Actions"><span class="row-actions">' +
      '<button type="button" class="btn btn-small" data-action="edit" data-id="' +id+'" aria-label="Edit ' +name+'">Edit</button>'+
      '<button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="' +id+'" aria-label="Delete ' +name+'">Delete</button>'+
    "</span></td></tr>";
}

function editRow(record) {
  const id=escapeHtml(record.id);
  return '<tr class="is-editing">' +
    '<td data-label="Description"><label class="visually-hidden" for="edit-description">Description</label>' +
      '<input id="edit-description" type="text" autocomplete="off" value="' + escapeHtml(record.description) + '"></td>' +
    '<td data-label="Amount"><span class="edit-pair">' +
      '<label class="visually-hidden" for="edit-amount">Amount</label>' +
      '<input id="edit-amount" type="text" inputmode="decimal" autocomplete="off" value="' + formatAmount(record.amount) + '">' +
      '<label class="visually-hidden" for="edit-currency">Currency</label>' +
      '<select id="edit-currency">' + currencyOptions(record.currency) + "</select></span></td>" +
    '<td data-label="Category"><label class="visually-hidden" for="edit-category">Category</label>' +
      '<input id="edit-category" type="text" list="category-list" autocomplete="off" value="' + escapeHtml(record.category) + '"></td>' +
    '<td data-label="Date"><label class="visually-hidden" for="edit-date">Date</label>' +
      '<input id="edit-date" type="text" autocomplete="off" value="' + escapeHtml(record.date) + '"></td>' +
    '<td data-label="Actions"><span class="row-actions">' +
      '<button type="button" class="btn btn-small btn-primary" data-action="save" data-id="' + id + '">Save</button>' +
      '<button type="button" class="btn btn-small" data-action="cancel" data-id="' +id+'">Cancel</button>' +
    '</span><p id="edit-error" class="error" role="alert"></p></td></tr>';
}

export function renderTable(records, regex, editingId) {
  let html="";
  for (const record of records) {
    html +=(record.id===editingId) ? editRow(record): viewRow(record, regex);
  }
  byId("records-body").innerHTML=html;
  byId("records-table").hidden=(records.length===0);
}

export function showEditError(message) {
  byId("edit-error").textContent=message;
}

export function findRowButton(action, id) {
  for (const button of document.querySelectorAll("#records-body button")) {
    if(button.dataset.action === action && button.dataset.id === id) {
      return button;
    }
  }
  return null;
}

export function renderDashboard(records, settings) {
  const base= settings.baseCurrency;
  const rates=settings.rates;
  const total=totalInBase(records, rates);

  byId("stat-count").textContent=records.length;
  byId("stat-total").textContent=formatAmount(total) + " " + base;

  const top=topCategory(records, rates);
  byId("stat-top-category").textContent=top===null
    ? "No data yet"
    : top.name+ " (" + formatAmount(top.total) + " " + base + ")";

    const days=lastSevenDays(records, rates, new Date());
    let largest=0;
    for(const day of days) {
      if(day.total>largest) {
        largest=day.total;
      }
    }
    let barsHTML="";
    let summary="Spending in the last 7 days: ";
    for (const day of days) {
      const height= largest=== 0?0: Math.round((day.total/largest)*70);
      barsHTML +='<div class="bar-col"><span class="bar-value">'+formatAmount(day.total)+"</span>"+
        '<div class="bar" style="height: ' +height + '%"></div>' +
        '<span class="bar-label">' +day.label+"</span></div>";
      summary += day.label + " " + formatAmount(day.total) +" " +base+ ". ";
    }

    byId("trend-chart").innerHTML=barsHTML;
    byId("trend-chart").setAttribute("aria-label", summary);

    const cap=capStatus(total, settings.cap, base);
    byId("cap-status").textContent=cap.over ? "" :cap.message;
    byId("cap-alert").textContent=cap.over? cap.message: "";
}

export function fillSettingsForm(settings) {
  byId("rate-usd").value=String(settings.rates.USD);
  byId("rate-eur").value=String(settings.rates.EUR);
  byId("cap-input").value=String(settings.cap);
  byId("categories-input").value=settings.categories.join(", ");
}

export function renderCategoryOptions(categories) {
  let html="";
  for(const name of categories) {
    html += '<option value="' +escapeHtml(name)+'"></option>';
  }
  byId("category-list").innerHTML=html;
}