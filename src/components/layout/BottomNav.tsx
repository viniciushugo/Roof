import { useNavigate, useLocation } from 'react-router-dom'
import RoofIcon from '../../assets/RoofIcon'
import { useAlerts } from '../../context/AlertsContext'

const navItems = [
  {
    label: 'Roof',
    path: '/app/rooms',
    isCenter: true,
  },
  {
    label: 'Liked',
    path: '/app/liked',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    label: 'Alerts',
    path: '/app/alerts',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        <path d="M4 2C2.8 3.7 2 5.7 2 8"/>
        <path d="M22 8c0-2.3-.8-4.3-2-6"/>
      </svg>
    ),
  },
  {
    label: 'Account',
    path: '/app/account',
    // also match /app/profile and /app/settings for backwards compat
    matchPaths: ['/app/account', '/app/profile', '/app/settings'],
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { unreadCount } = useAlerts()

  return (
    <div className="flex-shrink-0 bg-background border-t border-border">
      <div className="flex items-center justify-around px-1 pb-safe-bottom py-2">
        {navItems.map((item) => {
          const matchPaths = (item as any).matchPaths ?? [item.path]
          const isActive = matchPaths.some((p: string) => pathname.startsWith(p))
          const showBadge = item.label === 'Alerts' && unreadCount > 0

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              {...(item.label === 'Alerts' ? { 'data-tour': 'alerts' } : {})}
              className={`flex flex-col items-center gap-1 min-w-[64px] py-1 active:opacity-60 transition-opacity ${
                isActive ? 'text-foreground' : 'text-neutral-400'
              }`}
            >
              <div className="relative">
                {item.isCenter ? (
                  <RoofIcon size={22} />
                ) : (
                  item.icon!(isActive)
                )}
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
