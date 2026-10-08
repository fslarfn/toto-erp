import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(()=>({ range:vi.fn(), rpc:vi.fn(), from:vi.fn() }));
vi.mock("@/lib/supabase-client",()=>({supabase:{from:mocks.from,rpc:mocks.rpc}}));
import { loadSalesHppRecognitions, loadHppAliases, mapAndProcessSalesHpp } from "./store";

beforeEach(()=>{
  vi.resetAllMocks();
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:mocks.range};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
});
describe("HPP complete loading and confirmed writes",()=>{
  it("loads recognitions beyond 1000 rows",async()=>{
    mocks.range.mockResolvedValueOnce({data:Array.from({length:1000},(_,id)=>({id})),error:null})
      .mockResolvedValueOnce({data:[{id:1000}],error:null});
    expect(await loadSalesHppRecognitions()).toHaveLength(1001);
    expect(mocks.range.mock.calls).toEqual([[0,999],[1000,1999]]);
  });
  it("rejects incomplete results when a later page fails",async()=>{
    mocks.range.mockResolvedValueOnce({data:Array(1000).fill({id:1}),error:null})
      .mockResolvedValueOnce({data:null,error:new Error("offline")});
    await expect(loadSalesHppRecognitions()).rejects.toThrow("offline");
  });
  it("loads and normalizes aliases beyond 1000 rows",async()=>{
    mocks.range.mockResolvedValueOnce({data:Array.from({length:1000},(_,id)=>({alias_name:` Alias ${id} `,product_hpp_id:String(id)})),error:null})
      .mockResolvedValueOnce({data:[{alias_name:" FINAL ",product_hpp_id:"last"}],error:null});
    const aliases=await loadHppAliases();
    expect(Object.keys(aliases)).toHaveLength(1001);expect(aliases.final).toBe("last");
  });
  it("surfaces RPC failures without automatic retry",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:new Error("network")});
    await expect(mapAndProcessSalesHpp("row","product","name","user")).rejects.toThrow("network");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
