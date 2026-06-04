import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../auth.js';
import { getProfile, upsertProfile } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resumeStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', '..', 'data', 'resumes'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `resume-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
    }
  },
});

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET / - get user profile
router.get('/', (req: Request, res: Response): void => {
  try {
    const profile = getProfile(req.userId!);
    if (!profile) {
      res.json({ profile: null });
      return;
    }

    res.json({
      profile: {
        ...profile,
        cities: JSON.parse(profile.cities),
        skills: JSON.parse(profile.skills),
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT / - upsert profile
router.put('/', (req: Request, res: Response): void => {
  try {
    const { title, cities, salary_min, salary_max, experience_years, skills, summary } = req.body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (cities !== undefined) data.cities = JSON.stringify(cities);
    if (salary_min !== undefined) data.salary_min = salary_min;
    if (salary_max !== undefined) data.salary_max = salary_max;
    if (experience_years !== undefined) data.experience_years = experience_years;
    if (skills !== undefined) data.skills = JSON.stringify(skills);
    if (summary !== undefined) data.summary = summary;

    const profile = upsertProfile(req.userId!, data);

    res.json({
      profile: {
        ...profile,
        cities: JSON.parse(profile.cities),
        skills: JSON.parse(profile.skills),
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /resume - upload resume
router.post('/resume', upload.single('resume'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const profile = upsertProfile(req.userId!, { resume_path: req.file.path });

    res.json({
      message: 'Resume uploaded successfully',
      profile: {
        ...profile,
        cities: JSON.parse(profile.cities),
        skills: JSON.parse(profile.skills),
      },
    });
  } catch (err) {
    console.error('Upload resume error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
