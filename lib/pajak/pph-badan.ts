export type CorporateTaxInput={turnover:number;commercialProfit:number;positiveCorrections:number;negativeCorrections:number;credits:{pph22:number;pph23:number;pph25:number;other:number}};
export type CorporateTaxResult={taxableIncome:number;facilityTaxableIncome:number;standardTaxableIncome:number;facilityRate:number;standardRate:number;facilityTax:number;standardTax:number;taxDue:number;totalCredits:number;balance:number;facilityApplied:boolean};

const STANDARD_RATE=.22,FACILITY_RATE=.11,FACILITY_TURNOVER=4_800_000_000,FACILITY_MAX_TURNOVER=50_000_000_000;

export function calculateCorporateTax(input:CorporateTaxInput):CorporateTaxResult{
 const profit=input.commercialProfit+input.positiveCorrections-input.negativeCorrections;
 const taxableIncome=Math.max(0,Math.floor(profit/1000)*1000);
 const eligible=input.turnover>0&&input.turnover<=FACILITY_MAX_TURNOVER&&taxableIncome>0;
 const facilityTaxableIncome=!eligible?0:input.turnover<=FACILITY_TURNOVER?taxableIncome:Math.floor(taxableIncome*FACILITY_TURNOVER/input.turnover);
 const standardTaxableIncome=taxableIncome-facilityTaxableIncome;
 const facilityTax=Math.round(facilityTaxableIncome*FACILITY_RATE),standardTax=Math.round(standardTaxableIncome*STANDARD_RATE),taxDue=facilityTax+standardTax;
 const totalCredits=Math.max(0,input.credits.pph22)+Math.max(0,input.credits.pph23)+Math.max(0,input.credits.pph25)+Math.max(0,input.credits.other);
 return{taxableIncome,facilityTaxableIncome,standardTaxableIncome,facilityRate:FACILITY_RATE,standardRate:STANDARD_RATE,facilityTax,standardTax,taxDue,totalCredits,balance:taxDue-totalCredits,facilityApplied:eligible};
}
