import { CalendarClock, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { COURSE_STATUS, EXAM_KIND } from '../../constants';
import { Field, ProgressBar } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { confirmAction, run } from '../../store/useUI';
import type { Course, CourseStatus, Exam, ExamKind } from '../../types';
import { daysBetween, fmtMinutes, longDate, shortDate, weekDays } from '../../utils/date';

const STATUS = COURSE_STATUS;

type Edit = { t: 'course'; id?: string } | { t: 'exam'; id?: string; courseId?: string } | null;

export default function Courses() {
  const { courses, exams, sessions } = useStore();
  const today = useStore((s) => s.today());
  const [edit, setEdit] = useState<Edit>(null);
  const [showPast, setShowPast] = useState(false);

  const week = weekDays(today);
  const minutes = useMemo(() => {
    const total: Record<string, number> = {};
    const thisWeek: Record<string, number> = {};
    for (const s of sessions) {
      const k = s.courseId ?? '_';
      total[k] = (total[k] ?? 0) + s.minutes;
      if (week.includes(s.date)) thisWeek[k] = (thisWeek[k] ?? 0) + s.minutes;
    }
    return { total, thisWeek, weekSum: Object.values(thisWeek).reduce((a, b) => a + b, 0) };
  }, [sessions, week]);

  const upcoming = exams.filter((e) => e.date >= today);
  const past = exams.filter((e) => e.date < today).reverse();
  const passed = courses.filter((c) => c.status === 'passed').length;
  const semesters = Array.from(new Set(courses.map((c) => c.semester ?? 0))).sort((a, b) => (a || 9) - (b || 9));
  const courseName = (e: Exam) => courses.find((c) => c.id === e.courseId)?.name ?? e.title ?? 'Sınav';

  return (
    <div className="space-y-5">
      {/* Özet */}
      {courses.length > 0 && (
        <section className="now-card space-y-3">
          <p className="eyebrow">İlerleme</p>
          <p className="text-3xl font-extrabold num">{passed} <span className="text-lg text-text-muted font-semibold">/ {courses.length} ders geçti</span></p>
          <ProgressBar pct={(passed / courses.length) * 100} color="var(--accent-base)" height={6} />
          <p className="text-sm text-text-muted">Bu hafta <b className="text-text-main">{fmtMinutes(minutes.weekSum)}</b> ders çalıştın.</p>
        </section>
      )}

      {/* Sınavlar */}
      <section className="widget">
        <div className="widget-header">
          <h3><CalendarClock size={16} /> Sınavlar</h3>
          <button className="widget-link" onClick={() => setEdit({ t: 'exam' })}><Plus size={13} className="inline -mt-0.5" /> Ekle</button>
        </div>
        <div className="px-2 pb-3 sm:px-3">
          {upcoming.length === 0 && <p className="text-sm text-text-muted px-3 pb-2">Yaklaşan sınav yok.</p>}
          {upcoming.map((e) => {
            const d = daysBetween(today, e.date);
            return (
              <button key={e.id} onClick={() => setEdit({ t: 'exam', id: e.id })} className="row-item w-full text-left min-h-0">
                <span className="w-11 h-11 rounded-xl bg-surface-el flex flex-col items-center justify-center leading-none shrink-0">
                  <span className="text-sm font-extrabold num">{Number(e.date.slice(8))}</span>
                  <span className="text-[9px] uppercase text-text-muted mt-0.5">{shortDate(e.date).split(' ')[1]}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold truncate">{courseName(e)} · {EXAM_KIND[e.kind]}</span>
                  <span className="block text-xs text-text-muted truncate">{[e.time, e.place].filter(Boolean).join(' · ') || longDate(e.date)}</span>
                </span>
                <span className="text-sm font-semibold num shrink-0">{d === 0 ? 'Bugün' : d === 1 ? 'Yarın' : `${d} gün`}</span>
              </button>
            );
          })}
          {past.length > 0 && (
            <button onClick={() => setShowPast(!showPast)} className="text-xs font-semibold text-text-muted px-3" style={{ minHeight: 32 }}>
              {showPast ? 'Geçmiş sınavları gizle' : `Geçmiş sınavlar (${past.length})`}
            </button>
          )}
          {showPast && past.map((e) => (
            <button key={e.id} onClick={() => setEdit({ t: 'exam', id: e.id })} className="row-item w-full text-left min-h-0 opacity-75">
              <span className="text-xs text-text-muted num w-14 shrink-0">{shortDate(e.date)}</span>
              <span className="flex-1 text-sm truncate">{courseName(e)} · {EXAM_KIND[e.kind]}</span>
              {e.grade && <span className="text-sm font-bold num">{e.grade}</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Dersler (dönemlere göre) */}
      <section className="widget">
        <div className="widget-header">
          <h3><GraduationCap size={16} /> Dersler</h3>
          <button className="widget-link" onClick={() => setEdit({ t: 'course' })}><Plus size={13} className="inline -mt-0.5" /> Ekle</button>
        </div>
        <div className="px-2 pb-3 sm:px-3">
          {courses.length === 0 && (
            <p className="text-sm text-text-muted px-3 pb-2">Kalan derslerini ekle; dönemlere dağıtıp hangisinin geçtiğini işaretleyebilirsin. Ders çalışma sayacında da hangi dersi çalıştığını seçersin.</p>
          )}
          {semesters.map((sem) => (
            <div key={sem} className="mb-2">
              <p className="slot-label">{sem ? `${sem}. dönem` : 'Dönemi belli değil'}</p>
              {courses.filter((c) => (c.semester ?? 0) === sem).map((c) => (
                <button key={c.id} onClick={() => setEdit({ t: 'course', id: c.id })} className="row-item w-full text-left min-h-0">
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[15px] font-semibold truncate ${c.status === 'passed' ? 'text-text-muted' : ''}`}>{c.name}{c.code ? <span className="text-text-muted font-medium"> · {c.code}</span> : null}</span>
                    <span className="block text-xs text-text-muted">
                      {minutes.total[c.id] ? `${fmtMinutes(minutes.total[c.id])} çalışıldı` : 'Henüz çalışma kaydı yok'}
                      {minutes.thisWeek[c.id] ? ` · bu hafta ${fmtMinutes(minutes.thisWeek[c.id])}` : ''}
                    </span>
                  </span>
                  <span className={`pill shrink-0 ${c.status === 'passed' ? 'active' : ''}`} style={{ minHeight: 28, padding: '3px 10px' }}>{STATUS[c.status]}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title={edit?.t === 'course' ? (edit.id ? 'Dersi düzenle' : 'Yeni ders') : edit?.id ? 'Sınavı düzenle' : 'Yeni sınav'}>
        {edit?.t === 'course' && <CourseForm key={edit.id ?? 'new'} id={edit.id} onDone={() => setEdit(null)} onAddExam={(courseId) => setEdit({ t: 'exam', courseId })} />}
        {edit?.t === 'exam' && <ExamForm key={edit.id ?? 'new'} id={edit.id} courseId={edit.courseId} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

function CourseForm({ id, onDone, onAddExam }: { id?: string; onDone: () => void; onAddExam: (courseId: string) => void }) {
  const { courses, saveItem, removeItem } = useStore();
  const c = id ? courses.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(c?.name ?? '');
  const [code, setCode] = useState(c?.code ?? '');
  const [semester, setSemester] = useState<number>(c?.semester ?? 0);
  const [status, setStatus] = useState<CourseStatus>(c?.status ?? 'planned');
  const [note, setNote] = useState(c?.note ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data: Partial<Course> = { name: name.trim(), code: code.trim(), semester, status, note: note.trim(), ...(status === 'passed' && c?.status !== 'passed' ? { passedAt: useStore.getState().today() } : {}) };
    if (!c) Object.assign(data, { order: courses.length, createdAt: Date.now() });
    if (await run(() => saveItem<Course>('courses', data, c?.id), c ? 'Kaydedildi' : 'Ders eklendi')) onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Ders adı"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör: Devre Analizi II" autoFocus={!c} /></Field>
        <Field label="Kod"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="EEM202" /></Field>
      </div>
      <Field label="Dönem">
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 4, 0].map((n) => (
            <button type="button" key={n} onClick={() => setSemester(n)} className={`pill ${semester === n ? 'active' : ''}`}>{n ? `${n}. dönem` : 'Belli değil'}</button>
          ))}
        </div>
      </Field>
      <Field label="Durum">
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(STATUS) as CourseStatus[]).map((s) => (
            <button type="button" key={s} onClick={() => setStatus(s)} className={`pill ${status === s ? 'active' : ''}`}>{STATUS[s]}</button>
          ))}
        </div>
      </Field>
      <Field label="Not (isteğe bağlı)"><textarea className="input min-h-[60px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hoca, kaynak kitap, devam zorunluluğu…" /></Field>
      <div className="space-y-2">
        <button type="submit" disabled={!name.trim()} className="btn btn-primary w-full">{c ? 'Kaydet' : 'Ekle'}</button>
        {c && <button type="button" onClick={() => onAddExam(c.id)} className="btn btn-ghost w-full"><CalendarClock size={16} /> Bu derse sınav ekle</button>}
        {c && (
          <button type="button" onClick={async () => {
            if (await confirmAction({ title: `"${c.name}" silinsin mi?`, message: 'Dersin sınavları ve çalışma kayıtları korunur.', confirmLabel: 'Sil', danger: true })
              && await run(() => removeItem('courses', c.id), 'Silindi')) onDone();
          }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
        )}
      </div>
    </form>
  );
}

function ExamForm({ id, courseId, onDone }: { id?: string; courseId?: string; onDone: () => void }) {
  const { exams, courses, saveItem, removeItem } = useStore();
  const today = useStore((s) => s.today());
  const ex = id ? exams.find((x) => x.id === id) : undefined;
  const [course, setCourse] = useState(ex?.courseId ?? courseId ?? '');
  const [title, setTitle] = useState(ex?.title ?? '');
  const [kind, setKind] = useState<ExamKind>(ex?.kind ?? 'vize');
  const [date, setDate] = useState(ex?.date ?? today);
  const [time, setTime] = useState(ex?.time ?? '');
  const [place, setPlace] = useState(ex?.place ?? '');
  const [grade, setGrade] = useState(ex?.grade ?? '');
  const valid = !!date && (!!course || !!title.trim());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const data: Partial<Exam> = { courseId: course || undefined, title: title.trim(), kind, date, time, place: place.trim(), grade: grade.trim() };
    if (!ex) data.createdAt = Date.now();
    if (await run(() => saveItem<Exam>('exams', data, ex?.id), ex ? 'Kaydedildi' : 'Sınav eklendi')) onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Ders">
        {courses.length ? (
          <div className="flex gap-1.5 flex-wrap">
            {courses.filter((c) => c.status !== 'passed' || c.id === course).map((c) => (
              <button type="button" key={c.id} onClick={() => setCourse(c.id)} className={`pill ${course === c.id ? 'active' : ''}`}>{c.name}</button>
            ))}
          </div>
        ) : <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ders / sınav adı" />}
      </Field>
      <Field label="Tür">
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(EXAM_KIND) as ExamKind[]).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={`pill ${kind === k ? 'active' : ''}`}>{EXAM_KIND[k]}</button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tarih"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Saat"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Yer (isteğe bağlı)"><input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="B-204" /></Field>
        <Field label="Not / sonuç"><input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Ör: 78, BB" /></Field>
      </div>
      <div className="space-y-2">
        <button type="submit" disabled={!valid} className="btn btn-primary w-full">{ex ? 'Kaydet' : 'Ekle'}</button>
        {ex && (
          <button type="button" onClick={async () => { if (await run(() => removeItem('exams', ex.id), 'Silindi')) onDone(); }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
        )}
      </div>
    </form>
  );
}
