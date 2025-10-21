import { identifyCarrier } from '../../services/carrier-script-manager.js';

describe('carrier-script-manager', () => {
  describe('identifyCarrier', () => {
    it('should identify abacus carrier', () => {
      expect(identifyCarrier('https://portal.abacus.net/login')).toBe('abacus');
      expect(identifyCarrier('https://abacus.com/login')).toBe('abacus');
    });

    it('should identify advantage-partners carrier', () => {
      expect(identifyCarrier('https://advantage.com/login')).toBe('advantage-partners');
      expect(identifyCarrier('https://advantagepartners.com/login')).toBe('advantage-partners');
    });

    it('should identify amerisafe carrier', () => {
      expect(identifyCarrier('https://amerisafe.com/login')).toBe('amerisafe');
      expect(identifyCarrier('https://portal.amerisafe.com/login')).toBe('amerisafe');
    });

    it('should return unknown for unrecognized carrier', () => {
      expect(identifyCarrier('https://unknown-carrier.com/login')).toBe('unknown');
      expect(identifyCarrier('https://example.com/login')).toBe('unknown');
    });

    it('should handle invalid URLs', () => {
      expect(identifyCarrier('not-a-url')).toBe('unknown');
      expect(identifyCarrier('')).toBe('unknown');
    });
  });
});
