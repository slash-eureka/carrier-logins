import * as workflow from '../../services/workflow-manager.js';

describe('workflow-manager', () => {
  describe('identify', () => {
    it('should identify net_abacus carrier', () => {
      expect(workflow.identify('https://portal.abacus.net/login')).toBe(
        'net_abacus',
      );
      expect(workflow.identify('https://abacus.net/login')).toBe('net_abacus');
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
