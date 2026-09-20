import { Checkbox } from '../ui/Checkbox';
import { domainsForSubject } from '../../data/taxonomy';
import type { Subject } from '../../types/question';

interface DomainPickerProps {
  selected: string[];
  onToggle: (domainName: string) => void;
}

const SUBJECTS: { id: Subject; label: string }[] = [
  { id: 'math', label: 'Math' },
  { id: 'reading-writing', label: 'Reading & Writing' },
];

/** Domain checkboxes grouped by subject. Selecting a domain filters at the domain level
 *  (skills within it are not filtered individually). */
export function DomainPicker({ selected, onToggle }: DomainPickerProps) {
  return (
    <div className="flex flex-col gap-5">
      {SUBJECTS.map((subject) => (
        <div key={subject.id}>
          <h3 className="mb-2 text-sm font-semibold text-venice-blue-dark">{subject.label}</h3>
          <div className="flex flex-col gap-2.5">
            {domainsForSubject(subject.id).map((domain) => (
              <Checkbox
                key={domain.id}
                id={`domain-${domain.id}`}
                label={domain.name}
                checked={selected.includes(domain.name)}
                onChange={() => onToggle(domain.name)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
