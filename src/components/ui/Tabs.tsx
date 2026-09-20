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
    <div className="flex gap-1 rounded-lg bg-rock-blue/20 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeId === item.id ? 'bg-venice-blue text-merino' : 'text-venice-blue-dark hover:bg-rock-blue/30'
          }`}
        >
          {item.label}
          {item.count !== undefined && <span className="ml-1.5 opacity-75">({item.count})</span>}
        </button>
      ))}
    </div>
  );
}
