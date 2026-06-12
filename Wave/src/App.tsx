/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, BookOpen, Trophy, BrainCircuit,
  Users, BarChart, GraduationCap, Sparkles,
  Lock, ArrowRight
} from 'lucide-react';

// Models
import { UserRole, StudentUser, TeacherUser, StudentProgress, TeacherRemediationMaterial, Lesson } from './types';

// Data-access seam (Mock by default; Http+MQTT when VITE_API_BASE is set)
import { createRepository, RepoUpdate } from './repo';

// Lesson catalog from JSON content files
import { MOCK_LESSONS, MOCK_LESSONS_BY_SUBJECT } from './data';

// Custom Child Components
import LoginScreen from './components/LoginScreen';
import StudentHome from './components/StudentHome';
import StudentLessons from './components/StudentLessons';
import StudentRankings from './components/StudentRankings';
import StudentProgressRep from './components/StudentProgressRep';
import StudentProfile from './components/StudentProfile';

import TeacherHome from './components/TeacherHome';
import TeacherStudents from './components/TeacherStudents';
import TeacherAnalytics from './components/TeacherAnalytics';
import TeacherProfile from './components/TeacherProfile';
import RemediationWizard from './components/RemediationWizard';
import WaveLogo from './components/WaveLogo';

const getFormattedHeader = (subject: string, section: string) => {
  const subMap: Record<string, string> = {
    science: 'SCI',
    mathematics: 'MATH',
    english: 'ENG'
  };
  const subShort = subMap[subject.toLowerCase()] || subject.toUpperCase();
  
  if (section === 'All Sections') {
    return `${subShort} * ALL`;
  }
  
  const match = section.match(/Grade\s+(\d+)\s+-\s+Section\s+(.+)/i);
  if (match) {
    return `${subShort} * ${match[1]} - ${match[2]}`;
  }
  return `${subShort} * ${section}`;
};

