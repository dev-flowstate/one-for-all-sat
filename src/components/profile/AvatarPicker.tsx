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
          className={`flex h-11 w-11 items-center justify-center rounded-lg text-xl transition-colors ${
            selected === avatar
              ? 'bg-venice-blue text-merino ring-2 ring-venice-blue-dark'
              : 'bg-rock-blue/25 hover:bg-rock-blue/40'
          }`}
        >
          {avatar}
        </button>
      ))}
    </div>
  );
}
