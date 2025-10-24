import * as workflow from '../../services/workflow-manager.js';

describe('workflow-manager', () => {
  describe('identify', () => {
    it('should identify net_abacus carrier', () => {
      expect(workflow.identify('https://portal.abacus.net/login')).toBe(
        'net_abacus',
      );
      expect(workflow.identify('https://abacus.net/login')).toBe('net_abacus');
    });

    it('should identify com_advantagepartners carrier', () => {
      expect(workflow.identify('https://advantagepartners.com/login')).toBe(
        'com_advantagepartners',
      );
      expect(
        workflow.identify('https://portal.advantagepartners.com/login'),
      ).toBe('com_advantagepartners');
    });

    it('should identify com_amerisafe carrier', () => {
      expect(workflow.identify('https://amerisafe.com/login')).toBe(
        'com_amerisafe',
      );
      expect(workflow.identify('https://portal.amerisafe.com/login')).toBe(
        'com_amerisafe',
      );
    });

    it('should return unknown for unrecognized carrier', () => {
      expect(workflow.identify('https://unknown-carrier.com/login')).toBe(
        'unknown',
      );
      expect(workflow.identify('https://example.com/login')).toBe('unknown');
    });

    it('should handle invalid URLs', () => {
      expect(workflow.identify('not-a-url')).toBe('unknown');
      expect(workflow.identify('')).toBe('unknown');
    });
  });
});