export default function App() {
  // Session states
  const [currentUser, setCurrentUser] = useState<StudentUser | TeacherUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  
  // Dynamic list of enrolled students — seeded with one demo account on first launch
  const [students, setStudents] = useState<StudentUser[]>(() => {
    const stored = localStorage.getItem('wave_enrolled_students');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    const seed: StudentUser[] = [{ lrn: '101234567891', name: 'Maria Santos', gradeLevel: 'Grade 6', section: 'Grade 6 - Section Einstein', pin: '123456' }];
    localStorage.setItem('wave_enrolled_students', JSON.stringify(seed));
    return seed;
  });

  // Registered teachers — seeded with one demo account on first launch
  const [teachers, setTeachers] = useState<TeacherUser[]>(() => {
    const stored = localStorage.getItem('wave_enrolled_teachers');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    const seed: TeacherUser[] = [{ teacherId: 'T-2026-001', name: 'Mrs. Elena Santos', department: 'General Academics', password: 'password123' }];
    localStorage.setItem('wave_enrolled_teachers', JSON.stringify(seed));
    return seed;
  });

  const handleEnrollStudent = (newStudent: StudentUser) => {
    setStudents(prev => {
      // Avoid duplicate LRNs just in case
      if (prev.some(s => s.lrn === newStudent.lrn)) {
        return prev;
      }
      const updated = [...prev, newStudent];
      localStorage.setItem('wave_enrolled_students', JSON.stringify(updated));
      return updated;
    });
    repo.enrollStudent(newStudent).catch(() => {});
  };

  // Tab states: 学生 default -> 'dashboard', 教师 default -> 'dashboard'
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Dynamic system stores — persisted to localStorage in mock mode so attempt counts survive page reloads
  const [progressRecords, setProgressRecords] = useState<Record<string, StudentProgress>>(() => {
    const stored = localStorage.getItem('wave_progress_records');
    if (stored) { try { return JSON.parse(stored); } catch { /* fall through */ } }
    return {};
  });
  const [remediationMaterials, setRemediationMaterials] = useState<TeacherRemediationMaterial[]>([]);

  // Repository seam + catalog store. Mock keeps the in-memory defaults above;
  // the Http repo replaces them from the server on mount.
  const repo = useMemo(() => createRepository(), []);
  const [lessonsBySubject, setLessonsBySubject] = useState<Record<string, Lesson[]>>(MOCK_LESSONS_BY_SUBJECT);

  // Persist progress to localStorage on every change so progress survives refreshes
  // even if the server push hasn't completed yet (live mode writes to server too).
  useEffect(() => {
    localStorage.setItem('wave_progress_records', JSON.stringify(progressRecords));
  }, [progressRecords]);

  // Apply a live "down" update arriving over MQTT (Http mode only).
  const applyRepoUpdate = (u: RepoUpdate) => {
    if (u.kind === 'progress') {
      setProgressRecords(prev => ({ ...prev, [u.record.studentLrn]: { ...prev[u.record.studentLrn], ...u.record } }));
    } else if (u.kind === 'remediation') {
      // Only add the material if its payload is non-empty (an empty array payload
      // is the broker's way of signalling a cleared retained message).
      if (u.material && u.material.id) {
        setRemediationMaterials(prev => [u.material, ...prev.filter(m => m.id !== u.material.id)]);
      }
    }
    // 'rankings' updates are reflected client-side via the progress recomputation.
  };

  // Cold-start hydration from the server (no-op for Mock — defaults already set).
  useEffect(() => {
    if (!repo.isLive) return;
    repo.bootstrap()
      .then(b => {
        setStudents(b.students);
        setTeachers(b.teachers);
        setLessonsBySubject(b.lessonsBySubject);
        // Merge: server wins per-student, but keep any locally-cached records the
        // server doesn't know about yet (e.g. a push that hasn't flushed).
        setProgressRecords(prev => ({ ...prev, ...b.progressRecords }));
        setRemediationMaterials(b.remediationMaterials);
      })
      .catch(e => console.error('[wave] bootstrap failed', e));
  }, [repo]);

  // Course subject tracks: mathematics, science, english
  const [activeSubject, setActiveSubject] = useState<string>('science');
  // Default to a section that has seeded, active student data so the dashboard
  // opens onto meaningful records (and live updates have somewhere to land).
  const [activeSection, setActiveSection] = useState<string>('All Sections');
  const [hasSelectedSubject, setHasSelectedSubject] = useState<boolean>(false);

  // Live "down" subscription. Re-runs when the viewed section/subject changes so
  // the teacher's live feed always follows whatever section they're looking at;
  // for a student it tracks their own section + LRN topics.
  useEffect(() => {
    if (!repo.isLive || !currentUser || !role) return;
    const lrn = role === 'student' ? (currentUser as StudentUser).lrn : undefined;
    const section = role === 'student'
      ? ((currentUser as StudentUser).section || (currentUser as StudentUser).gradeLevel)
      : activeSection;
    repo.subscribeLive({ role, lrn, section, subject: activeSubject, onUpdate: applyRepoUpdate });
    return () => repo.unsubscribeLive();
    // applyRepoUpdate only calls stable setState fns, so it's safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, currentUser, role, activeSection, activeSubject]);

  // Polling fallback: when MQTT WebSocket is unavailable (e.g. broker not serving WS),
  // students still receive published remedial materials by polling the REST endpoint.
  useEffect(() => {
    if (!repo.isLive || role !== 'student' || !currentUser) return;
    const studentSection = (currentUser as StudentUser).section || (currentUser as StudentUser).gradeLevel;
    const poll = async () => {
      try {
        const fresh = await repo.fetchRemediation(studentSection);
        setRemediationMaterials(fresh);
      } catch { /* server unreachable — skip */ }
    };
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [repo, role, currentUser]);

  // Student dashboard custom direct lesson-topic navigation state hooks
  const [navTopicId, setNavTopicId] = useState<string>('');
  const [navViewState, setNavViewState] = useState<'syllabus' | 'reading' | 'quiz' | 'summative'>('syllabus');
  const clearNavContext = () => {
    setNavTopicId('');
    setNavViewState('syllabus');
  };

  // AI Remediation Wizard trigger overlays
  const [showWizard, setShowWizard] = useState(false);
  const [wizardPreSelectedStudent, setWizardPreSelectedStudent] = useState<StudentUser | null>(null);
  const [wizardPreSelectedTopicId, setWizardPreSelectedTopicId] = useState<string>("");


  // Handle Logouts
  const handleLogout = () => {
    setCurrentUser(null);
    setRole(null);
    setActiveTab('dashboard');
    setActiveSubject('science');
    setActiveSection('All Sections');
    setHasSelectedSubject(false);
  };

  // Handle Logins Success
  const handleLoginSuccess = (selectedRole: UserRole, user: StudentUser | TeacherUser, presetSubject?: string, presetSection?: string) => {
    setRole(selectedRole);
    setCurrentUser(user);
    setActiveTab('dashboard');
    if (selectedRole === 'teacher') {
      setHasSelectedSubject(true);
      if (presetSubject) {
        setActiveSubject(presetSubject);
      }
      if (presetSection) {
        setActiveSection(presetSection);
      }
    }

    // Establish a write token when backed by the server. After the token is
    // ready, flush any writes that were queued before it arrived (outbox).
    if (repo.isLive) {
      const principalId = selectedRole === 'student' ? (user as StudentUser).lrn : (user as TeacherUser).teacherId;
      const passOrName = selectedRole === 'student' ? (user as StudentUser).name : (user as TeacherUser).password;
      const pin = selectedRole === 'student' ? (user as StudentUser).pin : undefined;
      repo.authenticate(selectedRole, principalId, passOrName, pin)
        .then(() => repo.flushPendingWrites())
        .catch(() => {});
    }
  };

  // Dynamic Progress Scoring - update user's score record instantly in global React state!
  const handleSaveQuizScore = (topicId: string, lessonId: string, score: number, answers: number[]) => {
    if (!currentUser || role !== 'student') return;
    
    const lrn = (currentUser as StudentUser).lrn;
    const originalProgress = progressRecords[lrn] || {
      studentLrn: lrn,
      completedTopicIds: [],
      quizAttempts: {},
      summativeScores: {}
    };

    // Update attempts (cap tracking at 3)
    const updatedAttempts = { ...originalProgress.quizAttempts };
    const prevAttempts = originalProgress.quizAttempts[topicId]?.attempts ?? 0;
    if (prevAttempts < 3) {
      updatedAttempts[topicId] = {
        topicId,
        score,
        perfectScore: 10,
        answers,
        completedAt: new Date().toISOString().split('T')[0],
        attempts: prevAttempts + 1
      };
    }

    // Add completion identifier
    const updatedCompletions = [...originalProgress.completedTopicIds];
    if (!updatedCompletions.includes(topicId)) {
      updatedCompletions.push(topicId);
    }

    const updatedProgress: StudentProgress = {
      ...originalProgress,
      completedTopicIds: updatedCompletions,
      quizAttempts: updatedAttempts
    };

    setProgressRecords(prev => ({
      ...prev,
      [lrn]: updatedProgress
    }));

    // Sync "up" to the server (Mock no-ops). Section drives the down-broadcast.
    const section = (currentUser as StudentUser).section || (currentUser as StudentUser).gradeLevel;
    repo.saveQuizAttempt({ lrn, topicId, lessonId, score, answers, section, subject: activeSubject }).catch(() => {});
  };

  // Dynamic Summative scoring
  const handleSaveSummativeScore = (lessonId: string, score: number) => {
    if (!currentUser || role !== 'student') return;
    const lrn = (currentUser as StudentUser).lrn;
    
    const originalProgress = progressRecords[lrn];
    if (!originalProgress) return;

    const updatedSummatives = { ...originalProgress.summativeScores };
    const prevSummativeAttempts = originalProgress.summativeScores[lessonId]?.attempts ?? 0;
    if (prevSummativeAttempts >= 3) return; // already at max attempts
    updatedSummatives[lessonId] = {
      score,
      perfectScore: 20,
      feedback: score >= 12 ? "Good job! You passed the summative assessment." : "Keep reviewing the topics and ask your teacher for help.",
      attempts: prevSummativeAttempts + 1
    };

    const updatedProgress: StudentProgress = {
      ...originalProgress,
      summativeScores: updatedSummatives
    };

    setProgressRecords(prev => ({
      ...prev,
      [lrn]: updatedProgress
    }));

    const section = (currentUser as StudentUser).section || (currentUser as StudentUser).gradeLevel;
    repo.saveSummativeResult({ lrn, lessonId, score, section, subject: activeSubject }).catch(() => {});
  };

  // Publish remedial material via wizard triggers
  const handlePublishRemedialMaterial = (newMaterial: TeacherRemediationMaterial) => {
    setRemediationMaterials(prev => [newMaterial, ...prev]);
    repo.publishRemediation(newMaterial, { subject: activeSubject, section: activeSection }).catch(() => {});

    // Force add student progress record trace if none exists, keeping overall systems calculated correctly.
    const studentLrn = newMaterial.assignedStudentLrn;
    if (!progressRecords[studentLrn]) {
      const emptyState: StudentProgress = {
        studentLrn,
        completedTopicIds: [],
        quizAttempts: {},
        summativeScores: {}
      };
      setProgressRecords(prev => ({
        ...prev,
        [studentLrn]: emptyState
      }));
    }
  };

  // Trigger remedial from Student screen
  const handleStudentJumpToRemedial = (_material: TeacherRemediationMaterial) => {
    setActiveTab('lessons');
    // Open reading with remedial parameters in StudentLessons components
    // We can simulate an active tutorial load.
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* ────────────────────────────────────────────────────────── */}
      {/* AUTHENTICATION OVERLAY */}
      {/* ────────────────────────────────────────────────────────── */}
      {!currentUser && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} students={students} teachers={teachers} />
      )}

      {currentUser && (
        <>
          {/* ────────────────────────────────────────────────────────── */}
          {/* SUBJECT & SECTION SESSION SELECTOR OVERLAYS */}
          {/* ────────────────────────────────────────────────────────── */}
          {role === 'student' && !hasSelectedSubject && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md overflow-y-auto z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="bg-white rounded-[28px] max-w-xl w-full p-6 sm:p-8 border border-slate-200/60 shadow-[0_25px_60px_rgba(15,23,42,0.15)] relative overflow-hidden"
              >
                {/* Master Accent Gradient Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#00A2E2] via-[#00B48A] to-indigo-650" />
                
                {/* Background ambient radial aura */}
                <div className="absolute -top-12 -left-12 h-44 w-44 rounded-full bg-sky-400/5 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-emerald-400/5 blur-3xl pointer-events-none" />

                <div className="space-y-6 text-center">
                  {/* Glowing Animated Icon Badge */}
                  <div className="relative mx-auto h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-50 to-indigo-50 border border-indigo-100 flex items-center justify-center text-blue-600 shadow-inner">
                    <span className="absolute inset-0 rounded-2xl bg-sky-400/10 animate-ping opacity-75" />
                    <GraduationCap className="h-8 w-8 text-indigo-600 relative z-10" />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] bg-indigo-50 text-indigo-700/90 border border-indigo-200/50 px-3 py-1 rounded-full font-extrabold uppercase tracking-widest">
                      <Sparkles className="h-3 w-3 text-indigo-500 animate-pulse" /> Session Focus Configuration
                    </span>
                    <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                      Mabuhay, {currentUser?.name}!
                    </h2>
                    <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                      To open your personalized curriculum tracking, custom remedial work, and academic metrics, please select your primary subject focus for this learning session.
                    </p>
                  </div>

                  {/* Grid of Interactive Subject Selection Cards */}
                  <div className="grid grid-cols-1 gap-4 text-left pt-2">
                    
                    {/* Item 1: Science */}
                    <button
                      type="button"
                      id="session-subject-science"
                      onClick={() => {
                        setActiveSubject('science');
                        setHasSelectedSubject(true);
                      }}
                      className="group relative flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 hover:border-[#00A2E2] bg-gradient-to-br from-white to-slate-50/30 hover:to-[#00A2E2]/5 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#00A2E2] to-[#0185BA] flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-[#00A2E2]/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                          🧪
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-black text-base text-slate-800 group-hover:text-[#008CC4] transition-colors">
                              Science Course Track
                            </span>
                            <span className="text-[9px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md border border-sky-100">
                              4 Units
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            Respiratory structures, muscles coupling, states of matter, and kinetic models.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-350 group-hover:text-[#00A2E2] group-hover:translate-x-1.5 transition-all shrink-0 ml-2" />
                    </button>

                    {/* Item 2: Mathematics */}
                    <button
                      type="button"
                      id="session-subject-math"
                      onClick={() => {
                        setActiveSubject('mathematics');
                        setHasSelectedSubject(true);
                      }}
                      className="group relative flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 hover:border-[#00B48A] bg-gradient-to-br from-white to-slate-50/30 hover:to-[#00B48A]/5 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#00B48A] to-[#009270] flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-[#00B48A]/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                          🧮
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-black text-base text-slate-800 group-hover:text-[#009270] transition-colors">
                              Mathematics Course Track
                            </span>
                            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                              4 Units
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            Linear fractions, arithmetic calculations, quadrilateral properties, and 3D shapes.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-350 group-hover:text-[#00B48A] group-hover:translate-x-1.5 transition-all shrink-0 ml-2" />
                    </button>

                    {/* Item 3: English */}
                    <button
                      type="button"
                      id="session-subject-english"
                      onClick={() => {
                        setActiveSubject('english');
                        setHasSelectedSubject(true);
                      }}
                      className="group relative flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-500 bg-gradient-to-br from-white to-slate-50/30 hover:to-indigo-500/5 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                          📚
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-black text-base text-slate-800 group-hover:text-indigo-600 transition-colors">
                              English Course Track
                            </span>
                            <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                              4 Units
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            Grammatical word classes, narrative story contexts, verb tenses, and spelling.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-350 group-hover:text-indigo-600 group-hover:translate-x-1.5 transition-all shrink-0 ml-2" />
                    </button>

                  </div>

                  {/* Informational Locking Warning */}
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 text-left max-w-lg mx-auto">
                    <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10.5px] text-slate-500 font-semibold leading-relaxed">
                      <strong>Session Lock Active:</strong> Your chosen track will apply to all study screens for this active session. To change your focus subject, please log out and sign back in to start a new academic session.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Header Bar */}
          <header className={`bg-white border-b border-slate-100 py-3 px-4 sm:px-6 sticky top-0 z-40 shadow-sm`}>
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              
              {/* Left Side: Brand Logo and Wordmark */}
              <div className="flex items-center gap-2.5 shrink-0">
                <WaveLogo size={32} showText={true} textColor="text-slate-850" textSize="text-lg" />
              </div>

              {/* Center Side: Student Name / Grade / Section */}
              <div className="flex-1 text-center min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-850 tracking-tight truncate">
                  {currentUser.name}
                </h2>
                <p className="text-[10px] sm:text-xs text-indigo-650 font-black tracking-wider uppercase truncate leading-tight mt-0.5">
                  {role === 'student' 
                    ? `${activeSubject === 'science' ? 'SCI' : activeSubject === 'mathematics' ? 'MATH' : activeSubject === 'english' ? 'ENG' : activeSubject.toUpperCase()} Focus` 
                    : getFormattedHeader(activeSubject, activeSection)}
                </p>
              </div>

              {/* Right Side: Profile Circle serving as Navigation */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {role === 'student' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                    }}
                    title="Student Profile"
                    className={`h-8 w-8 rounded-xl bg-gradient-to-br from-[#00A2E2] to-[#00B48A] flex items-center justify-center text-white text-xs font-bold shadow-inner border transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer ${
                      activeTab === 'profile' 
                        ? 'ring-2 ring-offset-2 ring-[#00A2E2] border-white' 
                        : 'border-white/20'
                    }`}
                  >
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                    }}
                    title="Teacher Profile"
                    className={`h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-inner border transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer ${
                      activeTab === 'profile' 
                        ? 'ring-2 ring-offset-2 ring-indigo-500 border-white' 
                        : 'border-white/20'
                    }`}
                  >
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </button>
                )}
              </div>
              
            </div>
          </header>



          {/* Main Layout Container */}
          <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-28 sm:pb-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                {/* Resolve current lessons based on selected subject */}
                {(() => {
                  const currentLessons = lessonsBySubject[activeSubject] || MOCK_LESSONS;

                  return (
                    <>
                      {/* STUDENT CONSOLE VIEW CONTROLLERS */}
                      {role === 'student' && (
                        <>
                          {activeTab === 'dashboard' && (
                            <StudentHome
                              student={currentUser as StudentUser}
                              progress={progressRecords[(currentUser as StudentUser).lrn] || { studentLrn: (currentUser as StudentUser).lrn, completedTopicIds: [], quizAttempts: {}, summativeScores: {} }}
                              lessons={currentLessons}
                              remediationMaterials={remediationMaterials}
                              onViewTopic={(topicId, _lessonId) => {
                                // Find subject key having this topic ID across all subjects
                                let foundSubject = 'science';
                                for (const [subKey, subLessons] of Object.entries(MOCK_LESSONS_BY_SUBJECT)) {
                                  if (subLessons.flatMap(l => l.topics).some(t => t.id === topicId)) {
                                    foundSubject = subKey;
                                    break;
                                  }
                                }
                                setActiveSubject(foundSubject);
                                setNavTopicId(topicId);
                                setNavViewState('reading');
                                setHasSelectedSubject(true);
                                setActiveTab('lessons');
                              }}
                              onTakeQuiz={(topicId, _lessonId) => {
                                // Find subject key having this topic ID across all subjects
                                let foundSubject = 'science';
                                for (const [subKey, subLessons] of Object.entries(MOCK_LESSONS_BY_SUBJECT)) {
                                  if (subLessons.flatMap(l => l.topics).some(t => t.id === topicId)) {
                                    foundSubject = subKey;
                                    break;
                                  }
                                }
                                setActiveSubject(foundSubject);
                                setNavTopicId(topicId);
                                setNavViewState('quiz');
                                setHasSelectedSubject(true);
                                setActiveTab('lessons');
                              }}
                              onStartRemedial={handleStudentJumpToRemedial}
                              setActiveTab={setActiveTab}
                              activeSubject={activeSubject}
                            />
                          )}

                          {activeTab === 'lessons' && (
                            <StudentLessons
                              student={currentUser as StudentUser}
                              progress={progressRecords[(currentUser as StudentUser).lrn] || { studentLrn: (currentUser as StudentUser).lrn, completedTopicIds: [], quizAttempts: {}, summativeScores: {} }}
                              lessons={currentLessons}
                              remediationMaterials={remediationMaterials}
                              onSaveQuizScore={handleSaveQuizScore}
                              onSaveSummativeScore={handleSaveSummativeScore}
                              onStartRemedial={handleStudentJumpToRemedial}
                              activeSubject={activeSubject}
                              setActiveSubject={setActiveSubject}
                              hasSelectedSubject={hasSelectedSubject}
                              setHasSelectedSubject={setHasSelectedSubject}
                              navTopicId={navTopicId}
                              navViewState={navViewState}
                              clearNavContext={clearNavContext}
                            />
                          )}

                          {activeTab === 'rankings' && (
                            <StudentRankings
                              currentStudent={currentUser as StudentUser}
                              progressRecords={progressRecords}
                              lessons={currentLessons}
                              students={students}
                              activeSubject={activeSubject}
                            />
                          )}

                          {activeTab === 'progress' && (
                            <StudentProgressRep
                              progress={progressRecords[(currentUser as StudentUser).lrn] || { studentLrn: (currentUser as StudentUser).lrn, completedTopicIds: [], quizAttempts: {}, summativeScores: {} }}
                              lessons={currentLessons}
                              activeSubject={activeSubject}
                            />
                          )}

                          {activeTab === 'profile' && (
                            <StudentProfile
                              student={currentUser as StudentUser}
                              onLogout={handleLogout}
                              activeSubject={activeSubject}
                            />
                          )}
                        </>
                      )}

                      {/* TEACHER CONSOLE VIEW CONTROLLERS */}
                      {role === 'teacher' && (
                        <>
                          {activeTab === 'dashboard' && (
                            <TeacherHome
                              teacher={currentUser as TeacherUser}
                              progressRecords={progressRecords}
                              onLaunchWizard={() => {
                                setWizardPreSelectedStudent(null);
                                setWizardPreSelectedTopicId("");
                                setShowWizard(true);
                              }}
                              onPublishRemedial={handlePublishRemedialMaterial}
                              onGenerateRemediation={(req) => repo.generateRemediation(req)}
                              setActiveTab={setActiveTab}
                              activeSubject={activeSubject}
                              setActiveSubject={setActiveSubject}
                              activeSection={activeSection}
                              setActiveSection={setActiveSection}
                              students={students}
                            />
                          )}

                          {activeTab === 'students' && (
                            <TeacherStudents
                              progressRecords={progressRecords}
                              activeSubject={activeSubject}
                              setActiveSubject={setActiveSubject}
                              activeSection={activeSection}
                              setActiveSection={setActiveSection}
                              students={students}
                              onEnrollStudent={handleEnrollStudent}
                            />
                          )}

                          {activeTab === 'analytics' && (
                            <TeacherAnalytics
                              progressRecords={progressRecords}
                              activeSubject={activeSubject}
                              setActiveSubject={setActiveSubject}
                              activeSection={activeSection}
                              setActiveSection={setActiveSection}
                              students={students}
                            />
                          )}

                          {activeTab === 'profile' && (
                            <TeacherProfile
                              teacher={currentUser as TeacherUser}
                              onLogout={handleLogout}
                              activeSubject={activeSubject}
                              activeSection={activeSection}
                            />
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Bottom Navigation Ribbon (Mobile & responsive) */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2.5 px-4 shadow-xl z-30">
            <div className="max-w-5xl mx-auto flex items-center justify-around sm:justify-center sm:gap-16">
              {role === 'student' ? (
                <>
                  {/* Student Home Link */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Home className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Home</span>
                  </button>

                  {/* Student Syllabus Link */}
                  <button
                    type="button"
                    id="nav-lessons-tab"
                    onClick={() => setActiveTab('lessons')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'lessons' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Syllabus</span>
                  </button>

                  {/* Student Rankings Link */}
                  <button
                    type="button"
                    id="nav-rankings-tab"
                    onClick={() => setActiveTab('rankings')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'rankings' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Rankings</span>
                  </button>

                  {/* Student Progress Link */}
                  <button
                    type="button"
                    id="nav-progress-tab"
                    onClick={() => setActiveTab('progress')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'progress' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <BrainCircuit className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Progress</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Teacher Home Link */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Home className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Home</span>
                  </button>

                  {/* Class Records Table Link */}
                  <button
                    type="button"
                    id="nav-records-tab"
                    onClick={() => setActiveTab('students')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'students' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Class Records</span>
                  </button>

                  {/* Analytics charts Link */}
                  <button
                    type="button"
                    id="nav-analytics-tab"
                    onClick={() => setActiveTab('analytics')}
                    className={`flex flex-col items-center gap-1 text-[10px] sm:text-xs font-bold px-3 sm:px-6 ${
                      activeTab === 'analytics' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <BarChart className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Analytics</span>
                  </button>
                </>
              )}
            </div>
          </nav>
        </>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* CO-GRADES AI WIZARD OVERLAY GATES */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWizard && (
          <RemediationWizard
            preSelectedStudent={wizardPreSelectedStudent}
            preSelectedTopicId={wizardPreSelectedTopicId}
            onPublish={handlePublishRemedialMaterial}
            onClose={() => {
              setShowWizard(false);
              setWizardPreSelectedStudent(null);
              setWizardPreSelectedTopicId("");
            }}
            students={students}
            progressRecords={progressRecords}
            activeSubject={activeSubject}
            activeSection={activeSection}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
