import { filterStatementsByDate } from '../../services/statement-processor.js';
import type { Statement } from '../../types/index.js';

describe('statement-processor', () => {
  describe('filterStatementsByDate', () => {
    const statements: Statement[] = [
      { pdfUrl: 'url1', statementDate: '2024-01-15' },
      { pdfUrl: 'url2', statementDate: '2024-02-15' },
      { pdfUrl: 'url3', statementDate: '2024-03-15' },
      { pdfUrl: 'url4', statementDate: '2023-12-15' },
    ];

    it('should filter statements after the cutoff date', () => {
      const filtered = filterStatementsByDate(statements, '2024-02-01');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].statementDate).toBe('2024-02-15');
      expect(filtered[1].statementDate).toBe('2024-03-15');
    });

    it('should exclude statements on the cutoff date', () => {
      const filtered = filterStatementsByDate(statements, '2024-02-15');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].statementDate).toBe('2024-03-15');
    });

    it('should return empty array if no statements match', () => {
      const filtered = filterStatementsByDate(statements, '2024-04-01');
      expect(filtered).toHaveLength(0);
    });

    it('should return all statements if all are after cutoff', () => {
      const filtered = filterStatementsByDate(statements, '2023-01-01');
      expect(filtered).toHaveLength(4);
    });

    it('should handle empty statements array', () => {
      const filtered = filterStatementsByDate([], '2024-01-01');
      expect(filtered).toHaveLength(0);
    });
  });
});
