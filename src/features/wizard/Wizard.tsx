import { useState } from 'react'
import { createSession } from '../../lib/api'
import { useAuth, type VisibleClinic } from '../auth'
import type { SessionWithStations } from '../dashboard'
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

export function Wizard({
  initialSession,
  onExit,
}: {
  initialSession: SessionWithStations | null
  onExit: () => void
}) {
  const { visibleClinics } = useAuth()
  const { nameFor, reload: reloadBarang } = useBarang()

  const [state, setState] = useState(() => {
    if (initialSession) {
      const step: WizardStep = initialSession.session.status === 'Finished' ? 'report' : 'hub'
      return {
        ...initialWizardState(),
        step,
        auditType: initialSession.session.audit_type,
        clinic: clinicFor(visibleClinics, initialSession.session.clinic_id, initialSession.session.clinic_name),
        sessionId: initialSession.session.id,
      }
    }
    return initialWizardState()
  })

  const { data, loading, error, reload } = useSessionData(state.sessionId)

  async function handleCreateSession(clinic: VisibleClinic, roomIds: string[]) {
    if (!state.auditType) return
    const sessionId = await createSession(clinic.id, state.auditType, roomIds)
    setState((s) => ({ ...s, clinic, roomIds, sessionId, step: 'sistem' }))
  }

  return (
    <div>
      <Breadcrumb step={state.step} />

      {state.step === 'type' && <StepType onChoose={(auditType) => setState((s) => ({ ...s, auditType, step: 'clinic' }))} />}

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
