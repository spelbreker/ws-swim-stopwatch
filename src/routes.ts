import express from 'express';
import multer from 'multer';
import {
  handleFileUpload,
  getMeetSummary,
  deleteCompetition,
  getHeat,
  getEvents,
  getEvent,
} from '../controllers/competitionController'; // Updated import path

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Moved multer instance here

// Competition routes
router.get('/competition/summary', getMeetSummary);
router.post('/competition/upload', upload.single('lenexFile'), handleFileUpload);
router.get('/competition/delete', deleteCompetition);
router.get('/competition/event/:event', getEvent);
router.get('/competition/event', getEvents);
router.get('/competition/event/:event/heat/:heat', getHeat);

export default router;
