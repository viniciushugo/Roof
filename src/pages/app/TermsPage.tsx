import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="active:opacity-60">
            <ChevronLeft size={22} strokeWidth={2} className="text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Terms of Service</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-6 space-y-6">
        <p className="text-xs text-muted uppercase tracking-wide font-semibold">Last updated: March 14, 2026</p>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">1. Acceptance</h2>
          <p className="text-sm text-muted leading-relaxed">
            By using Roof you agree to these terms. If you don't agree, please don't use the app. We may update these terms from time to time — continued use means you accept any changes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">2. What Roof does</h2>
          <p className="text-sm text-muted leading-relaxed">
            Roof is a rental listing aggregator for the Netherlands. We collect publicly available listings from third-party platforms and present them in one place. Roof does not own, manage, or verify any of these listings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">3. No guarantees</h2>
          <p className="text-sm text-muted leading-relaxed">
            Listings are provided "as is." We do our best to keep data accurate and up to date, but we cannot guarantee availability, pricing, or accuracy of any listing. Always verify details directly with the landlord or source platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">4. Your account</h2>
          <p className="text-sm text-muted leading-relaxed">
            You're responsible for keeping your login credentials secure. One account per person. Don't share your account or use Roof for any automated or commercial scraping purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">5. Acceptable use</h2>
          <p className="text-sm text-muted leading-relaxed">
            Don't use Roof to spam landlords, submit fraudulent applications, or engage in any activity that violates Dutch law. We reserve the right to suspend accounts that violate these terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">6. Intellectual property</h2>
          <p className="text-sm text-muted leading-relaxed">
            The Roof name, logo, and app design are our property. Listing content belongs to the respective platforms and landlords. You may not reproduce or redistribute listing data from Roof.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">7. Limitation of liability</h2>
          <p className="text-sm text-muted leading-relaxed">
            Roof is not liable for any damages arising from your use of the app, including missed listings, incorrect information, or failed notifications. Our total liability is limited to the amount you've paid us (which is zero for the free tier).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">8. Governing law</h2>
          <p className="text-sm text-muted leading-relaxed">
            These terms are governed by the laws of the Netherlands. Any disputes will be resolved in the courts of Amsterdam.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">9. Contact</h2>
          <p className="text-sm text-muted leading-relaxed">
            Questions? Email us at hello@getroof.nl.
          </p>
        </section>

        <div className="pb-8" />
      </div>
    </div>
  )
}
