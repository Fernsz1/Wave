/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wand2, CheckCircle2, Edit3, Trash2, X } from 'lucide-react';
import { StudentUser, QuizQuestion, TeacherRemediationMaterial, StudentProgress } from '../types';
import { MOCK_LESSONS, MOCK_LESSONS_BY_SUBJECT } from '../data';
import WaveLogo from './WaveLogo';

interface RemediationWizardProps {
  onPublish: (material: TeacherRemediationMaterial) => void;
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


  // Launch AI generator
  const triggerGenerationFlow = () => {
    setStep('generating');
    setGenPercentage(0);
    setGenStatusMessage('Connecting to Gemini model instance channels...');
  };

  // Call Gemini API via Django to generate the remedial pack
  useEffect(() => {
    if (step !== 'generating') return;

    const topicObj = availableLessons.flatMap(l => l.topics).find(t => t.id === targetTopicId);
    const topicName = topicObj?.name ?? targetTopicId;

    const prog = student ? progressRecords[student.lrn] : null;
    const failedItems = prog
      ? Object.values(prog.quizAttempts)
          .filter(a => a.topicId === targetTopicId)
          .flatMap(a =>
            a.answers.map((selected, idx) => ({
              questionId: `Q-${idx + 1}`,
              topicId: a.topicId,
              selectedOption: selected,
              correctOption: 0,
            }))
          )
      : [];

    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

    setGenStatusMessage('Connecting to Gemini AI model...');
    setGenPercentage(15);

    fetch(`${apiBase}/api/remediation/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: targetTopicId,
        topicName,
        subject: activeSubject,
        gradeLevel: 'Grade 6',
        section: activeSection,
        studentLrn: student?.lrn ?? '',
        failedItems,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
        setGenPercentage(70);
        setGenStatusMessage('Processing Gemini response...');
        return res.json();
      })
      .then(data => {
        setGenPercentage(100);
        setGeneratedTitle(data.title);
        setGeneratedContent(data.content);
        setGeneratedNotes(data.teacherNotes);
        setGeneratedQuiz(data.createdQuiz);
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

    const newMaterial: TeacherRemediationMaterial = {
      id: `REM-${Math.floor(Math.random() * 900) + 100}`,
      originalTopicId: targetTopicId,
      title: generatedTitle,
      content: generatedContent,
      teacherNotes: generatedNotes,
      createdQuiz: generatedQuiz,
      publishDate: new Date().toISOString().split('T')[0],
      assignedStudentLrn: student.lrn,
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
        className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 max-w-2xl w-full"
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
              <h3 className="font-display font-semibold text-sm text-slate-800 uppercase tracking-wide">1. Define Target student and subject struggles</h3>
              
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
                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-250 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
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
              <div className="space-y-2">
                <span className="block text-[10px] text-slate-450 uppercase font-black tracking-widest">Outline Title</span>
                <h3 className="font-display font-bold text-base text-slate-800">{generatedTitle}</h3>
                
                <span className="block text-[10px] text-slate-450 uppercase font-black tracking-widest pt-2">Notes to student</span>
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-150 italic">&quot;{generatedNotes}&quot;</p>
              </div>

              {/* Content Markup */}
              <div className="space-y-1.5">
                <span className="block text-[10px] text-slate-450 uppercase font-black tracking-widest">Remedial Handbook Material</span>
                <div className="p-4 bg-white border border-slate-150 rounded-xl text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-44 overflow-y-auto">
                  {generatedContent}
                </div>
              </div>

              {/* Quiz breakdown */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] text-slate-450 uppercase font-black tracking-widest">Custom Diagnostic Test questions</span>
                {generatedQuiz.map((q, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs space-y-1">
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
                  className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-650 rounded-xl text-xs font-semibold"
                >
                  Configure setup
                </button>
                <button
                  type="button"
                  id="confirm-publish-remedi"
                  onClick={handlePublishAssessment}
                  className="px-4.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="h-4 w-4" /> Publish to student
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 4: INTU-EDITOR FORM SCREEN (EDIT) */}
        {/* ────────────────────────────────────────────────────────── */}
        {step === 'edit' && (
          <div className="p-6 sm:p-8 space-y-5 max-h-[480px] overflow-y-auto">
            <h3 className="font-display font-semibold text-sm text-slate-850 flex items-center gap-1.5">
              <Edit3 className="h-4.5 w-4.5 text-blue-600" /> Polish Generated content
            </h3>

            <div className="space-y-4">
              {/* Edit Title */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5" htmlFor="edit-title">Material Title</label>
                <input
                  type="text"
                  id="edit-title"
                  value={generatedTitle}
                  onChange={(e) => setGeneratedTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800"
                />
              </div>

              {/* Edit Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5" htmlFor="edit-notes">Teacher notes</label>
                <textarea
                  id="edit-notes"
                  rows={2}
                  value={generatedNotes}
                  onChange={(e) => setGeneratedNotes(e.target.value)}
                  className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800"
                />
              </div>

              {/* Edit Content */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5" htmlFor="edit-content">Reading handbook content (Markdown text supported)</label>
                <textarea
                  id="edit-content"
                  rows={7}
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-mono"
                />
              </div>
            </div>

            {/* Edit actions */}
            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-150 border border-slate-200 text-slate-650 rounded-xl text-xs font-semibold"
              >
                Back to Preview
              </button>
              <button
                type="button"
                id="save-edits-btn"
                onClick={() => setStep('preview')}
                className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow"
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
              <h1 className="font-display font-medium text-lg text-slate-900">Education Material Published!</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your custom remediation lesson and custom test has been posted to <strong>{student?.name}&apos;s</strong> portal. Their curriculum timeline is updated.
              </p>
            </div>

            <button
              type="button"
              id="finish-wizard-close-btn"
              onClick={onClose}
              className="w-full max-w-xs py-3 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow"
            >
              Close wizard
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
}
