export const CURRENCIES=["RWF", "USD", "EUR"];

export function formatAmount(number) {
  const value=Number(number);
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

export function roundMoney(number) {
  return Math.round(number*100)/100;
}

export function escapeHtml(text){
  return String(text)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
}

export function convertToBase(amount, currency, rates) {
  if(currency==="RWF"){
    return amount;
  }
  return amount* rates[currency];
}