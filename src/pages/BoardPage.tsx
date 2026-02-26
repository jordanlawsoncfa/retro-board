import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Link2, Check } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Input, Modal } from '@/components/common';
import { BoardColumn, FacilitatorToolbar, VoteStatus, ViewToggle, SwimlaneView, ListView, TimelineView, ParticipantPopover } from '@/components/Board';
import type { BoardView } from '@/types';
import { useBoardStore } from '@/stores/boardStore';
import { useTimer } from '@/hooks/useTimer';
import { usePresence } from '@/hooks/usePresence';
import { TimerDisplay } from '@/components/Timer';
import { ActionItemsPanel } from '@/components/ActionItems';
import { exportMarkdown, exportCsv } from '@/utils/export';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const {
    board,
    columns,
    cards,
    votes,
    participants,
    currentParticipantId,
    loading,
    error,
    fetchBoard,
    joinBoard,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    toggleVote,
    updateSettings,
    subscribeToBoard,
    actionItems,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    completeBoard,
    onlineParticipantIds,
    updateParticipant,
    removeParticipant,
  } = useBoardStore();

  const [participantName, setParticipantName] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get('view') as BoardView) || 'grid';

  const handleChangeView = useCallback((view: BoardView) => {
    setSearchParams(view === 'grid' ? {} : { view });
  }, [setSearchParams]);

  const { timer, start: timerStart, pause: timerPause, resume: timerResume, reset: timerReset } = useTimer({
    boardId: boardId || '',
  });

  usePresence(boardId, currentParticipantId);

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId);
    }
  }, [boardId, fetchBoard]);

  // Show join modal if not already joined
  useEffect(() => {
    if (boardId && !loading && board) {
      const stored = sessionStorage.getItem(`retro-pid-${boardId}`);
      if (!stored) {
        setShowJoinModal(true);
      }
    }
  }, [boardId, loading, board]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (boardId && currentParticipantId) {
      const unsubscribe = subscribeToBoard(boardId);
      return unsubscribe;
    }
  }, [boardId, currentParticipantId, subscribeToBoard]);

  const handleJoin = async () => {
    if (!participantName.trim() || !boardId) return;
    try {
      await joinBoard(boardId, participantName.trim());
      setShowJoinModal(false);
    } catch (err) {
      console.error('Failed to join board:', err);
    }
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const cardId = active.id as string;
      const overId = over.id as string;

      // Determine target column — drop on a card or on the column itself
      const overCard = cards.find((c) => c.id === overId);
      const targetColumnId = overCard
        ? overCard.column_id
        : columns.find((c) => c.id === overId)?.id;

      if (!targetColumnId) return;

      const targetCards = cards
        .filter((c) => c.column_id === targetColumnId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);

      const overIndex = overCard
        ? targetCards.findIndex((c) => c.id === overId)
        : targetCards.length;

      const newPosition = overIndex >= 0 ? overIndex : targetCards.length;

      moveCard(cardId, targetColumnId, newPosition);
    },
    [cards, columns, moveCard]
  );

  const handleAddCard = useCallback(
    (columnId: string, text: string) => {
      addCard(columnId, text);
    },
    [addCard]
  );

  const handleExportMarkdown = useCallback(() => {
    if (!board) return;
    exportMarkdown({
      boardTitle: board.title,
      boardDescription: board.description,
      columns,
      cards,
      votes,
      actionItems,
    });
  }, [board, columns, cards, votes, actionItems]);

  const handleExportCsv = useCallback(() => {
    if (!board) return;
    exportCsv({
      boardTitle: board.title,
      boardDescription: board.description,
      columns,
      cards,
      votes,
      actionItems,
    });
  }, [board, columns, cards, votes, actionItems]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const handleCompleteRetro = useCallback(async () => {
    await completeBoard();
    setShowCompleteModal(false);
  }, [completeBoard]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-gray-2)] border-t-[var(--color-navy)]" />
            <p className="mt-4 text-[var(--color-gray-5)]">Loading board...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !board) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h2 className="text-[var(--color-gray-8)]">Board not found</h2>
            <p className="mt-2 text-[var(--color-gray-5)]">
              {error || 'This board may have been archived or the link is invalid.'}
            </p>
            <Button className="mt-6" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const isJoined = !!currentParticipantId;
  const isObscured = board.settings.card_visibility === 'hidden';
  const isCompleted = !!board.archived_at;
  const currentParticipant = participants.find((p) => p.id === currentParticipantId);
  const isAdmin = currentParticipant?.is_admin ?? false;

  return (
    <AppShell
      headerRight={
        isAdmin && !isCompleted ? (
          <FacilitatorToolbar
            settings={board.settings}

            timer={timer}
            onUpdateSettings={updateSettings}
            onTimerStart={timerStart}
            onTimerPause={timerPause}
            onTimerResume={timerResume}
            onTimerReset={timerReset}
            actionItemCount={actionItems.length}
            onToggleActionItems={() => setShowActionItems((v) => !v)}
            isCompleted={isCompleted}
            onCompleteRetro={() => setShowCompleteModal(true)}
          />
        ) : undefined
      }
    >
      {/* Board header */}
      <div className="border-b border-[var(--color-gray-1)] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl text-[var(--color-gray-8)]">
                {board.title}
                {isCompleted && (
                  <span className="ml-2 inline-flex items-center rounded-[var(--radius-full)] bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                    Completed
                  </span>
                )}
              </h2>
              {board.description && (
                <p className="mt-1 text-sm text-[var(--color-gray-5)]">{board.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ParticipantPopover
                participants={participants}
                onlineParticipantIds={onlineParticipantIds}
                currentParticipantId={currentParticipantId}
                isAdmin={isAdmin}
                boardCreatorId={board.created_by}
                onPromote={(id) => updateParticipant(id, { is_admin: true })}
                onDemote={(id) => updateParticipant(id, { is_admin: false })}
                onRemove={(id) => removeParticipant(id)}
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1.5 text-sm text-[var(--color-gray-6)] transition-colors hover:border-[var(--color-gray-3)] hover:text-[var(--color-gray-8)]"
              >
                {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
                {linkCopied ? 'Copied!' : 'Share'}
              </button>
              {isJoined && timer.status !== 'idle' && (
                <TimerDisplay timer={timer} />
              )}
              {isJoined && board.settings.voting_enabled && (
                <VoteStatus
                  votesUsed={votes.filter((v) => v.voter_id === currentParticipantId).length}
                  maxVotes={board.settings.max_votes_per_participant}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View toggle */}
      {isJoined && columns.length > 0 && (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6">
          <ViewToggle currentView={currentView} onChangeView={handleChangeView} />
        </div>
      )}

      {/* Board content */}
      {isJoined ? (
        columns.length > 0 ? (
          <>
            {currentView === 'grid' && (
              <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(280px, 1fr))`,
                    }}
                  >
                    {[...columns]
                      .sort((a, b) => a.position - b.position)
                      .map((col) => (
                        <BoardColumn
                          key={col.id}
                          column={col}
                          cards={cards.filter((c) => c.column_id === col.id)}
                          votes={votes}
                          currentParticipantId={currentParticipantId}
                          isObscured={isObscured}
                          votingEnabled={board.settings.voting_enabled}
                          secretVoting={board.settings.secret_voting}
                          cardCreationDisabled={
                            board.settings.card_creation_disabled || board.settings.board_locked
                          }
                          maxVotesPerParticipant={board.settings.max_votes_per_participant}
                          onAddCard={handleAddCard}
                          onUpdateCard={updateCard}
                          onDeleteCard={deleteCard}
                          onToggleVote={toggleVote}
                          isCompleted={isCompleted}
                        />
                      ))}
                  </div>
                </DndContext>
              </div>
            )}

            {currentView === 'swimlane' && (
              <SwimlaneView
                columns={columns}
                cards={cards}
                votes={votes}
                participants={participants}
                currentParticipantId={currentParticipantId}
                isObscured={isObscured}
                isCompleted={isCompleted}
                votingEnabled={board.settings.voting_enabled}
                secretVoting={board.settings.secret_voting}
                maxVotesPerParticipant={board.settings.max_votes_per_participant}
                boardCreatedAt={board.created_at}
                onUpdateCard={updateCard}
                onDeleteCard={deleteCard}
                onToggleVote={toggleVote}
              />
            )}

            {currentView === 'list' && (
              <ListView
                columns={columns}
                cards={cards}
                votes={votes}
                currentParticipantId={currentParticipantId}
                isObscured={isObscured}
                votingEnabled={board.settings.voting_enabled}
                maxVotesPerParticipant={board.settings.max_votes_per_participant}
                onToggleVote={toggleVote}
              />
            )}

            {currentView === 'timeline' && (
              <TimelineView
                columns={columns}
                cards={cards}
                votes={votes}
                currentParticipantId={currentParticipantId}
                isObscured={isObscured}
                votingEnabled={board.settings.voting_enabled}
                maxVotesPerParticipant={board.settings.max_votes_per_participant}
                onToggleVote={toggleVote}
              />
            )}
          </>
        ) : (
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
            <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-white/50 p-12 text-center">
              <p className="text-lg font-medium text-[var(--color-gray-5)]">No columns yet</p>
              <p className="mt-2 text-sm text-[var(--color-gray-4)]">
                The board admin can add columns to get started.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <div className="py-12 text-center">
            <p className="text-[var(--color-gray-5)]">Join the board to participate</p>
          </div>
        </div>
      )}

      {/* Join Modal */}
      <Modal
        open={showJoinModal}
        onClose={() => navigate('/')}
        title="Join Retrospective"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[var(--color-gray-5)]">
            Enter your display name to join{' '}
            <strong className="text-[var(--color-gray-8)]">{board.title}</strong>
          </p>
          <Input
            id="display-name"
            label="Display Name"
            placeholder="e.g., Jordan"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button onClick={handleJoin} disabled={!participantName.trim()}>
              Join Board
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Retro Modal */}
      <Modal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Complete Retrospective"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[var(--color-gray-5)]">
            The board will become read-only. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteRetro}>
              Complete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Panel overlay */}
      {showActionItems && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowActionItems(false)}
        />
      )}

      {/* Action Items Panel */}
      {isJoined && (
        <ActionItemsPanel
          open={showActionItems}
          onClose={() => setShowActionItems(false)}
          actionItems={actionItems}
          participants={participants}
          onAddItem={addActionItem}
          onUpdateItem={updateActionItem}
          onDeleteItem={deleteActionItem}
          onExportMarkdown={handleExportMarkdown}
          onExportCsv={handleExportCsv}
          readOnly={isCompleted}
        />
      )}
    </AppShell>
  );
}
