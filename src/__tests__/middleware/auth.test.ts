import type { Request, Response, NextFunction } from 'express';
import { authenticateApiKey } from '../../middleware/auth.js';

// Mock config
jest.mock('../../config/index.js', () => ({
  config: {
    apiKey: 'test-api-key-123',
  },
}));

describe('auth middleware', () => {
  describe('authenticateApiKey', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should call next() with valid API key', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-123' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when API key is missing', () => {
      mockRequest.headers = {};

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing X-API-Key header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when API key is invalid', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-api-key' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid API key',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
