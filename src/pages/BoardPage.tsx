import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { AppShell } from '@/components/Layout';
import { Button, Input, Modal } from '@/components/common';
import { BoardColumn, FacilitatorToolbar } from '@/components/Board';
import { useBoardStore } from '@/stores/boardStore';

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
  } = useBoardStore();

  const [participantName, setParticipantName] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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

  return (
    <AppShell
      headerRight={
        isJoined ? (
          <FacilitatorToolbar
            settings={board.settings}
            participantCount={participants.length}
            boardId={board.id}
            onUpdateSettings={updateSettings}
          />
        ) : undefined
      }
    >
      {/* Board header */}
      <div className="border-b border-[var(--color-gray-1)] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <h2 className="text-xl text-[var(--color-gray-8)]">{board.title}</h2>
          {board.description && (
            <p className="mt-1 text-sm text-[var(--color-gray-5)]">{board.description}</p>
          )}
        </div>
      </div>

      {/* Board columns */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {isJoined ? (
          columns.length > 0 ? (
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
                      cardCreationDisabled={
                        board.settings.card_creation_disabled || board.settings.board_locked
                      }
                      onAddCard={handleAddCard}
                      onUpdateCard={updateCard}
                      onDeleteCard={deleteCard}
                      onToggleVote={toggleVote}
                    />
                  ))}
              </div>
            </DndContext>
          ) : (
            <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-white/50 p-12 text-center">
              <p className="text-lg font-medium text-[var(--color-gray-5)]">No columns yet</p>
              <p className="mt-2 text-sm text-[var(--color-gray-4)]">
                The board admin can add columns to get started.
              </p>
            </div>
          )
        ) : (
          <div className="py-12 text-center">
            <p className="text-[var(--color-gray-5)]">Join the board to participate</p>
          </div>
        )}
      </div>

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
    </AppShell>
  );
}
