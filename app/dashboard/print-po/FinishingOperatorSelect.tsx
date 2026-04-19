
import React from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export const FinishingOperatorSelect: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="no-print">
      <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
        OPERATOR FINISHING (WAJIB)
      </label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        style={{ 
          width: "100%", 
          border: "2px solid #D1BFA3", 
          borderRadius: 8, 
          padding: "9px 12px", 
          fontSize: 13, 
          color: "#3C2F2F", 
          background: "white", 
          outline: "none", 
          cursor: "pointer",
          fontWeight: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}
      >
        <option value="">-- Pilih Operator --</option>
        <option value="Ami">Ami</option>
        <option value="Dimas">Dimas</option>
        <option value="Yudi">Yudi</option>
      </select>
    </div>
  );
};
