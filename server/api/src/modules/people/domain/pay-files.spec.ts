import { bankFile, csvField, momoFile, payeDeclaration, PROVISIONAL, rssbDeclaration, type PayeeRow } from './pay-files';

const payee = (p: Partial<PayeeRow>): PayeeRow => ({
  employeeId: 'e1',
  employeeNumber: 'EMP0001',
  name: 'Uwase Aline',
  netRwf: 150_000,
  account: { kind: 'bank', bankName: 'Bank of Kigali', branchName: 'Remera', accountNumber: '0004-0123', momoPhone: null },
  ...p,
});

describe('the files a confirmed run produces (058-payroll AC-PY10, AC-PY12)', () => {
  it('says it is provisional on its first line', () => {
    expect(bankFile([payee({})], 'PAY-2026-10').text.split('\r\n')[0]).toBe(PROVISIONAL);
  });

  it('puts bank accounts in the bank file and lists everyone else as left out, with why', () => {
    const momo = payee({ employeeId: 'e2', name: 'Habimana Eric', account: { kind: 'momo', bankName: null, branchName: null, accountNumber: null, momoPhone: '+250788000111' } });
    const none = payee({ employeeId: 'e3', account: null });
    const bank = bankFile([payee({}), momo, none], 'PAY-2026-10');
    expect(bank.included.map((r) => r.employeeId)).toEqual(['e1']);
    expect(bank.leftOut.map((l) => l.reason)).toEqual(['Paid by MoMo, not by bank.', 'No primary pay account.']);
    expect(bank.text).toContain('EMP0001,Uwase Aline,Bank of Kigali,Remera,0004-0123,150000,PAY-2026-10');
    const mobile = momoFile([payee({}), momo], 'PAY-2026-10');
    expect(mobile.text).toContain('+250788000111,Habimana Eric,150000,PAY-2026-10');
  });

  it('quotes what must be quoted and defuses a formula', () => {
    expect(csvField('Mukamana, Fiona')).toBe('"Mukamana, Fiona"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('-HYPERLINK(x)')).toBe("'-HYPERLINK(x)");
    expect(csvField('+250788000111')).toBe('+250788000111');
    expect(csvField(-5)).toBe('-5');
  });

  it('declares PAYE on the base the bands were applied to, and each contribution share apart', () => {
    const row = {
      employeeNumber: 'EMP0001',
      name: 'Uwase Aline',
      rssbNumber: 'RS1',
      idNumber: '1199',
      grossRwf: 200_000,
      payeRwf: 20_000,
      lines: [
        { code: 'pension', label: 'Pension', contractId: null, basis: '', amountRwf: 10_000, side: 'employee' as const },
        { code: 'pension', label: 'Pension', contractId: null, basis: '', amountRwf: 10_000, side: 'employer' as const },
        { code: 'paye', label: 'PAYE', contractId: null, basis: '', amountRwf: 20_000, side: 'employee' as const, taxBase: 189_400 },
      ],
    };
    expect(payeDeclaration([row], { name: 'Amahoro', tin: '999000111' }, '2026-10')).toContain('EMP0001,Uwase Aline,1199,200000,189400,20000');
    const rssb = rssbDeclaration([row], { name: 'Amahoro', rssbEmployerNumber: 'R-1' }, '2026-10');
    expect(rssb).toContain('employee_number,name,rssb_number,gross_rwf,pension_employee_rwf,pension_employer_rwf');
    expect(rssb).toContain('EMP0001,Uwase Aline,RS1,200000,10000,10000');
  });
});
