"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  type CalendarStorageMode,
  type CompanyCalendarEvent,
  type CompanyCalendarEventInput,
  type CompanyEventCategory,
  deleteCompanyCalendarEvent,
  loadCompanyCalendarEvents,
  saveCompanyCalendarEvent,
} from "@/lib/calendar/company-events";
import {
  type OfficialCalendarEvent,
  officialHolidaysForYear,
  officialSourceForYear,
} from "@/lib/calendar/indonesia-holidays";
import styles from "./Kalender.module.css";

const YEARS = [2026, 2027, 2028, 2029, 2030];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const CATEGORY_LABELS: Record<CompanyEventCategory, string> = {
  libur_perusahaan: "Libur perusahaan",
  thr_payroll: "THR & payroll",
  gathering: "Family gathering",
  maintenance: "Maintenance",
  rapat: "Rapat",
  deadline: "Tenggat operasional",
  operasional_lain: "Operasional lain",
};

type CombinedEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  official: boolean;
  sourceLabel?: string;
  sourceUrl?: string;
  original?: CompanyCalendarEvent;
};

const EMPTY_FORM: CompanyCalendarEventInput = {
  title: "",
  description: "",
  category: "operasional_lain",
  status: "rencana",
  start_date: "2026-01-01",
  end_date: "2026-01-01",
  audience: "Semua tim",
};

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", options ?? { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function dateRangeLabel(start: string, end: string) {
  if (start === end) return formatDate(start);
  return `${formatDate(start, { day: "numeric", month: "short" })} – ${formatDate(end)}`;
}

function eventTouchesDate(event: CombinedEvent, date: string) {
  return event.startDate <= date && event.endDate >= date;
}

