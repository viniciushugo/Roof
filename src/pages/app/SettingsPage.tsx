import { useNavigate } from 'react-router-dom'
import { Bell, Mail, Zap, Clock, ChevronRight } from 'lucide-react'
import Toggle from '../../components/ui/Toggle'
import BottomNav from '../../components/layout/BottomNav'
import { useNotifications } from '../../context/NotificationsContext'

const ABOUT_ITEMS = [
  { label: 'Privacy Policy', path: '/app/privacy' },
  { label: 'Terms of Service', path: '/app/terms' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { prefs, setPref } = useNotifications()

  return (
    <div className="relative flex flex-col h-full bg-background">
      {/* Header — left-aligned, no back button (tab bar page) */}
      <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Notifications section */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} strokeWidth={1.8} className="text-foreground" />
            <h2 className="text-[15px] font-semibold text-foreground">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap size={16} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="flex-1">
                <Toggle label="Instant alerts" checked={prefs.instantAlerts} onChange={(v) => setPref('instantAlerts', v)} />
                <p className="text-xs text-muted mt-0.5">Get notified the moment a listing appears</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail size={16} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="flex-1">
                <Toggle label="Email alerts" checked={prefs.emailAlerts} onChange={(v) => setPref('emailAlerts', v)} />
                <p className="text-xs text-muted mt-0.5">Matching listings sent to your inbox</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={16} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="flex-1">
                <Toggle label="Daily digest" checked={prefs.dailyDigest} onChange={(v) => setPref('dailyDigest', v)} />
                <p className="text-xs text-muted mt-0.5">
                  Receive a daily email at 6 PM with all new listings that matched your search criteria throughout the day
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-border mx-5" />

        {/* About */}
        <div className="px-5 py-5 space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">About</h2>
          {ABOUT_ITEMS.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} className="flex justify-between items-center w-full text-[15px] text-foreground py-1 active:opacity-60">
              {item.label}
              <ChevronRight size={16} className="text-muted" />
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted py-8">Roof v0.1.0 · Made by expats</p>
      </div>

      <BottomNav />
    </div>
  )
}
