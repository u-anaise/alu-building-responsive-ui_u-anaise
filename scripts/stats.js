import { convertToBase, roundMoney, formatAmount } from "./utils.js";
const DAY_NAMES=["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toDateString(date) {
  const month=String(date.getMonth()+1).padStart(2, "0");
  const day=String(date.getDate()).padStart(2, "0");
  return date.getFullYear() +"-"+month+"-"+day;
}

export function totalInBase(records, rates) {
  let total=0;
  for (const record of records) {
    total += convertToBase(record.amount, record.currency, rates);
  }
  return roundMoney(total);
}

export function topCategory(records, rates) {
  const list=[];
  for (const record of records){
    let entry=list.find(item => item.name=== record.category);
    if(entry===undefined){
      entry={name: record.category, total: 0};
      list.push(entry);
    }
    entry.total += convertToBase(record.amount, record.currency, rates);
  }

  let best=null;
  for (const entry of list) {
    if (best === null || entry.total > best.total) {
      best= entry;
    }
  }
  if (best === null) {
    return null;
  }
  return { name: best.name, total: roundMoney(best.total)};
}

export function lastSevenDays(records, rates, today) {
  const days=[];
  for (let back=6; back>=0; back--) {
    const d= new Date(today.getFullYear(), today.getMonth(), today.getDate()-back);
    days.push({date: toDateString(d), label: DAY_NAMES[d.getDay()], total: 0});
  }
  for (const record of records) {
    const day=days.find(item => item.date === record.date);
    if (day!== undefined){
      day.total +=convertToBase(record.amount, record.currency, rates);
    }
  }
  for(const day of days) {
    day.total=roundMoney(day.total);
  }
  return days;
}

export function capStatus(total, cap, currency) {
  if (cap===0) {
    return { state: "none", over: false, message: "No spending cap is set. You can set one in Settings."};
  }
  if(total>cap) {
    const extra = formatAmount(roundMoney(total - cap));
    return { state: "over", over: true, message: "Over your cap by "+ extra + " "+ currency + "."};
  }
  const left=formatAmount(roundMoney(cap -total));
  return {
    state: "ok",
    over: false,
    message: left + " "+currency+" remaining of your "+formatAmount(cap)+ " " +currency+" cap."
  };
}