function eventTouchesMonth(event: CombinedEvent, year: number, monthIndex: number) {
  const start = isoDate(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const end = isoDate(year, monthIndex, lastDay);
  return event.startDate <= end && event.endDate >= start;
}

function toCombinedOfficial(event: OfficialCalendarEvent): CombinedEvent {
  return {
    id: event.id,
    title: event.title,
    startDate: event.date,
    endDate: event.date,
    category: event.kind,
    status: "resmi",
    official: true,
    sourceLabel: event.sourceLabel,
    sourceUrl: event.sourceUrl,
  };
}

function toCombinedCompany(event: CompanyCalendarEvent): CombinedEvent {
  return {
    id: event.id,
    title: event.title,
    startDate: event.start_date,
    endDate: event.end_date,
    category: event.category,
    status: event.status,
    official: false,
    original: event,
  };
}

function categoryLabel(event: CombinedEvent) {
  if (event.category === "national_holiday") return "Libur nasional";
  if (event.category === "joint_leave") return "Cuti bersama · keputusan perusahaan";
  return CATEGORY_LABELS[event.category as CompanyEventCategory] ?? event.category;
}

export default function KalenderOperasionalPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(YEARS.includes(currentYear) ? currentYear : 2026);
  const [events, setEvents] = useState<CompanyCalendarEvent[]>([]);
  const [mode, setMode] = useState<CalendarStorageMode>("supabase");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyCalendarEvent | null>(null);
  const [form, setForm] = useState<CompanyCalendarEventInput>(EMPTY_FORM);

  const canManage = user?.username?.toLowerCase() === "faisal";
  const officialEvents = useMemo(() => officialHolidaysForYear(year), [year]);
  const officialSource = officialSourceForYear(year);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadCompanyCalendarEvents(year);
      setEvents(result.events);
      setMode(result.mode);
    } catch (loadError) {
      console.error("Gagal memuat kalender operasional", loadError);
      setError("Agenda perusahaan belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setSelectedDate(null);
  }, [year]);

  const allEvents = useMemo<CombinedEvent[]>(() => [
    ...officialEvents.map(toCombinedOfficial),
    ...events.map(toCombinedCompany),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, "id")), [events, officialEvents]);

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    return allEvents.filter((event) => {
      const matchesCategory = categoryFilter === "all"
        || (categoryFilter === "official" && event.official)
        || event.category === categoryFilter;
      const matchesQuery = !normalized
        || `${event.title} ${categoryLabel(event)}`.toLocaleLowerCase("id-ID").includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [allEvents, categoryFilter, query]);

  const selectedDateEvents = useMemo(
    () => selectedDate ? visibleEvents.filter((event) => eventTouchesDate(event, selectedDate)) : [],
    [selectedDate, visibleEvents],
  );

  const upcomingEvents = useMemo(() => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
    const threshold = year === Number(today.slice(0, 4)) ? today : `${year}-01-01`;
    return visibleEvents
      .filter((event) => event.endDate >= threshold && event.status !== "dibatalkan")
      .slice(0, 6);
  }, [visibleEvents, year]);

  const openCreate = (date?: string) => {
    if (!canManage) return;
    const defaultDate = date ?? (year === currentYear
      ? new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" })
      : `${year}-01-01`);
    setEditing(null);
    setForm({ ...EMPTY_FORM, start_date: defaultDate, end_date: defaultDate });
    setModalOpen(true);
  };

  const openEdit = (event: CompanyCalendarEvent) => {
    if (!canManage) return;
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description,
      category: event.category,
      status: event.status,
      start_date: event.start_date,
      end_date: event.end_date,
      audience: event.audience,
    });
    setModalOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !canManage) return;
    if (!form.title.trim()) {
      setError("Judul agenda wajib diisi.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveCompanyCalendarEvent({ ...form, title: form.title.trim() }, user, mode, editing?.id);
      setModalOpen(false);
      await reload();
    } catch (saveError) {
      console.error("Gagal menyimpan agenda", saveError);
      setError("Agenda gagal disimpan. Pastikan akun Faisal aktif dan SQL kalender sudah tersedia.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !canManage || !window.confirm(`Hapus agenda “${editing.title}”?`)) return;
    setSaving(true);
    try {
      await deleteCompanyCalendarEvent(editing.id, mode);
      setModalOpen(false);
      await reload();
    } catch (deleteError) {
      console.error("Gagal menghapus agenda", deleteError);
      setError("Agenda gagal dihapus.");
    } finally {
      setSaving(false);
    }
  };

  const nationalCount = officialEvents.filter((event) => event.kind === "national_holiday").length;
  const jointLeaveCount = officialEvents.filter((event) => event.kind === "joint_leave").length;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>OPERASIONAL CV TOTO</span>
          <h1>Kalender Operasional</h1>
          <p>Satukan hari libur resmi, keputusan perusahaan, payroll, dan agenda tim dalam satu rencana kerja.</p>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={styles.refreshButton} onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spinning : ""} /> Muat ulang
          </button>
          {canManage && (
            <button type="button" className={styles.primaryButton} onClick={() => openCreate()}>
              <Plus size={17} /> Tambah agenda
            </button>
          )}
        </div>
      </section>

      {mode === "preview" && (
        <div className={styles.previewBanner} role="status">
          <Clock3 size={18} />
          <div>
            <strong>Mode pratinjau lokal</strong>
            <span>Agenda yang dibuat hanya tersimpan di browser ini. Jalankan SQL kalender sebelum dipakai bersama tim.</span>
          </div>
        </div>
      )}
      {error && <div className={styles.errorBanner}>{error}</div>}

      <section className={styles.yearRail} aria-label="Pilih tahun kalender">
        <button type="button" className={styles.yearArrow} onClick={() => setYear(Math.max(YEARS[0], year - 1))} disabled={year === YEARS[0]} aria-label="Tahun sebelumnya">
          <ChevronLeft size={18} />
        </button>
        {YEARS.map((item) => (
          <button key={item} type="button" onClick={() => setYear(item)} className={item === year ? styles.activeYear : ""}>
            <span>{item}</span>
            <small>{item <= 2027 ? "Resmi" : "Menunggu SKB"}</small>
          </button>
        ))}
        <button type="button" className={styles.yearArrow} onClick={() => setYear(Math.min(YEARS.at(-1)!, year + 1))} disabled={year === YEARS.at(-1)} aria-label="Tahun berikutnya">
          <ChevronRight size={18} />
        </button>
      </section>

      <section className={styles.overviewGrid}>
        <div className={styles.statCard}>
          <span>Libur nasional</span>
          <strong>{officialSource ? nationalCount : "—"}</strong>
          <small>{officialSource ? "tanggal resmi pemerintah" : "belum ditetapkan"}</small>
        </div>
        <div className={styles.statCard}>
          <span>Cuti bersama</span>
          <strong>{officialSource ? jointLeaveCount : "—"}</strong>
          <small>perlu keputusan perusahaan</small>
        </div>
        <div className={styles.statCard}>
          <span>Agenda perusahaan</span>
          <strong>{events.length}</strong>
          <small>{events.filter((event) => event.status === "dikonfirmasi").length} sudah dikonfirmasi</small>
        </div>
        <div className={`${styles.sourceCard} ${!officialSource ? styles.pendingSource : ""}`}>
          <ShieldCheck size={21} />
          <div>
            <strong>{officialSource ? "Referensi pemerintah terkunci" : "Menunggu SKB resmi pemerintah"}</strong>
            {officialSource ? (
              <a href={officialSource.url} target="_blank" rel="noreferrer">
                {officialSource.label} <ExternalLink size={13} />
              </a>
            ) : (
              <span>Kalender tetap dapat diisi agenda internal tanpa mengarang tanggal libur nasional.</span>
            )}
          </div>
        </div>
      </section>

      <section className={styles.runway}>
        <div className={styles.runwayHeader}>
          <div>
            <span className={styles.eyebrow}>OPERATIONAL RUNWAY</span>
            <h2>{selectedDate ? `Agenda ${formatDate(selectedDate)}` : "Agenda berikutnya"}</h2>
          </div>
          {selectedDate && <button type="button" onClick={() => setSelectedDate(null)}>Tampilkan agenda berikutnya</button>}
        </div>
        <div className={styles.timeline}>
          {(selectedDate ? selectedDateEvents : upcomingEvents).length === 0 ? (
            <div className={styles.emptyAgenda}>Belum ada agenda pada pilihan ini.</div>
          ) : (selectedDate ? selectedDateEvents : upcomingEvents).map((event) => (
            <button
              type="button"
              key={event.id}
              className={`${styles.timelineItem} ${styles[`category_${event.category}`] ?? ""}`}
              onClick={() => event.original && openEdit(event.original)}
              disabled={!event.original || !canManage}
            >
              <span className={styles.timelineDate}>{formatDate(event.startDate, { day: "2-digit", month: "short" })}</span>
              <span className={styles.timelineCopy}>
                <strong>{event.title}</strong>
                <small>{categoryLabel(event)} · {dateRangeLabel(event.startDate, event.endDate)}</small>
              </span>
              {event.official ? <ShieldCheck size={16} /> : canManage ? <Pencil size={15} /> : <CheckCircle2 size={16} />}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.toolbar}>
        <div>
          <h2>Kalender {year}</h2>
          <p>Klik tanggal untuk melihat agenda pada hari tersebut.</p>
        </div>
        <div className={styles.filters}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari agenda…" aria-label="Cari agenda kalender" />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter kategori agenda">
            <option value="all">Semua kategori</option>
            <option value="official">Hari resmi pemerintah</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </section>

      <section className={styles.calendarGrid} aria-busy={loading}>
        {MONTHS.map((month, monthIndex) => {
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
          const monthEvents = visibleEvents.filter((event) => eventTouchesMonth(event, year, monthIndex));
          const cells = Array.from({ length: 42 }, (_, index) => {
            const day = index - offset + 1;
            return day >= 1 && day <= daysInMonth ? day : null;
          });
          return (
            <article key={month} className={styles.monthCard}>
              <header>
                <h3>{month}</h3>
                <span>{monthEvents.length} agenda</span>
              </header>
              <div className={styles.weekdays}>
                {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className={styles.days}>
                {cells.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} className={styles.emptyDay} />;
                  const date = isoDate(year, monthIndex, day);
                  const dayEvents = allEvents.filter((event) => eventTouchesDate(event, date));
                  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
                  const isSunday = index % 7 === 6;
                  return (
                    <button
                      type="button"
                      key={date}
                      onClick={() => setSelectedDate(date === selectedDate ? null : date)}
                      onDoubleClick={() => openCreate(date)}
                      className={[
                        isSunday ? styles.sunday : "",
                        date === today ? styles.today : "",
                        date === selectedDate ? styles.selectedDay : "",
                        dayEvents.some((event) => event.category === "national_holiday") ? styles.holidayDay : "",
                      ].filter(Boolean).join(" ")}
                      title={dayEvents.map((event) => event.title).join("\n") || (canManage ? "Klik dua kali untuk tambah agenda" : "")}
                    >
                      <span>{day}</span>
                      <i className={styles.dots}>
                        {dayEvents.slice(0, 3).map((event) => <i key={event.id} className={styles[`dot_${event.category}`] ?? styles.dot_company} />)}
                      </i>
                    </button>
                  );
                })}
              </div>
              <div className={styles.monthAgenda}>
                {monthEvents.length === 0 ? <span>Tidak ada agenda</span> : monthEvents.slice(0, 4).map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => event.original ? openEdit(event.original) : setSelectedDate(event.startDate)}
                    className={styles[`category_${event.category}`] ?? ""}
                  >
                    <time>{formatDate(event.startDate, { day: "2-digit" })}</time>
                    <span>{event.title}</span>
                  </button>
                ))}
                {monthEvents.length > 4 && <small>+{monthEvents.length - 4} agenda lainnya</small>}
              </div>
            </article>
          );
        })}
      </section>

      <footer className={styles.legend}>
        <span><i className={styles.dot_national_holiday} /> Libur nasional</span>
        <span><i className={styles.dot_joint_leave} /> Cuti bersama</span>
        <span><i className={styles.dot_company} /> Agenda perusahaan</span>
        <small>Cuti bersama pemerintah tidak otomatis berarti perusahaan libur; Faisal dapat mencatat keputusan perusahaan sebagai agenda terpisah.</small>
      </footer>

      {modalOpen && canManage && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="calendar-form-title">
            <header>
              <div>
                <span className={styles.eyebrow}>KHUSUS MANAGER</span>
                <h2 id="calendar-form-title">{editing ? "Edit agenda" : "Tambah agenda perusahaan"}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Tutup formulir"><X size={20} /></button>
            </header>
            <form onSubmit={submit}>
              <label className={styles.fullField}>
                <span>Judul agenda</span>
                <input autoFocus value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Contoh: Pembayaran THR 2027" maxLength={160} />
              </label>
              <div className={styles.formRow}>
                <label>
                  <span>Kategori</span>
                  <select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value as CompanyEventCategory }))}>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as CompanyCalendarEventInput["status"] }))}>
                    <option value="rencana">Rencana</option>
                    <option value="dikonfirmasi">Dikonfirmasi</option>
                    <option value="dibatalkan">Dibatalkan</option>
                  </select>
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  <span>Tanggal mulai</span>
                  <input type="date" min="2026-01-01" max="2030-12-31" value={form.start_date} onChange={(event) => setForm((value) => ({ ...value, start_date: event.target.value, end_date: value.end_date < event.target.value ? event.target.value : value.end_date }))} />
                </label>
                <label>
                  <span>Tanggal selesai</span>
                  <input type="date" min={form.start_date} max="2030-12-31" value={form.end_date} onChange={(event) => setForm((value) => ({ ...value, end_date: event.target.value }))} />
                </label>
              </div>
              <label className={styles.fullField}>
                <span>Peserta / unit terkait</span>
                <input value={form.audience} onChange={(event) => setForm((value) => ({ ...value, audience: event.target.value }))} placeholder="Semua tim, Finance, Produksi…" />
              </label>
              <label className={styles.fullField}>
                <span>Catatan operasional</span>
                <textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="Keputusan, persiapan, PIC, atau catatan yang perlu diketahui tim." rows={4} />
              </label>
              <div className={styles.modalActions}>
                {editing && <button type="button" className={styles.deleteButton} onClick={() => void remove()} disabled={saving}><Trash2 size={16} /> Hapus</button>}
                <span />
                <button type="button" className={styles.cancelButton} onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Menyimpan…" : "Simpan agenda"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
