import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MessageSquare, Sparkles, Shield, Zap, ArrowRight } from 'lucide-react'
import { AnimateIn } from '../components/AnimateIn'

const benefits = [
  {
    icon: Sparkles,
    title: 'AI-Powered Intake',
    description: 'Let the assistant qualify leads, capture briefs, and enrich data automatically.',
  },
  {
    icon: Zap,
    title: 'Instant Follow-Up',
    description: 'AI-drafted emails and shareable briefs — respond before they forget.',
  },
  {
    icon: Shield,
    title: 'Smart Qualification',
    description: 'Know which leads are in scope, who needs info, and who to refer elsewhere.',
  },
]

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error)
        } else {
          setSuccessMessage(
            'Account created! Check your email to confirm your account, then sign in.'
          )
          setIsSignUp(false)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error)
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-gradient-to-br from-primary to-[#0B5E58] p-12 relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/[0.03]" aria-hidden="true" />
        
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading text-xl font-semibold text-white">Intake</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10 mt-auto mb-16">
          <AnimateIn from="bottom" distance="24px" duration={500}>
            <h1 className="font-heading text-3xl font-bold leading-tight text-white">
              Never lose a lead<br />again.
            </h1>
            <p className="mt-4 max-w-sm text-base text-white/70 leading-relaxed">
              Your AI client intake copilot — qualifies leads, captures project briefs, 
              and drafts follow-ups so you can focus on the work you love.
            </p>
          </AnimateIn>
        </div>

        {/* Benefits list */}
        <div className="relative z-10 space-y-5">
          {benefits.map((item, i) => (
            <AnimateIn key={item.title} from="bottom" distance="16px" duration={400} delay={200 + i * 100}>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <item.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-white/60">{item.description}</p>
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12 lg:px-12">
        <AnimateIn from="bottom" distance="20px" duration={400} className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {isSignUp ? 'Create your account' : 'Sign in to Intake'}
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              {isSignUp
                ? 'Set up your client intake dashboard'
                : 'Access your lead management dashboard'}
            </p>
          </div>

          {/* Desktop heading */}
          <div className="mb-8 hidden lg:block">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              {isSignUp
                ? 'Set up your client intake dashboard'
                : 'Sign in to your Intake dashboard'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground/80"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground/80"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5 block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div
                className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
                role="status"
              >
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full cursor-pointer overflow-hidden rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                {submitting
                  ? 'Please wait…'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
                {!submitting && <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />}
              </span>
            </button>
          </form>

          {/* Toggle */}
          <p className="mt-6 text-center text-sm text-foreground/60">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setSuccessMessage(null)
              }}
              className="cursor-pointer font-medium text-primary underline-offset-2 transition-colors duration-150 hover:text-primary/80 hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </p>

          {/* Mobile benefits teaser */}
          <div className="mt-8 space-y-3 border-t border-border pt-6 lg:hidden">
            {benefits.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-foreground/50">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>
      </div>
    </div>
  )
}