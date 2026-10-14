import { useFinance } from '../finance/store/useFinance';
import { useStore } from '../store/useStore';
import { financeToday } from '../finance/utils/format';

/** Tüm verileri tek JSON dosyası olarak indir: MeLife + Para */
export function downloadFullBackup() {
  const s = useStore.getState();
  const f = useFinance.getState();
  const data = {
    app: 'MeLife',
    version: 3,
    exportedAt: new Date().toISOString(),
    melife: {
      settings: s.settings,
      trackers: s.trackers,
      days: Object.values(s.days),
      weeks: Object.values(s.weeks),
      tasks: s.tasks,
      taskRules: s.rules,
      inbox: s.inbox,
      courses: s.courses,
      exams: s.exams,
      sessions: s.sessions,
      library: s.library,
    },
    para: {
      userConfig: f.userConfig,
      assets: f.assets,
      debts: f.debts,
      transactions: f.transactions,
      savingsGoals: f.savingsGoals,
      cashflows: f.cashflows,
      budgetLimits: f.budgetLimits,
    },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `melife-yedek-${financeToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
