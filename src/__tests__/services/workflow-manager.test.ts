import * as workflow from '../../services/workflow-manager.js';

describe('workflow-manager', () => {
  describe('identify', () => {
    it('should identify net_abacus carrier', () => {
      expect(workflow.identify('https://portal.abacus.net/login')).toBe(
        'net_abacus',
      );
      expect(workflow.identify('https://abacus.net/login')).toBe('net_abacus');
    });

    it('should identify com_ufginsurance carrier', () => {
      expect(workflow.identify('https://agents.ufginsurance.com/login')).toBe(
        'com_ufginsurance',
      );
    });

    it('should return carrier slug for any valid URL', () => {
      expect(workflow.identify('https://unknown-carrier.com/login')).toBe(
        'com_unknown-carrier',
      );
      expect(workflow.identify('https://example.com/login')).toBe('com_example');
    });

    it('should return unknown for invalid URLs', () => {
      expect(workflow.identify('not-a-url')).toBe('unknown');
      expect(workflow.identify('')).toBe('unknown');
    });
  });
});
