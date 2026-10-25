// Price movement in EUR, using the same current FX rate for both valuations.
// Cash remains unchanged. Missing previous closes must not appear as a zero day.
export function dailyPerformance(positions,cash=0){
 if(!Number.isFinite(cash)||cash<0)return null;
 let current=cash,previous=cash;
 for(const quote of positions){
  if(!Number.isFinite(quote?.value)||quote.value<0||!Number.isFinite(quote.day)||quote.day<=-100)return null;
  current+=quote.value;previous+=quote.value/(1+quote.day/100);
 }
 const change=current-previous;
 return {change,percent:previous>0?change/previous*100:null};
}
