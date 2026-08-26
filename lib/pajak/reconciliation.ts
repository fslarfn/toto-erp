export type ReconciliationStatus="match"|"difference"|"not_applicable"|"no_data";
export function monthEndDate(year:number,month:number){
 const day=new Date(year,month,0).getDate();
 return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
export function reconcileValues(source:number,reported:number,applicable=true,tolerance=1):{difference:number;status:ReconciliationStatus}{
 const difference=Math.round(source-reported);
 if(!applicable)return{difference,status:"not_applicable"};
 if(source===0&&reported===0)return{difference,status:"no_data"};
 return{difference,status:Math.abs(difference)<=tolerance?"match":"difference"};
}

export function taxDeadlines(year:number,month:number,code:"pph21"|"pph23"|"ppn"|"pph_badan"){
 if(code==="pph_badan")return{payment:`${year+1}-04-30`,filing:`${year+1}-04-30`};
 const nextYear=month===12?year+1:year,nextMonth=month===12?1:month+1,prefix=`${nextYear}-${String(nextMonth).padStart(2,"0")}`;
 if(code==="ppn"){const last=new Date(nextYear,nextMonth,0).getDate();return{payment:`${prefix}-${last}`,filing:`${prefix}-${last}`}}
 return{payment:`${prefix}-15`,filing:`${prefix}-20`};
}
