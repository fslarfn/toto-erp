import { describe, expect, it } from "vitest";
import { matchHppProduct, resolveHppProduct } from "./auto-match";
import type { HppProductRow } from "./store";
const product=(id:string,name:string)=>({id,product_name:name,workspace:"toto"}) as HppProductRow;
const catalog=[product("doff",'3\\" HITAM DOFF'),product("semi",'3"HITAM SEMI'),product("ykk",'3"YKK'),product("mf",'3"YKK MF'),product("ob",'3"OPENBACK H.DOFF')];
describe("conservative HPP automatic matching",()=>{
  it("prioritizes a manual selection",()=>expect(resolveHppProduct('3" HITAM DOFF',catalog,{},"semi")?.id).toBe("semi"));
  it("skips an explicitly cleared selection",()=>expect(resolveHppProduct('3" HITAM DOFF',catalog,{},"")).toBeNull());
  it("does not substitute a deleted manual product",()=>expect(resolveHppProduct('3" HITAM DOFF',catalog,{},"deleted")).toBeNull());
  it("automatically resolves untouched selections",()=>expect(resolveHppProduct('3" HITAM DOFF',catalog,{})?.id).toBe("doff"));
  it.each(['3\'\' HITAM DOFF L 117,5 T 58,75','3"HITAM DOFF D. 100 * FULL LINGKARAN','3" HITAM DOFF MAL TRIPLEK 1'])("matches dimensions without changing profile: %s",name=>{
    expect(matchHppProduct(name,catalog)?.id).toBe("doff");
  });
  it("normalizes catalog abbreviations",()=>expect(matchHppProduct('3"OPENBACK HITAM DOFF D. 40',catalog)?.id).toBe("ob"));
  it("distinguishes specific YKK MF from generic YKK",()=>expect(matchHppProduct('3"YKK MF MAL',catalog)?.id).toBe("mf"));
  it.each(['4"HITAM DOFF D. 40','ORNAMEN HITAM DOFF D. 40','STOPER U 5/8 HITAM DOFF','3"HITAM DOFF YKK MAL','3"HITAM DOFF MAL + WHITE'])('does not guess: %s',name=>expect(matchHppProduct(name,catalog)).toBeNull());
  it("rejects ambiguous catalog duplicates",()=>expect(matchHppProduct('3"HITAM DOFF MAL',[...catalog,product("duplicate",'3" HITAM DOFF')])).toBeNull());
  it("preserves an existing explicit mapping",()=>expect(matchHppProduct('3"HITAM DOFF MAL',catalog,{'3"hitam doff mal':'semi'})?.id).toBe('semi'));
});
