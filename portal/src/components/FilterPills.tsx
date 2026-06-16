const STATE_STYLES: Record<string, { active: string; border: string; text: string }> = {
  '':         { active: 'bg-slate-700 text-white',   border: 'border-slate-300',  text: 'text-slate-600'  },
  THRIVING:   { active: 'bg-green-600 text-white',   border: 'border-green-400',  text: 'text-green-700'  },
  DECLINING:  { active: 'bg-yellow-500 text-white',  border: 'border-yellow-400', text: 'text-yellow-700' },
  DORMANT:    { active: 'bg-slate-400 text-white',   border: 'border-slate-300',  text: 'text-slate-500'  },
  DEAD:       { active: 'bg-red-600 text-white',     border: 'border-red-300',    text: 'text-red-600'    },
}

const LABELS: Record<string, string> = {
  '': 'All', THRIVING: 'Thriving', DECLINING: 'Declining', DORMANT: 'Dormant', DEAD: 'Dead',
}

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function FilterPills({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Object.keys(STATE_STYLES).map((s) => {
        const styles = STATE_STYLES[s]
        const isActive = value === s
        return (
          <button
            key={s}
            onClick={() => onChange(isActive && s !== '' ? '' : s)}
            className={`rounded-full font-semibold border transition-colors ${
              isActive
                ? styles.active + ' border-transparent'
                : `bg-white ${styles.border} ${styles.text} hover:bg-slate-50`
            }`}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            {LABELS[s]}
          </button>
        )
      })}
    </div>
  )
}
