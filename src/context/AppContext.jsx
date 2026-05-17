import { createContext, useContext, useReducer, useEffect } from 'react';
import { saveToLocalStorage, loadFromLocalStorage } from '../lib/storage';

const STORAGE_KEY = 'simak_studyos_state';

const initialState = {
  // Onboarding & Identity
  onboarded: false,
  apiKey: '',
  examDates: [],
  primaryExamId: null,

  // Navigation & UI
  activeModule: 'today',
  focusMode: false,
  theme: 'academic-dark',
  sidebarCollapsed: false,

  // Progress & Performance
  diagnosticResults: null,
  topicMastery: {},
  streak: 0,
  lastStudyDate: null,
  graceDayUsed: false,

  // Spaced Repetition
  srQueue: [],

  // Drill & Mock Exam
  drillHistory: [],
  mockExamHistory: [],

  // Mistake Notebook
  mistakes: [],

  // Confidence Calibration
  calibrationLog: [],

  // Focus Sessions
  focusSessions: [],
  totalFocusMinutes: 0,

  // Daily Seed Bank
  seedStats: {
    totalSeeds: 0,
    totalVariations: 0,
    seedsBySubject: { matematika: 0, tpa: 0, bahasa_inggris: 0, bahasa_indonesia: 0 },
    lastSeedDate: null,
    seedStreak: 0,
    pendingValidation: 0,
  },

  // Settings
  preferences: {
    pomodoroLength: 25,
    breakLength: 5,
    interleaveDefault: true,
    confidenceSlider: true,
    showStreakAnxiety: false,
    keyboardShortcuts: true,
    autoVariateOnSubmit: true,
    drillSeedRatio: 0.10,
    drillVariationRatio: 0.60,
    drillPureLLMRatio: 0.30,
    showSourceBadge: true,
  },
};

// Fields persisted to localStorage (lightweight subset)
const PERSIST_FIELDS = [
  'onboarded', 'apiKey', 'examDates', 'primaryExamId',
  'activeModule', 'focusMode', 'theme', 'sidebarCollapsed',
  'topicMastery', 'streak', 'lastStudyDate', 'graceDayUsed',
  'srQueue', 'preferences', 'seedStats',
];

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'TOGGLE_FOCUS_MODE':
      return { ...state, focusMode: !state.focusMode };

    case 'COMPLETE_ONBOARDING':
      return { ...state, onboarded: true };

    case 'ADD_EXAM_DATE':
      return { ...state, examDates: [...state.examDates, action.payload] };

    case 'REMOVE_EXAM_DATE':
      return { ...state, examDates: state.examDates.filter(e => e.id !== action.payload) };

    case 'SET_PRIMARY_EXAM':
      return { ...state, primaryExamId: action.payload };

    case 'SET_DIAGNOSTIC':
      return { ...state, diagnosticResults: action.payload };

    case 'UPDATE_TOPIC_MASTERY':
      return {
        ...state,
        topicMastery: { ...state.topicMastery, [action.payload.key]: action.payload.value },
      };

    case 'ADD_SR_ITEM':
      return { ...state, srQueue: [...state.srQueue, action.payload] };

    case 'REVIEW_SR_ITEM':
      return {
        ...state,
        srQueue: state.srQueue.map(item =>
          item.id === action.payload.id
            ? { ...item, ...action.payload }
            : item
        ),
      };

    case 'LOG_DRILL':
      return { ...state, drillHistory: [action.payload, ...state.drillHistory].slice(0, 100) };

    case 'LOG_MOCK_EXAM':
      return { ...state, mockExamHistory: [action.payload, ...state.mockExamHistory] };

    case 'ADD_MISTAKE':
      return { ...state, mistakes: [action.payload, ...state.mistakes] };

    case 'MARK_MISTAKE_MASTERED':
      return {
        ...state,
        mistakes: state.mistakes.map(m =>
          m.id === action.payload ? { ...m, mastered: true } : m
        ),
      };

    case 'RETRY_MISTAKE':
      return {
        ...state,
        mistakes: state.mistakes.map(m =>
          m.id === action.payload ? { ...m, retryCount: (m.retryCount || 0) + 1 } : m
        ),
      };

    case 'LOG_CONFIDENCE':
      return { ...state, calibrationLog: [...state.calibrationLog, action.payload] };

    case 'START_FOCUS_SESSION':
      return { ...state, focusSessions: [...state.focusSessions, action.payload] };

    case 'END_FOCUS_SESSION':
      return {
        ...state,
        focusSessions: state.focusSessions.map((s, i) =>
          i === state.focusSessions.length - 1 ? { ...s, completed: true } : s
        ),
        totalFocusMinutes: state.totalFocusMinutes + (action.payload?.durationMin || 0),
      };

    case 'UPDATE_PREFERENCES':
      return { ...state, preferences: { ...state.preferences, ...action.payload } };

    case 'INCREMENT_STREAK':
      return { ...state, streak: state.streak + 1, lastStudyDate: new Date().toISOString().split('T')[0] };

    case 'USE_GRACE_DAY':
      return { ...state, graceDayUsed: true };

    case 'ADD_SEED':
      return {
        ...state,
        seedStats: { ...state.seedStats, totalSeeds: state.seedStats.totalSeeds + 1 },
      };

    case 'UPDATE_SEED':
      return state;

    case 'DELETE_SEED':
      return {
        ...state,
        seedStats: { ...state.seedStats, totalSeeds: Math.max(0, state.seedStats.totalSeeds - 1) },
      };

    case 'FLAG_SEED':
      return {
        ...state,
        seedStats: { ...state.seedStats, pendingValidation: state.seedStats.pendingValidation + 1 },
      };

    case 'RESOLVE_SEED_FLAG':
      return {
        ...state,
        seedStats: { ...state.seedStats, pendingValidation: Math.max(0, state.seedStats.pendingValidation - 1) },
      };

    case 'ADD_VARIATION':
      return {
        ...state,
        seedStats: { ...state.seedStats, totalVariations: state.seedStats.totalVariations + 1 },
      };

    case 'DELETE_VARIATION':
      return {
        ...state,
        seedStats: { ...state.seedStats, totalVariations: Math.max(0, state.seedStats.totalVariations - 1) },
      };

    case 'INCREMENT_SEED_STREAK':
      return {
        ...state,
        seedStats: {
          ...state.seedStats,
          seedStreak: state.seedStats.seedStreak + 1,
          lastSeedDate: new Date().toISOString().split('T')[0],
        },
      };

    case 'REFRESH_SEED_STATS':
      return { ...state, seedStats: { ...state.seedStats, ...action.payload } };

    case 'IMPORT_DATA':
      return { ...state, ...action.payload };

    case 'RESET_ALL':
      return { ...initialState };

    case 'SET_MODULE':
      return { ...state, activeModule: action.payload };

    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, () => {
    const saved = loadFromLocalStorage(STORAGE_KEY);
    if (saved) {
      return { ...initialState, ...saved };
    }
    return initialState;
  });

  // Persist lightweight fields to localStorage on state change
  useEffect(() => {
    const toPersist = {};
    for (const key of PERSIST_FIELDS) {
      toPersist[key] = state[key];
    }
    saveToLocalStorage(STORAGE_KEY, toPersist);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
