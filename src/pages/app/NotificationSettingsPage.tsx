import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Zap, Mail, Clock } from 'lucide-react'
import Toggle from '../../components/ui/Toggle'
import { useNotifications } from '../../context/NotificationsContext'

const notificationItems = [
  {
    key: 'instantAlerts' as const,
    icon: Zap,
    label: 'Instant alerts',
    desc: 'Get notified the moment a listing appears',
  },
  {
    key: 'emailAlerts' as const,
    icon: Mail,
    label: 'Email alerts',
    desc: 'Matching listings sent to your inbox',
  },
  {
    key: 'dailyDigest' as const,
    icon: Clock,
    label: 'Daily digest',
    desc: 'Receive a daily email at 6 PM with all new listings that matched your search criteria throughout the day',
  },
]

export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const { prefs, setPref } = useNotifications()

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="active:opacity-60">
          <ChevronLeft size={22} strokeWidth={2} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Notification settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 py-5">
          <p className="text-sm text-muted leading-relaxed mb-6">
            Control exactly how and when Roof alerts you. In Amsterdam, listings disappear in minutes — speed matters.
          </p>

          <div className="space-y-5">
            {notificationItems.map(({ key, icon: Icon, label, desc }) => (
              <div key={key} className="flex items-start gap-4">
                <div className="w-9 h-9 bg-secondary rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5">
                  <Icon size={16} strokeWidth={1.8} className="text-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[15px] font-semibold text-foreground">{label}</p>
                    <Toggle
                      label=""
                      checked={prefs[key]}
                      onChange={(v) => setPref(key, v)}
                    />
                  </div>
                  <p className="text-sm text-muted leading-relaxed pr-12">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info callout */}
        <div className="mx-5 mb-8 p-4 bg-secondary rounded-2xl">
          <p className="text-xs text-muted leading-relaxed">
            Push notifications require permission from your device. You can update this anytime in your phone's settings.
          </p>
        </div>
      </div>
    </div>
  )
}
