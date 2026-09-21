interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function Tabs({ items, activeId, onChange }: TabsProps) {
  return (
    <div className="flex border-2 border-ink bg-paper">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          aria-pressed={activeId === item.id}
          className={`min-h-11 flex-1 px-3 py-2 font-mono text-sm font-semibold tracking-tight uppercase ${
            index > 0 ? 'border-l-2 border-ink' : ''
          } ${activeId === item.id ? 'bg-venice-blue text-merino' : 'text-ink hover:bg-merino-dark'}`}
        >
          {item.label}
          {item.count !== undefined && <span className="ml-1.5 opacity-70">[{item.count}]</span>}
        </button>
      ))}
    </div>
  );
}
