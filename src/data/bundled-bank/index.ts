import type { Question } from '../../types/question';
import { questionSchema } from '../../lib/schema';

import algebra from './math/algebra.json';
import advancedMath from './math/advanced-math.json';
import problemSolvingDataAnalysis from './math/problem-solving-data-analysis.json';
import geometryTrigonometry from './math/geometry-trigonometry.json';
import informationIdeas from './reading-writing/information-ideas.json';
import craftStructure from './reading-writing/craft-structure.json';
import expressionOfIdeas from './reading-writing/expression-of-ideas.json';
import standardEnglishConventions from './reading-writing/standard-english-conventions.json';

const raw: unknown[] = [
  ...algebra,
  ...advancedMath,
  ...problemSolvingDataAnalysis,
  ...geometryTrigonometry,
  ...informationIdeas,
  ...craftStructure,
  ...expressionOfIdeas,
  ...standardEnglishConventions,
];

export const bundledQuestions: Question[] = raw.map((q) => questionSchema.parse(q) as Question);
