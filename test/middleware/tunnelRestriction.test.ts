import { Request, Response } from 'express';
import { tunnelRestrictionMiddleware } from '../../src/middleware/tunnelRestriction';

describe('tunnelRestrictionMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const createMockRequest = (path: string, cfConnectingIp?: string): Partial<Request> => {
    return {
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      } as unknown as import('net').Socket,
      headers: cfConnectingIp ? { 'cf-connecting-ip': cfConnectingIp } : {},
      path,
    };
  };

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      redirect: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('Local access (no Cloudflare)', () => {
    it('should allow all requests from localhost', () => {
      mockRequest = createMockRequest('/competition/remote.html');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow administrative routes from localhost', () => {
      mockRequest = createMockRequest('/index.html');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow tunnel config page from localhost', () => {
      mockRequest = createMockRequest('/tunnel.html');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Cloudflare tunnel access', () => {
    it('should allow competition screen via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/screen.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow competition screen JS via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/screen.js', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow CSS files via Cloudflare', () => {
      mockRequest = createMockRequest('/css/output.css', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow images via Cloudflare', () => {
      mockRequest = createMockRequest('/image/logo.png', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow main.js via Cloudflare', () => {
      mockRequest = createMockRequest('/js/main.js', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow timeSync.js via Cloudflare', () => {
      mockRequest = createMockRequest('/js/timeSync.js', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow competition event API via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/event/1/heat/2', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow competition summary API via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/summary', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow devices API via Cloudflare', () => {
      mockRequest = createMockRequest('/devices', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block remote control via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/remote.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Access to this resource via tunnel is not allowed'
      );
    });

    it('should block upload page via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/upload.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should redirect dashboard to competition screen via Cloudflare', () => {
      mockRequest = createMockRequest('/index.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith('/competition/screen.html');
    });

    it('should redirect root to competition screen via Cloudflare', () => {
      mockRequest = createMockRequest('/', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith('/competition/screen.html');
    });

    it('should block tunnel config via Cloudflare', () => {
      mockRequest = createMockRequest('/tunnel.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should block training pages via Cloudflare', () => {
      mockRequest = createMockRequest('/training/training-remote.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should block devices management via Cloudflare', () => {
      mockRequest = createMockRequest('/devices.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should block log viewer via Cloudflare', () => {
      mockRequest = createMockRequest('/competition/log.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing headers gracefully', () => {
      mockRequest = {
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' } as unknown as import('net').Socket,
        headers: undefined,
        path: '/competition/screen.html',
      };

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing IP addresses', () => {
      mockRequest = {
        ip: undefined,
        socket: { remoteAddress: undefined } as unknown as import('net').Socket,
        headers: {},
        path: '/index.html',
      };

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('AllowAllRoutes configuration', () => {
    let loadConfigSpy: jest.SpyInstance;

    afterEach(() => {
      if (loadConfigSpy) {
        loadConfigSpy.mockRestore();
      }
    });

    it('should allow all routes via Cloudflare when allowAllRoutes is true', () => {
      // Mock loadConfig to return a config with allowAllRoutes enabled
      const tunnelModule = jest.requireActual('../../src/modules/tunnel');
      loadConfigSpy = jest.spyOn(tunnelModule, 'loadConfig').mockReturnValue({ 
        token: 'test', 
        autoStart: false, 
        allowAllRoutes: true 
      });

      // This test verifies that when allowAllRoutes is enabled, 
      // restricted routes like /competition/remote.html are accessible via Cloudflare
      mockRequest = createMockRequest('/competition/remote.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // When allowAllRoutes is true, next() should be called
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block routes via Cloudflare when allowAllRoutes is false', () => {
      // Mock loadConfig to return a config with allowAllRoutes disabled
      const tunnelModule = jest.requireActual('../../src/modules/tunnel');
      loadConfigSpy = jest.spyOn(tunnelModule, 'loadConfig').mockReturnValue({ 
        token: 'test', 
        autoStart: false, 
        allowAllRoutes: false 
      });

      mockRequest = createMockRequest('/competition/remote.html', '1.2.3.4');

      tunnelRestrictionMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // When allowAllRoutes is false, status(403) should be called
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });
});
