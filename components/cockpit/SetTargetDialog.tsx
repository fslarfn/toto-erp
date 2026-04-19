"use client";
import { useState } from "react";
import { Settings, X } from "lucide-react";
import { setMonthlyTarget } from "../../lib/queries/cockpit";
import { useAuth } from "../../lib/auth";
import { mutate } from "swr";

interface Props {
  currentTarget: number;
}

export default function SetTargetDialog({ currentTarget }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(currentTarget.toString());
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      await setMonthlyTarget(now.getFullYear(), now.getMonth() + 1, Number(target), user.id);
      await mutate('cockpit-profit-stats');
      setOpen(false);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan target.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors border-none bg-transparent cursor-pointer"
        title="Set Target"
      >
        <Settings size={14} />
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Set Target Laba Bulanan</h3>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Target Profit (IDR)</label>
                <input 
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: 6, 
                    border: '1px solid #e2e8f0',
                    fontSize: 18,
                    fontWeight: 700
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 16, backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              <button 
                onClick={() => setOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: 6, 
                  border: 'none', 
                  backgroundColor: '#4f46e5', 
                  color: 'white', 
                  fontSize: 13, 
                  fontWeight: 600, 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? "Menyimpan..." : "Simpan Target"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
