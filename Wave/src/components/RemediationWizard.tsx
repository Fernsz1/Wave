/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wand2, CheckCircle2, Edit3, Trash2, X, Plus } from 'lucide-react';
import { StudentUser, QuizQuestion, TeacherRemediationMaterial, StudentProgress } from '../types';
import { GeneratedRemediation, GenerateRemediationReq } from '../repo/repository';
import { MOCK_LESSONS, MOCK_LESSONS_BY_SUBJECT } from '../data';
import WaveLogo from './WaveLogo';

interface RemediationWizardProps {
  onPublish: (material: TeacherRemediationMaterial) => void;
  onGenerateRemediation: (req: GenerateRemediationReq) => Promise<GeneratedRemediation>;
  onClose: () => void;
  preSelectedStudent?: StudentUser | null;
  preSelectedTopicId?: string;
  students?: StudentUser[];
  progressRecords?: Record<string, StudentProgress>;
  activeSubject?: string;
  activeSection?: string;
}

export default function RemediationWizard({
  onPublish,
  onGenerateRemediation,
  onClose,
  preSelectedStudent = null,
  preSelectedTopicId = "",
  students = [],
  progressRecords = {},
  activeSubject = "science",
  activeSection = "All Sections"
}: RemediationWizardProps) {
  
  // Underperforming Student Calculation Based on Selected Subject & Section
  const sectionFilteredStudents = !activeSection || activeSection === 'All Sections'
    ? students
    : students.filter(s => s.gradeLevel === activeSection);

  const availableLessons = activeSubject ? (MOCK_LESSONS_BY_SUBJECT[activeSubject] || []) : MOCK_LESSONS;
  const activeTopicIds = new Set(availableLessons.flatMap(l => l.topics.map(t => t.id)));

  const underperformingStudents = sectionFilteredStudents.filter(student => {
    const prog = progressRecords[student.lrn];
    if (!prog) return false;
    return Object.values(prog.quizAttempts).some(att => {
      if (activeTopicIds.has(att.topicId)) {
        const pct = att.perfectScore > 0 ? (att.score / att.perfectScore) * 100 : 100;
        return pct < 70;
      }
      return false;
    });
  });

  const availableWizardStudents = underperformingStudents.length > 0 
    ? underperformingStudents 
    : sectionFilteredStudents;

  // Make sure pre-selected student is included
  const finalWizardStudents = [...availableWizardStudents];
  if (preSelectedStudent && !finalWizardStudents.some(s => s.lrn === preSelectedStudent.lrn)) {
    finalWizardStudents.unshift(preSelectedStudent);
  }

  // Wizard Steps:
  // 'setup'       -> Choose target student & underperforming topic
  // 'generating'  -> Mock progression loading simulator
  // 'preview'     -> View generated content and custom quizzes
  // 'edit'        -> Form with custom rich-looking editing controls to refine details
  // 'published'   -> Finish dialog
  const [step, setStep] = useState<'setup' | 'generating' | 'preview' | 'edit' | 'published'>('setup');

  const [student, setStudent] = useState<StudentUser | null>(
    preSelectedStudent || finalWizardStudents[0] || null
  );
  const [targetTopicId, setTargetTopicId] = useState<string>(
    preSelectedTopicId || availableLessons[0]?.topics[0]?.id || ""
  );

  // Lesson state & auto sync
  const initialLesson = availableLessons.find(l => l.topics.some(t => t.id === targetTopicId)) || availableLessons[0];
  const [selectedLessonId, setSelectedLessonId] = useState<string>(initialLesson?.id || "");

  // AI Generation Progress simulator variables
  const [genPercentage, setGenPercentage] = useState(0);
  const [genStatusMessage, setGenStatusMessage] = useState('Initiating analyzer pipeline...');

  // Core generated content properties in state so they are editable
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizQuestion[]>([]);
  const [generatedLessonNumber, setGeneratedLessonNumber] = useState<number>(1);
  const [generatedLearningGap, setGeneratedLearningGap] = useState('');
  const [generatedTeachersNotes, setGeneratedTeachersNotes] = useState<string[]>([]);

  // Sync selected student on preSelected/active filter updates
  useEffect(() => {
    if (preSelectedStudent) {
      setStudent(preSelectedStudent);
    } else if (finalWizardStudents.length > 0) {
      if (!student || !finalWizardStudents.some(s => s.lrn === student.lrn)) {
        setStudent(finalWizardStudents[0]);
      }
    } else {
      setStudent(null);
    }
  }, [preSelectedStudent, activeSubject, activeSection]);


  // Sync Lesson state with changes to targetTopicId
  useEffect(() => {
    const parentLesson = availableLessons.find(l => l.topics.some(t => t.id === targetTopicId));
    if (parentLesson) {
      setSelectedLessonId(parentLesson.id);
    }
  }, [targetTopicId, availableLessons]);

  // Handle lesson changes (updates topic automatically)
  const handleLessonChange = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    const parentLesson = availableLessons.find(l => l.id === lessonId);
    if (parentLesson && parentLesson.topics.length > 0) {
      setTargetTopicId(parentLesson.topics[0].id);
    }
  };

  const handleEditQuizQuestion = (qIdx: number, val: string) => {
    setGeneratedQuiz(prev => prev.map((q, idx) => idx === qIdx ? { ...q, question: val } : q));
  };

  const handleEditQuizOption = (qIdx: number, oIdx: number, val: string) => {
    setGeneratedQuiz(prev => prev.map((q, idx) => {
      if (idx !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = val;
      return { ...q, options: opts };
    }));
  };

  const handleEditCorrectAnswer = (qIdx: number, oIdx: number) => {
    setGeneratedQuiz(prev => prev.map((q, idx) => idx === qIdx ? { ...q, correctAnswerIndex: oIdx } : q));
  };

  const handleEditQuizExplanation = (qIdx: number, val: string) => {
    setGeneratedQuiz(prev => prev.map((q, idx) => idx === qIdx ? { ...q, explanation: val } : q));
  };


  // Launch AI generator
  const triggerGenerationFlow = () => {
    setStep('generating');
    setGenPercentage(0);
    setGenStatusMessage('Connecting to Gemini model instance channels...');
  };

  // Call Gemini (via the shared repository, same path TeacherHome uses) to generate the remedial pack
  useEffect(() => {
    if (step !== 'generating') return;

    const topicObj = availableLessons.flatMap(l => l.topics).find(t => t.id === targetTopicId);

    // Collect the actual wrong-answer question text for this student & topic —
    // matches the shape ai.generate_remediation() expects (a list of question strings).
    const prog = student ? progressRecords[student.lrn] : null;
    const failedItems: string[] = prog
      ? Object.values(prog.quizAttempts)
          .filter(a => a.topicId === targetTopicId)
          .flatMap(a =>
            a.answers
              .map((selected, idx) => (topicObj && selected !== topicObj.quiz[idx]?.correctAnswerIndex ? topicObj.quiz[idx]?.question : null))
              .filter((q): q is string => Boolean(q))
          )
      : [];

    setGenStatusMessage('Connecting to Gemini AI model...');
    setGenPercentage(15);

    onGenerateRemediation({
      subject: activeSubject,
      topicId: targetTopicId,
      studentName: student?.name || activeSection || 'your class',
      failedItems: failedItems.length > 0 ? failedItems : undefined,
    })
      .then(result => {
        setGenPercentage(100);
        setGeneratedTitle(result.title);
        setGeneratedContent(result.content);
        setGeneratedNotes(result.teacherNotes);
        setGeneratedQuiz(result.createdQuiz);
        setGeneratedLessonNumber(result.lessonNumber ?? 1);
        setGeneratedLearningGap(result.learningGap || '');
        setGeneratedTeachersNotes(result.teachersNotes || []);
        setStep('preview');
      })
      .catch(err => {
        setGenStatusMessage(
          `Generation failed: ${err.message}. Check that the server has internet and GEMINI_API_KEY is set.`
        );
        setGenPercentage(0);
      });
  }, [step]);


  // Publish Material to local database
  const handlePublishAssessment = () => {
    if (!student) return;

    const gapSection = generatedLearningGap ? `**Learning Gap:** ${generatedLearningGap}` : '';
    const notesSection = generatedTeachersNotes.length > 0 
      ? generatedTeachersNotes.map(n => `• ${n}`).join('\n')
      : '';
    const combinedNotes = [gapSection, notesSection].filter(Boolean).join('\n\n');

    const newMaterial: TeacherRemediationMaterial = {
      id: `REM-${Math.floor(Math.random() * 900) + 100}`,
      originalTopicId: targetTopicId,
      title: `Lesson ${generatedLessonNumber}: ${generatedTitle}`,
      content: generatedContent,
      teacherNotes: combinedNotes || generatedNotes,
      createdQuiz: generatedQuiz,
      publishDate: new Date().toISOString().split('T')[0],
      isPublished: true,
    };

    onPublish(newMaterial);
    setStep('published');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100 max-w-4xl w-full"
      >
        {/* Banner with Brand Ribbon */}
        <div className="bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#10B981] p-6 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3 relative">
            <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base">Copilot Remedial Generator</h2>
              <p className="text-[10px] text-blue-100 uppercase tracking-widest font-extrabold mt-0.5">Automated Educational Architect</p>
            </div>
          </div>
          <button
            type="button"
            id="close-wizard-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 1: INITIAL COMPILER CONFIGURATION (SETUP) */}
        {/* ────────────────────────────────────────────────────────── */}
        {step === 'setup' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-sm text-slate-800 uppercase tracking-wide">1. Define Target Section and Subject Struggles</h3>
              
              <div className="space-y-4">
                {/* Target Block/Section */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Target Block/Section
                  </label>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 select-none">
                    {activeSection || 'Grade 6 - Section Newton'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Lesson dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5" htmlFor="select-lesson">
                      Target Lesson Folder
                    </label>
                    <select
                      id="select-lesson"
                      value={selectedLessonId}
                      onChange={(e) => handleLessonChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white truncate"
                    >
                      {availableLessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Lesson Topic dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5" htmlFor="select-topic">
                      Target low-performance Topic
                    </label>
                    <select
                      id="select-topic"
                      value={targetTopicId}
                      onChange={(e) => setTargetTopicId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white truncate"
                    >
                      {(availableLessons.find(l => l.id === selectedLessonId)?.topics || []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (ID: {t.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Cancel setup
              </button>
              <button
                type="button"
                id="generate-material-btn"
                onClick={triggerGenerationFlow}
                className="px-4.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Wand2 className="h-4 w-4" /> Autogenerate outlines
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 2: MOTION PROGRESS GENERATION LOADER */}
        {/* ────────────────────────────────────────────────────────── */}
        {step === 'generating' && (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="inline-flex h-20 w-20 bg-slate-50 border border-slate-100 rounded-2xl items-center justify-center animate-pulse shadow p-3">
              <WaveLogo size={62} />
            </div>

            <div className="space-y-2 max-w-sm mx-auto">
              <h3 className="font-display font-semibold text-slate-800 text-sm">Wave AI is writing tailored handbook...</h3>
              <p className="text-slate-400 text-[11px] min-h-[16px] transition-all">{genStatusMessage}</p>
            </div>

            <div className="max-w-xs mx-auto space-y-1.5">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${genPercentage}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-bold block">{genPercentage}% processed</span>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 3: PREVIEW RENDER VIEWER */}
        {/* ────────────────────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className="p-6 sm:p-8 space-y-6 max-h-[480px] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  ✓ Generation Success
                </span>
                
                <button
                  type="button"
                  id="go-edit-remedial"
                  onClick={() => setStep('edit')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Polish Content
                </button>
              </div>

              {/* Title & Notes */}
              <div className="space-y-3">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest">Outline Title</span>
                  <h3 className="font-display font-bold text-base text-slate-800">
                    Lesson {generatedLessonNumber}: {generatedTitle}
                  </h3>
                </div>

                {generatedLearningGap && (
                  <div className="space-y-1 bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-xs">
                    <span className="block text-[10px] text-amber-850 uppercase font-black tracking-widest">Learning Gap Addressed</span>
                    <p className="text-slate-700 font-medium leading-relaxed">{generatedLearningGap}</p>
                  </div>
                )}

                {generatedTeachersNotes.length > 0 ? (
                  <div className="space-y-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs">
                    <span className="block text-[10px] text-slate-450 uppercase font-black tracking-widest">Actionable Remediation Notes</span>
                    <ul className="list-disc pl-4 text-slate-650 space-y-1 mt-1 font-medium leading-relaxed">
                      {generatedTeachersNotes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  generatedNotes && (
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest pt-2">Notes to Section</span>
                      <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 shadow-sm italic">&quot;{generatedNotes}&quot;</p>
                    </div>
                  )
                )}
              </div>

              {/* Content Markup */}
              <div className="space-y-1.5">
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest">Remedial Handbook Material</span>
                <div className="p-4 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-44 overflow-y-auto shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
                  {generatedContent}
                </div>
              </div>

              {/* Quiz breakdown */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest">Custom Diagnostic Test questions</span>
                {generatedQuiz.map((q, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200/65 rounded-lg text-xs space-y-1 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
                    <p className="font-bold text-slate-700">Q{idx + 1}: {q.question}</p>
                    <p className="text-slate-500 font-medium ml-3">✍ Correct Option: <strong className="text-emerald-700">{q.options[q.correctAnswerIndex]}</strong></p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-slate-100 flex justify-between gap-3">
              <button
                type="button"
                id="discard-material-btn"
                onClick={() => setStep('setup')}
                className="px-4.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 font-bold rounded-xl text-xs flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" /> Discard
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Configure setup
                </button>
                <button
                  type="button"
                  id="confirm-publish-remedi"
                  onClick={handlePublishAssessment}
                  className="px-4.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="h-4 w-4" /> Publish to Section
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 4: INTU-EDITOR FORM SCREEN (EDIT) */}
        {/* ────────────────────────────────────────────────────────── */}
        {step === 'edit' && (
          <div className="p-6 sm:p-8 space-y-6 max-h-[520px] overflow-y-auto bg-slate-50/40">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Edit3 className="h-4.5 w-4.5 text-blue-600" /> Syllabus Redirection Editor
              </h3>
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Double check AI telemetry draft</span>
            </div>

            <div className="space-y-6">
              {/* Basic Info Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5 text-blue-500" /> Basic Information
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Lesson #</label>
                    <input 
                      type="number" 
                      value={generatedLessonNumber} 
                      onChange={(e) => setGeneratedLessonNumber(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 hover:border-slate-350 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-sans text-center shadow-sm"
                    />
                  </div>
                  <div className="col-span-3 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Lesson Title</label>
                    <input 
                      type="text" 
                      value={generatedTitle} 
                      onChange={(e) => setGeneratedTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 hover:border-slate-350 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-sans shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Gap & Objectives Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Gap & Remedial Objectives
                </h4>
                
                {/* Learning Gap block */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Learning Gap Addressed</label>
                  <textarea 
                    rows={2}
                    value={generatedLearningGap} 
                    onChange={(e) => setGeneratedLearningGap(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-650 leading-relaxed hover:border-slate-350 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-sans resize-none shadow-sm"
                    placeholder="Describe the student learning gap..."
                  />
                </div>

                {/* Teacher's Actionable Notes block */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Teacher's Actionable Notes</span>
                    <button 
                      type="button" 
                      onClick={() => setGeneratedTeachersNotes([...generatedTeachersNotes, 'New note...'])}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Append Note
                    </button>
                  </div>
                  <div className="space-y-2">
                    {generatedTeachersNotes.map((note, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold font-sans">#{idx + 1}</span>
                        <input 
                          type="text" 
                          value={note} 
                          onChange={(e) => {
                            const updated = [...generatedTeachersNotes];
                            updated[idx] = e.target.value;
                            setGeneratedTeachersNotes(updated);
                          }}
                          className="flex-1 bg-white px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-750 font-medium hover:border-slate-350 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                        />
                        <button 
                          type="button"
                          onClick={() => setGeneratedTeachersNotes(generatedTeachersNotes.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-450 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Handbook content block */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-indigo-500" /> Reading Handbook Content
                </h4>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans" htmlFor="edit-content">Material Content (Markdown supported)</label>
                  <textarea
                    id="edit-content"
                    rows={8}
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono hover:border-slate-350 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Diagnostic Evaluation Questionnaire */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Interactive Diagnostic Test Questions ({generatedQuiz.length})
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => setGeneratedQuiz([...generatedQuiz, { id: `q-wiz-${Date.now()}`, question: 'Formulate new assessment question?', options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'], correctAnswerIndex: 0, explanation: 'Explain choices.' }])}
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </button>
                </div>

                <div className="space-y-4">
                  {generatedQuiz.map((q, qIdx) => (
                    <div key={q.id || qIdx} className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4.5 space-y-4 relative hover:border-slate-300 transition-all shadow-sm">
                      <button 
                        type="button"
                        onClick={() => setGeneratedQuiz(generatedQuiz.filter((_, idx) => idx !== qIdx))}
                        className="absolute top-4 right-4 p-2 text-slate-450 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <div className="space-y-1.5 max-w-[90%]">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Question {qIdx + 1} Text</span>
                        <input 
                          type="text" 
                          value={q.question} 
                          onChange={(e) => handleEditQuizQuestion(qIdx, e.target.value)}
                          className="w-full bg-white px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Choices (Select correct answer choice)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className={`flex items-center gap-2.5 bg-white border rounded-xl px-3.5 py-2 transition-all ${q.correctAnswerIndex === oIdx ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm' : 'border-slate-200'}`}>
                              <input 
                                type="radio" 
                                name={`correct-radio-wiz-${qIdx}`}
                                checked={q.correctAnswerIndex === oIdx} 
                                onChange={() => handleEditCorrectAnswer(qIdx, oIdx)}
                                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500/10 cursor-pointer shrink-0 accent-emerald-600"
                              />
                              <input 
                                type="text" 
                                value={opt} 
                                onChange={(e) => handleEditQuizOption(qIdx, oIdx, e.target.value)}
                                className="w-full bg-transparent text-xs text-slate-700 font-bold focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Explanation (Accuracy Feedback)</span>
                        <input 
                          type="text" 
                          value={q.explanation || ''} 
                          onChange={(e) => handleEditQuizExplanation(qIdx, e.target.value)}
                          className="w-full bg-white px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-650 font-bold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Edit actions */}
            <div className="pt-5 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="px-5 py-2.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Back to Preview
              </button>
              <button
                type="button"
                id="save-edits-btn"
                onClick={() => setStep('preview')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 hover:shadow-lg active:scale-98 transition-all cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 5: FINISH RESPONSE VIEW (PUBLISHED) */}
        {/* ────────────────────────────────────────────────────────── */}
        {step === 'published' && (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="h-16 w-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl inline-flex items-center justify-center shadow-sm">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-2 max-w-sm mx-auto">
              <h1 className="font-display font-medium text-lg text-slate-900">Remedial Material Published!</h1>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Your custom remediation lesson and test has been published to the <strong>{activeSection || 'entire section'}</strong>. All student portals in this section have been updated.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 max-w-sm border border-slate-200 shadow-sm mx-auto mb-6">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Broadcast Blueprint Summary</span>
              </div>
              <span className="text-[10px] font-bold block text-slate-500">{activeSubject.toUpperCase()} • {activeSection}</span>
              <h4 className="text-xs font-black text-slate-800 leading-normal">Lesson {generatedLessonNumber}: {generatedTitle}</h4>
              <p className="text-[10px] text-slate-450 leading-relaxed italic">{generatedQuiz.length} interactive diagnostic evaluation queries locked.</p>
            </div>

            <button
              type="button"
              id="finish-wizard-close-btn"
              onClick={onClose}
              className="w-full max-w-xs py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-0 cursor-pointer"
            >
              Close wizard
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
}
