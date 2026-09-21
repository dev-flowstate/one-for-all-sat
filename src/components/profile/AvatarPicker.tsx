import { DEFAULT_AVATARS } from '../../types/settings';

interface AvatarPickerProps {
  selected: string;
  onSelect: (avatar: string) => void;
}

export function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DEFAULT_AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onSelect(avatar)}
          aria-pressed={selected === avatar}
          aria-label={`Avatar ${avatar}`}
          className={`press flex h-11 w-11 items-center justify-center border-2 border-ink text-xl ${
            selected === avatar
              ? 'bg-venice-blue shadow-[4px_4px_0_var(--color-ink)]'
              : 'bg-paper hover:bg-merino-dark'
          }`}
        >
          {avatar}
        </button>
      ))}
    </div>
  );
}
