import type { Subject } from '../types/question';

export interface Domain {
  id: string;
  name: string;
  subject: Subject;
  skills: string[];
}

/**
 * The official College Board digital SAT domain/skill taxonomy. This is a public
 * category structure (not copyrighted question content) — it's what the Setup
 * screen's filters and the personal PDF-import parser both key off of.
 */
export const DOMAINS: Domain[] = [
  {
    id: 'algebra',
    name: 'Algebra',
    subject: 'math',
    skills: [
      'Linear equations in one variable',
      'Linear equations in two variables',
      'Linear functions',
      'Systems of two linear equations in two variables',
      'Linear inequalities in one or two variables',
    ],
  },
  {
    id: 'advanced-math',
    name: 'Advanced Math',
    subject: 'math',
    skills: [
      'Nonlinear functions',
      'Nonlinear equations in one variable and systems of equations in two variables',
      'Equivalent expressions',
    ],
  },
  {
    id: 'problem-solving-data-analysis',
    name: 'Problem-Solving and Data Analysis',
    subject: 'math',
    skills: [
      'Ratios, rates, proportional relationships, and units',
      'Percentages',
      'One-variable data: Distributions and measures of center and spread',
      'Two-variable data: Models and scatterplots',
      'Probability and conditional probability',
      'Inference from sample statistics and margin of error',
      'Evaluating statistical claims: Observational studies and experiments',
    ],
  },
  {
    id: 'geometry-trigonometry',
    name: 'Geometry and Trigonometry',
    subject: 'math',
    skills: ['Area and volume', 'Lines, angles, and triangles', 'Right triangles and trigonometry', 'Circles'],
  },
  {
    id: 'information-ideas',
    name: 'Information and Ideas',
    subject: 'reading-writing',
    skills: ['Central Ideas and Details', 'Inferences', 'Command of Evidence'],
  },
  {
    id: 'craft-structure',
    name: 'Craft and Structure',
    subject: 'reading-writing',
    skills: ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  },
  {
    id: 'expression-of-ideas',
    name: 'Expression of Ideas',
    subject: 'reading-writing',
    skills: ['Rhetorical Synthesis', 'Transitions'],
  },
  {
    id: 'standard-english-conventions',
    name: 'Standard English Conventions',
    subject: 'reading-writing',
    skills: ['Boundaries', 'Form, Structure, and Sense'],
  },
];

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

export function domainsForSubject(subject: Subject): Domain[] {
  return DOMAINS.filter((d) => d.subject === subject);
}
