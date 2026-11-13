-- Alucurv attendance was recorded before the operating-unit boundary existed.
-- Correct the unit label only; the attendance timestamps, employee references,
-- selfie fields, and payroll-related values remain unchanged.
UPDATE public.absensi
SET operating_unit = 'alucurv'
WHERE workspace = 'alucurv'
  AND operating_unit IS DISTINCT FROM 'alucurv';
