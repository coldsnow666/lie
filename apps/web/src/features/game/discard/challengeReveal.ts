/**
 * @Description: 质疑结算后的弃牌翻开和回收飞牌数据转换工具。
 *
 * @Date 2026-06-12 14:47
 */
import type { PublicGameEvent } from "@lie/shared";
import type { Card } from "@lie/shared";
import type { ChallengeResolvedGameEvent, DisplayDiscardCard, ReturnFlightCard } from "../model/gameTableTypes";

export function getLatestChallengeResolvedEvent(events: PublicGameEvent[], turnSeq: number) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === "challenge_resolved" && event.turnSeq === turnSeq) {
      return event;
    }
  }

  return null;
}

function revealLastPlayCards(cards: DisplayDiscardCard[], event: ChallengeResolvedGameEvent) {
  const revealedTurnSeq = event.turnSeq - 1;
  const exactRevealIndexes = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.turnSeq === revealedTurnSeq && card.playedByPlayerId === event.challengedPlayerId)
    .map(({ index }) => index);
  const fallbackRevealIndexes = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.playedByPlayerId === event.challengedPlayerId)
    .slice(-event.revealedCards.length)
    .map(({ index }) => index);
  const revealIndexes = exactRevealIndexes.length === event.revealedCards.length ? exactRevealIndexes : fallbackRevealIndexes;

  return new Map(revealIndexes.map((cardIndex, revealIndex) => [cardIndex, event.revealedCards[revealIndex]]));
}

function revealAllReturnedCards(cards: DisplayDiscardCard[], event: ChallengeResolvedGameEvent, returnedCards: Card[]) {
  const revealCardByIndex = revealLastPlayCards(cards, event);
  const usedCardIds = new Set(Array.from(revealCardByIndex.values()).map((card) => card.id));
  const remainingReturnedCards = returnedCards.filter((card) => !usedCardIds.has(card.id));

  cards.forEach((_, index) => {
    if (revealCardByIndex.has(index)) {
      return;
    }

    const nextCard = remainingReturnedCards.shift();

    if (nextCard) {
      revealCardByIndex.set(index, nextCard);
    }
  });

  return revealCardByIndex;
}

export function revealDiscardCards({
  cards,
  event,
  returnedCards = [],
  selfPlayerId,
}: {
  cards: DisplayDiscardCard[];
  event: ChallengeResolvedGameEvent | null;
  returnedCards?: Card[];
  selfPlayerId?: string | null;
}): DisplayDiscardCard[] {
  if (!event) {
    return cards;
  }

  const revealCardByIndex =
    event.pileTakenByPlayerId === selfPlayerId && returnedCards.length >= cards.length
      ? revealAllReturnedCards(cards, event, returnedCards)
      : revealLastPlayCards(cards, event);

  return cards.map((card, index) => {
    const revealCard = revealCardByIndex.get(index);

    if (!revealCard) {
      return card;
    }

    return {
      ...card,
      revealCard,
    };
  });
}

export function revealReturnFlights({
  event,
  flights,
  returnedCards = [],
  selfPlayerId,
}: {
  event: ChallengeResolvedGameEvent | null;
  flights: ReturnFlightCard[];
  returnedCards?: Card[];
  selfPlayerId?: string | null;
}): ReturnFlightCard[] {
  if (!event) {
    return flights;
  }

  if (event.pileTakenByPlayerId === selfPlayerId && returnedCards.length >= flights.length) {
    const returnedCardsByIndex = [...returnedCards];
    const lastPlayRevealByFlightId = new Map<string, Card>();
    const revealedCards = [...event.revealedCards];
    const revealedTurnSeq = event.turnSeq - 1;

    flights.forEach((flight) => {
      const isRevealedFlight = flight.sourceTurnSeq === revealedTurnSeq && flight.sourcePlayedByPlayerId === event.challengedPlayerId;

      if (!isRevealedFlight) {
        return;
      }

      const sourceCard = revealedCards.shift();

      if (sourceCard) {
        lastPlayRevealByFlightId.set(flight.id, sourceCard);
      }
    });

    const usedCardIds = new Set(Array.from(lastPlayRevealByFlightId.values()).map((card) => card.id));
    const remainingReturnedCards = returnedCardsByIndex.filter((card) => !usedCardIds.has(card.id));

    return flights.map((flight) => {
      const lastPlayRevealCard = lastPlayRevealByFlightId.get(flight.id);

      return {
        ...flight,
        revealCard: lastPlayRevealCard ?? remainingReturnedCards.shift(),
      };
    });
  }

  const revealedCards = [...event.revealedCards];
  const revealedTurnSeq = event.turnSeq - 1;

  return flights.map((flight) => {
    const isRevealedFlight = flight.sourceTurnSeq === revealedTurnSeq && flight.sourcePlayedByPlayerId === event.challengedPlayerId;

    if (!isRevealedFlight) {
      return flight;
    }

    const sourceCard = revealedCards.shift();

    return sourceCard
      ? {
          ...flight,
          revealCard: sourceCard,
        }
      : flight;
  });
}
