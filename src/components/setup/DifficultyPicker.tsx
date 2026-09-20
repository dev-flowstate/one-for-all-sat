import { Checkbox } from '../ui/Checkbox';
import { DIFFICULTIES } from '../../data/taxonomy';
import type { Difficulty } from '../../types/question';

interface DifficultyPickerProps {
  selected: Difficulty[];
  onToggle: (difficulty: Difficulty) => void;
}

export function DifficultyPicker({ selected, onToggle }: DifficultyPickerProps) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {DIFFICULTIES.map((difficulty) => (
        <Checkbox
          key={difficulty}
          id={`difficulty-${difficulty}`}
          label={difficulty}
          checked={selected.includes(difficulty)}
          onChange={() => onToggle(difficulty)}
        />
      ))}
    </div>
  );
}
