import { mapErrorToFailureReason } from '../../services/rails-client.js';

describe('rails-client', () => {
  describe('mapErrorToFailureReason', () => {
    it('should map invalid credentials errors', () => {
      expect(mapErrorToFailureReason('Invalid credentials provided')).toBe('invalid_credentials');
      expect(mapErrorToFailureReason('Login failed - wrong password')).toBe('invalid_credentials');
    });

    it('should map MFA errors', () => {
      expect(mapErrorToFailureReason('MFA required')).toBe('requires_mfa');
      expect(mapErrorToFailureReason('Two-factor authentication needed')).toBe('requires_mfa');
    });

    it('should map carrier unavailable errors', () => {
      expect(mapErrorToFailureReason('Site unavailable')).toBe('carrier_unavailable');
      expect(mapErrorToFailureReason('Timeout waiting for response')).toBe('carrier_unavailable');
      expect(mapErrorToFailureReason('Network error occurred')).toBe('carrier_unavailable');
    });

    it('should map missing instruction errors', () => {
      expect(mapErrorToFailureReason('Unknown carrier')).toBe('missing_instruction');
      expect(mapErrorToFailureReason('Script not found')).toBe('missing_instruction');
    });

    it('should map password change errors', () => {
      expect(mapErrorToFailureReason('Password expired')).toBe('password_change');
      expect(mapErrorToFailureReason('Must change password')).toBe('password_change');
    });

    it('should default to carrier_unavailable for unknown errors', () => {
      expect(mapErrorToFailureReason('Random error')).toBe('carrier_unavailable');
      expect(mapErrorToFailureReason('Unexpected failure')).toBe('carrier_unavailable');
    });

    it('should be case-insensitive', () => {
      expect(mapErrorToFailureReason('INVALID CREDENTIALS')).toBe('invalid_credentials');
      expect(mapErrorToFailureReason('MFA REQUIRED')).toBe('requires_mfa');
    });
  });
});
