export type OfficialCalendarEvent = {
  id: string;
  date: string;
  title: string;
  kind: "national_holiday" | "joint_leave";
  sourceLabel: string;
  sourceUrl: string;
};

const SOURCE_2026 = {
  label: "SKB 3 Menteri 2026 (1497/2025, 2/2025, 5/2025)",
  url: "https://jdih.kemnaker.go.id/asset/data_puu/2025kb002.pdf",
};

const SOURCE_2027 = {
  label: "SKB 3 Menteri 2027 (1205/2026, 3/2026, 2/2026)",
  url: "https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027",
};

function holiday(
  date: string,
  title: string,
  kind: OfficialCalendarEvent["kind"],
  source: typeof SOURCE_2026,
): OfficialCalendarEvent {
  return {
    id: `official-${date}-${kind}-${title}`,
    date,
    title,
    kind,
    sourceLabel: source.label,
    sourceUrl: source.url,
  };
}

export const INDONESIA_OFFICIAL_HOLIDAYS: OfficialCalendarEvent[] = [
  holiday("2026-01-01", "Tahun Baru 2026 Masehi", "national_holiday", SOURCE_2026),
  holiday("2026-01-16", "Isra Mikraj Nabi Muhammad SAW", "national_holiday", SOURCE_2026),
  holiday("2026-02-16", "Cuti bersama Tahun Baru Imlek", "joint_leave", SOURCE_2026),
  holiday("2026-02-17", "Tahun Baru Imlek 2577 Kongzili", "national_holiday", SOURCE_2026),
  holiday("2026-03-18", "Cuti bersama Hari Suci Nyepi", "joint_leave", SOURCE_2026),
  holiday("2026-03-19", "Hari Suci Nyepi (Tahun Baru Saka 1948)", "national_holiday", SOURCE_2026),
  holiday("2026-03-20", "Cuti bersama Idul Fitri 1447 H", "joint_leave", SOURCE_2026),
  holiday("2026-03-21", "Idul Fitri 1447 Hijriah", "national_holiday", SOURCE_2026),
  holiday("2026-03-22", "Idul Fitri 1447 Hijriah", "national_holiday", SOURCE_2026),
  holiday("2026-03-23", "Cuti bersama Idul Fitri 1447 H", "joint_leave", SOURCE_2026),
  holiday("2026-03-24", "Cuti bersama Idul Fitri 1447 H", "joint_leave", SOURCE_2026),
  holiday("2026-04-03", "Wafat Yesus Kristus", "national_holiday", SOURCE_2026),
  holiday("2026-04-05", "Kebangkitan Yesus Kristus (Paskah)", "national_holiday", SOURCE_2026),
  holiday("2026-05-01", "Hari Buruh Internasional", "national_holiday", SOURCE_2026),
  holiday("2026-05-14", "Kenaikan Yesus Kristus", "national_holiday", SOURCE_2026),
  holiday("2026-05-15", "Cuti bersama Kenaikan Yesus Kristus", "joint_leave", SOURCE_2026),
  holiday("2026-05-27", "Idul Adha 1447 Hijriah", "national_holiday", SOURCE_2026),
  holiday("2026-05-28", "Cuti bersama Idul Adha 1447 H", "joint_leave", SOURCE_2026),
  holiday("2026-05-31", "Hari Raya Waisak 2570 BE", "national_holiday", SOURCE_2026),
  holiday("2026-06-01", "Hari Lahir Pancasila", "national_holiday", SOURCE_2026),
  holiday("2026-06-16", "1 Muharam Tahun Baru Islam 1448 H", "national_holiday", SOURCE_2026),
  holiday("2026-08-17", "Proklamasi Kemerdekaan", "national_holiday", SOURCE_2026),
  holiday("2026-08-25", "Maulid Nabi Muhammad SAW", "national_holiday", SOURCE_2026),
  holiday("2026-12-24", "Cuti bersama Kelahiran Yesus Kristus", "joint_leave", SOURCE_2026),
  holiday("2026-12-25", "Kelahiran Yesus Kristus", "national_holiday", SOURCE_2026),

  holiday("2027-01-01", "Tahun Baru 2027 Masehi", "national_holiday", SOURCE_2027),
  holiday("2027-01-05", "Isra Mikraj Nabi Muhammad SAW", "national_holiday", SOURCE_2027),
  holiday("2027-02-05", "Cuti bersama Tahun Baru Imlek", "joint_leave", SOURCE_2027),
  holiday("2027-02-06", "Tahun Baru Imlek 2578 Kongzili", "national_holiday", SOURCE_2027),
  holiday("2027-03-08", "Hari Suci Nyepi (Tahun Baru Saka 1949)", "national_holiday", SOURCE_2027),
  holiday("2027-03-09", "Cuti bersama Idul Fitri 1448 H", "joint_leave", SOURCE_2027),
  holiday("2027-03-10", "Idul Fitri 1448 Hijriah", "national_holiday", SOURCE_2027),
  holiday("2027-03-11", "Idul Fitri 1448 Hijriah", "national_holiday", SOURCE_2027),
  holiday("2027-03-12", "Cuti bersama Idul Fitri 1448 H", "joint_leave", SOURCE_2027),
  holiday("2027-03-15", "Cuti bersama Idul Fitri 1448 H", "joint_leave", SOURCE_2027),
  holiday("2027-03-25", "Cuti bersama Wafat Yesus Kristus", "joint_leave", SOURCE_2027),
  holiday("2027-03-26", "Wafat Yesus Kristus", "national_holiday", SOURCE_2027),
  holiday("2027-03-28", "Kebangkitan Yesus Kristus (Paskah)", "national_holiday", SOURCE_2027),
  holiday("2027-05-01", "Hari Buruh Internasional", "national_holiday", SOURCE_2027),
  holiday("2027-05-06", "Kenaikan Yesus Kristus", "national_holiday", SOURCE_2027),
  holiday("2027-05-17", "Idul Adha 1448 Hijriah", "national_holiday", SOURCE_2027),
  holiday("2027-05-18", "Cuti bersama Idul Adha 1448 H", "joint_leave", SOURCE_2027),
  holiday("2027-05-19", "Cuti bersama Hari Raya Waisak", "joint_leave", SOURCE_2027),
  holiday("2027-05-20", "Hari Raya Waisak 2571 BE", "national_holiday", SOURCE_2027),
  holiday("2027-06-01", "Hari Lahir Pancasila", "national_holiday", SOURCE_2027),
  holiday("2027-06-06", "1 Muharam Tahun Baru Islam 1449 H", "national_holiday", SOURCE_2027),
  holiday("2027-08-15", "Maulid Nabi Muhammad SAW", "national_holiday", SOURCE_2027),
  holiday("2027-08-17", "Proklamasi Kemerdekaan", "national_holiday", SOURCE_2027),
  holiday("2027-12-24", "Cuti bersama Kelahiran Yesus Kristus", "joint_leave", SOURCE_2027),
  holiday("2027-12-25", "Kelahiran Yesus Kristus (Natal)", "national_holiday", SOURCE_2027),
  holiday("2027-12-26", "Isra Mikraj Nabi Muhammad SAW", "national_holiday", SOURCE_2027),
];

export function officialHolidaysForYear(year: number) {
  return INDONESIA_OFFICIAL_HOLIDAYS.filter((event) => event.date.startsWith(`${year}-`));
}

export function officialSourceForYear(year: number) {
  if (year === 2026) return SOURCE_2026;
  if (year === 2027) return SOURCE_2027;
  return null;
}
