import { z } from 'zod';

export const choiceSchema = z.object({
  id: z.enum(['A', 'B', 'C', 'D']),
  text: z.string().min(1),
  image: z.string().optional(),
});

export const questionImageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().optional(),
});

export const questionSchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(['math', 'reading-writing']),
    domain: z.string().min(1),
    skill: z.string().min(1),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    type: z.enum(['mcq', 'spr']),
    passage: z.string().optional(),
    prompt: z.string().min(1),
    choices: z.array(choiceSchema).optional(),
    correctChoice: z.enum(['A', 'B', 'C', 'D']).optional(),
    acceptableAnswers: z.array(z.string()).optional(),
    explanation: z.string(),
    images: z.array(questionImageSchema).optional(),
    source: z.enum(['bundled', 'imported']),
  })
  .refine((q) => (q.type === 'mcq' ? !!q.choices?.length && !!q.correctChoice : true), {
    message: 'mcq questions require choices and correctChoice',
  })
  .refine((q) => (q.type === 'spr' ? !!q.acceptableAnswers?.length : true), {
    message: 'spr questions require acceptableAnswers',
  });

export const questionBankFileSchema = z.object({
  questions: z.array(questionSchema),
});

export type QuestionBankFile = z.infer<typeof questionBankFileSchema>;
