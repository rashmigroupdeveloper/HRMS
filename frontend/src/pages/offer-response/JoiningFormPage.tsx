import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { JoiningFormSignInSkeleton } from '@/components/skeletons/offer-response/JoiningFormSignInSkeleton'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { CandidateCard, CandidatePageFrame } from './components/CandidatePageFrame'
import { candidateMessage } from './components/candidate-message'
import { JoiningFormPortal } from './components/JoiningFormPortal'

// The candidate's joining-form page (/joining-form/<token>), opened from the e-mail sent after they accepted the
// offer. The same secret link as the offer page; a one-time code signs them in (components/JoiningFormPortal).
// Before acceptance it points back to the offer page; once the form is closed (joined, withdrawn...) it says so.
export function JoiningFormPage() {
  const { token = '' } = useParams()
  const view = useQuery({ ...orpc.candidates.offerResponse.view.queryOptions({ input: { token } }), retry: false })
  const v = view.data
  // signed in (the same query as JoiningFormPortal's): the form needs the wide page
  const me = useQuery({ ...orpc.candidates.portal.me.queryOptions(), retry: false, enabled: !!v?.joiningFormOpen })

  return (
    <CandidatePageFrame title="Joining form" wide={!!v?.joiningFormOpen && !!me.data}>
      {/* the link is still being checked: it may end in a message, not the sign-in */}
      {view.isPending && <JoiningFormSignInSkeleton known={false} label="Opening your joining form" />}
      {view.error && (
        <CandidateCard>
          <h1 className="text-2xl font-light tracking-tight">This link does not work</h1>
          <p className="mt-2 text-sm text-muted-foreground">{candidateMessage(view.error)}</p>
        </CandidateCard>
      )}
      {v &&
        (v.joiningFormOpen ? (
          <JoiningFormPortal token={token} codeEmail={v.codeEmail} />
        ) : v.state === 'OPEN' ? (
          <CandidateCard>
            <h1 className="text-2xl font-light tracking-tight">Please answer your offer first</h1>
            <p className="mt-2 text-sm text-muted-foreground">The joining form opens once you have accepted the offer.</p>
            <Button variant="gold" size="lg" className="mt-5 w-full" nativeButton={false} render={<Link to={`/offer/${token}`} />}>
              Go to my offer <ArrowRight />
            </Button>
          </CandidateCard>
        ) : v.joiningFormNext === 'FROM_HR' ? (
          <CandidateCard>
            <h1 className="text-2xl font-light tracking-tight">Your joining form is not open yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">HR will send you the link to your joining form by e-mail.</p>
          </CandidateCard>
        ) : (
          <CandidateCard>
            <h1 className="text-2xl font-light tracking-tight">Your joining form is closed</h1>
            <p className="mt-2 text-sm text-muted-foreground">This form can no longer be opened online. Please contact HR if you need anything.</p>
          </CandidateCard>
        ))}
    </CandidatePageFrame>
  )
}
