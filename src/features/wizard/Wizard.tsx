import { useEffect, useRef, useState } from 'react'
import { createSession } from '../../lib/api'
import { useAuth, type VisibleClinic } from '../auth'
import { StepType } from './StepType'
import { StepClinicStations } from './StepClinicStations'
import { StepSistem } from './StepSistem'
import { StepHub } from './StepHub'
import { StepDentalLog } from './StepDentalLog'
import { StepReport } from './StepReport'
import { useSessionData } from './useSessionData'
import { useBarang } from './useBarang'
import { Breadcrumb, Banner } from './shared'
import { initialWizardState, type WizardStep } from './types'

function clinicFor(visibleClinics: VisibleClinic[], clinicId: string, fallbackName: string): VisibleClinic {
  return visibleClinics.find((c) => c.id === clinicId) ?? { id: clinicId, name: fallbackName, dentals: [] }
}

// `sessionId` is all that's needed to resume — everything else (audit type,
// clinic, which step to land on) is derived once the session data loads, so
// a route like /wizard/:sessionId can drive this directly without the caller
// having to have a full session object on hand already.
export function Wizard({ sessionId: resumeSessionId, onExit }: { sessionId: string | null; onExit: () => void }) {
  const { visibleClinics } = useAuth()
  const { nameFor, reload: reloadBarang } = useBarang()

  const [state, setState] = useState(() =>
    resumeSessionId
      ? { ...initialWizardState(), sessionId: resumeSessionId, step: 'hub' as WizardStep }
      : initialWizardState()
  )

  const { data, loading, error, reload } = useSessionData(state.sessionId)
  const resumeInitialized = useRef(false)

  useEffect(() => {
    if (data && resumeSessionId && !resumeInitialized.current) {
      resumeInitialized.current = true
      setState((s) => ({
        ...s,
        step: data.session.status === 'Finished' ? 'report' : 'hub',
        auditType: data.session.audit_type,
        clinic: clinicFor(visibleClinics, data.session.clinic_id, data.session.clinic_name),
      }))
    }
  }, [data, resumeSessionId, visibleClinics])

  async function handleCreateSession(clinic: VisibleClinic, roomIds: string[]) {
    if (!state.auditType) return
    const sessionId = await createSession(clinic.id, state.auditType, roomIds)
    setState((s) => ({ ...s, clinic, roomIds, sessionId, step: 'sistem' }))
  }

  return (
    <div>
      <Breadcrumb step={state.step} />

      {state.step === 'type' && (
        <StepType onChoose={(auditType) => setState((s) => ({ ...s, auditType, step: 'clinic' }))} onExit={onExit} />
      )}

      {state.step === 'clinic' && state.auditType && (
        <StepClinicStations
          clinics={visibleClinics}
          auditType={state.auditType}
          onBack={() => setState((s) => ({ ...s, step: 'type' }))}
          onContinue={handleCreateSession}
        />
      )}

      {state.step !== 'type' && state.step !== 'clinic' && (
        <>
          {loading && !data && <div className="bg-paper border border-line rounded-[10px] p-6 text-sm text-ink-soft">Loading…</div>}
          {error && <Banner kind="error">{error}</Banner>}

          {data && state.step === 'sistem' && state.sessionId && (
            <StepSistem
              sessionId={state.sessionId}
              data={data}
              onExit={onExit}
              onReload={async () => {
                await reload()
                await reloadBarang()
              }}
              onContinue={() => setState((s) => ({ ...s, step: 'hub' }))}
            />
          )}

          {data && state.step === 'hub' && state.sessionId && state.clinic && (
            <StepHub
              sessionId={state.sessionId}
              clinic={state.clinic}
              data={data}
              onExit={onExit}
              onReload={reload}
              onOpenStation={(roomId) => setState((s) => ({ ...s, currentRoomId: roomId, step: 'dentallog' }))}
              onFinished={() => setState((s) => ({ ...s, step: 'report' }))}
            />
          )}

          {data && state.step === 'dentallog' && state.sessionId && state.currentRoomId && (
            (() => {
              const dental = data.dentals.find((d) => d.roomId === state.currentRoomId)
              if (!dental) return <Banner kind="error">Station not found.</Banner>
              return (
                <StepDentalLog
                  sessionId={state.sessionId!}
                  roomId={dental.roomId}
                  clinicName={data.session.clinic_name}
                  auditType={data.session.audit_type}
                  dentalName={dental.name}
                  status={dental.status}
                  submittedAt={dental.submittedAt}
                  ketersesuaian={dental.ketersesuaian}
                  lines={dental.lines}
                  nameFor={nameFor}
                  onBack={() => setState((s) => ({ ...s, step: 'hub' }))}
                  onReload={async () => {
                    await reload()
                    await reloadBarang()
                  }}
                  onSubmitted={() => setState((s) => ({ ...s, step: 'hub' }))}
                />
              )
            })()
          )}

          {data && state.step === 'report' && <StepReport data={data} onBackToDashboard={onExit} />}
        </>
      )}
    </div>
  )
}
