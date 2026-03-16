import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="active:opacity-60">
            <ChevronLeft size={22} strokeWidth={2} className="text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Privacy Policy</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-6 space-y-6">
        <p className="text-xs text-muted uppercase tracking-wide font-semibold">Last updated: March 14, 2026</p>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">1. What we collect</h2>
          <p className="text-sm text-muted leading-relaxed">
            When you create an account we store your name, email address, and search preferences (cities, budget, housing type). We also store which listings you save or view so we can personalize your experience.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">2. How we use your data</h2>
          <p className="text-sm text-muted leading-relaxed">
            Your data is used to match you with relevant rental listings, send alert notifications, and deliver the daily digest email if you opt in. We never sell your personal information to third parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">3. Listing data</h2>
          <p className="text-sm text-muted leading-relaxed">
            Roof aggregates publicly available rental listings from platforms like Pararius, Kamernet, and Huurwoningen. We do not host or verify the accuracy of these listings. Always confirm details directly with the landlord or platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">4. Data storage</h2>
          <p className="text-sm text-muted leading-relaxed">
            Your data is stored securely on Supabase infrastructure within the EU. We use industry-standard encryption for data in transit and at rest.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">5. Third-party services</h2>
          <p className="text-sm text-muted leading-relaxed">
            We use Supabase (authentication and database), Resend (transactional emails), and Google (OAuth sign-in). Each service has its own privacy policy governing how they handle your data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">6. Your rights</h2>
          <p className="text-sm text-muted leading-relaxed">
            You can request a copy of your data or ask us to delete your account at any time by emailing hello@getroof.nl. Under GDPR, you have the right to access, rectify, and erase your personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">7. Cookies</h2>
          <p className="text-sm text-muted leading-relaxed">
            Roof uses essential cookies and local storage to keep you signed in and remember your preferences. We do not use tracking or advertising cookies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">8. Contact</h2>
          <p className="text-sm text-muted leading-relaxed">
            Questions about this policy? Reach us at hello@getroof.nl.
          </p>
        </section>

        <div className="pb-8" />
      </div>
    </div>
  )
}
