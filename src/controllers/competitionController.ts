import { Request, Response, NextFunction } from 'express';
import * as competitionService from '../modules/competition';
import { CompetitionError } from '../modules/competition';

// Define a type for Express route handlers that might deal with Multer files
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Error handling utility for controllers
const handleServiceCall = async (
  serviceFn: () => Promise<any> | any,
  res: Response,
  successStatusCode: number = 200,
  redirectUrl?: string
) => {
  try {
    const result = await serviceFn();
    if (redirectUrl) {
      res.redirect(redirectUrl);
    } else if (result === undefined && successStatusCode === 200) { // For delete operations or similar void returns
        res.status(204).send(); // No Content is more appropriate than 200 for void success
    } else {
      res.status(successStatusCode).json(result);
    }
  } catch (error: any) {
    if (error instanceof CompetitionError) {
      res.status(error.statusCode).send(error.message);
    } else {
      // Generic error
      res.status(500).send(error.message || 'An unexpected error occurred.');
    }
  }
};

export const handleFileUpload = async (req: MulterRequest, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const filePath = req.file.path;
  await handleServiceCall(
    () => competitionService.processUploadedFile(filePath),
    res,
    undefined, // No specific success status code, will rely on redirect
    '/competition/upload.html' // Redirect path
  );
};

export const getMeetSummary = async (req: Request, res: Response) => {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  await handleServiceCall(
    () => competitionService.getMeetSummaryService(meetIndex, sessionIndex),
    res
  );
};

export const getEvents = async (req: Request, res: Response) => {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  await handleServiceCall(
    () => competitionService.getEventsService(meetIndex, sessionIndex),
    res
  );
};

export const getEvent = async (req: Request, res: Response) => {
  const eventNumber = parseInt(req.params.event, 10);
  if (isNaN(eventNumber)) {
    return res.status(400).send('Invalid event number.');
  }
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  await handleServiceCall(
    () => competitionService.getEventService(eventNumber, meetIndex, sessionIndex),
    res
  );
};

export const getHeat = async (req: Request, res: Response) => {
  const eventNumber = parseInt(req.params.event, 10);
  const heatNumber = parseInt(req.params.heat, 10);
  if (isNaN(eventNumber) || isNaN(heatNumber)) {
    return res.status(400).send('Invalid event or heat number.');
  }
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  await handleServiceCall(
    () => competitionService.getHeatService(eventNumber, heatNumber, meetIndex, sessionIndex),
    res
  );
};

export const deleteCompetition = async (req: Request, res: Response) => {
  await handleServiceCall(
    () => competitionService.deleteCompetitionService(),
    res,
    200 // Original code sent 200 with 'Competition deleted'
          // handleServiceCall will send 204 if serviceFn returns undefined
          // To match original, we can make deleteCompetitionService return a success message
          // Or adjust handleServiceCall / controller to send specific message for delete
  );
};

// If deleteCompetitionService is modified to return a message:
// export const deleteCompetition = async (req: Request, res: Response) => {
//   await handleServiceCall(
//     async () => {
//       await competitionService.deleteCompetitionService();
//       return { message: 'Competition deleted successfully' }; // Or just the string
//     },
//     res,
//     200
//   );
// };

// For now, keeping deleteCompetition simple and relying on 204 or error.
// The original sent "Competition deleted" with 200.
// Let's adjust deleteCompetition to match that more closely.
export const deleteCompetitionController = async (req: Request, res: Response) => {
  try {
    await competitionService.deleteCompetitionService();
    res.status(200).send('Competition deleted');
  } catch (error: any) {
    if (error instanceof CompetitionError) {
      res.status(error.statusCode).send(error.message);
    } else {
      res.status(500).send(error.message || 'An unexpected error occurred while deleting competition.');
    }
  }
};
// Re-exporting the refined deleteCompetitionController as deleteCompetition for routes.ts
export { deleteCompetitionController as deleteCompetition };

// Note: Added NextFunction to handleFileUpload for potential future middleware use, though not strictly necessary now.
// The handleServiceCall utility simplifies try-catch blocks and standardizes responses.
// For deleteCompetition, used a more direct implementation to match the original 200 status with message.
// If service returns undefined and status is 200, handleServiceCall sends 204.
// Adjusted deleteCompetition to use the specific deleteCompetitionController for clarity.
// Added NaN checks for parsed numbers from params/query.
