import Modal from '../components/Modal';
import AllTx from './components/AllTx';
import { AccountSheet, DebtSheet, GoalSheet } from './components/Holdings';
import MoneyEditor from './components/MoneyEditor';
import { BillEditor, BillPaySheet, MoneySettings, SalarySheet } from './components/Sheets';
import { useFinance } from './store/useFinance';
import { useMoneySheets, type MoneySheet } from './store/useMoneySheets';

const TITLES: Record<MoneySheet['t'], string> = {
  editor: 'Kayıt', salary: 'Maaş yattı', billPay: 'Ödendi mi?', bill: 'Abonelik / fatura',
  debt: 'Borç / kart', goal: 'Kumbara', account: 'Hesap', allTx: 'İşlemler', settings: 'Para ayarları',
};

function title(s: MoneySheet, names: { debt?: string; goal?: string; account?: string }): string {
  if (s.t === 'editor') return s.id ? 'Kaydı düzenle' : 'Yeni kayıt';
  if (s.t === 'debt') return names.debt ?? 'Yeni borç / kart';
  if (s.t === 'goal') return names.goal ?? 'Yeni kumbara';
  if (s.t === 'account') return names.account ?? 'Yeni hesap';
  if (s.t === 'bill') return s.id ? 'Abonelik / fatura' : 'Yeni abonelik / fatura';
  return TITLES[s.t];
}

/** Para'nın tüm alt sayfaları — uygulamanın her yerinden açılabilir (+ menüsü, Bugün, Hafta) */
export default function MoneySheets() {
  const { sheet, close } = useMoneySheets();
  const { debts, savingsGoals, assets } = useFinance();
  const id = sheet && 'id' in sheet ? sheet.id : undefined;
  const names = {
    debt: debts.find((d) => d.id === id)?.name,
    goal: savingsGoals.find((g) => g.id === id)?.name,
    account: assets.find((a) => a.id === id)?.name,
  };

  if (sheet?.t === 'allTx') return <AllTx />;

  const key = sheet ? `${sheet.t}-${id ?? 'new'}` : 'none';
  return (
    <Modal isOpen={!!sheet} onClose={close} title={sheet ? title(sheet, names) : ''}>
      {sheet?.t === 'editor' && <MoneyEditor key={key} id={sheet.id} preset={sheet.preset} />}
      {sheet?.t === 'salary' && <SalarySheet key={key} />}
      {sheet?.t === 'billPay' && <BillPaySheet key={key} id={sheet.id} />}
      {sheet?.t === 'bill' && <BillEditor key={key} id={sheet.id} />}
      {sheet?.t === 'debt' && <DebtSheet key={key} id={sheet.id} />}
      {sheet?.t === 'goal' && <GoalSheet key={key} id={sheet.id} />}
      {sheet?.t === 'account' && <AccountSheet key={key} id={sheet.id} />}
      {sheet?.t === 'settings' && <MoneySettings key={key} />}
    </Modal>
  );
}
