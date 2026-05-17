import { Router } from 'express';
import { getDB } from '../db/database.js';
import {
  getState,
  updateState,
  listSeeds,
  createSeed,
  updateSeed,
  deleteSeed,
  listVariations,
  createVariation,
  deleteVariation,
  listMistakes,
  createMistake,
  updateMistake,
  deleteMistake,
  listDrills,
  createDrill,
  listMocks,
  createMock,
  listSRItems,
  createSRItem,
  updateSRItem,
  deleteSRItem,
  exportAll,
  importAll,
} from '../db/queries.js';

const router = Router();

// ─── State ──────────────────────────────────────────────────────────────────

router.get('/state', (req, res) => {
  try {
    const db = getDB();
    const state = getState(db);
    return res.json(state);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get state' });
  }
});

router.put('/state', (req, res) => {
  try {
    const db = getDB();
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const merged = updateState(db, req.body);
    return res.json(merged);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update state' });
  }
});

// ─── Seeds ──────────────────────────────────────────────────────────────────

router.get('/seeds', (req, res) => {
  try {
    const db = getDB();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { subject, topic } = req.query;
    const result = listSeeds(db, { page, limit, subject, topic });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list seeds' });
  }
});

router.post('/seeds', (req, res) => {
  try {
    const db = getDB();
    if (!req.body || !req.body.question || !req.body.subject) {
      return res.status(400).json({ error: 'Fields "question" and "subject" are required' });
    }
    const result = createSeed(db, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create seed' });
  }
});

router.put('/seeds/:id', (req, res) => {
  try {
    const db = getDB();
    const result = updateSeed(db, req.params.id, req.body);
    if (!result) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update seed' });
  }
});

router.delete('/seeds/:id', (req, res) => {
  try {
    const db = getDB();
    const result = deleteSeed(db, req.params.id);
    if (!result.deleted) {
      return res.status(404).json({ error: 'Seed not found' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete seed' });
  }
});

// ─── Variations ─────────────────────────────────────────────────────────────

router.get('/variations', (req, res) => {
  try {
    const db = getDB();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { parent_seed_id } = req.query;
    const result = listVariations(db, { page, limit, parent_seed_id });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list variations' });
  }
});

router.post('/variations', (req, res) => {
  try {
    const db = getDB();
    if (!req.body || !req.body.parent_seed_id || !req.body.question || !req.body.subject) {
      return res.status(400).json({ error: 'Fields "parent_seed_id", "question", and "subject" are required' });
    }
    const result = createVariation(db, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create variation' });
  }
});

router.delete('/variations/:id', (req, res) => {
  try {
    const db = getDB();
    const result = deleteVariation(db, req.params.id);
    if (!result.deleted) {
      return res.status(404).json({ error: 'Variation not found' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete variation' });
  }
});

// ─── Mistakes ───────────────────────────────────────────────────────────────

router.get('/mistakes', (req, res) => {
  try {
    const db = getDB();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { subject } = req.query;
    const mastered = req.query.mastered !== undefined
      ? req.query.mastered === 'true' || req.query.mastered === '1'
      : undefined;
    const result = listMistakes(db, { page, limit, mastered, subject });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list mistakes' });
  }
});

router.post('/mistakes', (req, res) => {
  try {
    const db = getDB();
    if (!req.body || !req.body.question || !req.body.subject) {
      return res.status(400).json({ error: 'Fields "question" and "subject" are required' });
    }
    const result = createMistake(db, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create mistake' });
  }
});

router.put('/mistakes/:id', (req, res) => {
  try {
    const db = getDB();
    const result = updateMistake(db, req.params.id, req.body);
    if (!result) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update mistake' });
  }
});

router.delete('/mistakes/:id', (req, res) => {
  try {
    const db = getDB();
    const result = deleteMistake(db, req.params.id);
    if (!result.deleted) {
      return res.status(404).json({ error: 'Mistake not found' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete mistake' });
  }
});

// ─── Drills ─────────────────────────────────────────────────────────────────

router.get('/drills', (req, res) => {
  try {
    const db = getDB();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = listDrills(db, { page, limit });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list drills' });
  }
});

router.post('/drills', (req, res) => {
  try {
    const db = getDB();
    const result = createDrill(db, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to log drill session' });
  }
});

// ─── Mocks ──────────────────────────────────────────────────────────────────

router.get('/mocks', (req, res) => {
  try {
    const db = getDB();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = listMocks(db, { page, limit });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list mocks' });
  }
});

router.post('/mocks', (req, res) => {
  try {
    const db = getDB();
    const result = createMock(db, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to log mock exam' });
  }
});

// ─── SR Items ───────────────────────────────────────────────────────────────

router.get('/sr', (req, res) => {
  try {
    const db = getDB();
    const data = listSRItems(db);
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list SR items' });
  }
});

router.post('/sr', (req, res) => {
  try {
    const db = getDB();
    if (!req.body || !req.body.subject || !req.body.topic) {
      return res.status(400).json({ error: 'Fields "subject" and "topic" are required' });
    }
    const result = createSRItem(db, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create SR item' });
  }
});

router.put('/sr/:id', (req, res) => {
  try {
    const db = getDB();
    const result = updateSRItem(db, req.params.id, req.body);
    if (!result) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update SR item' });
  }
});

router.delete('/sr/:id', (req, res) => {
  try {
    const db = getDB();
    const result = deleteSRItem(db, req.params.id);
    if (!result.deleted) {
      return res.status(404).json({ error: 'SR item not found' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete SR item' });
  }
});

// ─── Export / Import ────────────────────────────────────────────────────────

router.get('/export', (req, res) => {
  try {
    const db = getDB();
    const data = exportAll(db);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

router.post('/import', (req, res) => {
  try {
    const db = getDB();
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const validTables = ['user_state', 'seeds', 'variations', 'mistakes', 'drill_history', 'mock_history', 'sr_items'];
    const hasValidData = validTables.some((table) => Array.isArray(req.body[table]));
    if (!hasValidData) {
      return res.status(400).json({ error: 'Import data must contain at least one valid table array. Valid tables: ' + validTables.join(', ') });
    }
    const result = importAll(db, req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to import data: ' + err.message });
  }
});

export default router;
