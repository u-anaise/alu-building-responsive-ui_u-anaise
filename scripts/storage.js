export const RECORDS_KEY="finance-tracker:records";
export const SETTINGS_KEY="finance-tracker:settings";

export function loadJson(key){
  let text;
  try{
    text=localStorage.getItem(key);
  } catch(error) {
    return {status: "unavailable", data: null};
  }
  if (text === null ){
    return { status: "empty", data:null};
  }
  try{
    return {status: "ok", data: JSON.parse(text)};
  } catch (error) {
    return { status: "corrupt", data: null};
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}