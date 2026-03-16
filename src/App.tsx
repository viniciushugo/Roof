import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { SavedProvider } from './context/SavedContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { AlertsProvider } from './context/AlertsContext'
import { ListingsProvider } from './context/ListingsContext'
import { ViewedProvider } from './context/ViewedContext'

// Pages
import SplashPage from './pages/SplashPage'
import WelcomePage from './pages/WelcomePage'
import NamePage from './pages/onboarding/NamePage'
import HousingTypePage from './pages/onboarding/HousingTypePage'
import LocationPage from './pages/onboarding/LocationPage'
import BudgetPage from './pages/onboarding/BudgetPage'
import NotificationsPage from './pages/onboarding/NotificationsPage'
import CommunityPage from './pages/onboarding/CommunityPage'
import OnboardingAccountPage from './pages/onboarding/AccountPage'
import FilterDetailsPage from './pages/onboarding/FilterDetailsPage'
import LoginPage from './pages/LoginPage'
import RoomsPage from './pages/app/RoomsPage'
import LikedPage from './pages/app/LikedPage'
import AlertsPage from './pages/app/ChatsPage'
import ProfilePage from './pages/app/ProfilePage'
import SettingsPage from './pages/app/SettingsPage'
import AccountPage from './pages/app/AccountPage'
import PreferencesPage from './pages/app/PreferencesPage'
import NotificationSettingsPage from './pages/app/NotificationSettingsPage'
import PrivacyPolicyPage from './pages/app/PrivacyPolicyPage'
import TermsPage from './pages/app/TermsPage'

// When running inside Capacitor (native iOS/Android), strip the fake phone frame
// and go full screen with safe-area insets instead
if ((window as any).Capacitor?.isNative) {
  document.documentElement.classList.add('native')
}

export default function App() {
  return (
    <AuthProvider>
    <OnboardingProvider>
      <SavedProvider>
        <NotificationsProvider>
          <ListingsProvider>
          <AlertsProvider>
          <ViewedProvider>
          <BrowserRouter>
            <div className="phone-shell">
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<Navigate to="/splash" replace />} />
                  <Route path="/splash" element={<SplashPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/welcome" element={<WelcomePage />} />

                  {/* Onboarding */}
                  <Route path="/onboarding/name" element={<NamePage />} />
                  <Route path="/onboarding/housing-type" element={<HousingTypePage />} />
                  <Route path="/onboarding/location" element={<LocationPage />} />
                  <Route path="/onboarding/budget" element={<BudgetPage />} />
                  <Route path="/onboarding/filter-details" element={<FilterDetailsPage />} />
                  <Route path="/onboarding/notifications" element={<NotificationsPage />} />
                  <Route path="/onboarding/account" element={<OnboardingAccountPage />} />
                  <Route path="/onboarding/community" element={<CommunityPage />} />

                  {/* Main app */}
                  <Route path="/app/rooms" element={<RoomsPage />} />
                  <Route path="/app/liked" element={<LikedPage />} />
                  <Route path="/app/alerts" element={<AlertsPage />} />
                  <Route path="/app/account" element={<AccountPage />} />
                  <Route path="/app/profile" element={<ProfilePage />} />
                  <Route path="/app/settings" element={<SettingsPage />} />
                  <Route path="/app/preferences" element={<PreferencesPage />} />
                  <Route path="/app/notifications" element={<NotificationSettingsPage />} />
                  <Route path="/app/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/app/terms" element={<TermsPage />} />

                  <Route path="*" element={<Navigate to="/splash" replace />} />
                </Routes>
              </AnimatePresence>
            </div>
          </BrowserRouter>
          </ViewedProvider>
          </AlertsProvider>
          </ListingsProvider>
        </NotificationsProvider>
      </SavedProvider>
    </OnboardingProvider>
    </AuthProvider>
  )
}
