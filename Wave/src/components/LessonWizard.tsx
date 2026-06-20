/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wand2, CheckCircle2, Edit3, Trash2, X, Plus } from 'lucide-react';
import { StudentUser, TeacherRemediationMaterial, StudentProgress } from '../types';
import { GeneratedRemediation, GenerateRemediationReq } from '../repo/repository';
import { MOCK_LESSONS, MOCK_LESSONS_BY_SUBJECT } from '../data';
import WaveLogo from './WaveLogo';

interface LessonWizardProps {
  onPublish: (material: TeacherRemediationMaterial) => void;
  onGenerateRemediation: (req: GenerateRemediationReq) => Promise<GeneratedRemediation>;
  onClose: () => void;
  students?: StudentUser[];
  activeSubject?: string;
  activeSection?: string;
  // Kept for compatibility with the caller; not used by the lesson generator.
  preSelectedStudent?: StudentUser | null;
  preSelectedTopicId?: string;
  progressRecords?: Record<string, StudentProgress>;
}

const SUBJECTS: { key: string; label: string }[] = [
  { key: 'science', label: 'Science' },
  { key: 'mathematics', label: 'Mathematics' },
  { key: 'english', label: 'English' },
];

export default function LessonWizard({
  onPublish,
  onGenerateRemediation,
  onClose,
  students = [],
  activeSubject = 'science',
  activeSection = 'All Sections',
}: LessonWizardProps) {

  // ── Roster-derived options ─────────────────────────────────────────────
  const gradeLevels = useMemo(
    () => Array.from(new Set(students.map((s) => s.gradeLevel).filter(Boolean))),
    [students],
  );

  // Defaults: prefer the grade implied by the active section, else first roster grade.
  const initialGrade =
    gradeLevels.find((g) => activeSection.startsWith(g)) || gradeLevels[0] || 'Grade 6';

  const [gradeLevel, setGradeLevel] = useState<string>(initialGrade);
  const [subject, setSubject] = useState<string>(activeSubject || 'science');

  const sectionsForGrade = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((s) => s.gradeLevel === gradeLevel)
            .map((s) => s.section)
            .filter(Boolean),
        ),
      ) as string[],
    [students, gradeLevel],
  );

  const initialSection =
    (activeSection !== 'All Sections' && activeSection) || sectionsForGrade[0] || '';
  const [section, setSection] = useState<string>(initialSection);

  // Keep section valid when grade changes.
  useEffect(() => {
    if (!sectionsForGrade.includes(section)) {
      setSection(sectionsForGrade[0] || '');
    }
  }, [gradeLevel, sectionsForGrade]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Catalog (lesson + topics) ──────────────────────────────────────────
  const availableLessons = subject ? MOCK_LESSONS_BY_SUBJECT[subject] || [] : MOCK_LESSONS;
  const [selectedLessonId, setSelectedLessonId] = useState<string>(availableLessons[0]?.id || '');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string>('');

  const lessonTopics = availableLessons.find((l) => l.id === selectedLessonId)?.topics || [];

  // Reset lesson/topics when the subject changes.
  useEffect(() => {
    const lessons = MOCK_LESSONS_BY_SUBJECT[subject] || [];
    setSelectedLessonId(lessons[0]?.id || '');
    setSelectedTopicIds([]);
  }, [subject]);

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((t) => t !== topicId) : [...prev, topicId],
    );
  };

  const handleLessonChange = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedTopicIds([]);
  };

  const canGenerate = selectedTopicIds.length > 0 || prompt.trim().length > 0;

  // ── Wizard steps & generated lesson state (lesson parts only, no quiz) ──
  const [step, setStep] = useState<'setup' | 'generating' | 'preview' | 'edit' | 'published'>('setup');
  const [genPercentage, setGenPercentage] = useState(0);
  const [genStatusMessage, setGenStatusMessage] = useState('Initiating lesson architect...');

  const [lessonNumber, setLessonNumber] = useState<number>(1);
  const [title, setTitle] = useState('');
  const [learningGap, setLearningGap] = useState('');
  const [teachersNotes, setTeachersNotes] = useState<string[]>([]);
  const [sections, setSections] = useState<{ title: string; body: string }[]>([]);

  // ── Generation ─────────────────────────────────────────────────────────
  const triggerGenerationFlow = () => {
    if (!canGenerate) return;
    setStep('generating');
    setGenPercentage(15);
    setGenStatusMessage('Connecting to Wave AI lesson generator...');
  };

  useEffect(() => {
    if (step !== 'generating') return;
    onGenerateRemediation({
      subject,
      gradeLevel,
      section,
      topicIds: selectedTopicIds,
      topicId: selectedTopicIds[0],
      prompt: prompt.trim() || undefined,
    })
      .then((result) => {
        setGenPercentage(100);
        setLessonNumber(result.lessonNumber ?? 1);
        setTitle(result.title || 'Generated Lesson');
        setLearningGap(result.learningGap || '');
        setTeachersNotes(result.teachersNotes || []);
        const secs =
          result.sections && result.sections.length > 0
            ? result.sections
            : result.content
              ? [{ title: 'Content', body: result.content }]
              : [{ title: 'Introduction', body: '' }];
        setSections(secs);
        setStep('preview');
      })
      .catch((err) => {
        setGenStatusMessage(
          `Generation failed: ${err.message}. Check that the server is reachable and (for real AI) GEMINI_API_KEY is set.`,
        );
        setGenPercentage(0);
      });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section (module) editing helpers ───────────────────────────────────
  const updateSection = (idx: number, key: 'title' | 'body', val: string) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: val } : s)));
  };
  const addSection = () =>
    setSections((prev) => [...prev, { title: `Module ${prev.length + 1}`, body: '' }]);
  const removeSection = (idx: number) => setSections((prev) => prev.filter((_, i) => i !== idx));

  // ── Publish (lesson only — no quiz) ────────────────────────────────────
  const handlePublish = () => {
    const content = sections.map((s) => `## ${s.title}\n${s.body}`).join('\n\n');
    const gapSection = learningGap ? `**Learning Gap:** ${learningGap}` : '';
    const notesSection = teachersNotes.length > 0 ? teachersNotes.map((n) => `• ${n}`).join('\n') : '';
    const combinedNotes = [gapSection, notesSection].filter(Boolean).join('\n\n');

    const material: TeacherRemediationMaterial = {
      id: `REM-${Date.now().toString(36).toUpperCase()}`,
      originalTopicId: selectedTopicIds[0] || '',
      title: `Lesson ${lessonNumber}: ${title}`,
      content,
      teacherNotes: combinedNotes,
      createdQuiz: [], // lesson-only generator — no quiz
      publishDate: new Date().toISOString().split('T')[0],
      targetSection: section,
      targetSubject: subject,
      isPublished: true,
    };
    onPublish(material);
    setStep('published');
  };

  const inputCls =
    'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100 max-w-4xl w-full"
      >
        {/* Banner */}
        <div className="bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#10B981] p-6 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base">Copilot Lesson Generator</h2>
              <p className="text-[10px] text-blue-100 uppercase tracking-widest font-extrabold mt-0.5">AI Lesson Architect</p>
            </div>
          </div>
          <button type="button" id="close-wizard-btn" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ───────────── STEP 1: SETUP ───────────── */}
        {step === 'setup' && (
          <div className="p-6 sm:p-8 space-y-6 max-h-[560px] overflow-y-auto">
            <h3 className="font-display font-semibold text-sm text-slate-800 uppercase tracking-wide">1. Configure the lesson to generate</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Grade level */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Grade Level</label>
                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={inputCls}>
                  {gradeLevels.length === 0 && <option value={gradeLevel}>{gradeLevel}</option>}
                  {gradeLevels.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Section</label>
                <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls}>
                  {sectionsForGrade.length === 0 && <option value="">No sections for this grade</option>}
                  {sectionsForGrade.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls}>
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Lesson */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lesson</label>
                <select value={selectedLessonId} onChange={(e) => handleLessonChange(e.target.value)} className={inputCls}>
                  {availableLessons.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Topics (multi-select) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Topics <span className="text-slate-300 normal-case">(choose one or more)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {lessonTopics.length === 0 && <p className="text-xs text-slate-400 italic px-2 py-1">No topics in this lesson.</p>}
                {lessonTopics.map((t) => {
                  const checked = selectedTopicIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${checked ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTopic(t.id)}
                        className="h-4 w-4 accent-blue-600 cursor-pointer shrink-0"
                      />
                      <span className="text-xs font-semibold text-slate-700 truncate">{t.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Prompt <span className="text-slate-300 normal-case">(what should the lesson be about?)</span>
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Create an engaging introduction to the water cycle with real-world Filipino examples."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Pick topics, write a prompt, or both. At least one is required.</p>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold">Cancel</button>
              <button
                type="button"
                id="generate-material-btn"
                onClick={triggerGenerationFlow}
                disabled={!canGenerate}
                className="px-4.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Wand2 className="h-4 w-4" /> Generate Lesson
              </button>
            </div>
          </div>
        )}

        {/* ───────────── STEP 2: GENERATING ───────────── */}
        {step === 'generating' && (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="inline-flex h-20 w-20 bg-slate-50 border border-slate-100 rounded-2xl items-center justify-center animate-pulse shadow p-3">
              <WaveLogo size={62} />
            </div>
            <div className="space-y-2 max-w-sm mx-auto">
              <h3 className="font-display font-semibold text-slate-800 text-sm">Wave AI is writing your lesson...</h3>
              <p className="text-slate-400 text-[11px] min-h-[16px] transition-all">{genStatusMessage}</p>
            </div>
            <div className="max-w-xs mx-auto space-y-1.5">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${genPercentage}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-bold block">{genPercentage}% processed</span>
            </div>
          </div>
        )}

        {/* ───────────── STEP 3: PREVIEW ───────────── */}
        {step === 'preview' && (
          <div className="p-6 sm:p-8 space-y-6 max-h-[480px] overflow-y-auto">
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">✓ Generation Success</span>
              <button type="button" id="go-edit-remedial" onClick={() => setStep('edit')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Edit3 className="h-3.5 w-3.5" /> Polish Content
              </button>
            </div>

            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest">Lesson Title</span>
              <h3 className="font-display font-bold text-base text-slate-800">Lesson {lessonNumber}: {title}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{subject.toUpperCase()} • {section || gradeLevel}</p>
            </div>

            {learningGap && (
              <div className="space-y-1 bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-xs">
                <span className="block text-[10px] text-amber-800 uppercase font-black tracking-widest">Learning Gap Addressed</span>
                <p className="text-slate-700 font-medium leading-relaxed">{learningGap}</p>
              </div>
            )}

            {teachersNotes.length > 0 && (
              <div className="space-y-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs">
                <span className="block text-[10px] text-slate-450 uppercase font-black tracking-widest">Teacher's Notes</span>
                <ul className="list-disc pl-4 text-slate-650 space-y-1 mt-1 font-medium leading-relaxed">
                  {teachersNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest">Interactive Modules ({sections.length})</span>
              {sections.map((s, i) => (
                <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
                  <p className="font-bold text-xs text-slate-700">{s.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line mt-1">{s.body}</p>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-between gap-3">
              <button type="button" onClick={() => setStep('setup')} className="px-4.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 font-bold rounded-xl text-xs flex items-center gap-1">
                <Trash2 className="h-4 w-4" /> Discard
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep('setup')} className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold">Reconfigure</button>
                <button type="button" id="confirm-publish-remedi" onClick={handlePublish} className="px-4.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow">
                  <CheckCircle2 className="h-4 w-4" /> Publish to Section
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── STEP 4: EDIT ───────────── */}
        {step === 'edit' && (
          <div className="p-6 sm:p-8 space-y-6 max-h-[520px] overflow-y-auto bg-slate-50/40">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-extrabold text-sm text-slate-800 flex items-center gap-2"><Edit3 className="h-4.5 w-4.5 text-blue-600" /> Lesson Editor</h3>
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Refine the AI draft</span>
            </div>

            {/* Basic info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5"><Edit3 className="h-3.5 w-3.5 text-blue-500" /> Basic Information</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lesson #</label>
                  <input type="number" value={lessonNumber} onChange={(e) => setLessonNumber(parseInt(e.target.value) || 1)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-center shadow-sm" />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lesson Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" />
                </div>
              </div>
            </div>

            {/* Gap & notes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Gap & Objectives</h4>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Learning Gap Addressed</label>
                <textarea rows={2} value={learningGap} onChange={(e) => setLearningGap(e.target.value)} placeholder="Describe the learning gap or objective..." className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-650 leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Teacher's Notes</span>
                  <button type="button" onClick={() => setTeachersNotes([...teachersNotes, 'New note...'])} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"><Plus className="h-3.5 w-3.5" /> Append Note</button>
                </div>
                <div className="space-y-2">
                  {teachersNotes.map((note, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-bold">#{idx + 1}</span>
                      <input type="text" value={note} onChange={(e) => { const u = [...teachersNotes]; u[idx] = e.target.value; setTeachersNotes(u); }} className="flex-1 bg-white px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-750 font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" />
                      <button type="button" onClick={() => setTeachersNotes(teachersNotes.filter((_, i) => i !== idx))} className="p-2 text-slate-450 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive modules (sections) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5 text-indigo-500" /> Interactive Modules ({sections.length})</span>
                <button type="button" onClick={addSection} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"><Plus className="h-3.5 w-3.5" /> Append Module</button>
              </div>
              <div className="space-y-3">
                {sections.map((sec, sIdx) => (
                  <div key={sIdx} className="bg-slate-50/40 border border-slate-200 rounded-2xl p-4.5 space-y-3 relative hover:border-slate-300 transition-all">
                    <button type="button" onClick={() => removeSection(sIdx)} className="absolute top-4 right-4 p-2 text-slate-450 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                    <div className="space-y-1.5 max-w-[90%]">
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Module {sIdx + 1} Title</span>
                      <input type="text" value={sec.title} onChange={(e) => updateSection(sIdx, 'title', e.target.value)} className="w-full bg-white px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Module Content</span>
                      <textarea rows={4} value={sec.body} onChange={(e) => updateSection(sIdx, 'body', e.target.value)} className="w-full bg-white px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-5 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={() => setStep('preview')} className="px-5 py-2.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm">Back to Preview</button>
              <button type="button" id="save-edits-btn" onClick={() => setStep('preview')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 hover:shadow-lg active:scale-98 transition-all cursor-pointer">Save Changes</button>
            </div>
          </div>
        )}

        {/* ───────────── STEP 5: PUBLISHED ───────────── */}
        {step === 'published' && (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="h-16 w-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl inline-flex items-center justify-center shadow-sm"><CheckCircle2 className="h-9 w-9" /></div>
            <div className="space-y-2 max-w-sm mx-auto">
              <h1 className="font-display font-medium text-lg text-slate-900">Lesson Published!</h1>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">Your generated lesson has been published to <strong>{section || gradeLevel}</strong>. All student portals in this section have been updated.</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 max-w-sm border border-slate-200 shadow-sm mx-auto mb-6">
              <div className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lesson Summary</span></div>
              <span className="text-[10px] font-bold block text-slate-500">{subject.toUpperCase()} • {section || gradeLevel}</span>
              <h4 className="text-xs font-black text-slate-800 leading-normal">Lesson {lessonNumber}: {title}</h4>
              <p className="text-[10px] text-slate-450 leading-relaxed italic">{sections.length} interactive module{sections.length === 1 ? '' : 's'} published.</p>
            </div>
            <button type="button" id="finish-wizard-close-btn" onClick={onClose} className="w-full max-w-xs py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-0 cursor-pointer">Close wizard</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
