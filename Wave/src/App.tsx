/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, BookOpen, Trophy, BrainCircuit, User, 
  Users, BarChart, LogOut, GraduationCap, Clock, Sparkles,
  Lock, ArrowRight
} from 'lucide-react';

// Models
import { UserRole, StudentUser, TeacherUser, StudentProgress, TeacherRemediationMaterial } from './types';

// Seed Mock Data
import { 
  MOCK_STUDENTS, 
  MOCK_TEACHERS, 
  MOCK_LESSONS, 
  MOCK_LESSONS_BY_SUBJECT,
  INITIAL_PROGRESS_RECORDS, 
  INITIAL_REMEDIATION_MATERIALS 
} from './data';

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
  
  // Dynamic list of enrolled students (with local storage backing)
  const [students, setStudents] = useState<StudentUser[]>(() => {
    const stored = localStorage.getItem('wave_enrolled_students');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        
        // Ensure pre-seeded students in localStorage have up-to-date grades and names matching MOCK_STUDENTS.
        // For example, Sophia Cruz should be Grade 4, not Grade 5 from older stale local storage.
        let modified = false;
        const updated = parsed.map((s: any) => {
          const canonical = MOCK_STUDENTS.find(m => m.lrn === s.lrn);
          if (canonical) {
            if (s.name !== canonical.name || s.gradeLevel !== canonical.gradeLevel) {
              modified = true;
              return {
                ...s,
                name: canonical.name,
                gradeLevel: canonical.gradeLevel
              };
            }
          }
          return s;
        });

        // Also ensure any newly added mock students in MOCK_STUDENTS are present in the enrolled list.
        MOCK_STUDENTS.forEach(m => {
          if (!updated.some((s: any) => s.lrn === m.lrn)) {
            updated.push({
              ...m,
              pin: m.pin || '123456'
            });
            modified = true;
          }
        });

        if (modified) {
          localStorage.setItem('wave_enrolled_students', JSON.stringify(updated));
        }
        return updated;
      } catch (e) {
        // Fallback
      }
    }
    const initial = MOCK_STUDENTS.map(s => ({
      ...s,
      pin: s.pin || '123456'
    }));
    localStorage.setItem('wave_enrolled_students', JSON.stringify(initial));
    return initial;
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
  };

  // Tab states: 学生 default -> 'dashboard', 教师 default -> 'dashboard'
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Dynamic system stores
  const [progressRecords, setProgressRecords] = useState<Record<string, StudentProgress>>(INITIAL_PROGRESS_RECORDS);
  const [remediationMaterials, setRemediationMaterials] = useState<TeacherRemediationMaterial[]>(INITIAL_REMEDIATION_MATERIALS);

  // Course subject tracks: mathematics, science, english
  const [activeSubject, setActiveSubject] = useState<string>('science');
  const [activeSection, setActiveSection] = useState<string>('Grade 6 - Section Newton');
  const [hasSelectedSubject, setHasSelectedSubject] = useState<boolean>(false);

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

  // Simulated system time sync
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // Initial sync
    setCurrentTime(new Date("2026-06-05T06:31:34Z").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle Logouts
  const handleLogout = () => {
    setCurrentUser(null);
    setRole(null);
    setActiveTab('dashboard');
    setActiveSubject('science');
    setActiveSection('Grade 6 - Section Newton');
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

    // Update attempts
    const updatedAttempts = { ...originalProgress.quizAttempts };
    updatedAttempts[topicId] = {
      topicId,
      score,
      perfectScore: 3, // Each topic quiz is standard 3 points size
      answers,
      completedAt: new Date().toISOString().split('T')[0]
    };

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
  };

  // Dynamic Summative scoring
  const handleSaveSummativeScore = (lessonId: string, score: number) => {
    if (!currentUser || role !== 'student') return;
    const lrn = (currentUser as StudentUser).lrn;
    
    const originalProgress = progressRecords[lrn];
    if (!originalProgress) return;

    const updatedSummatives = { ...originalProgress.summativeScores };
    updatedSummatives[lessonId] = {
      score,
      perfectScore: 20,
      feedback: score >= 15 ? "Outstanding grasp of linear lists characteristics." : "Acceptable attempt, slight review recommended."
    };

    const updatedProgress: StudentProgress = {
      ...originalProgress,
      summativeScores: updatedSummatives
    };

    setProgressRecords(prev => ({
      ...prev,
      [lrn]: updatedProgress
    }));
  };

  // Publish remedial material via wizard triggers
  const handlePublishRemedialMaterial = (newMaterial: TeacherRemediationMaterial) => {
    setRemediationMaterials(prev => [newMaterial, ...prev]);

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

  // Hotkey triggers from tables to load wizard
  const handleHotLaunchWizard = (student: StudentUser, topicId: string) => {
    setWizardPreSelectedStudent(student);
    setWizardPreSelectedTopicId(topicId);
    setShowWizard(true);
  };

  // Trigger remedial from Student screen
  const handleStudentJumpToRemedial = (material: TeacherRemediationMaterial) => {
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
        <LoginScreen onLoginSuccess={handleLoginSuccess} students={students} />
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
            <div className="max-w-5xl mx-auto grid grid-cols-3 items-center gap-4">
              
              {/* Left Side: Brand Logo and Wordmark */}
              <div className="flex items-center gap-2.5 shrink-0 justify-self-start">
                <WaveLogo size={32} showText={true} textColor="text-slate-850" textSize="text-lg" />
              </div>

              {/* Center Side: Student Name / Grade / Section */}
              <div className="text-center min-w-0 justify-self-center">
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
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 justify-self-end">
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
                  const currentLessons = MOCK_LESSONS_BY_SUBJECT[activeSubject] || MOCK_LESSONS;

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
                              onViewTopic={(topicId, lessonId) => {
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
                              onTakeQuiz={(topicId, lessonId) => {
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
                              onLaunchWizardForStudent={handleHotLaunchWizard}
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
                              onLaunchWizardForStudent={handleHotLaunchWizard}
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
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2.5 px-4 sm:px-6 shadow-xl z-30">
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

                  {/* Student Lessons Link */}
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
