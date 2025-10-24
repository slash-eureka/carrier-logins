import { identifyCarrier } from '../../services/workflow-manager.js';

describe('workflow-manager', () => {
  describe('identifyCarrier', () => {
    it('should identify net_abacus carrier', () => {
      expect(identifyCarrier('https://portal.abacus.net/login')).toBe(
        'net_abacus',
      );
      expect(identifyCarrier('https://abacus.com/login')).toBe('net_abacus');
    });

    it('should identify com_advantagepartners carrier', () => {
      expect(identifyCarrier('https://advantage.com/login')).toBe(
        'com_advantagepartners',
      );
      expect(identifyCarrier('https://advantagepartners.com/login')).toBe(
        'com_advantagepartners',
      );
    });

    it('should identify com_amerisafe carrier', () => {
      expect(identifyCarrier('https://amerisafe.com/login')).toBe(
        'com_amerisafe',
      );
      expect(identifyCarrier('https://portal.amerisafe.com/login')).toBe(
        'com_amerisafe',
      );
    });

    it('should return unknown for unrecognized carrier', () => {
      expect(identifyCarrier('https://unknown-carrier.com/login')).toBe(
        'unknown',
      );
      expect(identifyCarrier('https://example.com/login')).toBe('unknown');
    });

    it('should handle invalid URLs', () => {
      expect(identifyCarrier('not-a-url')).toBe('unknown');
      expect(identifyCarrier('')).toBe('unknown');
    });
  });
});
