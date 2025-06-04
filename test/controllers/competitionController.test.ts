import { Request, Response, NextFunction } from 'express';
import * as competitionController from '../../src/controllers/competitionController';
import * as competitionService from '../../src/modules/competition';
import { CompetitionError } from '../../src/modules/competition';

// Mock the entire competitionService module
jest.mock('../../src/modules/competition');

// Define a type for Express.Multer.File if not already globally available or easily importable
// For testing purposes, a minimal mock is often sufficient.
interface MockFile {
  path: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
  fieldname?: string;
  filename?: string;
  destination?: string;
}


describe('Competition Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {
      params: {},
      query: {},
      file: undefined, // For MulterRequest
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn(); // Reset mockNext for each test
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleFileUpload', () => {
    it('should return 400 if no file is uploaded', async () => {
      mockRequest.file = undefined;
      await competitionController.handleFileUpload(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('No file uploaded.');
    });

    it('should call processUploadedFile and redirect on success', async () => {
      const mockFile = { path: 'temp/testfile.lxf' } as MockFile;
      mockRequest.file = mockFile as Express.Multer.File; // Cast to satisfy type, ensure mockFile has needed properties
      (competitionService.processUploadedFile as jest.Mock).mockResolvedValue(undefined);

      await competitionController.handleFileUpload(mockRequest as Request, mockResponse as Response, mockNext);

      expect(competitionService.processUploadedFile).toHaveBeenCalledWith(mockFile.path);
      expect(mockResponse.redirect).toHaveBeenCalledWith('/competition/upload.html');
    });

    it('should handle errors from processUploadedFile', async () => {
      const mockFile = { path: 'temp/testfile.lxf' } as MockFile;
      mockRequest.file = mockFile as Express.Multer.File;
      const errorMessage = 'File processing failed';
      (competitionService.processUploadedFile as jest.Mock).mockRejectedValue(new CompetitionError(errorMessage, 500));

      await competitionController.handleFileUpload(mockRequest as Request, mockResponse as Response, mockNext);

      expect(competitionService.processUploadedFile).toHaveBeenCalledWith(mockFile.path);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('getMeetSummary', () => {
    it('should call getMeetSummaryService and return summary data', async () => {
      const summaryData = { meetName: 'Test Meet' };
      mockRequest.query = { meet: '0', session: '0' };
      (competitionService.getMeetSummaryService as jest.Mock).mockResolvedValue(summaryData);

      await competitionController.getMeetSummary(mockRequest as Request, mockResponse as Response);

      expect(competitionService.getMeetSummaryService).toHaveBeenCalledWith(0, 0);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(summaryData);
    });

    it('should handle errors from getMeetSummaryService', async () => {
      mockRequest.query = { meet: '0', session: '0' };
      const errorMessage = 'Error fetching summary';
      (competitionService.getMeetSummaryService as jest.Mock).mockRejectedValue(new CompetitionError(errorMessage, 404));

      await competitionController.getMeetSummary(mockRequest as Request, mockResponse as Response);

      expect(competitionService.getMeetSummaryService).toHaveBeenCalledWith(0, 0);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('getEvents', () => {
    it('should call getEventsService and return events data', async () => {
      const eventsData = [{ id: '1', name: 'Event 1' }];
      mockRequest.query = { meet: '0', session: '0' };
      (competitionService.getEventsService as jest.Mock).mockResolvedValue(eventsData);

      await competitionController.getEvents(mockRequest as Request, mockResponse as Response);

      expect(competitionService.getEventsService).toHaveBeenCalledWith(0, 0);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(eventsData);
    });
  });

  describe('getEvent', () => {
    it('should call getEventService and return event data', async () => {
      const eventData = { id: '1', name: 'Event 1' };
      mockRequest.params = { event: '1' };
      mockRequest.query = { meet: '0', session: '0' };
      (competitionService.getEventService as jest.Mock).mockResolvedValue(eventData);

      await competitionController.getEvent(mockRequest as Request, mockResponse as Response);

      expect(competitionService.getEventService).toHaveBeenCalledWith(1, 0, 0);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(eventData);
    });

    it('should return 400 if event number is invalid', async () => {
      mockRequest.params = { event: 'invalid' };
      await competitionController.getEvent(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid event number.');
    });
  });

  describe('getHeat', () => {
    it('should call getHeatService and return heat data', async () => {
      const heatData = { id: '1', name: 'Heat 1' };
      mockRequest.params = { event: '1', heat: '1' };
      mockRequest.query = { meet: '0', session: '0' };
      (competitionService.getHeatService as jest.Mock).mockResolvedValue(heatData);

      await competitionController.getHeat(mockRequest as Request, mockResponse as Response);

      expect(competitionService.getHeatService).toHaveBeenCalledWith(1, 1, 0, 0);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(heatData);
    });

    it('should return 400 if event or heat number is invalid', async () => {
      mockRequest.params = { event: 'invalid', heat: '1' };
      await competitionController.getHeat(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid event or heat number.');

      mockRequest.params = { event: '1', heat: 'invalid' };
      await competitionController.getHeat(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid event or heat number.');
    });
  });

  describe('deleteCompetition', () => {
    // Using the re-exported deleteCompetitionController as deleteCompetition
    it('should call deleteCompetitionService and return 200 with message', async () => {
      (competitionService.deleteCompetitionService as jest.Mock).mockResolvedValue(undefined);

      await competitionController.deleteCompetition(mockRequest as Request, mockResponse as Response);

      expect(competitionService.deleteCompetitionService).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith('Competition deleted');
    });

    it('should handle errors from deleteCompetitionService', async () => {
      const errorMessage = 'Error deleting competition';
      (competitionService.deleteCompetitionService as jest.Mock).mockRejectedValue(new CompetitionError(errorMessage, 500));

      await competitionController.deleteCompetition(mockRequest as Request, mockResponse as Response);

      expect(competitionService.deleteCompetitionService).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(errorMessage);
    });

     it('should handle generic errors from deleteCompetitionService', async () => {
      const errorMessage = 'Some generic error';
      (competitionService.deleteCompetitionService as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await competitionController.deleteCompetition(mockRequest as Request, mockResponse as Response);

      expect(competitionService.deleteCompetitionService).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(errorMessage);
    });
  });
});
