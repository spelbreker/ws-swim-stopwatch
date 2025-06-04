import fs from 'fs';
import { Request, Response } from 'express';
import { getHeat as getHeatModule } from '../../../modules/competition';
import { CompetitionData } from '../../../types/types';

function loadCompetitionData(): CompetitionData | null {
  if (!fs.existsSync('./public/competition.json')) return null;
  return JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
}

export function getHeat(req: Request, res: Response) {
  const eventNumber = parseInt(req.params.event, 10);
  const heatNumber = parseInt(req.params.heat, 10);
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  if (!eventNumber || !heatNumber) {
    res.status(400).send('Missing eventNumber or heatNumber');
    return;
  }
  const data = loadCompetitionData();
  if (!data) {
    res.status(500).send('Missing competition.json');
    return;
  }
  try {
    const result = getHeatModule(data, meetIndex, sessionIndex, eventNumber, heatNumber);
    if (!result) {
      res.status(404).send('Heat or entries not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (e) {
    res.status(500).send('Error getting heat');
  }
}
